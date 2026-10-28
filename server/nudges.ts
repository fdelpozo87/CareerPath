import { translate, type Lang } from '../shared/i18n.js'
import { stageName, type Path, type Stage } from '../shared/stages.js'
import { cloudEnv, emailOf, rest, type CloudEnv } from './cloud.js'
import { logEvent } from './guard.js'
import { appUrl, brandedMail, mailerConfigured, sendMail, type Mail } from './mailer.js'

// Aviso por mail a quien dejó una sesión del coach a medias. Solo para quien lo activó (y tiene la sincronización de
// sesiones encendida: es lo que le permite al servidor saber en qué punto quedó). Lo dispara el mismo cron de los
// recordatorios (api/reminders.ts). Sin RESEND_API_KEY no se manda nada.

/** Días sin tocar la sesión antes de avisar. */
export const IDLE_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export interface IdleSession {
  user_id: string
  process_id: string
  path: Path
  lang: string
  stage: Stage | null
}

export function buildNudgeMail(s: IdleSession, url = appUrl()): Mail {
  const lang: Lang = s.lang === 'en' ? 'en' : 'es'
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  const where = s.stage ? stageName(s.stage, lang) : ''
  return brandedMail(t('mail.nudge.subject'), {
    heading: t('mail.nudge.subject'),
    paragraphs: [t('mail.nudge.intro', { path: t(`process.name.${s.path}` as Parameters<typeof translate>[1]), stage: where }), t('mail.nudge.hint')],
    cta: { label: t('mail.nudge.cta'), url },
    footer: t('mail.nudge.footer'),
  })
}

export async function idleSessions(env: CloudEnv, now: Date, limit = 50): Promise<IdleSession[]> {
  const cutoff = new Date(now.getTime() - IDLE_DAYS * DAY_MS).toISOString()
  const res = await rest(
    env,
    `/rest/v1/bivio_sesiones?select=user_id,process_id,path,lang,stage:data->>stage&avisar=is.true&nudged_at=is.null&data->>phase=eq.chat&session_updated_at=lt.${encodeURIComponent(cutoff)}&order=session_updated_at.asc&limit=${limit}`,
  )
  if (!res.ok) throw new Error(`sesiones_inactivas ${res.status}`)
  return (await res.json()) as IdleSession[]
}

async function markNudged(env: CloudEnv, s: IdleSession, at: Date) {
  await rest(env, `/rest/v1/bivio_sesiones?user_id=eq.${encodeURIComponent(s.user_id)}&process_id=eq.${encodeURIComponent(s.process_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ nudged_at: at.toISOString() }),
  })
}

export interface NudgesResult {
  idle: number
  sent: number
  skipped: string | null
}

/** Manda los avisos de sesiones frenadas. `env` y `now` se pueden inyectar en tests. */
export async function runNudges(now = new Date(), env: CloudEnv | null = cloudEnv(), url = appUrl()): Promise<NudgesResult> {
  if (!env) return { idle: 0, sent: 0, skipped: 'sin_supabase' }
  if (!mailerConfigured()) return { idle: 0, sent: 0, skipped: 'sin_proveedor_de_email' }
  let idle: IdleSession[]
  try {
    idle = await idleSessions(env, now)
  } catch (e) {
    // Lo más probable: falta correr la migración. No debe tirar abajo el resto del cron.
    logEvent('warn', 'avisos_sesion_no_disponibles', { error: e instanceof Error ? e : String(e) })
    return { idle: 0, sent: 0, skipped: 'sin_migracion' }
  }
  let sent = 0
  // Una persona con varias sesiones frenadas recibe un solo mail por pasada; las demás quedan marcadas igual.
  const mailed = new Set<string>()
  for (const s of idle) {
    try {
      if (!mailed.has(s.user_id)) {
        const to = await emailOf(env, s.user_id)
        if (to && (await sendMail(to, buildNudgeMail(s, url)))) {
          mailed.add(s.user_id)
          sent++
        } else continue
      }
      await markNudged(env, s, now)
    } catch (e) {
      logEvent('error', 'aviso_sesion_error', { error: e instanceof Error ? e : String(e) })
    }
  }
  logEvent('info', 'avisos_sesion', { idle: idle.length, sent })
  return { idle: idle.length, sent, skipped: null }
}
