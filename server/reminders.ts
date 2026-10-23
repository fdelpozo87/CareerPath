import { translate, type Lang } from '../shared/i18n.js'
import { cloudEnv, dueReminders, emailOf, markReminderSent, type CloudEnv, type DueReminder } from './cloud.js'
import { logEvent } from './guard.js'
import { brandedMail, mailerConfigured, sendMail } from './mailer.js'

// Recordatorio de check-in: un email, una sola vez, a quien lo pidió al guardar sus compromisos.
// Lo dispara un cron de Vercel (api/reminders.ts). Si falta RESEND_API_KEY no se manda nada.

export interface ReminderMail {
  subject: string
  html: string
  text: string
}

/** Arma el mail con los compromisos que la persona asumió. Sin datos de la conversación. */
export function buildReminderMail(r: DueReminder, appUrl: string): ReminderMail {
  const lang: Lang = r.lang === 'en' ? 'en' : 'es'
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  const informe = r.bivio_informes.informe
  const chosen = (r.bivio_informes.compromisos ?? []).map((i) => informe.acciones?.[i]?.texto).filter((x): x is string => Boolean(x))
  const checkIn = informe.checkIn?.trim()
  return brandedMail(
    t('mail.reminder.subject'),
    {
      heading: t('mail.reminder.subject'),
      preheader: chosen.length > 0 ? t('mail.reminder.intro') : t('mail.reminder.introNone'),
      paragraphs: [t('mail.reminder.hello'), chosen.length > 0 ? t('mail.reminder.intro') : t('mail.reminder.introNone'), ...(checkIn ? [t('mail.reminder.checkin', { text: checkIn })] : [])],
      bullets: chosen,
      cta: { label: t('mail.reminder.link'), url: appUrl },
      footer: t('mail.reminder.footer'),
    },
    appUrl,
  )
}

export interface RemindersResult {
  due: number
  sent: number
  skipped: string | null
}

/** Manda los recordatorios vencidos. `env` y `now` se pueden inyectar en tests. */
export async function runReminders(now = new Date(), env: CloudEnv | null = cloudEnv(), appUrl = process.env.APP_URL ?? 'https://career-path-ruby.vercel.app'): Promise<RemindersResult> {
  if (!env) return { due: 0, sent: 0, skipped: 'sin_supabase' }
  if (!mailerConfigured()) return { due: 0, sent: 0, skipped: 'sin_proveedor_de_email' }
  const due = await dueReminders(env, now)
  let sent = 0
  for (const r of due) {
    try {
      const to = await emailOf(env, r.user_id)
      if (!to) continue
      if (await sendMail(to, buildReminderMail(r, appUrl))) {
        await markReminderSent(env, r.id, now)
        sent++
      } else {
        logEvent('warn', 'recordatorio_no_enviado', { id: r.id })
      }
    } catch (e) {
      logEvent('error', 'recordatorio_error', { id: r.id, error: e instanceof Error ? e : String(e) })
    }
  }
  logEvent('info', 'recordatorios', { due: due.length, sent })
  return { due: due.length, sent, skipped: null }
}
