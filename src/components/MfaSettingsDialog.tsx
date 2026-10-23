import { useCallback, useEffect, useRef, useState } from 'react'
import { currentAal, disableTotp, mfaState } from '../lib/mfa'
import { tr } from '../lib/i18n'
import { MfaStep } from './MfaStep'

// Activar o desactivar la verificación en dos pasos desde el menú de la cuenta (opcional para cada persona).

export default function MfaSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined)
  const [enrolling, setEnrolling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setFactorId((await mfaState()).factorId)
    } catch (e) {
      console.error(e)
      setError(tr('mfa.settings.error'))
    }
  }, [])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setFactorId(undefined)
      setEnrolling(false)
      setMessage(null)
      setError(null)
      void refresh()
    }
    if (!open && d.open) d.close()
  }, [open, refresh])

  const disable = async () => {
    if (!factorId || busy) return
    setBusy(true)
    setError(null)
    try {
      // Supabase solo deja desactivar un factor a una sesión que ya pasó el código.
      if ((await currentAal()) !== 'aal2') throw new Error('needs_code')
      await disableTotp(factorId)
      setMessage(tr('mfa.settings.disabledNow'))
      await refresh()
    } catch (e) {
      console.error(e)
      setError(tr(e instanceof Error && e.message === 'needs_code' ? 'mfa.settings.needsCode' : 'mfa.settings.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="mfa-settings-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-3xl border border-border-color bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <>
          <h2 id="mfa-settings-title" className="mb-2 text-xl">
            {tr('mfa.settings.title')}
          </h2>
          {enrolling ? (
            <MfaStep
              onDone={() => {
                setEnrolling(false)
                setMessage(tr('mfa.settings.enabledNow'))
                void refresh()
              }}
            />
          ) : (
            <>
              <p className="mb-4 text-sm leading-relaxed text-text-muted">{factorId === undefined ? tr('common.loading') : tr(factorId ? 'mfa.settings.on' : 'mfa.settings.off')}</p>
              <p role="status" className="min-h-5 text-sm text-foreground">
                {message}
              </p>
              <p role="alert" className="min-h-5 text-sm text-danger">
                {error}
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-3">
                <button onClick={onClose} className="btn-secondary px-5 py-2.5 text-sm">
                  {tr('mfa.settings.close')}
                </button>
                {factorId === null && (
                  <button onClick={() => setEnrolling(true)} className="btn-primary px-5 py-2.5 text-sm">
                    {tr('mfa.settings.enable')}
                  </button>
                )}
                {factorId && (
                  <button onClick={() => void disable()} disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
                    {tr('mfa.settings.disable')}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </dialog>
  )
}
