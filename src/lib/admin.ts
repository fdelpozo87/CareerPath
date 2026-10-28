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
  /** Puede usar "Para profesionales" y "Para empresas". */
  acceso_profesionales: boolean
  acceso_empresas: boolean
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
  action: 'alta' | 'activar' | 'desactivar' | 'pendiente' | 'eliminar' | 'areas'
  target_email: string
}
export const listAudit = async (): Promise<AuditEntry[]> => (await call<{ entries: AuditEntry[] }>({ action: 'audit' })).entries
export const addUser = (email: string, notify: boolean, areas: { profesionales: boolean; empresas: boolean }) =>
  call<{ ok: true; created: boolean; notified: boolean }>({ action: 'add', email, notify, ...areas })
export const setUserAreas = (id: string, areas: { profesionales?: boolean; empresas?: boolean }) => call<{ ok: true }>({ action: 'setAreas', id, ...areas })
export const deleteUserAccount = (id: string) => call<{ ok: true }>({ action: 'delete', id })

export interface ComentarioItem {
  id: string
  email: string
  tipo: 'problema' | 'idea' | 'otro'
  mensaje: string
  pagina: string | null
  leido: boolean
  created_at: string
}
export const listComentarios = async (): Promise<ComentarioItem[]> => (await call<{ entries: ComentarioItem[] }>({ action: 'comentarios' })).entries
export const marcarComentario = (id: string, leido: boolean) => call<{ ok: true }>({ action: 'comentarioLeido', id, leido })
