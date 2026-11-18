import { useState } from 'react'
import { tr } from '../../lib/i18n'
import type { ProfileReading, RecomendacionAplicada } from '../../lib/coach/types'

interface CvProgressPanelProps {
  recomendaciones: ProfileReading['recomendaciones']
  aplicadas: RecomendacionAplicada[]
  onApply: (rec: RecomendacionAplicada) => void
  onUndo: (index: number) => void
}

export function CvProgressPanel({ recomendaciones, aplicadas, onApply, onUndo }: CvProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  const isApplied = (i: number) => aplicadas.some((a) => a.index === i)
  const applied = aplicadas

  const handleApply = (i: number) => {
    const rec = recomendaciones[i]
    if (!rec) return
    const nuevo = (drafts[i] ?? '').trim()
    if (!nuevo) return
    onApply({
      index: i,
      elemento: rec.elemento ?? rec.grupo ?? `Cambio ${i + 1}`,
      original: rec.cita ?? '',
      nuevo,
    })
    setDrafts((prev) => { const next = { ...prev }; delete next[i]; return next })
  }

  const hasAny = applied.length > 0

  const handleDownload = () => {
    const lines: string[] = [`Mi CV en progreso\n${'='.repeat(40)}\n`]
    for (const a of applied) {
      lines.push(`${a.elemento}`)
      lines.push(`Antes: ${a.original || '—'}`)
      lines.push(`Ahora: ${a.nuevo}`)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mi-cv-en-progreso.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex flex-shrink-0 items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/50"
        aria-expanded={!collapsed}
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          {tr('cv.panel.title')}
        </span>
        <div className="flex items-center gap-3">
          {hasAny && !collapsed && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {tr('cv.panel.download')}
            </button>
          )}
          <svg
            viewBox="0 0 12 12"
            className="h-3.5 w-3.5 flex-shrink-0 text-foreground transition-transform"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="2,4 6,8 10,4" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {!collapsed && <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {recomendaciones.length === 0 && (
          <p className="text-xs text-text-muted">{tr('cv.panel.empty')}</p>
        )}

        {recomendaciones.map((rec, i) => {
          if (isApplied(i)) {
            const a = applied.find((x) => x.index === i)!
            return (
              <div key={i} className="rounded-xl border border-primary/20 bg-primary-soft p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-primary">
                    {a.elemento}
                  </p>
                  <button
                    type="button"
                    onClick={() => onUndo(i)}
                    className="flex-shrink-0 text-[10px] text-text-muted underline-offset-2 hover:underline"
                  >
                    {tr('cv.panel.undo')}
                  </button>
                </div>
                {a.original && (
                  <div className="mb-1.5">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      {tr('cv.panel.before')}
                    </p>
                    <p className="rounded bg-background/60 px-2 py-1 text-xs italic text-text-muted line-through">
                      {a.original}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {tr('cv.panel.after')}
                  </p>
                  <p className="rounded bg-background/60 px-2 py-1 text-xs text-foreground">
                    {a.nuevo}
                  </p>
                </div>
              </div>
            )
          }

          return (
            <div key={i} className="rounded-xl border border-border-color bg-card p-3">
              {rec.elemento && (
                <p className="mb-1 text-xs font-semibold text-foreground">{rec.elemento}</p>
              )}
              <p className="mb-2 text-xs leading-relaxed text-text-muted">{rec.cambio}</p>
              {rec.cita && (
                <p className="mb-2 rounded bg-secondary px-2 py-1 text-xs italic text-text-muted">
                  "{rec.cita}"
                </p>
              )}
              <textarea
                value={drafts[i] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [i]: e.target.value }))}
                rows={2}
                placeholder={tr('cv.panel.edit.placeholder')}
                className="mb-2 w-full resize-none rounded-lg border border-border-color bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => handleApply(i)}
                disabled={!(drafts[i] ?? '').trim()}
                className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tr('cv.panel.apply')}
              </button>
            </div>
          )
        })}

        {recomendaciones.length === 0 && (
          <p className="text-xs leading-relaxed text-text-muted">{tr('cv.panel.empty')}</p>
        )}
      </div>}
    </div>
  )
}
