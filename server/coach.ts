import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import {
  objectivesFor,
  EXTRACT_PROMPT,
  buildProfilePrompt,
  buildReportPrompt,
  buildTurnSystemPrompt,
  type Path,
  type Stage,
} from './prompts.js'
import { DEFAULT_LANG, isLang, translate, type Lang } from '../shared/i18n.js'
import { MAX_OMITIDOS_POR_ETAPA, objectiveLabel, type SynthesisItem } from '../shared/stages.js'
import { generateJson, responseText } from './gemini.js'
import { neutralizeGender, wrongLanguage } from './lang.js'
import { logEvent, publicError } from './guard.js'
import { MAX_MARKET_PER_CONVERSATION, fetchMarketData, looksLikeMarketQuestion, type MarketData, type MarketSource } from './market.js'

// Lógica compartida del agente conversacional. La usan api/coach.ts (Vercel)
// y el middleware de desarrollo en vite.config.ts. La API key y el system
// prompt viven solo aquí: el cliente manda el historial y recibe el turno.

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
  /** Si este turno usó datos de mercado: de dónde salieron y cuándo se consultaron. */
  fuentes?: MarketSource[]
  fechaDatos?: string
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
      /** Idioma de la respuesta (el de la interfaz). */
      lang?: Lang
    }
  | {
      mode: 'informe'
      path: Path
      history: ChatMessage[]
      sintesisPrevias: Partial<Record<Stage, string>>
      documentos?: string
      lecturaPerfil?: string
      lang?: Lang
    }
  | { mode: 'perfil'; puesto: string; perfilTexto: string; lang?: Lang }
  | { mode: 'extraer'; pdfBase64: string }

export type CoachResponse = { status: number; body: unknown }

const STAGES: Stage[] = ['diagnostico', 'discovery', 'plan']
const PATHS: Path[] = ['quiebre', 'perfil', 'formacion']
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
        optStr(b.lecturaPerfil, MAX_CONTEXT) &&
        (b.lang === undefined || isLang(b.lang))
      )
        return b as CoachRequest
      return null
    case 'informe':
      if (
        PATHS.includes(b.path as Path) &&
        isHistory(b.history) &&
        isSintesis(b.sintesisPrevias) &&
        optStr(b.documentos, MAX_CONTEXT) &&
        optStr(b.lecturaPerfil, MAX_CONTEXT) &&
        (b.lang === undefined || isLang(b.lang))
      )
        return b as CoachRequest
      return null
    case 'perfil':
      if (isStr(b.puesto, 200) && (b.puesto as string).trim() && isStr(b.perfilTexto, MAX_CONTEXT) && (b.perfilTexto as string).trim().length >= 80 && (b.lang === undefined || isLang(b.lang)))
        return b as CoachRequest
      return null
    case 'extraer':
      if (isStr(b.pdfBase64, MAX_PDF_BASE64) && (b.pdfBase64 as string).length > 0) return b as CoachRequest
      return null
    default:
      return null
  }
}

