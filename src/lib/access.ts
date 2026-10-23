// Código de acceso de prueba (ver server/access.ts). Se guarda en el navegador
// para no pedirlo en cada visita y se manda como header en cada pedido a /api.

import { authHeader } from './cloud'
import { getLang, tr } from './i18n'

const KEY = 'cp_access'
const LABEL_KEY = 'cp_access_label'

/** Se dispara cuando el servidor rechaza el código guardado (revocado o inválido). */
export const ACCESS_LOST_EVENT = 'cp:access-lost'

export function getAccessCode(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function getAccessLabel(): string | null {
  try {
    return localStorage.getItem(LABEL_KEY)
  } catch {
    return null
  }
}

export function saveAccessCode(code: string, label?: string) {
  try {
    localStorage.setItem(KEY, code)
    if (label) localStorage.setItem(LABEL_KEY, label)
  } catch {
    // Sin storage: el código se pedirá de nuevo en la próxima visita.
  }
}

export function clearAccessCode() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LABEL_KEY)
  } catch {
    // ignorado
  }
}

export interface AccessStatus {
  /** El servidor exige código (en local, sin ACCESS_CODES, no). */
  required: boolean
  ok: boolean
  /** Apodo de quien presentó un código válido (para saludarle en el menú). */
  label?: string
  /** Mensaje para mostrar cuando el código no sirvió o el acceso no está configurado. */
  error?: string
  /** 'accounts': el acceso es por cuenta (email), no por código. */
  mode?: 'accounts'
  /** En modo cuentas, por qué no se puede usar todavía. */
  reason?: 'sin_sesion' | 'pendiente' | 'desactivado' | 'no_disponible' | 'mfa_requerido'
  /** Quien tiene la sesión es administrador (ve el panel de usuarios). */
  isAdmin?: boolean
}

export async function checkAccess(code?: string): Promise<AccessStatus> {
  const res = await fetch('/api/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lang': getLang(), ...(await authHeader()) },
    body: JSON.stringify(code ? { code } : {}),
  })
  const json = (await res.json().catch(() => ({}))) as {
    required?: boolean
    ok?: boolean
    label?: string
    error?: string
    mode?: 'accounts'
    reason?: AccessStatus['reason']
    isAdmin?: boolean
  }
  if (res.ok) return { required: Boolean(json.required), ok: Boolean(json.ok), label: json.label, mode: json.mode, reason: json.reason, isAdmin: json.isAdmin }
  // 401 (código inválido), 429 (demasiados intentos) o 503 (sin configurar).
  return { required: true, ok: false, error: json.error ?? tr('net.verify') }
}
