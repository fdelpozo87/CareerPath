import { useEffect, useRef, useState, type ReactNode } from 'react'
import { documentsToText, extractPdfText, requestProfileReading } from '../../lib/coach/api'
import { checkPdf, emptyDraft, type DocDraft } from '../../lib/coach/docs'
import type { DocTipo, ProfileDoc, ProfileReading, ProfileSignal, SignalState } from '../../lib/coach/types'
import { tr, type Key } from '../../lib/i18n'
import { trackEvent } from '../../lib/tracking'
import { CoachAvatar } from '../Logo'
import { LinkedInHowTo } from './DocInputs'

// Camino B — "cómo te lee un reclutador" (§4 guardrail v3). La lectura alimenta el Diagnóstico.
// La persona no selecciona recomendaciones de una lista: reacciona a la lectura y luego
// decide en conversación si trabaja por su cuenta o junto al coach (§4.6.1).

interface ProfileStepProps {
  initial?: { puesto: string; lectura: ProfileReading; elegidas?: number[] }
  onReading: (puesto: string, lectura: ProfileReading, documentos: ProfileDoc[]) => void
  onContinue: () => void
}

export function ProfileStep({ initial, onReading, onContinue }: ProfileStepProps) {
  if (initial) return <ReadingView puesto={initial.puesto} lectura={initial.lectura} onContinue={onContinue} />
  return <ProfileForm onReading={onReading} />
}

