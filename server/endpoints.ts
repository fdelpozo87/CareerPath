import type { IncomingMessage } from 'node:http'
import { accessState } from './access.js'
import { accountsMode, authorize } from './auth.js'
import { durableLimit } from './limits.js'
import { coachMode, handleCoachRequest } from './coach.js'
import { runCompanyAnalysis, validateCompany } from './company.js'
import { translate, type Lang } from '../shared/i18n.js'
import { RATE_RULES, clientIp, ipTag, isAllowedOrigin, logEvent, publicError, rateLimit, requestLang, type RateRule } from './guard.js'

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

async function dispatch(endpoint: 'coach' | 'analyze', body: unknown, apiKey: string | undefined, lang: Lang): Promise<EndpointResult> {
  if (endpoint === 'coach') return handleCoachRequest(body, apiKey, lang)

  const req = validateCompany(body)
  if (!req) return { status: 400, body: { error: translate(lang, 'srv.badPayload') } }
  if (!apiKey) return { status: 200, body: { demo: true } }
  try {
    return { status: 200, body: { data: await runCompanyAnalysis(apiKey, req, req.lang ?? lang) } }
  } catch (e) {
    const pub = publicError(e, req.lang ?? lang)
    logEvent('error', 'analyze_upstream_error', { error: e instanceof Error ? e : String(e) })
    return { status: pub.status, body: { error: pub.message } }
  }
}

export async function runEndpoint(endpoint: EndpointName, req: Req, apiKey: string | undefined): Promise<EndpointResult> {
  const started = Date.now()
  const ip = clientIp(req)
  const lang = requestLang(req)
  const msg = (key: Parameters<typeof translate>[1]) => translate(lang, key)
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
  if (!isAllowedOrigin(req)) return finish({ status: 403, body: { error: msg('srv.origin') } })

  const access = accessState()

  // Acceso por cuenta (Supabase): reemplaza al código. Cada persona entra con su email y solo las
  // cuentas aprobadas usan el coach (ver server/auth.ts).
  let accountWho: string | undefined
  if (accountsMode()) {
    const gate = await authorize(req)
    if (endpoint === 'access') {
      return finish({
        status: 200,
        body: gate.ok
          ? { required: true, mode: 'accounts', ok: true, isAdmin: gate.isAdmin }
          : { required: true, mode: 'accounts', ok: false, reason: gate.reason },
      })
    }
    if (!gate.ok) {
      const denied = {
        sin_sesion: { status: 401, key: 'srv.accessLost' },
        pendiente: { status: 403, key: 'srv.pending' },
        desactivado: { status: 403, key: 'srv.disabled' },
        no_disponible: { status: 503, key: 'srv.authDown' },
        mfa_requerido: { status: 403, key: 'srv.mfaLogin' },
      } as const
      const d = denied[gate.reason]
      return finish({ status: d.status, body: { error: msg(d.key), reason: gate.reason } }, { rule: 'cuenta', reason: gate.reason })
    }
    accountWho = `u:${gate.user.id.slice(0, 8)}`
    // Tope diario por persona: lo que cuida la cuota de Gemini, así que usa el contador compartido.
    const perUser = await durableLimit(`usuario:${gate.user.id}`, RATE_RULES.porCodigo)
    if (!perUser.ok) {
      return finish({ status: 429, body: { error: msg('srv.dailyCap') }, headers: { 'Retry-After': String(perUser.retryAfterS) } }, { rule: 'porUsuario', who: accountWho })
    }
  }

  const tooManyFails = () => rateLimit(`acceso:${ip}`, RATE_RULES.intentosFallidos, Date.now(), false)
  const lockedOut = (retryAfterS: number) =>
    finish(
      {
        status: 429,
        body: { error: msg('srv.lockout') },
        headers: { 'Retry-After': String(retryAfterS) },
      },
      { rule: 'intentosFallidos' },
    )
  const unconfigured = () => {
    logEvent('error', 'access_unconfigured', { hint: 'Falta ACCESS_CODES en el entorno de Vercel' })
    return finish({ status: 503, body: { error: msg('srv.unconfigured') } })
  }

  // /api/access: el cliente pregunta si hace falta código y si el suyo sirve.
  if (endpoint === 'access') {
    if (access.mode === 'open') return finish({ status: 200, body: { required: false, ok: true } })
    if (access.mode === 'unconfigured') return unconfigured()
    const code = (req.body as { code?: unknown } | undefined)?.code
    if (code === undefined || code === '') return finish({ status: 200, body: { required: true, ok: false } })
    if (typeof code !== 'string') return finish({ status: 400, body: { error: msg('srv.badPayload') } })
    const lim = tooManyFails()
    if (!lim.ok) return lockedOut(lim.retryAfterS)
    const label = access.check(code)
    if (!label) {
      rateLimit(`acceso:${ip}`, RATE_RULES.intentosFallidos) // suma el fallo
      return finish({ status: 401, body: { error: msg('srv.codeInvalid') } })
    }
    // La etiqueta es el apodo de quien presentó el código (no datos personales): sirve para saludarle.
    return finish({ status: 200, body: { required: true, ok: true, label } }, { who: label })
  }

  // /api/coach y /api/analyze: el código viaja en un header en cada pedido.
  let who: string | undefined = accountWho
  if (accountWho) {
    // Ya se validó la cuenta arriba: no hay código que revisar.
  } else if (access.mode === 'unconfigured') return unconfigured()
  else if (access.mode === 'gated') {
    const lim = tooManyFails()
    if (!lim.ok) return lockedOut(lim.retryAfterS)
    const header = req.headers['x-access-code']
    who = access.check(Array.isArray(header) ? header[0] : header) ?? undefined
    if (!who) {
      rateLimit(`acceso:${ip}`, RATE_RULES.intentosFallidos)
      return finish({ status: 401, body: { error: msg('srv.accessLost') } })
    }
    const perCode = rateLimit(`codigo:${who}`, RATE_RULES.porCodigo)
    if (!perCode.ok) {
      return finish(
        {
          status: 429,
          body: { error: msg('srv.dailyCap') },
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
          body: { error: msg('srv.rate') },
          headers: { 'Retry-After': String(rl.retryAfterS) },
        },
        { rule: ruleName, who },
      )
    }
  }

  try {
    return finish(await dispatch(endpoint, req.body, apiKey, lang), { who })
  } catch (e) {
    logEvent('error', 'api_unhandled', { endpoint, error: e instanceof Error ? e : String(e) })
    return finish({ status: 500, body: { error: msg('srv.generic') } }, { who })
  }
}
