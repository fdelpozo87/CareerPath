import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gemini = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: gemini.generateContent }
    }
  },
}))

import { handleAdmin } from '../server/admin'
import { resetAuthCache } from '../server/auth'
import { runEndpoint } from '../server/endpoints'
import { resetRateLimits } from '../server/guard'

type Estado = 'pendiente' | 'activo' | 'desactivado'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

interface Fake {
  users: Record<string, { id: string; email: string; confirmed?: boolean }>
  perfiles: Record<string, { estado: Estado; last_seen_at: string | null }>
  calls: string[]
}

/** Supabase de mentira: lo justo para probar quién entra y quién no. */
function fakeSupabase(f: Fake) {
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    f.calls.push(`${method} ${url.replace('https://x.supabase.co', '')}`)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url.endsWith('/auth/v1/user')) {
      const token = String((init?.headers as Record<string, string>).Authorization).slice(7)
      const u = f.users[token]
      return u ? json({ id: u.id, email: u.email, email_confirmed_at: u.confirmed === false ? null : '2026-10-01T00:00:00Z' }) : json({}, 401)
    }
    if (url.includes('/rest/v1/bivio_perfiles')) {
      const id = /user_id=eq\.([^&]+)/.exec(url)?.[1]
      if (method === 'GET' && id) {
        const p = f.perfiles[id]
        const email = Object.values(f.users).find((u) => u.id === id)?.email ?? ''
        return json(p ? [{ user_id: id, email, estado: p.estado, created_at: '2026-10-01T00:00:00Z', last_seen_at: p.last_seen_at }] : [])
      }
      if (method === 'GET') return json(Object.entries(f.perfiles).map(([uid, p]) => ({ user_id: uid, email: 'x@y.z', estado: p.estado, created_at: '2026-10-01T00:00:00Z', last_seen_at: null })))
      if (method === 'POST') {
        const b = JSON.parse(String(init?.body))
        f.perfiles[b.user_id] = { estado: 'pendiente', last_seen_at: null }
        return json({}, 201)
      }
      if (method === 'PATCH' && id) {
        const b = JSON.parse(String(init?.body)) as { estado?: Estado }
        if (b.estado) f.perfiles[id].estado = b.estado
        return new Response(null, { status: 204 })
      }
    }
    if (url.includes('/auth/v1/admin/users/') && method === 'DELETE') return json({})
    return json({}, 404)
  })
}

const req = (token: string | null, body: unknown = {}, ip = '10.1.1.1') =>
  ({
    method: 'POST',
    headers: { host: 'careerpath.test', origin: 'https://careerpath.test', 'x-forwarded-for': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body,
    socket: {},
  }) as unknown as Parameters<typeof runEndpoint>[1]

const coachBody = { mode: 'turno', stage: 'diagnostico', path: 'quiebre', history: [{ role: 'user', text: 'Hola' }], cubiertos: [], sintesisPrevias: {} }
const modelReply = { response: { text: () => JSON.stringify({ mensaje: 'Hola, cuéntame.', objetivosCubiertos: [], listoParaAvanzar: false, derivacion: false }) } }

let fake: Fake
beforeEach(() => {
  resetRateLimits()
  resetAuthCache()
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('ACCESS_CODES', '')
  vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('ADMIN_EMAIL', 'admin@bivio.test')
  vi.stubEnv('REQUIRE_LOGIN', '')
  gemini.generateContent.mockReset().mockResolvedValue(modelReply)
  fake = {
    users: {
      tok_admin: { id: USER_ID, email: 'Admin@Bivio.test' },
      tok_activo: { id: OTHER_ID, email: 'ana@x.test' },
      tok_nuevo: { id: '33333333-3333-4333-8333-333333333333', email: 'nuevo@x.test' },
      tok_off: { id: '44444444-4444-4444-8444-444444444444', email: 'off@x.test' },
      tok_sinconfirmar: { id: '55555555-5555-4555-8555-555555555555', email: 'nc@x.test', confirmed: false },
    },
    perfiles: {
      [OTHER_ID]: { estado: 'activo', last_seen_at: new Date().toISOString() },
      '44444444-4444-4444-8444-444444444444': { estado: 'desactivado', last_seen_at: null },
    },
    calls: [],
  }
  fakeSupabase(fake)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('acceso por cuenta', () => {
  it('sin sesión, el coach pide entrar (401) y /api/access dice que falta la sesión', async () => {
    expect((await runEndpoint('coach', req(null, coachBody), 'k')).status).toBe(401)
    const acc = await runEndpoint('access', req(null), undefined)
    expect(acc.body).toMatchObject({ required: true, mode: 'accounts', ok: false, reason: 'sin_sesion' })
  })

  it('una cuenta activa usa el coach', async () => {
    const res = await runEndpoint('coach', req('tok_activo', coachBody), 'k')
    expect(res.status).toBe(200)
    expect(gemini.generateContent).toHaveBeenCalled()
  })

  it('una cuenta nueva queda pendiente: no usa el coach ni gasta cuota', async () => {
    const res = await runEndpoint('coach', req('tok_nuevo', coachBody), 'k')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ reason: 'pendiente' })
    expect(gemini.generateContent).not.toHaveBeenCalled()
    expect(fake.perfiles['33333333-3333-4333-8333-333333333333'].estado).toBe('pendiente')
  })

  it('una cuenta desactivada no entra', async () => {
    const res = await runEndpoint('coach', req('tok_off', coachBody), 'k')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ reason: 'desactivado' })
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })

  it('un email sin confirmar no cuenta como sesión', async () => {
    expect((await runEndpoint('coach', req('tok_sinconfirmar', coachBody), 'k')).status).toBe(401)
  })

  it('un token inventado no entra', async () => {
    expect((await runEndpoint('coach', req('inventado', coachBody), 'k')).status).toBe(401)
  })

  it('quien administra entra siempre, aunque su perfil diga otra cosa', async () => {
    fake.perfiles[USER_ID] = { estado: 'desactivado', last_seen_at: null }
    const res = await runEndpoint('coach', req('tok_admin', coachBody), 'k')
    expect(res.status).toBe(200)
    expect(fake.perfiles[USER_ID].estado).toBe('activo')
    const acc = await runEndpoint('access', req('tok_admin'), undefined)
    expect(acc.body).toMatchObject({ ok: true, isAdmin: true })
  })

  it('desactivar a alguien lo deja afuera en cuanto vence el caché', async () => {
    expect((await runEndpoint('coach', req('tok_activo', coachBody), 'k')).status).toBe(200)
    fake.perfiles[OTHER_ID].estado = 'desactivado'
    resetAuthCache() // el panel también lo limpia al cambiar un estado
    expect((await runEndpoint('coach', req('tok_activo', coachBody), 'k')).status).toBe(403)
  })

  it('el código de acceso viejo ya no abre nada cuando hay cuentas', async () => {
    vi.stubEnv('ACCESS_CODES', 'ana:K7QM-X2PD-9RTA')
    const r = req(null, coachBody)
    ;(r.headers as Record<string, string>)['x-access-code'] = 'K7QM-X2PD-9RTA'
    expect((await runEndpoint('coach', r, 'k')).status).toBe(401)
  })

  it('REQUIRE_LOGIN=0 vuelve al acceso por código (desarrollo local)', async () => {
    vi.stubEnv('REQUIRE_LOGIN', '0')
    expect((await runEndpoint('coach', req(null, coachBody), 'k')).status).toBe(200)
  })

  it('si no se puede verificar la cuenta, falla cerrado', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('red caída')
    })
    const res = await runEndpoint('coach', req('tok_activo', coachBody), 'k')
    expect(res.status).toBe(503)
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })
})

