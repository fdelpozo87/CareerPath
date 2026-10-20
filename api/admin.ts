import type { ApiRequest, ApiResponse } from '../server/http.js'
import { handleAdmin } from '../server/admin.js'

// Panel de administración de cuentas (ver server/admin.ts).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const { status, body } = await handleAdmin(req)
  res.status(status).json(body)
}
