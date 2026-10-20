import { postJson } from '../aiClient'
import { getLang, tr } from '../i18n'
import type { ProfileDoc, ProfileReading, Report, Session, TurnResult, UiMessage } from './types'

// Cliente de /api/coach (server/coach.ts). El system prompt y la API key viven
// del lado del servidor; acá solo se arma el historial.

const MAX_HISTORY = 100

async function post<T>(payload: Record<string, unknown>): Promise<{ data: T; demo: boolean }> {
  const json = await postJson<{ data?: T; demo?: boolean }>('/api/coach', payload)
  if (json.data === undefined) throw new Error(tr('net.coach'))
  return { data: json.data, demo: Boolean(json.demo) }
}

function toHistory(messages: UiMessage[]) {
  const history = messages.map((m) => ({ role: m.role, text: m.role === 'model' ? (m.raw ?? m.text) : m.text }))
  // Conserva el mensaje de apertura y el tramo más reciente.
  return history.length > MAX_HISTORY ? [history[0], ...history.slice(-(MAX_HISTORY - 1))] : history
}

function perfilContext(session: Session): string | undefined {
  if (!session.perfil) return undefined
  const { puesto, lectura, elegidas } = session.perfil
  const recs = lectura.recomendaciones.slice(0, 3)
    .map((r, i) => `- ${r.cambio}${elegidas.includes(i) ? ' [la persona eligió tomarla]' : ' [la persona no la eligió]'}`)
    .join('\n')
  return `Puesto al que apunta: ${puesto}
Primera impresión: ${lectura.primeraImpresion}
Consistencia de marca: ${lectura.consistenciaMarca}
Qué comunica hoy: ${lectura.comunicaHoy ?? lectura.notaComunica ?? ''}
Señales (qué comunica el perfil, no cuánto vale la persona):
${(lectura.senales ?? []).map((s) => `- ${s.tema}: ${s.estado} — ${s.comentario}`).join('\n')}
Recomendaciones:
${recs}`
}

const DOC_HEADER: Record<ProfileDoc['tipo'], string> = { cv: '=== CV ===', linkedin: '=== LINKEDIN ===' }

// Une los documentos bajo encabezados, para que el modelo sepa de cuál sale cada cita.
export function documentsToText(docs: ProfileDoc[]): string | undefined {
  if (docs.length === 0) return undefined
  return docs.map((d) => `${DOC_HEADER[d.tipo]}\n${d.texto.trim()}`).join('\n\n')
}

function sharedContext(session: Session) {
  return {
    lang: getLang(),
    path: session.path,
    history: toHistory(session.messages),
    sintesisPrevias: session.sintesis,
    documentos: documentsToText(session.documentos),
    lecturaPerfil: perfilContext(session),
  }
}

export function requestTurn(session: Session) {
  return post<TurnResult>({
    mode: 'turno',
    stage: session.stage,
    cubiertos: session.cubiertos[session.stage],
    etapaCerrada: session.stageReady,
    omitidos: session.omitidos?.[session.stage] ?? [],
    ...sharedContext(session),
  })
}

export function requestReport(session: Session) {
  return post<Report>({ mode: 'informe', ...sharedContext(session) })
}

export function requestProfileReading(puesto: string, perfilTexto: string) {
  return post<ProfileReading>({ mode: 'perfil', lang: getLang(), puesto, perfilTexto })
}

export async function extractPdfText(file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const { data } = await post<{ texto: string }>({ mode: 'extraer', pdfBase64: base64 })
  return data.texto
}

export const MAX_PDF_BYTES = 3 * 1024 * 1024
