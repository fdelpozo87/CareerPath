import { cloudEnv } from './cloud.js'
import { RATE_RULES, logEvent, rateLimit, type RateRule } from './guard.js'

// Límite de uso con contador compartido (Supabase). Sirve para lo que no puede reiniciarse ni depender de qué
// instancia de Vercel atienda el pedido: el tope diario por persona (lo que cuida la cuota de Gemini) y los
// pedidos del panel y del borrado de cuenta. El tope en memoria sigue funcionando primero (barato, para
// ráfagas); el compartido corre solo si ese pasó. Si la base no responde, vale el de memoria: no se corta el
// servicio por una falla del contador.

export type Limit = { ok: boolean; retryAfterS: number }

export async function durableLimit(key: string, rule: RateRule, now = Date.now()): Promise<Limit> {
  const local = rateLimit(key, rule, now)
  if (!local.ok) return local
  const env = cloudEnv()
  if (!env) return local
  try {
    const res = await fetch(`${env.url}/rest/v1/rpc/bivio_limite`, {
      method: 'POST',
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: key, p_window_ms: rule.windowMs, p_limit: rule.limit }),
      signal: AbortSignal.timeout(4_000),
    })
    if (!res.ok) throw new Error(`limite ${res.status}`)
    const row = ((await res.json()) as { ok: boolean; retry_after_s: number }[])[0]
    if (!row) return local
    return { ok: Boolean(row.ok), retryAfterS: row.ok ? 0 : Math.max(1, Number(row.retry_after_s) || rule.windowMs / 1000) }
  } catch (e) {
    logEvent('warn', 'limite_compartido_no_disponible', { error: e instanceof Error ? e : String(e) })
    return local
  }
}

export { RATE_RULES }
