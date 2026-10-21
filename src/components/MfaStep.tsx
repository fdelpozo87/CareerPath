import { useEffect, useId, useState, type FormEvent } from 'react'
import { enrollTotp, mfaState, verifyTotp, type Enrollment } from '../lib/mfa'
import { tr } from '../lib/i18n'

// Antes de mostrar el panel: activar o confirmar la verificación en dos pasos del administrador.

export function MfaStep({ onDone }: { onDone: () => void }) {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const codeId = useId()

  useEffect(() => {
    let alive = true
    mfaState()
      .then(async (s) => {
        if (!alive) return
        if (s.factorId) return setFactorId(s.factorId)
        const e = await enrollTotp()
        if (alive) {
          setEnrollment(e)
          setFactorId(e.factorId)
        }
      })
      .catch((e) => {
        console.error(e)
        if (alive) setError(tr('mfa.error.setup'))
      })
    return () => {
      alive = false
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!factorId || busy) return
    setBusy(true)
    setError(null)
    try {
      await verifyTotp(factorId, code)
      onDone()
    } catch (err) {
      console.error(err)
      setError(tr('mfa.error.code'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mx-auto max-w-md">
      <h2 className="mb-2 text-xl">{tr(enrollment ? 'mfa.setup.title' : 'mfa.title')}</h2>
      <p className="mb-4 text-sm leading-relaxed text-text-muted">{tr(enrollment ? 'mfa.setup.body' : 'mfa.body')}</p>

      {enrollment && (
        <div className="mb-4 flex flex-col items-center gap-2 rounded-xl bg-secondary p-4">
          <img src={enrollment.qr} alt={tr('mfa.qrAlt')} className="h-44 w-44 rounded bg-white p-2" />
          <p className="text-xs text-text-muted">{tr('mfa.secret')}</p>
          <code className="break-all text-center text-xs text-foreground">{enrollment.secret}</code>
        </div>
      )}

      {factorId !== undefined || error ? (
        <form onSubmit={submit} noValidate>
          <label htmlFor={codeId} className="mb-1 block text-sm font-semibold text-foreground">
            {tr('mfa.codeLabel')}
          </label>
          <input
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-xl border border-border-color bg-background p-3 text-center text-lg tracking-widest text-foreground outline-none focus:border-primary"
          />
          <div role="alert" className="min-h-6 pt-2 text-sm text-danger">
            {error}
          </div>
          <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6 || !factorId} className="btn-primary mt-2 w-full py-3 disabled:opacity-40">
            {busy ? tr('login.sending') : tr('mfa.verify')}
          </button>
        </form>
      ) : (
        <p role="status" className="text-sm text-text-muted">
          {tr('common.loading')}
        </p>
      )}
    </div>
  )
}
