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
  users: Record<string, { id: string; email: string; confirmed?: boolean; mfa?: boolean }>
  perfiles: Record<string, { estado: Estado; last_seen_at: string | null; acceso_profesionales?: boolean; acceso_empresas?: boolean }>
  calls: string[]
  otpOk?: boolean
  resendOk?: boolean
  mails?: { to: string; subject: string; html: string; text: string }[]
  audit: { id: number; at: string; actor_email: string; action: string; target_email: string; detail: unknown }[]
  auditFail?: boolean
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
      return u ? json({ id: u.id, email: u.email, email_confirmed_at: u.confirmed === false ? null : '2026-10-01T00:00:00Z', factors: u.mfa ? [{ id: 'f1', factor_type: 'totp', status: 'verified' }] : [] }) : json({}, 401)
    }
    if (url.includes('/rest/v1/bivio_perfiles')) {
      const id = /user_id=eq\.([^&]+)/.exec(url)?.[1]
      const byEmail = /email=eq\.([^&]+)/.exec(url)?.[1]
      if (method === 'GET' && byEmail) {
        const e = decodeURIComponent(byEmail)
        const u = Object.values(f.users).find((x) => x.email.toLowerCase() === e)
        const p = u ? f.perfiles[u.id] : undefined
        return json(u && p ? [{ user_id: u.id, email: u.email, estado: p.estado, created_at: '2026-10-01T00:00:00Z', last_seen_at: p.last_seen_at, acceso_profesionales: p.acceso_profesionales ?? true, acceso_empresas: p.acceso_empresas ?? true }] : [])
      }
      if (method === 'GET' && id) {
        const p = f.perfiles[id]
        const email = Object.values(f.users).find((u) => u.id === id)?.email ?? ''
        return json(p ? [{ user_id: id, email, estado: p.estado, created_at: '2026-10-01T00:00:00Z', last_seen_at: p.last_seen_at, acceso_profesionales: p.acceso_profesionales ?? true, acceso_empresas: p.acceso_empresas ?? true }] : [])
      }
      if (method === 'GET') return json(Object.entries(f.perfiles).map(([uid, p]) => ({ user_id: uid, email: 'x@y.z', estado: p.estado, created_at: '2026-10-01T00:00:00Z', last_seen_at: null })))
      if (method === 'POST') {
        const b = JSON.parse(String(init?.body))
        f.perfiles[b.user_id] = { estado: 'pendiente', last_seen_at: null }
        const known = Object.values(f.users).find((u) => u.id === b.user_id)
        if (!known) f.users[`tok_${b.email}`] = { id: b.user_id, email: b.email }
        return json({}, 201)
      }
      if (method === 'PATCH' && id) {
        const b = JSON.parse(String(init?.body)) as { estado?: Estado; acceso_profesionales?: boolean; acceso_empresas?: boolean }
        if (b.estado) f.perfiles[id].estado = b.estado
        if (typeof b.acceso_profesionales === 'boolean') f.perfiles[id].acceso_profesionales = b.acceso_profesionales
        if (typeof b.acceso_empresas === 'boolean') f.perfiles[id].acceso_empresas = b.acceso_empresas
        return new Response(null, { status: 204 })
      }
    }
    if (url.includes('/auth/v1/admin/users/') && method === 'DELETE') return json({})
    if (url.includes('/rest/v1/bivio_auditoria')) {
      if (method === 'POST') {
        if (f.auditFail) return json({}, 500)
        const b = JSON.parse(String(init?.body)) as Fake['audit'][number]
        f.audit.unshift({ ...b, id: f.audit.length + 1, at: new Date().toISOString() })
        return new Response(null, { status: 201 })
      }
      return json(f.audit)
    }
    if (url.endsWith('/auth/v1/admin/users') && method === 'POST') {
      const b = JSON.parse(String(init?.body)) as { email: string }
      if (Object.values(f.users).some((u) => u.email === b.email)) return json({ error_code: 'email_exists' }, 422)
      const id = '66666666-6666-4666-8666-666666666666'
      f.users[`tok_${b.email}`] = { id, email: b.email }
      return json({ id, email: b.email })
    }
    if (url.includes('/auth/v1/admin/generate_link')) return json({ action_link: 'https://x.supabase.co/auth/v1/verify?token=abc&type=magiclink' })
    if (url.startsWith('https://api.resend.com/emails')) {
      f.mails = [...(f.mails ?? []), JSON.parse(String(init?.body))]
      return f.resendOk === false ? json({}, 500) : json({ id: 'm1' })
    }
    if (url.includes('/auth/v1/otp')) return f.otpOk === false ? json({}, 429) : json({})
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
  // Los tests del panel parten sin verificación en dos pasos; la de abajo la prueba a propósito.
  vi.stubEnv('ADMIN_REQUIRE_MFA', '0')
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
    audit: [],
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

