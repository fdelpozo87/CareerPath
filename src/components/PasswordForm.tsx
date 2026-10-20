import { useId, useState, type FormEvent } from 'react'
import { MIN_PASSWORD, passwordErrorKey, setPassword } from '../lib/cloud'
import { tr, type Key } from '../lib/i18n'

// Elegir (o cambiar) la contraseña. La guarda Supabase Auth, con hash; acá solo se valida el largo
// y que las dos coincidan.

export function PasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [errorKey, setErrorKey] = useState<Key | null>(null)
  const [busy, setBusy] = useState(false)
  const pwId = useId()
  const againId = useId()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (pw.length < MIN_PASSWORD) return setErrorKey('password.error.short')
    if (pw !== again) return setErrorKey('password.error.mismatch')
    setBusy(true)
    setErrorKey(null)
    try {
      await setPassword(pw)
      setPw('')
      setAgain('')
      onDone()
    } catch (err) {
      console.error(err)
      setErrorKey(passwordErrorKey(err))
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-xl border border-border-color bg-background p-3 text-sm text-foreground outline-none focus:border-primary'

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={pwId} className="mb-1 block text-sm font-semibold text-foreground">
        {tr('password.new')}
      </label>
      <input id={pwId} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={input} />
      <p className="mb-3 mt-1 text-xs text-text-muted">{tr('password.hint', { n: MIN_PASSWORD })}</p>
      <label htmlFor={againId} className="mb-1 block text-sm font-semibold text-foreground">
        {tr('password.again')}
      </label>
      <input id={againId} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={input} />
      <div role="alert" className="min-h-6 pt-2 text-sm text-danger">
        {errorKey ? tr(errorKey) : null}
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary px-5 py-2.5 text-sm">
            {tr('confirm.cancel')}
          </button>
        )}
        <button type="submit" disabled={busy || !pw || !again} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
          {busy ? tr('login.sending') : tr('password.save')}
        </button>
      </div>
    </form>
  )
}
