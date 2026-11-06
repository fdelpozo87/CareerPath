import type { GenerativeModel, GoogleGenerativeAI, ModelParams, RequestOptions } from '@google/generative-ai'
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
  const finishReason = response.candidates?.[0]?.finishReason
  if (text.includes('{') && finishReason && finishReason !== 'STOP') {
    logEvent('warn', 'gemini_corte', { where, finishReason, chars: text.length, outputTokens: response.usageMetadata?.candidatesTokenCount ?? -1, thoughtTokens: response.usageMetadata?.thoughtsTokenCount ?? -1 })
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

/**
 * Arregla las dos roturas más comunes de un JSON que escribe el modelo: saltos de línea sueltos dentro de un texto y
 * comillas sin escapar ("por ejemplo "esto" o "aquello""). Pasa cuando la respuesta trae ejemplos o enumeraciones.
 * No inventa ni completa nada: si el JSON está cortado sigue sin parsear.
 */
export function repairJson(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (!inString) {
      if (c === '"') inString = true
      out += c
      continue
    }
    if (c === '\\') {
      out += c + (text[i + 1] ?? '')
      i++
    } else if (c === '"') {
      const next = text.slice(i + 1).match(/^\s*(.)?/)?.[1]
      if (next === undefined || ',:}]'.includes(next)) {
        inString = false
        out += c
      } else {
        out += '\\"'
      }
    } else if (c === '\n') out += '\\n'
    else if (c === '\r') out += '\\r'
    else if (c === '\t') out += '\\t'
    else out += c
  }
  return out
}

export function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('La IA no devolvió una respuesta válida.')
  try {
    return JSON.parse(match[0]) as T
  } catch (err) {
    try {
      const fixed = JSON.parse(repairJson(match[0])) as T
      logEvent('warn', 'gemini_json_reparado')
      return fixed
    } catch {
      throw err
    }
  }
}

/** Respuesta sin JSON o con JSON cortado (el caso que la persona ve como "llegó incompleta"). */
export function isIncompleteResponse(err: unknown): boolean {
  return err instanceof SyntaxError || (err instanceof Error && err.message.startsWith('La IA no devolvió'))
}

function isTransient(err: unknown): boolean {
  if (isIncompleteResponse(err)) return true // sin JSON o JSON incompleto
  if (err instanceof Error && /timeout|aborted|fetch failed/i.test(err.message)) return true
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

/**
 * Un modelo que, si el principal falla por sobrecarga o timeout (429, 5xx), repite la misma llamada con el modelo de
 * respaldo de `GEMINI_FALLBACK_MODEL`. Sin esa variable (o igual al principal) es el modelo de siempre. Los errores que no
 * son transitorios (pedido inválido, bloqueo de seguridad) no se reintentan con otro modelo.
 */
export function resilientModel(genAI: GoogleGenerativeAI, params: ModelParams, options?: RequestOptions): Pick<GenerativeModel, 'generateContent'> {
  const primary = genAI.getGenerativeModel(params, options)
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim()
  if (!fallback || fallback === params.model) return primary
  return {
    generateContent: async (...args: Parameters<GenerativeModel['generateContent']>) => {
      try {
        return await primary.generateContent(...args)
      } catch (err) {
        if (!isTransient(err)) throw err
        logEvent('warn', 'gemini_fallback', { desde: params.model, hacia: fallback, error: err instanceof Error ? err : String(err) })
        return genAI.getGenerativeModel({ ...params, model: fallback }, options).generateContent(...args)
      }
    },
  }
}
