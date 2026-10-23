import type { IncomingMessage } from 'node:http'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { translate, type Lang } from '../shared/i18n.js'
import { authorize } from './auth.js'
import { cloudEnv, findPerfilByEmail, getPerfil, rest, type CloudEnv } from './cloud.js'
import { buildGeneratePrompt, buildReportPrompt, type Competencia } from './evaluacionesPrompts.js'
import { generateJson, responseText } from './gemini.js'
import { RATE_RULES, clientIp, ipTag, isAllowedOrigin, logEvent, publicError, requestLang } from './guard.js'
import { durableLimit } from './limits.js'
import { brandedMail, sendMail, type Mail } from './mailer.js'

// POST /api/evaluaciones — evaluaciones de desempeño (ver docs/EVALUACIONES.md).
//
// Quién crea: cuentas con "Para empresas" arman una evaluación y la asignan a emails de cuentas de Bivio. Quien
// recibe se autoevalúa y se genera un informe que ven las dos personas. También cualquiera con "Para profesionales"
// o "Para empresas" puede evaluarse a sí mismo (evaluación "directa"). Toda la lógica de quién ve qué vive acá:
// las tablas no son accesibles desde el navegador.
//
//   generar   → propone competencias y preguntas (no guarda nada)
//   crear     → guarda la evaluación y la asigna (o la asigna a sí mismo, en modo "propia")
//   mias      → lo que me asignaron      creadas → lo que creé, con el estado de cada asignación
//   abrir     → una asignación completa   guardar → borrador de respuestas   enviar → completar y generar el informe
//   compartir → quien se autoevaluó por su cuenta ("Evaluarme") la comparte, en solo lectura, con otra cuenta de Bivio;
//               dejarDeCompartir la retira; compartidas lista lo que otras personas compartieron conmigo
//   puntuar   → quien creó la evaluación le pone a cada competencia un puntaje de 1 a 5 (con comentario); la persona lo ve
//   eliminar  → borra una evaluación que creé (y con ella las respuestas)

type Req = IncomingMessage & { body?: unknown }

export interface EvalResult {
  status: number
  body: unknown
}

const MAX_TEXT = 200
const MAX_EVIDENCIA = 2_000
const MAX_EMAILS = 20
const MAX_COMPARTIDAS = 5
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : null)
const optStr = (v: unknown, max: number): string | null => (v === undefined || v === null || v === '' ? '' : str(v, max))

// ── Competencias: lo que devuelve el modelo (o edita la persona) se normaliza siempre ───────────────────

export function normalizeCompetencias(raw: unknown): Competencia[] | null {
  if (!Array.isArray(raw)) return null
  const out: Competencia[] = []
  for (const c of raw.slice(0, 8)) {
    if (!c || typeof c !== 'object') continue
    const { nombre, descripcion, preguntas } = c as Record<string, unknown>
    const n = str(nombre, 80)
    const preg = (Array.isArray(preguntas) ? preguntas : []).map((p) => str(p, 300)).filter((p): p is string => Boolean(p)).slice(0, 4)
    if (!n || preg.length === 0) continue
    out.push({ id: `c${out.length + 1}`, nombre: n, descripcion: typeof descripcion === 'string' ? descripcion.trim().slice(0, 300) : '', preguntas: preg })
  }
  return out.length >= 2 ? out : null
}

// ── Modelo ─────────────────────────────────────────────────────────────────────────────────────────────

const modelName = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

async function askModel<T>(apiKey: string, system: string, temperature: number): Promise<T> {
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel(
    { model: modelName(), generationConfig: { responseMimeType: 'application/json', temperature } },
    { timeout: 45_000 },
  )
  return generateJson<T>(async () => responseText((await model.generateContent(system)).response, 'evaluaciones'))
}

