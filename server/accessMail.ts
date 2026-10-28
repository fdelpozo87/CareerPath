import { translate, type Lang } from '../shared/i18n.js'
import { adminEmails } from './admins.js'
import { claimAdminNotice, generateLink, sendAccessLink, type CloudEnv } from './cloud.js'
import { logEvent } from './guard.js'
import { appUrl, brandedMail, brandedMailMulti, mailerConfigured, sendMail, type Mail } from './mailer.js'

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

/** "Tu cuenta está activa": cuando quien administra aprueba una cuenta pendiente. Español primero y, debajo, inglés. */
export function buildActivatedMail(url = appUrl()): Mail {
  const block = (lang: Lang) => ({
    heading: translate(lang, 'mail.activated.heading'),
    paragraphs: [translate(lang, 'mail.activated.intro')],
    cta: { label: translate(lang, 'mail.activated.cta'), url },
    footer: translate(lang, 'mail.activated.footer'),
  })
  return brandedMailMulti(`${translate('es', 'mail.activated.subject')} · ${translate('en', 'mail.activated.subject')}`, [block('es'), { ...block('en'), cta: undefined }])
}

/** Le avisa a la persona que su cuenta ya está activa. Sin envío propio (Resend) no se manda nada. */
export async function notifyActivated(email: string): Promise<boolean> {
  if (!mailerConfigured()) return false
  return sendMail(email, buildActivatedMail())
}

/** Aviso para quien administra: una cuenta nueva espera aprobación. */
export function buildNewAccountMail(email: string, url = `${appUrl()}/#admin`): Mail {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('es', k, v)
  return brandedMail(t('mail.newAccount.subject', { email }), {
    heading: t('mail.newAccount.heading'),
    paragraphs: [t('mail.newAccount.intro', { email }), t('mail.newAccount.hint')],
    cta: { label: t('mail.newAccount.cta'), url },
    footer: t('mail.newAccount.footer'),
  })
}

/**
 * Cuando una cuenta nueva queda pendiente, se le avisa por email a quien administra, una sola vez por cuenta. Solo se
 * "reclama" el aviso si hay envío configurado: si se configura después, las cuentas que sigan pendientes avisan en su
 * próximo ingreso.
 */
export async function notifyAdminsNewAccount(env: CloudEnv, userId: string, email: string): Promise<void> {
  const admins = adminEmails()
  if (admins.length === 0 || !mailerConfigured()) return
  if (!(await claimAdminNotice(env, userId))) return
  const mail = buildNewAccountMail(email)
  const sent = await Promise.all(admins.map((to) => sendMail(to, mail)))
  logEvent(sent.some(Boolean) ? 'info' : 'warn', 'aviso_cuenta_nueva', { enviados: sent.filter(Boolean).length })
}
