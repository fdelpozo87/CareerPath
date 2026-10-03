import { useState } from 'react'
import type { Report, ReportAction } from '../../lib/coach/types'

// Cierre del Plan de Acción (§5): informe breve donde la persona selecciona
// qué acciones asume. Ninguna viene marcada por default.

const BLOQUE_LABEL: Record<ReportAction['bloque'], string> = {
  '70': '70 · Práctica',
  '20': '20 · Con otras personas',
  '10': '10 · Formación',
}

const TIPO_LABEL: Partial<Record<ReportAction['tipo'], string>> = {
  pedido: 'Pedido',
  oferta: 'Oferta',
}

interface ReportViewProps {
  report: Report
  compromisos?: number[]
  compromisosFecha?: string
  onSave: (indices: number[]) => void
  onRestart: () => void
}

export function ReportView({ report, compromisos, compromisosFecha, onSave, onRestart }: ReportViewProps) {
  const [selected, setSelected] = useState<number[]>(compromisos ?? [])
  const [editing, setEditing] = useState(!compromisos)
  const toggle = (i: number) => setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
  const hasPedido = report.acciones.some((a) => a.tipo === 'pedido')

  return (
    <div className="ai-result mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Cierre del proceso</p>
        <h2 className="mb-2">Lo que construiste</h2>
        <p className="text-sm text-text-muted">No es un veredicto: es tu propia lectura, ordenada.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Objetivo de la sesión</p>
          <p className="text-sm leading-relaxed text-foreground">{report.objetivoSesion}</p>
        </div>

        <div className="card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Hallazgos</p>
          <ul className="space-y-3">
            {report.hallazgos.map((h, i) => (
              <li key={i} className="text-sm leading-relaxed text-foreground">
                {h.texto}
                {h.citaPersona && <span className="mt-1 block text-xs italic text-text-muted">Vos dijiste: “{h.citaPersona}”</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
            {editing ? 'Acciones sugeridas' : 'Tus compromisos'}
          </p>
          <p className="mb-4 text-sm text-text-muted">
            {editing
              ? 'Salieron de la conversación. Marcá las que asumís como compromiso — no hace falta tomarlas todas.'
              : compromisosFecha
                ? `Los elegiste el ${new Date(compromisosFecha).toLocaleDateString('es-AR')}.`
                : 'Los elegiste vos.'}
          </p>
          <ul className="space-y-3">
            {report.acciones.map((a, i) => {
              if (!editing && !selected.includes(i)) return null
              return (
                <li key={i}>
                  <label className={`flex gap-3 rounded-xl border border-border-color p-4 ${editing ? 'cursor-pointer hover:bg-secondary' : ''}`}>
                    {editing && (
                      <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} className="mt-1 accent-orange-500 print:hidden" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-relaxed text-foreground">{a.texto}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-text-muted">{BLOQUE_LABEL[a.bloque] ?? a.bloque}</span>
                        {TIPO_LABEL[a.tipo] && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-primary">{TIPO_LABEL[a.tipo]}</span>
                        )}
                        {a.cuatroC?.filter(Boolean).map((c) => (
                          <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-primary">
                            + {c}
                          </span>
                        ))}
                      </div>
                      {a.fortalezaAncla && <p className="mt-2 text-xs text-text-muted">Se apoya en: {a.fortalezaAncla}</p>}
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
          {editing && !hasPedido && (
            <p className="mt-3 text-xs text-accent-ink">
              Ninguna acción quedó como un pedido concreto a alguien. Si querés, volvé a pensarlo: ¿a quién le podrías pedir algo esta semana?
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard title="Horizonte" body={report.horizonte} />
          <InfoCard title="Cómo vas a saber que avanzás" body={report.metrica} />
          <InfoCard title="Check-in" body={report.checkIn} />
        </div>

        {report.preguntaAbierta && (
          <div className="ai-tint rounded-2xl p-6" style={{ borderLeft: '3px solid var(--color-accent)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Para llevarte</p>
            <p className="italic leading-relaxed text-foreground">{report.preguntaAbierta}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        {editing ? (
          <button
            onClick={() => {
              onSave(selected)
              setEditing(false)
            }}
            disabled={selected.length === 0}
            className="btn-primary flex-1 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Asumir {selected.length || ''} compromiso{selected.length === 1 ? '' : 's'} →
          </button>
        ) : (
          <>
            <button onClick={() => window.print()} className="btn-primary flex-1 py-3.5">
              Imprimir / guardar PDF
            </button>
            <button onClick={() => setEditing(true)} className="btn-secondary py-3.5">
              Cambiar compromisos
            </button>
          </>
        )}
        <button onClick={onRestart} className="rounded-xl border border-border-color px-5 py-3.5 text-sm text-text-muted transition hover:bg-card">
          Empezar de nuevo
        </button>
      </div>
      {!editing && (
        <p className="mt-4 text-center text-xs text-text-muted print:hidden">
          Tus compromisos quedan guardados en este navegador: podés volver y retomar desde acá.
        </p>
      )}
    </div>
  )
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</p>
      <p className="text-sm leading-relaxed text-foreground">{body}</p>
    </div>
  )
}
