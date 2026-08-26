import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Proxy server-side: la API key de Gemini vive solo acá (GEMINI_API_KEY, sin
// prefijo VITE_) y nunca llega al bundle del cliente. El cliente manda las
// "parts" ya armadas (prompt + CV opcional en base64) y recibe el texto crudo.

type Part = { text: string } | { inlineData: { mimeType: string; data: string } }

const MAX_PARTS = 4
const MAX_TEXT_LENGTH = 20_000

function isValidParts(parts: unknown): parts is Part[] {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_PARTS) return false
  return parts.every((p) => {
    if (typeof p !== 'object' || p === null) return false
    if ('text' in p) return typeof (p as { text: unknown }).text === 'string' && (p as { text: string }).text.length <= MAX_TEXT_LENGTH
    if ('inlineData' in p) {
      const d = (p as { inlineData: { mimeType?: unknown; data?: unknown } }).inlineData
      return typeof d?.mimeType === 'string' && typeof d?.data === 'string'
    }
    return false
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    res.status(200).json({ demo: true })
    return
  }

  const { parts } = req.body ?? {}
  if (!isValidParts(parts)) {
    res.status(400).json({ error: 'Payload inválido' })
    return
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
    const result = await model.generateContent(parts)
    const text = result.response.text().trim()
    res.status(200).json({ text })
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Error al consultar la IA' })
  }
}
