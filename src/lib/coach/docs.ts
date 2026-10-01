import { MAX_PDF_BYTES } from './api'
import type { DocTipo } from './types'

export const DOC_LABEL: Record<DocTipo, string> = { cv: 'CV', linkedin: 'LinkedIn' }

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
    return 'Solo aceptamos PDF.'
  }
  if (f.size > MAX_PDF_BYTES) return 'El PDF supera los 3 MB. Probá exportarlo de nuevo o pegá el texto.'
  return null
}
