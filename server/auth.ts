import type { IncomingMessage } from 'node:http'
import { cloudEnv, ensurePerfil, setEstado, touchSeen, verifyUser, type CloudEnv, type CloudUser, type Estado } from './cloud.js'

// Acceso por cuenta: reemplaza al código de invitación cuando Supabase está configurado.
//
//   - Cada persona entra con su email (enlace por correo) y queda "pendiente" hasta que la apruebe
//     quien administra. Solo las cuentas "activas" pueden usar el coach (y gastar la cuota de Gemini).
//   - Administra quien tenga el email de ADMIN_EMAIL (confirmado): siempre está activo y ve el panel.
//   - REQUIRE_LOGIN=0 apaga este modo (por ejemplo, para desarrollo local sin tener que entrar).
//
// El estado se cachea unos segundos por token: desactivar a alguien surte efecto en menos de un minuto.

const CACHE_TTL_MS = 30_000
const CACHE_MAX = 500

export type Denied = 'sin_sesion' | 'pendiente' | 'desactivado' | 'no_disponible'

export type Gate =
  | { ok: true; user: CloudUser; estado: Estado; isAdmin: boolean }
  | { ok: false; reason: Denied; user?: CloudUser; isAdmin?: false }

/** ¿Se usa el acceso por cuenta? Con Supabase configurado, sí (salvo REQUIRE_LOGIN=0). */
export function accountsMode(): boolean {
  return cloudEnv() !== null && process.env.REQUIRE_LOGIN !== '0'
}

export function isAdminEmail(email: string): boolean {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return Boolean(admin) && email.trim().toLowerCase() === admin
}

export function bearerToken(req: IncomingMessage): string {
  const h = req.headers.authorization
  const value = Array.isArray(h) ? h[0] : h
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

const cache = new Map<string, { until: number; gate: Gate }>()
export function resetAuthCache() {
  cache.clear()
}

async function resolve(env: CloudEnv, token: string, now: number): Promise<Gate> {
  const user = await verifyUser(env, token)
  if (!user || !user.confirmed) return { ok: false, reason: 'sin_sesion' }
  const perfil = await ensurePerfil(env, user)
  const isAdmin = isAdminEmail(user.email)
  // Quien administra no puede quedar afuera: se lo deja activo aunque su perfil diga otra cosa.
  if (isAdmin && perfil.estado !== 'activo') await setEstado(env, user.id, 'activo')
  const estado: Estado = isAdmin ? 'activo' : perfil.estado
  if (estado === 'pendiente') return { ok: false, reason: 'pendiente', user }
  if (estado === 'desactivado') return { ok: false, reason: 'desactivado', user }
  // Último acceso: se anota como mucho una vez por minuto.
  const seen = perfil.last_seen_at ? Date.parse(perfil.last_seen_at) : 0
  if (now - seen > 60_000) void touchSeen(env, user.id, new Date(now)).catch(() => {})
  return { ok: true, user, estado, isAdmin }
}

/** Quién es y si puede usar el servicio, según el token de sesión del pedido. */
export async function authorize(req: IncomingMessage, now = Date.now()): Promise<Gate> {
  const env = cloudEnv()
  if (!env) return { ok: false, reason: 'no_disponible' }
  const token = bearerToken(req)
  if (!token) return { ok: false, reason: 'sin_sesion' }
  const hit = cache.get(token)
  if (hit && hit.until > now) return hit.gate
  try {
    const gate = await resolve(env, token, now)
    if (cache.size >= CACHE_MAX) cache.clear()
    cache.set(token, { until: now + CACHE_TTL_MS, gate })
    return gate
  } catch {
    // Si no se puede verificar, se falla cerrado: sin poder confirmar quién es, no se usa la cuota.
    return { ok: false, reason: 'no_disponible' }
  }
}