describe('panel de administración', () => {
  it('para quien no administra el panel no existe (404), también sin sesión', async () => {
    expect((await handleAdmin(req('tok_activo', { action: 'list' }))).status).toBe(404)
    expect((await handleAdmin(req(null, { action: 'list' }))).status).toBe(404)
  })

  it('quien administra ve la lista y se reconoce a sí mismo', async () => {
    const res = await handleAdmin(req('tok_admin', { action: 'list' }))
    expect(res.status).toBe(200)
    const users = (res.body as { users: { user_id: string; isSelf: boolean }[] }).users
    expect(users.length).toBeGreaterThan(0)
    expect(users.find((u) => u.user_id === USER_ID)?.isSelf ?? true).toBe(true)
  })

  it('activa, desactiva y elimina, pero no a sí mismo', async () => {
    const nuevo = '33333333-3333-4333-8333-333333333333'
    await runEndpoint('coach', req('tok_nuevo', coachBody), 'k') // crea su perfil pendiente
    expect((await handleAdmin(req('tok_admin', { action: 'setEstado', id: nuevo, estado: 'activo' }))).status).toBe(200)
    expect(fake.perfiles[nuevo].estado).toBe('activo')
    expect((await runEndpoint('coach', req('tok_nuevo', coachBody), 'k')).status).toBe(200)
    expect((await handleAdmin(req('tok_admin', { action: 'setEstado', id: nuevo, estado: 'desactivado' }))).status).toBe(200)
    expect((await runEndpoint('coach', req('tok_nuevo', coachBody), 'k')).status).toBe(403)

    expect((await handleAdmin(req('tok_admin', { action: 'delete', id: nuevo }))).status).toBe(200)
    expect(fake.calls.some((c) => c.startsWith('DELETE') && c.includes(nuevo))).toBe(true)

    expect((await handleAdmin(req('tok_admin', { action: 'delete', id: USER_ID }))).status).toBe(400)
    expect((await handleAdmin(req('tok_admin', { action: 'setEstado', id: USER_ID, estado: 'desactivado' }))).status).toBe(400)
  })

  it('valida lo que recibe', async () => {
    expect((await handleAdmin(req('tok_admin', { action: 'setEstado', id: 'no-es-uuid', estado: 'activo' }))).status).toBe(400)
    expect((await handleAdmin(req('tok_admin', { action: 'setEstado', id: OTHER_ID, estado: 'dios' }))).status).toBe(400)
    expect((await handleAdmin(req('tok_admin', { action: 'otra' }))).status).toBe(400)
  })
})