const DEMO_COMPETENCIAS: Competencia[] = [
  { id: 'c1', nombre: 'Resultados', descripcion: 'Cumplimiento de objetivos y entregas.', preguntas: ['Describe una entrega importante del período: qué hiciste y qué efecto tuvo.', 'Cuenta una situación en la que no llegaste a un objetivo: qué pasó y qué hiciste.'] },
  { id: 'c2', nombre: 'Colaboración', descripcion: 'Trabajo con otras personas y áreas.', preguntas: ['Cuenta un caso en que ayudaste a otra persona o área a lograr algo.', 'Describe un desacuerdo en el equipo y cómo lo resolviste.'] },
  { id: 'c3', nombre: 'Aprendizaje', descripcion: 'Incorporación de nuevas habilidades.', preguntas: ['¿Qué aprendiste en este período y dónde lo aplicaste?'] },
  { id: 'c4', nombre: 'Comunicación', descripcion: 'Claridad al informar y pedir ayuda.', preguntas: ['Describe una ocasión en que tu comunicación evitó o causó un problema.'] },
]

export interface Informe {
  resumen: string
  fortalezas: { competencia: string; texto: string; evidencia: string }[]
  desarrollo: { competencia: string; texto: string; evidencia: string }[]
  coherencia: { competencia: string; nota: string }[]
  planDesarrollo: { texto: string; bloque: '70' | '20' | '10'; plazo: string }[]
  preguntasParaConversar: string[]
}

const list = <T>(v: unknown, map: (x: Record<string, unknown>) => T | null, max: number): T[] =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map(map)
    .filter((x): x is T => x !== null)
    .slice(0, max)

