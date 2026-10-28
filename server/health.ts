import { cloudEnv, rest } from './cloud.js'
import { mailerConfigured } from './mailer.js'

// GET /api/health — estado del servicio para el monitoreo externo (UptimeRobot, Better Stack, etc.). No devuelve
// secretos ni datos de nadie: solo si Supabase responde y qué piezas están configuradas. No llama al modelo (costaría).
// Responde 503 solo si Supabase está configurado y no responde, que es cuando la app realmente no sirve.

export interface HealthResult {
  status: number
  body: { ok: boolean; checks: Record<string, 'ok' | 'error' | 'configurado' | 'falta'>; at: string }
}

let cache: { until: number; result: HealthResult } | null = null
export function resetHealthCache() {
  cache = null
}

export async function handleHealth(now = Date.now()): Promise<HealthResult> {
  // Una consulta cada 20 segundos como mucho, aunque alguien insista: el endpoint es público.
  if (cache && cache.until > now) return cache.result
  const env = cloudEnv()
  let supabase: 'ok' | 'error' | 'falta' = 'falta'
  if (env) {
    try {
      const res = await rest(env, '/rest/v1/bivio_perfiles?select=user_id&limit=1', { signal: AbortSignal.timeout(5000) })
      supabase = res.ok ? 'ok' : 'error'
    } catch {
      supabase = 'error'
    }
  }
  const ok = supabase !== 'error'
  const result: HealthResult = {
    status: ok ? 200 : 503,
    body: {
      ok,
      checks: { supabase, gemini: process.env.GEMINI_API_KEY ? 'configurado' : 'falta', email: mailerConfigured() ? 'configurado' : 'falta' },
      at: new Date(now).toISOString(),
    },
  }
  cache = { until: now + 20_000, result }
  return result
}
