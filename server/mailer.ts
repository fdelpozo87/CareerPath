// Envío de emails (Resend). Si faltan RESEND_API_KEY o REMINDER_FROM no se manda nada y quien llama lo sabe:
// las funciones de la app tienen que seguir funcionando sin email (la notificación también aparece dentro de Bivio).

import { renderEmailHtml, renderEmailText, type EmailContent } from '../shared/emailLayout.js'

export interface Mail {
  subject: string
  html: string
  text: string
}

export { esc } from '../shared/emailLayout.js'

/** Un email con el diseño de la marca (ver shared/emailLayout.ts). */
export function brandedMail(subject: string, content: EmailContent, assetsUrl = appUrl()): Mail {
  return { subject, html: renderEmailHtml([content], assetsUrl), text: renderEmailText([content]) }
}

/** Un email con varios bloques (por ejemplo, español e inglés): el primero lleva el botón grande. */
export function brandedMailMulti(subject: string, contents: EmailContent[], assetsUrl = appUrl()): Mail {
  return { subject, html: renderEmailHtml(contents, assetsUrl), text: renderEmailText(contents) }
}

export const appUrl = (): string => process.env.APP_URL ?? 'https://career-path-ruby.vercel.app'

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM)
}

export async function sendMail(to: string, mail: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM
  if (!key || !from) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(15_000),
    })
    return res.ok
  } catch {
    return false
  }
}