describe('alta de cuentas por quien administra', () => {
  const NEW_ID = '66666666-6666-4666-8666-666666666666'
  const add = (email: unknown, notify = false, token = 'tok_admin') => handleAdmin(req(token, { action: 'add', email, notify }))

  it('crea la cuenta ya activa y la persona entra sin esperar aprobación', async () => {
    const res = await add('Nueva@Empresa.test')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, created: true })
    expect(fake.perfiles[NEW_ID].estado).toBe('activo')
    expect((await runEndpoint('coach', req('tok_nueva@empresa.test', coachBody), 'k')).status).toBe(200)
  })

  it('si ya tenía cuenta (pendiente o desactivada), la deja activa sin duplicarla', async () => {
    fake.perfiles['33333333-3333-4333-8333-333333333333'] = { estado: 'pendiente', last_seen_at: null }
    const res = await add('nuevo@x.test')
    expect(res.body).toMatchObject({ ok: true, created: false })
    expect(fake.perfiles['33333333-3333-4333-8333-333333333333'].estado).toBe('activo')
    expect(fake.calls.filter((c) => c.startsWith('POST /auth/v1/admin/users')).length).toBe(0)
  })

  it('si Supabase tiene la cuenta pero no tiene perfil, lo dice claro en vez de fallar mudo', async () => {
    const res = await add('nuevo@x.test') // existe en auth, sin perfil
    expect(res.status).toBe(409)
  })

  it('con aviso manda el enlace; si el mail falla, el alta igual queda hecha', async () => {
    expect((await add('uno@x.test', true)).body).toMatchObject({ created: true, notified: true })
    resetAuthCache()
    fake.otpOk = false
    expect((await add('dos@x.test', true)).body).toMatchObject({ ok: true, notified: false })
  })

  it('con envío propio (Resend) manda el mail con el diseño de Bivio y no el de Supabase', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('REMINDER_FROM', 'Bivio <hola@bivio.test>')
    const res = await add('marca@x.test', true)
    expect(res.body).toMatchObject({ created: true, notified: true })
    expect(fake.mails).toHaveLength(1)
    expect(fake.mails![0].to).toBe('marca@x.test')
    expect(fake.mails![0].html).toContain('https://x.supabase.co/auth/v1/verify?token=abc')
    expect(fake.mails![0].html).toContain('#f28c38')
    expect(fake.calls.some((c) => c.includes('/auth/v1/otp'))).toBe(false)
  })

  it('si el envío propio falla, vuelve al mail de Supabase', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('REMINDER_FROM', 'Bivio <hola@bivio.test>')
    fake.resendOk = false
    expect((await add('cae@x.test', true)).body).toMatchObject({ created: true, notified: true })
    expect(fake.calls.some((c) => c.includes('/auth/v1/otp'))).toBe(true)
  })

  it('sin aviso no manda ningún mail', async () => {
    await add('tres@x.test', false)
    expect(fake.calls.some((c) => c.includes('/auth/v1/otp'))).toBe(false)
  })

  it('rechaza emails inválidos y solo lo hace el administrador', async () => {
    expect((await add('no-es-un-email')).status).toBe(400)
    expect((await add('a'.repeat(260) + '@x.test')).status).toBe(400)
    expect((await add(123 as unknown)).status).toBe(400)
    expect((await add('otro@x.test', false, 'tok_activo')).status).toBe(404)
  })
})

