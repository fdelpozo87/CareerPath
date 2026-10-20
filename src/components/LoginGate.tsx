import { useState, type FormEvent, type ReactNode } from 'react'
import { sendLoginLink, signOut } from '../lib/cloud'
import { tr } from '../lib/i18n'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

// Puerta de entrada por cuenta: se entra con el email (enlace por correo, sin contraseña). Las cuentas
// nuevas quedan pendientes hasta que las apruebe quien administra; esas pantallas viven acá también.

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="border-b border-border-color">
        <div className="section-container flex items-center justify-between py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}

export function LoginGate({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendLoginLink(value)
      setSent(true)
    } catch (err) {
      console.error(err)
      setError(tr('login.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="mb-3 text-2xl md:text-3xl">{tr('login.title')}</h1>
      <p className="mb-6 text-sm leading-relaxed text-text-muted">{tr('login.body')}</p>

      {sent ? (
        <p role="status" className="rounded-xl bg-primary-soft p-4 text-sm leading-relaxed text-foreground">
          {tr('login.sent', { email: email.trim() })}
        </p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-foreground">
            {tr('cloud.email')}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            className="w-full rounded-xl border border-border-color p-3 text-sm outline-none focus:border-primary"
          />
          <div id="login-error" role="alert" className="min-h-6 pt-2 text-sm text-danger">
            {error}
          </div>
          <button type="submit" disabled={!email.trim() || busy} className="btn-primary mt-2 w-full py-3 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? tr('login.sending') : tr('cloud.sendLink')}
          </button>
        </form>
      )}

      <p className="mt-6 text-xs text-text-muted">
        {tr('login.approval')}{' '}
        <a href="#privacidad" className="underline underline-offset-2">
          {tr('footer.privacy')}
        </a>
      </p>
    </Shell>
  )
}

/** La cuenta existe pero todavía no puede usar Bivio: pendiente de aprobación o desactivada. */
export function AccountStatus({ kind, onRecheck }: { kind: 'pendiente' | 'desactivado'; onRecheck: () => void }) {
  return (
    <Shell>
      <h1 className="mb-3 text-2xl md:text-3xl">{tr(kind === 'pendiente' ? 'login.pending.title' : 'login.disabled.title')}</h1>
      <p role="status" className="mb-6 text-sm leading-relaxed text-text-muted">
        {tr(kind === 'pendiente' ? 'login.pending.body' : 'login.disabled.body')}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {kind === 'pendiente' && (
          <button onClick={onRecheck} className="btn-primary px-5 py-2.5 text-sm">
            {tr('login.recheck')}
          </button>
        )}
        <button onClick={() => void signOut()} className="btn-secondary px-5 py-2.5 text-sm">
          {tr('cloud.signOut')}
        </button>
      </div>
    </Shell>
  )
}
