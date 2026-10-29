import { useEffect, useRef, useState } from 'react'

// Progreso de la conversación como una onda: una ondulación por etapa, y un punto mandarina (el del logo) que avanza por
// ella. Reemplaza a las tres barritas. El ancho se mide para dibujar la onda sin deformarla.

const HEIGHT = 32
const MID = HEIGHT / 2
const AMP = 10
const STAGES = 3

const yAt = (p: number) => MID - AMP * Math.sin(2 * Math.PI * STAGES * p)

function wavePath(width: number): string {
  const steps = 160
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const p = i / steps
    d += `${i === 0 ? 'M' : 'L'}${(p * width).toFixed(1)} ${yAt(p).toFixed(2)}`
  }
  return d
}

export function StageWave({ progress, label }: { progress: number; label: string }) {
  const p = Math.min(1, Math.max(0, progress))
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(120, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const d = wavePath(width)
  const dotTop = (yAt(p) / HEIGHT) * 100

  return (
    <div ref={ref} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} className="relative mt-2 h-8 select-none">
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true" className="absolute inset-0 overflow-visible">
        <path d={d} fill="none" stroke="color-mix(in srgb, var(--color-primary) 20%, transparent)" strokeWidth={5} strokeLinecap="round" />
        <path
          d={d}
          pathLength={1}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="1 1"
          style={{ strokeDashoffset: 1 - p, transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      {/* El cierre de cada etapa. */}
      {[1, 2].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card transition-colors duration-500 ${p >= n / STAGES ? 'bg-primary' : 'bg-border-color'}`}
          style={{ left: `${(n / STAGES) * 100}%`, top: '50%' }}
        />
      ))}
      {/* El punto que avanza. */}
      <span
        aria-hidden="true"
        className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-sm ring-2 ring-card"
        style={{ left: `${p * 100}%`, top: `${dotTop}%`, transition: 'left 600ms ease, top 600ms ease' }}
      />
    </div>
  )
}
