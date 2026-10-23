import { translate, type Lang } from '../shared/i18n.js'
import { generateLink, sendAccessLink, type CloudEnv } from './cloud.js'
import { brandedMail, mailerConfigured, sendMail, type Mail } from './mailer.js'

/** Mail de acceso con el diseño de Bivio; si no hay envío propio (Resend), sale el mail de Supabase. */
export function buildAccessMail(link: string, lang: Lang, evaluacion?: { who: string; title: string }): Mail {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  return brandedMail(t('mail.access.subject'), {
    heading: t('mail.access.heading'),
    paragraphs: [t('mail.access.intro'), ...(evaluacion ? [t('mail.access.eval', evaluacion)] : [])],
    cta: { label: t('mail.access.cta'), url: link },
    note: t('mail.access.note', { url: link }),
    footer: t('mail.access.footer'),
  })
}

export async function notifyAccess(env: CloudEnv, email: string, origin: string, lang: Lang, evaluacion?: { who: string; title: string }): Promise<boolean> {
  if (mailerConfigured()) {
    const link = await generateLink(env, email, origin)
    if (link && (await sendMail(email, buildAccessMail(link, lang, evaluacion)))) return true
  }
  return sendAccessLink(env, email, origin)
}