function ProfileForm({ onReading }: Pick<ProfileStepProps, 'onReading'>) {
  const [puesto, setPuesto] = useState('')
  // Un único slot: PDF (CV) o texto pegado (LinkedIn)
  const [draft, setDraft] = useState<DocDraft>(emptyDraft())
  const [textMode, setTextMode] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const hasPuesto = puesto.trim().length >= 3
  const hasDoc = textMode ? draft.texto.trim().length > 0 : !!draft.file
  const ready = hasPuesto && hasDoc
  const missing = !hasPuesto ? tr('profile.missing.role') : !hasDoc ? tr('profile.missing.doc') : null

  const submit = async () => {
    setError(null)
    try {
      const tipo: DocTipo = textMode ? 'linkedin' : 'cv'
      let doc: ProfileDoc
      if (!textMode && draft.file) {
        setStatus(tr('flow.reading.cv'))
        doc = { tipo, nombre: draft.file.name, texto: await extractPdfText(draft.file) }
      } else {
        doc = { tipo, nombre: 'Texto pegado', texto: draft.texto.trim() }
      }
      setStatus(tr('profile.busy.one'))
      const { data } = await requestProfileReading(puesto.trim(), documentsToText([doc]) ?? '')
      trackEvent('profile_reading_completed', { docs: tipo })
      onReading(puesto.trim(), data, [doc])
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('flow.err.generic'))
    } finally {
      setStatus(null)
    }
  }

  if (status) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center">
        <div className="relative mx-auto mb-8 h-16 w-16">
          <div className="ai-ring absolute inset-0 rounded-full" />
          <div className="absolute flex items-center justify-center rounded-full bg-background" style={{ inset: 3 }}>
            <CoachAvatar />
          </div>
        </div>
        <p role="status" className="font-display text-xl text-foreground">{status}</p>
        <p className="mt-2 text-sm text-text-muted">{tr('profile.busy.wait')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h2 className="mb-2 text-2xl leading-snug">{tr('profile.form.title')}</h2>
        <p className="text-base leading-relaxed text-text-muted">{tr('profile.form.lede')}</p>
      </header>

      {error && (
        <div role="alert" className="mb-5 rounded-2xl border border-danger/20 bg-danger-soft p-3.5 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Puesto o área */}
      <div className="mb-6">
        <label htmlFor="puesto" className="mb-1.5 block text-sm font-semibold text-foreground">
          {tr('profile.form.role.label')}
        </label>
        <input
          id="puesto"
          value={puesto}
          onChange={(e) => setPuesto(e.target.value)}
          maxLength={200}
          placeholder={tr('profile.form.role.placeholder')}
          className="w-full rounded-2xl border border-border-color bg-background p-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <p className="mt-1.5 text-xs text-text-muted">{tr('profile.form.role.hint')}</p>
        <p className="mt-2 text-xs text-text-muted">
          {tr('profile.form.unclear')}{' '}
          <a href="#profesional" className="font-medium text-primary underline-offset-2 hover:underline">
            {tr('profile.form.unclear.link')} →
          </a>
        </p>
      </div>

      {/* Documento único: CV (PDF) o LinkedIn (texto) */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold text-foreground">{tr('profile.form.doc.title')}</p>

        {!textMode ? (
          <div>
            <button
              type="button"
              onClick={() => { setFileError(null); fileInputRef.current?.click() }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (!f) return
                const err = checkPdf(f)
                setFileError(err)
                if (!err) setDraft((prev) => ({ ...prev, file: f }))
              }}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-7 text-center transition"
              style={{
                borderColor: draft.file ? 'var(--color-primary)' : 'var(--color-border-color)',
                background: draft.file ? 'var(--color-primary-soft)' : 'var(--color-card)',
              }}
            >
              {draft.file ? (
                <span className="text-sm font-semibold text-primary">✓ {draft.file.name}</span>
              ) : (
                <>
                  <UploadIcon />
                  <span className="text-sm font-medium text-foreground">{tr('profile.form.doc.pdf')}</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                const err = checkPdf(f)
                setFileError(err)
                if (!err) setDraft((prev) => ({ ...prev, file: f }))
              }}
            />
            {fileError && <p role="alert" className="mt-2 text-xs text-danger">{fileError}</p>}
            <p className="mt-3 text-center text-xs text-text-muted">
              También puedes{' '}
              <button
                type="button"
                onClick={() => { setDraft(emptyDraft()); setTextMode(true) }}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                pegar el texto o el link de tu LinkedIn
              </button>
            </p>
          </div>
        ) : (
          <div>
            <textarea
              value={draft.texto}
              onChange={(e) => setDraft((prev) => ({ ...prev, texto: e.target.value }))}
              rows={8}
              maxLength={15000}
              placeholder={tr('docs.linkedin.placeholder')}
              className="w-full resize-y rounded-2xl border border-border-color bg-card p-3.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => { setDraft(emptyDraft()); setTextMode(false) }}
              className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              ← Volver a subir PDF
            </button>
            <LinkedInHowTo compact />
          </div>
        )}
      </div>

      <button
        onClick={() => void submit()}
        disabled={!ready}
        aria-describedby={missing ? 'falta' : undefined}
        className="btn-primary w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-40"
      >
        {tr('profile.submit')}
      </button>
      <p id="falta" className="mt-3 min-h-5 text-center text-sm text-text-muted">
        {missing}
      </p>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-text-muted" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function Cita({ cita, fuente, label }: { cita: string; fuente?: string; label?: string }) {
  if (!cita) return null
  return (
    <span className="mt-1 block text-xs italic text-text-muted">
      {label && <span className="mr-1.5 not-italic font-semibold">{label}:</span>}
      {fuente && <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase">{fuente}</span>}
      {'"'}{cita}{'"'}
    </span>
  )
}

function CitaBlock({ cita, fuente }: { cita: string; fuente?: string }) {
  if (!cita) return null
  return (
    <blockquote className="mt-3 border-l-2 border-accent pl-3">
      <p className="text-xs text-text-muted">
        {tr('profile.read.inCV')}
        {fuente && <span className="ml-1 mr-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase not-italic">{fuente}</span>}
        {' '}<span className="italic">{'"'}{cita}{'"'}</span>
      </p>
    </blockquote>
  )
}

function ReadingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-5 sm:p-6">
      <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

const GRUPO_LABEL: Record<string, string> = {
  queHacesYQueOfreces: 'Qué buscas y qué ofreces',
  experienciaQuePodriaSumar: 'Experiencia que podría sumar',
  loQueFaltaONoCuenta: 'Lo que falta o no se encuentra',
  detallesForma: 'Detalles de forma',
  convencionesMercado: 'Convenciones del mercado',
}

const GRUPO_ORDER = ['queHacesYQueOfreces', 'experienciaQuePodriaSumar', 'loQueFaltaONoCuenta', 'detallesForma', 'convencionesMercado']

// §4.6.1 — La persona no selecciona recomendaciones de una lista: reacciona a la lectura
// y en la conversación con el coach decide si trabaja por su cuenta o junto al coach.
function ReadingView({
  puesto,
  lectura,
  onContinue,
}: {
  puesto: string
  lectura: ProfileReading
  onContinue: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const tieneGrupos = lectura.recomendaciones.some((r) => r.grupo)
  const gruposConRecs = tieneGrupos
    ? GRUPO_ORDER.filter((g) => lectura.recomendaciones.some((r) => r.grupo === g))
    : lectura.recomendaciones.length > 0 ? ['_todas'] : []

  return (
    <div className="ai-result mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('profile.read.eyebrow', { role: puesto })}</p>
        <h2 ref={titleRef} tabIndex={-1} className="outline-none">
          {tr('flow.h1.profile')}
        </h2>
      </div>

      {/* Señales compactas (si las hay) */}
      {(lectura.senales?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent-ink">{tr('profile.read.signals')}</p>
          <SignalList signals={lectura.senales ?? []} />
          <p className="mt-3 text-xs leading-relaxed text-accent-ink">{tr('profile.read.signalsNote', { role: puesto })}</p>
        </div>
      )}

      {/* Card principal: secciones separadas por línea */}
      <div className="card divide-y divide-border-color overflow-hidden p-0">
        <ReadingSection title={tr('profile.read.first')}>
          <p className="text-sm leading-relaxed text-foreground">{lectura.primeraImpresion}</p>
          {lectura.primeraImpresionCita && <CitaBlock cita={lectura.primeraImpresionCita} />}
        </ReadingSection>

        {lectura.fortalezas.length > 0 && (
          <ReadingSection title={tr('profile.read.good')}>
            <div className="space-y-4">
              {lectura.fortalezas.map((f, i) => (
                <div key={i}>
                  <p className="text-sm leading-relaxed text-foreground">{f.observacion}</p>
                  {f.cita && <CitaBlock cita={f.cita} fuente={f.fuente} />}
                </div>
              ))}
            </div>
          </ReadingSection>
        )}

        {lectura.ausencias.length > 0 && (
          <ReadingSection title={tr('profile.read.missing')}>
            <div className="space-y-4">
              {lectura.ausencias.map((a, i) => (
                <div key={i}>
                  <p className="text-sm leading-relaxed text-foreground">{a.observacion}</p>
                  {a.cita && <CitaBlock cita={a.cita} fuente={a.fuente} />}
                </div>
              ))}
            </div>
          </ReadingSection>
        )}

        <ReadingSection title={tr('profile.read.consistency')}>
          <p className="text-sm leading-relaxed text-foreground">{lectura.consistenciaMarca}</p>
          {lectura.consistenciaMarcaCita && <CitaBlock cita={lectura.consistenciaMarcaCita} />}
        </ReadingSection>
      </div>

      {/* Recomendaciones del coach */}
      {gruposConRecs.length > 0 && (
        <div className="card mt-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('profile.read.changes')}</p>
          <p className="mb-5 text-sm text-text-muted">{tr('profile.read.changesHint.v3')}</p>
          <div className="space-y-6">
            {gruposConRecs.map((grupo) => {
              const recs = grupo === '_todas'
                ? lectura.recomendaciones
                : lectura.recomendaciones.filter((r) => r.grupo === grupo)
              return (
                <div key={grupo}>
                  {tieneGrupos && grupo !== '_todas' && (
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{GRUPO_LABEL[grupo]}</p>
                  )}
                  <div className="divide-y divide-border-color">
                    {recs.map((r, i) => (
                      <div key={i} className="py-4 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-6">
                        {r.elemento ? (
                          <p className="mb-1.5 text-sm font-semibold text-foreground sm:mb-0">{r.elemento}</p>
                        ) : (
                          <div />
                        )}
                        <div>
                          <p className="text-sm text-text-muted">{r.porQue}</p>
                          <p className="mt-1 text-sm text-foreground">{r.cambio}</p>
                          {r.cita && <CitaBlock cita={r.cita} fuente={r.fuente} />}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.tipo === 'decision_personal' && (
                              <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs text-text-muted">
                                {tr('profile.read.convention')}
                              </span>
                            )}
                            {r.grupo === 'experienciaQuePodriaSumar' && (
                              <span className="inline-block rounded-full border border-dashed border-text-muted/60 px-2.5 py-0.5 text-xs text-text-muted">
                                {tr('profile.read.toConfirm')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl bg-ink p-6 text-center text-white">
        <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {tr('profile.read.cta')}
        </p>
        <button onClick={onContinue} className="btn-advance px-7 py-3">
          {tr('profile.read.start')}
        </button>
      </div>
    </div>
  )
}


const SIGNAL_STYLE: Record<SignalState, string> = {
  entiende: 'bg-primary-soft text-primary',
  insinua: 'border border-accent text-accent-ink',
  ausente: 'border border-dashed border-text-muted/60 text-text-muted',
}

/** Qué busca quien filtra perfiles y cuánto de eso se entiende hoy: reemplaza a la nota. */
export function SignalList({ signals }: { signals: ProfileSignal[] }) {
  return (
    <ul role="list" className="space-y-2">
      {signals.map((s, i) => (
        <li key={i} className="text-sm leading-relaxed text-foreground">
          <span className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${SIGNAL_STYLE[s.estado]}`}>{tr(`profile.signal.${s.estado}` as Key)}</span>
          <span className="font-semibold">{s.tema}.</span> {s.comentario}
          <Cita cita={s.cita} />
        </li>
      ))}
    </ul>
  )
}
