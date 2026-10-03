import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import {
  STAGE_OBJECTIVES,
  EXTRACT_PROMPT,
  buildProfilePrompt,
  buildReportPrompt,
  buildTurnSystemPrompt,
  type Path,
  type Stage,
} from './prompts.js'
import { MAX_OMITIDOS_POR_ETAPA, type SynthesisItem } from '../shared/stages.js'
import { generateJson, responseText } from './gemini.js'
import { logEvent, publicError } from './guard.js'

// Lógica compartida del agente conversacional. La usan api/coach.ts (Vercel)
// y el middleware de desarrollo en vite.config.ts. La API key y el system
// prompt viven solo acá: el cliente manda el historial y recibe el turno.

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface TurnResult {
  mensaje: string
  /** Tema (id) sobre el que gira la pregunta de este turno; "" si ninguno. */
  temaEnFoco: string
  /** Temas (ids) que la persona eligió dejar para más adelante. No son temas cubiertos. */
  temasOmitidos: string[]
  objetivosCubiertos: string[]
  listoParaAvanzar: boolean
  derivacion: boolean
  sintesisEtapa: string
  /** El "mapa" de cierre de la etapa: lo que la persona dijo, ordenado por objetivo. */
  sintesisItems: SynthesisItem[]
  /** Pregunta abierta que la persona se lleva a la próxima etapa. */
  preguntaPuente: string
}

type CoachRequest =
  | {
      mode: 'turno'
      stage: Stage
      path: Path
      history: ChatMessage[]
      cubiertos: string[]
      /** La etapa ya se cerró (la persona está viendo su mapa): el cierre no se reabre solo. */
      etapaCerrada?: boolean
      /** Temas que la persona ya eligió dejar para más adelante en esta etapa. */
      omitidos?: string[]
      sintesisPrevias: Partial<Record<Stage, string>>
      documentos?: string
      lecturaPerfil?: string
    }
  | {
      mode: 'informe'
      path: Path
      history: ChatMessage[]
      sintesisPrevias: Partial<Record<Stage, string>>
      documentos?: string
      lecturaPerfil?: string
    }
  | { mode: 'perfil'; puesto: string; perfilTexto: string }
  | { mode: 'extraer'; pdfBase64: string }

export type CoachResponse = { status: number; body: unknown }

const STAGES: Stage[] = ['diagnostico', 'discovery', 'plan']
const PATHS: Path[] = ['quiebre', 'perfil']
const MAX_HISTORY = 120
const MAX_MESSAGE = 6_000
const MAX_CONTEXT = 30_000 // CV + LinkedIn
const MAX_DOC = 15_000
const MAX_PDF_BASE64 = 4_000_000 // ~3 MB de PDF; Vercel corta el body en 4.5 MB

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const optStr = (v: unknown, max: number) => v === undefined || isStr(v, max)

function isHistory(v: unknown): v is ChatMessage[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= MAX_HISTORY &&
    v.every(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'model') &&
        isStr((m as ChatMessage).text, MAX_MESSAGE),
    ) &&
    (v[0] as ChatMessage).role === 'user'
  )
}

function isSintesis(v: unknown): v is Partial<Record<Stage, string>> {
  if (typeof v !== 'object' || v === null) return false
  return Object.entries(v).every(([k, s]) => STAGES.includes(k as Stage) && isStr(s, MAX_MESSAGE))
}

function validate(body: unknown): CoachRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  switch (b.mode) {
    case 'turno':
      if (
        STAGES.includes(b.stage as Stage) &&
        PATHS.includes(b.path as Path) &&
        isHistory(b.history) &&
        Array.isArray(b.cubiertos) &&
        b.cubiertos.every((c) => isStr(c, 40)) &&
        (b.etapaCerrada === undefined || typeof b.etapaCerrada === 'boolean') &&
        (b.omitidos === undefined || (Array.isArray(b.omitidos) && b.omitidos.length <= 12 && b.omitidos.every((c) => isStr(c, 40)))) &&
        isSintesis(b.sintesisPrevias) &&
        optStr(b.documentos, MAX_CONTEXT) &&
        optStr(b.lecturaPerfil, MAX_CONTEXT)
      )
        return b as CoachRequest
      return null
    case 'informe':
      if (
        PATHS.includes(b.path as Path) &&
        isHistory(b.history) &&
        isSintesis(b.sintesisPrevias) &&
        optStr(b.documentos, MAX_CONTEXT) &&
        optStr(b.lecturaPerfil, MAX_CONTEXT)
      )
        return b as CoachRequest
      return null
    case 'perfil':
      if (isStr(b.puesto, 200) && (b.puesto as string).trim() && isStr(b.perfilTexto, MAX_CONTEXT) && (b.perfilTexto as string).trim().length >= 80)
        return b as CoachRequest
      return null
    case 'extraer':
      if (isStr(b.pdfBase64, MAX_PDF_BASE64) && (b.pdfBase64 as string).length > 0) return b as CoachRequest
      return null
    default:
      return null
  }
}

