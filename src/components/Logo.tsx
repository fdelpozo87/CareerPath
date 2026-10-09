// Marca de Bivio: un trazo que se bifurca en dos caminos (el momento de elegir), con la palabra
// "bivio" (bifurcación, en italiano). Los verdes son los del logo original.

/** El símbolo solo: una rama gruesa que se abre en dos, con un punto lleno y uno vacío. */
export function BivioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="156 100 128 224" fill="none" strokeWidth="18" strokeLinecap="round" aria-hidden="true" className={className}>
      <line x1="170" y1="300" x2="170" y2="210" stroke="#0F6E56" />
      <line x1="170" y1="210" x2="260" y2="120" stroke="#0F6E56" />
      <line x1="170" y1="210" x2="260" y2="300" stroke="#1D9E75" />
      <circle cx="260" cy="120" r="16" fill="#0F6E56" stroke="none" />
      <circle cx="260" cy="300" r="14" stroke="#1D9E75" strokeWidth="7" />
    </svg>
  )
}

/** Avatar del coach: aparece junto a cada mensaje y en el encabezado del chat. */
export function CoachAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-5' : 'h-6'
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-primary-soft`} aria-hidden="true">
      <BivioMark className={icon} />
    </span>
  )
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BivioMark className="h-9" />
      <span className="text-2xl font-medium leading-none tracking-tight text-foreground">bivio</span>
    </span>
  )
}
