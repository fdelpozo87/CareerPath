import { useEffect, useId, useRef, useState } from 'react'

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
        aria-label={account.label ? `Mi cuenta (${account.label})` : 'Mi cuenta'}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary transition hover:bg-primary-soft/70"
      >
        {initial ?? <PersonIcon />}
      </button>

      {open && (
        <div id={panelId} className="card absolute right-0 top-full z-50 mt-2 w-64 p-2">
          <div className="border-b border-border-color px-3 pb-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Sesión de prueba</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{account.label ?? 'Sin identificar'}</p>
          </div>
          <ul className="mt-2 space-y-0.5">
            <li>
              <a href="#privacidad" className={ITEM} onClick={() => setOpen(false)}>
                Privacidad y términos
              </a>
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
                Borrar mi conversación
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
                  Cerrar sesión
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
