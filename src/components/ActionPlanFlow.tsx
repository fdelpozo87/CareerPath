import { useState, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DiagnosisResult } from './DiagnosisFlow'
import type { DiscoveryResult } from './DiscoveryFlow'

// ── Types ──────────────────────────────────────────────────────────────────

type ActionPlanStep = 'setup' | 'analyzing' | 'result'

interface ActionPlanResult {
  objetivoDesarrollo: string
  bloque70: string[]
  bloque20: string[]
  bloque10: string
  metricaExito: string
  checkIn: string
  mensajeInaugural: string
}

const TIMEFRAMES = [
  { value: '4 semanas', label: '4 semanas', desc: 'Movimiento rápido — una acción por semana' },
  { value: '8 semanas', label: '8 semanas', desc: 'Ritmo sostenible — resultados visibles' },
  { value: '12 semanas', label: '12 semanas', desc: 'Transformación profunda — sin apuro' },
]

// ── Demo result ────────────────────────────────────────────────────────────

const DEMO_ACTION_PLAN: ActionPlanResult = {
  objetivoDesarrollo:
    'Desarrollar la capacidad de tomar decisiones de carrera con información incompleta — pasando de la parálisis por análisis al movimiento exploratório con criterio.',
  bloque70: [
    'Proponer y liderar una iniciativa nueva en tu área durante las próximas 4 semanas — aunque sea pequeña. Objetivo: generar evidencia de lo que podés hacer más allá de tu rol definido.',
    'Agendá una conversación con tu jefe o referente directo para discutir tus objetivos de desarrollo. No pedirle permiso — contarle hacia dónde querés ir.',
  ],
  bloque20: [
    'Identificá a 2 personas que hicieron un movimiento similar al que estás considerando (cambio de área, salto de seniority, transición de industria). Escribiles esta semana — no para pedir trabajo, sino para escuchar su historia.',
  ],
  bloque10:
    '"Designing Your Life" de Bill Burnett & Dave Evans — capítulos 3 y 4 sobre cómo prototipar decisiones de carrera sin necesitar certeza previa.',
  metricaExito:
    'Al final del período, poder responder con claridad estas dos preguntas: ¿Qué aprendí sobre lo que quiero? ¿Qué acción tomé que no hubiera tomado antes de este proceso?',
  checkIn:
    'Check-in quincenal de 15 minutos — una sola pregunta: ¿Qué hice diferente esta semana en relación a mi objetivo de desarrollo?',
  mensajeInaugural:
    '— MODO DEMO — Este plan no es un mapa con el destino marcado. Es un conjunto de movimientos que te van a dar más información de la que tenés hoy. El profesional que termina este proceso no es el que "encontró la respuesta" — es el que dejó de esperar tenerla para empezar a moverse. La pregunta con la que arrancás: ¿qué aprendería de mí mismo si hago el primer movimiento esta semana?',
}

// ── Gemini API ─────────────────────────────────────────────────────────────

