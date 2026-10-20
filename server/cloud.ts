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

async function call(env: CloudEnv, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.url}${path}`, { ...init, headers: { ...headers(env), ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(15_000) })
}

export interface CloudUser {
  id: string
  email: string
}

/** Quién es la persona que presenta este token de sesión (null si no es válido). */
export async function verifyUser(env: CloudEnv, token: string): Promise<CloudUser | null> {
  const res = await fetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const u = (await res.json()) as { id?: string; email?: string }
  return u.id ? { id: u.id, email: u.email ?? '' } : null
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
