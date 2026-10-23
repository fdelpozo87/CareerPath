import type { ReactNode } from 'react'
import type { Path, Session } from '../lib/coach/types'
import { getLang, stageLabel, tr, trn, type Key } from '../lib/i18n'

// Pantalla de inicio — Variante 1 del mockup de Lovable ("Dos caminos lado a
// lado"). Los dos caminos del guardrail (§1 y §4) quedan visibles de entrada.

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function CapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M22 9 12 4 2 9l10 5 10-5Z" />
      <path d="M6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5" />
    </svg>
  )
}

const paths = (): { id: Path; tag: string; icon: ReactNode; title: string; body: string; note?: string }[] => [
  { id: 'quiebre', tag: tr('landing.pathA.tag'), icon: <RouteIcon />, title: tr('landing.pathA.title'), body: tr('landing.pathA.body') },
  { id: 'perfil', tag: tr('landing.pathB.tag'), icon: <SearchIcon />, title: tr('landing.pathB.title'), body: tr('landing.pathB.body') },
  { id: 'formacion', tag: tr('landing.pathC.tag'), icon: <CapIcon />, title: tr('landing.pathC.title'), body: tr('landing.pathC.body'), note: tr('landing.pathC.note') },
]

interface LandingProps {
  onChoosePath: (path: Path) => void
  /** Procesos guardados en este navegador, el más reciente primero. */
  processes: Session[]
  onResume: (id: string) => void
  onDelete: (id: string) => void
  /** Si la cuenta no tiene habilitado "Para profesionales", no se muestran los caminos. */
  showPaths?: boolean
}

const statusOf = (s: Session) =>
  s.compromisos
    ? trn('landing.resume.commitments', s.compromisos.length)
    : s.phase === 'informe'
      ? tr('landing.resume.report')
      : s.phase === 'perfil'
        ? tr('process.status.profile')
        : tr('landing.resume.stage', { stage: stageLabel(s.stage) })

export default function Landing({ onChoosePath, processes, onResume, onDelete, showPaths = true }: LandingProps) {
  return (
    <section id="profesional" className="py-16 md:py-24">
      <div className="section-container">
        {processes.length > 0 && (
          <section aria-labelledby="mis-procesos" className="mx-auto mb-12 max-w-6xl rounded-2xl border border-primary/20 bg-card p-5">
            <h2 id="mis-procesos" className="mb-1 text-base font-semibold text-foreground">
              {tr('process.title')}
            </h2>
            <p className="mb-3 text-sm text-text-muted">{tr('process.lede')}</p>
            <ul className="divide-y divide-border-color">
              {processes.map((p, i) => {
                const name = tr(`process.name.${p.path}` as Key)
                return (
                  <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{name}</p>
                      <p className="text-sm text-text-muted">{statusOf(p)}</p>
                      <p className="text-xs text-text-muted">
                        {tr('process.updated', { date: new Date(p.updatedAt).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {/* Solo el proceso más reciente lleva el color de "seguir": un único punto de mandarina en la pantalla. */}
                      <button onClick={() => onResume(p.id)} className={`${i === 0 ? 'btn-advance' : 'btn-primary'} px-5 py-2.5 text-sm`}>
                        {tr('landing.resume.button')}
                      </button>
                      <button
                        onClick={() => onDelete(p.id)}
                        aria-label={tr('process.deleteAria', { name })}
                        className="text-sm text-text-muted underline underline-offset-2 transition hover:text-foreground"
                      >
                        {tr('process.delete')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {showPaths && (
          <>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">{tr('landing.eyebrow')}</p>
              <h1 className="mb-5 leading-tight">{tr('landing.title')}</h1>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-text-muted">
                {tr('landing.lede')}
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
              {paths().map((p) => (
                <div key={p.id} className="card flex flex-col p-7 transition-colors hover:border-accent focus-within:border-accent">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                      {p.tag}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg text-primary" aria-hidden>
                      {p.icon}
                    </span>
                  </div>
                  <h2 className="mb-3 text-xl leading-snug">{p.title}</h2>
                  <p className={`${p.note ? 'mb-3' : 'mb-8'} flex-1 text-sm leading-relaxed text-text-muted`}>{p.body}</p>
                  {p.note && <p className="mb-5 text-xs font-semibold text-text-muted">{p.note}</p>}
                  {/* Mismo estilo en los dos: ningún camino se presenta como el recomendado. */}
                  <button onClick={() => onChoosePath(p.id)} className="btn-primary w-full py-3">
                    {tr('landing.start')}
                  </button>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-14 max-w-4xl">
              <div className="glass-stage px-5 py-10 text-center sm:px-10 sm:py-12">
                <p className="glass-kicker mb-7 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  {tr('landing.steps.title')}
                </p>
                <ol className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-3">
                  {(['diagnostico', 'discovery', 'plan'] as const).map((s, i) => (
                    <li key={s} className="flex items-center gap-3">
                      <span className="glass-pill" style={{ animationDelay: `${i * 1.1}s` }}>
                        <span className="glass-dot" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium">{s === 'discovery' ? tr('landing.steps.discovery') : stageLabel(s)}</span>
                      </span>
                      {i < 2 && <span aria-hidden="true" className="glass-link hidden h-px w-6 sm:block" />}
                    </li>
                  ))}
                </ol>
                <p className="glass-pill glass-pill--quiet mt-8 text-sm">
                  {tr('landing.steps.note')}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
