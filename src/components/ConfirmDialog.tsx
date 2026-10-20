import { useEffect, useRef } from 'react'
import { tr } from '../lib/i18n'

// Reemplaza a window.confirm(): algunos navegadores (embebidos de LinkedIn o Instagram, vistas
// previas) bloquean los diálogos nativos sin avisar y el botón queda sin hacer nada.

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-border-color bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id="confirm-title" className="mb-2 text-xl">
        {title}
      </h2>
      <p id="confirm-body" className="mb-6 text-sm leading-relaxed text-text-muted">
        {body}
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={onCancel} className="btn-secondary px-5 py-2.5 text-sm">
          {tr('confirm.cancel')}
        </button>
        <button type="button" onClick={onConfirm} className="btn-primary px-5 py-2.5 text-sm">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
