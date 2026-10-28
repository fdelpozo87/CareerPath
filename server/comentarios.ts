import type { IncomingMessage } from 'node:http'
import { translate, type Lang } from '../shared/i18n.js'
import { adminEmails } from './admins.js'
import { authorize } from './auth.js'
import { cloudEnv, insertComentario, TIPOS_COMENTARIO, type ComentarioTipo } from './cloud.js'
import { RATE_RULES, clientIp, ipTag, isAllowedOrigin, logEvent, requestLang } from './guard.js'
import { durableLimit } from './limits.js'
import { brandedMail, mailerConfigured, sendMail } from './mailer.js'

// POST /api/comentarios — una persona con cuenta activa le manda un comentario a quien administra (un problema, una
// idea, otro). Se guarda en la base y, si hay envío de mails, se avisa a quien administra. Lo lee el panel.

type Req = IncomingMessage & { body?: unknown }

export interface ComentariosResult {
  status: number
  body: unknown
}

const MIN = 5
const MAX = 2000

export async function handleComentarios(req: Req): Promise<ComentariosResult> {
  const lang: Lang = requestLang(req)
  const msg = (k: Parameters<typeof translate>[1]) => translate(lang, k)
  if (req.method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }
  if (!isAllowedOrigin(req)) return { status: 403, body: { error: msg('srv.origin') } }
  if (!(await durableLimit(`comentarios:${ipTag(clientIp(req))}`, RATE_RULES.comentarios)).ok) return { status: 429, body: { error: msg('srv.rate') } }

  const env = cloudEnv()
  if (!env) return { status: 503, body: { error: msg('srv.cloudOff') } }
  const gate = await authorize(req)
  if (!gate.ok) return { status: 401, body: { error: msg('srv.accessLost') } }
  if (!(await durableLimit(`comentarios-u:${gate.user.id}`, RATE_RULES.comentariosPorCuenta)).ok) return { status: 429, body: { error: msg('srv.rate') } }

  const body = (req.body ?? {}) as { tipo?: unknown; mensaje?: unknown; pagina?: unknown }
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  if (!TIPOS_COMENTARIO.includes(body.tipo as ComentarioTipo) || mensaje.length < MIN || mensaje.length > MAX) return { status: 400, body: { error: msg('srv.badPayload') } }
  const pagina = typeof body.pagina === 'string' && /^[\w#/.-]{1,120}$/.test(body.pagina) ? body.pagina : null

  const tipo = body.tipo as ComentarioTipo
  const ok = await insertComentario(env, { user_id: gate.user.id, email: gate.user.email, tipo, mensaje, pagina, lang }).catch(() => false)
  logEvent(ok ? 'info' : 'error', 'comentario', { ok, tipo })
  if (!ok) return { status: 502, body: { error: msg('srv.upstream') } }

  // Aviso a quien administra: sin envío de mails configurado, el comentario igual queda en el panel.
  if (mailerConfigured()) {
    const mail = brandedMail(translate('es', 'mail.comment.subject', { tipo: translate('es', `comment.tipo.${tipo}` as Parameters<typeof translate>[1]), email: gate.user.email }), {
      heading: translate('es', 'mail.comment.heading'),
      paragraphs: [translate('es', 'mail.comment.from', { email: gate.user.email }), mensaje.length > 600 ? `${mensaje.slice(0, 600)}…` : mensaje],
      footer: translate('es', 'mail.comment.footer'),
    })
    await Promise.all(adminEmails().map((to) => sendMail(to, mail))).catch(() => [])
  }
  return { status: 200, body: { ok: true } }
}
