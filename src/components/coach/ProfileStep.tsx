import { useEffect, useRef, useState } from 'react'
import { documentsToText, extractPdfText, requestProfileReading } from '../../lib/coach/api'
import { draftReady, emptyDraft, type DocDraft } from '../../lib/coach/docs'
import type { DocTipo, Observation, ProfileDoc, ProfileReading, ProfileSignal, SignalState } from '../../lib/coach/types'
import { tr, type Key } from '../../lib/i18n'
import { trackEvent } from '../../lib/tracking'
import { CoachAvatar } from '../Logo'
import { DocSlot } from './DocInputs'

// Camino B — "cómo te lee un reclutador" (§4). La lectura no reemplaza el
// proceso: la persona elige qué recomendaciones toma y eso alimenta el Diagnóstico.

interface ProfileStepProps {
  initial?: { puesto: string; lectura: ProfileReading; elegidas: number[] }
  onReading: (puesto: string, lectura: ProfileReading, documentos: ProfileDoc[]) => void
  onContinue: (elegidas: number[]) => void
}

export function ProfileStep({ initial, onReading, onContinue }: ProfileStepProps) {
  if (initial) return <ReadingView {...initial} onContinue={onContinue} />
  return <ProfileForm onReading={onReading} />
}

const TIPOS: DocTipo[] = ['cv', 'linkedin']

function ProfileForm({ onReading }: Pick<ProfileStepProps, 'onReading'>) {
  const [puesto, setPuesto] = useState('')
  const [drafts, setDrafts] = useState<Record<DocTipo, DocDraft>>({ cv: emptyDraft(), linkedin: emptyDraft() })
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const listos = TIPOS.filter((t) => draftReady(drafts[t]))
  const hasPuesto = puesto.trim().length >= 3
  const ready = hasPuesto && listos.length > 0
  // Si el botón está apagado, se le dice a la persona qué falta (en vez de dejarla adivinar).
  const missing = !hasPuesto ? tr('profile.missing.role') : listos.length === 0 ? tr('profile.missing.doc') : null

  const submit = async () => {
    setError(null)
    try {
      const documentos: ProfileDoc[] = []
      for (const tipo of listos) {
        const d = drafts[tipo]
        if (d.mode === 'pdf' && d.file) {
          setStatus(tipo === 'cv' ? tr('flow.reading.cv') : tr('flow.reading.linkedin'))
          documentos.push({ tipo, nombre: d.file.name, texto: await extractPdfText(d.file) })
        } else {
          documentos.push({ tipo, nombre: 'Texto pegado', texto: d.texto.trim() })
        }
      }
      setStatus(documentos.length > 1 ? tr('profile.busy.both') : tr('profile.busy.one'))
      const { data } = await requestProfileReading(puesto.trim(), documentsToText(documentos) ?? '')
      trackEvent('profile_reading_completed', { docs: listos.join('+') })
      onReading(puesto.trim(), data, documentos)
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
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tr('profile.eyebrow')}</p>
        <h2 className="mb-3">{tr('profile.title')}</h2>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-text-muted">
          {tr('profile.lede')}
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-5 rounded-2xl border border-danger/20 bg-danger-soft p-3.5 text-sm text-danger">
          {error}
        </div>
      )}

      <section aria-labelledby="que-recibis" className="card mb-5">
        <h3 id="que-recibis" className="mb-4">
          {tr('profile.receive')}
        </h3>
        <ul role="list" className="grid gap-4 sm:grid-cols-3">
          {[
            [<EyeIcon key="e" />, tr('profile.b1.title'), tr('profile.b1.body')],
            [<QuoteIcon key="q" />, tr('profile.b2.title'), tr('profile.b2.body')],
            [<PickIcon key="p" />, tr('profile.b3.title'), tr('profile.b3.body')],
          ].map(([icon, title, body]) => (
            <li key={title as string} className="flex gap-3 sm:block">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:mb-2" aria-hidden="true">
                {icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-2xl bg-secondary p-3.5 text-sm leading-relaxed text-text-muted">
          <strong className="font-semibold text-foreground">{tr('profile.wont.strong')}</strong>
          {tr('profile.wont.rest')}
        </p>
      </section>

      <section aria-labelledby="paso-puesto" className="card mb-5">
        <StepTitle n={1} id="paso-puesto" title={tr('profile.step1.title')} />
        <p className="mb-3 text-sm text-text-muted">{tr('profile.step1.hint')}</p>
        <input
          id="puesto"
          aria-labelledby="paso-puesto"
          value={puesto}
          onChange={(e) => setPuesto(e.target.value)}
          maxLength={200}
          placeholder={tr('profile.step1.placeholder')}
          className="w-full rounded-2xl border border-border-color bg-background p-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </section>

      <section aria-labelledby="paso-perfil" className="card mb-5">
        <StepTitle n={2} id="paso-perfil" title={tr('profile.step2.title')} />
        <p className="mb-4 text-sm text-text-muted">
          {tr('profile.step2.hint')}
        </p>
        <div className="space-y-3">
          {TIPOS.map((t) => (
            <DocSlot key={t} tipo={t} draft={drafts[t]} onChange={(d) => setDrafts((prev) => ({ ...prev, [t]: d }))} />
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-text-muted">
          {tr('profile.step2.privacy')}{' '}
          <a href="#privacidad" target="_blank" rel="noopener" className="underline underline-offset-2">
            {tr('chat.onb.3.link')}
          </a>
        </p>
      </section>

      <button onClick={submit} disabled={!ready} aria-describedby={missing ? 'falta' : undefined} className="btn-primary w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-40">
        {tr('profile.submit')}
      </button>
      <p id="falta" className="mt-3 min-h-5 text-center text-sm text-text-muted">
        {missing}
      </p>
    </div>
  )
}

const ico = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'h-4 w-4' } as const

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ico}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ico}>
      <path d="M7 7h4v5a4 4 0 0 1-4 4M15 7h4v5a4 4 0 0 1-4 4" />
    </svg>
  )
}

