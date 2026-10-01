import type { IncomingMessage } from 'node:http'

// Protecciones compartidas por los endpoints de IA: límite de peticiones,
// verificación de origen, errores públicos saneados y logs sin datos sensibles.

// ── Rate limit ────────────────────────────────────────────────────────────
// Ventana deslizante en memoria. En Vercel cada instancia tiene su propia
// memoria, así que es una primera barrera (frena ráfagas de un mismo cliente),
// no un límite global. Para un límite global: regla de rate limit en el
// Vercel Firewall o @upstash/ratelimit (ver docs/SEGURIDAD.md).

export interface RateRule {
  limit: number
  windowMs: number
}

export const RATE_RULES = {
  /** Turnos de chat e informe. */
  conversacion: { limit: 20, windowMs: 60_000 },
  /** Lectura de PDF y lectura de perfil: más caras. */
  documentos: { limit: 10, windowMs: 60 * 60_000 },
  /** Tope horario total por IP. */
  horario: { limit: 150, windowMs: 60 * 60_000 },
  /** Tope diario por código de acceso: acota lo que puede gastar cada persona de prueba. */
  porCodigo: { limit: 400, windowMs: 24 * 60 * 60_000 },
  /** Intentos fallidos de código por IP: frena la adivinanza. */
  intentosFallidos: { limit: 10, windowMs: 10 * 60_000 },
} satisfies Record<string, RateRule>

const hits = new Map<string, number[]>()
const MAX_KEYS = 10_000

/** `consume: false` solo consulta (sin sumar un intento): sirve para contar solo los fallos. */
export function rateLimit(key: string, rule: RateRule, now = Date.now(), consume = true): { ok: boolean; retryAfterS: number } {
  const since = now - rule.windowMs
  const recent = (hits.get(key) ?? []).filter((t) => t > since)
  if (recent.length >= rule.limit) {
    hits.set(key, recent)
    return { ok: false, retryAfterS: Math.ceil((recent[0] + rule.windowMs - now) / 1000) }
  }
  if (!consume) return { ok: true, retryAfterS: 0 }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > MAX_KEYS) {
    // Evita que el mapa crezca sin límite: descarta las claves más viejas.
    for (const k of Array.from(hits.keys()).slice(0, hits.size - MAX_KEYS)) hits.delete(k)
  }
  return { ok: true, retryAfterS: 0 }
}

/** Solo para tests. */
export function resetRateLimits() {
  hits.clear()
}

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for']
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
  const real = req.headers['x-real-ip']
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || 'unknown'
}

// ── Origen ────────────────────────────────────────────────────────────────
// Los navegadores siempre mandan Origin en un POST con fetch. Rechazamos
// pedidos de otros sitios (que usarían nuestra key desde su página). Un
// script por fuera del navegador puede falsear Origin: por eso además hay
// rate limit.
export function isAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const extra = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => {
      try {
        return new URL(o).host
      } catch {
        return o
      }
    })
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  return originHost === host || extra.includes(originHost)
}

// ── Errores y logs ────────────────────────────────────────────────────────

const SECRET_PATTERNS = [/AIza[0-9A-Za-z_-]{20,}/g, /key=[^&\s]+/gi, /Bearer\s+[^\s]+/gi]

export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((t, re) => t.replace(re, '[redactado]'), text)
}

/** Código HTTP de un error del SDK de Gemini, si lo trae ("[429 Too Many Requests]"). */
export function upstreamStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown })?.status
  if (typeof status === 'number') return status
  const m = err instanceof Error ? err.message.match(/\[(\d{3})[^\]]*\]/) : null
  return m ? Number(m[1]) : undefined
}

// Mensaje para la persona: nunca el error crudo (puede traer URLs internas,
// nombres de modelo o detalles del proveedor).
export function publicError(err: unknown): { status: number; message: string } {
  const up = upstreamStatus(err)
  if (up === 429) return { status: 503, message: 'El coach está con mucha demanda. Probá de nuevo en un minuto.' }
  if (up === 400 && err instanceof Error && /safety|blocked/i.test(err.message)) {
    return { status: 422, message: 'No pudimos procesar ese mensaje. ¿Lo podés reformular?' }
  }
  if (err instanceof SyntaxError || (err instanceof Error && err.message.startsWith('La IA no devolvió'))) {
    return { status: 502, message: 'La respuesta del coach llegó incompleta. Intentá de nuevo.' }
  }
  return { status: 502, message: 'No pudimos conectar con el coach. Intentá de nuevo en unos segundos.' }
}

// Log estructurado para los logs de Vercel. Nunca incluye el contenido de la
// conversación ni de los documentos: solo metadatos y el error redactado.
export function logEvent(level: 'info' | 'warn' | 'error', event: string, meta: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (v instanceof Error) safe[k] = { name: v.name, message: redact(v.message).slice(0, 300), status: upstreamStatus(v) }
    else if (typeof v === 'string') safe[k] = redact(v).slice(0, 200)
    else safe[k] = v
  }
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...safe })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

/** Hash corto y no reversible de la IP, para correlacionar logs sin guardarla. */
export function ipTag(ip: string): string {
  let h = 2166136261
  for (let i = 0; i < ip.length; i++) h = Math.imul(h ^ ip.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}
