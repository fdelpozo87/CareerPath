// Acceso del servidor a Supabase (cuenta opcional de la persona). Usa la service role, que se salta
// la seguridad por filas: por eso vive solo acá y nunca viaja al navegador. Sin dependencias: habla
// con la API REST de Supabase directamente.

export interface CloudEnv {
  url: string
  serviceKey: string
}

export function cloudEnv(): CloudEnv | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && serviceKey ? { url, serviceKey } : null
}

const headers = (env: CloudEnv, extra: Record<string, string> = {}) => ({
  apikey: env.serviceKey,
  Authorization: `Bearer ${env.serviceKey}`,
  'Content-Type': 'application/json',
  ...extra,
})

/** Pedido genérico a la API de Supabase con la service role (para módulos que arman sus propias consultas). */
export const rest = (env: CloudEnv, path: string, init: RequestInit = {}): Promise<Response> => call(env, path, init)

async function call(env: CloudEnv, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.url}${path}`, { ...init, headers: { ...headers(env), ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(15_000) })
}

export interface CloudUser {
  id: string
  email: string
  /** El email se confirmó (entró con el enlace que se le mandó). */
  confirmed: boolean
  /** Activó la verificación en dos pasos (tiene un factor TOTP verificado). */
  mfa?: boolean
}

/** Quién es la persona que presenta este token de sesión (null si no es válido). */
export async function verifyUser(env: CloudEnv, token: string): Promise<CloudUser | null> {
  const res = await fetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const u = (await res.json()) as { id?: string; email?: string; email_confirmed_at?: string | null; factors?: { status?: string; factor_type?: string }[] | null }
  const mfa = (u.factors ?? []).some((f) => f.status === 'verified')
  return u.id ? { id: u.id, email: u.email ?? '', confirmed: Boolean(u.email_confirmed_at), mfa } : null
}

/** Borra la cuenta; los informes y recordatorios se van en cascada. */
export async function deleteUser(env: CloudEnv, id: string): Promise<boolean> {
  const res = await call(env, `/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return res.ok
}

export interface DueReminder {
  id: string
  user_id: string
  due_at: string
  lang: 'es' | 'en'
  bivio_informes: { path: string; informe: { objetivoSesion?: string; acciones?: { texto: string }[]; checkIn?: string }; compromisos: number[] }
}

export async function dueReminders(env: CloudEnv, now: Date, limit = 50): Promise<DueReminder[]> {
  const q = new URLSearchParams({
    select: 'id,user_id,due_at,lang,bivio_informes(path,informe,compromisos)',
    sent_at: 'is.null',
    due_at: `lte.${now.toISOString()}`,
    order: 'due_at.asc',
    limit: String(limit),
  })
  const res = await call(env, `/rest/v1/bivio_recordatorios?${q}`)
  if (!res.ok) throw new Error(`recordatorios ${res.status}`)
  return (await res.json()) as DueReminder[]
}

export async function emailOf(env: CloudEnv, userId: string): Promise<string | null> {
  const res = await call(env, `/auth/v1/admin/users/${encodeURIComponent(userId)}`)
  if (!res.ok) return null
  return ((await res.json()) as { email?: string }).email ?? null
}

export async function markReminderSent(env: CloudEnv, id: string, at: Date): Promise<void> {
  await call(env, `/rest/v1/bivio_recordatorios?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ sent_at: at.toISOString() }),
  })
}

// ── Perfiles: quién puede usar el servicio ────────────────────────────────────

export type Estado = 'pendiente' | 'activo' | 'desactivado'
export const ESTADOS: Estado[] = ['pendiente', 'activo', 'desactivado']

export interface Perfil {
  user_id: string
  email: string
  estado: Estado
  created_at: string
  last_seen_at: string | null
  /** Puede usar "Para profesionales" (el coach). */
  acceso_profesionales: boolean
  /** Puede usar "Para empresas". */
  acceso_empresas: boolean
}

const PERFIL_COLS = 'user_id,email,estado,created_at,last_seen_at,acceso_profesionales,acceso_empresas'

export async function getPerfil(env: CloudEnv, userId: string): Promise<Perfil | null> {
  const res = await call(env, `/rest/v1/bivio_perfiles?select=${PERFIL_COLS}&user_id=eq.${encodeURIComponent(userId)}&limit=1`)
  if (!res.ok) throw new Error(`perfil ${res.status}`)
  return ((await res.json()) as Perfil[])[0] ?? null
}

/** Devuelve el perfil; si todavía no existe (usuario anterior a la tabla), lo crea como pendiente. */
export async function ensurePerfil(env: CloudEnv, user: CloudUser): Promise<Perfil> {
  const found = await getPerfil(env, user.id)
  if (found) return found
  const res = await call(env, `/rest/v1/bivio_perfiles?on_conflict=user_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: user.id, email: user.email }),
  })
  if (!res.ok) throw new Error(`perfil_crear ${res.status}`)
  const created = await getPerfil(env, user.id)
  if (!created) throw new Error('perfil_crear')
  return created
}

