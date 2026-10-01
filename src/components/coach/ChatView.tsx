import { useEffect, useRef, useState } from 'react'
import { STAGE_COLOR, STAGE_LABEL, STAGE_OBJECTIVES } from '../../../shared/stages'
import type { DocTipo, Session, Stage } from '../../lib/coach/types'
import { DocsPanel } from './DocInputs'

const NEXT_LABEL: Record<Stage, string> = {
  diagnostico: 'Pasar a Discovery →',
  discovery: 'Pasar al Plan de Acción →',
  plan: 'Ver mi informe y elegir compromisos →',
}

interface ChatViewProps {
  session: Session
  thinking: boolean
  error: string | null
  demo: boolean
  onSend: (text: string) => void
  onRetry: () => void
  onAdvance: () => void
  onAttachDoc: (tipo: DocTipo, file: File) => void
  docStatus: string | null
}

export function ChatView({ session, thinking, error, demo, onSend, onRetry, onAdvance, onAttachDoc, docStatus }: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const visible = session.messages.filter((m) => !m.hidden)
  const color = STAGE_COLOR[session.stage]
  const cubiertos = session.cubiertos[session.stage]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [visible.length, thinking, session.stageReady])

  const send = () => {
    const text = draft.trim()
    if (!text || thinking) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_240px]">
      <div className="flex min-h-[70vh] flex-col">
        {demo && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Modo demo: no hay GEMINI_API_KEY configurada, las respuestas son de guion.
          </div>
        )}

        <div className="flex-1 space-y-4" role="log" aria-live="polite" aria-label="Conversación con el coach">
          {!visible.some((m) => m.role === 'user') && <Onboarding path={session.path} />}
          {visible.map((m, i) => {
            const prevStage = visible[i - 1]?.stage
            return (
              <div key={i}>
                {prevStage && prevStage !== m.stage && <StageDivider stage={m.stage} />}
                {i === 0 && <StageDivider stage={m.stage} />}
                <div className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-sm leading-relaxed text-white'
                        : 'ai-tint max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-relaxed text-foreground'
                    }
                  >
                    {m.text}
                  </div>
                </div>
                {m.derivacion && <DerivationCard />}
              </div>
            )
          })}

          {thinking && (
            <div className="flex justify-start">
              <div className="ai-tint flex gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-4">
                <span className="sr-only">El coach está escribiendo…</span>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-text-muted"
                    style={{ animation: `ai-pulse-glow 1.2s ${d * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">
              <span>{error}</span>
              <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
                Reintentar
              </button>
            </div>
          )}

          {session.stageReady && !thinking && (
            <div className="ai-result rounded-2xl border p-5" style={{ borderColor: color + '40', background: color + '0d' }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color }}>
                Lo que construiste en {STAGE_LABEL[session.stage]}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{session.sintesis[session.stage]}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={onAdvance}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95"
                  style={{ background: color }}
                >
                  {NEXT_LABEL[session.stage]}
                </button>
                <span className="self-center text-xs text-text-muted">o seguí escribiendo si querés agregar algo</span>
              </div>
            </div>
          )}
          {/* scroll-margin: que el input fijo no tape el último mensaje */}
          <div ref={bottomRef} className="scroll-mb-32" />
        </div>

        <div className="sticky bottom-0 mt-6 bg-background pb-4 pt-2">
          <div className="flex items-end gap-2 rounded-2xl border border-border-color bg-white p-2 focus-within:border-primary">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={2}
              maxLength={4000}
              placeholder="Escribí con tus palabras…"
              className="max-h-48 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              aria-label="Tu respuesta"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || thinking}
              className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-text-muted">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>

      <aside className="order-first lg:order-none" aria-label="Progreso de la etapa">
        <div className="card p-4 lg:sticky lg:top-24 lg:p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color }}>
            {STAGE_LABEL[session.stage]}
          </p>
          <p className="mb-3 hidden text-xs text-text-muted lg:block">Lo que vamos cubriendo, en el orden que surja:</p>
          {/* role="list": Safari/VoiceOver pierde la semántica de lista cuando se quitan los estilos. */}
          <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1.5 lg:block lg:space-y-2">
            {STAGE_OBJECTIVES[session.stage].map((o) => {
              const done = cubiertos.includes(o.id)
              return (
                <li key={o.id} className="flex items-center gap-2 text-sm" style={{ color: done ? '#111' : '#636a76' }}>
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white"
                    style={{ background: done ? color : '#e5e7eb' }}
                  >
                    {done ? '✓' : ''}
                  </span>
                  {o.label}
                  {/* El estado no puede depender solo del color o del ícono. */}
                  <span className="sr-only">{done ? ': cubierto' : ': pendiente'}</span>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 border-t border-border-color pt-3 lg:mt-5 lg:pt-4">
            <DocsPanel docs={session.documentos} status={docStatus} onAttach={onAttachDoc} />
          </div>
        </div>
      </aside>
    </div>
  )
}

// Onboarding breve: se muestra hasta que la persona escribe su primer mensaje.
function Onboarding({ path }: { path: Session['path'] }) {
  return (
    <div className="rounded-2xl border border-border-color bg-white p-5 text-sm">
      <p className="mb-3 font-semibold text-foreground">Antes de empezar, cómo funciona</p>
      <ul className="space-y-2 text-text-muted">
        <li>
          <strong className="text-foreground">Te voy a hacer preguntas.</strong> No hay respuestas correctas y las conclusiones van a
          ser tuyas: no voy a decidir por vos.
        </li>
        <li>
          <strong className="text-foreground">Tres etapas:</strong> Diagnóstico, Discovery y Plan de Acción. Avanzamos cuando cubrimos
          lo que necesita cada una{path === 'quiebre' ? ', no por cantidad de preguntas' : ''}. El avance lo ves en el panel.
        </li>
        <li>
          <strong className="text-foreground">Tu progreso queda en este navegador</strong>: podés cerrar y retomar después.{' '}
          <a href="#privacidad" target="_blank" rel="noopener" className="underline underline-offset-2">
            Privacidad
          </a>
        </li>
      </ul>
    </div>
  )
}

function StageDivider({ stage }: { stage: Stage }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border-color" />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: STAGE_COLOR[stage] }}>
        {STAGE_LABEL[stage]}
      </span>
      <span className="h-px flex-1 bg-border-color" />
    </div>
  )
}

// §5 Protocolo de derivación. Los recursos son de Argentina (zona horaria del
// equipo); a validar con el equipo antes de producción.
function DerivationCard() {
  return (
    <div className="mt-3 max-w-[85%] rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <p className="mb-2 font-semibold">Para esto conviene otra ayuda, y no tenés que resolverlo sola/o</p>
      <ul className="list-disc space-y-1 pl-5 text-sky-800">
        <li>Si hay riesgo inmediato para vos: 911 (emergencias) o 107 (emergencias médicas).</li>
        <li>Violencia o acoso por motivos de género: Línea 144, gratuita y las 24 horas.</li>
        <li>Maltrato o acoso laboral: un/a abogado/a laboralista, tu sindicato o la oficina de violencia laboral del Ministerio de Trabajo.</li>
        <li>Si te está afectando la salud: un/a profesional de salud mental o tu médico/a de cabecera.</li>
      </ul>
      <p className="mt-2 text-xs text-sky-700">Cuando quieras, seguimos acá con lo de tu carrera.</p>
    </div>
  )
}
