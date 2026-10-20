import { useEffect, useRef } from 'react'
import { tr } from '../lib/i18n'
import { PasswordForm } from './PasswordForm'

// Crear o cambiar la contraseña desde el menú de la cuenta.

export default function PasswordDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="password-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-border-color bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <>
          <h2 id="password-title" className="mb-1 text-xl">
            {tr('password.title')}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-text-muted">{tr('password.lede')}</p>
          <PasswordForm onDone={onSaved} onCancel={onClose} />
        </>
      )}
    </dialog>
  )
}
