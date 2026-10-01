import type { IncomingMessage } from 'node:http'
import { accessState } from './access.js'
import { coachMode, handleCoachRequest } from './coach.js'
import { runCompanyAnalysis, validateCompany } from './company.js'
import { RATE_RULES, clientIp, ipTag, isAllowedOrigin, logEvent, publicError, rateLimit, type RateRule } from './guard.js'

// Capa HTTP única para /api/coach y /api/analyze. La usan las funciones de
// Vercel (api/*.ts) y el middleware de desarrollo (vite.config.ts), así local
// y producción ejecutan exactamente el mismo código.

export type EndpointName = 'coach' | 'analyze' | 'access'

export interface EndpointResult {
  status: number
  body: unknown
  headers?: Record<string, string>
}

type Req = IncomingMessage & { body?: unknown }

function ruleFor(endpoint: 'coach' | 'analyze', body: unknown): { name: string; rule: RateRule } {
  if (endpoint === 'analyze') return { name: 'documentos', rule: RATE_RULES.documentos }
  const mode = coachMode(body)
  return mode === 'extraer' || mode === 'perfil'
    ? { name: 'documentos', rule: RATE_RULES.documentos }
    : { name: 'conversacion', rule: RATE_RULES.conversacion }
}

async function dispatch(endpoint: 'coach' | 'analyze', body: unknown, apiKey: string | undefined): Promise<EndpointResult> {
  if (endpoint === 'coach') return handleCoachRequest(body, apiKey)

  const req = validateCompany(body)
  if (!req) return { status: 400, body: { error: 'Payload inválido' } }
  if (!apiKey) return { status: 200, body: { demo: true } }
  try {
    return { status: 200, body: { data: await runCompanyAnalysis(apiKey, req) } }
  } catch (e) {
    const pub = publicError(e)
    logEvent('error', 'analyze_upstream_error', { error: e instanceof Error ? e : String(e) })
    return { status: pub.status, body: { error: pub.message } }
  }
}

export async function runEndpoint(endpoint: EndpointName, req: Req, apiKey: string | undefined): Promise<EndpointResult> {
  const started = Date.now()
  const ip = clientIp(req)
  const tag = ipTag(ip)
  const finish = (result: EndpointResult, extra: Record<string, unknown> = {}) => {
    logEvent(result.status >= 500 ? 'error' : result.status >= 400 ? 'warn' : 'info', 'api_request', {
      endpoint,
      mode: coachMode(req.body),
      status: result.status,
      ms: Date.now() - started,
      ip: tag,
      ...extra,
    })
    return result
  }

  if (req.method !== 'POST') return finish({ status: 405, body: { error: 'Method not allowed' }, headers: { Allow: 'POST' } })
  if (!isAllowedOrigin(req)) return finish({ status: 403, body: { error: 'Origen no permitido' } })

  const access = accessState()
  const tooManyFails = () => rateLimit(`acceso:${ip}`, RATE_RULES.intentosFallidos, Date.now(), false)
  const lockedOut = (retryAfterS: number) =>
    finish(
      {
        status: 429,
        body: { error: 'Demasiados intentos con un código incorrecto. Esperá unos minutos y probá de nuevo.' },
        headers: { 'Retry-After': String(retryAfterS) },
      },
      { rule: 'intentosFallidos' },
    )
  const unconfigured = () => {
    logEvent('error', 'access_unconfigured', { hint: 'Falta ACCESS_CODES en el entorno de Vercel' })
    return finish({ status: 503, body: { error: 'El acceso de prueba todavía no está configurado.' } })
  }

  // /api/access: el cliente pregunta si hace falta código y si el suyo sirve.
  if (endpoint === 'access') {
    if (access.mode === 'open') return finish({ status: 200, body: { required: false, ok: true } })
    if (access.mode === 'unconfigured') return unconfigured()
    const code = (req.body as { code?: unknown } | undefined)?.code
    if (code === undefined || code === '') return finish({ status: 200, body: { required: true, ok: false } })
    if (typeof code !== 'string') return finish({ status: 400, body: { error: 'Payload inválido' } })
    const lim = tooManyFails()
    if (!lim.ok) return lockedOut(lim.retryAfterS)
    const label = access.check(code)
    if (!label) {
      rateLimit(`acceso:${ip}`, RATE_RULES.intentosFallidos) // suma el fallo
      return finish({ status: 401, body: { error: 'Ese código no es válido. Revisalo e intentá de nuevo.' } })
    }
    return finish({ status: 200, body: { required: true, ok: true } }, { who: label })
  }

  // /api/coach y /api/analyze: el código viaja en un header en cada pedido.
  let who: string | undefined
  if (access.mode === 'unconfigured') return unconfigured()
  if (access.mode === 'gated') {
    const lim = tooManyFails()
    if (!lim.ok) return lockedOut(lim.retryAfterS)
    const header = req.headers['x-access-code']
    who = access.check(Array.isArray(header) ? header[0] : header) ?? undefined
    if (!who) {
      rateLimit(`acceso:${ip}`, RATE_RULES.intentosFallidos)
      return finish({ status: 401, body: { error: 'Tu acceso no es válido o venció. Ingresá tu código de nuevo.' } })
    }
    const perCode = rateLimit(`codigo:${who}`, RATE_RULES.porCodigo)
    if (!perCode.ok) {
      return finish(
        {
          status: 429,
          body: { error: 'Tu código alcanzó el límite de uso de hoy. Probá de nuevo mañana.' },
          headers: { 'Retry-After': String(perCode.retryAfterS) },
        },
        { rule: 'porCodigo', who },
      )
    }
  }

  const { name, rule } = ruleFor(endpoint, req.body)
  for (const [ruleName, r] of [[name, rule], ['horario', RATE_RULES.horario]] as const) {
    const rl = rateLimit(`${ruleName}:${ip}`, r)
    if (!rl.ok) {
      return finish(
        {
          status: 429,
          body: { error: 'Hiciste muchas consultas seguidas. Esperá un momento y volvé a intentar.' },
          headers: { 'Retry-After': String(rl.retryAfterS) },
        },
        { rule: ruleName, who },
      )
    }
  }

  try {
    return finish(await dispatch(endpoint, req.body, apiKey), { who })
  } catch (e) {
    logEvent('error', 'api_unhandled', { endpoint, error: e instanceof Error ? e : String(e) })
    return finish({ status: 500, body: { error: 'Algo falló de nuestro lado. Intentá de nuevo.' } }, { who })
  }
}
