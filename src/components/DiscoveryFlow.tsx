import { useState, useEffect } from 'react'
import type { DiagnosisResult } from './DiagnosisFlow'
import { trackEvent } from '../lib/tracking'
import { callAi } from '../lib/aiClient'

// ── Types ──────────────────────────────────────────────────────────────────

type DiscoveryStep = 'intro' | 'questions' | 'analyzing' | 'result'
type DiscoveryAnswers = Record<string, string>

interface PlanDeAccion {
  practica: string[]
  exposicion: string[]
  formacion: string[]
}

export interface DiscoveryResult {
  decisionNucleo: string
  obstaculoReencuadrado: string
  planDeAccion: PlanDeAccion
  compromisoSemanal: string
  mensajeDeCierre: string
}

// ── Config: Discovery questions ────────────────────────────────────────────

const DISCOVERY_QUESTIONS = [
  {
    id: 'hipotesis',
    titulo: 'La hipótesis central',
    pregunta: 'De las 3 hipótesis que surgieron en el diagnóstico, ¿cuál sentís que apunta más al corazón del problema? ¿Por qué esa y no las otras?',
    placeholder: 'Ej: La segunda, porque cuando la leí sentí que describía exactamente lo que pasa. No es que no sepa hacer las cosas — es que no tengo claro hacia dónde enfocarlas.',
    ayuda: 'No hay respuesta correcta. El objetivo es que vos elijás el hilo del que vamos a tirar.',
  },
  {
    id: 'obstaculo',
    titulo: 'El obstáculo real',
    pregunta: 'Si avanzaras en esa dirección, ¿cuál sería el primer obstáculo concreto con el que te encontrarías? No el que imaginás que podría pasar — el que sabés que está ahí.',
    placeholder: 'Ej: No tengo red de contactos en el sector al que quiero moverme. / No sé cómo tener la conversación con mi jefe. / Económicamente no puedo darme el lujo de esperar.',
    ayuda: 'Separar obstáculos reales de miedos proyectados es la diferencia entre un plan que funciona y uno que no.',
  },
  {
    id: 'condicion',
    titulo: 'La condición de movimiento',
    pregunta: '¿Qué tendría que pasar — o qué necesitarías decidir — para que en 30 días puedas decir que empezaste a moverte?',
    placeholder: 'Ej: Tomar la decisión de que voy a explorar opciones aunque no esté 100% seguro. / Tener una conversación con alguien que ya hizo ese camino. / Reservar 2 horas por semana para esto.',
    ayuda: 'A veces no es una acción — es una decisión interna. Nombrarlo es el primer movimiento.',
  },
]

// ── Gemini API ─────────────────────────────────────────────────────────────

const DEMO_DISCOVERY_RESULT: DiscoveryResult = {
  decisionNucleo:
    'Decidir que vas a explorar activamente opciones externas durante los próximos 60 días, en paralelo con tu trabajo actual, sin necesidad de tener certeza del destino antes de empezar.',
  obstaculoReencuadrado:
    'La falta de red en el sector destino no es una barrera — es el primer proyecto. Una red no se tiene: se construye con 5 conversaciones bien elegidas. El obstáculo real no es la red, es darte permiso para hacer esas conversaciones antes de sentirte "listo".',
  planDeAccion: {
    practica: [
      'Identificá 3 proyectos concretos en tu rol actual donde puedas aplicar las habilidades que querés desarrollar — sin pedir permiso, solo hacerlo',
      'Elegí un problema de tu área que nadie esté resolviendo y proponé una solución en los próximos 15 días: genera evidencia de lo que podés hacer',
    ],
    exposicion: [
      'Contactá a 2 personas que ya hicieron un movimiento similar al que estás considerando — no para pedir trabajo, sino para entender cómo lo vivieron',
    ],
    formacion: [
      '"Designing Your Life" de Bill Burnett & Dave Evans — un libro que usa diseño de producto para tomar decisiones de carrera con baja certeza',
    ],
  },
  compromisoSemanal:
    'Esta semana: escribí el nombre de 2 personas a las que podrías escribirles para tener esa conversación exploratoria. No las contactes todavía — solo identificalas. Ese es el primer movimiento.',
  mensajeDeCierre:
    '— MODO DEMO — Lo que describiste no es un problema de capacidad ni de suerte. Es un problema de permiso: el permiso para explorar sin tener todas las respuestas primero. El movimiento que necesitás no requiere certeza — requiere curiosidad. La pregunta que me dejo para vos es: ¿qué es lo peor que podría pasar si en 30 días sabés más sobre ese camino que hoy?',
}

