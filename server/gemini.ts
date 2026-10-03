import { logEvent, upstreamStatus } from './guard.js'

// Anti-error para las llamadas a Gemini: reintenta una vez ante fallas
// transitorias (sobrecarga, timeout, JSON cortado) antes de rendirse.

/** Lo mínimo que usamos de la respuesta del SDK (evita depender de sus tipos internos). */
interface GeminiResponse {
  text: () => string
  candidates?: { finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
}

// Devuelve el texto de la respuesta. Si no trae ningún JSON, deja en el log POR QUÉ
// (motivo de corte, bloqueo, tokens): sin esto un "la IA no devolvió nada" no se puede
// diagnosticar. Solo metadatos: nunca el contenido de la conversación.
export function responseText(response: GeminiResponse, where: string): string {
  let text = ''
  try {
    text = response.text()
  } catch {
    // Respuesta bloqueada: el SDK lanza al pedir el texto. Se registra abajo.
  }
  if (!text.includes('{')) {
    logEvent('warn', 'gemini_sin_json', {
      where,
      finishReason: response.candidates?.[0]?.finishReason ?? 'desconocido',
      blockReason: response.promptFeedback?.blockReason ?? 'ninguno',
      chars: text.length,
      promptTokens: response.usageMetadata?.promptTokenCount ?? -1,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? -1,
      thoughtTokens: response.usageMetadata?.thoughtsTokenCount ?? -1,
    })
  }
  return text
}

const TRANSIENT = new Set([429, 500, 502, 503, 504])

export function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('La IA no devolvió una respuesta válida.')
  return JSON.parse(match[0]) as T
}

function isTransient(err: unknown): boolean {
  if (err instanceof SyntaxError) return true // JSON incompleto
  if (err instanceof Error && (err.message.startsWith('La IA no devolvió') || /timeout|aborted|fetch failed/i.test(err.message))) {
    return true
  }
  const status = upstreamStatus(err)
  return status !== undefined && TRANSIENT.has(status)
}

export async function generateJson<T = unknown>(run: () => Promise<string>, attempts = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return parseJson<T>(await run())
    } catch (err) {
      lastErr = err
      if (i === attempts - 1 || !isTransient(err)) break
      logEvent('warn', 'gemini_retry', { attempt: i + 1, error: err instanceof Error ? err : String(err) })
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw lastErr
}