function toContents(history: ChatMessage[], lang: Lang, extra = ''): Content[] {
  const contents: Content[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
  // El historial puede estar en otro idioma (la persona cambió el idioma de la interfaz a mitad de la
  // charla) y el modelo tiende a seguir al historial: una nota en el último mensaje fija el idioma.
  const last = contents.at(-1)
  if (last && last.role === 'user') last.parts = [{ text: `${last.parts[0].text}\n\n${translate(lang, 'srv.langNote')}${extra ? `\n${extra}` : ''}` }]
  return contents
}

/**
 * Cuántas veces el coach ya preguntó por cada tema que sigue pendiente. Se lee de los propios
 * turnos del coach (cada uno declara su "temaEnFoco") y se le devuelve al modelo: así puede notar
 * que la persona esquiva un tema y decidir cómo retomarlo, en lugar de abandonarlo o repetirse.
 */
export function askCounts(history: ChatMessage[], stage: Stage, cubiertos: string[], omitidos: string[] = [], path: Path = 'quiebre'): Record<string, number> {
  const pending = objectivesFor(stage, path).map((o) => o.id).filter((id) => !cubiertos.includes(id) && !omitidos.includes(id))
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

// La pregunta de cierre de cada etapa: corta y sin resumen (el resumen es el mapa de pantalla).
const ASKS_TO_ADJUST: Record<Lang, RegExp> = { es: /ajust|sumar|agreg|modific|cambiar algo/i, en: /adjust|add|change|edit|anything/i }

/** ¿El último turno del coach ya tenía todos los temas cubiertos u omitidos? (o sea, ya hizo la pregunta de cierre) */
function previousTurnWasComplete(history: ChatMessage[], valid: string[]): boolean {
  const last = [...history].reverse().find((m) => m.role === 'model')
  if (!last) return false
  try {
    const t = JSON.parse(last.text) as { objetivosCubiertos?: unknown; temasOmitidos?: unknown }
    const done = new Set<string>([
      ...(Array.isArray(t.objetivosCubiertos) ? t.objetivosCubiertos : []),
      ...(Array.isArray(t.temasOmitidos) ? t.temasOmitidos : []),
    ].filter((x): x is string => typeof x === 'string'))
    return valid.every((id) => done.has(id))
  } catch {
    return false // turno sin JSON (sesión vieja): se trata como que todavía no preguntó
  }
}

const MAP_WORD: Record<Lang, RegExp> = { es: /\bmapa\b/i, en: /\bmap\b/i }

/**
 * Mientras falte un tema obligatorio la etapa no puede cerrar: no hay mapa que prometer. Si el
 * modelo igual lo promete ("te dejo armado tu mapa"), se saca esa frase para que la persona no
 * espere algo que no va a aparecer; si no queda nada, se dice la verdad con calidez.
 */
function withoutMapPromise(mensaje: string, pendingLabel: string, lang: Lang): string {
  const sentences = mensaje.split(/(?<=[.!?…])\s+/)
  const kept = sentences.filter((sentence) => !MAP_WORD[lang].test(sentence))
  if (kept.length === sentences.length) return mensaje
  const rest = kept.join(' ').trim()
  if (rest.length >= 20) return rest
  return translate(lang, 'srv.noMapPromise', { topic: pendingLabel })
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
function cleanItems(raw: unknown, stage: Stage, userText: string, path: Path): SynthesisItem[] {
  if (!Array.isArray(raw)) return []
  const order = objectivesFor(stage, path).map((o) => o.id)
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
  path: Path = 'quiebre',
  lang: Lang = DEFAULT_LANG,
): TurnResult {
  const objetivos = objectivesFor(stage, path)
  const valid = objetivos.map((o) => o.id)
  const omitibles = new Set(objetivos.filter((o) => o.omitible).map((o) => o.id))
  const cubiertos = Array.from(
    new Set([...prevCubiertos, ...(Array.isArray(raw.objetivosCubiertos) ? raw.objetivosCubiertos : [])]),
  ).filter((id) => valid.includes(id))

  // Temas que la persona eligió dejar para más adelante. El servidor no se fía del modelo:
  // solo vale si el tema se puede dejar, la persona ya tuvo la oportunidad de contestarlo (se
  // preguntó al menos una vez), no se pasa del tope por etapa, y no cuenta como cubierto.
  const asked = askCounts(history, stage, cubiertos, prevOmitidos, path)
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
  // El cierre es en dos pasos: primero la pregunta corta de ajuste (con todos los temas ya cubiertos)
  // y recién después, con la respuesta de la persona, el mapa. El modelo a veces lo junta en un solo
  // turno y deja el mapa vacío: el servidor no lo permite.
  const preguntaDeCierrePendiente = completos && !etapaCerrada && !previousTurnWasComplete(history, valid)
  const listo = completos && (Boolean(raw.listoParaAvanzar) || etapaCerrada) && !preguntaDeCierrePendiente

  const userText = fold(history.filter((m) => m.role === 'user' && !m.text.startsWith('(')).map((m) => m.text).join(' \n '))
  const modelItems = listo ? cleanItems(raw.sintesisItems, stage, userText, path).filter((i) => !omitidos.includes(i.id)) : []
  // Los temas omitidos aparecen en el mapa como lo que son: "para más adelante". Solo si el turno
  // trae un mapa nuevo: si no, el cliente conserva el anterior.
  const dejados: SynthesisItem[] =
    modelItems.length > 0
      ? omitidos.map((id) => ({ id, texto: translate(lang, 'map.later'), cita: '', omitido: true }))
      : []
  const items = [...modelItems, ...dejados].sort((x, y) => valid.indexOf(x.id) - valid.indexOf(y.id))

  const rawSintesis = typeof raw.sintesisEtapa === 'string' ? raw.sintesisEtapa.trim() : ''
  // Si el modelo omitió el resumen en prosa pero armó el mapa, se compone desde el mapa:
  // las etapas siguientes lo usan como contexto.
  let sintesis = rawSintesis || modelItems.map((i) => i.texto).join(' ')
  if (listo && sintesis && omitidos.length > 0) {
    const nombres = omitidos.map((id) => objectiveLabel(id, lang).toLowerCase()).join(', ')
    sintesis += ` ${translate(lang, 'srv.leftLater', { topics: nombres })}`
  }

  // El tema en foco solo vale si es de esta etapa y sigue pendiente; al cerrar no hay ninguno.
  const foco =
    !listo && typeof raw.temaEnFoco === 'string' && valid.includes(raw.temaEnFoco) && !cubiertos.includes(raw.temaEnFoco) && !omitidos.includes(raw.temaEnFoco)
      ? raw.temaEnFoco
      : ''

  let mensaje =
    typeof raw.mensaje === 'string' && raw.mensaje.trim()
      ? raw.mensaje.trim()
      : listo
        ? translate(lang, 'srv.fallback.closing')
        : translate(lang, 'srv.fallback.more')
  if (preguntaDeCierrePendiente && !(ASKS_TO_ADJUST[lang].test(mensaje) && mensaje.includes('?'))) {
    // Se conserva lo que haya dicho para reconocer a la persona, sin sus preguntas ni resúmenes, y se pregunta.
    const ack = mensaje
      .split(/(?<=[.!?…])\s+/)
      .filter((sentence) => !sentence.trim().endsWith('?') && !MAP_WORD[lang].test(sentence))
      .slice(0, 1)
      .join(' ')
      .trim()
    mensaje = `${ack ? `${ack} ` : ''}${translate(lang, 'srv.close.question')}`
  }
  if (!completos) {
    // Mientras falte un tema no hay mapa que prometer. Se nombra primero el tema por el que más veces se preguntó.
    const pendientes = valid.filter((id) => !cubiertos.includes(id) && !omitidos.includes(id))
    const masPreguntado = [...pendientes].sort((x, y) => (asked[y] ?? 0) - (asked[x] ?? 0))[0]
    const label = masPreguntado ? objectiveLabel(masPreguntado, lang) : translate(lang, 'srv.fallback.topic')
    mensaje = withoutMapPromise(mensaje, label, lang)
  }

  return {
    temaEnFoco: foco,
    temasOmitidos: omitidos,
    mensaje,
    objetivosCubiertos: cubiertos,
    listoParaAvanzar: listo,
    derivacion: Boolean(raw.derivacion),
    sintesisEtapa: listo ? sintesis : '',
    sintesisItems: items,
    preguntaPuente: listo && typeof raw.preguntaPuente === 'string' ? raw.preguntaPuente.trim().slice(0, MAX_BRIDGE) : '',
  }
}

/** Cuántos turnos del coach de esta conversación ya usaron datos de mercado (los marca el campo "fuentes"). */
export function marketSearches(history: ChatMessage[]): number {
  let n = 0
  for (const m of history) {
    if (m.role !== 'model') continue
    try {
      const fuentes = (JSON.parse(m.text) as { fuentes?: unknown }).fuentes
      if (Array.isArray(fuentes) && fuentes.length > 0) n++
    } catch {
      // Turno sin JSON (sesiones viejas): no cuenta.
    }
  }
  return n
}

async function runWithGemini(apiKey: string, req: CoachRequest, lang: Lang): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const generationConfig = { responseMimeType: 'application/json', temperature: 0.6 }
  const requestOptions = { timeout: 45_000 }

  switch (req.mode) {
    case 'turno': {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildTurnSystemPrompt({ ...req, lang, intentos: askCounts(req.history, req.stage, req.cubiertos, req.omitidos, req.path) }),
        generationConfig,
      }, requestOptions)
      const run = (extra = '') =>
        generateJson<Partial<TurnResult> & { consultaMercado?: unknown }>(async () =>
          responseText((await model.generateContent({ contents: toContents(req.history, lang, extra) })).response, 'turno'),
        )
      let raw = await run()
      // Salió en el idioma equivocado (suele pasar si el historial está en el otro idioma): una segunda vez, con más énfasis.
      // Si la persona misma está escribiendo en el otro idioma, el coach le contesta en el suyo y no se reintenta.
      const lastUser = [...req.history].reverse().find((m) => m.role === 'user')?.text ?? ''
      if (typeof raw.mensaje === 'string' && wrongLanguage(raw.mensaje, lang) && !wrongLanguage(lastUser, lang)) {
        logEvent('warn', 'coach_idioma_equivocado', { lang })
        raw = await run(translate(lang, 'srv.langRetry'))
      }
      // El coach pidió datos de mercado: se busca con fuente y se le vuelve a pedir el turno con el resultado.
      let consulta = typeof raw.consultaMercado === 'string' ? raw.consultaMercado.trim() : ''
      // Si la persona preguntó por sueldos o costos y el modelo no pidió la búsqueda, se le vuelve a pedir una vez.
      if (!consulta && looksLikeMarketQuestion(lastUser) && marketSearches(req.history) < MAX_MARKET_PER_CONVERSATION) {
        raw = await run(translate(lang, 'srv.market.force'))
        consulta = typeof raw.consultaMercado === 'string' ? raw.consultaMercado.trim() : ''
      }
      let market: MarketData | null = null
      if (consulta) {
        let note: string
        if (marketSearches(req.history) >= MAX_MARKET_PER_CONVERSATION) {
          note = translate(lang, 'srv.market.limit')
        } else {
          market = await fetchMarketData(genAI, modelName, consulta, lang).catch((e) => {
            logEvent('warn', 'coach_mercado_error', { error: e instanceof Error ? e : String(e) })
            return null
          })
          note = market
            ? translate(lang, 'srv.market.ok', { date: market.fecha, text: market.texto, sources: market.fuentes.map((f) => f.titulo).join(', ') })
            : translate(lang, 'srv.market.none')
        }
        logEvent('info', 'coach_mercado', { ok: Boolean(market) })
        try {
          raw = await run(note)
        } catch (e) {
          // Si el modelo no logra responder con los datos, se responde sin ellos antes que fallar el turno.
          if (!market) throw e
          logEvent('warn', 'coach_mercado_reintento', { error: e instanceof Error ? e : String(e) })
          market = null
          raw = await run(translate(lang, 'srv.market.none'))
        }
      }
      const turn = normalizeTurn(raw, req.stage, req.cubiertos, req.history, req.etapaCerrada, req.omitidos, req.path, lang)
      const clean = { ...turn, mensaje: neutralizeGender(turn.mensaje, lang) }
      return market ? { ...clean, fuentes: market.fuentes, fechaDatos: market.fecha } : clean
    }
    case 'informe': {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildReportPrompt({ ...req, lang }),
        generationConfig: { ...generationConfig, temperature: 0.3 },
      }, requestOptions)
      const contents = toContents(req.history, lang)
      contents.push({ role: 'user', parts: [{ text: `${translate(lang, 'srv.reportEnd')}\n${translate(lang, 'srv.langNote')}` }] })
      const informe = await generateJson<Record<string, unknown>>(async () => responseText((await model.generateContent({ contents })).response, 'informe'))
      return normalizeReport(informe)
    }
    case 'perfil': {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { ...generationConfig, temperature: 0.3 } }, requestOptions)
      const reading = await generateJson<Record<string, unknown>>(async () =>
        (
          await model.generateContent([
            { text: `PERFIL:\n"""\n${req.perfilTexto}\n"""` },
            { text: buildProfilePrompt(req.puesto, lang) },
          ])
        ).response.text(),
      )
      return normalizeReading(reading)
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
    '— MODO DEMO — Cuéntame con tus palabras: ¿qué te gustaría que cambie a partir de esta conversación?',
    'Gracias. ¿Qué pasó concretamente la última vez que sentiste ese freno? Me interesa el hecho, no tanto la conclusión.',
    'Si hoy te imaginaras más de un camino posible, ¿cuáles aparecerían?',
    '¿Qué intentaste hasta ahora para moverte, y qué tan dispuesto/a te sientes a hacer algo distinto?',
  ],
  discovery: [
    '— MODO DEMO — Mirando lo que dijiste en el Diagnóstico, ¿cómo describirías hoy el obstáculo principal, con los datos que tienes?',
    'Cuéntame dos escenarios posibles para los próximos meses, como si fueran dos historias distintas.',
    'En cada escenario, ¿qué te da más control, curiosidad o confianza, y qué te preocupa?',
  ],
  plan: [
    '— MODO DEMO — De todo lo que exploraste, ¿qué objetivo de desarrollo eliges trabajar?',
    '¿En qué plazo quieres verlo en movimiento?',
    'Antes nombraste una fortaleza tuya. ¿Qué acción concreta podrías apoyar en ella?',
    '¿A quién le podrías pedir algo concreto para avanzar, qué le pedirías y para cuándo?',
    '¿Cómo vas a saber que avanzas, y cada cuánto quieres revisarlo?',
  ],
}

