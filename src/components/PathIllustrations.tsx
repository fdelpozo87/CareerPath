import type { Path } from '../lib/coach/types'

// Dibujo de cada camino de la pantalla de inicio. Se animan solo cuando la tarjeta (`.group`) recibe el
// mouse o el foco del teclado; las reglas están en src/index.css (.pa-*) y se apagan con "reducir movimiento".
// Los colores salen de los tokens, así que siguen al modo oscuro.

const stroke = { fill: 'none', strokeWidth: 7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const primary = 'var(--color-primary)'

/** A: un camino que llega a una bifurcación. El punto late y se abre un anillo. */
function Fork() {
  return (
    <>
      <path d="M20 96 C60 96 80 64 112 60" stroke={primary} {...stroke} />
      <path d="M112 60 C150 56 170 24 214 22" stroke={primary} strokeOpacity={0.18} strokeDasharray="2 12" {...stroke} />
      <path d="M112 60 C150 64 176 92 214 96" stroke={primary} strokeOpacity={0.18} strokeDasharray="2 12" {...stroke} />
      <path d="M112 60 L214 60" stroke={primary} strokeOpacity={0.18} strokeDasharray="2 12" {...stroke} />
      <circle cx="214" cy="22" r="6" fill="var(--color-primary-soft)" />
      <circle cx="214" cy="60" r="6" fill="var(--color-primary-soft)" />
      <circle cx="214" cy="96" r="6" fill="var(--color-primary-soft)" />
      <circle cx="112" cy="60" r="14" className="pa-ring fill-accent" />
      <circle cx="112" cy="60" r="12" className="fill-accent" />
    </>
  )
}

/** B: un CV visto con una lupa. La lupa recorre el documento. */
function Lens() {
  return (
    <>
      <rect x="34" y="18" width="92" height="84" rx="16" fill="var(--color-card)" stroke={primary} strokeOpacity={0.18} strokeWidth={4} />
      <path d="M52 44 H96 M52 62 H108 M52 80 H84" stroke={primary} strokeOpacity={0.3} {...stroke} strokeWidth={6} />
      <g className="pa-scan">
        <path d="M118 74 C150 74 160 50 196 46" stroke={primary} {...stroke} />
        <circle cx="168" cy="58" r="30" fill="none" stroke="var(--color-primary-dark)" strokeOpacity={0.9} strokeWidth={6} />
        <circle cx="196" cy="46" r="11" className="fill-accent" />
      </g>
    </>
  )
}

/** C: tres opciones de formación, una resaltada. El punto avanza hasta quedar bajo la elegida. */
function Options() {
  const route = 'M16 106 C60 106 100 104 130 84'
  return (
    <>
      <rect x="58" y="14" width="40" height="54" rx="10" fill="var(--color-card)" stroke={primary} strokeOpacity={0.18} strokeWidth={4} />
      <rect x="110" y="8" width="40" height="60" rx="10" fill="var(--color-card)" stroke={primary} strokeWidth={4} />
      <rect x="162" y="14" width="40" height="54" rx="10" fill="var(--color-card)" stroke={primary} strokeOpacity={0.18} strokeWidth={4} />
      <path d="M68 30 H88 M68 42 H82 M120 26 H140 M120 38 H134 M172 30 H192 M172 42 H186" stroke={primary} strokeOpacity={0.3} {...stroke} strokeWidth={5} />
      <path d={route} stroke={primary} {...stroke} />
      <circle cx="0" cy="0" r="11" className="pa-travel fill-accent" style={{ offsetPath: `path("${route}")` }} />
    </>
  )
}

const drawings: Record<Path, () => React.JSX.Element> = { quiebre: Fork, perfil: Lens, formacion: Options }

export default function PathIllustration({ path, className = '' }: { path: Path; className?: string }) {
  const Drawing = drawings[path]
  return (
    <svg viewBox="0 0 240 120" aria-hidden="true" overflow="visible" className={`h-full w-full ${className}`}>
      <Drawing />
    </svg>
  )
}
