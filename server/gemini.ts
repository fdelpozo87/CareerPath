import { logEvent, upstreamStatus } from './guard.js'

// Anti-error para las llamadas a Gemini: reintenta una vez ante fallas
// transitorias (sobrecarga, timeout, JSON cortado) antes de rendirse.

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
