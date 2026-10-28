import type { ApiRequest, ApiResponse } from '../server/http.js'
import { handleComentarios } from '../server/comentarios.js'

// Comentarios de las personas para quien administra (ver server/comentarios.ts).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const { status, body } = await handleComentarios(req)
  res.status(status).json(body)
}
