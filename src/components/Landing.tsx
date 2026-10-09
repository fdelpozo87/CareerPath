import type { ReactNode } from 'react'
import type { Path, Session } from '../lib/coach/types'
import { STAGE_LABEL } from '../../shared/stages'

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

const PATHS: { id: Path; tag: string; icon: ReactNode; title: string; body: string }[] = [
  {
    id: 'quiebre',
    tag: 'Camino A',
    icon: <RouteIcon />,
    title: 'Me siento estancado/a y no sé qué hacer con eso',
    body: 'Llevás un tiempo con la misma duda: ¿me quedo, intento crecer acá o toca cambiar de rumbo? Podemos ponerle palabras y orden de prioridad a esa pregunta.',
  },
  {
    id: 'perfil',
    tag: 'Camino B',
    icon: <SearchIcon />,
    title: 'Quiero explorar el mercado, empezando por mi perfil',
    body: 'Te interesan nuevas oportunidades, pero antes de salir a buscar querés saber qué comunica tu perfil hoy para los puestos que te atraen.',
  },
]

interface LandingProps {
  onChoosePath: (path: Path) => void
  saved: Session | null
  onResume: () => void
}

export default function Landing({ onChoosePath, saved, onResume }: LandingProps) {
  return (
    <section id="profesional" className="py-16 md:py-24">
      <div className="section-container">
        {saved && (
          <div className="mx-auto mb-12 flex max-w-4xl flex-col gap-3 rounded-2xl border border-primary/20 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Tenés un proceso en curso</p>
              <p className="text-sm text-text-muted">
                {saved.compromisos
                  ? `Asumiste ${saved.compromisos.length} compromiso${saved.compromisos.length === 1 ? '' : 's'}. Retomá desde ahí.`
                  : saved.phase === 'informe'
                    ? 'Tu informe de cierre te espera para elegir tus compromisos.'
                    : `Quedaste en ${STAGE_LABEL[saved.stage]}.`}
              </p>
            </div>
            <button onClick={onResume} className="btn-primary shrink-0 px-5 py-2.5 text-sm">
              Retomar →
            </button>
          </div>
        )}

        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Un momento para decidir</p>
          <h1 className="mb-5 leading-tight">Antes de empezar: ¿dónde estás parada o parado hoy?</h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-text-muted">
            Elegí el punto de partida que más se parezca a tu situación. No es un test y no queda nada definido hoy: lo
            afinamos conversando.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          {PATHS.map((p) => (
            <div key={p.id} className="card flex flex-col p-7">
              <div className="mb-6 flex items-center justify-between">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  {p.tag}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg text-primary" aria-hidden>
                  {p.icon}
                </span>
              </div>
              <h2 className="mb-3 text-xl leading-snug">{p.title}</h2>
              <p className="mb-8 flex-1 text-sm leading-relaxed text-text-muted">{p.body}</p>
              {/* Mismo estilo en los dos: ningún camino se presenta como el recomendado. */}
              <button onClick={() => onChoosePath(p.id)} className="btn-primary w-full py-3">
                Empezar por acá
              </button>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 max-w-3xl text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Los dos caminos llevan al mismo proceso acompañado
          </p>
          <ol className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            {(['diagnostico', 'discovery', 'plan'] as const).map((s, i) => (
              <li key={s} className="flex items-center gap-2.5 text-sm text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border-color bg-card text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                {s === 'discovery' ? 'Exploración de opciones' : STAGE_LABEL[s]}
                {i < 2 && <span className="hidden text-border-color sm:inline">—</span>}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-text-muted">
            Conversación guiada con preguntas — no veredictos, ni respuestas automáticas.
          </p>
        </div>
      </div>
    </section>
  )
}
