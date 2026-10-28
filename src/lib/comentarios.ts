import { authHeader } from './cloud'
import { getLang, tr } from './i18n'

// Cliente de /api/comentarios (server/comentarios.ts): un comentario para quien administra Bivio.

export type ComentarioTipo = 'problema' | 'idea' | 'otro'
export const TIPOS: ComentarioTipo[] = ['problema', 'idea', 'otro']
export const MAX_COMENTARIO = 2000
export const MIN_COMENTARIO = 5

export async function enviarComentario(tipo: ComentarioTipo, mensaje: string, pagina: string): Promise<void> {
  const res = await fetch('/api/comentarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lang': getLang(), ...(await authHeader()) },
    body: JSON.stringify({ tipo, mensaje, pagina }),
  })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? tr('comment.error'))
  }
}
