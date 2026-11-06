import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import {
  AdminError,
  addUser,
  deleteUserAccount,
  listAudit,
  listComentarios,
  listUsers,
  marcarComentario,
  notifyUser,
  setUserAreas,
  setUserEstado,
  setCantidadEmpleados,
  listSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  type AdminUser,
  type AuditEntry,
  type ComentarioItem,
  type Estado,
  type Skill,
} from '../lib/admin'
import { getLang, tr, type Key } from '../lib/i18n'
import ConfirmDialog from './ConfirmDialog'
import { MfaStep } from './MfaStep'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

// Panel de administración: 5 pestañas — Dashboard, Usuarios (gestión), Profesionales, Empresas, Skills.

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(getLang() === 'en' ? 'en-US' : 'es', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const BADGE: Record<Estado, string> = {
  pendiente: 'border border-accent text-accent-ink',
  activo: 'bg-primary-soft text-primary',
  desactivado: 'border border-dashed border-text-muted/60 text-text-muted',
}

type Tab = 'dashboard' | 'usuarios' | 'profesionales' | 'empresas' | 'skills'

// ── Iconos ─────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Toggle({ checked, disabled, aria, onChange }: { checked: boolean; disabled: boolean; aria: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-border-color'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  )
}

function StatCard({ label, value, color = 'primary' }: { label: string; value: number | null; color?: 'primary' | 'accent' | 'muted' }) {
  const bg = color === 'accent' ? 'bg-accent/10' : color === 'muted' ? 'bg-secondary' : 'bg-primary-soft'
  const text = color === 'accent' ? 'text-accent-ink' : color === 'muted' ? 'text-text-muted' : 'text-primary'
  return (
    <div className={`rounded-2xl p-5 ${bg}`}>
      <p className="mb-1 text-sm text-text-muted">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${text}`}>{value === null ? '—' : value}</p>
    </div>
  )
}

// ── Tab: Dashboard ─────────────────────────────────────────────────────────

function DashboardTab({
  users,
  skillCount,
  comentarios,
  audit,
  onMark,
}: {
  users: AdminUser[] | null
  skillCount: number | null
  comentarios: ComentarioItem[]
  audit: AuditEntry[]
  onMark: (id: string, leido: boolean) => void
}) {
  const activos = users?.filter((u) => u.estado === 'activo' && u.acceso_profesionales).length ?? null
  const empresas = users?.filter((u) => u.estado === 'activo' && u.acceso_empresas).length ?? null
  const pendientes = users?.filter((u) => u.estado === 'pendiente').length ?? null

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={tr('admin.card.usuariosActivos')} value={activos} />
        <StatCard label={tr('admin.card.empresasActivas')} value={empresas} color="accent" />
        <StatCard label={tr('admin.card.pendientes')} value={pendientes} color="muted" />
        <StatCard label={tr('admin.card.skillsGlobales')} value={skillCount} />
      </div>

      <section aria-labelledby="comentarios" className="mt-6">
        <h2 id="comentarios" className="mb-1 flex items-center gap-2 text-base">
          {tr('admin.comments.title')}
          {comentarios.some((c) => !c.leido) && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">
              {comentarios.filter((c) => !c.leido).length}
            </span>
          )}
        </h2>
        <p className="mb-3 text-sm text-text-muted">{tr('admin.comments.lede')}</p>
        {comentarios.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-color p-4 text-sm text-text-muted">{tr('admin.comments.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {comentarios.map((c) => (
              <li key={c.id} className={`rounded-2xl border bg-card p-4 text-sm ${c.leido ? 'border-border-color' : 'border-accent'}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary">{tr(`comment.tipo.${c.tipo}` as Key)}</span>
                  {!c.leido && <span className="font-semibold text-accent-ink">{tr('admin.comments.new')}</span>}
                  <span className="text-foreground">{c.email}</span>
                  <span>{fmt(c.created_at)}</span>
                  {c.pagina && <span className="font-mono">{c.pagina}</span>}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-foreground">{c.mensaje}</p>
                <button type="button" onClick={() => onMark(c.id, !c.leido)} className="mt-3 text-sm text-primary underline underline-offset-2 hover:text-primary-dark">
                  {tr(c.leido ? 'admin.comments.markUnread' : 'admin.comments.markRead')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {audit.length > 0 && (
        <section aria-labelledby="actividad" className="mt-10">
          <h2 id="actividad" className="mb-1 text-base">{tr('admin.audit.title')}</h2>
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
    </div>
  )
}

// ── Tab: Usuarios (gestión completa) ───────────────────────────────────────

function UsuariosTab({ users, error, onLoad }: { users: AdminUser[] | null; error: string | null; onLoad: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todos' | 'pendiente'>('todos')
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)
  const [notices, setNotices] = useState<Record<string, string>>({})
  const [newEmail, setNewEmail] = useState('')
  const [notify, setNotify] = useState(true)
  const [newProf, setNewProf] = useState(true)
  const [newEmp, setNewEmp] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const addId = useId()

  const shown = (users ?? []).filter((u) => filter === 'todos' || u.estado === 'pendiente')
  const pending = (users ?? []).filter((u) => u.estado === 'pendiente').length

  const act = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id)
    setLocalError(null)
    try { await run(); onLoad() } catch (e) { setLocalError(e instanceof Error ? e.message : tr('cloud.error')) }
    finally { setBusyId(null) }
  }

  const handleNotify = async (u: AdminUser) => {
    await act(u.user_id, async () => {
      const r = await notifyUser(u.user_id)
      setNotices((p) => ({ ...p, [u.user_id]: r.notified ? tr('admin.notify.sent', { email: u.email }) : tr('admin.notify.failed', { email: u.email }) }))
    })
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email || adding) return
    setAdding(true); setAddMsg(null); setLocalError(null)
    try {
      const r = await addUser(email, notify, { profesionales: newProf, empresas: newEmp })
      setAddMsg(tr(r.created ? 'admin.add.created' : 'admin.add.existing', { email }) + (notify ? ' ' + tr(r.notified ? 'admin.add.notified' : 'admin.add.notNotified') : ''))
      setNewEmail('')
      onLoad()
    } catch (err) { setLocalError(err instanceof Error ? err.message : tr('cloud.error')) }
    finally { setAdding(false) }
  }

  const displayError = localError ?? error

  return (
    <div>
      <form onSubmit={handleAdd} className="card mb-6">
        <h2 className="mb-1 text-base">{tr('admin.add.title')}</h2>
        <p className="mb-3 text-sm text-text-muted">{tr('admin.add.lede')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={addId} className="mb-1 block text-sm font-medium text-foreground">{tr('cloud.email')}</label>
            <input id={addId} type="email" required autoComplete="off" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="persona@correo.com" className="w-full rounded-xl border border-border-color bg-background px-3 py-2.5 text-sm text-foreground" />
          </div>
          <button type="submit" disabled={adding || !newEmail.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{tr('admin.add.button')}</button>
        </div>
        <fieldset className="mt-3">
          <legend className="mb-1 text-sm font-medium text-foreground">{tr('admin.areas.legend')}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
            {(['profesionales', 'empresas'] as const).map((area) => (
              <label key={area} className="flex items-center gap-2">
                <input type="checkbox" checked={area === 'profesionales' ? newProf : newEmp} onChange={(e) => area === 'profesionales' ? setNewProf(e.target.checked) : setNewEmp(e.target.checked)} className="accent-primary" />
                {tr(`admin.area.${area}` as Key)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-primary" />
          {tr('admin.add.notify')}
        </label>
        <p role="status" className="mt-2 min-h-5 text-sm text-text-muted">{addMsg}</p>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group">
        {(['todos', 'pendiente'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm transition ${filter === f ? 'bg-primary text-on-primary' : 'border border-border-color text-text-muted hover:bg-secondary'}`}>
            {f === 'todos' ? tr('admin.filter.all', { n: users?.length ?? 0 }) : tr('admin.filter.pending', { n: pending })}
          </button>
        ))}
      </div>

      {displayError && <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{displayError}</p>}

      {users === null ? (
        <p role="status" className="text-sm text-text-muted">{tr('common.loading')}</p>
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
                    {u.acceso_profesionales && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{tr('admin.area.profesionales')}</span>}
                    {u.acceso_empresas && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-ink">{tr('admin.area.empresas')}</span>}
                    <span>{tr('admin.created', { date: fmt(u.created_at) })}</span>
                    <span>{tr('admin.lastSeen', { date: fmt(u.last_seen_at) })}</span>
                  </p>
                  {notices[u.user_id] && <p className="mt-1 text-xs text-primary">{notices[u.user_id]}</p>}
                </div>
                {!u.isSelf && (
                  <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
                    {(['profesionales', 'empresas'] as const).map((area) => {
                      const enabled = area === 'profesionales' ? u.acceso_profesionales : u.acceso_empresas
                      return (
                        <label key={area} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                          <Toggle checked={enabled} disabled={busy} aria={tr('admin.areaAria', { area: tr(`admin.area.${area}` as Key), email: u.email })} onChange={() => void act(u.user_id, () => setUserAreas(u.user_id, { [area]: !enabled }))} />
                          {tr(`admin.area.${area}` as Key)}
                        </label>
                      )
                    })}
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <Toggle checked={on} disabled={busy} aria={tr('admin.switchAria', { email: u.email })} onChange={() => void act(u.user_id, () => setUserEstado(u.user_id, on ? 'desactivado' : 'activo'))} />
                      {on ? tr('admin.switch.on') : tr('admin.switch.off')}
                    </label>
                    <button type="button" onClick={() => void handleNotify(u)} disabled={busy} aria-label={tr('admin.notifyAria', { email: u.email })} title={tr('admin.notify')} className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:opacity-50">
                      <BellIcon />
                    </button>
                    <button type="button" onClick={() => setToDelete(u)} disabled={busy} aria-label={tr('admin.deleteAria', { email: u.email })} className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50">
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={tr('admin.deleteTitle')}
        body={tr('admin.deleteConfirm', { email: toDelete?.email ?? '' })}
        confirmLabel={tr('admin.deleteAction')}
        onCancel={() => setToDelete(null)}
        destructive
        onConfirm={() => {
          const u = toDelete; setToDelete(null)
          if (u) void act(u.user_id, () => deleteUserAccount(u.user_id))
        }}
      />
    </div>
  )
}

// ── Tab: Profesionales (vista de estado) ───────────────────────────────────

function ProfesionalesTab({ users }: { users: AdminUser[] | null }) {
  const list = (users ?? []).filter((u) => u.acceso_profesionales)

  return (
    <div>
      <p className="mb-6 text-sm text-text-muted">{tr('admin.profesionales.lede')}</p>
      {users === null ? (
        <p role="status" className="text-sm text-text-muted">{tr('common.loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-text-muted">{tr('admin.empty')}</p>
      ) : (
        <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card">
          {list.map((u) => (
            <li key={u.user_id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{u.email || '—'}</p>
                <p className="mt-1 text-xs text-text-muted">{tr('admin.lastSeen', { date: fmt(u.last_seen_at) })}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${BADGE[u.estado]}`}>
                {tr(`admin.estado.${u.estado}` as Key)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Tab: Empresas (estado + cantidad de empleados) ─────────────────────────

function EmpresasTab({ users, onLoad }: { users: AdminUser[] | null; onLoad: () => void }) {
  const list = (users ?? []).filter((u) => u.acceso_empresas)
  const [editEmp, setEditEmp] = useState<string | null>(null)
  const [empVal, setEmpVal] = useState('')
  const [savingEmp, setSavingEmp] = useState(false)
  const [empError, setEmpError] = useState<string | null>(null)

  const startEditEmp = (u: AdminUser) => {
    setEditEmp(u.user_id)
    setEmpVal(u.cantidad_empleados !== null ? String(u.cantidad_empleados) : '')
    setEmpError(null)
  }

  const saveEmp = async (userId: string) => {
    setSavingEmp(true); setEmpError(null)
    try {
      const val = empVal.trim() === '' ? null : parseInt(empVal, 10)
      if (val !== null && (isNaN(val) || val < 0)) { setEmpError('Valor inválido'); setSavingEmp(false); return }
      await setCantidadEmpleados(userId, val)
      setEditEmp(null)
      onLoad()
    } catch (e) { setEmpError(e instanceof Error ? e.message : tr('cloud.error')) }
    finally { setSavingEmp(false) }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-text-muted">{tr('admin.section.lede.empresas')}</p>
      {users === null ? (
        <p role="status" className="text-sm text-text-muted">{tr('common.loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-text-muted">{tr('admin.empty')}</p>
      ) : (
        <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card">
          {list.map((u) => (
            <li key={u.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{u.email || '—'}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE[u.estado]}`}>{tr(`admin.estado.${u.estado}` as Key)}</span>
                  <span>{tr('admin.lastSeen', { date: fmt(u.last_seen_at) })}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editEmp === u.user_id ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      value={empVal}
                      onChange={(e) => setEmpVal(e.target.value)}
                      placeholder={tr('admin.empresas.empleadosPh')}
                      className="w-24 rounded-xl border border-border-color bg-background px-2.5 py-1.5 text-sm text-foreground"
                    />
                    <button onClick={() => void saveEmp(u.user_id)} disabled={savingEmp} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                      {tr('admin.empresas.setEmpleados')}
                    </button>
                    <button onClick={() => setEditEmp(null)} className="rounded-xl border border-border-color px-3 py-1.5 text-xs text-text-muted hover:bg-secondary">
                      {tr('admin.skills.cancel')}
                    </button>
                    {empError && <p className="text-xs text-danger">{empError}</p>}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditEmp(u)}
                    className="flex items-center gap-1.5 rounded-xl border border-border-color px-3 py-1.5 text-xs text-text-muted transition hover:bg-secondary hover:text-foreground"
                  >
                    <PencilIcon />
                    {u.cantidad_empleados !== null ? `${u.cantidad_empleados} ${tr('admin.empresas.empleados').toLowerCase()}` : tr('admin.empresas.empleados')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Tab: Skills ────────────────────────────────────────────────────────────

type SkillFilter = 'all' | 'soft' | 'hard'

function SkillsTab() {
  const [skills, setSkills] = useState<Skill[] | null>(null)
  const [filter, setFilter] = useState<SkillFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Skill | null>(null)
  const [editing, setEditing] = useState<Skill | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'soft' | 'hard'>('soft')
  const [descripcion, setDescripcion] = useState('')
  const [adding, setAdding] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editTipo, setEditTipo] = useState<'soft' | 'hard'>('soft')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const nombreId = useId()

  const load = useCallback(async () => {
    try { setSkills(await listSkills(null)); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : tr('cloud.error')) }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const shown = (skills ?? []).filter((s) => filter === 'all' || s.tipo === filter)

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || adding) return
    setAdding(true); setError(null)
    try { await createSkill({ nombre: nombre.trim(), tipo, descripcion: descripcion.trim(), empresa_id: null }); setNombre(''); setDescripcion(''); await load() }
    catch (err) { setError(err instanceof Error ? err.message : tr('cloud.error')) }
    finally { setAdding(false) }
  }

  const startEdit = (s: Skill) => { setEditing(s); setEditNombre(s.nombre); setEditTipo(s.tipo); setEditDesc(s.descripcion) }

  const handleSaveEdit = async () => {
    if (!editing || savingEdit) return
    setSavingEdit(true); setError(null)
    try { await updateSkill(editing.id, { nombre: editNombre.trim(), tipo: editTipo, descripcion: editDesc.trim() }); setEditing(null); await load() }
    catch (err) { setError(err instanceof Error ? err.message : tr('cloud.error')) }
    finally { setSavingEdit(false) }
  }

  const handleDelete = async (s: Skill) => {
    setBusyId(s.id); setError(null)
    try { await deleteSkill(s.id); await load() }
    catch (err) { setError(err instanceof Error ? err.message : tr('cloud.error')) }
    finally { setBusyId(null) }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-text-muted">{tr('admin.skills.lede')}</p>

      <form onSubmit={handleAdd} className="card mb-6">
        <h2 className="mb-3 text-base">{tr('admin.skills.add')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={nombreId} className="mb-1 block text-sm font-medium text-foreground">{tr('admin.skills.nombre')}</label>
            <input id={nombreId} type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tr('admin.skills.nombrePh')} className="w-full rounded-xl border border-border-color bg-background px-3 py-2.5 text-sm text-foreground" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{tr('admin.skills.tipo')}</label>
            <div className="flex gap-3 pt-1">
              {(['soft', 'hard'] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="accent-primary" />
                  {tr(`admin.skills.${t}` as Key)}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-foreground">{tr('admin.skills.descripcion')}</label>
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={tr('admin.skills.descripcionPh')} className="w-full rounded-xl border border-border-color bg-background px-3 py-2.5 text-sm text-foreground" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={adding || !nombre.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{tr('admin.skills.add')}</button>
        </div>
      </form>

      {error && <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      <div className="mb-4 flex gap-2" role="group">
        {(['all', 'soft', 'hard'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm transition ${filter === f ? 'bg-primary text-on-primary' : 'border border-border-color text-text-muted hover:bg-secondary'}`}>
            {tr(`admin.skills.filter.${f}` as Key)}
          </button>
        ))}
      </div>

      {skills === null ? (
        <p role="status" className="text-sm text-text-muted">{tr('common.loading')}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-text-muted">{tr('admin.skills.empty')}</p>
      ) : (
        <ul className="divide-y divide-border-color rounded-2xl border border-border-color bg-card">
          {shown.map((s) =>
            editing?.id === s.id ? (
              <li key={s.id} className="flex flex-col gap-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="rounded-xl border border-border-color bg-background px-3 py-2 text-sm text-foreground" />
                  <div className="flex items-center gap-4">
                    {(['soft', 'hard'] as const).map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input type="radio" checked={editTipo === t} onChange={() => setEditTipo(t)} className="accent-primary" />
                        {tr(`admin.skills.${t}` as Key)}
                      </label>
                    ))}
                  </div>
                </div>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={tr('admin.skills.descripcionPh')} className="rounded-xl border border-border-color bg-background px-3 py-2 text-sm text-foreground" />
                <div className="flex gap-2">
                  <button onClick={() => void handleSaveEdit()} disabled={savingEdit || !editNombre.trim()} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50">{tr('admin.skills.save')}</button>
                  <button onClick={() => setEditing(null)} className="rounded-xl border border-border-color px-4 py-1.5 text-sm text-text-muted hover:bg-secondary">{tr('admin.skills.cancel')}</button>
                </div>
              </li>
            ) : (
              <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{s.nombre}</p>
                  {s.descripcion && <p className="mt-0.5 text-xs text-text-muted">{s.descripcion}</p>}
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tipo === 'soft' ? 'bg-primary-soft text-primary' : 'bg-accent/10 text-accent-ink'}`}>
                    {tr(`admin.skills.${s.tipo}` as Key)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => startEdit(s)} aria-label={tr('admin.skills.editAria', { nombre: s.nombre })} className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-secondary hover:text-foreground">
                    <PencilIcon />
                  </button>
                  <button type="button" onClick={() => setToDelete(s)} disabled={busyId === s.id} aria-label={tr('admin.skills.deleteAria', { nombre: s.nombre })} className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50">
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={tr('admin.skills.deleteTitle')}
        body={tr('admin.skills.deleteConfirm', { nombre: toDelete?.nombre ?? '' })}
        confirmLabel={tr('admin.skills.deleteAction')}
        onCancel={() => setToDelete(null)}
        destructive
        onConfirm={() => { const s = toDelete; setToDelete(null); if (s) void handleDelete(s) }}
      />
    </div>
  )
}

// ── Panel principal ────────────────────────────────────────────────────────

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [comentarios, setComentarios] = useState<ComentarioItem[]>([])
  const [skillCount, setSkillCount] = useState<number | null>(null)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')

  const load = useCallback(async () => {
    try {
      const [us, au, cm] = await Promise.all([listUsers(), listAudit().catch(() => []), listComentarios().catch(() => [])])
      setUsers(us); setAudit(au); setComentarios(cm); setNeedsMfa(false); setError(null)
      listSkills(null).then((s) => setSkillCount(s.length)).catch(() => {})
    } catch (e) {
      if (e instanceof AdminError && e.reason === 'mfa_required') return setNeedsMfa(true)
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: tr('admin.tab.dashboard') },
    { id: 'usuarios', label: tr('admin.tab.usuarios') },
    { id: 'profesionales', label: tr('admin.tab.profesionales') },
    { id: 'empresas', label: tr('admin.tab.empresas') },
    { id: 'skills', label: tr('admin.tab.skills') },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="border-b border-border-color">
        <div className="section-container flex items-center justify-between py-4">
          <button onClick={onBack} className="flex items-center gap-3"><Logo /></button>
          <div className="flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
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
            <h1 className="mb-6 text-2xl md:text-3xl">{tr('admin.link')}</h1>

            {error && <p role="alert" className="mb-6 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">{error}</p>}

            {/* Tabs — mobile: scroll horizontal; desktop: anchos iguales */}
            <div className="mb-6 overflow-x-auto rounded-2xl border border-border-color bg-secondary p-1" role="tablist">
              <div className="flex gap-1 sm:min-w-full">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition sm:flex-1 sm:px-4 sm:text-sm ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-text-muted hover:text-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contenido — mobile: hidden para inactivos (altura natural); desktop: grid stacking para altura estable */}
            <div className="sm:grid">
              <div style={{ gridArea: '1/1' }} className={tab !== 'dashboard' ? 'hidden sm:block sm:invisible sm:pointer-events-none sm:select-none' : ''}>
                <DashboardTab
                  users={users} skillCount={skillCount} comentarios={comentarios} audit={audit}
                  onMark={(id, leido) => {
                    setComentarios((list) => list.map((c) => (c.id === id ? { ...c, leido } : c)))
                    marcarComentario(id, leido).catch(() => setComentarios((list) => list.map((c) => (c.id === id ? { ...c, leido: !leido } : c))))
                  }}
                />
              </div>
              <div style={{ gridArea: '1/1' }} className={tab !== 'usuarios' ? 'hidden sm:block sm:invisible sm:pointer-events-none sm:select-none' : ''}>
                <UsuariosTab users={users} error={error} onLoad={() => void load()} />
              </div>
              <div style={{ gridArea: '1/1' }} className={tab !== 'profesionales' ? 'hidden sm:block sm:invisible sm:pointer-events-none sm:select-none' : ''}>
                <ProfesionalesTab users={users} />
              </div>
              <div style={{ gridArea: '1/1' }} className={tab !== 'empresas' ? 'hidden sm:block sm:invisible sm:pointer-events-none sm:select-none' : ''}>
                <EmpresasTab users={users} onLoad={() => void load()} />
              </div>
              <div style={{ gridArea: '1/1' }} className={tab !== 'skills' ? 'hidden sm:block sm:invisible sm:pointer-events-none sm:select-none' : ''}>
                <SkillsTab />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