describe('verificación en dos pasos del administrador', () => {
  const jwt = (aal: string) => `h.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.s`

  beforeEach(() => {
    vi.stubEnv('ADMIN_REQUIRE_MFA', '')
    for (const aal of ['aal1', 'aal2']) fake.users[jwt(aal)] = { id: USER_ID, email: 'admin@bivio.test' }
  })

  it('con la sesión sin verificar, el panel pide el segundo paso y no hace nada', async () => {
    const res = await handleAdmin(req(jwt('aal1'), { action: 'list' }))
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ reason: 'mfa_required' })
    const add = await handleAdmin(req(jwt('aal1'), { action: 'add', email: 'x@y.test' }))
    expect(add.status).toBe(403)
    expect(fake.calls.some((c) => c.includes('/auth/v1/admin/users') && c.startsWith('POST'))).toBe(false)
  })

  it('con el segundo paso verificado (aal2), el panel funciona', async () => {
    expect((await handleAdmin(req(jwt('aal2'), { action: 'list' }))).status).toBe(200)
  })

  it('quien no administra sigue viendo un 404, sin enterarse de que existe la verificación', async () => {
    expect((await handleAdmin(req('tok_activo', { action: 'list' }))).status).toBe(404)
  })

  it('un token que dice aal2 pero Supabase no reconoce no sirve', async () => {
    expect((await handleAdmin(req(jwt('aal2') + 'x', { action: 'list' }))).status).toBe(404)
  })
})

