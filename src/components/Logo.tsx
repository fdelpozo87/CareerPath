// Marca de Bivio: un camino que sube, se curva al elegir y sigue hacia un punto (el siguiente paso),
// con la palabra "bivio" (bifurcación, en italiano). El trazo es del color de marca y el punto, mandarina.

/** El símbolo solo. */
export function BivioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path d="M7 37c3-8 8-13 14-9 4 3 5 8 9 8 5 0 8-6 8-15" fill="none" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand" />
      <circle cx="38" cy="10" r="4.5" className="fill-accent" />
    </svg>
  )
}

/** Avatar del coach: aparece junto a cada mensaje y en el encabezado del chat. */
export function CoachAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-4' : 'h-5'
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-primary-soft`} aria-hidden="true">
      <BivioMark className={icon} />
    </span>
  )
}

/** "i" sin punto, con el punto dibujado aparte para poder darle color. */
function DottedI({ dot }: { dot: 'bg-brand' | 'bg-accent' }) {
  return (
    <span className="relative inline-block" aria-hidden="true">
      ı<span className={`absolute left-1/2 top-[0.1em] h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full ${dot}`} />
    </span>
  )
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BivioMark className="h-8" />
      <span className="text-[1.7rem] font-normal leading-none tracking-tight text-foreground">
        <span className="sr-only">bivio</span>
        <span aria-hidden="true">
          b<DottedI dot="bg-brand" />v<DottedI dot="bg-accent" />o
        </span>
      </span>
    </span>
  )
}
