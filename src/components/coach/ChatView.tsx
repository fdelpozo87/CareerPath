import { useEffect, useRef, useState } from 'react'
import { STAGE_INTRO, STAGE_LABEL, STAGE_OBJECTIVES, STAGE_ORDER } from '../../../shared/stages'
import { DOC_LABEL } from '../../lib/coach/docs'
import type { DocTipo, Path, Session, Stage } from '../../lib/coach/types'
import { CoachAvatar } from '../Logo'
import { DocsPanel } from './DocInputs'
import { StageMap } from './StageMap'

const NEXT_LABEL: Record<Stage, string> = {
  diagnostico: 'Seguir a Discovery →',
  discovery: 'Seguir al Plan de Acción →',
  plan: 'Ver mi informe y elegir compromisos →',
}

// Para vencer la hoja en blanco: frases para arrancar que la persona puede editar.
const STARTERS: Record<Path, string[]> = {
  quiebre: ['Siento que estoy estancado/a', 'No sé si quedarme o cambiar de trabajo', 'Quiero crecer pero no sé por dónde empezar'],
  perfil: ['Algo de lo que dice mi perfil me sorprendió', 'Quiero saber qué cambiar primero', 'No me siento reflejado/a en mi perfil'],
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
  onResumeTopic: (id: string) => void
  docStatus: string | null
}

export function ChatView({ session, thinking, error, demo, onSend, onRetry, onAdvance, onAttachDoc, onResumeTopic, docStatus }: ChatViewProps) {
  const [draft, setDraft] = useState('')
  // En pantallas táctiles Enter da un salto de línea (se envía con el botón): ahí se escriben textos largos.
  const [touch] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const visible = session.messages.filter((m) => !m.hidden)
  const hasUserMessage = visible.some((m) => m.role === 'user')

  // El mapa se muestra justo después del mensaje que cerró la etapa; lo que la persona escriba
  // después queda debajo. (Sesiones guardadas antes de esta marca: al final de la conversación.)
  let mapIndex = -1
  if (session.stageReady) {
    mapIndex = visible.findLastIndex((m) => m.cierraEtapa && m.stage === session.stage)
    if (mapIndex === -1) mapIndex = visible.length - 1
  }
  const lastIsClosing = mapIndex === visible.length - 1

  // Lleva la conversación al último mensaje (sin animación si la persona pidió reducir el movimiento).
  useEffect(() => {
    const el = logRef.current
    if (!el) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // El mapa de cierre es alto: cuando recién llega se muestra desde su título, no desde sus botones.
    // Con mensajes posteriores, se baja al último como en cualquier chat.
    const map = session.stageReady && lastIsClosing ? el.querySelector<HTMLElement>('#stage-map') : null
    const top = map ? map.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12 : el.scrollHeight
    el.scrollTo({ top, behavior: calm ? 'auto' : 'smooth' })
  }, [visible.length, thinking, session.stageReady, lastIsClosing])

  // El cuadro de texto crece con lo que se escribe, hasta un tope.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  const send = () => {
    const text = draft.trim()
    if (!text || thinking) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section aria-label="Conversación con tu coach" className="card flex h-[calc(100dvh-7.5rem)] min-h-[30rem] flex-col overflow-hidden p-0 sm:h-[calc(100dvh-8.5rem)]">
        <CardHeader session={session} docStatus={docStatus} onAttachDoc={onAttachDoc} />

        {/* Región con scroll propio: enfocable con teclado (tabIndex) para poder leer el historial. */}
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversación"
          tabIndex={0}
          className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {demo && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-xs text-accent-ink">
              Modo demo: no hay GEMINI_API_KEY configurada, las respuestas son de guion.
            </div>
          )}

          {!hasUserMessage && (
            <Onboarding
              path={session.path}
              onPick={(text) => {
                setDraft(text)
                inputRef.current?.focus()
              }}
            />
          )}

          {visible.map((m, i) => {
            const prevStage = visible[i - 1]?.stage
            return (
              <div key={i} className="space-y-3">
                {(i === 0 || (prevStage && prevStage !== m.stage)) && <StageDivider stage={m.stage} />}
                {m.role === 'user' ? <UserBubble text={m.text} /> : <CoachBubble text={m.text} />}
                {m.derivacion && <DerivationCard />}
                {i === mapIndex && (
                  <StageMap
                    stage={session.stage}
                    map={session.mapas?.[session.stage]}
                    fallbackText={session.sintesis[session.stage]}
                    nextLabel={NEXT_LABEL[session.stage]}
                    onAdvance={onAdvance}
                    onAdjust={() => inputRef.current?.focus()}
                    onResume={(id) => {
                      onResumeTopic(id)
                      const label = STAGE_OBJECTIVES[session.stage].find((o) => o.id === id)?.label ?? ''
                      setDraft(`Quiero retomar lo de "${label}".`)
                      inputRef.current?.focus()
                    }}
                  />
                )}
              </div>
            )
          })}

          {thinking && <Typing />}

          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-3.5 text-sm text-danger">
              <span>{error}</span>
              <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
                Reintentar
              </button>
            </div>
          )}

        </div>

        {/* El cierre no se pierde: aunque la persona siga escribiendo, el botón para seguir queda a la vista. */}
        {session.stageReady && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 bg-primary-soft px-4 py-2.5 sm:px-6">
            <p className="text-sm font-medium text-primary">Tu mapa de {STAGE_LABEL[session.stage]} está listo.</p>
            <button onClick={onAdvance} className="btn-primary px-5 py-2 text-sm">
              {NEXT_LABEL[session.stage]}
            </button>
          </div>
        )}

        <footer className="border-t border-border-color bg-card p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-border-color bg-background p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Escribí con tus palabras. No hay respuestas correctas."
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-base leading-6 outline-none placeholder:text-text-muted/70"
              aria-label="Tu respuesta"
            />
            <button onClick={send} disabled={!draft.trim() || thinking} className="btn-primary h-11 shrink-0 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
              Enviar
            </button>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-text-muted">
            <span>{touch ? 'Tocá Enviar cuando termines' : 'Enter para enviar · Shift+Enter para un salto de línea'}</span>
            <span className="inline-flex items-center gap-1">
              <LockIcon /> Lo que escribís queda en tu navegador
            </span>
          </p>
        </footer>
      </section>
    </div>
  )
}