const DEMO_QUESTIONS_C: Record<Stage, string[]> = {
  diagnostico: [
    '— MODO DEMO — Cuéntame con tus palabras: ¿qué te gustaría lograr con una formación?',
    '¿Cómo es tu situación hoy: trabajas, estudiaste antes, qué tiempo tienes?',
    '¿Qué opciones de formación ya estás mirando, si es que hay alguna?',
    '¿Cuánto tiempo por semana y cuánto dinero, aproximado, podrías dedicarle?',
  ],
  discovery: [
    '— MODO DEMO — ¿Qué temas o actividades te dan energía? Cuéntame un ejemplo concreto.',
    '¿Qué se te da bien, o qué aprendiste con facilidad?',
    'Si tuvieras que comparar opciones, ¿qué 3 criterios usarías, de más a menos importante?',
  ],
  plan: [
    '— MODO DEMO — De todo lo que viste, ¿qué opción eliges explorar primero?',
    '¿En qué plazo quieres decidir o empezar?',
    '¿Cuánto tiempo y dinero le vas a asignar?',
    '¿Cuál sería tu primer paso concreto, con quién o dónde y para cuándo?',
    'Si esa opción no funciona, ¿cuál sería tu plan B?',
  ],
}

function demoTurn(req: Extract<CoachRequest, { mode: 'turno' }>): TurnResult {
  const ids = objectivesFor(req.stage, req.path).map((o) => o.id)
  const lastModel = [...req.history].reverse().find((m) => m.role === 'model')?.text ?? ''
  const askedSummary = lastModel.includes('antes de que te arme el mapa')
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
      sintesisEtapa: 'Síntesis de demo: aquí aparece un resumen en segunda persona, con tus propias palabras entre comillas.',
      sintesisItems: ids.map((id) => ({
        id,
        texto: 'Aquí aparece, en una o dos oraciones, lo que dijiste sobre este tema, con tus palabras.',
        cita: '',
      })),
      preguntaPuente: '— MODO DEMO — ¿Qué te gustaría descubrir en la próxima etapa?',
    }
  }
  if (cubiertos.length === ids.length) {
    return {
      mensaje: '— MODO DEMO — ¿Hay algo que quieras ajustar o sumar antes de que te arme el mapa?',
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
    mensaje: (req.path === 'formacion' ? DEMO_QUESTIONS_C : DEMO_QUESTIONS)[req.stage][cubiertos.length],
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

/** Deja `faltaParaCompletar` como una lista corta de textos (el modelo a veces manda otra cosa). */
export function normalizeReport(raw: Record<string, unknown>): Record<string, unknown> {
  const falta = (Array.isArray(raw.faltaParaCompletar) ? raw.faltaParaCompletar : [])
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 240))
    .slice(0, 4)
  return { ...raw, faltaParaCompletar: falta }
}

