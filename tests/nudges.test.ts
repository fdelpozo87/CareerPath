import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNudgeMail, runNudges, type IdleSession } from '../server/nudges'

// Aviso de sesión a medias: solo a quien lo activó, una vez por persona y pasada, y sin tirar abajo el cron si falta la migración.

const ENV = { url: 'https://x.supabase.co', serviceKey: 'k' }
const NOW = new Date('2026-11-01T12:00:00Z')
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

const row = (user_id: string, process_id: string, extra: Partial<IdleSession> = {}): IdleSession => ({ user_id, process_id, path: 'quiebre', lang: 'es', stage: 'discovery', ...extra })

interface Fake {
  idle: IdleSession[]
  mails: { to: string; subject: string; html: string }[]
  marked: string[]
  calls: string[]
  sinTabla?: boolean
  resendOk?: boolean
}
let f: Fake

function stub() {
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    f.calls.push(`${method} ${url.replace('https://x.supabase.co', '')}`)
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (url.includes('/rest/v1/bivio_sesiones') && method === 'GET') return f.sinTabla ? json({ code: '42703' }, 400) : json(f.idle)
    if (url.includes('/rest/v1/bivio_sesiones') && method === 'PATCH') {
      f.marked.push(/process_id=eq\.([^&]+)/.exec(url)![1])
      return new Response(null, { status: 204 })
    }
    if (url.includes('/auth/v1/admin/users/')) {
      const id = url.split('/').pop()
      return json({ id, email: id === U1 ? 'ana@x.test' : 'beto@x.test' })
    }
    if (url.startsWith('https://api.resend.com/emails')) {
      f.mails.push(JSON.parse(String(init?.body)))
      return f.resendOk === false ? json({}, 500) : json({ id: 'm' })
    }
    return json({}, 404)
  })
}

beforeEach(() => {
  f = { idle: [], mails: [], marked: [], calls: [] }
  stub()
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('REMINDER_FROM', 'Bivio <hola@bivio.test>')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildNudgeMail', () => {
  it('dice en qué etapa quedó y en qué idioma corresponde', () => {
    const es = buildNudgeMail(row(U1, 'p1'), 'https://app.test')
    expect(es.text).toContain('Camino A')
    expect(es.text).toContain('Exploración')
    expect(es.html).toContain('https://app.test')
    expect(buildNudgeMail(row(U1, 'p1', { lang: 'en' }), 'https://app.test').text).toContain('Path A')
  })
})

describe('runNudges', () => {
  it('le avisa a quien dejó una sesión a medias y la marca para no repetir', async () => {
    f.idle = [row(U1, 'p1')]
    expect(await runNudges(NOW, ENV, 'https://app.test')).toEqual({ idle: 1, sent: 1, skipped: null })
    expect(f.mails.map((m) => m.to)).toEqual(['ana@x.test'])
    expect(f.marked).toEqual(['p1'])
  })

  it('consulta solo sesiones con aviso activado, sin avisar antes y frenadas hace tres días o más', async () => {
    await runNudges(NOW, ENV)
    const q = decodeURIComponent(f.calls.find((c) => c.startsWith('GET /rest/v1/bivio_sesiones'))!)
    expect(q).toContain('avisar=is.true')
    expect(q).toContain('nudged_at=is.null')
    expect(q).toContain('data->>phase=eq.chat')
    expect(q).toContain('session_updated_at=lt.2026-10-29T12:00:00.000Z')
  })

  it('una persona con dos sesiones frenadas recibe un solo mail y las dos quedan marcadas', async () => {
    f.idle = [row(U1, 'p1'), row(U1, 'p2'), row(U2, 'p3')]
    const r = await runNudges(NOW, ENV)
    expect(r.sent).toBe(2)
    expect(f.mails.map((m) => m.to).sort()).toEqual(['ana@x.test', 'beto@x.test'])
    expect(f.marked.sort()).toEqual(['p1', 'p2', 'p3'])
  })

  it('si el mail falla no se marca: se reintenta en la próxima pasada', async () => {
    f.idle = [row(U1, 'p1')]
    f.resendOk = false
    const r = await runNudges(NOW, ENV)
    expect(r.sent).toBe(0)
    expect(f.marked).toEqual([])
  })

  it('sin envío de mails no hace nada', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    f.idle = [row(U1, 'p1')]
    expect(await runNudges(NOW, ENV)).toEqual({ idle: 0, sent: 0, skipped: 'sin_proveedor_de_email' })
    expect(f.calls).toHaveLength(0)
  })

  it('si falta la migración no falla: lo informa y sigue', async () => {
    f.sinTabla = true
    expect(await runNudges(NOW, ENV)).toEqual({ idle: 0, sent: 0, skipped: 'sin_migracion' })
  })

  it('sin Supabase configurado no hace nada', async () => {
    expect((await runNudges(NOW, null)).skipped).toBe('sin_supabase')
  })
})
