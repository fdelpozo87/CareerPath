import type { ApiRequest, ApiResponse } from '../server/http.js'
import { handleHealth } from '../server/health.js'

// Estado del servicio para el monitoreo externo (ver server/health.ts).
export default async function handler(_req: ApiRequest, res: ApiResponse) {
  const { status, body } = await handleHealth()
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}
