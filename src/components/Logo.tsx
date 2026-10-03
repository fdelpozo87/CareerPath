// Marca de CareerPath: la brújula en un círculo verde, como en el diseño del equipo.

function Compass({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2 5.2-2Z" />
    </svg>
  )
}

/** Avatar del coach: aparece junto a cada mensaje y en el encabezado del chat. */
export function CoachAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-primary text-white`} aria-hidden="true">
      <Compass className={icon} />
    </span>
  )
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <CoachAvatar size="sm" />
      <span className="font-display text-xl font-medium tracking-tight text-foreground">CareerPath</span>
    </span>
  )
}
