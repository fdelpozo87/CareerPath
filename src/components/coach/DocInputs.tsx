import { useRef, useState } from 'react'
import { DOC_LABEL, checkPdf, type DocDraft } from '../../lib/coach/docs'
import type { DocTipo, ProfileDoc } from '../../lib/coach/types'

// Carga de CV y perfil de LinkedIn. LinkedIn no se lee por URL (requiere login
// y sus condiciones prohíben el scraping): la persona exporta su propio perfil
// a PDF, que es gratis y controla qué comparte.

export function LinkedInHowTo({ compact = false }: { compact?: boolean }) {
  return (
    <details className={compact ? 'text-[11px] text-text-muted' : 'text-xs text-text-muted'}>
      <summary className="cursor-pointer font-semibold text-primary-ink underline-offset-2 hover:underline">
        ¿Cómo bajo mi perfil de LinkedIn en PDF?
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
        <li>Entrá a LinkedIn desde la computadora (en la app del celular no está la opción).</li>
        <li>Abrí tu perfil: tocá tu foto → “Ver perfil”.</li>
        <li>
          Debajo de tu nombre y titular, tocá <strong>“Más”</strong> (en algunas versiones, <strong>“Recursos”</strong>).
        </li>
        <li>
          Elegí <strong>“Guardar en PDF”</strong>. Se descarga un archivo tipo <em>Profile.pdf</em>: subilo acá.
        </li>
      </ol>
    </details>
  )
}

const SLOT_COPY: Record<DocTipo, { title: string; hint: string; placeholder: string }> = {
  cv: {
    title: 'Tu CV',
    hint: 'PDF, máximo 3 MB',
    placeholder: 'Pegá el texto de tu CV tal como está hoy.',
  },
  linkedin: {
    title: 'Tu perfil de LinkedIn',
    hint: 'El PDF que exporta LinkedIn, máximo 3 MB',
    placeholder: 'Pegá tu titular, el “Acerca de” y tu experiencia tal como están hoy en LinkedIn.',
  },
}

export function DocSlot({ tipo, draft, onChange }: { tipo: DocTipo; draft: DocDraft; onChange: (d: DocDraft) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = SLOT_COPY[tipo]

  const handleFile = (f: File) => {
    const err = checkPdf(f)
    setError(err)
    if (!err) onChange({ ...draft, file: f })
  }

  return (
    <div className="rounded-xl border border-border-color p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {copy.title} <span className="font-normal text-text-muted">(opcional)</span>
        </p>
        <div className="flex gap-1 text-xs" role="group" aria-label={`Cómo cargar ${copy.title.toLowerCase()}`}>
          {(['pdf', 'texto'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={draft.mode === m}
              onClick={() => onChange({ ...draft, mode: m })}
              className={`rounded-full border px-2.5 py-1 transition ${draft.mode === m ? 'border-primary bg-orange-50 font-semibold text-primary-ink' : 'border-border-color text-text-muted hover:bg-gray-50'}`}
            >
              {m === 'pdf' ? 'PDF' : 'Pegar texto'}
            </button>
          ))}
        </div>
      </div>

      {draft.mode === 'pdf' ? (
        <>
          {/* Botón real (no un div clickeable): recibe foco y se activa con Enter/Espacio. */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
            aria-label={
              draft.file
                ? `${copy.title}: archivo ${draft.file.name}. Activar para elegir otro PDF`
                : `${copy.title}: elegir un archivo PDF`
            }
            className="block w-full cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition"
            style={{ borderColor: draft.file ? '#047857' : '#e5e7eb', background: draft.file ? '#f0fdf4' : 'white' }}
          >
            {draft.file ? (
              <span className="block text-sm font-semibold text-green-800">✓ {draft.file.name}</span>
            ) : (
              <>
                <span className="block text-sm text-foreground">Arrastrá el PDF o hacé click</span>
                <span className="mt-0.5 block text-xs text-text-muted">{copy.hint}</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) handleFile(f)
            }}
          />
        </>
      ) : (
        <textarea
          value={draft.texto}
          onChange={(e) => onChange({ ...draft, texto: e.target.value })}
          rows={6}
          maxLength={15000}
          placeholder={copy.placeholder}
          className="w-full resize-y rounded-lg border border-border-color p-3 text-sm outline-none focus:border-primary"
        />
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {tipo === 'linkedin' && (
        <div className="mt-3">
          <LinkedInHowTo />
        </div>
      )}
    </div>
  )
}

// Panel lateral del chat: sumar CV y/o LinkedIn en cualquier momento del proceso.
export function DocsPanel({
  docs,
  status,
  onAttach,
}: {
  docs: ProfileDoc[]
  status: string | null
  onAttach: (tipo: DocTipo, file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<DocTipo>('cv')
  const [error, setError] = useState<string | null>(null)
  const faltan = (['cv', 'linkedin'] as const).filter((t) => !docs.some((d) => d.tipo === t))

  return (
    <div className="space-y-1.5">
      {docs.map((d) => (
        <p key={d.tipo} className="text-xs text-text-muted">
          ✓ {DOC_LABEL[d.tipo]}: {d.nombre}
        </p>
      ))}
      {status ? (
        <p className="text-xs text-text-muted">{status}</p>
      ) : (
        faltan.length > 0 && (
          <>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {faltan.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setPending(t)
                    inputRef.current?.click()
                  }}
                  className="text-xs font-semibold text-primary-ink underline underline-offset-2"
                >
                  Sumar {t === 'cv' ? 'mi CV' : 'mi LinkedIn'}
                </button>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                const err = checkPdf(f)
                setError(err)
                if (!err) onAttach(pending, f)
              }}
            />
            {faltan.includes('linkedin') && <LinkedInHowTo compact />}
          </>
        )
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <p className="pt-1 text-[11px] leading-snug text-text-muted">
        Opcional y solo como contexto: puedo preguntarte sobre lo que dice, pero no lo voy a corregir ni reescribir.
      </p>
    </div>
  )
}
