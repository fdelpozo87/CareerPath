import type { Lang } from '../shared/i18n.js'
import { languageSection } from './prompts.js'

// Evaluaciones de desempeño. El producto no puntúa a nadie: ayuda a quien evalúa a armar una evaluación con
// preguntas sobre hechos observables y, después, a leer la autoevaluación con la evidencia delante.

export interface Competencia {
  id: string
  nombre: string
  descripcion: string
  preguntas: string[]
}

export const NIVELES = ['Aún no', 'En desarrollo', 'Sólido', 'Referente'] as const

const TEMAS_PROHIBIDOS =
  'edad, género, estado civil, hijos o embarazo, salud o discapacidad, religión, ideas políticas, afiliación sindical, nacionalidad, origen étnico, orientación sexual y vida privada'

export interface GenerateInput {
  area: string
  rol: string
  periodo: string
  foco?: string
  /** Borrador actual y el cambio que se pidió sobre él. */
  previa?: { titulo: string; competencias: Competencia[] }
  ajuste?: string
  lang: Lang
}

export function buildGeneratePrompt(i: GenerateInput): string {
  return `Eres Bivio y ayudas a armar una evaluación de desempeño que la propia persona evaluada va a responder (autoevaluación). Tu trabajo es proponer las competencias y las preguntas; NO evalúas a nadie ni pones notas.

${languageSection(i.lang)}

Contexto: área "${i.area}"${i.rol ? `, rol "${i.rol}"` : ''}${i.periodo ? `, período evaluado "${i.periodo}"` : ''}.${i.foco ? `\nLo que quien crea la evaluación quiere mirar: "${i.foco}".` : ''}

Reglas:
- Entre 4 y 6 competencias propias de esa área y ese rol (por ejemplo: resultados, calidad del trabajo, colaboración, comunicación, autonomía, aprendizaje, y una específica del área). Cada una con "nombre" (2 a 5 palabras) y "descripcion" (una o dos oraciones sobre qué se observa).
- Cada competencia lleva de 2 a 3 "preguntas", escritas en segunda persona ("tú"), que piden ejemplos concretos y observables: qué situación hubo, qué hiciste y qué efecto tuvo. Nunca preguntes por rasgos de personalidad ni por opiniones generales ("¿eres proactivo/a?").
- Lenguaje neutro y respetuoso, sin adjetivos con género.
- PROHIBIDO preguntar o aludir a: ${TEMAS_PROHIBIDOS}. Una evaluación de desempeño solo trata sobre el trabajo.
- "titulo": corto y descriptivo (por ejemplo "Evaluación de desempeño · Ventas · 2026").
${
  i.previa
    ? `- Hay un borrador. Aplica SOLO este cambio y conserva todo lo demás tal como está: "${i.ajuste ?? ''}".\n\nBorrador actual:\n${JSON.stringify(i.previa)}`
    : ''
}

Responde SOLO con JSON:
{
  "titulo": "",
  "competencias": [{ "nombre": "", "descripcion": "", "preguntas": [""] }]
}`
}

export interface ReportInput {
  titulo: string
  area: string
  rol: string
  periodo: string
  competencias: Competencia[]
  respuestas: Record<string, { nivel?: number; evidencia?: string } | string | undefined>
  lang: Lang
}

export function buildReportPrompt(i: ReportInput): string {
  const bloques = i.competencias
    .map((c) => {
      const r = i.respuestas[c.id] as { nivel?: number; evidencia?: string } | undefined
      const nivel = r?.nivel ? `${r.nivel} (${NIVELES[r.nivel - 1]})` : 'sin nivel'
      return `## ${c.nombre} [id: ${c.id}]\n${c.descripcion}\nNivel que se asignó la persona: ${nivel}\nEvidencia que escribió: ${r?.evidencia ?? '(vacía)'}`
    })
    .join('\n\n')
  const desarrollo = typeof i.respuestas.desarrollo === 'string' ? i.respuestas.desarrollo : ''

  return `Eres Bivio. Una persona completó su autoevaluación de desempeño. Armas el informe que van a leer ella y quien le asignó la evaluación, para preparar una buena conversación. No evalúas a la persona, no le pones nota ni emites un veredicto: ordenas lo que ella misma escribió.

${languageSection(i.lang)}

Evaluación: "${i.titulo}" · área "${i.area}"${i.rol ? ` · rol "${i.rol}"` : ''}${i.periodo ? ` · período "${i.periodo}"` : ''}.
Escala que usó la persona: 1 Aún no, 2 En desarrollo, 3 Sólido, 4 Referente.

${bloques}

Lo que dijo que quiere desarrollar: ${desarrollo || '(no lo indicó)'}

Reglas:
- Todo sale de lo que la persona escribió. No agregues logros, hechos, rasgos ni conclusiones que no estén ahí.
- Cada fortaleza y cada punto de desarrollo cita una frase de su evidencia ("evidencia", copiada textual o muy cercana). Si una competencia no tiene evidencia, no la presentes como fortaleza.
- "coherencia": solo cuando el nivel que se asignó y la evidencia que escribió no se corresponden (nivel alto con evidencia vaga, o nivel bajo con evidencia sólida). Redáctalo como una invitación a revisarlo ("¿Cómo llegaste a este nivel?"), nunca como un juicio. Si todo es coherente, va vacío.
- "planDesarrollo": de 2 a 4 acciones concretas basadas en lo que ella dijo que quiere desarrollar y en los puntos de desarrollo. Cada una con "bloque" ("70" práctica en el trabajo, "20" aprender con otras personas, "10" formación) y "plazo" (un plazo razonable, por ejemplo "en las próximas 3 semanas").
- "preguntasParaConversar": de 3 a 5 preguntas abiertas para la conversación entre ambas personas. Empiezan por escuchar a la persona, no por corregirla.
- Lenguaje neutro, sin adjetivos con género y sin etiquetas de personalidad. No menciones ninguno de estos temas aunque aparezcan: ${TEMAS_PROHIBIDOS}.
- Sin puntajes totales, sin promedios, sin comparaciones con otras personas.

Responde SOLO con JSON:
{
  "resumen": "3 a 4 oraciones",
  "fortalezas": [{ "competencia": "", "texto": "", "evidencia": "" }],
  "desarrollo": [{ "competencia": "", "texto": "", "evidencia": "" }],
  "coherencia": [{ "competencia": "", "nota": "" }],
  "planDesarrollo": [{ "texto": "", "bloque": "70", "plazo": "" }],
  "preguntasParaConversar": [""]
}`
}
