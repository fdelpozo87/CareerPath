import type { IncomingMessage } from 'node:http'
import { translate, type Lang } from '../shared/i18n.js'
import { adminMfaRequired, authorize, resetAuthCache } from './auth.js'
import { ESTADOS, cloudEnv, createUser, listComentarios, setComentarioLeido, deleteUser, ensurePerfil, findPerfilByEmail, getPerfil, listAudit, listPerfiles, logAudit, setAreas, setEstado, type AuditAction, type Estado } from './cloud.js'
import { RATE_RULES, clientIp, ipTag, isAllowedOrigin, logEvent, requestLang } from './guard.js'
import { durableLimit } from './limits.js'
import { notifyAccess, notifyActivated } from './accessMail.js'

// POST /api/admin — panel de administración de cuentas. Solo lo usa quien tenga el email de ADMIN_EMAIL
// (verificado en el servidor con su token de sesión: el navegador no decide quién es administrador).
//   { action: 'list' }                         → usuarios, más recientes primero
//   { action: 'setEstado', id, estado }        → activar, desactivar o dejar pendiente a alguien
//   { action: 'setAreas', id, profesionales?, empresas? } → habilitar o no "Para profesionales" y "Para empresas"
//   { action: 'delete', id }                   → eliminar su cuenta y todo lo suyo
//   { action: 'audit' }                        → últimas acciones de administración
//   { action: 'add', email, notify }           → dar de alta un email ya aprobado (y, si se pide, mandarle el enlace)

type Req = IncomingMessage & { body?: unknown }