function PickIcon() {
  return (
    <svg viewBox="0 0 24 24" {...ico}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  )
}

function StepTitle({ n, id, title }: { n: number; id: string; title: string }) {
  return (
    <h3 id={id} className="mb-1.5 flex items-center gap-2.5 text-lg">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary font-sans" aria-hidden="true">
        {n}
      </span>
      {title}
    </h3>
  )
}

function Cita({ cita, fuente, label }: { cita: string; fuente?: string; label?: string }) {
  if (!cita) return null
  return (
    <span className="mt-1 block text-xs italic text-text-muted">
      {label && <span className="mr-1.5 not-italic font-semibold">{label}:</span>}
      {fuente && <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase">{fuente}</span>}“{cita}”
    </span>
  )
}

function ReadingView({
  puesto,
  lectura,
  elegidas: initialElegidas,
  onContinue,
}: {
  puesto: string
  lectura: ProfileReading
  elegidas: number[]
  onContinue: (elegidas: number[]) => void
}) {
  const [elegidas, setElegidas] = useState<number[]>(initialElegidas)
  // Al pasar del formulario a la lectura el botón desaparece: se lleva el foco al título.
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])
  const toggle = (i: number) => setElegidas((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
  // §4: máximo tres cambios concretos, aunque el modelo devuelva más.
  const recomendaciones = lectura.recomendaciones.slice(0, 3)

  return (
    <div className="ai-result mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('profile.read.eyebrow', { role: puesto })}</p>
        <h2 ref={titleRef} tabIndex={-1} className="outline-none">
          {tr('flow.h1.profile')}
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-accent/30 bg-accent-soft p-5">
          <p className="text-base font-medium leading-snug text-accent-ink">{lectura.comunicaHoy ?? lectura.notaComunica}</p>
          {(lectura.senales?.length ?? 0) > 0 && (
            <>
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-accent-ink">{tr('profile.read.signals')}</p>
              <SignalList signals={lectura.senales ?? []} />
            </>
          )}
          <p className="mt-3 text-xs leading-relaxed text-accent-ink">{tr('profile.read.signalsNote', { role: puesto })}</p>
        </div>

        <div className="card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('profile.read.first')}</p>
          <p className="text-sm leading-relaxed text-foreground">{lectura.primeraImpresion}</p>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">{lectura.consistenciaMarca}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ObservationList title={tr('profile.read.good')} items={lectura.fortalezas} />
          <ObservationList title={tr('profile.read.missing')} items={lectura.ausencias} citeLabel={tr('profile.read.closest')} />
        </div>

        <div className="card">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('profile.read.changes')}</p>
          <p className="mb-4 text-sm text-text-muted">{tr('profile.read.changesHint')}</p>
          <ul className="space-y-3">
            {recomendaciones.map((r, i) => (
              <li key={i}>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-border-color p-4 transition hover:bg-secondary">
                  <input type="checkbox" checked={elegidas.includes(i)} onChange={() => toggle(i)} className="mt-1 accent-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.cambio}</p>
                    <p className="mt-1 text-sm text-text-muted">{r.porQue}</p>
                    {r.cita && (
                      <p className="mt-2 border-l-2 border-border-color pl-3">
                        <Cita cita={r.cita} fuente={r.fuente} />
                      </p>
                    )}
                    {r.tipo === 'decision_personal' && (
                      <p className="mt-2 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs text-text-muted">
                        {tr('profile.read.convention')}
                      </p>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-ink p-6 text-center text-white">
        <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {tr('profile.read.cta')}
        </p>
        <button
          onClick={() => onContinue(elegidas)}
          className="rounded-xl bg-card px-7 py-3 font-semibold text-foreground transition hover:shadow-lg active:scale-95"
        >
          {tr('profile.read.start')}
        </button>
      </div>
    </div>
  )
}

function ObservationList({ title, items, citeLabel }: { title: string; items: Observation[]; citeLabel?: string }) {
  return (
    <div className="card">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</p>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-foreground">
            {it.observacion}
            <Cita cita={it.cita} fuente={it.fuente} label={citeLabel} />
          </li>
        ))}
      </ul>
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
