import { useId, useState } from 'react'
import type { Session } from '../../lib/coach/types'
import { tr, trn } from '../../lib/i18n'
import { SignalList } from './ProfileStep'

// Camino B: la lectura del perfil y los cambios que la persona eligió quedan a mano arriba del chat
// (cerrados, para no quitar lugar a la conversación) en vez de desaparecer al pasar al Diagnóstico.

export function ProfileRecap({ perfil }: { perfil: NonNullable<Session['perfil']> }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const { lectura, puesto } = perfil
  const recs = lectura.recomendaciones.slice(0, 3)
  const chosen = recs.filter((_, i) => perfil.elegidas.includes(i))
  const skipped = recs.filter((_, i) => !perfil.elegidas.includes(i))

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-secondary px-3.5 py-2 text-left text-xs transition hover:bg-primary-soft"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">{tr('chat.profile.title')}</span>
          <span className="block truncate text-text-muted">{trn('chat.profile.sub', chosen.length, { role: puesto })}</span>
        </span>
        <span aria-hidden="true" className="text-text-muted">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div id={panelId} className="mt-2 max-h-64 space-y-4 overflow-y-auto rounded-xl bg-secondary p-4 text-sm leading-relaxed text-foreground">
          <p>{lectura.comunicaHoy ?? lectura.notaComunica}</p>
          {(lectura.senales?.length ?? 0) > 0 && <SignalList signals={lectura.senales ?? []} />}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('chat.profile.changes')}</p>
            {chosen.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {chosen.map((r, i) => (
                  <li key={i}>{r.cambio}</li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted">{tr('chat.profile.none')}</p>
            )}
          </div>
          {skipped.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('chat.profile.skipped')}</p>
              <ul className="list-disc space-y-1 pl-5 text-text-muted">
                {skipped.map((r, i) => (
                  <li key={i}>{r.cambio}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
