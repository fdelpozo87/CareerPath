import { useEffect, useId, useRef, useState } from 'react'
import { tr } from '../lib/i18n'

// Menú de la persona: quién está con la sesión abierta y qué puede hacer con ella. Es un menú
// desplegable simple (botón + lista de botones): se cierra con Escape y al tocar afuera, y el foco
// vuelve al botón.

export interface AccountInfo {
  /** Apodo asociado al código de acceso (ver server/access.ts); null si no se conoce. */
  label: string | null
  /** Hay un código guardado, o sea, hay una sesión que cerrar. */
  canLogout: boolean
  onLogout: () => void
  /** Borra la conversación guardada en este navegador. */
  onDeleteData: () => void
  /** Baja un archivo con todo lo que hay de la persona (procesos de este navegador y lo guardado en su cuenta). */
  onExport: () => void
  /** Con cuenta: abre el formulario de comentarios para quien administra. */
  onFeedback?: () => void
  /** Solo para quien administra: abre el panel de usuarios. */
  onAdmin?: () => void
  /** Evaluaciones de desempeño (solo con cuenta): abre "Mis evaluaciones". */
  onEvaluaciones?: () => void
  /** Cuántas evaluaciones tiene pendientes de responder. */
  evalPending?: number
  /** Cuenta opcional (guardar el informe con email). Solo si hay una sesión iniciada. */
  cloud?: {
    email: string
    onSignOut: () => void
    onDeleteAccount: () => void
    onPassword: () => void
    onMfa: () => void
    /** Sincronizar las sesiones del coach con la cuenta (apagado por defecto). */
    sync: { enabled: boolean; onToggle: () => void }
  }
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </svg>
  )
}

const ITEM = 'block w-full rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary'

export default function AccountMenu({ account }: { account: AccountInfo }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = account.label?.trim()[0]?.toUpperCase()

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={account.label ? tr('account.menuNamed', { label: account.label }) : tr('account.menu')}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary transition hover:bg-primary-soft/70"
      >
        {initial ?? <PersonIcon />}
      </button>

      {open && (
        <div id={panelId} className="card absolute right-0 top-full z-50 mt-2 w-64 p-2">
          <div className="border-b border-border-color px-3 pb-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('account.testSession')}</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{account.label ?? (account.canLogout ? tr('account.unknown') : tr('account.open'))}</p>
          </div>
          {account.cloud && (
            <div className="border-b border-border-color px-3 pb-3 pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('cloud.account')}</p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{account.cloud.email}</p>
              <button
                type="button"
                className={`${ITEM} -mx-3 mt-1`}
                onClick={() => {
                  setOpen(false)
                  account.cloud?.onPassword()
                }}
              >
                {tr('password.menu')}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={account.cloud.sync.enabled}
                className={`${ITEM} -mx-3`}
                onClick={() => {
                  setOpen(false)
                  account.cloud?.sync.onToggle()
                }}
              >
                {tr(account.cloud.sync.enabled ? 'sync.menu.on' : 'sync.menu.off')}
              </button>
              <button
                type="button"
                className={`${ITEM} -mx-3`}
                onClick={() => {
                  setOpen(false)
                  account.cloud?.onMfa()
                }}
              >
                {tr('mfa.menu')}
              </button>
              <button
                type="button"
                className={`${ITEM} -mx-3`}
                onClick={() => {
                  setOpen(false)
                  account.cloud?.onSignOut()
                }}
              >
                {tr('cloud.signOut')}
              </button>
              <button
                type="button"
                className={`${ITEM} -mx-3`}
                onClick={() => {
                  setOpen(false)
                  account.cloud?.onDeleteAccount()
                }}
              >
                {tr('cloud.deleteAccount')}
              </button>
            </div>
          )}
          <ul className="mt-2 space-y-0.5">
            {account.onEvaluaciones && (
              <li>
                <button
                  type="button"
                  className={ITEM}
                  onClick={() => {
                    setOpen(false)
                    account.onEvaluaciones?.()
                  }}
                >
                  {(account.evalPending ?? 0) > 0 ? tr('eval.menu.pending', { n: account.evalPending ?? 0 }) : tr('eval.menu')}
                </button>
              </li>
            )}
            {account.onAdmin && (
              <li>
                <button
                  type="button"
                  className={`${ITEM} font-semibold`}
                  onClick={() => {
                    setOpen(false)
                    account.onAdmin?.()
                  }}
                >
                  {tr('admin.link')}
                </button>
              </li>
            )}
            {account.onFeedback && (
              <li>
                <button
                  type="button"
                  className={ITEM}
                  onClick={() => {
                    setOpen(false)
                    account.onFeedback?.()
                  }}
                >
                  {tr('comment.menu')}
                </button>
              </li>
            )}
            <li>
              <a href="#privacidad" className={ITEM} onClick={() => setOpen(false)}>
                {tr('account.privacy')}
              </a>
            </li>
            <li>
              <button
                type="button"
                className={ITEM}
                onClick={() => {
                  setOpen(false)
                  account.onExport()
                }}
              >
                {tr('account.export')}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={ITEM}
                onClick={() => {
                  setOpen(false)
                  account.onDeleteData()
                }}
              >
                {tr('account.delete')}
              </button>
            </li>
            {account.canLogout && (
              <li>
                <button
                  type="button"
                  className={`${ITEM} font-semibold`}
                  onClick={() => {
                    setOpen(false)
                    account.onLogout()
                  }}
                >
                  {tr('account.logout')}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
