import type { ApiRequest, ApiResponse } from '../server/http.js'
import { handleAccount } from '../server/account.js'

// Borra la cuenta de quien lo pide, con su propio token de sesión (ver server/account.ts).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const { status, body } = await handleAccount(req)
  res.status(status).json(body)
}