function buildActionPlanPrompt(
  diagnosis: DiagnosisResult,
  discovery: DiscoveryResult,
  timeframe: string,
  ajuste: string,
): string {
  return `Sos un HR Coach de nivel ejecutivo. Un profesional completó las etapas de Diagnóstico y Discovery de CareerPath. Ahora necesitás construir su Plan de Acción final siguiendo la metodología 70-20-10.

CONTEXTO DEL DIAGNÓSTICO:
- Perfil actual: ${diagnosis.perfilActual}
- Tipo de freno: ${diagnosis.tipoDeFreno}
- Brecha identificada: ${diagnosis.brechaIdentificada}

RESULTADO DEL DISCOVERY:
- Decisión núcleo: ${discovery.decisionNucleo}
- Obstáculo reencuadrado: ${discovery.obstaculoReencuadrado}
- Plan base 70%: ${discovery.planDeAccion.practica.join(' / ')}
- Plan base 20%: ${discovery.planDeAccion.exposicion.join(' / ')}
- Plan base 10%: ${discovery.planDeAccion.formacion.join(' / ')}
- Compromiso semanal del Discovery: ${discovery.compromisoSemanal}

CONFIGURACIÓN DEL PLAN:
- Timeframe elegido: ${timeframe}
${ajuste ? `- Ajustes o comentarios del profesional: ${ajuste}` : ''}

Tu tarea es construir el Plan de Acción final con esta arquitectura exacta:

**OBJETIVO DE DESARROLLO:** Una competencia o área específica, formulada con precisión quirúrgica. No "mejorar el liderazgo" — sino algo concreto como "desarrollar la capacidad de X en contexto Y".

**BLOQUE 70% — Experiencia en el puesto:**
- 2 acciones prácticas usando la fórmula: "Hacer [acción concreta] durante [proyecto o rutina específica]"
- Deben ser realizables dentro del timeframe de ${timeframe}
- Anclar en el contexto laboral real del profesional

**BLOQUE 20% — Exposición y red:**
- 1-2 acciones: conversaciones concretas con perfiles específicos, shadowing, o rutinas de feedback
- Nombrar el tipo de perfil a buscar, no solo "buscar un mentor"

**BLOQUE 10% — Formación:**
- UN solo recurso: nombre exacto del libro o curso, con capítulo o módulo específico si aplica
- Que acelere el 70% y 20%, no que los reemplace

**MÉTRICA DE ÉXITO:** La señal concreta y observable de que avanzaste — no subjetiva.

**CHECK-IN:** Cadencia exacta + una pregunta de revisión específica.

**MENSAJE INAUGURAL:** Un párrafo de coaching para arrancar el plan con energía. Cierra con una pregunta potente. Este es el cierre del proceso completo de CareerPath — que tenga peso.

Reglas:
- Usá 'vos'. Sin frases corporativas. Directo y accionable.
- El 70% debe ser práctica real, no más reflexión.
- El mensaje inaugural es el cierre emocional de todo el proceso — que genere movimiento.

Respondé ÚNICAMENTE con JSON válido:
{
  "objetivoDesarrollo": "...",
  "bloque70": ["acción 1 con fórmula", "acción 2 con fórmula"],
  "bloque20": ["acción de exposición concreta"],
  "bloque10": "nombre exacto del recurso con contexto de uso",
  "metricaExito": "señal observable de mejora",
  "checkIn": "cadencia + pregunta de revisión",
  "mensajeInaugural": "párrafo de cierre con pregunta potente"
}`
}

async function generateActionPlan(
  diagnosis: DiagnosisResult,
  discovery: DiscoveryResult,
  timeframe: string,
  ajuste: string,
): Promise<ActionPlanResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  if (!apiKey || apiKey === 'AIza...') {
    await new Promise((r) => setTimeout(r, 3000))
    return DEMO_ACTION_PLAN
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })

  const result = await model.generateContent(
    buildActionPlanPrompt(diagnosis, discovery, timeframe, ajuste),
  )
  const text = result.response.text().trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('La IA no devolvió un plan válido. Intentá de nuevo.')

  return JSON.parse(jsonMatch[0]) as ActionPlanResult
}

// ── Step: Setup ────────────────────────────────────────────────────────────

