import type { IncomingMessage } from 'node:http'
import { translate, type Lang } from '../shared/i18n.js'
import { cloudEnv, deleteUser, verifyUser } from './cloud.js'
import { RATE_RULES, clientIp, ipTag, isAllowedOrigin, logEvent, requestLang } from './guard.js'
import { durableLimit } from './limits.js'

// POST /api/account — borra la cuenta de quien lo pide (con su propio token de sesión). Sus informes
// y recordatorios se borran en cascada. No pasa por el código de acceso: es la persona sobre lo suyo.

type Req = IncomingMessage & { body?: unknown }

export interface AccountResult {
  status: number
  body: unknown
}

export async function handleAccount(req: Req): Promise<AccountResult> {
  const lang: Lang = requestLang(req)
  const msg = (k: Parameters<typeof translate>[1]) => translate(lang, k)
  if (req.method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }
  if (!isAllowedOrigin(req)) return { status: 403, body: { error: msg('srv.origin') } }
  if (!(await durableLimit(`cuenta:${ipTag(clientIp(req))}`, RATE_RULES.cuenta)).ok) return { status: 429, body: { error: msg('srv.rate') } }

  const env = cloudEnv()
  if (!env) return { status: 503, body: { error: msg('srv.cloudOff') } }
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  const action = (req.body as { action?: unknown } | undefined)?.action
  if (!token || action !== 'delete') return { status: 400, body: { error: msg('srv.badPayload') } }

  const user = await verifyUser(env, token).catch(() => null)
  if (!user) return { status: 401, body: { error: msg('srv.accessLost') } }
  const ok = await deleteUser(env, user.id).catch(() => false)
  logEvent(ok ? 'info' : 'error', 'cuenta_borrada', { ok, ip: ipTag(clientIp(req)) })
  return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
}
