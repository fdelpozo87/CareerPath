import { useState, type FormEvent, type ReactNode } from 'react'
import { loginErrorKey, passwordErrorKey, sendLoginLink, sendPasswordReset, signInWithPassword, signOut } from '../lib/cloud'
import { MfaStep } from './MfaStep'
import { PasswordForm } from './PasswordForm'
import { tr, type Key } from '../lib/i18n'
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
  // Se puede entrar con el enlace del mail o, si la persona ya eligió una contraseña, con ella.
  const [mode, setMode] = useState<'link' | 'password'>('link')
  const [password, setPassword] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState('')
  // Se guarda la clave y no el texto: así el mensaje sigue el idioma si la persona lo cambia.
  const [errorKey, setErrorKey] = useState<Key | null>(null)
  const error = errorKey ? tr(errorKey) : (initialError ?? null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value || busy) return
    setBusy(true)
    setErrorKey(null)
    try {
      if (mode === 'password') {
        // Al entrar, el cambio de sesión actualiza la pantalla solo (App escucha la cuenta).
        await signInWithPassword(value, password)
        setPassword('')
      } else {
        await sendLoginLink(value)
        setSent(true)
      }
    } catch (err) {
      console.error(err)
      setErrorKey(mode === 'password' ? passwordErrorKey(err) : loginErrorKey(err))
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    const value = email.trim()
    if (!value || busy) return setErrorKey('password.error.needEmail')
    setBusy(true)
    setErrorKey(null)
    try {
      await sendPasswordReset(value)
      setResetSent(true)
    } catch (err) {
      console.error(err)
      setErrorKey(passwordErrorKey(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="mb-3 text-2xl md:text-3xl">{tr('login.title')}</h1>
      <p className="mb-6 text-sm leading-relaxed text-text-muted">{tr('login.body')}</p>

      {sent || resetSent ? (
        <p role="status" className="rounded-xl bg-primary-soft p-4 text-sm leading-relaxed text-foreground">
          {resetSent ? tr('password.resetSent', { email: email.trim() }) : tr('login.sent', { email: email.trim() })}
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
          {mode === 'password' && (
            <div className="mt-3">
              <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-foreground">
                {tr('password.label')}
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border-color p-3 text-sm outline-none focus:border-primary"
              />
            </div>
          )}
          <div id="login-error" role="alert" className="min-h-6 pt-2 text-sm text-danger">
            {error}
          </div>
          <button
            type="submit"
            disabled={!email.trim() || (mode === 'password' && !password) || busy}
            className="btn-primary mt-2 w-full py-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? tr('login.sending') : mode === 'password' ? tr('password.signIn') : tr('cloud.sendLink')}
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'link' ? 'password' : 'link')
                setErrorKey(null)
              }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {mode === 'link' ? tr('password.useInstead') : tr('password.useLink')}
            </button>
            {mode === 'password' && (
              <button type="button" onClick={() => void forgot()} className="text-text-muted underline underline-offset-2 hover:text-foreground">
                {tr('password.forgot')}
              </button>
            )}
          </div>
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

/** Pantalla a la que se llega desde el enlace de "olvidé mi contraseña": hay que elegir una nueva. */
export function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  return (
    <Shell>
      <h1 className="mb-3 text-2xl md:text-3xl">{tr('password.recovery.title')}</h1>
      <p className="mb-6 text-sm leading-relaxed text-text-muted">{tr('password.recovery.body')}</p>
      <PasswordForm onDone={onDone} />
    </Shell>
  )
}

/** Entró con el enlace o la contraseña pero su cuenta tiene la verificación en dos pasos: falta el código. */
export function MfaGate({ onDone }: { onDone: () => void }) {
  return (
    <Shell>
      <MfaStep variant="login" onDone={onDone} />
      <button onClick={() => void signOut()} className="mt-4 w-full text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
        {tr('cloud.signOut')}
      </button>
    </Shell>
  )
}
