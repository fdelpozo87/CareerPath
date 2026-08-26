export type AiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

interface AnalyzeResponse {
  text?: string
  demo?: boolean
  error?: string
}

// Llama al proxy serverless (api/analyze.ts) — la API key de Gemini vive
// solo del lado del servidor, nunca en el bundle del cliente.
export async function callAi(parts: AiPart[]): Promise<{ text: string } | { demo: true }> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
  })

  const data = (await res.json()) as AnalyzeResponse

  if (!res.ok || data.error) {
    throw new Error(data.error || 'La IA no devolvió un diagnóstico válido. Intentá de nuevo.')
  }
  if (data.demo) return { demo: true }
  if (!data.text) throw new Error('La IA no devolvió un diagnóstico válido. Intentá de nuevo.')
  return { text: data.text }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
