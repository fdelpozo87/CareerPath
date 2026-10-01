import type { ApiRequest, ApiResponse } from '../server/http.js'
import { runEndpoint } from '../server/endpoints.js'

// Toda la lógica (método, origen, rate limit, validación, Gemini y logs) vive
// en server/endpoints.ts, compartida con el servidor de desarrollo.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const { status, body, headers } = await runEndpoint('coach', req, process.env.GEMINI_API_KEY)
  for (const [k, v] of Object.entries(headers ?? {})) res.setHeader(k, v)
  res.status(status).json(body)
}
