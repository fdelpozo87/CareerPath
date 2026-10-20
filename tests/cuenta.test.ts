import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAccount } from '../server/account'
import { resetRateLimits } from '../server/guard'
import { buildReminderMail, runReminders } from '../server/reminders'
import type { DueReminder } from '../server/cloud'
import { en, es } from '../shared/locales/dictionaries'

const reminder = (over: Partial<DueReminder> = {}): DueReminder => ({
  id: 'r1',
  user_id: 'u1',
  due_at: '2026-11-01T12:00:00Z',
  lang: 'es',
  bivio_informes: {
    path: 'quiebre',
    informe: {
      objetivoSesion: 'x',
      acciones: [{ texto: 'Pedir una charla a mi jefa' }, { texto: 'Anotar avances <b>cada viernes</b>' }, { texto: 'No elegida' }],
      checkIn: 'Cada viernes, 15 minutos.',
    },
    compromisos: [0, 1],
  },
  ...over,
})

function req(opts: { method?: string; origin?: string | null; auth?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { host: 'careerpath.test', 'x-forwarded-for': '10.9.9.9' }
  if (opts.origin !== null) headers.origin = opts.origin ?? 'https://careerpath.test'
  if (opts.auth) headers.authorization = opts.auth
  return { method: opts.method ?? 'POST', headers, body: opts.body, socket: {} } as unknown as Parameters<typeof handleAccount>[0]
}

beforeEach(() => {
  resetRateLimits()
  vi.stubEnv('VERCEL', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('recordatorio de check-in por email', () => {
  it('lista solo los compromisos asumidos y el check-in, sin la conversación', () => {
    const mail = buildReminderMail(reminder(), 'https://app.example')
    expect(mail.subject).toBe(es['mail.reminder.subject'])
    expect(mail.text).toContain('- Pedir una charla a mi jefa')
    expect(mail.text).toContain('- Anotar avances <b>cada viernes</b>')
    expect(mail.text).not.toContain('No elegida')
    expect(mail.text).toContain('Cada viernes, 15 minutos.')
    expect(mail.text).toContain('https://app.example')
  })

  it('escapa el HTML de lo que escribió la persona', () => {
    const mail = buildReminderMail(reminder(), 'https://app.example')
    expect(mail.html).toContain('Anotar avances &lt;b&gt;cada viernes&lt;/b&gt;')
    expect(mail.html).not.toContain('<b>cada viernes</b>')
  })

  it('sale en el idioma que la persona tenía al pedirlo', () => {
    const mail = buildReminderMail(reminder({ lang: 'en' }), 'https://app.example')
    expect(mail.subject).toBe(en['mail.reminder.subject'])
  })

  it('sin compromisos igual invita a retomar el proceso', () => {
    const r = reminder()
    r.bivio_informes.compromisos = []
    expect(buildReminderMail(r, 'https://app.example').text).toContain(es['mail.reminder.introNone'])
  })

  it('no hace nada sin Supabase o sin proveedor de email', async () => {
    expect(await runReminders(new Date(), null)).toEqual({ due: 0, sent: 0, skipped: 'sin_supabase' })
    vi.stubEnv('RESEND_API_KEY', '')
    const env = { url: 'https://x.supabase.co', serviceKey: 'k' }
    expect(await runReminders(new Date(), env)).toEqual({ due: 0, sent: 0, skipped: 'sin_proveedor_de_email' })
  })
})

describe('/api/account', () => {
  it('solo acepta POST desde un origen permitido', async () => {
    expect((await handleAccount(req({ method: 'GET' }))).status).toBe(405)
    expect((await handleAccount(req({ origin: 'https://otro.example' }))).status).toBe(403)
  })

  it('sin Supabase configurado responde 503', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect((await handleAccount(req({ auth: 'Bearer t', body: { action: 'delete' } }))).status).toBe(503)
  })

  it('exige el token de la persona y la acción de borrar', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k')
    expect((await handleAccount(req({ body: { action: 'delete' } }))).status).toBe(400)
    expect((await handleAccount(req({ auth: 'Bearer t', body: { action: 'otra' } }))).status).toBe(400)
  })

  it('un token que Supabase no reconoce no borra nada', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k')
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      return new Response('{}', { status: 401 })
    })
    const res = await handleAccount(req({ auth: 'Bearer falso', body: { action: 'delete' } }))
    expect(res.status).toBe(401)
    expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false)
    vi.unstubAllGlobals()
  })
})
