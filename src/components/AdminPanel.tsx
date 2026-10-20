import { useCallback, useEffect, useState } from 'react'
import { deleteUserAccount, listUsers, setUserEstado, type AdminUser, type Estado } from '../lib/admin'
import { getLang, tr, type Key } from '../lib/i18n'
import ConfirmDialog from './ConfirmDialog'
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

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('todos')
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
      setError(null)
    } catch (e) {
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
        <h1 className="mb-1 text-2xl md:text-3xl">{tr('admin.title')}</h1>
        <p className="mb-6 text-sm text-text-muted">{tr('admin.lede')}</p>

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
                    <div className="flex shrink-0 items-center gap-4">
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
                        onClick={() => setToDelete(u)}
                        disabled={busy}
                        className="text-sm text-text-muted underline underline-offset-2 hover:text-danger disabled:opacity-50"
                      >
                        {tr('admin.delete')}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <ConfirmDialog
        open={toDelete !== null}
        title={tr('admin.deleteTitle')}
        body={tr('admin.deleteConfirm', { email: toDelete?.email ?? '' })}
        confirmLabel={tr('admin.deleteAction')}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const u = toDelete
          setToDelete(null)
          if (u) void act(u.user_id, () => deleteUserAccount(u.user_id))
        }}
      />
    </div>
  )
}
