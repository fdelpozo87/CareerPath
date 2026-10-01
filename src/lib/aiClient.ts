// Cliente HTTP compartido para /api/*. La API key de Gemini vive solo en el
// servidor: acá nunca viajan prompts ni secretos, solo los datos del flujo.

import { ACCESS_LOST_EVENT, clearAccessCode, getAccessCode } from './access'

const TIMEOUT_MS = 60_000

export async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    const code = getAccessCode()
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(code ? { 'x-access-code': code } : {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('La respuesta está tardando demasiado. Intentá de nuevo.', { cause: e })
    }
    throw new Error(
      navigator.onLine ? 'No pudimos conectar con el servidor. Intentá de nuevo.' : 'Parece que no tenés conexión a internet.',
      { cause: e },
    )
  } finally {
    clearTimeout(timer)
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (res.status === 401) {
    // El código guardado ya no sirve (por ejemplo, fue revocado): vuelve a la pantalla de acceso.
    clearAccessCode()
    window.dispatchEvent(new Event(ACCESS_LOST_EVENT))
  }
  if (!res.ok || json.error) {
    throw new Error(json.error || 'Algo falló. Intentá de nuevo.')
  }
  return json
}

export interface CompanyPayload {
  contexto: { rol: string; seniority: string; tiempo: string; casoTipo: 'rendimiento' | 'crecimiento' }
  respuestas: Record<string, string>
  pdfBase64?: string
}

export async function callCompanyAnalysis(payload: CompanyPayload): Promise<{ data: unknown } | { demo: true }> {
  const res = await postJson<{ data?: unknown; demo?: boolean }>('/api/analyze', payload)
  if (res.demo) return { demo: true }
  if (res.data === undefined) throw new Error('La IA no devolvió un análisis válido. Intentá de nuevo.')
  return { data: res.data }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
