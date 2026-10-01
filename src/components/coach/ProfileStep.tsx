import { useEffect, useRef, useState } from 'react'
import { documentsToText, extractPdfText, requestProfileReading } from '../../lib/coach/api'
import { draftReady, emptyDraft, type DocDraft } from '../../lib/coach/docs'
import type { DocTipo, Observation, ProfileDoc, ProfileReading } from '../../lib/coach/types'
import { trackEvent } from '../../lib/tracking'
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
  const ready = puesto.trim().length >= 3 && listos.length > 0

  const submit = async () => {
    setError(null)
    try {
      const documentos: ProfileDoc[] = []
      for (const tipo of listos) {
        const d = drafts[tipo]
        if (d.mode === 'pdf' && d.file) {
          setStatus(tipo === 'cv' ? 'Leyendo tu CV…' : 'Leyendo tu perfil de LinkedIn…')
          documentos.push({ tipo, nombre: d.file.name, texto: await extractPdfText(d.file) })
        } else {
          documentos.push({ tipo, nombre: 'Texto pegado', texto: d.texto.trim() })
        }
      }
      setStatus(documentos.length > 1 ? 'Comparando tu CV y tu LinkedIn como lo haría un reclutador…' : 'Mirándolo como lo haría un reclutador…')
      const { data } = await requestProfileReading(puesto.trim(), documentsToText(documentos) ?? '')
      trackEvent('profile_reading_completed', { docs: listos.join('+') })
      onReading(puesto.trim(), data, documentos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo falló. Intentá de nuevo.')
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
            <span className="text-lg text-text-muted">✦</span>
          </div>
        </div>
        <p role="status" className="text-sm text-text-muted">{status}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary-ink">Camino B · Tu perfil</p>
        <h2 className="mb-3">Cómo te lee un reclutador</h2>
        <p className="leading-relaxed text-text-muted">
          Una mirada externa sobre qué comunica tu perfil <em>hoy</em> para el tipo de puesto que te atrae. Mide el perfil,
          no cuánto valés como profesional. Después lo conversamos.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-5">
        <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="puesto">
          ¿A qué tipo de puesto apuntás?
        </label>
        <input
          id="puesto"
          value={puesto}
          onChange={(e) => setPuesto(e.target.value)}
          maxLength={200}
          placeholder="Ej: Product Manager en fintech, Analista de datos senior…"
          className="w-full rounded-xl border border-border-color p-3 text-sm outline-none focus:border-primary"
        />

        <p className="mt-6 mb-1 text-sm font-semibold text-foreground">Tu perfil hoy</p>
        <p className="mb-3 text-xs text-text-muted">
          Subí al menos uno. Con los dos, también vemos si tu CV y tu LinkedIn cuentan la misma historia.
        </p>
        <div className="space-y-3">
          {TIPOS.map((t) => (
            <DocSlot key={t} tipo={t} draft={drafts[t]} onChange={(d) => setDrafts((prev) => ({ ...prev, [t]: d }))} />
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Los archivos se leen solo para esta sesión y no se guardan en ningún servidor.{' '}
          <a href="#privacidad" target="_blank" rel="noopener" className="underline underline-offset-2">
            Cómo tratamos tus datos
          </a>
        </p>
      </div>

      <button onClick={submit} disabled={!ready} className="btn-primary w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-40">
        Ver cómo me lee un reclutador →
      </button>
    </div>
  )
}

function Cita({ cita, fuente }: { cita: string; fuente?: string }) {
  if (!cita) return null
  return (
    <span className="mt-1 block text-xs italic text-text-muted">
      {fuente && <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase">{fuente}</span>}“{cita}”
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Lectura externa · {puesto}</p>
        <h2 ref={titleRef} tabIndex={-1} className="outline-none">
          Cómo te lee un reclutador
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-amber-800">{lectura.nota}/10</span>
            <p className="text-sm font-medium text-amber-900">{lectura.notaComunica}</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-amber-800">
            Esta nota mide qué tan bien tu perfil comunica hoy lo que buscan para “{puesto}”. No mide cuánto valés como
            profesional, ni tu formación, ni tu experiencia real.
          </p>
        </div>

        <div className="card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Primera impresión</p>
          <p className="text-sm leading-relaxed text-foreground">{lectura.primeraImpresion}</p>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">{lectura.consistenciaMarca}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ObservationList title="Lo que ya comunica bien" items={lectura.fortalezas} />
          <ObservationList title="Lo que no aparece" items={lectura.ausencias} />
        </div>

        <div className="card">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">Hasta 3 cambios posibles</p>
          <p className="mb-4 text-sm text-text-muted">Son sugerencias. Marcá las que querés tomar; las demás quedan afuera.</p>
          <ul className="space-y-3">
            {recomendaciones.map((r, i) => (
              <li key={i}>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-border-color p-4 transition hover:bg-gray-50">
                  <input type="checkbox" checked={elegidas.includes(i)} onChange={() => toggle(i)} className="mt-1 accent-orange-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.cambio}</p>
                    <p className="mt-1 text-sm text-text-muted">{r.porQue}</p>
                    {r.cita && (
                      <p className="mt-2 border-l-2 border-border-color pl-3">
                        <Cita cita={r.cita} fuente={r.fuente} />
                      </p>
                    )}
                    {r.tipo === 'decision_personal' && (
                      <p className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-text-muted">
                        Convención de mercado · la decisión es tuya
                      </p>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-foreground p-6 text-center text-white">
        <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
          Ahora lo conversamos: qué te resonó, qué no y qué querés hacer con esto. Esa charla es el Diagnóstico.
        </p>
        <button
          onClick={() => onContinue(elegidas)}
          className="rounded-xl bg-white px-7 py-3 font-semibold text-foreground transition hover:shadow-lg active:scale-95"
        >
          Empezar la conversación →
        </button>
      </div>
    </div>
  )
}

function ObservationList({ title, items }: { title: string; items: Observation[] }) {
  return (
    <div className="card">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</p>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-foreground">
            {it.observacion}
            <Cita cita={it.cita} fuente={it.fuente} />
          </li>
        ))}
      </ul>
    </div>
  )
}
