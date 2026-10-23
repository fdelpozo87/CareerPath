import { useCallback, useEffect, useState } from 'react'
import { compartidas, creadas, eliminar, mias, type EstadoAsignacion, type ItemCompartida, type ItemCreada, type ItemMia } from '../../lib/evaluaciones'
import { getLang, tr, type Key } from '../../lib/i18n'
import ConfirmDialog from '../ConfirmDialog'
import AccountMenu, { type AccountInfo } from '../AccountMenu'
import LanguageToggle from '../LanguageToggle'
import Logo from '../Logo'
import ThemeToggle from '../ThemeToggle'
import { AnswerView } from './AnswerView'
import { Builder } from './Builder'
import { SelfStart } from './SelfStart'

// Evaluaciones de desempeño: lo que me asignaron (o me armé), lo que creé para otras personas, y los accesos
// para crear una evaluación o evaluarme. Quien responde siempre es una cuenta de Bivio.

type View = { kind: 'home' } | { kind: 'builder'; modo: 'jefe' | 'propia' } | { kind: 'open'; id: string }

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') : '')

const BADGE: Record<EstadoAsignacion, string> = {
  pendiente: 'border border-accent text-accent-ink',
  en_curso: 'border border-dashed border-text-muted/60 text-text-muted',
  completada: 'bg-primary-soft text-primary',
}

interface EvaluacionesPageProps {
  canCreate: boolean
  canSelf: boolean
  /** Vuelve a la home. */
  onBack: () => void
  /** Vuelve a la home y baja a esa parte ("Para profesionales" o "Para empresas"). */
  onNavigate: (anchor: 'profesional' | 'empresa') => void
  onPending: (n: number) => void
  account: AccountInfo
  areas: { profesionales: boolean; empresas: boolean }
}

