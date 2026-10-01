import type { ApiRequest, ApiResponse } from '../server/http.js'
import { runEndpoint } from '../server/endpoints.js'

// Valida el código de acceso de prueba (ver server/access.ts).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const { status, body, headers } = await runEndpoint('access', req, undefined)
  for (const [k, v] of Object.entries(headers ?? {})) res.setHeader(k, v)
  res.status(status).json(body)
}