export interface AdminResult {
  status: number
  body: unknown
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/
const AUDIT_BY_ESTADO: Record<Estado, AuditAction> = { activo: 'activar', desactivado: 'desactivar', pendiente: 'pendiente' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleAdmin(req: Req): Promise<AdminResult> {
  const lang: Lang = requestLang(req)
  const msg = (k: Parameters<typeof translate>[1]) => translate(lang, k)
  if (req.method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }
  if (!isAllowedOrigin(req)) return { status: 403, body: { error: msg('srv.origin') } }
  if (!(await durableLimit(`admin:${ipTag(clientIp(req))}`, RATE_RULES.admin)).ok) return { status: 429, body: { error: msg('srv.rate') } }

  const env = cloudEnv()
  if (!env) return { status: 503, body: { error: msg('srv.cloudOff') } }
  const gate = await authorize(req)
  // Para quien no es administrador el panel simplemente no existe.
  if (!gate.ok || !gate.isAdmin) return { status: 404, body: { error: 'Not found' } }
  // Verificación en dos pasos: sin ella la sesión no puede tocar nada (el cliente muestra cómo activarla).
  if (adminMfaRequired() && gate.aal !== 'aal2') return { status: 403, body: { error: msg('srv.mfaRequired'), reason: 'mfa_required' } }
  const actor = gate.user.email
  // El registro no frena la acción si falla, pero queda en los logs del servidor.
  const audit = async (action: AuditAction, target: string, detail?: Record<string, unknown>) => {
    const ok = await logAudit(env, { actor_email: actor, action, target_email: target, detail }).catch(() => false)
    if (!ok) logEvent('error', 'auditoria_no_registrada', { action })
  }

  const body = (req.body ?? {}) as { action?: unknown; id?: unknown; estado?: unknown; email?: unknown; notify?: unknown; profesionales?: unknown; empresas?: unknown }
  try {
    if (body.action === 'list') {
      const users = await listPerfiles(env)
      return { status: 200, body: { users: users.map((u) => ({ ...u, isSelf: u.user_id === gate.user.id })) } }
    }
    if (body.action === 'comentarios') {
      return { status: 200, body: { entries: await listComentarios(env, 50).catch(() => []) } }
    }
    if (body.action === 'audit') {
      return { status: 200, body: { entries: await listAudit(env, 50).catch(() => []) } }
    }
    if (body.action === 'add') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (email.length > 254 || !EMAIL.test(email)) return { status: 400, body: { error: msg('srv.badEmail') } }
      const areas = { profesionales: body.profesionales !== false, empresas: body.empresas !== false }
      const existing = await findPerfilByEmail(env, email)
      let created = false
      if (existing) {
        // Ya tenía cuenta (por ejemplo, pendiente o desactivada): se la deja activa.
        if (!(await setEstado(env, existing.user_id, 'activo'))) return { status: 502, body: { error: msg('srv.upstream') } }
        // A quien ya tenía cuenta solo se le cambian las áreas que se indicaron explícitamente.
        const explicit = { profesionales: typeof body.profesionales === 'boolean' ? body.profesionales : undefined, empresas: typeof body.empresas === 'boolean' ? body.empresas : undefined }
        if (!(await setAreas(env, existing.user_id, explicit))) return { status: 502, body: { error: msg('srv.upstream') } }
      } else {
        const made = await createUser(env, email)
        // Cuenta de Supabase sin perfil (no debería pasar: la migración crea el perfil de las existentes).
        if (!made.ok) return made.reason === 'ya_existe' ? { status: 409, body: { error: msg('srv.addExists') } } : { status: 502, body: { error: msg('srv.upstream') } }
        // El alta crea su perfil pendiente (trigger); el administrador la deja activa de una vez.
        await ensurePerfil(env, { id: made.id, email, confirmed: true })
        if (!(await setEstado(env, made.id, 'activo')) || !(await setAreas(env, made.id, areas))) return { status: 502, body: { error: msg('srv.upstream') } }
        created = true
      }
      resetAuthCache()
      await audit('alta', email, { creada: created, avisoPedido: body.notify === true, ...areas })
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
      const notified = body.notify === true && origin ? await notifyAccess(env, email, origin, lang).catch(() => false) : false
      logEvent('info', 'admin_alta', { created, notified })
      return { status: 200, body: { ok: true, created, notified } }
    }
    const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
    if (!id) return { status: 400, body: { error: msg('srv.badPayload') } }
    // Quien administra no puede apagarse ni borrarse a sí mismo: quedaría sin panel.
    if (id === gate.user.id) return { status: 400, body: { error: msg('srv.adminSelf') } }

    if (body.action === 'comentarioLeido') {
      if (typeof (body as { leido?: unknown }).leido !== 'boolean') return { status: 400, body: { error: msg('srv.badPayload') } }
      const ok = await setComentarioLeido(env, id, (body as { leido: boolean }).leido)
      return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
    }
    if (body.action === 'setAreas') {
      if (typeof body.profesionales !== 'boolean' && typeof body.empresas !== 'boolean') return { status: 400, body: { error: msg('srv.badPayload') } }
      const areas = { profesionales: typeof body.profesionales === 'boolean' ? body.profesionales : undefined, empresas: typeof body.empresas === 'boolean' ? body.empresas : undefined }
      const target = await getPerfil(env, id)
      const ok = await setAreas(env, id, areas)
      resetAuthCache()
      if (ok) await audit('areas', target?.email ?? id, { ...areas, antes: { profesionales: target?.acceso_profesionales, empresas: target?.acceso_empresas } })
      logEvent(ok ? 'info' : 'error', 'admin_areas', { ok })
      return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
    }
    if (body.action === 'setEstado') {
      if (typeof body.estado !== 'string' || !ESTADOS.includes(body.estado as Estado)) return { status: 400, body: { error: msg('srv.badPayload') } }
      const target = await getPerfil(env, id)
      const ok = await setEstado(env, id, body.estado as Estado)
      resetAuthCache()
      if (ok) await audit(AUDIT_BY_ESTADO[body.estado as Estado], target?.email ?? id, { antes: target?.estado })
      // Al aprobar una cuenta que estaba pendiente, la persona se entera (si hay envío de mails configurado).
      if (ok && body.estado === 'activo' && target?.estado === 'pendiente') void notifyActivated(target.email).catch(() => false)
      logEvent(ok ? 'info' : 'error', 'admin_estado', { ok, estado: body.estado })
      return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
    }
    if (body.action === 'delete') {
      const target = await getPerfil(env, id)
      const ok = await deleteUser(env, id)
      resetAuthCache()
      if (ok) await audit('eliminar', target?.email ?? id, { estadoAnterior: target?.estado })
      logEvent(ok ? 'info' : 'error', 'admin_borrar', { ok })
      return ok ? { status: 200, body: { ok: true } } : { status: 502, body: { error: msg('srv.upstream') } }
    }
    return { status: 400, body: { error: msg('srv.badPayload') } }
  } catch (e) {
    logEvent('error', 'admin_error', { error: e instanceof Error ? e : String(e) })
    return { status: 502, body: { error: msg('srv.upstream') } }
  }
}