export async function setEstado(env: CloudEnv, userId: string, estado: Estado): Promise<boolean> {
  const res = await call(env, `/rest/v1/bivio_perfiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ estado }),
  })
  return res.ok
}

export async function setAreas(env: CloudEnv, userId: string, areas: { profesionales?: boolean; empresas?: boolean }): Promise<boolean> {
  const patch: Record<string, boolean> = {}
  if (typeof areas.profesionales === 'boolean') patch.acceso_profesionales = areas.profesionales
  if (typeof areas.empresas === 'boolean') patch.acceso_empresas = areas.empresas
  if (Object.keys(patch).length === 0) return true
  const res = await call(env, `/rest/v1/bivio_perfiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
  return res.ok
}

export async function touchSeen(env: CloudEnv, userId: string, at: Date): Promise<void> {
  await call(env, `/rest/v1/bivio_perfiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_seen_at: at.toISOString() }),
  })
}

// ── Auditoría de lo que hace quien administra ─────────────────────────────────

export type AuditAction = 'alta' | 'activar' | 'desactivar' | 'pendiente' | 'eliminar' | 'areas'

export interface AuditEntry {
  id: number
  at: string
  actor_email: string
  action: AuditAction
  target_email: string
  detail: Record<string, unknown> | null
}

export async function logAudit(env: CloudEnv, entry: { actor_email: string; action: AuditAction; target_email: string; detail?: Record<string, unknown> }): Promise<boolean> {
  const res = await call(env, '/rest/v1/bivio_auditoria', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(entry) })
  return res.ok
}

export async function listAudit(env: CloudEnv, limit = 50): Promise<AuditEntry[]> {
  const res = await call(env, `/rest/v1/bivio_auditoria?select=id,at,actor_email,action,target_email,detail&order=at.desc&limit=${limit}`)
  if (!res.ok) throw new Error(`auditoria ${res.status}`)
  return (await res.json()) as AuditEntry[]
}

export async function listPerfiles(env: CloudEnv): Promise<Perfil[]> {
  const res = await call(env, `/rest/v1/bivio_perfiles?select=${PERFIL_COLS}&order=created_at.desc&limit=500`)
  if (!res.ok) throw new Error(`perfiles ${res.status}`)
  return (await res.json()) as Perfil[]
}

// ── Altas hechas por quien administra ─────────────────────────────────────────

export type CreateUserResult = { ok: true; id: string } | { ok: false; reason: 'ya_existe' | 'error' }

/** Crea la cuenta con el email ya confirmado (la persona entra después con un enlace o con su contraseña). */
export async function createUser(env: CloudEnv, email: string): Promise<CreateUserResult> {
  const res = await call(env, '/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, email_confirm: true }) })
  if (res.ok) {
    const u = (await res.json()) as { id?: string }
    return u.id ? { ok: true, id: u.id } : { ok: false, reason: 'error' }
  }
  const err = (await res.json().catch(() => ({}))) as { error_code?: string }
  return { ok: false, reason: err.error_code === 'email_exists' ? 'ya_existe' : 'error' }
}

export async function findPerfilByEmail(env: CloudEnv, email: string): Promise<Perfil | null> {
  const res = await call(env, `/rest/v1/bivio_perfiles?select=${PERFIL_COLS}&email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`)
  if (!res.ok) throw new Error(`perfil_email ${res.status}`)
  return ((await res.json()) as Perfil[])[0] ?? null
}

/** Le manda a la persona su enlace de acceso (el mismo mail que pediría ella al entrar). */
export async function sendAccessLink(env: CloudEnv, email: string, redirectTo: string): Promise<boolean> {
  const res = await call(env, `/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    body: JSON.stringify({ email, create_user: false }),
  })
  return res.ok
}

/** Genera el enlace de ingreso sin mandar ningún mail (para enviarlo con el diseño de Bivio). */
export async function generateLink(env: CloudEnv, email: string, redirectTo: string): Promise<string | null> {
  const res = await call(env, '/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email, redirect_to: redirectTo }),
  })
  if (!res.ok) return null
  const body = (await res.json().catch(() => ({}))) as { action_link?: string }
  return typeof body.action_link === 'string' && body.action_link.startsWith('https://') ? body.action_link : null
}
