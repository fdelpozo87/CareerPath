import type { ReactNode } from 'react'
import type { Path } from '../../lib/coach/types'
import { tr, type Key } from '../../lib/i18n'
import { BivioMark } from '../Logo'

// Pantalla antes de la primera pregunta: qué vamos a hacer, con íconos por camino.

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

// Iconos comunes (Camino A y C)
const ICONS_DEFAULT: ReactNode[] = [
  <svg key="chat" viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
    <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.3A7.5 7.5 0 1 1 20 12Z" />
  </svg>,
  <svg key="route" viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M8.2 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.8" />
  </svg>,
  <svg key="flag" viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
    <path d="M5 21V4" />
    <path d="M5 5h12l-2.5 4L17 13H5" />
  </svg>,
]

// Camino B (perfil): 4 ítems con iconos que describen el flujo de la lectura de perfil
const ICONS_PERFIL: ReactNode[] = [
  // Crosshair / objetivo
  <svg key="target" viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>,
  // Ojo / lectura
  <svg key="eye" viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>,
  // Sparkle / recomendaciones
  <svg key="sparkle" viewBox="0 0 24 24" className="h-6 w-6" {...stroke} strokeWidth={1.5}>
    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
  </svg>,
  // Chat / decisión
  <svg key="chat" viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
    <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.3A7.5 7.5 0 1 1 20 12Z" />
  </svg>,
]

export default function SessionIntro({ path, onStart }: { path: Path; onStart: () => void }) {
  const isPerfil = path === 'perfil'
  const icons = isPerfil ? ICONS_PERFIL : ICONS_DEFAULT
  const count = isPerfil ? 4 : 3

  return (
    <section aria-labelledby="intro-title" className="mx-auto w-full max-w-2xl py-6 sm:py-14">
      <BivioMark className="mb-10 h-16" />
      <h1 id="intro-title" className="mb-10 text-4xl text-primary-dark sm:text-5xl">
        {tr('intro.title')}
      </h1>
      <ul role="list" className="mb-12 space-y-6">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <li key={n} className="flex items-center gap-4 text-lg text-text-muted">
            <span className="text-primary">{icons[n - 1]}</span>
            {tr(`intro.${path}.${n}` as Key)}
          </li>
        ))}
      </ul>
      <button type="button" autoFocus onClick={onStart} className="btn-primary gap-2 bg-primary-dark px-7 py-4 text-base hover:bg-primary">
        {tr('intro.start')}
        <svg viewBox="0 0 24 24" className="h-4 w-4" {...stroke} strokeWidth={2}>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>
      <p className="mt-5 text-sm text-text-muted">{tr('intro.note')}</p>
    </section>
  )
}
