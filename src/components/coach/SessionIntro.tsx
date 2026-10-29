import type { ReactNode } from 'react'
import type { Path } from '../../lib/coach/types'
import { tr, type Key } from '../../lib/i18n'
import { BivioMark } from '../Logo'

// Pantalla antes de la primera pregunta: qué vamos a hacer, en tres líneas. Es lo único que hay antes de empezar.

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const ICONS: ReactNode[] = [
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
    <path d="M5 5h12l-2.500 4L17 13H5" />
  </svg>,
]

export default function SessionIntro({ path, onStart }: { path: Path; onStart: () => void }) {
  return (
    <section aria-labelledby="intro-title" className="mx-auto w-full max-w-2xl py-6 sm:py-14">
      <BivioMark className="mb-10 h-16" />
      <h1 id="intro-title" className="mb-10 text-4xl text-primary-dark sm:text-5xl">
        {tr('intro.title')}
      </h1>
      <ul role="list" className="mb-12 space-y-6">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex items-center gap-4 text-lg text-text-muted">
            <span className="text-primary">{ICONS[n - 1]}</span>
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