function buildDiscoveryPrompt(diagnosis: DiagnosisResult, answers: DiscoveryAnswers): string {
  return `Sos un HR Coach de nivel ejecutivo. Un profesional acaba de completar su Diagnóstico de Carrera y ahora está en la fase de Discovery.

DIAGNÓSTICO PREVIO:
- Perfil actual: ${diagnosis.perfilActual}
- Tensión central: ${diagnosis.tensionCentral}
- Tipo de freno: ${diagnosis.tipoDeFreno}
- Brecha identificada: ${diagnosis.brechaIdentificada}
- Hipótesis de trabajo:
  1. ${diagnosis.hipotesisDeTrabajo[0]}
  2. ${diagnosis.hipotesisDeTrabajo[1]}
  3. ${diagnosis.hipotesisDeTrabajo[2]}
- Primer paso sugerido en diagnóstico: ${diagnosis.primerPasoConcreto}

RESPUESTAS DEL DISCOVERY:
- Hipótesis que resuena más y por qué: ${answers['hipotesis'] || '(sin respuesta)'}
- Primer obstáculo real: ${answers['obstaculo'] || '(sin respuesta)'}
- Condición de movimiento en 30 días: ${answers['condicion'] || '(sin respuesta)'}

Tu tarea es transformar este diagnóstico en un plan de acción concreto basado en la metodología 70-20-10:
- 70% aprendizaje en la práctica (proyectos, nuevas responsabilidades, experimentos concretos)
- 20% exposición y red (conversaciones clave, referentes, comunidades)
- 10% formación formal (un solo recurso específico: curso, libro, certificación)

Reglas críticas:
1. El plan debe responder SOLO a la hipótesis que el profesional eligió — no a las otras dos
2. Reencuadrá el obstáculo como una variable gestionable, no como una barrera
3. El compromiso semanal debe ser uno solo, el más pequeño posible que genere movimiento
4. El mensaje de cierre tiene que generar energía y terminar con una pregunta potente
5. Usá 'vos'. Sin frases corporativas vacías. Directo, empático, orientado a la acción.

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional:
{
  "decisionNucleo": "La decisión puntual que hay que tomar, en una oración clara",
  "obstaculoReencuadrado": "El obstáculo real, devuelto como variable gestionable (2-3 oraciones)",
  "planDeAccion": {
    "practica": ["acción concreta 1 (70%)", "acción concreta 2"],
    "exposicion": ["conversación o contacto clave (20%)"],
    "formacion": ["un recurso específico: nombre exacto del curso o libro (10%)"]
  },
  "compromisoSemanal": "El paso más pequeño y concreto para los próximos 7 días",
  "mensajeDeCierre": "Párrafo de cierre con energía y una pregunta potente al final"
}`
}

async function analyzeDiscovery(
  diagnosis: DiagnosisResult,
  answers: DiscoveryAnswers,
): Promise<DiscoveryResult> {
  const response = await callAi([{ text: buildDiscoveryPrompt(diagnosis, answers) }])
  if ('demo' in response) {
    await new Promise((r) => setTimeout(r, 1500))
    return DEMO_DISCOVERY_RESULT
  }

  const jsonMatch = response.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('La IA no devolvió un plan válido. Intentá de nuevo.')

  return JSON.parse(jsonMatch[0]) as DiscoveryResult
}

// ── Step: Intro ────────────────────────────────────────────────────────────

