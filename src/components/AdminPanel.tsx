import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { AdminError, addUser, deleteUserAccount, listAudit, listUsers, setUserAreas, setUserEstado, type AdminUser, type AuditEntry, type Estado } from '../lib/admin'
import { getLang, tr, type Key } from '../lib/i18n'
import ConfirmDialog from './ConfirmDialog'
import { MfaStep } from './MfaStep'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

// Panel de administración: quién tiene cuenta y quién puede usar Bivio. Solo lo ve quien administra
// (el servidor lo verifica en cada pedido; esta pantalla no decide nada por sí sola).

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(getLang() === 'en' ? 'en-US' : 'es', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const BADGE: Record<Estado, string> = {
  pendiente: 'border border-accent text-accent-ink',
  activo: 'bg-primary-soft text-primary',
  desactivado: 'border border-dashed border-text-muted/60 text-text-muted',
}

type Filter = 'todos' | 'pendiente'

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  // El servidor pide verificación en dos pasos antes de dejar tocar nada.
  const [needsMfa, setNeedsMfa] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('todos')
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [notify, setNotify] = useState(true)
  const [newProf, setNewProf] = useState(true)
  const [newEmp, setNewEmp] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)
  const addId = useId()

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
      setNeedsMfa(false)
      setError(null)
      setAudit(await listAudit().catch(() => []))
    } catch (e) {
      if (e instanceof AdminError && e.reason === 'mfa_required') return setNeedsMfa(true)
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el servidor; el estado se actualiza al responder
    void load()
  }, [load])

  const act = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id)
    try {
      await run()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    } finally {
      setBusyId(null)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email || adding) return
    setAdding(true)
    setAddMsg(null)
    setError(null)
    try {
      const r = await addUser(email, notify, { profesionales: newProf, empresas: newEmp })
      setAddMsg(
        tr(r.created ? 'admin.add.created' : 'admin.add.existing', { email }) +
          (notify ? ' ' + tr(r.notified ? 'admin.add.notified' : 'admin.add.notNotified') : ''),
      )
      setNewEmail('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('cloud.error'))
    } finally {
      setAdding(false)
    }
  }

  const pending = users?.filter((u) => u.estado === 'pendiente').length ?? 0
  const shown = (users ?? []).filter((u) => filter === 'todos' || u.estado === 'pendiente')

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="border-b border-border-color">
        <div className="section-container flex items-center justify-between py-4">
          <button onClick={onBack} className="flex items-center gap-3">
            <Logo />
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="section-container flex-1 py-10">
        <button onClick={onBack} className="mb-4 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
          ← {tr('admin.back')}
        </button>
        {needsMfa ? (
          <MfaStep onDone={() => void load()} />
        ) : (
          <>
        <h1 className="mb-1 text-2xl md:text-3xl">{tr('admin.title')}</h1>
        <p className="mb-6 text-sm text-text-muted">{tr('admin.lede')}</p>

        <form onSubmit={add} className="card mb-6">
          <h2 className="mb-1 text-base">{tr('admin.add.title')}</h2>
          <p className="mb-3 text-sm text-text-muted">{tr('admin.add.lede')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor={addId} className="mb-1 block text-sm font-medium text-foreground">
                {tr('cloud.email')}
              </label>
              <input
                id={addId}
                type="email"
                required
                autoComplete="off"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="persona@correo.com"
                className="w-full rounded-xl border border-border-color bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </div>
            <button type="submit" disabled={adding || !newEmail.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
              {tr('admin.add.button')}
            </button>
          </div>
          <fieldset className="mt-3">
            <legend className="mb-1 text-sm font-medium text-foreground">{tr('admin.areas.legend')}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newProf} onChange={(e) => setNewProf(e.target.checked)} className="accent-primary" />
                {tr('admin.area.profesionales')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newEmp} onChange={(e) => setNewEmp(e.target.checked)} className="accent-primary" />
                {tr('admin.area.empresas')}
              </label>
            </div>
          </fieldset>
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-primary" />
            {tr('admin.add.notify')}
          </label>
          <p role="status" className="mt-2 min-h-5 text-sm text-text-muted">
            {addMsg}
          </p>
        </form>

        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={tr('admin.filter')}>
          {(['todos', 'pendiente'] as const).map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${filter === f ? 'bg-primary text-on-primary' : 'border border-border-color text-text-muted hover:bg-secondary'}`}
            >
              {f === 'todos' ? tr('admin.filter.all', { n: users?.length ?? 0 }) : tr('admin.filter.pending', { n: pending })}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}

        {users === null && !error ? (
          <p role="status" className="text-sm text-text-muted">
            {tr('common.loading')}
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-text-muted">{tr('admin.empty')}</p>
        ) : (
          <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card">
            {shown.map((u) => {
              const on = u.estado === 'activo'
              const busy = busyId === u.user_id
              return (
                <li key={u.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {u.email || '—'} {u.isSelf && <span className="font-normal text-text-muted">({tr('admin.you')})</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE[u.estado]}`}>{tr(`admin.estado.${u.estado}` as Key)}</span>
                      <span>{tr('admin.created', { date: fmt(u.created_at) })}</span>
                      <span>{tr('admin.lastSeen', { date: fmt(u.last_seen_at) })}</span>
                    </p>
                  </div>
                  {!u.isSelf && (
                    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
                      {(['profesionales', 'empresas'] as const).map((area) => {
                        const enabled = area === 'profesionales' ? u.acceso_profesionales : u.acceso_empresas
                        return (
                          <label key={area} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={tr('admin.areaAria', { area: tr(`admin.area.${area}` as Key), email: u.email })}
                              disabled={busy}
                              onClick={() => void act(u.user_id, () => setUserAreas(u.user_id, { [area]: !enabled }))}
                              className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${enabled ? 'bg-primary' : 'bg-border-color'}`}
                            >
                              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${enabled ? 'left-[1.375rem]' : 'left-0.5'}`} />
                            </button>
                            {tr(`admin.area.${area}` as Key)}
                          </label>
                        )
                      })}
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={tr('admin.switchAria', { email: u.email })}
                          disabled={busy}
                          onClick={() => void act(u.user_id, () => setUserEstado(u.user_id, on ? 'desactivado' : 'activo'))}
                          className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${on ? 'bg-primary' : 'bg-border-color'}`}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
                        </button>
                        {on ? tr('admin.switch.on') : tr('admin.switch.off')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setToDelete(u)}
                        disabled={busy}
                        aria-label={tr('admin.deleteAria', { email: u.email })}
                        title={tr('admin.delete')}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {audit.length > 0 && (
          <section aria-labelledby="actividad" className="mt-10">
            <h2 id="actividad" className="mb-1 text-base">
              {tr('admin.audit.title')}
            </h2>
            <p className="mb-3 text-sm text-text-muted">{tr('admin.audit.lede')}</p>
            <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-foreground">{tr(`admin.audit.${a.action}` as Key, { actor: a.actor_email, target: a.target_email })}</span>
                  <span className="shrink-0 text-xs text-text-muted">{fmt(a.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={toDelete !== null}
        title={tr('admin.deleteTitle')}
        body={tr('admin.deleteConfirm', { email: toDelete?.email ?? '' })}
        confirmLabel={tr('admin.deleteAction')}
        onCancel={() => setToDelete(null)}
        destructive
        onConfirm={() => {
          const u = toDelete
          setToDelete(null)
          if (u) {
            void act(u.user_id, async () => {
              await deleteUserAccount(u.user_id)
              setAddMsg(tr('admin.deleted', { email: u.email }))
            })
          }
        }}
      />
    </div>
  )
}
