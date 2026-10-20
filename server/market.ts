import type { GoogleGenerativeAI } from '@google/generative-ai'
import type { Lang } from '../shared/i18n.js'

// Datos de mercado con fuente. El coach no conoce cifras de demanda, sueldos ni costos por su
// cuenta: cuando hacen falta, el servidor hace una búsqueda web (Google Search de Gemini) y le
// entrega el resultado junto con las fuentes, para que las cite y la persona pueda verificarlas.

export interface MarketSource {
  titulo: string
  url: string
}

export interface MarketData {
  texto: string
  fuentes: MarketSource[]
  /** AAAA-MM-DD en que se consultó. */
  fecha: string
}

/** Cuántas búsquedas se permiten por conversación (cada una es una llamada más al modelo). */
export const MAX_MARKET_PER_CONVERSATION = 6
const MAX_QUERY = 200
const MAX_SOURCES = 4

interface Grounding {
  groundingChunks?: { web?: { uri?: string; title?: string } }[]
}

/** Solo se enlazan fuentes https: el contenido viene de una búsqueda y no se confía en él. */
export function cleanSources(grounding: Grounding | undefined): MarketSource[] {
  const seen = new Set<string>()
  const out: MarketSource[] = []
  for (const chunk of grounding?.groundingChunks ?? []) {
    const url = chunk.web?.uri
    const titulo = (chunk.web?.title ?? '').trim().slice(0, 80)
    if (!url || !titulo || !/^https:\/\//i.test(url) || seen.has(titulo)) continue
    seen.add(titulo)
    out.push({ titulo, url })
    if (out.length === MAX_SOURCES) break
  }
  return out
}

export async function fetchMarketData(genAI: GoogleGenerativeAI, modelName: string, consulta: string, lang: Lang): Promise<MarketData | null> {
  const query = consulta.trim().slice(0, MAX_QUERY)
  if (!query) return null
  // `googleSearch` todavía no figura en los tipos de la librería, pero el servicio lo acepta.
  const model = genAI.getGenerativeModel(
    { model: modelName, tools: [{ googleSearch: {} }] as never, generationConfig: { temperature: 0.2 } },
    { timeout: 45_000 },
  )
  const idioma = lang === 'en' ? 'English' : 'español neutro latinoamericano'
  const prompt = `Busca datos actuales y concretos sobre: "${query}".
Responde en ${idioma}, en un máximo de 5 oraciones. Incluye cifras con su moneda y el período al que corresponden (mes y año) cuando existan; si las fuentes difieren, da el rango. No inventes: si no encuentras algo confiable, dilo. Solo datos, sin consejos ni recomendaciones.`
  const result = await model.generateContent(prompt)
  const texto = result.response.text().trim()
  const fuentes = cleanSources((result.response.candidates?.[0] as { groundingMetadata?: Grounding } | undefined)?.groundingMetadata)
  // Sin fuentes no hay dato que citar: es mejor decir que no se pudo que pasar texto sin respaldo.
  if (!texto || fuentes.length === 0) return null
  return { texto: texto.slice(0, 1500), fuentes, fecha: new Date().toISOString().slice(0, 10) }
}
