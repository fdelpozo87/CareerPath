import type { Ikigai } from '../../../shared/stages'
import { tr, type Key } from '../../lib/i18n'

// El ikigai como cuatro círculos que se cruzan, con lo que la persona dijo en cada uno. El cruce del centro queda vacío a
// propósito: lo nombra ella. En pantallas angostas (y para lectores de pantalla) es una lista; el dibujo es un complemento.

const PETALS = [
  { key: 'ama', label: 'ikigai.love', color: 'var(--color-accent)', circle: [50, 31], box: 'left-1/2 top-[7%] w-[36%] -translate-x-1/2' },
  { key: 'bueno', label: 'ikigai.good', color: 'var(--color-primary)', circle: [31, 50], box: 'left-[5%] top-1/2 w-[28%] -translate-y-1/2' },
  { key: 'mundo', label: 'ikigai.need', color: 'var(--color-primary-dark)', circle: [69, 50], box: 'right-[5%] top-1/2 w-[28%] -translate-y-1/2' },
  { key: 'pagan', label: 'ikigai.paid', color: 'var(--color-accent-ink)', circle: [50, 69], box: 'bottom-[7%] left-1/2 w-[36%] -translate-x-1/2' },
] as const satisfies readonly { key: keyof Ikigai; label: Key; color: string; circle: readonly [number, number]; box: string }[]

// Dónde se cruzan dos círculos y cómo se llama ese cruce (nombres clásicos del ikigai).
const CROSSINGS = [
  { label: 'ikigai.passion', x: 36, y: 36 },
  { label: 'ikigai.mission', x: 64, y: 36 },
  { label: 'ikigai.profession', x: 36, y: 64 },
  { label: 'ikigai.vocation', x: 64, y: 64 },
] as const satisfies readonly { label: Key; x: number; y: number }[]

export function IkigaiChart({ ikigai }: { ikigai: Ikigai }) {
  return (
    <div data-testid="ikigai-chart">
      {/* El dibujo: solo desde pantallas medianas. Lo que dice es lo mismo que la lista de abajo. */}
      <div aria-hidden="true" className="relative mx-auto hidden aspect-square w-full max-w-[34rem] [print-color-adjust:exact] sm:block">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {PETALS.map((p) => (
            <circle key={p.key} cx={p.circle[0]} cy={p.circle[1]} r={25.5} fill={p.color} fillOpacity={0.13} stroke={p.color} strokeOpacity={0.55} strokeWidth={0.35} />
          ))}
          <circle cx={50} cy={50} r={8.5} fill="var(--color-card)" stroke="var(--color-text-muted)" strokeWidth={0.3} strokeDasharray="1 1" />
        </svg>
        {PETALS.map((p) => (
          <div key={p.key} className={`absolute text-center ${p.box}`}>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: p.color }}>
              {tr(p.label)}
            </p>
            {ikigai[p.key] ? (
              <p className="line-clamp-4 text-[13px] leading-snug text-foreground" title={ikigai[p.key]}>
                {ikigai[p.key]}
              </p>
            ) : (
              <p className="text-[11px] italic leading-snug text-text-muted">{tr('ikigai.empty')}</p>
            )}
          </div>
        ))}
        {CROSSINGS.map((c) => (
          <span key={c.label} className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-medium uppercase tracking-widest text-text-muted" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            {tr(c.label)}
          </span>
        ))}
        <span className="absolute left-1/2 top-1/2 w-[15%] -translate-x-1/2 -translate-y-1/2 text-center text-[9px] italic leading-tight text-text-muted">{tr('ikigai.center')}</span>
      </div>

      {/* La lista: visible en celular y siempre disponible para lectores de pantalla. */}
      <dl aria-label={tr('ikigai.aria')} className="space-y-3 sm:sr-only">
        {PETALS.map((p) => (
          <div key={p.key} className="rounded-xl border border-border-color p-3">
            <dt className="mb-0.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: p.color }}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {tr(p.label)}
            </dt>
            <dd className={`text-sm leading-relaxed ${ikigai[p.key] ? 'text-foreground' : 'italic text-text-muted'}`}>{ikigai[p.key] || tr('ikigai.empty')}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
