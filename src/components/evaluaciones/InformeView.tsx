import type { Informe } from '../../lib/evaluaciones'
import { tr } from '../../lib/i18n'

// El informe de una autoevaluación: lo que la persona escribió, ordenado. Sin puntaje ni veredicto.

export function InformeView({ informe, isAdmin = false }: { informe: Informe; isAdmin?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="card break-inside-avoid print:shadow-none">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tr('eval.report.summary')}</p>
        <p className="text-sm leading-relaxed text-foreground">{informe.resumen}</p>
        <p className="mt-3 text-xs text-text-muted">{tr('eval.report.disclaimer')}</p>
      </div>

      {informe.fortalezas.length > 0 && <Evidence title={tr('eval.report.strengths')} items={informe.fortalezas} />}
      {informe.desarrollo.length > 0 && <Evidence title={tr('eval.report.growth')} items={informe.desarrollo} />}

      {informe.coherencia.length > 0 && (
        <div className="card break-inside-avoid print:shadow-none" style={{ borderLeft: '3px solid var(--color-accent)' }}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('eval.report.coherence')}</p>
          <p className="mb-3 text-sm text-text-muted">{tr('eval.report.coherenceLede')}</p>
          <ul className="space-y-2 text-sm leading-relaxed text-foreground">
            {informe.coherencia.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.competencia}.</span> {c.nota}
              </li>
            ))}
          </ul>
        </div>
      )}

      {informe.planDesarrollo.length > 0 && (
        <div className="card print:shadow-none">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('eval.report.plan')}</p>
          <ul className="space-y-3">
            {informe.planDesarrollo.map((a, i) => (
              <li key={i} className="break-inside-avoid rounded-xl border border-border-color p-4">
                <p className="text-sm font-medium leading-relaxed text-foreground">{a.texto}</p>
                <p className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-text-muted">{tr(`report.block.${a.bloque}` as Parameters<typeof tr>[0])}</span>
                  {a.plazo && <span className="rounded-full bg-secondary px-2 py-0.5 text-text-muted">{a.plazo}</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {informe.preguntasParaConversar.length > 0 && (
        <div className="ai-tint break-inside-avoid rounded-2xl p-6" style={{ borderLeft: '3px solid var(--color-accent)' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tr('eval.report.questions')}</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
            {informe.preguntasParaConversar.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && (
        <div className="flex justify-end print:hidden">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 btn-secondary px-5 py-2.5 text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" />
            </svg>
            {tr('report.pdf')}
          </button>
        </div>
      )}
    </div>
  )
}

function Evidence({ title, items }: { title: string; items: Informe['fortalezas'] }) {
  return (
    <div className="card print:shadow-none">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</p>
      <ul className="space-y-3">
        {items.map((f, i) => (
          <li key={i} className="break-inside-avoid text-sm leading-relaxed text-foreground">
            <span className="font-semibold">{f.competencia}.</span> {f.texto}
            {f.evidencia && <span className="mt-1 block text-xs italic text-text-muted">{tr('report.saidQuote', { quote: f.evidencia })}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
