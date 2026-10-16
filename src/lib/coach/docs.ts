import { tr } from '../i18n'
import { MAX_PDF_BYTES } from './api'
import type { DocTipo } from './types'

export const docLabel = (tipo: DocTipo): string => tr(tipo === 'cv' ? 'docs.cv' : 'docs.linkedin')

export interface DocDraft {
  mode: 'pdf' | 'texto'
  file: File | null
  texto: string
}

export const emptyDraft = (): DocDraft => ({ mode: 'pdf', file: null, texto: '' })

export const draftReady = (d: DocDraft) => (d.mode === 'pdf' ? !!d.file : d.texto.trim().length >= 80)

/** Valida un PDF; devuelve un mensaje de error o null. */
export function checkPdf(f: File): string | null {
  if (!(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) {
    return tr('docs.err.type')
  }
  if (f.size > MAX_PDF_BYTES) return tr('docs.err.size')
  return null
}