// ── Encabezado: quién es el coach y dónde estás ──────────────────────────────

function CardHeader({ session, docStatus, onAttachDoc }: Pick<ChatViewProps, 'session' | 'docStatus' | 'onAttachDoc'>) {
  const [docsOpen, setDocsOpen] = useState(false)
  const idx = STAGE_ORDER.indexOf(session.stage)
  const objetivos = STAGE_OBJECTIVES[session.stage]
  const cubiertos = session.cubiertos[session.stage]
  const omitidos = session.omitidos?.[session.stage] ?? []
  const fraction = objetivos.length ? cubiertos.length / objetivos.length : 0
  const intro = STAGE_INTRO[session.stage]
  const docsLabel = session.documentos.length > 0 ? `Tu perfil: ${session.documentos.map((d) => DOC_LABEL[d.tipo]).join(' + ')}` : 'Sumar mi CV o LinkedIn'

  return (
    <header className="border-b border-border-color bg-card px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <CoachAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight text-foreground">Tu coach de carrera</p>
          <p className="truncate text-xs text-text-muted">Te escucho, sin apuro.</p>
        </div>
        <button
          type="button"
          onClick={() => setDocsOpen((o) => !o)}
          aria-expanded={docsOpen}
          aria-controls="panel-documentos"
          className="btn-secondary h-10 shrink-0 gap-1.5 px-3 py-0 text-xs sm:px-3.5"
        >
          <PaperclipIcon />
          {/* En celular solo el ícono (el texto queda para lectores de pantalla). */}
          <span className="sr-only sm:not-sr-only">{docsLabel}</span>
        </button>
      </div>

      {docsOpen && (
        <div id="panel-documentos" className="mt-3 rounded-2xl bg-secondary p-4">
          <DocsPanel docs={session.documentos} status={docStatus} onAttach={onAttachDoc} />
        </div>
      )}

      {/* Dónde estás: etapa, qué se hace ahora y qué viene después. */}
      <div className="mt-2.5">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <p className="font-semibold text-primary">
            Etapa {idx + 1} de {STAGE_ORDER.length} · {STAGE_LABEL[session.stage]}
          </p>
          <p className="hidden text-text-muted sm:block">Después: {intro.despues}</p>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {STAGE_ORDER.map((s, i) => (
            <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: i < idx ? '100%' : i === idx ? `${Math.max(fraction * 100, 8)}%` : '0%' }}
              />
            </span>
          ))}
        </div>
        <p className="mt-1.5 hidden text-xs text-text-muted sm:block">Ahora: {intro.queHacemos}</p>

        <ul role="list" aria-label="Temas de esta etapa" className="mt-1.5 flex flex-wrap gap-1.5">
          {objetivos.map((o) => {
            const done = cubiertos.includes(o.id)
            const dejado = !done && omitidos.includes(o.id)
            // El tema por el que el coach está preguntando ahora (y que todavía no se contestó).
            const enFoco = !done && !dejado && session.foco === o.id
            const style = done
              ? 'bg-primary-soft font-medium text-primary'
              : dejado
                ? 'border border-dashed border-text-muted/60 text-text-muted'
                : enFoco
                ? 'border border-accent bg-accent-soft font-medium text-accent-ink'
                : 'border border-border-color text-text-muted'
            return (
              <li key={o.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${style}`}>
                {done && <CheckIcon />}
                {enFoco && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />}
                {o.label}
                {dejado && <span aria-hidden="true">{' '}· para después</span>}
                {/* El estado no puede depender solo del color o del ícono. */}
                <span className="sr-only">
                  {done ? ': ya lo hablamos' : dejado ? ': lo dejaste para más adelante' : enFoco ? ': es de lo que estamos hablando ahora y falta' : ': pendiente'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </header>
  )
}

// ── Mensajes ─────────────────────────────────────────────────────────────────

function CoachBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <CoachAvatar size="sm" />
      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-border-color bg-background px-4 py-3 text-[15px] leading-7 text-foreground sm:text-base">
        <span className="sr-only">Tu coach: </span>
        {text}
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-3 text-[15px] leading-7 text-foreground sm:text-base">
        <span className="sr-only">Vos: </span>
        {text}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex items-start gap-3">
      <CoachAvatar size="sm" />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border-color bg-background px-4 py-3.5">
        <span className="sr-only">Tu coach está escribiendo…</span>
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((d) => (
            <span key={d} className="h-1.5 w-1.5 rounded-full bg-primary" style={{ animation: `ai-pulse-glow 1.2s ${d * 0.2}s infinite` }} />
          ))}
        </span>
        <span className="text-xs italic text-text-muted" aria-hidden="true">
          pensando lo que me contás…
        </span>
      </div>
    </div>
  )
}

// Antes del primer mensaje: cómo funciona, y frases para arrancar.
function Onboarding({ path, onPick }: { path: Path; onPick: (text: string) => void }) {
  return (
    <div className="rounded-2xl border border-border-color bg-secondary/50 p-5 text-sm">
      <p className="mb-3 font-display text-lg text-foreground">Antes de empezar</p>
      <ul className="space-y-2 leading-relaxed text-text-muted">
        <li>
          <strong className="font-semibold text-foreground">Te voy a escuchar y a hacerte preguntas.</strong> No hay respuestas
          correctas, y las conclusiones son tuyas: no voy a decidir por vos.
        </li>
        <li>
          <strong className="font-semibold text-foreground">Vamos en tres etapas</strong> (Diagnóstico, Discovery y Plan de Acción).
          Arriba siempre ves dónde estás y qué falta.
        </li>
        <li>
          <strong className="font-semibold text-foreground">Podés cerrar y volver.</strong> Tu conversación queda en este navegador.{' '}
          <a href="#privacidad" target="_blank" rel="noopener" className="underline underline-offset-2">
            Cómo cuidamos tus datos
          </a>
        </li>
      </ul>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-text-muted">¿Te cuesta arrancar? Podés empezar con alguna de estas:</p>
      <ul role="list" className="flex flex-wrap gap-2">
        {STARTERS[path].map((text) => (
          <li key={text}>
            <button type="button" onClick={() => onPick(text)} className="rounded-full border border-border-color bg-card px-3.5 py-2 text-left text-sm text-foreground transition hover:border-primary hover:bg-primary-soft">
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StageDivider({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border-color" />
      <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">{STAGE_LABEL[stage]}</span>
      <span className="h-px flex-1 bg-border-color" />
    </div>
  )
}

// §5 Protocolo de derivación. Los recursos son de Argentina (zona horaria del
// equipo); a validar con el equipo antes de producción.
function DerivationCard() {
  return (
    <div className="ml-11 max-w-[88%] rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm text-foreground">
      <p className="mb-2 font-semibold text-primary">Para esto conviene otra ayuda, y no tenés que resolverlo sola/o</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Si hay riesgo inmediato para vos: 911 (emergencias) o 107 (emergencias médicas).</li>
        <li>Violencia o acoso por motivos de género: Línea 144, gratuita y las 24 horas.</li>
        <li>Maltrato o acoso laboral: un/a abogado/a laboralista, tu sindicato o la oficina de violencia laboral del Ministerio de Trabajo.</li>
        <li>Si te está afectando la salud: un/a profesional de salud mental o tu médico/a de cabecera.</li>
      </ul>
      <p className="mt-2 text-xs text-text-muted">Cuando quieras, seguimos acá con lo de tu carrera.</p>
    </div>
  )
}

// ── Íconos ───────────────────────────────────────────────────────────────────

const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" {...icon}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" {...icon}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" {...icon}>
      <path d="m21 11.5-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.3-2.4l8-8" />
    </svg>
  )
}
