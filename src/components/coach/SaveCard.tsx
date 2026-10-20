import { useEffect, useId, useState } from 'react'
import { cloudEnabled, currentUser, deleteSavedReport, loginErrorKey, onAuthChange, saveReport, sendLoginLink, setPendingSave, type CloudUser } from '../../lib/cloud'
import type { Session } from '../../lib/coach/types'
import { tr } from '../../lib/i18n'

// Guardar el informe y los compromisos en una cuenta (opcional) y pedir un recordatorio del check-in.
// Se guardan solo esas dos cosas, nunca la conversación. Sin cuenta, todo sigue en este navegador.

const REMIND_OPTIONS = [0, 7, 14, 30] as const

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'sent' } | { kind: 'saved'; at: Date } | { kind: 'removed' } | { kind: 'error'; message: string }

export function SaveCard({ session }: { session: Session }) {
  const [user, setUser] = useState<CloudUser | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [remind, setRemind] = useState<number>(14)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const emailId = useId()
  const remindId = useId()

  useEffect(() => {
    let alive = true
    void currentUser().then((u) => alive && setUser(u))
    const off = onAuthChange((u) => alive && setUser(u))
    return () => {
      alive = false
      off()
    }
  }, [])

  if (!cloudEnabled() || user === undefined || !session.informe) return null

  const remindDays = remind > 0 ? remind : null
  const fail = (e: unknown) => {
    console.error(e)
    setStatus({ kind: 'error', message: tr('cloud.error') })
  }

  const sendLink = async () => {
    setStatus({ kind: 'busy' })
    try {
      // Al volver del mail se guarda solo lo que la persona eligió acá.
      setPendingSave({ processId: session.id, remindDays })
      await sendLoginLink(email.trim())
      setStatus({ kind: 'sent' })
    } catch (e) {
      console.error(e)
      setStatus({ kind: 'error', message: tr(loginErrorKey(e)) })
    }
  }

  const save = async () => {
    setStatus({ kind: 'busy' })
    try {
      await saveReport(session, remindDays)
      setStatus({ kind: 'saved', at: new Date() })
    } catch (e) {
      fail(e)
    }
  }

  const remove = async () => {
    setStatus({ kind: 'busy' })
    try {
      await deleteSavedReport(session.id)
      setStatus({ kind: 'removed' })
    } catch (e) {
      fail(e)
    }
  }

  const busy = status.kind === 'busy'

  return (
    <section aria-labelledby="guardar-titulo" className="card mt-6 print:hidden">
      <h3 id="guardar-titulo" className="mb-1 text-base">
        {tr('cloud.title')}
      </h3>
      <p className="mb-4 text-sm text-text-muted">{tr('cloud.lede')}</p>

      <div className="mb-4">
        <label htmlFor={remindId} className="mb-1 block text-sm font-medium text-foreground">
          {tr('cloud.remind')}
        </label>
        <select
          id={remindId}
          value={remind}
          onChange={(e) => setRemind(Number(e.target.value))}
          className="w-full rounded-xl border border-border-color bg-background px-3 py-2.5 text-sm text-foreground sm:w-auto"
        >
          {REMIND_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {tr(`cloud.remind.${d}` as Parameters<typeof tr>[0])}
            </option>
          ))}
        </select>
      </div>

      {user ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button onClick={save} disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {tr('cloud.save')}
          </button>
          <p className="text-sm text-text-muted">{tr('cloud.signedIn', { email: user.email })}</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void sendLink()
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor={emailId} className="mb-1 block text-sm font-medium text-foreground">
              {tr('cloud.email')}
            </label>
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-background px-3 py-2.5 text-sm text-foreground"
              placeholder="tu@correo.com"
            />
          </div>
          <button type="submit" disabled={busy || !email.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {tr('cloud.sendLink')}
          </button>
        </form>
      )}

      <p role="status" className="mt-3 min-h-5 text-sm text-text-muted">
        {status.kind === 'sent' && tr('cloud.sent', { email })}
        {status.kind === 'saved' && tr('cloud.saved')}
        {status.kind === 'removed' && tr('cloud.removed')}
        {status.kind === 'error' && <span className="text-danger">{status.message}</span>}
      </p>
      {user && (
        <button onClick={remove} disabled={busy} className="text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
          {tr('cloud.remove')}
        </button>
      )}
    </section>
  )
}
