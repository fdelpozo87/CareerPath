import type { ApiRequest, ApiResponse } from '../server/http.js'
import { handleEvaluaciones } from '../server/evaluaciones.js'

// Evaluaciones de desempeño (ver server/evaluaciones.ts).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const { status, body } = await handleEvaluaciones(req, process.env.GEMINI_API_KEY)
  res.status(status).json(body)
}
