import { STAGE_INTRO, STAGE_OBJECTIVES } from '../../../shared/stages'
import type { Stage, StageMap as StageMapData } from '../../lib/coach/types'

// Cierre de cada etapa: el "mapa" de lo que la persona fue diciendo, con sus
// propias frases. Reemplaza al párrafo único de antes: se ve de un vistazo qué
// se construyó, y la persona puede ajustarlo antes de seguir (apropiación).

interface StageMapProps {
  stage: Stage
  map?: StageMapData
  /** Resumen en prosa, para sesiones guardadas antes de que existiera el mapa. */
  fallbackText?: string
  nextLabel: string
  onAdvance: () => void
  onAdjust: () => void
  /** Retomar un tema que la persona había dejado para más adelante. */
  onResume: (id: string) => void
}

export function StageMap({ stage, map, fallbackText, nextLabel, onAdvance, onAdjust, onResume }: StageMapProps) {
  const labelOf = (id: string) => STAGE_OBJECTIVES[stage].find((o) => o.id === id)?.label ?? id
  const titleId = `mapa-${stage}`

  return (
    <section id="stage-map" aria-labelledby={titleId} className="ai-result rounded-3xl border border-primary/20 bg-primary-soft/40 p-5 sm:p-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Lo que fuimos armando</p>
      <h2 id={titleId} className="mb-1 text-2xl">
        {STAGE_INTRO[stage].titulo}
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-text-muted">
        Esto es lo que dijiste, ordenado. Si algo no te representa, escribilo abajo y lo ajustamos antes de seguir.
      </p>

      {map && map.items.length > 0 ? (
        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {map.items.map((item) =>
            item.omitido ? (
              // Un tema que la persona eligió dejar para después: se muestra tal cual es, sin inventarle contenido.
              <li key={item.id} className="rounded-2xl border border-dashed border-text-muted/50 bg-transparent p-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">{labelOf(item.id)}</p>
                <p className="text-[15px] leading-relaxed text-text-muted">Lo dejaste para más adelante. Cuando quieras, lo retomamos.</p>
                <button type="button" onClick={() => onResume(item.id)} className="mt-3 text-sm font-semibold text-primary underline underline-offset-2">
                  Retomarlo ahora
                </button>
              </li>
            ) : (
            <li key={item.id} className="rounded-2xl border border-border-color bg-card p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">{labelOf(item.id)}</p>
              <p className="text-[15px] leading-relaxed text-foreground">{item.texto}</p>
              {item.cita && (
                <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm italic leading-relaxed text-text-muted">
                  <span className="sr-only">Vos dijiste: </span>“{item.cita}”
                </blockquote>
              )}
            </li>
            ),
          )}
        </ul>
      ) : (
        fallbackText && <p className="whitespace-pre-wrap rounded-2xl border border-border-color bg-card p-4 text-[15px] leading-relaxed">{fallbackText}</p>
      )}

      {map?.pregunta && (
        <div className="mt-4 rounded-2xl bg-accent-soft p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-ink">Una pregunta para llevarte</p>
          <p className="font-display text-lg leading-snug text-foreground">{map.pregunta}</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={onAdvance} className="btn-primary px-6 py-3 text-sm">
          {nextLabel}
        </button>
        <button onClick={onAdjust} className="btn-secondary px-5 py-3 text-sm">
          Quiero ajustar algo
        </button>
      </div>
    </section>
  )
}