export function EvaluacionesPage({ canCreate, canSelf, onBack, onNavigate, onPending, account, areas }: EvaluacionesPageProps) {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [mine, setMine] = useState<ItemMia[] | null>(null)
  const [created, setCreated] = useState<ItemCreada[]>([])
  const [shared, setShared] = useState<ItemCompartida[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<ItemCreada | null>(null)

  const load = useCallback(async () => {
    try {
      const m = await mias()
      setMine(m.items)
      onPending(m.pendientes)
      if (canCreate) setCreated((await creadas()).items)
      setShared((await compartidas()).items)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    }
  }, [canCreate, onPending])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el servidor; el estado se actualiza al responder
    void load()
  }, [load])

  const home = () => {
    setView({ kind: 'home' })
    void load()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm print:hidden">
        <div className="section-container flex items-center gap-4 py-4">
          <button onClick={onBack} className="text-sm text-text-muted transition-colors hover:text-foreground">
            {tr('common.home')}
          </button>
          <Logo />
          <div className="ml-auto flex items-center gap-4">
            <nav className="hidden gap-6 md:flex" aria-label={tr('eval.nav')}>
              {areas.profesionales && (
                <button onClick={() => onNavigate('profesional')} className="text-sm text-text-muted transition-colors hover:text-foreground">
                  {tr('nav.professionals')}
                </button>
              )}
              {areas.empresas && (
                <button onClick={() => onNavigate('empresa')} className="text-sm text-text-muted transition-colors hover:text-foreground">
                  {tr('nav.companies')}
                </button>
              )}
            </nav>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <AccountMenu account={account} />
            </div>
          </div>
        </div>
      </header>

      <main className="section-container max-w-3xl flex-1 py-10">
        {view.kind === 'builder' && view.modo === 'jefe' && <Builder onBack={home} />}
        {view.kind === 'builder' && view.modo === 'propia' && <SelfStart onBack={home} onOpen={(id) => setView({ kind: 'open', id })} />}
        {view.kind === 'open' && <AnswerView id={view.id} onBack={home} onChanged={() => void load()} />}

        {view.kind === 'home' && (
          <>
            <h1 className="mb-1 text-2xl md:text-3xl">{tr('eval.title')}</h1>
            <p className="mb-6 text-sm text-text-muted">{tr('eval.lede')}</p>

            <div className="mb-8 flex flex-wrap gap-3">
              {canCreate && (
                <button onClick={() => setView({ kind: 'builder', modo: 'jefe' })} className="btn-advance px-6 py-3 text-sm">
                  {tr('eval.create')}
                </button>
              )}
              {canSelf && (
                <button onClick={() => setView({ kind: 'builder', modo: 'propia' })} className={canCreate ? 'btn-secondary px-6 py-3 text-sm' : 'btn-advance px-6 py-3 text-sm'}>
                  {tr('eval.self')}
                </button>
              )}
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
                {error}
              </p>
            )}

            <section aria-labelledby="mias" className="mb-10">
              <h2 id="mias" className="mb-3 text-lg">
                {tr('eval.mine.title')}
              </h2>
              {mine === null ? (
                <p role="status" className="text-sm text-text-muted">{tr('common.loading')}</p>
              ) : mine.length === 0 ? (
                <p className="text-sm text-text-muted">{tr('eval.mine.empty')}</p>
              ) : (
                <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card">
                  {mine.map((m) => (
                    <li key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{m.titulo}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                          <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE[m.estado]}`}>{tr(`eval.estado.${m.estado}` as Key)}</span>
                          <span>{m.tipo === 'directa' ? tr('eval.mine.self') : tr('eval.mine.by', { who: m.creadaPor })}</span>
                          {m.conPuntaje && <span className="rounded-full border border-accent bg-accent-soft px-2.5 py-0.5 font-medium text-foreground">{tr('eval.mine.scored')}</span>}
                          <span>{fmt(m.asignadaAt)}</span>
                        </p>
                      </div>
                      <button onClick={() => setView({ kind: 'open', id: m.id })} className={`${m.estado === 'completada' ? 'btn-secondary' : 'btn-primary'} shrink-0 px-5 py-2.5 text-sm`}>
                        {tr(m.estado === 'completada' ? 'eval.mine.view' : m.estado === 'en_curso' ? 'eval.mine.continue' : 'eval.mine.start')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {shared.length > 0 && (
              <section aria-labelledby="compartidas" className="mb-10">
                <h2 id="compartidas" className="mb-1 text-lg">
                  {tr('eval.shared.title')}
                </h2>
                <p className="mb-3 text-sm text-text-muted">{tr('eval.shared.lede')}</p>
                <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card">
                  {shared.map((c) => (
                    <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{c.titulo}</p>
                        <p className="text-xs text-text-muted">{tr('eval.shared.from', { who: c.de })} · {fmt(c.compartidaAt)}</p>
                      </div>
                      <button onClick={() => setView({ kind: 'open', id: c.id })} className="btn-secondary shrink-0 px-5 py-2.5 text-sm">
                        {tr('eval.mine.view')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {canCreate && (
              <section aria-labelledby="creadas">
                <h2 id="creadas" className="mb-3 text-lg">
                  {tr('eval.created.title')}
                </h2>
                {created.length === 0 ? (
                  <p className="text-sm text-text-muted">{tr('eval.created.empty')}</p>
                ) : (
                  <ul className="space-y-4">
                    {created.map((c) => (
                      <li key={c.id} className="card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{c.titulo}</p>
                            <p className="text-xs text-text-muted">{[c.area, c.rol, c.periodo].filter(Boolean).join(' · ')} · {fmt(c.createdAt)}</p>
                          </div>
                          <button onClick={() => setToDelete(c)} className="shrink-0 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
                            {tr('eval.created.delete')}
                          </button>
                        </div>
                        <ul className="mt-3 divide-y divide-border-color text-sm">
                          {c.asignaciones.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span className="min-w-0 truncate text-foreground">{a.email}</span>
                              <span className="flex items-center gap-3">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[a.estado]}`}>{tr(`eval.estado.${a.estado}` as Key)}</span>
                                {a.estado === 'completada' && (
                                  <>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.puntuada ? 'border border-accent bg-accent-soft text-foreground' : 'border border-dashed border-text-muted/60 text-text-muted'}`}>
                                      {tr(a.puntuada ? 'eval.score.done' : 'eval.score.pending')}
                                    </span>
                                    <button onClick={() => setView({ kind: 'open', id: a.id })} className="text-xs font-semibold text-primary underline underline-offset-2">
                                      {tr(a.puntuada ? 'eval.mine.view' : 'eval.created.view')}
                                    </button>
                                  </>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={toDelete !== null}
        title={tr('eval.created.deleteTitle')}
        body={tr('eval.created.deleteBody', { title: toDelete?.titulo ?? '' })}
        confirmLabel={tr('eval.created.deleteAction')}
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const c = toDelete
          setToDelete(null)
          if (c) void eliminar(c.id).then(() => load()).catch((e) => setError(e instanceof Error ? e.message : tr('cloud.error')))
        }}
      />
    </div>
  )
}