function SetupScreen({
  discovery,
  onGenerate,
  onBack,
}: {
  discovery: DiscoveryResult
  onGenerate: (timeframe: string, ajuste: string) => void
  onBack: () => void
}) {
  const [timeframe, setTimeframe] = useState('8 semanas')
  const [ajuste, setAjuste] = useState('')

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Etapa 3 de 3
        </p>
        <h2 className="mb-3">Plan de Acción</h2>
        <p className="leading-relaxed text-text-muted">
          Vamos a construir tu plan de desarrollo personalizado basado en lo que descubriste.
        </p>
      </div>

      {/* Resumen del punto de partida */}
      <div className="card mb-6 ai-tint">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Partís desde aquí
        </p>
        <p className="text-sm font-medium leading-relaxed text-foreground">
          {discovery.decisionNucleo}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          <span className="font-medium">Esta semana: </span>
          {discovery.compromisoSemanal}
        </p>
      </div>

      {/* Timeframe */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-medium text-foreground">¿En cuánto tiempo querés ver resultados?</p>
        <div className="grid gap-3">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeframe(t.value)}
              className="flex items-center gap-4 rounded-xl border p-4 text-left transition-all"
              style={{
                borderColor: timeframe === t.value ? '#f97316' : '#e5e7eb',
                background: timeframe === t.value ? 'rgba(249,115,22,0.04)' : 'white',
              }}
            >
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                style={{ borderColor: timeframe === t.value ? '#f97316' : '#d1d5db' }}
              >
                {timeframe === t.value && (
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{t.label}</p>
                <p className="text-xs text-text-muted">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ajuste opcional */}
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-foreground">
          ¿Hay algo del plan que querés ajustar o agregar? <span className="font-normal text-text-muted">(opcional)</span>
        </p>
        <textarea
          value={ajuste}
          onChange={(e) => setAjuste(e.target.value)}
          placeholder="Ej: Prefiero opciones que no requieran salir de mi trabajo actual. / Quiero enfocarme más en el networking. / Tengo poco tiempo libre entre semana."
          rows={3}
          className="w-full resize-none rounded-xl border border-border-color p-3.5 font-sans text-sm text-foreground outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-white"
        >
          ← Atrás
        </button>
        <button
          onClick={() => onGenerate(timeframe, ajuste)}
          className="btn-primary flex-1 py-3.5 text-base"
        >
          Generar mi plan →
        </button>
      </div>
    </div>
  )
}

// ── Step: Analyzing ────────────────────────────────────────────────────────

function ActionPlanAnalyzing() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000)
    return () => clearInterval(t)
  }, [])

  const messages = [
    'Integrando diagnóstico y discovery…',
    'Diseñando el bloque del 70%…',
    'Identificando exposición y red…',
    'Seleccionando el recurso más relevante…',
    'Definiendo tu métrica de éxito…',
    'Cerrando el plan…',
  ]

  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <div className="relative mx-auto mb-10 h-20 w-20">
        <div className="ai-ring absolute inset-0 rounded-full" />
        <div className="absolute flex items-center justify-center rounded-full bg-background" style={{ inset: '3px' }}>
          <span className="text-xl text-text-muted">◈</span>
        </div>
      </div>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">Construyendo tu plan</h2>
      <p key={tick} className="ai-result text-sm text-text-muted" style={{ minHeight: '1.25rem' }}>
        {messages[tick % messages.length]}
      </p>
      <p className="mt-4 text-xs text-text-muted opacity-60">Esto puede tomar 15–30 segundos.</p>
    </div>
  )
}

// ── Step: Result ───────────────────────────────────────────────────────────

