import { translate, type Lang } from '../shared/i18n.js'
import { cloudEnv, dueReminders, emailOf, markReminderSent, type CloudEnv, type DueReminder } from './cloud.js'
import { logEvent } from './guard.js'

// Recordatorio de check-in: un email, una sola vez, a quien lo pidió al guardar sus compromisos.
// Lo dispara un cron de Vercel (api/reminders.ts). Si falta RESEND_API_KEY no se manda nada.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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
  const items = chosen.length > 0 ? chosen : []

  const text = [
    t('mail.reminder.hello'),
    '',
    items.length > 0 ? t('mail.reminder.intro') : t('mail.reminder.introNone'),
    ...items.map((x) => `- ${x}`),
    ...(checkIn ? ['', t('mail.reminder.checkin', { text: checkIn })] : []),
    '',
    t('mail.reminder.cta', { url: appUrl }),
    '',
    t('mail.reminder.footer'),
  ].join('\n')

  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f1533;line-height:1.5">
<p>${esc(t('mail.reminder.hello'))}</p>
<p>${esc(items.length > 0 ? t('mail.reminder.intro') : t('mail.reminder.introNone'))}</p>
${items.length > 0 ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
${checkIn ? `<p>${esc(t('mail.reminder.checkin', { text: checkIn }))}</p>` : ''}
<p><a href="${esc(appUrl)}" style="color:#6a3fc1">${esc(t('mail.reminder.link'))}</a></p>
<p style="font-size:12px;color:#5e566d">${esc(t('mail.reminder.footer'))}</p>
</div>`

  return { subject: t('mail.reminder.subject'), html, text }
}

async function sendEmail(to: string, mail: ReminderMail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM
  if (!key || !from) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: mail.subject, html: mail.html, text: mail.text }),
    signal: AbortSignal.timeout(15_000),
  })
  return res.ok
}

export interface RemindersResult {
  due: number
  sent: number
  skipped: string | null
}

/** Manda los recordatorios vencidos. `env` y `now` se pueden inyectar en tests. */
export async function runReminders(now = new Date(), env: CloudEnv | null = cloudEnv(), appUrl = process.env.APP_URL ?? 'https://career-path-ruby.vercel.app'): Promise<RemindersResult> {
  if (!env) return { due: 0, sent: 0, skipped: 'sin_supabase' }
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM) return { due: 0, sent: 0, skipped: 'sin_proveedor_de_email' }
  const due = await dueReminders(env, now)
  let sent = 0
  for (const r of due) {
    try {
      const to = await emailOf(env, r.user_id)
      if (!to) continue
      if (await sendEmail(to, buildReminderMail(r, appUrl))) {
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
