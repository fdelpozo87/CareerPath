import { useRef, useState } from 'react'
import { checkPdf, docLabel, type DocDraft } from '../../lib/coach/docs'
import { tr } from '../../lib/i18n'
import type { DocTipo, ProfileDoc } from '../../lib/coach/types'

// Carga de CV y perfil de LinkedIn. LinkedIn no se lee por URL (requiere login
// y sus condiciones prohíben el scraping): la persona exporta su propio perfil
// a PDF, que es gratis y controla qué comparte.

export function LinkedInHowTo({ compact = false }: { compact?: boolean }) {
  return (
    <details className={compact ? 'text-[11px] text-text-muted' : 'text-xs text-text-muted'}>
      <summary className="cursor-pointer font-semibold text-primary underline-offset-2 hover:underline">{tr('docs.howto')}</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
        <li>{tr('docs.howto.1')}</li>
        <li>{tr('docs.howto.2')}</li>
        <li>
          {tr('docs.howto.3a')}
          <strong>{tr('docs.howto.3b')}</strong>
          {tr('docs.howto.3c')}
          <strong>{tr('docs.howto.3d')}</strong>
          {tr('docs.howto.3e')}
        </li>
        <li>
          {tr('docs.howto.4a')}
          <strong>{tr('docs.howto.4b')}</strong>
          {tr('docs.howto.4c')}
          <em>{tr('docs.howto.4d')}</em>
          {tr('docs.howto.4e')}
        </li>
      </ol>
    </details>
  )
}

const slotCopy = (tipo: DocTipo) => ({
  title: tr(`docs.${tipo}.title`),
  desc: tr(`docs.${tipo}.desc`),
  hint: tr(`docs.${tipo}.hint`),
  placeholder: tr(`docs.${tipo}.placeholder`),
})

export function DocSlot({ tipo, draft, onChange }: { tipo: DocTipo; draft: DocDraft; onChange: (d: DocDraft) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = slotCopy(tipo)

  const handleFile = (f: File) => {
    const err = checkPdf(f)
    setError(err)
    if (!err) onChange({ ...draft, file: f })
  }

  return (
    <div className="rounded-xl border border-border-color p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="text-xs text-text-muted">{copy.desc}</p>
        </div>
        <div className="flex gap-1 text-xs" role="group" aria-label={tr('docs.mode.group', { what: copy.title.toLowerCase() })}>
          {(['pdf', 'texto'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={draft.mode === m}
              onClick={() => onChange({ ...draft, mode: m })}
              className={`rounded-full border px-2.5 py-1 transition ${draft.mode === m ? 'border-primary bg-secondary font-semibold text-primary' : 'border-border-color text-text-muted hover:bg-secondary'}`}
            >
              {m === 'pdf' ? tr('docs.mode.pdf') : tr('docs.mode.text')}
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
                ? tr('docs.fileLabel', { title: copy.title, name: draft.file.name })
                : tr('docs.pickLabel', { title: copy.title })
            }
            className="block w-full cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition"
            style={{ borderColor: draft.file ? 'var(--color-primary)' : 'var(--color-border-color)', background: draft.file ? 'var(--color-primary-soft)' : 'var(--color-card)' }}
          >
            {draft.file ? (
              <span className="block text-sm font-semibold text-primary">✓ {draft.file.name}</span>
            ) : (
              <>
                <span className="block text-sm text-foreground">{tr('docs.drop')}</span>
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
        <p role="alert" className="mt-2 text-xs text-danger">
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
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-foreground">
        {tr('docs.panel.intro')}
      </p>
      {docs.map((d) => (
        <p key={d.tipo} className="text-xs text-text-muted">
          {tr('docs.panel.added', { kind: docLabel(d.tipo), name: d.nombre })}
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
                  className="text-xs font-semibold text-primary underline underline-offset-2"
                >
                  {t === 'cv' ? tr('docs.panel.addCv') : tr('docs.panel.addLinkedin')}
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
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <p className="pt-1 text-[11px] leading-snug text-text-muted">
        {tr('docs.panel.note')}
      </p>
    </div>
  )
}