function toContents(history: ChatMessage[]): Content[] {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
}

/**
 * Cuántas veces el coach ya preguntó por cada tema que sigue pendiente. Se lee de los propios
 * turnos del coach (cada uno declara su "temaEnFoco") y se le devuelve al modelo: así puede notar
 * que la persona esquiva un tema y decidir cómo retomarlo, en lugar de abandonarlo o repetirse.
 */
export function askCounts(history: ChatMessage[], stage: Stage, cubiertos: string[], omitidos: string[] = []): Record<string, number> {
  const pending = STAGE_OBJECTIVES[stage].map((o) => o.id).filter((id) => !cubiertos.includes(id) && !omitidos.includes(id))
  const counts: Record<string, number> = {}
  for (const m of history) {
    if (m.role !== 'model') continue
    try {
      const foco = (JSON.parse(m.text) as { temaEnFoco?: unknown }).temaEnFoco
      if (typeof foco === 'string' && pending.includes(foco)) counts[foco] = (counts[foco] ?? 0) + 1
    } catch {
      // Turno sin JSON (sesiones viejas): no cuenta.
    }
  }
  return counts
}

const MAX_ITEM_TEXT = 400
const MAX_QUOTE = 200
const MAX_BRIDGE = 300

/** Minúsculas y sin puntuación, para comparar frases sin que importen comillas ni signos. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

// El "mapa" de cierre. Las citas tienen que ser TEXTUALES de lo que la persona
// escribió (guardrail §5: anclar todo en lo que dijo): si el modelo inventa una
// frase, se descarta la cita y se conserva el resto.
function cleanItems(raw: unknown, stage: Stage, userText: string): SynthesisItem[] {
  if (!Array.isArray(raw)) return []
  const order = STAGE_OBJECTIVES[stage].map((o) => o.id)
  const seen = new Set<string>()
  const items: SynthesisItem[] = []
  for (const it of raw) {
    if (typeof it !== 'object' || it === null) continue
    const { id, texto, cita } = it as Record<string, unknown>
    if (typeof id !== 'string' || !order.includes(id) || seen.has(id)) continue
    if (typeof texto !== 'string' || !texto.trim()) continue
    seen.add(id)
    const quote = typeof cita === 'string' ? fold(cita) : ''
    const literal = quote.length >= 4 && userText.includes(quote)
    items.push({
      id,
      texto: texto.trim().slice(0, MAX_ITEM_TEXT),
      cita: literal ? (cita as string).trim().slice(0, MAX_QUOTE) : '',
    })
  }
  return items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

// El servidor no confía ciegamente en el modelo para avanzar de etapa (§3):
// acumula los objetivos cubiertos y solo habilita el avance si están todos.
function normalizeTurn(
  raw: Partial<TurnResult>,
  stage: Stage,
  prevCubiertos: string[],
  history: ChatMessage[],
  etapaCerrada = false,
  prevOmitidos: string[] = [],
): TurnResult {
  const objetivos = STAGE_OBJECTIVES[stage]
  const valid = objetivos.map((o) => o.id)
  const omitibles = new Set(objetivos.filter((o) => o.omitible).map((o) => o.id))
  const cubiertos = Array.from(
    new Set([...prevCubiertos, ...(Array.isArray(raw.objetivosCubiertos) ? raw.objetivosCubiertos : [])]),
  ).filter((id) => valid.includes(id))

  // Temas que la persona eligió dejar para más adelante. El servidor no se fía del modelo:
  // solo vale si el tema se puede dejar, la persona ya tuvo la oportunidad de contestarlo (se
  // preguntó al menos una vez), no se pasa del tope por etapa, y no cuenta como cubierto.
  const asked = askCounts(history, stage, cubiertos, prevOmitidos)
  const nuevos = (Array.isArray(raw.temasOmitidos) ? raw.temasOmitidos : []).filter(
    (id): id is string => typeof id === 'string' && omitibles.has(id) && !prevOmitidos.includes(id) && (asked[id] ?? 0) >= 1,
  )
  const omitidos = Array.from(new Set([...prevOmitidos, ...nuevos]))
    .filter((id) => omitibles.has(id) && !cubiertos.includes(id)) // si después sí lo contó, deja de estar omitido
    .slice(0, MAX_OMITIDOS_POR_ETAPA)

  // Una etapa cierra cuando cada tema está cubierto u omitido por elección de la persona.
  const completos = valid.every((id) => cubiertos.includes(id) || omitidos.includes(id))
  // Una etapa cerrada sigue cerrada: lo que la persona escriba después (un "gracias", un ajuste)
  // no puede reabrirla aunque el modelo conteste con una pregunta.
  const listo = completos && (Boolean(raw.listoParaAvanzar) || etapaCerrada)

  const userText = fold(history.filter((m) => m.role === 'user' && !m.text.startsWith('(')).map((m) => m.text).join(' \n '))
  const modelItems = listo ? cleanItems(raw.sintesisItems, stage, userText).filter((i) => !omitidos.includes(i.id)) : []
  // Los temas omitidos aparecen en el mapa como lo que son: "para más adelante". Solo si el turno
  // trae un mapa nuevo: si no, el cliente conserva el anterior.
  const dejados: SynthesisItem[] =
    modelItems.length > 0
      ? omitidos.map((id) => ({ id, texto: 'Lo dejaste para más adelante. Cuando quieras, lo retomamos.', cita: '', omitido: true }))
      : []
  const items = [...modelItems, ...dejados].sort((x, y) => valid.indexOf(x.id) - valid.indexOf(y.id))

  const rawSintesis = typeof raw.sintesisEtapa === 'string' ? raw.sintesisEtapa.trim() : ''
  // Si el modelo omitió el resumen en prosa pero armó el mapa, se compone desde el mapa:
  // las etapas siguientes lo usan como contexto.
  let sintesis = rawSintesis || modelItems.map((i) => i.texto).join(' ')
  if (listo && sintesis && omitidos.length > 0) {
    const nombres = omitidos.map((id) => objetivos.find((o) => o.id === id)?.label.toLowerCase() ?? id).join(', ')
    sintesis += ` Dejó para más adelante: ${nombres}.`
  }

  // El tema en foco solo vale si es de esta etapa y sigue pendiente; al cerrar no hay ninguno.
  const foco =
    !listo && typeof raw.temaEnFoco === 'string' && valid.includes(raw.temaEnFoco) && !cubiertos.includes(raw.temaEnFoco) && !omitidos.includes(raw.temaEnFoco)
      ? raw.temaEnFoco
      : ''

  return {
    temaEnFoco: foco,
    temasOmitidos: omitidos,
    mensaje:
      typeof raw.mensaje === 'string' && raw.mensaje.trim()
        ? raw.mensaje.trim()
        : listo
          ? 'Gracias por contármelo con tanta claridad. Armé un mapa con lo que fuimos hablando: fijate si te representa.'
          : '¿Me contás un poco más?',
    objetivosCubiertos: cubiertos,
    listoParaAvanzar: listo,
    derivacion: Boolean(raw.derivacion),
    sintesisEtapa: listo ? sintesis : '',
    sintesisItems: items,
    preguntaPuente: listo && typeof raw.preguntaPuente === 'string' ? raw.preguntaPuente.trim().slice(0, MAX_BRIDGE) : '',
  }
}

async function runWithGemini(apiKey: string, req: CoachRequest): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const generationConfig = { responseMimeType: 'application/json', temperature: 0.6 }
  const requestOptions = { timeout: 45_000 }

  switch (req.mode) {
    case 'turno': {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildTurnSystemPrompt({ ...req, intentos: askCounts(req.history, req.stage, req.cubiertos, req.omitidos) }),
        generationConfig,
      }, requestOptions)
      const raw = await generateJson<Partial<TurnResult>>(async () =>
        responseText((await model.generateContent({ contents: toContents(req.history) })).response, 'turno'),
      )
      return normalizeTurn(raw, req.stage, req.cubiertos, req.history, req.etapaCerrada, req.omitidos)
    }
    case 'informe': {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildReportPrompt(req),
        generationConfig: { ...generationConfig, temperature: 0.3 },
      }, requestOptions)
      const contents = toContents(req.history)
      contents.push({ role: 'user', parts: [{ text: '(Fin de la conversación. Generá el informe de cierre en JSON.)' }] })
      return generateJson(async () => responseText((await model.generateContent({ contents })).response, 'informe'))
    }
    case 'perfil': {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { ...generationConfig, temperature: 0.3 } }, requestOptions)
      return generateJson(async () =>
        (
          await model.generateContent([
            { text: `PERFIL:\n"""\n${req.perfilTexto}\n"""` },
            { text: buildProfilePrompt(req.puesto) },
          ])
        ).response.text(),
      )
    }
    case 'extraer': {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { ...generationConfig, temperature: 0 } }, requestOptions)
      const { texto } = await generateJson<{ texto?: string }>(async () =>
        (
          await model.generateContent([
            { inlineData: { mimeType: 'application/pdf', data: req.pdfBase64 } },
            { text: EXTRACT_PROMPT },
          ])
        ).response.text(),
      )
      return { texto: (texto ?? '').slice(0, MAX_DOC) }
    }
  }
}

// ── Modo demo (sin GEMINI_API_KEY): guion mínimo para probar el flujo ───────

const DEMO_QUESTIONS: Record<Stage, string[]> = {
  diagnostico: [
    '— MODO DEMO — Contame con tus palabras: ¿qué te gustaría que cambie a partir de esta conversación?',
    'Gracias. ¿Qué pasó concretamente la última vez que sentiste ese freno? Me interesa el hecho, no tanto la conclusión.',
    'Si hoy te imaginaras más de un camino posible, ¿cuáles aparecerían?',
    '¿Qué intentaste hasta ahora para moverte, y qué tan dispuesto/a te sentís a hacer algo distinto?',
  ],
  discovery: [
    '— MODO DEMO — Mirando lo que dijiste en el Diagnóstico, ¿cómo describirías hoy el obstáculo principal, con los datos que tenés?',
    'Contame dos escenarios posibles para los próximos meses, como si fueran dos historias distintas.',
    'En cada escenario, ¿qué te da más control, curiosidad o confianza, y qué te preocupa?',
  ],
  plan: [
    '— MODO DEMO — De todo lo que exploraste, ¿qué objetivo de desarrollo elegís trabajar?',
    '¿En qué plazo querés verlo en movimiento?',
    'Antes nombraste una fortaleza tuya. ¿Qué acción concreta podrías apoyar en ella?',
    '¿A quién le podrías pedir algo concreto para avanzar, qué le pedirías y para cuándo?',
    '¿Cómo vas a saber que avanzás, y cada cuánto querés revisarlo?',
  ],
}

function demoTurn(req: Extract<CoachRequest, { mode: 'turno' }>): TurnResult {
  const ids = STAGE_OBJECTIVES[req.stage].map((o) => o.id)
  const lastModel = [...req.history].reverse().find((m) => m.role === 'model')?.text ?? ''
  const askedSummary = lastModel.includes('¿Te representa este resumen?')
  const userTurnsInStage = req.history.at(-1)?.role === 'user' && !req.history.at(-1)?.text.startsWith('(') ? 1 : 0
  const cubiertos = [...req.cubiertos]
  if (userTurnsInStage && cubiertos.length < ids.length) cubiertos.push(ids[cubiertos.length])

  if (cubiertos.length === ids.length && askedSummary) {
    return {
      mensaje: '— MODO DEMO — Perfecto, cerramos esta etapa con lo que construiste.',
      temaEnFoco: '',
      temasOmitidos: [],
      objetivosCubiertos: cubiertos,
      listoParaAvanzar: true,
      derivacion: false,
      sintesisEtapa: 'Síntesis de demo: acá aparece un resumen en segunda persona, con tus propias palabras entre comillas.',
      sintesisItems: ids.map((id) => ({
        id,
        texto: 'Acá aparece, en una o dos oraciones, lo que dijiste sobre este tema, con tus palabras.',
        cita: '',
      })),
      preguntaPuente: '— MODO DEMO — ¿Qué te gustaría descubrir en la próxima etapa?',
    }
  }
  if (cubiertos.length === ids.length) {
    return {
      mensaje: '— MODO DEMO — Resumo lo que dijiste hasta acá con tus palabras… ¿Te representa este resumen?',
      temaEnFoco: '',
      temasOmitidos: [],
      objetivosCubiertos: cubiertos,
      listoParaAvanzar: false,
      derivacion: false,
      sintesisEtapa: '',
      sintesisItems: [],
      preguntaPuente: '',
    }
  }
  return {
    mensaje: DEMO_QUESTIONS[req.stage][cubiertos.length],
    temaEnFoco: ids[cubiertos.length] ?? '',
    temasOmitidos: [],
    objetivosCubiertos: cubiertos,
    listoParaAvanzar: false,
    derivacion: false,
    sintesisEtapa: '',
    sintesisItems: [],
    preguntaPuente: '',
  }
}

function runDemo(req: CoachRequest): unknown {
  switch (req.mode) {
    case 'turno':
      return demoTurn(req)
    case 'informe':
      return {
        objetivoSesion: '— MODO DEMO — Entender si seguir creciendo donde estás o explorar afuera.',
        hallazgos: [{ texto: 'Tu freno aparece más en la dirección que en las habilidades.', citaPersona: 'sé hacer mi trabajo, no sé hacia dónde ir' }],
        acciones: [
          { texto: 'Pedirle a tu jefa una conversación de 30 minutos sobre tu proyección, antes del viernes 15.', bloque: '70', tipo: 'pedido', fortalezaAncla: 'tu capacidad de ordenar equipos', cuatroC: ['control'] },
          { texto: 'Tomar un café con dos personas que hicieron el cambio que estás considerando.', bloque: '20', tipo: 'pedido', fortalezaAncla: '', cuatroC: ['curiosidad'] },
          { texto: 'Ofrecerte para liderar la próxima retro del equipo.', bloque: '70', tipo: 'oferta', fortalezaAncla: 'tu capacidad de ordenar equipos', cuatroC: ['confianza'] },
        ],
        metrica: 'Haber tenido las dos conversaciones y poder nombrar qué aprendiste de cada una.',
        checkIn: 'Cada dos semanas, 15 minutos.',
        horizonte: '3 meses',
        preguntaAbierta: '¿Qué te dirías dentro de 3 meses si esta vez te moviste?',
      }
    case 'perfil':
      return {
        primeraImpresion: '— MODO DEMO — El perfil comunica experiencia técnica sólida, pero no queda claro hacia qué rol apunta.',
        fortalezas: [{ observacion: 'Muestra continuidad y profundidad en el área.', cita: '(cita textual del perfil)', fuente: 'CV' }],
        ausencias: [{ observacion: 'No aparecen resultados medibles de los proyectos que mencionás.', cita: '', fuente: '' }],
        consistenciaMarca: 'El titular y la experiencia apuntan a lugares distintos.',
        recomendaciones: [
          { cambio: 'Alinear el titular con el puesto al que apuntás.', porQue: 'Es lo primero que lee quien filtra.', cita: '(cita textual)', fuente: 'LinkedIn', tipo: 'mercado' },
          { cambio: 'Si querés, sumar una foto profesional.', porQue: 'Es convención de mercado, no un requisito: la decisión es tuya.', cita: '', tipo: 'decision_personal' },
        ],
        nota: 6,
        notaComunica: 'Tu perfil hoy comunica más "especialista técnico" que "candidato a liderar".',
      }
    case 'extraer':
      return { texto: '(Modo demo: el texto del CV aparecería acá.)' }
  }
}

/** Modo del pedido, para elegir la regla de rate limit antes de validar todo. */
export function coachMode(body: unknown): string | undefined {
  const mode = (body as { mode?: unknown } | null)?.mode
  return typeof mode === 'string' ? mode : undefined
}

export async function handleCoachRequest(body: unknown, apiKey: string | undefined): Promise<CoachResponse> {
  const req = validate(body)
  if (!req) return { status: 400, body: { error: 'Payload inválido' } }

  if (!apiKey) {
    if (req.mode === 'turno' || req.mode === 'informe') await new Promise((r) => setTimeout(r, 600))
    return { status: 200, body: { demo: true, data: runDemo(req) } }
  }

  try {
    return { status: 200, body: { data: await runWithGemini(apiKey, req) } }
  } catch (e) {
    const pub = publicError(e)
    logEvent('error', 'coach_upstream_error', { mode: req.mode, error: e instanceof Error ? e : String(e) })
    return { status: pub.status, body: { error: pub.message } }
  }
}
