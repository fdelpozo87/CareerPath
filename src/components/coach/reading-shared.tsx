import type { ReactNode } from 'react'
import { tr, type Key } from '../../lib/i18n'
import type { ProfileSignal, SignalState } from '../../lib/coach/types'

export function Cita({ cita, fuente, label }: { cita: string; fuente?: string; label?: string }) {
  if (!cita) return null
  return (
    <span className="mt-1 block text-xs italic text-text-muted">
      {label && <span className="mr-1.5 font-semibold not-italic">{label}:</span>}
      {fuente && <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase">{fuente}</span>}
      {'"'}{cita}{'"'}
    </span>
  )
}

export function CitaBlock({ cita, fuente }: { cita: string; fuente?: string }) {
  if (!cita) return null
  return (
    <blockquote className="mt-3 border-l-2 border-accent pl-3">
      <p className="text-xs text-text-muted">
        {tr('profile.read.inCV')}
        {fuente && <span className="ml-1 mr-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase">{fuente}</span>}
        {' '}<span className="italic">{'"'}{cita}{'"'}</span>
      </p>
    </blockquote>
  )
}

export function ReadingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-5 sm:p-6">
      <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

export const GRUPO_LABEL: Record<string, string> = {
  queHacesYQueOfreces: 'Qué buscas y qué ofreces',
  experienciaQuePodriaSumar: 'Experiencia que podría sumar',
  loQueFaltaONoCuenta: 'Lo que falta o no se encuentra',
  detallesForma: 'Detalles de forma',
  convencionesMercado: 'Convenciones del mercado',
}

export const GRUPO_ORDER = [
  'queHacesYQueOfreces',
  'experienciaQuePodriaSumar',
  'loQueFaltaONoCuenta',
  'detallesForma',
  'convencionesMercado',
]

const SIGNAL_STYLE: Record<SignalState, string> = {
  entiende: 'bg-primary-soft text-primary',
  insinua: 'border border-accent text-accent-ink',
  ausente: 'border border-dashed border-text-muted/60 text-text-muted',
}

export function SignalList({ signals }: { signals: ProfileSignal[] }) {
  return (
    <ul role="list" className="space-y-2">
      {signals.map((s, i) => (
        <li key={i} className="text-sm leading-relaxed text-foreground">
          <span className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${SIGNAL_STYLE[s.estado]}`}>
            {tr(`profile.signal.${s.estado}` as Key)}
          </span>
          <span className="font-semibold">{s.tema}.</span> {s.comentario}
          <Cita cita={s.cita} />
        </li>
      ))}
    </ul>
  )
}
