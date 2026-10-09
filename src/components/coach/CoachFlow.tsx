import { useCallback, useEffect, useRef, useState } from 'react'
import { STAGE_COLOR, STAGE_LABEL, STAGE_ORDER } from '../../../shared/stages'
import { extractPdfText, requestReport, requestTurn } from '../../lib/coach/api'
import { saveSession } from '../../lib/coach/session'
import type { DocTipo, Session, Stage, TurnResult, UiMessage } from '../../lib/coach/types'
import { trackEvent, type FunnelEvent } from '../../lib/tracking'
import AccountMenu, { type AccountInfo } from '../AccountMenu'
import Logo from '../Logo'
import { ChatView } from './ChatView'
import { ProfileStep } from './ProfileStep'
import { ReportView } from './ReportView'

// Orquesta el proceso: (Camino B: lectura del perfil) → Diagnóstico →
// Discovery → Plan de Acción → informe con compromisos elegidos.

const STAGE_COMPLETED_EVENT: Record<Stage, FunnelEvent> = {
  diagnostico: 'diagnosis_completed',
  discovery: 'discovery_completed',
  plan: 'action_plan_completed',
}

// Mensajes de control: le indican al agente que abra una etapa. No se muestran.
function openingInstruction(s: Session): string {
  if (s.stage === 'diagnostico') {
    return s.path === 'perfil'
      ? '(Inicio de la sesión, Camino B. La persona acaba de ver la lectura externa de su perfil. Presentate en una oración — vas a preguntar más de lo que vas a responder y las conclusiones van a ser suyas — y preguntale qué le resonó y qué no de esa lectura. Indagá antes de sumar cualquier lectura propia.)'
      : '(Inicio de la sesión, Camino A. Presentate en una oración — vas a preguntar más de lo que vas a responder y las conclusiones van a ser suyas — y hacé tu primera pregunta abierta.)'
  }
  return `(La persona confirmó la síntesis de la etapa anterior y pasa a ${STAGE_LABEL[s.stage]}. Hacé una transición de una oración apoyada en lo que dijo y tu primera pregunta de esta etapa.)`
}

// Si la etapa actual todavía no arrancó, agrega el mensaje de control que la abre.
function withOpening(s: Session): Session {
  if (s.phase !== 'chat' || s.messages.some((m) => m.stage === s.stage)) return s
  return {
    ...s,
    messages: [...s.messages, { role: 'user', text: openingInstruction(s), hidden: true, stage: s.stage }],
  }
}

function applyTurn(prev: Session, stage: Stage, turn: TurnResult): Session {
  if (prev.stage !== stage) return prev
  // ¿Este turno trae un mapa nuevo (o actualizado)? Solo entonces el mapa se ubica después de este mensaje.
  const entregaMapa = turn.listoParaAvanzar && (turn.sintesisItems.length > 0 || turn.sintesisEtapa.length > 0)
  const msg: UiMessage = {
    role: 'model',
    text: turn.mensaje,
    raw: JSON.stringify(turn),
    stage,
    derivacion: turn.derivacion || undefined,
    cierraEtapa: entregaMapa || undefined,
  }
  return {
    ...prev,
    messages: [...prev.messages, msg],
    cubiertos: { ...prev.cubiertos, [stage]: turn.objetivosCubiertos },
    // Una etapa cerrada no se reabre: lo que la persona escriba después (un "gracias", un ajuste)
    // no hace desaparecer el mapa ni el botón para seguir. Solo avanzar de etapa lo reinicia.
    stageReady: prev.stageReady || turn.listoParaAvanzar,
    foco: turn.temaEnFoco || undefined,
    omitidos: { ...prev.omitidos, [stage]: turn.temasOmitidos },
    sintesis: entregaMapa && turn.sintesisEtapa ? { ...prev.sintesis, [stage]: turn.sintesisEtapa } : prev.sintesis,
    mapas:
      turn.listoParaAvanzar && turn.sintesisItems.length > 0
        ? { ...prev.mapas, [stage]: { items: turn.sintesisItems, pregunta: turn.preguntaPuente } }
        : prev.mapas,
    updatedAt: new Date().toISOString(),
  }
}

interface CoachFlowProps {
  initialSession: Session
  onExit: () => void
  onRestart: () => void
  account: AccountInfo
}