function ActionPlanResult({
  result,
  timeframe,
  onRestart,
}: {
  result: ActionPlanResult
  timeframe: string
  onRestart: () => void
}) {
  return (
    <div className="ai-result mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-color bg-white px-4 py-1.5 text-xs font-medium text-text-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Proceso CareerPath completado · {timeframe}
        </div>
        <h2 className="mb-1">Tu Plan de Acción</h2>
        <p className="text-text-muted">Metodología 70-20-10 · HR Coach IA</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Objetivo */}
        <div className="ai-tint rounded-2xl p-6" style={{ borderLeft: '3px solid #f97316' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Objetivo de desarrollo
          </p>
          <p className="text-base font-medium leading-relaxed text-foreground">
            {result.objetivoDesarrollo}
          </p>
        </div>

        {/* Plan 70-20-10 */}
        <div className="card">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Plan de Acción — {timeframe}
          </p>

          {/* 70% */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">70%</span>
              <span className="text-xs font-medium text-foreground">Experiencia en el puesto</span>
            </div>
            <ul className="space-y-3">
              {result.bloque70.map((item, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-orange-50 p-3">
                  <span className="mt-0.5 shrink-0 font-bold text-primary text-sm">{i + 1}.</span>
                  <p className="text-sm leading-relaxed text-foreground">{item}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border-color" />

          {/* 20% */}
          <div className="my-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-xs font-bold text-white">20%</span>
              <span className="text-xs font-medium text-foreground">Exposición y red</span>
            </div>
            <ul className="space-y-3">
              {result.bloque20.map((item, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-indigo-50 p-3">
                  <span className="mt-0.5 shrink-0 font-bold text-indigo-500 text-sm">→</span>
                  <p className="text-sm leading-relaxed text-foreground">{item}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border-color" />

          {/* 10% */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">10%</span>
              <span className="text-xs font-medium text-foreground">Formación específica</span>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
              <span className="mt-0.5 shrink-0 font-bold text-emerald-500 text-sm">→</span>
              <p className="text-sm leading-relaxed text-foreground">{result.bloque10}</p>
            </div>
          </div>
        </div>

        {/* Métrica + Check-in */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
              Métrica de éxito
            </p>
            <p className="text-sm leading-relaxed text-text-muted">{result.metricaExito}</p>
          </div>
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
              Check-in
            </p>
            <p className="text-sm leading-relaxed text-text-muted">{result.checkIn}</p>
          </div>
        </div>

        {/* Mensaje inaugural */}
        <div className="rounded-2xl border border-border-color bg-foreground p-6 text-white">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-50">
            Para arrancar
          </p>
          <p className="italic leading-relaxed opacity-90">"{result.mensajeInaugural}"</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => window.print()}
          className="btn-secondary gap-2"
        >
          Imprimir plan
        </button>
        <button
          onClick={onRestart}
          className="rounded-xl border border-border-color px-6 py-3 text-sm text-text-muted transition hover:bg-white"
        >
          Empezar de nuevo
        </button>
      </div>
    </div>
  )
}

// ── Main: ActionPlanFlow ───────────────────────────────────────────────────

export function ActionPlanFlow({
  diagnosisResult,
  discoveryResult,
  onBack,
  onRestart,
}: {
  diagnosisResult: DiagnosisResult
  discoveryResult: DiscoveryResult
  onBack: () => void
  onRestart: () => void
}) {
  const [step, setStep] = useState<ActionPlanStep>('setup')
  const [result, setResult] = useState<ActionPlanResult | null>(null)
  const [timeframe, setTimeframe] = useState('8 semanas')
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (tf: string, ajuste: string) => {
    setTimeframe(tf)
    setStep('analyzing')
    setError(null)
    try {
      const r = await generateActionPlan(diagnosisResult, discoveryResult, tf, ajuste)
      setResult(r)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setStep('setup')
    }
  }

  const stepLabel: Record<ActionPlanStep, string> = {
    setup: 'Configuración',
    analyzing: 'Generando',
    result: 'Plan',
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm">
        <div className="section-container flex items-center gap-4 py-4">
          <button
            onClick={onBack}
            className="text-sm text-text-muted transition-colors hover:text-foreground"
          >
            ← Discovery
          </button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Career<span className="text-primary">Path</span>
          </span>
          <span className="ml-auto text-xs text-text-muted">
            Plan de Acción · {stepLabel[step]}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        {error && (
          <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {step === 'setup' && (
          <SetupScreen
            discovery={discoveryResult}
            onGenerate={handleGenerate}
            onBack={onBack}
          />
        )}
        {step === 'analyzing' && <ActionPlanAnalyzing />}
        {step === 'result' && result && (
          <ActionPlanResult result={result} timeframe={timeframe} onRestart={onRestart} />
        )}
      </main>
    </div>
  )
}
