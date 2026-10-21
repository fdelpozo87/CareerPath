import { authHeader } from './cloud'
import { getLang, tr } from './i18n'

// Cliente del panel de administración (/api/admin). El servidor decide quién es administrador.

export type Estado = 'pendiente' | 'activo' | 'desactivado'

export interface AdminUser {
  user_id: string
  email: string
  estado: Estado
  created_at: string
  last_seen_at: string | null
  isSelf: boolean
}

/** Error del panel; `reason` distingue, por ejemplo, que falta la verificación en dos pasos. */
export class AdminError extends Error {
  reason?: string
  constructor(message: string, reason?: string) {
    super(message)
    this.reason = reason
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lang': getLang(), ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; reason?: string }
  if (!res.ok) throw new AdminError(json.error ?? tr('flow.err.generic'), json.reason)
  return json
}

export const listUsers = async (): Promise<AdminUser[]> => (await call<{ users: AdminUser[] }>({ action: 'list' })).users
export const setUserEstado = (id: string, estado: Estado) => call<{ ok: true }>({ action: 'setEstado', id, estado })
export interface AuditEntry {
  id: number
  at: string
  actor_email: string
  action: 'alta' | 'activar' | 'desactivar' | 'pendiente' | 'eliminar'
  target_email: string
}
export const listAudit = async (): Promise<AuditEntry[]> => (await call<{ entries: AuditEntry[] }>({ action: 'audit' })).entries
export const addUser = (email: string, notify: boolean) => call<{ ok: true; created: boolean; notified: boolean }>({ action: 'add', email, notify })
export const deleteUserAccount = (id: string) => call<{ ok: true }>({ action: 'delete', id })