export function CoachFlow({ initialSession, onExit, onRestart, account }: CoachFlowProps) {
  const [session, setSession] = useState<Session>(() => withOpening(initialSession))
  // true cuando el montaje agregó la apertura de etapa y hay que pedir el primer turno.
  const openingPending = useRef(session !== initialSession)
  const [thinking, setThinking] = useState(false)
  // Si la sesión retomada quedó esperando al coach, se ofrece reintentar.
  const [error, setError] = useState<string | null>(() => {
    if (initialSession.phase === 'informe' && !initialSession.informe) return 'El informe no llegó a generarse.'
    if (initialSession.phase === 'chat' && initialSession.messages.at(-1)?.role === 'user') return 'La última respuesta del coach no llegó.'
    return null
  })
  const [demo, setDemo] = useState(false)
  const [docStatus, setDocStatus] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => saveSession(session), [session])

  const runTurn = useCallback(async (snapshot: Session) => {
    if (inFlight.current) return
    inFlight.current = true
    setThinking(true)
    setError(null)
    try {
      const { data, demo: isDemo } = await requestTurn(snapshot)
      setDemo(isDemo)
      setSession((prev) => applyTurn(prev, snapshot.stage, data))
      if (data.derivacion) trackEvent('derivation_shown', { stage: snapshot.stage })
      if (data.listoParaAvanzar && !snapshot.stageReady) {
        trackEvent('stage_completed', { stage: snapshot.stage, path: snapshot.path })
        trackEvent(STAGE_COMPLETED_EVENT[snapshot.stage], { path: snapshot.path })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo falló. Intentá de nuevo.')
    } finally {
      inFlight.current = false
      setThinking(false)
    }
  }, [])

  const generateReport = useCallback(async (snapshot: Session) => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      const { data } = await requestReport(snapshot)
      setSession((prev) => ({ ...prev, informe: data, updatedAt: new Date().toISOString() }))
      trackEvent('report_generated', { acciones: data.acciones.length })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos armar el informe.')
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    if (!openingPending.current) return
    openingPending.current = false
    if (session.stage === 'diagnostico') trackEvent('diagnosis_started', { path: session.path })
    void runTurn(session)
  }, [session, runTurn])

  const startStage = (next: Session) => {
    const opened = withOpening(next)
    setSession(opened)
    if (opened !== next) void runTurn(opened)
  }

  const handleSend = (text: string) => {
    const next: Session = {
      ...session,
      messages: [...session.messages, { role: 'user', text, stage: session.stage }],
    }
    setSession(next)
    void runTurn(next)
  }

  const handleRetry = () => {
    if (session.phase === 'informe') void generateReport(session)
    else void runTurn(session)
  }

  const handleAdvance = () => {
    const idx = STAGE_ORDER.indexOf(session.stage)
    if (idx === STAGE_ORDER.length - 1) {
      const next: Session = { ...session, phase: 'informe', stageReady: false }
      setSession(next)
      void generateReport(next)
      return
    }
    startStage({ ...session, stage: STAGE_ORDER[idx + 1], stageReady: false, foco: undefined })
  }

  // La persona quiere volver a un tema que había dejado para más adelante: pasa a estar pendiente de
  // nuevo y la etapa se reabre (hasta que lo cuente o lo vuelva a dejar).
  const handleResumeTopic = (id: string) => {
    setSession((prev) => ({
      ...prev,
      omitidos: { ...prev.omitidos, [prev.stage]: (prev.omitidos?.[prev.stage] ?? []).filter((x) => x !== id) },
      stageReady: false,
      foco: id,
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleAttachDoc = async (tipo: DocTipo, file: File) => {
    setDocStatus(tipo === 'cv' ? 'Leyendo tu CV…' : 'Leyendo tu perfil de LinkedIn…')
    try {
      const texto = await extractPdfText(file)
      setSession((prev) => ({
        ...prev,
        documentos: [...prev.documentos.filter((d) => d.tipo !== tipo), { tipo, nombre: file.name, texto }],
      }))
      setDocStatus(null)
    } catch (e) {
      setDocStatus(e instanceof Error ? e.message : 'No pudimos leer el PDF.')
    }
  }

  // Entrar al chat, cambiar de fase o de etapa son navegaciones dentro de una SPA:
  // el botón que se tocó desaparece y el foco se pierde (queda en <body>). Se lo
  // lleva al encabezado, que además anuncia dónde está la persona. Se compara con
  // el lugar previo para enfocar una sola vez por cambio (también en StrictMode).
  const headingRef = useRef<HTMLHeadingElement>(null)
  const prevPlace = useRef<{ phase: string; stage: string } | null>(null)
  useEffect(() => {
    const prev = prevPlace.current
    if (prev && prev.phase === session.phase && prev.stage === session.stage) return
    prevPlace.current = { phase: session.phase, stage: session.stage }
    headingRef.current?.focus()
  }, [session.phase, session.stage])

  const stageIdx = STAGE_ORDER.indexOf(session.stage)

  return (
    // En el chat la página ocupa exactamente la pantalla y no scrollea: lo único que se desplaza es la
    // conversación. Así, al llegar al final, el scroll no "se escapa" y se lleva la tarjeta del chat.
    <div className={`flex flex-col bg-background font-sans ${session.phase === 'chat' ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
      <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm print:hidden">
        <div className="section-container flex items-center gap-4 py-4">
          <button onClick={onExit} className="text-sm text-text-muted transition-colors hover:text-foreground">
            ← Inicio
          </button>
          <Logo />
          <div className="ml-auto flex items-center gap-4">
          <ol role="list" aria-label="Etapas del proceso" className="hidden items-center gap-4 text-xs sm:flex">
            {session.path === 'perfil' && (
              <li className={session.phase === 'perfil' ? 'font-semibold text-foreground' : 'text-text-muted'}>Tu perfil</li>
            )}
            {STAGE_ORDER.map((s, i) => {
              const active = session.phase === 'chat' && s === session.stage
              const done = session.phase === 'informe' || (session.phase === 'chat' && i < stageIdx)
              return (
                <li
                  key={s}
                  aria-current={active ? 'step' : undefined}
                  className="flex items-center gap-1.5"
                  style={{ color: active ? STAGE_COLOR[s] : done ? 'var(--color-foreground)' : 'var(--color-text-muted)' }}
                >
                  <span aria-hidden="true">{done ? '✓' : `${i + 1}.`}</span>{' '}
                  <span className={active ? 'font-semibold' : ''}>{STAGE_LABEL[s]}</span>
                  {done && <span className="sr-only"> (completada)</span>}
                </li>
              )
            })}
          </ol>
          <AccountMenu account={account} />
          </div>
        </div>
      </header>

      <main className={`flex-1 px-3 sm:px-4 ${session.phase === 'chat' ? 'min-h-0 py-3 sm:py-6' : 'py-8'}`}>
        {/* Encabezado para lectores de pantalla: cada fase se ubica por su h1. */}
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
          {session.phase === 'perfil'
            ? 'Cómo te lee un reclutador'
            : session.phase === 'informe'
              ? 'Informe de cierre y compromisos'
              : `Conversación con el coach: ${STAGE_LABEL[session.stage]}`}
        </h1>
        {session.phase === 'perfil' && (
          <ProfileStep
            initial={session.perfil}
            onReading={(puesto, lectura, documentos) =>
              setSession((prev) => ({ ...prev, perfil: { puesto, lectura, elegidas: [] }, documentos }))
            }
            onContinue={(elegidas) => {
              if (!session.perfil) return
              trackEvent('diagnosis_started', { path: session.path })
              startStage({ ...session, perfil: { ...session.perfil, elegidas }, phase: 'chat' })
            }}
          />
        )}

        {session.phase === 'chat' && (
          <ChatView
            session={session}
            thinking={thinking}
            error={error}
            demo={demo}
            onSend={handleSend}
            onRetry={handleRetry}
            onAdvance={handleAdvance}
            onResumeTopic={handleResumeTopic}
            onAttachDoc={handleAttachDoc}
            docStatus={docStatus}
          />
        )}

        {session.phase === 'informe' &&
          (session.informe ? (
            <ReportView
              report={session.informe}
              compromisos={session.compromisos}
              compromisosFecha={session.compromisosFecha}
              onSave={(indices) => {
                setSession((prev) => ({ ...prev, compromisos: indices, compromisosFecha: new Date().toISOString() }))
                trackEvent('commitments_saved', { elegidos: indices.length, total: session.informe?.acciones.length ?? 0 })
              }}
              onRestart={onRestart}
            />
          ) : error ? (
            <div className="mx-auto max-w-md rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
              {error}{' '}
              <button onClick={handleRetry} className="font-semibold underline underline-offset-2">
                Reintentar
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-sm py-20 text-center">
              <div className="relative mx-auto mb-8 h-16 w-16">
                <div className="ai-ring absolute inset-0 rounded-full" />
                <div className="absolute flex items-center justify-center rounded-full bg-background" style={{ inset: 3 }}>
                  <span className="text-lg text-text-muted">✦</span>
                </div>
              </div>
              <p role="status" className="text-sm text-text-muted">Ordenando lo que construiste…</p>
            </div>
          ))}
      </main>
    </div>
  )
}
