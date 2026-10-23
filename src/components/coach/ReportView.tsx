import { useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import { SaveCard } from './SaveCard'
import { getLang, tr, trn, type Key } from '../../lib/i18n'
import type { Report, ReportAction, Session } from '../../lib/coach/types'

// Cierre del Plan de Acción (§5): informe breve donde la persona selecciona
// qué acciones asume. Ninguna viene marcada por default.

const bloqueLabel = (b: ReportAction['bloque']) => tr(`report.block.${b}` as Key)
const tipoLabel = (t: ReportAction['tipo']) => (t === 'pedido' || t === 'oferta' ? tr(`report.type.${t}` as Key) : undefined)

interface ReportViewProps {
  report: Report
  compromisos?: number[]
  compromisosFecha?: string
  onSave: (indices: number[]) => void
  onRestart: () => void
  /** El proceso al que pertenece el informe (para guardarlo en la cuenta). */
  session?: Session
}

export function ReportView({ report, compromisos, compromisosFecha, onSave, onRestart, session }: ReportViewProps) {
  const [selected, setSelected] = useState<number[]>(compromisos ?? [])
  const [editing, setEditing] = useState(!compromisos)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const toggle = (i: number) => setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
  const hasPedido = report.acciones.some((a) => a.tipo === 'pedido')

  return (
    <div className="ai-result mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('report.eyebrow')}</p>
        <h2 className="mb-2">{tr('report.title')}</h2>
        <p className="text-sm text-text-muted">{tr('report.lede')}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tr('report.objective')}</p>
          <p className="text-sm leading-relaxed text-foreground">{report.objetivoSesion}</p>
        </div>

        <div className="card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('report.findings')}</p>
          <ul className="space-y-3">
            {report.hallazgos.map((h, i) => (
              <li key={i} className="text-sm leading-relaxed text-foreground">
                {h.texto}
                {h.citaPersona && <span className="mt-1 block text-xs italic text-text-muted">{tr('report.saidQuote', { quote: h.citaPersona })}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
            {editing ? tr('report.suggested') : tr('report.commitments')}
          </p>
          <p className="mb-4 text-sm text-text-muted">
            {editing
              ? tr('report.pick')
              : compromisosFecha
                ? tr('report.chosenOn', { date: new Date(compromisosFecha).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') })
                : tr('report.chosenBy')}
          </p>
          <ul className="space-y-3">
            {report.acciones.map((a, i) => {
              if (!editing && !selected.includes(i)) return null
              return (
                <li key={i}>
                  <label className={`flex gap-3 rounded-xl border p-4 ${editing ? 'cursor-pointer hover:bg-secondary' : ''} ${editing && selected.includes(i) ? 'border-accent bg-accent-soft' : 'border-border-color'}`}>
                    {editing && (
                      <input type="checkbox" aria-label={tr('report.pickAria', { text: a.texto })} checked={selected.includes(i)} onChange={() => toggle(i)} className="mt-1 accent-primary print:hidden" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-relaxed text-foreground">{a.texto}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-text-muted">{bloqueLabel(a.bloque)}</span>
                        {tipoLabel(a.tipo) && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-primary">{tipoLabel(a.tipo)}</span>
                        )}
                      </div>
                      {a.fortalezaAncla && <p className="mt-2 text-xs text-text-muted">{tr('report.basedOn', { what: a.fortalezaAncla })}</p>}
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
          {editing && !hasPedido && (
            <p className="mt-3 text-xs text-accent-ink">
              {tr('report.noRequest')}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard title={tr('report.horizon')} body={report.horizonte} />
          <InfoCard title={tr('report.metric')} body={report.metrica} />
          <InfoCard title={tr('report.checkin')} body={report.checkIn} />
        </div>

        {(report.presupuesto || report.respaldo) && (
          <div className="grid gap-4 md:grid-cols-2">
            {report.presupuesto && <InfoCard title={tr('report.budget')} body={report.presupuesto} />}
            {report.respaldo && <InfoCard title={tr('report.planB')} body={report.respaldo} />}
          </div>
        )}

        {report.comparativa && (report.comparativa.criterios.length > 0 || report.comparativa.opciones.length > 0) && (
          <div className="card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('report.compare.title')}</p>
            <p className="mb-4 text-sm text-text-muted">{tr('report.compare.lede')}</p>
            {report.comparativa.criterios.length > 0 && (
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-foreground">
                {report.comparativa.criterios.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            )}
            <ul className="space-y-3">
              {report.comparativa.opciones.map((o, i) => (
                <li key={i} className="rounded-xl border border-border-color p-4 text-sm leading-relaxed">
                  <p className="font-semibold text-foreground">{o.nombre}</p>
                  {o.aFavor && <p className="mt-1 text-foreground"><span className="font-semibold text-primary">{tr('report.compare.pro')}</span> {o.aFavor}</p>}
                  {o.enContra && <p className="mt-1 text-foreground"><span className="font-semibold text-accent-ink">{tr('report.compare.con')}</span> {o.enContra}</p>}
                  {o.falta && <p className="mt-1 text-text-muted"><span className="font-semibold">{tr('report.compare.missing')}</span> {o.falta}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted">
              {tr('report.compare.disclaimer')}
            </p>
          </div>
        )}

        {(report.faltaParaCompletar?.length ?? 0) > 0 && (
          <div className="card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('report.gaps.title')}</p>
            <p className="mb-3 text-sm text-text-muted">{tr('report.gaps.lede')}</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
              {report.faltaParaCompletar?.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {report.preguntaAbierta && (
          <div className="ai-tint rounded-2xl p-6" style={{ borderLeft: '3px solid var(--color-accent)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tr('report.take')}</p>
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
            className="btn-advance flex-1 py-3.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected.length ? trn('report.take.n', selected.length) : tr('report.take.zero')}
          </button>
        ) : (
          <>
            <button onClick={() => window.print()} className="btn-primary flex-1 py-3.5">
              {tr('report.print')}
            </button>
            <button onClick={() => setEditing(true)} className="btn-secondary py-3.5">
              {tr('report.edit')}
            </button>
          </>
        )}
      </div>
      {!editing && (
        <p className="mt-4 text-center text-xs text-text-muted print:hidden">
          {tr('report.saved')}
        </p>
      )}
      {!editing && session && <SaveCard session={session} />}
      {/* Acción destructiva: lejos de los botones principales y con confirmación. */}
      <div className="mt-12 border-t border-border-color pt-6 text-center print:hidden">
        <button onClick={() => setConfirmRestart(true)} className="text-sm text-text-muted underline underline-offset-2 transition hover:text-foreground">
          {tr('report.restart')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmRestart}
        title={tr('report.restartTitle')}
        body={tr('report.restartConfirm')}
        confirmLabel={tr('report.restartAction')}
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false)
          onRestart()
        }}
      />
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