const SIGNAL_STATES = ['entiende', 'insinua', 'ausente']

/**
 * Deja la lectura de perfil con la forma que espera la pantalla: sin nota ni puntaje (el producto
 * promete "no es un test"), con entre 0 y 5 señales de estado válido.
 */
export function normalizeReading(raw: Record<string, unknown>): Record<string, unknown> {
  const { notaComunica, ...rest } = raw
  delete (rest as Record<string, unknown>).nota
  const senales = (Array.isArray(raw.senales) ? raw.senales : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && SIGNAL_STATES.includes(String((s as Record<string, unknown>).estado)))
    .slice(0, 5)
    .map((s) => ({
      tema: String(s.tema ?? '').slice(0, 80),
      estado: String(s.estado),
      comentario: String(s.comentario ?? '').slice(0, 300),
      cita: String(s.cita ?? '').slice(0, 300),
    }))
    .filter((s) => s.tema)
  const comunicaHoy = typeof raw.comunicaHoy === 'string' && raw.comunicaHoy ? raw.comunicaHoy : typeof notaComunica === 'string' ? notaComunica : ''
  return { ...rest, senales, comunicaHoy }
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
        faltaParaCompletar: ['Algo para aprender: todavía no apareció ninguna lectura, curso o práctica.', 'Un plan B por si esto no sale.'],
        preguntaAbierta: '¿Qué te dirías dentro de 3 meses si esta vez te moviste?',
      }
    case 'perfil':
      return {
        primeraImpresion: '— MODO DEMO — El perfil comunica experiencia técnica sólida, pero no queda claro hacia qué rol apunta.',
        fortalezas: [{ observacion: 'Muestra continuidad y profundidad en el área.', cita: '(cita textual del perfil)', fuente: 'CV' }],
        ausencias: [{ observacion: 'No aparecen resultados medibles de los proyectos que mencionas.', cita: '', fuente: '' }],
        consistenciaMarca: 'El titular y la experiencia apuntan a lugares distintos.',
        recomendaciones: [
          { cambio: 'Alinear el titular con el puesto al que apuntas.', porQue: 'Es lo primero que lee quien filtra.', cita: '(cita textual)', fuente: 'LinkedIn', tipo: 'mercado' },
          { cambio: 'Si quieres, sumar una foto profesional.', porQue: 'Es convención de mercado, no un requisito: la decisión es tuya.', cita: '', tipo: 'decision_personal' },
        ],
        senales: [
          { tema: 'Rol al que apuntas', estado: 'insinua', comentario: 'Se intuye, pero el titular no lo dice.', cita: '' },
          { tema: 'Resultados medibles', estado: 'ausente', comentario: 'No aparecen cifras ni impacto.', cita: '' },
        ],
        comunicaHoy: 'Tu perfil hoy comunica más "especialista técnico" que "líder de equipo".',
      }
    case 'extraer':
      return { texto: '(Modo demo: el texto del CV aparecería aquí.)' }
  }
}

/** Modo del pedido, para elegir la regla de rate limit antes de validar todo. */
export function coachMode(body: unknown): string | undefined {
  const mode = (body as { mode?: unknown } | null)?.mode
  return typeof mode === 'string' ? mode : undefined
}

export async function handleCoachRequest(body: unknown, apiKey: string | undefined, headerLang: Lang = DEFAULT_LANG): Promise<CoachResponse> {
  const req = validate(body)
  if (!req) return { status: 400, body: { error: translate(headerLang, 'srv.badPayload') } }
  // El idioma del pedido manda; si no viene, el del header (el de la interfaz).
  const lang: Lang = ('lang' in req && req.lang) || headerLang

  if (!apiKey) {
    if (req.mode === 'turno' || req.mode === 'informe') await new Promise((r) => setTimeout(r, 600))
    return { status: 200, body: { demo: true, data: runDemo(req) } }
  }

  try {
    return { status: 200, body: { data: await runWithGemini(apiKey, req, lang) } }
  } catch (e) {
    const pub = publicError(e, lang)
    logEvent('error', 'coach_upstream_error', { mode: req.mode, error: e instanceof Error ? e : String(e) })
    return { status: pub.status, body: { error: pub.message } }
  }
}
