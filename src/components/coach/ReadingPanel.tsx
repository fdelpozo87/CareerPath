import { useState } from 'react'
import { tr } from '../../lib/i18n'
import type { ProfileReading } from '../../lib/coach/types'
import { CitaBlock, SignalList, GRUPO_LABEL, GRUPO_ORDER } from './reading-shared'

interface ReadingPanelProps {
  puesto: string
  lectura: ProfileReading
}

export function ReadingPanel({ puesto, lectura }: ReadingPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const tieneGrupos = lectura.recomendaciones.some((r) => r.grupo)
  const gruposConRecs = tieneGrupos
    ? GRUPO_ORDER.filter((g) => lectura.recomendaciones.some((r) => r.grupo === g))
    : lectura.recomendaciones.length > 0
      ? ['_todas']
      : []

  return (
    <div
      className={`flex flex-col border-b border-border-color ${collapsed ? 'flex-shrink-0' : 'max-h-[50%]'}`}
    >
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex flex-shrink-0 items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/50"
        aria-expanded={!collapsed}
      >
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            {tr('profile.panel.title')}
          </span>
          {puesto && (
            <span className="ml-2 text-xs text-text-muted opacity-70">· {puesto}</span>
          )}
        </div>
        <svg
          viewBox="0 0 12 12"
          className="ml-2 h-3.5 w-3.5 flex-shrink-0 text-foreground transition-transform"
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
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Señales */}
          {(lectura.senales?.length ?? 0) > 0 && (
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-accent-ink">
                {tr('profile.read.signals')}
              </p>
              <SignalList signals={lectura.senales ?? []} />
            </div>
          )}

          {/* 4 secciones compactas */}
          <div className="card divide-y divide-border-color overflow-hidden p-0">
            <div className="p-3">
              <p className="mb-1 text-xs font-semibold text-foreground">{tr('profile.read.first')}</p>
              <p className="text-xs leading-relaxed text-text-muted">{lectura.primeraImpresion}</p>
              {lectura.primeraImpresionCita && <CitaBlock cita={lectura.primeraImpresionCita} />}
            </div>

            {lectura.fortalezas.length > 0 && (
              <div className="p-3">
                <p className="mb-1 text-xs font-semibold text-foreground">{tr('profile.read.good')}</p>
                <div className="space-y-2">
                  {lectura.fortalezas.map((f, i) => (
                    <div key={i}>
                      <p className="text-xs leading-relaxed text-text-muted">{f.observacion}</p>
                      {f.cita && <CitaBlock cita={f.cita} fuente={f.fuente} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lectura.ausencias.length > 0 && (
              <div className="p-3">
                <p className="mb-1 text-xs font-semibold text-foreground">{tr('profile.read.missing')}</p>
                <div className="space-y-2">
                  {lectura.ausencias.map((a, i) => (
                    <div key={i}>
                      <p className="text-xs leading-relaxed text-text-muted">{a.observacion}</p>
                      {a.cita && <CitaBlock cita={a.cita} fuente={a.fuente} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3">
              <p className="mb-1 text-xs font-semibold text-foreground">{tr('profile.read.consistency')}</p>
              <p className="text-xs leading-relaxed text-text-muted">{lectura.consistenciaMarca}</p>
              {lectura.consistenciaMarcaCita && <CitaBlock cita={lectura.consistenciaMarcaCita} />}
            </div>
          </div>

          {/* Recomendaciones resumidas */}
          {gruposConRecs.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {tr('profile.read.changes')}
              </p>
              {gruposConRecs.map((grupo) => {
                const recs =
                  grupo === '_todas'
                    ? lectura.recomendaciones
                    : lectura.recomendaciones.filter((r) => r.grupo === grupo)
                return (
                  <div key={grupo} className="mb-3 last:mb-0">
                    {tieneGrupos && grupo !== '_todas' && (
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                        {GRUPO_LABEL[grupo]}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {recs.map((r, i) => (
                        <div key={i} className="rounded-lg border border-border-color bg-background px-2.5 py-2">
                          {r.elemento && (
                            <p className="text-xs font-semibold text-foreground">{r.elemento}</p>
                          )}
                          <p className="text-xs leading-relaxed text-text-muted">{r.cambio}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
