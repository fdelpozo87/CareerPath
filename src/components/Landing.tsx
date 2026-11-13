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

/** Ítem compacto para la barra lateral (cuando ya hay sesiones activas). */
function PathItem({ id, letter, onChoose }: { id: Path; letter: 'A' | 'B' | 'C'; onChoose: (p: Path) => void }) {
  const { tag, title } = textOf(letter)
  return (
    <button
      onClick={() => onChoose(id)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border-color bg-card p-5 text-left transition hover:border-primary/30 hover:shadow-sm"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-primary ${illustrationBg[id]}`}>
        {letter}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-text-muted">{tag}</p>
        <p className="text-base font-semibold leading-snug text-foreground">{title}</p>
      </div>
      <Arrow className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
    </button>
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
  onPdf,
}: {
  process: Session
  latest: boolean
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onPdf?: (id: string) => void
}) {
  const name = tr(`process.name.${p.path}` as Key)
  const progress = progressOf(p)
  const finished = p.compromisos !== undefined
  return (
    <li className="card rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{name}</p>
            {finished && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {tr('process.finished')}
              </span>
            )}
          </div>
          <p className="font-display text-lg font-bold leading-snug text-foreground">{statusOf(p)}</p>
          <p className="mt-1 text-xs text-text-muted">{tr('process.updated', { date: new Date(p.updatedAt).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') })}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button onClick={() => onResume(p.id)} className={`${latest && !finished ? 'btn-advance' : 'btn-primary'} px-5 py-2.5 text-sm`}>
            {finished ? tr('process.viewReport') : tr('landing.resume.button')}
          </button>
          {finished && onPdf && (
            <button
              onClick={() => onPdf(p.id)}
              className="flex items-center gap-1.5 rounded-full border border-border-color bg-card px-4 py-2 text-sm font-medium text-text-muted transition hover:border-primary/30 hover:text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" />
              </svg>
              {tr('process.pdf')}
            </button>
          )}
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
  /** Descarga el PDF de un proceso terminado (abre el informe y dispara window.print). */
  onPdf?: (id: string) => void
}

export default function Landing({ onChoosePath, processes, onResume, onDelete, showPaths = true, name, onPdf }: LandingProps) {
  const hasProcesses = processes.length > 0

  return (
    <section id="profesional" className="py-16 md:py-24">
      <div className="section-container">
        {showPaths && (
          <>
            <h1 className="mx-auto mb-10 max-w-6xl leading-tight">
              {tr(name ? 'landing.hello' : 'landing.helloAnon', { name: name ?? '' })} <span className="text-primary-dark">{tr('landing.ask')}</span>
            </h1>

            {hasProcesses ? (
              /* Dos columnas: sesiones activas a la izquierda, opciones compactas a la derecha */
              <div className="mx-auto mb-14 max-w-6xl lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12 xl:grid-cols-[1fr_420px] xl:gap-16">
                <section aria-labelledby="mis-procesos">
                  <h2 id="mis-procesos" className="mb-1 text-2xl">
                    {tr('process.title')}
                  </h2>
                  <p className="mb-4 text-sm text-text-muted">{tr('process.lede')}</p>
                  <ul role="list" className="grid gap-4">
                    {processes.map((p, i) => (
                      <ProcessCard key={p.id} process={p} latest={i === 0} onResume={onResume} onDelete={onDelete} onPdf={onPdf} />
                    ))}
                  </ul>
                </section>

                <aside aria-labelledby="empezar-nueva" className="mt-10 lg:mt-0">
                  <h2 id="empezar-nueva" className="mb-4 text-xl">
                    {tr('landing.newSession')}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {PATHS.map((p) => (
                      <PathItem key={p.id} {...p} onChoose={onChoosePath} />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-text-muted">{tr('landing.pathC.note')}</p>
                </aside>
              </div>
            ) : (
              /* Primera vez: tarjetas grandes a todo ancho */
              <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                  <h2 className="mb-2 text-2xl">{tr('landing.first.title')}</h2>
                  <p className="text-text-muted">{tr('landing.first.lede')}</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {PATHS.map((p) => (
                    <PathCard key={p.id} {...p} onChoose={onChoosePath} />
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold text-text-muted">{tr('landing.pathC.note')}</p>
              </div>
            )}

            <div className="mx-auto mt-14 max-w-6xl">
              <div className="rounded-3xl bg-accent-soft px-6 py-8 sm:px-10 sm:py-10">
                <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  {tr('landing.out.title')}
                </p>
                <ul className="flex flex-col gap-5 sm:flex-row sm:gap-8">
                  {([
                    { key: 'landing.out.1', icon: (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
                      </svg>
                    )},
                    { key: 'landing.out.2', icon: (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" />
                      </svg>
                    )},
                    { key: 'landing.out.3', icon: (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                        <polyline points="3 6 4 7 6 5" /><polyline points="3 12 4 13 6 11" /><polyline points="3 18 4 19 6 17" />
                      </svg>
                    )},
                  ] as const).map(({ key, icon }) => (
                    <li key={key} className="flex items-start gap-3 sm:flex-1">
                      {icon}
                      <span className="text-sm font-medium text-foreground">{tr(key)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
        {!showPaths && hasProcesses && (
          <div className="mx-auto max-w-3xl">
            <section aria-labelledby="mis-procesos-alt">
              <h2 id="mis-procesos-alt" className="mb-1 text-2xl">{tr('process.title')}</h2>
              <p className="mb-4 text-sm text-text-muted">{tr('process.lede')}</p>
              <ul role="list" className="grid gap-4">
                {processes.map((p, i) => (
                  <ProcessCard key={p.id} process={p} latest={i === 0} onResume={onResume} onDelete={onDelete} onPdf={onPdf} />
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
