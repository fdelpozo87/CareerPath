import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateJson } from './gemini.js'

// Flujo de Empresas: el prompt se arma acá, del lado del servidor. Antes el
// cliente mandaba el prompt completo, lo que convertía /api/analyze en un
// proxy abierto a Gemini (cualquiera podía usar la key con cualquier prompt).

type CaseType = 'rendimiento' | 'crecimiento'
type Answers = Record<string, string>

interface CollaboratorContext {
  rol: string
  seniority: string
  tiempo: string
  casoTipo: CaseType
}

export interface CompanyRequest {
  contexto: CollaboratorContext
  respuestas: Answers
  pdfBase64?: string
}

const ANSWER_IDS: Record<CaseType, string[]> = {
  rendimiento: ['observacion', 'contexto', 'conversaciones', 'objetivo'],
  crecimiento: ['aspiracion', 'brechaActual', 'oportunidades', 'alineacion'],
}
const MAX_FIELD = 200
const MAX_ANSWER = 4_000
const MAX_PDF_BASE64 = 4_000_000

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max

export function validateCompany(body: unknown): CompanyRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const { contexto, respuestas, pdfBase64 } = body as Record<string, unknown>
  if (typeof contexto !== 'object' || contexto === null) return null
  const c = contexto as Record<string, unknown>
  if (c.casoTipo !== 'rendimiento' && c.casoTipo !== 'crecimiento') return null
  if (!isStr(c.rol, MAX_FIELD) || !isStr(c.seniority, MAX_FIELD) || !isStr(c.tiempo, MAX_FIELD)) return null
  if (typeof respuestas !== 'object' || respuestas === null) return null
  const ids = ANSWER_IDS[c.casoTipo]
  const r = respuestas as Record<string, unknown>
  if (!Object.entries(r).every(([k, v]) => ids.includes(k) && isStr(v, MAX_ANSWER))) return null
  if (pdfBase64 !== undefined && !isStr(pdfBase64, MAX_PDF_BASE64)) return null
  return {
    contexto: { rol: c.rol, seniority: c.seniority, tiempo: c.tiempo, casoTipo: c.casoTipo },
    respuestas: r as Answers,
    pdfBase64: pdfBase64 as string | undefined,
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────────

function buildRendimientoPrompt(ctx: CollaboratorContext, answers: Answers, hasDoc: boolean): string {
  return `Sos un HR Coach y consultor de Desarrollo Organizacional con 20 años de experiencia en América Latina.

Tu rol es ayudar a líderes y responsables de RRHH a preparar conversaciones de feedback y gestionar situaciones de rendimiento. Aplicás el modelo GROW y la distinción Aptitud/Actitud para diagnosticar.

Un líder o profesional de RRHH consulta sobre un colaborador que está mostrando bajo rendimiento o cambio de comportamiento.

PERFIL DEL COLABORADOR:
- Rol: ${ctx.rol}
- Seniority: ${ctx.seniority}
- Tiempo en el equipo: ${ctx.tiempo}
${hasDoc ? '- Se adjuntó documentación adicional (evaluación de desempeño u otro)' : ''}

RESPUESTAS DEL LÍDER:
**Situación observada**: ${answers['observacion'] || '(sin respuesta)'}
**Contexto y timing**: ${answers['contexto'] || '(sin respuesta)'}
**Conversaciones previas**: ${answers['conversaciones'] || '(sin respuesta)'}
**Resultado que busca**: ${answers['objetivo'] || '(sin respuesta)'}

ANÁLISIS REQUERIDO:
- Clasificá la brecha: APTITUD (no sabe o no puede), ACTITUD (no quiere o no está motivado) o MIXTO
- Identificá si los síntomas apuntan a causas de negocio, equipo, personales o de liderazgo
- Las hipótesis deben ser preguntas abiertas, no veredictos sobre el colaborador
- La guía de conversación: qué decir para abrir, preguntas potentes, cómo cerrar con un acuerdo concreto
- El plan 70-20-10: 70% en el trabajo, 20% de otros, 10% formal
- Los próximos pasos son para EL LÍDER, no para el colaborador
- El mensaje al líder debe ser honesto — incluyendo su propio rol en la situación

Respondé ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "perfilDelColaborador": "2-3 oraciones sobre cómo se ve el colaborador desde lo que describió el líder",
  "situacionCentral": "La tensión o paradoja central de esta situación en 1-2 oraciones",
  "tipoDeBrecha": "Aptitud",
  "fortalezasDelColaborador": ["fortaleza observable 1", "fortaleza observable 2", "fortaleza observable 3"],
  "hipotesisPrincipales": ["¿Y si el problema real es...?", "hipótesis alternativa 2", "hipótesis 3"],
  "guiaDeConversacion": {
    "apertura": "Tono y frase de entrada para abrir la conversación desde la curiosidad, no el juicio",
    "preguntasClave": ["Pregunta para explorar qué está pasando desde la perspectiva del colaborador", "Pregunta sobre el contexto o el cambio", "Pregunta sobre lo que necesita", "Pregunta de compromiso bilateral"],
    "cierre": "Cómo cerrar la conversación con un acuerdo concreto y revisable"
  },
  "planDeAccion": {
    "bloque70": ["Acción en el trabajo 1", "Acción en el trabajo 2"],
    "bloque20": ["Interacción con otros 1", "Interacción con otros 2"],
    "bloque10": ["Formación o recurso formal sugerido"]
  },
  "proximosPasos": ["Paso concreto para el líder esta semana", "Paso 2 en los próximos 30 días"],
  "mensajeParaElLider": "Un párrafo honesto y directo al líder. Con al menos una pregunta que lo invite a reflexionar sobre su propio rol en esta situación."
}

tipoDeBrecha debe ser exactamente "Aptitud", "Actitud" o "Mixto". Usá vos. Sin frases corporativas vacías. SOLO el JSON.`
}

function buildCrecimientoPrompt(ctx: CollaboratorContext, answers: Answers, hasDoc: boolean): string {
  return `Sos un HR Coach y consultor de Desarrollo Organizacional con 20 años de experiencia en América Latina.

Tu rol es ayudar a líderes y RRHH a diseñar planes de desarrollo y preparar conversaciones de crecimiento de carrera. Aplicás el modelo 70-20-10 y el marco GROW.

Un líder o profesional de RRHH consulta sobre un colaborador que quiere crecer o cambiar de rol/área.

PERFIL DEL COLABORADOR:
- Rol: ${ctx.rol}
- Seniority: ${ctx.seniority}
- Tiempo en el equipo: ${ctx.tiempo}
${hasDoc ? '- Se adjuntó documentación adicional (evaluación de desempeño u otro)' : ''}

RESPUESTAS DEL LÍDER:
**Aspiración del colaborador**: ${answers['aspiracion'] || '(sin respuesta)'}
**Fortalezas y brecha actual**: ${answers['brechaActual'] || '(sin respuesta)'}
**Oportunidades disponibles**: ${answers['oportunidades'] || '(sin respuesta)'}
**Alineación con el negocio**: ${answers['alineacion'] || '(sin respuesta)'}

ANÁLISIS REQUERIDO:
- Clasificá si el caso es principalmente CRECIMIENTO (dentro del área) o MOVILIDAD (cambio de área/rol)
- Identificá fortalezas reales que el colaborador tiene pero no está valorando completamente
- Las hipótesis deben iluminar lo que el líder todavía no está viendo sobre la situación
- La guía de conversación es para una 1:1 de carrera: apertura, preguntas de exploración, cierre con plan bilateral
- El plan 70-20-10 debe ser concreto y ejecutable en los próximos 90 días
- Los próximos pasos son para EL LÍDER: qué hacer esta semana para activar el desarrollo
- El mensaje al líder debe reconocer la oportunidad y nombrar la complejidad real

Respondé ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "perfilDelColaborador": "2-3 oraciones sobre el potencial y el momento de carrera de este colaborador",
  "situacionCentral": "La oportunidad central y la tensión si la hay, en 1-2 oraciones",
  "tipoDeBrecha": "Crecimiento",
  "fortalezasDelColaborador": ["fortaleza que ya tiene 1", "fortaleza que ya tiene 2", "fortaleza que ya tiene 3"],
  "hipotesisPrincipales": ["¿Y si lo que realmente necesita este colaborador es...?", "hipótesis alternativa 2", "hipótesis 3"],
  "guiaDeConversacion": {
    "apertura": "Tono y frase de entrada para abrir la conversación de carrera desde el reconocimiento",
    "preguntasClave": ["Pregunta para explorar la aspiración real", "Pregunta sobre la brecha desde su perspectiva", "Pregunta sobre obstáculos reales", "Pregunta de compromiso y próximo paso"],
    "cierre": "Cómo cerrar con un plan co-construido y una fecha de revisión"
  },
  "planDeAccion": {
    "bloque70": ["Proyecto o responsabilidad que desarrolla la habilidad clave 1", "Proyecto o responsabilidad 2"],
    "bloque20": ["Mentoreo o exposición a personas clave 1", "Feedback estructurado o red interna/externa 2"],
    "bloque10": ["Formación formal o certificación sugerida"]
  },
  "proximosPasos": ["Paso concreto para el líder esta semana", "Paso 2 en los próximos 30 días"],
  "mensajeParaElLider": "Un párrafo honesto y motivador al líder. Con al menos una pregunta sobre qué puede hacer él/ella para acelerar este desarrollo."
}

tipoDeBrecha debe ser exactamente "Crecimiento" o "Movilidad". Usá vos. Sin frases corporativas vacías. SOLO el JSON.`
}

export async function runCompanyAnalysis(apiKey: string, req: CompanyRequest): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel(
    { model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', generationConfig: { responseMimeType: 'application/json', temperature: 0.5 } },
    { timeout: 45_000 },
  )
  const hasDoc = !!req.pdfBase64
  const prompt =
    req.contexto.casoTipo === 'rendimiento'
      ? buildRendimientoPrompt(req.contexto, req.respuestas, hasDoc)
      : buildCrecimientoPrompt(req.contexto, req.respuestas, hasDoc)
  const parts = [
    ...(req.pdfBase64 ? [{ inlineData: { mimeType: 'application/pdf', data: req.pdfBase64 } }] : []),
    { text: prompt },
  ]
  return generateJson(async () => (await model.generateContent(parts)).response.text())
}
