import type { IncomingMessage } from 'node:http'
import { translate, type Lang } from '../shared/i18n.js'
import { authorize, resetAuthCache } from './auth.js'
import { ESTADOS, cloudEnv, deleteUser, listPerfiles, setEstado, type Estado } from './cloud.js'
import { RATE_RULES, clientIp, isAllowedOrigin, logEvent, rateLimit, requestLang } from './guard.js'

// POST /api/admin — panel de administración de cuentas. Solo lo usa quien tenga el email de ADMIN_EMAIL
// (verificado en el servidor con su token de sesión: el navegador no decide quién es administrador).
//   { action: 'list' }                         → usuarios, más recientes primero
//   { action: 'setEstado', id, estado }        → activar, desactivar o dejar pendiente a alguien
//   { action: 'delete', id }                   → eliminar su cuenta y todo lo suyo

type Req = IncomingMessage & { body?: unknown }

export interface AdminResult {
  status: number
  body: unknown
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleAdmin(req: Req): Promise<AdminResult> {
  const lang: Lang = requestLang(req)
  const msg = (k: Parameters<typeof translate>[1]) => translate(lang, k)
  if (req.method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }
  if (!isAllowedOrigin(req)) return { status: 403, body: { error: msg('srv.origin') } }
  if (!rateLimit(`admin:${clientIp(req)}`, RATE_RULES.admin).ok) return { status: 429, body: { error: msg('srv.rate') } }

  const env = cloudEnv()
  if (!env) return { status: 503, body: { error: msg('srv.cloudOff') } }
  const gate = await authorize(req)
  // Para quien no es administrador el panel simplemente no existe.
  if (!gate.ok || !gate.isAdmin) return { status: 404, body: { error: 'Not found' } }

  const body = (req.body ?? {}) as { action?: unknown; id?: unknown; estado?: unknown }
  try {
    if (body.action === 'list') {
      const users = await listPerfiles(env)
      return { status: 200, body: { users: users.map((u) => ({ ...u, isSelf: u.user_id === gate.user.id })) } }
    }
    const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
    if (!id) return { status: 400, body: { error: msg('srv.badPayload') } }
    // Quien administra no puede apagarse ni borrarse a sí mismo: quedaría sin panel.
    if (id === gate.user.id) return { status: 400, body: { error: msg('srv.adminSelf') } }

    if (body.action === 'setEstado') {
      if (typeof body.estado !== 'string' || !ESTADOS.includes(body.estado as Estado)) return { status: 400, body: { error: msg('srv.badPayload') } }
      const ok = await setEstado(env, id, body.estado as Estado)
      resetAuthCache()
      logEvent(ok ? 'info' : 'error', 'admin_estado', { ok, estado: body.estado })
      return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
    }
    if (body.action === 'delete') {
      const ok = await deleteUser(env, id)
      resetAuthCache()
      logEvent(ok ? 'info' : 'error', 'admin_borrar', { ok })
      return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
    }
    return { status: 400, body: { error: msg('srv.badPayload') } }
  } catch (e) {
    logEvent('error', 'admin_error', { error: e instanceof Error ? e : String(e) })
    return { status: 502, body: { error: msg('srv.upstream') } }
  }
}
