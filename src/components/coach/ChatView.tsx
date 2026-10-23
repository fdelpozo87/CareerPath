import { useEffect, useRef, useState } from 'react'
import { STAGE_ORDER, introFor, objectiveLabel, objectivesFor } from '../../../shared/stages'
import { looksLikeMarketQuestion } from '../../../shared/marketIntent'
import { docLabel } from '../../lib/coach/docs'
import { getLang, stageLabel, tr, type Key } from '../../lib/i18n'
import type { DocTipo, MarketSource, Path, Session, Stage } from '../../lib/coach/types'
import { CoachAvatar } from '../Logo'
import { DocsPanel } from './DocInputs'
import { ProfileRecap } from './ProfileRecap'
import { StageMap } from './StageMap'

const formatDate = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') : '')

const nextLabel = (stage: Stage) => tr(`chat.next.${stage}` as Key)

// Para vencer la hoja en blanco: frases para arrancar que la persona puede editar.
const starters = (path: Path) => [1, 2, 3].map((n) => tr(`chat.starters.${path}.${n}` as Key))

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
    <div className="mx-auto h-full w-full max-w-3xl">
      <section aria-label={tr('chat.section')} className="card relative flex h-full min-h-0 flex-col overflow-hidden p-0">
        <CardHeader session={session} docStatus={docStatus} onAttachDoc={onAttachDoc} />

        {/* Región con scroll propio: enfocable con teclado (tabIndex) para poder leer el historial. */}
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={tr('chat.log')}
          tabIndex={0}
          className="relative flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        >
          {demo && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-xs text-accent-ink">
              {tr('chat.demo')}
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
                {m.role === 'user' ? <UserBubble text={m.text} /> : <CoachBubble text={m.text} sources={m.fuentes} date={m.fechaDatos} />}
                {m.derivacion && <DerivationCard />}
                {/* El mapa de una etapa ya cerrada queda en el hilo, plegado, para poder releerlo. */}
                {m.cierraEtapa && m.stage !== session.stage && session.mapas?.[m.stage] && (
                  <details className="rounded-2xl border border-border-color bg-secondary/40 p-3 text-sm">
                    <summary className="cursor-pointer font-semibold text-foreground">{tr('chat.pastMap', { stage: stageLabel(m.stage) })}</summary>
                    <div className="mt-3">
                      <StageMap stage={m.stage} path={session.path} map={session.mapas[m.stage]} fallbackText={session.sintesis[m.stage]} onAdjust={() => {}} onResume={() => {}} readOnly />
                    </div>
                  </details>
                )}
                {i === mapIndex && (
                  <StageMap
                    stage={session.stage}
                    path={session.path}
                    map={session.mapas?.[session.stage]}
                    fallbackText={session.sintesis[session.stage]}
                    onAdjust={() => inputRef.current?.focus()}
                    onResume={(id) => {
                      onResumeTopic(id)
                      const label = objectiveLabel(id, getLang())
                      setDraft(tr('chat.resumeDraft', { label }))
                      inputRef.current?.focus()
                    }}
                  />
                )}
              </div>
            )
          })}

          {thinking && <Typing searching={looksLikeMarketQuestion(visible.findLast((m) => m.role === 'user')?.text ?? '')} />}

          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-3.5 text-sm text-danger">
              <span>{error}</span>
              <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
                {tr('common.retry')}
              </button>
            </div>
          )}

        </div>

        {/* El cierre no se pierde: aunque la persona siga escribiendo, el botón para seguir queda a la vista. */}
        {session.stageReady && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 bg-primary-soft px-4 py-2.5 sm:px-6">
            <p className="text-sm font-medium text-primary">{tr('chat.mapReady', { stage: stageLabel(session.stage) })}</p>
            <button onClick={onAdvance} className="btn-advance px-5 py-2 text-sm">
              {nextLabel(session.stage)}
            </button>
          </div>
        )}

        <footer className="border-t border-border-color bg-card p-3 sm:p-4 [@media(max-height:560px)]:p-2">
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
              placeholder={tr('chat.placeholder')}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-base leading-6 outline-none placeholder:text-text-muted/70"
              aria-label={tr('chat.answerLabel')}
            />
            <button onClick={send} disabled={!draft.trim() || thinking} className="btn-primary h-11 shrink-0 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
              {tr('common.send')}
            </button>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-text-muted [@media(max-height:560px)]:hidden">
            <span>{touch ? tr('chat.hint.touch') : tr('chat.hint.keyboard')}</span>
            <span className="inline-flex items-center gap-1">
              <LockIcon /> {tr('chat.privacy')}
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
  const [topicsOpen, setTopicsOpen] = useState(false)
  const started = session.messages.some((m) => m.role === 'user' && !m.hidden)
  const idx = STAGE_ORDER.indexOf(session.stage)
  const objetivos = objectivesFor(session.stage, session.path)
  const cubiertos = session.cubiertos[session.stage]
  const omitidos = session.omitidos?.[session.stage] ?? []
  const fraction = objetivos.length ? cubiertos.length / objetivos.length : 0
  const intro = introFor(session.stage, session.path, getLang())
  const docsLabel = session.documentos.length > 0 ? tr('chat.docs.profile', { docs: session.documentos.map((d) => docLabel(d.tipo)).join(' + ') }) : tr('chat.docs.add')

  return (
    <header className="border-b border-border-color bg-card px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <CoachAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight text-foreground">{tr('chat.title')}</p>
          <p className="truncate text-xs text-text-muted [@media(max-height:560px)]:hidden">{tr('chat.subtitle')}</p>
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

      {session.perfil && <ProfileRecap perfil={session.perfil} />}

      {/* Antes de la primera respuesta es la etapa 0 ("Antes de empezar"); al empezar, la etapa 1. */}
      {!started ? (
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <p className="font-semibold text-primary">{tr('chat.stage0.label')}</p>
            <p className="hidden text-text-muted sm:block">{tr('chat.stage0.next')}</p>
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {STAGE_ORDER.map((s) => (
              <span key={s} className="h-1.5 flex-1 rounded-full bg-secondary" />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <p className="font-semibold text-primary">
              {tr('chat.stageOf', { n: idx + 1, total: STAGE_ORDER.length, stage: stageLabel(session.stage) })}
            </p>
            <p className="hidden text-text-muted sm:block">{tr('chat.after', { next: intro.despues })}</p>
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {STAGE_ORDER.map((s, i) => (
              <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <span
                  className={`block h-full rounded-full transition-all duration-500 ${i === idx ? 'bg-accent' : 'bg-primary'}`}
                  style={{ width: i < idx ? '100%' : i === idx ? `${Math.max(fraction * 100, 8)}%` : '0%' }}
                />
              </span>
            ))}
          </div>
          <p className="mt-1.5 hidden text-xs text-text-muted sm:block [@media(max-height:560px)]:hidden">{tr('chat.now', { what: intro.queHacemos })}</p>

          {/* Con poca altura (teclado abierto, celular horizontal) se deja más lugar a la conversación. */}
          {/* En pantallas angostas los temas quedan plegados: el encabezado ocupaba un tercio de la pantalla. */}
          <button
            type="button"
            onClick={() => setTopicsOpen((o) => !o)}
            aria-expanded={topicsOpen}
            aria-controls="temas-etapa"
            className="mt-1.5 text-xs text-text-muted underline underline-offset-2 sm:hidden"
          >
            {tr(topicsOpen ? 'chat.topics.hide' : 'chat.topics.show', { done: cubiertos.length, total: objetivos.length })}
          </button>
          <ul id="temas-etapa" role="list" aria-label={tr('chat.topics')} className={`mt-1.5 flex-wrap gap-1.5 sm:flex [@media(max-height:560px)]:hidden ${topicsOpen ? 'flex' : 'hidden'}`}>
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
                  {objectiveLabel(o.id, getLang())}
                  {dejado && <span aria-hidden="true">{tr('chat.topic.laterTag')}</span>}
                  {/* El estado no puede depender solo del color o del ícono. */}
                  <span className="sr-only">
                    {done ? tr('chat.topic.done') : dejado ? tr('chat.topic.later') : enFoco ? tr('chat.topic.focus') : tr('chat.topic.pending')}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </header>
  )
}

// ── Mensajes ─────────────────────────────────────────────────────────────────

function CoachBubble({ text, sources, date }: { text: string; sources?: MarketSource[]; date?: string }) {
  return (
    <div className="flex items-start gap-3">
      <CoachAvatar size="sm" />
      <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-border-color bg-background px-4 py-3 text-[15px] leading-7 text-foreground sm:text-base">
        <p className="whitespace-pre-wrap">
          <span className="sr-only">{tr('chat.coachSays')}</span>
          {text}
        </p>
        {sources && sources.length > 0 && (
          <div className="mt-3 border-t border-border-color pt-2.5 text-xs leading-relaxed text-text-muted">
            <p className="font-semibold">{tr('chat.sources.title', { date: formatDate(date) })}</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-1">{tr('chat.sources.note')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-3 text-[15px] leading-7 text-foreground sm:text-base">
        <span className="sr-only">{tr('chat.youSay')}</span>
        {text}
      </div>
    </div>
  )
}

function Typing({ searching }: { searching?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <CoachAvatar size="sm" />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border-color bg-background px-4 py-3.5">
        <span className="sr-only">{tr('chat.typing.sr')}</span>
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((d) => (
            <span key={d} className="h-1.5 w-1.5 rounded-full bg-primary" style={{ animation: `ai-pulse-glow 1.2s ${d * 0.2}s infinite` }} />
          ))}
        </span>
        <span className="text-xs italic text-text-muted" aria-hidden="true">
          {tr(searching ? 'chat.typing.market' : 'chat.typing')}
        </span>
      </div>
    </div>
  )
}

// Antes del primer mensaje: cómo funciona, y frases para arrancar.
function Onboarding({ path, onPick }: { path: Path; onPick: (text: string) => void }) {
  return (
    <div className="rounded-2xl border border-border-color bg-secondary/50 p-5 text-sm">
      <p className="mb-3 font-display text-lg text-foreground">{tr('chat.onb.title')}</p>
      <ul className="space-y-2 leading-relaxed text-text-muted">
        <li>
          <strong className="font-semibold text-foreground">{tr('chat.onb.1.strong')}</strong>
          {tr('chat.onb.1.rest')}
        </li>
        <li>
          <strong className="font-semibold text-foreground">{tr('chat.onb.2.strong')}</strong>
          {tr('chat.onb.2.rest')}
        </li>
        <li>
          <strong className="font-semibold text-foreground">{tr('chat.onb.3.strong')}</strong>
          {tr('chat.onb.3.rest')}{' '}
          <a href="#privacidad" target="_blank" rel="noopener" className="underline underline-offset-2">
            {tr('chat.onb.3.link')}
          </a>
        </li>
      </ul>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-text-muted">{tr('chat.onb.stuck')}</p>
      <ul role="list" className="flex flex-wrap gap-2">
        {starters(path).map((text) => (
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
      <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">{stageLabel(stage)}</span>
      <span className="h-px flex-1 bg-border-color" />
    </div>
  )
}

// §5 Protocolo de derivación. Los recursos son de Argentina (zona horaria del
// equipo); a validar con el equipo antes de producción.
function DerivationCard() {
  return (
    <div className="ml-11 max-w-[88%] rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm text-foreground">
      <p className="mb-2 font-semibold text-primary">{tr('chat.deriv.title')}</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>{tr('chat.deriv.1')}</li>
        <li>{tr('chat.deriv.2')}</li>
        <li>{tr('chat.deriv.3')}</li>
        <li>{tr('chat.deriv.4')}</li>
      </ul>
      <p className="mt-2 text-xs text-text-muted">{tr('chat.deriv.country')} {tr('chat.deriv.after')}</p>
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