function DiscoveryIntro({
  diagnosis,
  onStart,
}: {
  diagnosis: DiagnosisResult
  onStart: () => void
}) {
  const frenoColors: Record<string, string> = {
    Aptitud: '#4f46e5',
    Actitud: '#7c3aed',
    Mixto: '#b45309',
  }
  const frenoColor = frenoColors[diagnosis.tipoDeFreno] ?? '#4f46e5'

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Etapa 2 de 3
        </p>
        <h2 className="mb-3">Discovery</h2>
        <p className="leading-relaxed text-text-muted">
          El diagnóstico mostró el mapa. Ahora vamos a decidir el camino y construir el plan.
        </p>
      </div>

      {/* Resumen del diagnóstico */}
      <div className="card mb-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Partimos de aquí
        </p>

        <div className="mb-4 flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: frenoColor }}
          >
            {diagnosis.tipoDeFreno}
          </span>
          <span className="text-xs text-text-muted">Tipo de freno identificado</span>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-text-muted">
          <span className="font-medium text-foreground">Tensión central: </span>
          {diagnosis.tensionCentral}
        </p>

        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">3 hipótesis a explorar:</p>
          <ol className="space-y-2">
            {diagnosis.hipotesisDeTrabajo.map((h, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-muted">
                <span className="shrink-0 font-semibold" style={{ color: frenoColor }}>
                  {i + 1}.
                </span>
                {h}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card mb-6 ai-tint">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
          ¿Qué vas a obtener?
        </p>
        <ul className="space-y-2">
          {[
            'Validación de la hipótesis que más te resuena',
            'Tu obstáculo real, reencuadrado como variable gestionable',
            'Plan de acción concreto 70-20-10',
            'Un compromiso de una sola acción para esta semana',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
              <span className="mt-0.5 font-bold text-primary">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-6 text-center text-xs text-text-muted">3 preguntas · ~5 minutos</p>

      <button onClick={onStart} className="btn-primary w-full py-3.5 text-base">
        Continuar con el Discovery →
      </button>
    </div>
  )
}

// ── Step: Questions ────────────────────────────────────────────────────────

function DiscoveryQuestions({
  answers,
  onAnswer,
  onComplete,
  onBack,
}: {
  answers: DiscoveryAnswers
  onAnswer: (id: string, value: string) => void
  onComplete: () => void
  onBack: () => void
}) {
  const [idx, setIdx] = useState(0)
  const q = DISCOVERY_QUESTIONS[idx]
  const isLast = idx === DISCOVERY_QUESTIONS.length - 1
  const canContinue = (answers[q.id] ?? '').trim().length >= 15
  const progress = ((idx + 1) / DISCOVERY_QUESTIONS.length) * 100

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-text-muted">Pregunta {idx + 1} de {DISCOVERY_QUESTIONS.length}</span>
          <span className="font-medium text-primary">Discovery</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border-color">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="card mb-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
          {q.titulo}
        </p>
        <h3 className="mb-6 text-xl leading-snug">{q.pregunta}</h3>
        <textarea
          key={q.id}
          value={answers[q.id] ?? ''}
          onChange={(e) => onAnswer(q.id, e.target.value)}
          placeholder={q.placeholder}
          rows={5}
          autoFocus
          className="w-full resize-y rounded-xl border p-3.5 font-sans text-sm text-foreground outline-none transition-colors"
          style={{
            borderColor: canContinue ? '#10b981' : '#e5e7eb',
            background: canContinue ? '#f0fdf4' : 'white',
          }}
        />
        <p className="mt-2 text-xs text-text-muted">{q.ayuda}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={idx === 0 ? onBack : () => setIdx((i) => i - 1)}
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-white"
        >
          ← Atrás
        </button>
        <button
          onClick={isLast ? onComplete : () => setIdx((i) => i + 1)}
          disabled={!canContinue}
          className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLast ? 'Generar plan de acción →' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}

// ── Step: Analyzing ────────────────────────────────────────────────────────

function DiscoveryAnalyzing() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000)
    return () => clearInterval(t)
  }, [])

  const messages = [
    'Procesando tus respuestas…',
    'Validando la hipótesis elegida…',
    'Reencuadrando el obstáculo…',
    'Construyendo el plan 70-20-10…',
    'Definiendo tu compromiso semanal…',
  ]

  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <div className="relative mx-auto mb-10 h-20 w-20">
        <div className="ai-ring absolute inset-0 rounded-full" />
        <div
          className="absolute flex items-center justify-center rounded-full bg-background"
          style={{ inset: '3px' }}
        >
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

function DiscoveryResult({
  result,
  onRestart,
  onActionPlan,
}: {
  result: DiscoveryResult
  onRestart: () => void
  onActionPlan: () => void
}) {
  return (
    <div className="ai-result mx-auto max-w-2xl">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          HR Coach IA · Plan de Acción
        </p>
        <h2 className="mb-1">Tu Plan de Discovery</h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* Decisión núcleo — destacada */}
        <div className="ai-tint rounded-2xl p-6" style={{ borderLeft: '3px solid #f97316' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            La decisión
          </p>
          <p className="text-base font-medium leading-relaxed text-foreground">
            {result.decisionNucleo}
          </p>
        </div>

        {/* Obstáculo reencuadrado */}
        <div className="card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Tu obstáculo, reencuadrado
          </p>
          <p className="text-sm leading-relaxed text-text-muted">{result.obstaculoReencuadrado}</p>
        </div>

        {/* Plan de Acción 70-20-10 */}
        <div className="card">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Plan de Acción — Metodología 70-20-10
          </p>

          <div className="space-y-5">
            {/* 70% */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
                  70%
                </span>
                <span className="text-xs font-medium text-foreground">Aprendizaje en la práctica</span>
              </div>
              <ul className="space-y-2">
                {result.planDeAccion.practica.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
                    <span className="mt-0.5 shrink-0 font-bold text-primary">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border-color" />

            {/* 20% */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  20%
                </span>
                <span className="text-xs font-medium text-foreground">Exposición y red</span>
              </div>
              <ul className="space-y-2">
                {result.planDeAccion.exposicion.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
                    <span className="mt-0.5 shrink-0 font-bold text-indigo-500">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border-color" />

            {/* 10% */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  10%
                </span>
                <span className="text-xs font-medium text-foreground">Formación específica</span>
              </div>
              <ul className="space-y-2">
                {result.planDeAccion.formacion.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
                    <span className="mt-0.5 shrink-0 font-bold text-emerald-500">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Compromiso semanal */}
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-green-700">
            Tu compromiso esta semana
          </p>
          <p className="text-sm font-medium leading-relaxed text-green-800">
            {result.compromisoSemanal}
          </p>
        </div>

        {/* Mensaje de cierre */}
        <div className="ai-tint rounded-2xl p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Para cerrar
          </p>
          <p className="italic leading-relaxed text-foreground">"{result.mensajeDeCierre}"</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          className="btn-primary flex-1 py-4 text-base"
          style={{ minWidth: 200 }}
          onClick={onActionPlan}
        >
          Ver Plan de Acción →
        </button>
        <button
          onClick={onRestart}
          className="rounded-xl border border-border-color px-6 py-4 text-sm text-text-muted transition hover:bg-white"
        >
          Empezar de nuevo
        </button>
      </div>
    </div>
  )
}

// ── Main: DiscoveryFlow ────────────────────────────────────────────────────

export function DiscoveryFlow({
  diagnosisResult,
  onBack,
  onRestart,
  onActionPlan,
}: {
  diagnosisResult: DiagnosisResult
  onBack: () => void
  onRestart: () => void
  onActionPlan: (result: DiscoveryResult) => void
}) {
  const [step, setStep] = useState<DiscoveryStep>('intro')
  const [answers, setAnswers] = useState<DiscoveryAnswers>({})
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const handleAnalyze = async () => {
    setStep('analyzing')
    setError(null)
    try {
      const r = await analyzeDiscovery(diagnosisResult, answers)
      setResult(r)
      setStep('result')
      trackEvent('discovery_completed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setStep('questions')
    }
  }

  const stepLabel: Record<DiscoveryStep, string> = {
    intro: 'Intro',
    questions: 'Preguntas',
    analyzing: 'Analizando',
    result: 'Plan de Acción',
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm">
        <div className="section-container flex items-center gap-4 py-4">
          <button
            onClick={onBack}
            className="text-sm text-text-muted transition-colors hover:text-foreground"
          >
            ← Diagnóstico
          </button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Career<span className="text-primary">Path</span>
          </span>
          <span className="ml-auto text-xs text-text-muted">
            Discovery · {stepLabel[step]}
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        {error && (
          <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {step === 'intro' && (
          <DiscoveryIntro
            diagnosis={diagnosisResult}
            onStart={() => setStep('questions')}
          />
        )}
        {step === 'questions' && (
          <DiscoveryQuestions
            answers={answers}
            onAnswer={handleAnswer}
            onComplete={handleAnalyze}
            onBack={() => setStep('intro')}
          />
        )}
        {step === 'analyzing' && <DiscoveryAnalyzing />}
        {step === 'result' && result && (
          <DiscoveryResult
            result={result}
            onRestart={onRestart}
            onActionPlan={() => onActionPlan(result)}
          />
        )}
      </main>
    </div>
  )
}
