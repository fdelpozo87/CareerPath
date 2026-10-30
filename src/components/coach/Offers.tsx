import type { DocTipo, Path, ProfileDoc } from '../../lib/coach/types'
import { tr } from '../../lib/i18n'
import { DocsPanel } from './DocInputs'

// Sugerencias del coach dentro de la conversación (Camino A). Aparecen debajo del mensaje en el que el coach las hizo, no
// al empezar: el CV o el LinkedIn se suman cuando la charla lo amerita, y el Camino B se ofrece cuando lo que haría falta es
// trabajar cómo la lee quien contrata. Siempre son opcionales.

/** Sumar el CV y/o el LinkedIn. Desaparece sola cuando ya se sumó lo que el coach pidió. */
export function DocsOffer({ docs, status, onAttach, onSkip }: { docs: ProfileDoc[]; status: string | null; onAttach: (tipo: DocTipo, file: File) => void; onSkip: () => void }) {
  return (
    <div className="ml-0 max-w-xl rounded-2xl border border-primary/20 bg-primary-soft/40 p-4 sm:ml-[3.25rem]">
      <DocsPanel docs={docs} status={status} onAttach={onAttach} />
      <button type="button" onClick={onSkip} className="mt-3 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
        {tr('offer.docs.skip')}
      </button>
    </div>
  )
}

/** Pasar al Camino B. La conversación actual queda guardada. */
export function PathOffer({ path, onGo, onStay }: { path: Path; onGo: (path: Path) => void; onStay: () => void }) {
  return (
    <div className="ml-0 max-w-xl rounded-2xl border border-primary/20 bg-primary-soft/40 p-4 sm:ml-[3.25rem]">
      <p className="mb-1 font-display text-base font-bold text-foreground">{tr('offer.path.title')}</p>
      <p className="mb-3 text-sm leading-relaxed text-text-muted">{tr('offer.path.body')}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onGo(path)} className="btn-primary px-5 py-2 text-sm">
          {tr('offer.path.go')}
        </button>
        <button type="button" onClick={onStay} className="btn-secondary px-5 py-2 text-sm">
          {tr('offer.path.stay')}
        </button>
      </div>
    </div>
  )
}
