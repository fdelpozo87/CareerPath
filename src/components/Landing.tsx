import type { Path, Session } from '../lib/coach/types'
import { STAGE_ORDER } from '../../shared/stages'
import { getLang, stageLabel, tr, trn, type Key } from '../lib/i18n'
import PathIllustration from './PathIllustrations'

// Pantalla de inicio: los tres caminos con su dibujo animado y, si ya hay procesos guardados, la lista de
// procesos a la izquierda y "Empezar una nueva" a la derecha. Los tres caminos son iguales entre sí:
// ninguno se presenta como el recomendado.

const PATHS: { id: Path; letter: 'A' | 'B' | 'C' }[] = [
  { id: 'quiebre', letter: 'A' },
  { id: 'perfil', letter: 'B' },
  { id: 'formacion', letter: 'C' },
]

/** Fondo de cada dibujo: durazno, lila y bruma, como en el diseño. */
const illustrationBg: Record<Path, string> = {
  quiebre: 'bg-accent-soft',
  perfil: 'bg-primary-soft',
  formacion: 'bg-secondary',
}

const textOf = (letter: 'A' | 'B' | 'C') => ({
  tag: tr(`landing.path${letter}.tag` as Key),
  title: tr(`landing.path${letter}.title` as Key),
  body: tr(`landing.path${letter}.body` as Key),
})

function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

/** Tarjeta grande: dibujo arriba, texto y botón. Toda la tarjeta es el botón (el enlace se estira). */
function PathCard({ id, letter, onChoose }: { id: Path; letter: 'A' | 'B' | 'C'; onChoose: (p: Path) => void }) {
  const { title, body } = textOf(letter)
  return (
    <div className="group card relative flex flex-col overflow-hidden rounded-3xl p-0 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_40px_-18px_rgb(106_63_193/0.35)] focus-within:border-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span className={`relative block h-44 px-8 pb-6 pt-10 ${illustrationBg[id]}`}>
        <span className="absolute left-6 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-card font-display text-xs font-bold text-primary" aria-hidden="true">
          {letter}
        </span>
        <PathIllustration path={id} />
      </span>
      <div className="flex flex-1 flex-col p-7">
        <h2 className="mb-3 text-xl leading-snug">{title}</h2>
        <p className="mb-8 flex-1 text-sm leading-relaxed text-text-muted">{body}</p>
        <div>
          <button onClick={() => onChoose(id)} className="btn-primary gap-2 px-5 py-2.5 text-sm after:absolute after:inset-0 after:content-[''] group-hover:bg-primary-dark">
            {tr('landing.start')}
            <Arrow className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
          </button>
        </div>
      </div>
    </div>
  )
}

const statusOf = (s: Session) =>
  s.compromisos
    ? trn('landing.resume.commitments', s.compromisos.length)
    : s.phase === 'informe'
      ? tr('landing.resume.report')
      : s.phase === 'perfil'
        ? tr('process.status.profile')
        : tr('landing.resume.stage', { stage: stageLabel(s.stage) })

/** Cada etapa: hecha, en curso o por venir. */
const progressOf = (s: Session): ('done' | 'current' | 'todo')[] => {
  const idx = STAGE_ORDER.indexOf(s.stage)
  return STAGE_ORDER.map((_, i) => (s.compromisos || s.phase === 'informe' ? 'done' : s.phase === 'perfil' ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo'))
}

const segment = { done: 'bg-primary', current: 'bg-accent', todo: 'bg-primary-soft' } as const

function ProcessCard({
  process: p,
  latest,
  onResume,
  onDelete,
}: {
  process: Session
  latest: boolean
  onResume: (id: string) => void
  onDelete: (id: string) => void
}) {
  const name = tr(`process.name.${p.path}` as Key)
  const progress = progressOf(p)
  return (
    <li className="card rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{name}</p>
          <p className="font-display text-lg font-bold leading-snug text-foreground">{statusOf(p)}</p>
          <p className="mt-1 text-xs text-text-muted">{tr('process.updated', { date: new Date(p.updatedAt).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {/* Solo el proceso más reciente lleva el color de "seguir": un único punto de mandarina en la pantalla. */}
          <button onClick={() => onResume(p.id)} className={`${latest ? 'btn-advance' : 'btn-primary'} px-5 py-2.5 text-sm`}>
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
      </div>
      <ol role="list" aria-label={tr('flow.stages')} className="mt-5 grid grid-cols-3 gap-2">
        {STAGE_ORDER.map((st, i) => (
          <li key={st} aria-current={progress[i] === 'current' ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full ${segment[progress[i]]}`} aria-hidden="true" />
            <span className={`mt-1.5 block text-xs ${progress[i] === 'current' ? 'font-semibold text-foreground' : 'text-text-muted'}`}>{stageLabel(st)}</span>
          </li>
        ))}
      </ol>
    </li>
  )
}

interface LandingProps {
  onChoosePath: (path: Path) => void
  /** Procesos guardados en este navegador, el más reciente primero. */
  processes: Session[]
  onResume: (id: string) => void
  onDelete: (id: string) => void
  /** Si la cuenta no tiene habilitado "Para profesionales", no se muestran los caminos. */
  showPaths?: boolean
  /** Nombre de quien tiene la sesión iniciada, para saludarla. Sin nombre, el saludo va sin él. */
  name?: string
}

export default function Landing({ onChoosePath, processes, onResume, onDelete, showPaths = true, name }: LandingProps) {
  const hasProcesses = processes.length > 0
  const sessions = hasProcesses && (
    <section aria-labelledby="mis-procesos">
      <h2 id="mis-procesos" className="mb-1 text-2xl">
        {tr('process.title')}
      </h2>
      <p className="mb-4 text-sm text-text-muted">{tr('process.lede')}</p>
      <ul role="list" className="grid gap-4 md:grid-cols-2">
        {processes.map((p, i) => (
          <ProcessCard key={p.id} process={p} latest={i === 0} onResume={onResume} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )

  return (
    <section id="profesional" className="py-16 md:py-24">
      <div className="section-container">
        {showPaths && (
          <>
            <h1 className="mx-auto mb-10 max-w-6xl leading-tight">
              {tr(name ? 'landing.hello' : 'landing.helloAnon', { name: name ?? '' })} <span className="text-primary-dark">{tr('landing.ask')}</span>
            </h1>

            {sessions && <div className="mx-auto mb-14 max-w-6xl">{sessions}</div>}

            <div className="mx-auto max-w-6xl">
              {hasProcesses ? (
                <h2 id="empezar-nueva" className="mb-5 text-2xl">
                  {tr('landing.newSession')}
                </h2>
              ) : (
                <div className="mb-6">
                  <h2 className="mb-2 text-2xl">{tr('landing.first.title')}</h2>
                  <p className="text-text-muted">{tr('landing.first.lede')}</p>
                </div>
              )}
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {PATHS.map((p) => (
                  <PathCard key={p.id} {...p} onChoose={onChoosePath} />
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold text-text-muted">{tr('landing.pathC.note')}</p>
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
        {!showPaths && hasProcesses && <div className="mx-auto max-w-3xl">{sessions}</div>}
      </div>
    </section>
  )
}