describe('registro de actividad del panel', () => {
  const NEW = '33333333-3333-4333-8333-333333333333'

  it('anota quién hizo qué sobre quién', async () => {
    await runEndpoint('coach', req('tok_nuevo', coachBody), 'k') // crea el perfil pendiente
    await handleAdmin(req('tok_admin', { action: 'setEstado', id: NEW, estado: 'activo' }))
    await handleAdmin(req('tok_admin', { action: 'setEstado', id: NEW, estado: 'desactivado' }))
    await handleAdmin(req('tok_admin', { action: 'add', email: 'nueva@x.test', notify: false }))
    await handleAdmin(req('tok_admin', { action: 'delete', id: NEW }))
    expect(fake.audit.map((a) => a.action).reverse()).toEqual(['activar', 'desactivar', 'alta', 'eliminar'])
    expect(fake.audit[0]).toMatchObject({ actor_email: 'Admin@Bivio.test', target_email: 'nuevo@x.test' })
  })

  it('el panel muestra lo registrado', async () => {
    await handleAdmin(req('tok_admin', { action: 'add', email: 'a@x.test' }))
    const res = await handleAdmin(req('tok_admin', { action: 'audit' }))
    expect((res.body as { entries: unknown[] }).entries.length).toBe(1)
  })

  it('si no se puede registrar, la acción igual se hace (y queda en los logs)', async () => {
    fake.auditFail = true
    const res = await handleAdmin(req('tok_admin', { action: 'add', email: 'b@x.test' }))
    expect(res.status).toBe(200)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('verificación en dos pasos opcional para cualquier cuenta', () => {
  const MFA_ID = '77777777-7777-4777-8777-777777777777'
  const jwt = (aal: string) => `h.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.s`

  beforeEach(() => {
    fake.users[jwt('aal1')] = { id: MFA_ID, email: 'con-mfa@x.test', mfa: true }
    fake.users[jwt('aal2')] = { id: MFA_ID, email: 'con-mfa@x.test', mfa: true }
    fake.perfiles[MFA_ID] = { estado: 'activo', last_seen_at: new Date().toISOString() }
  })

  it('quien la activó no usa el coach hasta pasar el código (sesión aal1)', async () => {
    const res = await runEndpoint('coach', req(jwt('aal1'), coachBody), 'k')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ reason: 'mfa_requerido' })
    expect(gemini.generateContent).not.toHaveBeenCalled()
    const acc = await runEndpoint('access', req(jwt('aal1')), undefined)
    expect(acc.body).toMatchObject({ ok: false, reason: 'mfa_requerido' })
  })

  it('con el código verificado (aal2) entra normalmente', async () => {
    expect((await runEndpoint('coach', req(jwt('aal2'), coachBody), 'k')).status).toBe(200)
  })

  it('quien no la activó no se entera: entra como siempre', async () => {
    expect((await runEndpoint('coach', req('tok_activo', coachBody), 'k')).status).toBe(200)
  })
})

describe('áreas habilitadas por cuenta (profesionales y empresas)', () => {
  const ANA = '22222222-2222-4222-8222-222222222222' // tok_activo, activa
  const analyzeBody = { contexto: { rol: 'x', seniority: 'y', tiempo: 'z', casoTipo: 'rendimiento' }, respuestas: {} }

  it('por defecto una cuenta activa usa las dos partes', async () => {
    expect((await runEndpoint('coach', req('tok_activo', coachBody), 'k')).status).toBe(200)
    const acc = await runEndpoint('access', req('tok_activo'), undefined)
    expect(acc.body).toMatchObject({ ok: true, areas: { profesionales: true, empresas: true } })
  })

  it('sin "Para profesionales" no usa el coach, pero sí Empresas', async () => {
    fake.perfiles[ANA].acceso_profesionales = false
    const res = await runEndpoint('coach', req('tok_activo', coachBody), 'k')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ reason: 'sin_area' })
    expect(gemini.generateContent).not.toHaveBeenCalled()
    const empresas = await runEndpoint('analyze', req('tok_activo', analyzeBody), 'k')
    expect(empresas.status).not.toBe(403)
    expect((await runEndpoint('access', req('tok_activo'), undefined)).body).toMatchObject({ areas: { profesionales: false, empresas: true } })
  })

  it('sin "Para empresas" no usa el análisis, pero sí el coach', async () => {
    fake.perfiles[ANA].acceso_empresas = false
    const res = await runEndpoint('analyze', req('tok_activo', analyzeBody), 'k')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ reason: 'sin_area' })
    expect((await runEndpoint('coach', req('tok_activo', coachBody), 'k')).status).toBe(200)
  })

  it('quien administra usa todo aunque su perfil diga otra cosa', async () => {
    fake.perfiles[USER_ID] = { estado: 'activo', last_seen_at: null, acceso_profesionales: false, acceso_empresas: false }
    expect((await runEndpoint('coach', req('tok_admin', coachBody), 'k')).status).toBe(200)
    expect((await runEndpoint('access', req('tok_admin'), undefined)).body).toMatchObject({ areas: { profesionales: true, empresas: true } })
  })

  it('el panel enciende y apaga cada parte por separado y lo registra', async () => {
    expect((await handleAdmin(req('tok_admin', { action: 'setAreas', id: ANA, empresas: false }))).status).toBe(200)
    expect(fake.perfiles[ANA]).toMatchObject({ acceso_empresas: false })
    expect(fake.perfiles[ANA].acceso_profesionales).toBeUndefined() // no se tocó la otra
    expect((await runEndpoint('analyze', req('tok_activo', analyzeBody), 'k')).status).toBe(403)
    await handleAdmin(req('tok_admin', { action: 'setAreas', id: ANA, empresas: true, profesionales: false }))
    expect((await runEndpoint('coach', req('tok_activo', coachBody), 'k')).status).toBe(403)
    expect(fake.audit.filter((a) => a.action === 'areas')).toHaveLength(2)
  })

  it('valida lo que recibe el panel y no deja cambiar las propias áreas', async () => {
    expect((await handleAdmin(req('tok_admin', { action: 'setAreas', id: ANA }))).status).toBe(400)
    expect((await handleAdmin(req('tok_admin', { action: 'setAreas', id: ANA, empresas: 'si' }))).status).toBe(400)
    expect((await handleAdmin(req('tok_admin', { action: 'setAreas', id: USER_ID, empresas: false }))).status).toBe(400)
    expect((await handleAdmin(req('tok_activo', { action: 'setAreas', id: ANA, empresas: false }))).status).toBe(404)
  })

  it('al dar de alta se eligen las partes; si no se indican, las dos', async () => {
    await handleAdmin(req('tok_admin', { action: 'add', email: 'solo-empresas@x.test', profesionales: false, empresas: true }))
    const NEW_ID = '66666666-6666-4666-8666-666666666666'
    expect(fake.perfiles[NEW_ID]).toMatchObject({ acceso_profesionales: false, acceso_empresas: true })
  })

  it('volver a dar de alta a alguien no le devuelve las partes que se le habían quitado', async () => {
    fake.perfiles[ANA].acceso_empresas = false
    await handleAdmin(req('tok_admin', { action: 'add', email: 'ana@x.test' }))
    expect(fake.perfiles[ANA].acceso_empresas).toBe(false)
  })
})
