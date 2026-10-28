import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { MAX_COMENTARIO, MIN_COMENTARIO, TIPOS, enviarComentario, type ComentarioTipo } from '../lib/comentarios'
import { tr, type Key } from '../lib/i18n'

// "Enviar un comentario" desde el menú de la cuenta: un problema, una idea u otro. Le llega a quien administra Bivio.

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<ComentarioTipo>('problema')
  const [mensaje, setMensaje] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'short'>('idle')
  const areaId = useId()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    if (mensaje.trim().length < MIN_COMENTARIO) return setState('short')
    setState('sending')
    try {
      await enviarComentario(tipo, mensaje.trim(), window.location.hash || '#')
      setState('sent')
    } catch (err) {
      console.error(err)
      setState('error')
    }
  }

  return (
    <>
          <h2 id="comment-title" className="mb-1 text-xl">
        {tr('comment.title')}
      </h2>
      {state === 'sent' ? (
        <>
          <p role="status" className="my-4 rounded-2xl bg-primary-soft p-4 text-sm leading-relaxed">
            {tr('comment.sent')}
          </p>
          <button type="button" onClick={onClose} className="btn-primary px-5 py-2.5 text-sm">
            {tr('comment.close')}
          </button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="mb-4 text-sm leading-relaxed text-text-muted">{tr('comment.lede')}</p>
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-semibold">{tr('comment.tipo.label')}</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <label
                  key={t}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${tipo === t ? 'border-primary bg-primary text-on-primary' : 'border-border-color hover:border-primary/40'}`}
                >
                  <input type="radio" name="comment-tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                  {tr(`comment.tipo.${t}` as Key)}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor={areaId} className="mb-2 block text-sm font-semibold">
            {tr('comment.message')}
          </label>
          <textarea
            id={areaId}
            value={mensaje}
            onChange={(e) => {
              setMensaje(e.target.value)
              if (state === 'short' || state === 'error') setState('idle')
            }}
            maxLength={MAX_COMENTARIO}
            rows={5}
            placeholder={tr('comment.placeholder')}
            className="w-full resize-y rounded-2xl border border-border-color bg-background p-3 text-sm outline-none focus:border-primary"
          />
          <div className="flex items-start justify-between gap-3 pt-1">
            <p role="alert" className="min-h-5 text-sm text-danger">
              {state === 'error' ? tr('comment.error') : state === 'short' ? tr('comment.short') : null}
            </p>
            <span className="shrink-0 text-xs text-text-muted">
              {mensaje.length}/{MAX_COMENTARIO}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5 text-sm">
              {tr('comment.close')}
            </button>
            <button type="submit" disabled={state === 'sending'} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
              {state === 'sending' ? tr('comment.sending') : tr('comment.send')}
            </button>
          </div>
        </form>
      )}
    </>
  )
}

export default function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      aria-labelledby="comment-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-3xl border border-border-color bg-card p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {/* El formulario se monta al abrir: cada vez empieza vacío. */}
      {open && <FeedbackForm onClose={onClose} />}
    </dialog>
  )
}