const s = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Deja el informe con la forma que espera la pantalla, sea lo que sea que devuelva el modelo. */
export function normalizeInforme(raw: Record<string, unknown>): Informe {
  const item = (x: Record<string, unknown>) => (s(x.texto) ? { competencia: s(x.competencia, 80), texto: s(x.texto), evidencia: s(x.evidencia) } : null)
  return {
    // Si el modelo abre con una frase de introducción ("Aquí tienes el resumen…"), se la saca: el resumen empieza por lo central.
    resumen: s(raw.resumen, 900).replace(/^(Aquí tienes|Aquí está|Este es|Here is|Here’s|Here's)[^.]*\.\s*/i, '') || s(raw.resumen, 900),
    fortalezas: list(raw.fortalezas, item, 6),
    desarrollo: list(raw.desarrollo, item, 6),
    coherencia: list(raw.coherencia, (x) => (s(x.nota) ? { competencia: s(x.competencia, 80), nota: s(x.nota) } : null), 6),
    planDesarrollo: list(raw.planDesarrollo, (x) => (s(x.texto) ? { texto: s(x.texto), bloque: (['70', '20', '10'].includes(String(x.bloque)) ? String(x.bloque) : '70') as '70' | '20' | '10', plazo: s(x.plazo, 80) } : null), 5),
    preguntasParaConversar: (Array.isArray(raw.preguntasParaConversar) ? raw.preguntasParaConversar : []).map((p) => s(p, 300)).filter(Boolean).slice(0, 6),
  }
}

const DEMO_INFORME: Informe = {
  resumen: '— MODO DEMO — Una lectura ordenada de lo que escribiste en tu autoevaluación.',
  fortalezas: [{ competencia: 'Resultados', texto: 'Tu evidencia muestra entregas con efecto concreto.', evidencia: '(tu evidencia)' }],
  desarrollo: [{ competencia: 'Comunicación', texto: 'Hay espacio para anticipar los problemas con más tiempo.', evidencia: '(tu evidencia)' }],
  coherencia: [],
  planDesarrollo: [{ texto: 'Pedir feedback sobre una entrega a alguien con quien trabajaste.', bloque: '20', plazo: 'en las próximas 2 semanas' }],
  preguntasParaConversar: ['¿Qué te enorgullece más de este período?', '¿Qué te gustaría que cambiara en cómo trabajamos juntos?'],
}

// ── Mail de aviso ──────────────────────────────────────────────────────────────────────────────────────

export function buildScoredMail(lang: Lang, titulo: string, creadaPor: string, appUrl: string): Mail {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  return brandedMail(
    t('mail.score.subject'),
    {
      heading: t('mail.score.subject'),
      preheader: t('mail.score.intro', { who: creadaPor, title: titulo }),
      paragraphs: [t('mail.score.hello'), t('mail.score.intro', { who: creadaPor, title: titulo })],
      cta: { label: t('mail.eval.link'), url: appUrl },
      note: t('mail.eval.note'),
      footer: t('mail.eval.footer'),
    },
    appUrl,
  )
}

export function buildSharedMail(lang: Lang, titulo: string, de: string, appUrl: string): Mail {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  return brandedMail(
    t('mail.share.subject'),
    {
      heading: t('mail.share.subject'),
      preheader: t('mail.share.intro', { who: de, title: titulo }),
      paragraphs: [t('mail.share.hello'), t('mail.share.intro', { who: de, title: titulo })],
      cta: { label: t('mail.eval.link'), url: appUrl },
      note: t('mail.eval.note'),
      footer: t('mail.eval.footer'),
    },
    appUrl,
  )
}

export function buildAssignedMail(lang: Lang, titulo: string, creadaPor: string, appUrl: string): Mail {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)
  return brandedMail(
    t('mail.eval.subject'),
    {
      heading: t('mail.eval.subject'),
      preheader: t('mail.eval.intro', { who: creadaPor, title: titulo }),
      paragraphs: [t('mail.eval.hello'), t('mail.eval.intro', { who: creadaPor, title: titulo })],
      cta: { label: t('mail.eval.link'), url: appUrl },
      note: t('mail.eval.note'),
      footer: t('mail.eval.footer'),
    },
    appUrl,
  )
}

// ── Acceso a datos (solo servidor) ─────────────────────────────────────────────────────────────────────

async function db<T>(env: CloudEnv, path: string, init: RequestInit = {}): Promise<T> {
  const res = await rest(env, path, { ...init, headers: { Prefer: 'return=representation', ...(init.headers as Record<string, string> | undefined) } })
  if (!res.ok) throw new Error(`db ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : []) as T
}

interface AsignacionRow {
  id: string
  evaluacion_id: string
  user_id: string
  email: string
  estado: 'pendiente' | 'en_curso' | 'completada'
  respuestas: Record<string, unknown>
  informe: Informe | null
  puntajes: Puntajes | null
  puntuada_at: string | null
  asignada_at: string
  completada_at: string | null
  bivio_evaluaciones: EvaluacionRow
}
/** El puntaje de quien evalúa, por competencia: de 1 (muy malo) a 5 (muy bueno). Lo pone una persona. */
export type Puntajes = Record<string, { puntaje: number; comentario: string }>

interface EvaluacionRow {
  id: string
  owner_id: string
  tipo: 'asignada' | 'directa'
  titulo: string
  area: string
  rol: string
  periodo: string
  competencias: Competencia[]
  lang: Lang
  created_at: string
}

// ── Handler ────────────────────────────────────────────────────────────────────────────────────────────

export async function handleEvaluaciones(req: Req, apiKey: string | undefined): Promise<EvalResult> {
  const lang: Lang = requestLang(req)
  const msg = (k: Parameters<typeof translate>[1]) => translate(lang, k)
  const fail = (status: number, key: Parameters<typeof translate>[1], extra: Record<string, unknown> = {}): EvalResult => ({ status, body: { error: msg(key), ...extra } })

  if (req.method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }
  if (!isAllowedOrigin(req)) return fail(403, 'srv.origin')
  const env = cloudEnv()
  if (!env) return fail(503, 'srv.cloudOff')

  const gate = await authorize(req)
  if (!gate.ok) return fail(gate.reason === 'sin_sesion' ? 401 : 403, gate.reason === 'sin_sesion' ? 'srv.accessLost' : 'srv.disabled', { reason: gate.reason })
  const me = gate.user
  const canCreate = gate.isAdmin || gate.areas.empresas
  const canSelf = gate.isAdmin || gate.areas.empresas || gate.areas.profesionales

  const body = (req.body ?? {}) as Record<string, unknown>
  const action = body.action
  const aiAction = action === 'generar' || action === 'enviar'
  if (aiAction) {
    const lim = await durableLimit(`eval:${me.id}`, RATE_RULES.evaluaciones)
    if (!lim.ok) return fail(429, 'srv.dailyCap')
  }

  try {
    switch (action) {
      case 'generar': {
        const modo = body.modo === 'propia' ? 'propia' : 'jefe'
        if (modo === 'jefe' ? !canCreate : !canSelf) return fail(403, 'srv.noArea', { reason: 'sin_area' })
        const area = str(body.area, MAX_TEXT)
        const rol = optStr(body.rol, MAX_TEXT)
        const periodo = optStr(body.periodo, 80)
        const foco = optStr(body.foco, 600)
        const ajuste = optStr(body.ajuste, 400)
        if (!area || rol === null || periodo === null || foco === null || ajuste === null) return fail(400, 'srv.badPayload')
        // Para evaluarse a uno mismo se piden el área y el cargo: sin cargo la evaluación no se puede armar a medida.
        if (modo === 'propia' && !rol) return fail(400, 'srv.badPayload')
        const prevC = normalizeCompetencias((body.previa as { competencias?: unknown } | undefined)?.competencias)
        const previa = prevC && ajuste ? { titulo: str((body.previa as { titulo?: unknown }).titulo, MAX_TEXT) ?? '', competencias: prevC } : undefined
        if (!apiKey) return { status: 200, body: { demo: true, borrador: { titulo: `— DEMO — Evaluación · ${area}`, competencias: DEMO_COMPETENCIAS } } }
        const out = await askModel<{ titulo?: unknown; competencias?: unknown; nota?: unknown }>(apiKey, buildGeneratePrompt({ area, rol, periodo, foco: foco || undefined, previa, ajuste: ajuste || undefined, lang }), 0.5)
        const competencias = normalizeCompetencias(out.competencias)
        if (!competencias) return fail(502, 'srv.upstream')
        return { status: 200, body: { borrador: { titulo: str(out.titulo, MAX_TEXT) ?? `${area}`, competencias }, nota: typeof out.nota === 'string' ? out.nota.trim().slice(0, 300) : '' } }
      }

      case 'crear': {
        const modo = body.modo === 'propia' ? 'propia' : 'jefe'
        if (modo === 'jefe' ? !canCreate : !canSelf) return fail(403, 'srv.noArea', { reason: 'sin_area' })
        const titulo = str(body.titulo, MAX_TEXT)
        const area = str(body.area, MAX_TEXT)
        const rol = optStr(body.rol, MAX_TEXT)
        const periodo = optStr(body.periodo, 80)
        const competencias = normalizeCompetencias(body.competencias)
        if (!titulo || !area || rol === null || periodo === null || !competencias) return fail(400, 'srv.badPayload')

        const emails = modo === 'propia' ? [me.email] : [...new Set((Array.isArray(body.emails) ? body.emails : []).map((e) => String(e).trim().toLowerCase()))]
        if (emails.length === 0 || emails.length > MAX_EMAILS || emails.some((e) => e.length > 254 || !EMAIL.test(e))) return fail(400, 'srv.badEmail')

        // Cada destinatario tiene que tener una cuenta activa de Bivio: se resuelve ANTES de guardar nada.
        const resolved: { email: string; userId?: string; problema?: 'sin_cuenta' | 'cuenta_inactiva' }[] = []
        for (const email of emails) {
          if (modo === 'propia') {
            resolved.push({ email, userId: me.id })
            continue
          }
          const p = await findPerfilByEmail(env, email)
          resolved.push(!p ? { email, problema: 'sin_cuenta' } : p.estado !== 'activo' ? { email, problema: 'cuenta_inactiva' } : { email, userId: p.user_id })
        }
        const ok = resolved.filter((r) => r.userId)
        if (ok.length === 0) return { status: 422, body: { error: msg('srv.evalNoAccounts'), resultados: resolved.map(({ email, problema }) => ({ email, problema })) } }

        const [ev] = await db<EvaluacionRow[]>(env, '/rest/v1/bivio_evaluaciones', {
          method: 'POST',
          body: JSON.stringify({ owner_id: me.id, tipo: modo === 'propia' ? 'directa' : 'asignada', titulo, area, rol, periodo, competencias, lang }),
        })
        await db(env, '/rest/v1/bivio_asignaciones', { method: 'POST', body: JSON.stringify(ok.map((r) => ({ evaluacion_id: ev.id, user_id: r.userId, email: r.email }))) })

        const appUrl = process.env.APP_URL ?? 'https://career-path-ruby.vercel.app'
        const notified: Record<string, boolean> = {}
        if (modo === 'jefe' && body.notify !== false) {
          for (const r of ok) notified[r.email] = await sendMail(r.email, buildAssignedMail(lang, titulo, me.email, appUrl))
        }
        logEvent('info', 'evaluacion_creada', { modo, asignadas: ok.length, sinCuenta: resolved.length - ok.length })
        return { status: 200, body: { ok: true, id: ev.id, resultados: resolved.map(({ email, problema }) => ({ email, problema: problema ?? null, avisado: notified[email] ?? false })) } }
      }

      case 'mias': {
        const rows = await db<AsignacionRow[]>(env, `/rest/v1/bivio_asignaciones?user_id=eq.${me.id}&select=id,estado,asignada_at,completada_at,puntuada_at,bivio_evaluaciones(id,owner_id,tipo,titulo,area,created_at)&order=asignada_at.desc&limit=100`)
        const owners = new Map<string, string>()
        for (const r of rows) {
          const oid = r.bivio_evaluaciones.owner_id
          if (!owners.has(oid)) owners.set(oid, oid === me.id ? me.email : ((await getPerfil(env, oid))?.email ?? ''))
        }
        return {
          status: 200,
          body: {
            items: rows.map((r) => ({ id: r.id, estado: r.estado, asignadaAt: r.asignada_at, completadaAt: r.completada_at, conPuntaje: Boolean(r.puntuada_at), titulo: r.bivio_evaluaciones.titulo, area: r.bivio_evaluaciones.area, tipo: r.bivio_evaluaciones.tipo, creadaPor: owners.get(r.bivio_evaluaciones.owner_id) ?? '' })),
            pendientes: rows.filter((r) => r.estado !== 'completada').length,
          },
        }
      }

      case 'creadas': {
        if (!canCreate) return fail(403, 'srv.noArea', { reason: 'sin_area' })
        const rows = await db<(EvaluacionRow & { bivio_asignaciones: { id: string; email: string; estado: string; completada_at: string | null; puntuada_at: string | null }[] })[]>(
          env,
          `/rest/v1/bivio_evaluaciones?owner_id=eq.${me.id}&tipo=eq.asignada&select=id,titulo,area,rol,periodo,created_at,bivio_asignaciones(id,email,estado,completada_at,puntuada_at)&order=created_at.desc&limit=100`,
        )
        return { status: 200, body: { items: rows.map((r) => ({ id: r.id, titulo: r.titulo, area: r.area, rol: r.rol, periodo: r.periodo, createdAt: r.created_at, asignaciones: r.bivio_asignaciones.map((a) => ({ id: a.id, email: a.email, estado: a.estado, completadaAt: a.completada_at, puntuada: Boolean(a.puntuada_at) })) })) } }
      }

      case 'abrir':
      case 'guardar':
      case 'enviar':
      case 'puntuar': {
        const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
        if (!id) return fail(400, 'srv.badPayload')
        const [a] = await db<AsignacionRow[]>(env, `/rest/v1/bivio_asignaciones?id=eq.${id}&select=*,bivio_evaluaciones(*)&limit=1`)
        // Quien no es parte de esta evaluación no se entera de que existe.
        const isRecipient = a?.user_id === me.id
        const isOwner = a?.bivio_evaluaciones.owner_id === me.id
        // Una autoevaluación propia que su autora compartió con esta cuenta: se puede leer, no tocar.
        const shares = a ? await db<{ user_id: string; email: string }[]>(env, `/rest/v1/bivio_compartidas?asignacion_id=eq.${a.id}&select=user_id,email`) : []
        const isReader = !isRecipient && !isOwner && shares.some((x) => x.user_id === me.id)
        if (!a || (!isRecipient && !isOwner && !isReader)) return { status: 404, body: { error: 'Not found' } }
        const ev = a.bivio_evaluaciones
        const creadaPor = isOwner ? me.email : ((await getPerfil(env, ev.owner_id))?.email ?? '')

        if (action === 'abrir') {
          // Quien creó la evaluación ve las respuestas y el informe solo cuando la persona ya los envió.
          const visible = isRecipient || isReader || a.estado === 'completada'
          return {
            status: 200,
            body: {
              id: a.id,
              estado: a.estado,
              rol: isRecipient ? 'responde' : isReader ? 'lector' : 'creador',
              // Con quién compartió su autoevaluación quien la hizo (solo ella lo ve).
              compartidoCon: isRecipient && ev.tipo === 'directa' ? shares.map((x) => x.email) : [],
              evaluacion: { titulo: ev.titulo, area: ev.area, rol: ev.rol, periodo: ev.periodo, tipo: ev.tipo, competencias: ev.competencias },
              creadaPor,
              email: a.email,
              respuestas: visible ? a.respuestas : {},
              informe: visible ? a.informe : null,
              // El puntaje lo ven las dos personas apenas quien evalúa lo guarda.
              puntajes: a.puntuada_at ? a.puntajes : null,
              puntuadaAt: a.puntuada_at,
              completadaAt: a.completada_at,
            },
          }
        }

        if (action === 'puntuar') {
          // Puntúa quien creó la evaluación, sobre la autoevaluación de otra persona y una vez que ya la envió.
          if (!isOwner || isRecipient || ev.tipo !== 'asignada') return fail(403, 'srv.evalLocked')
          if (a.estado !== 'completada') return fail(403, 'srv.scoreWaiting')
          const puntajes = cleanPuntajes(body.puntajes, ev.competencias)
          if (!puntajes) return fail(400, 'srv.scoreIncomplete')
          await db(env, `/rest/v1/bivio_asignaciones?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ puntajes, puntuada_at: new Date().toISOString() }) })
          // Aviso a la persona (si hay email configurado); el puntaje igual aparece en su pantalla.
          const appUrl = process.env.APP_URL ?? 'https://career-path-ruby.vercel.app'
          const avisada = await sendMail(a.email, buildScoredMail(ev.lang, ev.titulo, me.email, appUrl))
          logEvent('info', 'evaluacion_puntuada', { avisada })
          return { status: 200, body: { ok: true, avisada } }
        }

        // Guardar y enviar son solo de quien responde, y solo mientras no esté completada.
        if (isReader) return fail(403, 'srv.evalLocked')
        if (!isRecipient || a.estado === 'completada') return fail(403, 'srv.evalLocked')
        const respuestas = cleanRespuestas(body.respuestas, ev.competencias)
        if (!respuestas) return fail(400, 'srv.badPayload')

        if (action === 'guardar') {
          await db(env, `/rest/v1/bivio_asignaciones?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ respuestas, estado: 'en_curso' }) })
          return { status: 200, body: { ok: true } }
        }

        const incompleta = ev.competencias.find((c) => !(respuestas[c.id] as { nivel?: number; evidencia?: string } | undefined)?.nivel || ((respuestas[c.id] as { evidencia?: string } | undefined)?.evidencia ?? '').trim().length < 20)
        if (incompleta) return fail(400, 'srv.evalIncomplete', { competencia: incompleta.nombre })
        const informe = apiKey
          ? normalizeInforme(await askModel<Record<string, unknown>>(apiKey, buildReportPrompt({ titulo: ev.titulo, area: ev.area, rol: ev.rol, periodo: ev.periodo, competencias: ev.competencias, respuestas: respuestas as ReportRespuestas, lang }), 0.3))
          : DEMO_INFORME
        await db(env, `/rest/v1/bivio_asignaciones?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ respuestas, informe, estado: 'completada', completada_at: new Date().toISOString() }) })
        logEvent('info', 'evaluacion_completada', { tipo: ev.tipo })
        return { status: 200, body: { ok: true, informe } }
      }

      case 'compartir':
      case 'dejarDeCompartir': {
        const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        if (!id || email.length > 254 || !EMAIL.test(email)) return fail(400, 'srv.badEmail')
        const [a] = await db<AsignacionRow[]>(env, `/rest/v1/bivio_asignaciones?id=eq.${id}&select=*,bivio_evaluaciones(*)&limit=1`)
        // Solo quien hizo su propia autoevaluación decide con quién compartirla.
        if (!a || a.user_id !== me.id || a.bivio_evaluaciones.tipo !== 'directa') return { status: 404, body: { error: 'Not found' } }

        if (action === 'dejarDeCompartir') {
          await db(env, `/rest/v1/bivio_compartidas?asignacion_id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' })
          return { status: 200, body: { ok: true } }
        }

        if (a.estado !== 'completada') return fail(403, 'srv.shareNotReady')
        if (email === me.email.toLowerCase()) return fail(400, 'srv.shareSelf')
        const target = await findPerfilByEmail(env, email)
        if (!target || target.estado !== 'activo') return { status: 422, body: { error: msg('srv.shareNoAccount'), problema: !target ? 'sin_cuenta' : 'cuenta_inactiva' } }
        const current = await db<{ user_id: string }[]>(env, `/rest/v1/bivio_compartidas?asignacion_id=eq.${id}&select=user_id`)
        const already = current.some((x) => x.user_id === target.user_id)
        if (!already && current.length >= MAX_COMPARTIDAS) return fail(400, 'srv.shareLimit')
        let avisado = false
        if (!already) {
          await db(env, '/rest/v1/bivio_compartidas', { method: 'POST', body: JSON.stringify({ asignacion_id: id, user_id: target.user_id, email }) })
          const appUrl = process.env.APP_URL ?? 'https://career-path-ruby.vercel.app'
          avisado = await sendMail(email, buildSharedMail(a.bivio_evaluaciones.lang, a.bivio_evaluaciones.titulo, me.email, appUrl))
        }
        logEvent('info', 'evaluacion_compartida', { yaEstaba: already, avisado })
        return { status: 200, body: { ok: true, avisado } }
      }

      case 'compartidas': {
        const rows = await db<{ asignacion_id: string; created_at: string; bivio_asignaciones: { email: string; bivio_evaluaciones: { titulo: string; area: string } } }[]>(
          env,
          `/rest/v1/bivio_compartidas?user_id=eq.${me.id}&select=asignacion_id,created_at,bivio_asignaciones(email,bivio_evaluaciones(titulo,area))&order=created_at.desc&limit=100`,
        )
        return { status: 200, body: { items: rows.map((r) => ({ id: r.asignacion_id, de: r.bivio_asignaciones.email, titulo: r.bivio_asignaciones.bivio_evaluaciones.titulo, area: r.bivio_asignaciones.bivio_evaluaciones.area, compartidaAt: r.created_at })) } }
      }

      case 'eliminar': {
        const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
        if (!id) return fail(400, 'srv.badPayload')
        const gone = await db<{ id: string }[]>(env, `/rest/v1/bivio_evaluaciones?id=eq.${id}&owner_id=eq.${me.id}`, { method: 'DELETE' })
        if (gone.length === 0) return { status: 404, body: { error: 'Not found' } }
        logEvent('info', 'evaluacion_eliminada', {})
        return { status: 200, body: { ok: true } }
      }

      default:
        return fail(400, 'srv.badPayload')
    }
  } catch (e) {
    const pub = publicError(e, lang)
    logEvent('error', 'evaluaciones_error', { action: String(action), ip: ipTag(clientIp(req)), error: e instanceof Error ? e : String(e) })
    return { status: pub.status, body: { error: pub.message } }
  }
}

/** Un puntaje entero de 1 a 5 por cada competencia (todas obligatorias) y un comentario acotado. */
export function cleanPuntajes(raw: unknown, competencias: Competencia[]): Puntajes | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, { puntaje?: unknown; comentario?: unknown } | undefined>
  const out: Puntajes = {}
  for (const c of competencias) {
    const v = r[c.id]
    if (!v || typeof v.puntaje !== 'number' || !Number.isInteger(v.puntaje) || v.puntaje < 1 || v.puntaje > 5) return null
    out[c.id] = { puntaje: v.puntaje, comentario: typeof v.comentario === 'string' ? v.comentario.trim().slice(0, 500) : '' }
  }
  return out
}

type ReportRespuestas = Parameters<typeof buildReportPrompt>[0]['respuestas']

/** Solo se aceptan respuestas a las competencias de esa evaluación, con nivel 1 a 4 y textos acotados. */
export function cleanRespuestas(raw: unknown, competencias: Competencia[]): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const c of competencias) {
    const v = r[c.id] as { nivel?: unknown; evidencia?: unknown } | undefined
    if (!v) continue
    const nivel = typeof v.nivel === 'number' && Number.isInteger(v.nivel) && v.nivel >= 1 && v.nivel <= 4 ? v.nivel : undefined
    const evidencia = typeof v.evidencia === 'string' ? v.evidencia.slice(0, MAX_EVIDENCIA) : ''
    out[c.id] = { ...(nivel ? { nivel } : {}), evidencia }
  }
  if (typeof r.desarrollo === 'string') out.desarrollo = r.desarrollo.slice(0, MAX_EVIDENCIA)
  return out
}
