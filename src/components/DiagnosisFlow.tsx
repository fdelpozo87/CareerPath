import { useState, useRef, useEffect } from 'react'
import { trackEvent } from '../lib/tracking'
import { callAi, fileToBase64, type AiPart } from '../lib/aiClient'

// ── Types ──────────────────────────────────────────────────────────────────

type Answers = Record<string, string>
type FlowStep = 'intro' | 'questions' | 'cv-upload' | 'analyzing' | 'summary'
type TipoDeFreno = 'Aptitud' | 'Actitud' | 'Mixto'

export interface DiagnosisResult {
  perfilActual: string
  tensionCentral: string
  tipoDeFreno: TipoDeFreno
  fortalezasOcultas: string[]
  brechaIdentificada: string
  hipotesisDeTrabajo: string[]
  primerPasoConcreto: string
  mensajePersonalizado: string
}

// ── Config: GROW-based questions ───────────────────────────────────────────

const QUESTIONS = [
  {
    id: 'objetivo',
    titulo: 'Lo que buscás',
    etiquetaGrow: 'Goal',
    pregunta: '¿Qué resultado concreto querés obtener de este proceso? ¿Cómo sabrías que valió la pena?',
    placeholder: 'Ej: Quiero saber si tiene sentido seguir en mi empresa. O tener un plan claro para llegar a gerente. O entender por qué siento que estoy estancado/a.',
    ayuda: 'Cuanto más específico/a, más útil el diagnóstico. "Encontrar claridad" es válido, pero tratá de ir un poco más profundo.',
  },
  {
    id: 'realidad',
    titulo: 'Donde estás hoy',
    etiquetaGrow: 'Reality',
    pregunta: '¿Cómo es tu situación laboral actual? Contame tu rol, cuánto tiempo llevás ahí y qué está pasando realmente.',
    placeholder: 'Ej: Soy analista senior en una consultora, 4 años en el mismo puesto. Siento que el trabajo no me desafía y que mi sueldo no acompañó mi crecimiento.',
    ayuda: 'Separar hechos de interpretaciones ayuda mucho. ¿Qué es real y qué puede ser una suposición tuya?',
  },
  {
    id: 'tipoFreno',
    titulo: 'El tipo de desafío',
    etiquetaGrow: 'Reality',
    pregunta: '¿Tu freno principal tiene más que ver con lo que todavía no sabés hacer (habilidades, experiencia) o con no tener claro hacia dónde querés ir (motivación, dirección)?',
    placeholder: 'Ej: Creo que tengo las habilidades pero no sé hacia dónde enfocarlas. / Me falta experiencia en liderazgo para dar el salto. / Las dos cosas, honestamente.',
    ayuda: 'Esta distinción es clave: los dos tienen caminos de solución muy distintos.',
  },
  {
    id: 'opciones',
    titulo: 'El mapa de posibilidades',
    etiquetaGrow: 'Options',
    pregunta: 'Si no hubiera ningún obstáculo por ahora, ¿qué tres caminos distintos podrías imaginarte para tu carrera en los próximos 2 años?',
    placeholder: 'Ej: 1) Ascender donde estoy, 2) Cambiarme a una startup de tecnología, 3) Largarme a algo propio. Pueden sonar contradictorios, está bien.',
    ayuda: 'No estamos decidiendo nada todavía. El objetivo es ampliar el mapa antes de cerrar opciones.',
  },
  {
    id: 'compromiso',
    titulo: 'El primer paso real',
    etiquetaGrow: 'Will',
    pregunta: '¿Qué intentaste hasta ahora para cambiar tu situación? Y siendo muy honesto/a: ¿qué estarías dispuesto/a a hacer diferente?',
    placeholder: 'Ej: Mandé CVs pero sin foco. Hablé con mi jefe pero sin concretar nada. Lo que haría diferente es dedicarle tiempo real a pensar esto antes de actuar.',
    ayuda: 'La diferencia entre quienes avanzan y quienes se quedan quietos suele estar exactamente acá.',
  },
]

// ── Claude API ─────────────────────────────────────────────────────────────

function buildPrompt(answers: Answers, hasCv: boolean): string {
  return `Sos un HR Coach de nivel ejecutivo y consultor de desarrollo profesional senior con 20 años de experiencia en América Latina.

Tu rol es potenciar, destrabar y transformar carreras. No evaluás para contratar. Aplicás el modelo GROW (Goal, Reality, Options, Will) como marco de análisis y la distinción Aptitud/Actitud para diagnosticar el tipo de freno.

Un profesional completó su Diagnóstico de Carrera respondiendo 5 preguntas estructuradas con metodología GROW${hasCv ? '. También subió su CV (adjunto)' : ''}.

RESPUESTAS:
**GOAL — Lo que busca lograr**: ${answers['objetivo'] || '(sin respuesta)'}
**REALITY — Su situación hoy**: ${answers['realidad'] || '(sin respuesta)'}
**REALITY — Tipo de freno (Aptitud vs Actitud)**: ${answers['tipoFreno'] || '(sin respuesta)'}
**OPTIONS — Caminos que visualiza**: ${answers['opciones'] || '(sin respuesta)'}
**WILL — Intentos pasados y compromiso**: ${answers['compromiso'] || '(sin respuesta)'}

Aplicá el marco GROW para el análisis:
- Identificá si el freno es de APTITUD (habilidades, experiencia, conocimiento faltante), ACTITUD (motivación, claridad de dirección, alineación de valores) o MIXTO
- Detectá la brecha entre autopercepción y realidad — ¿hay puntos ciegos o subestimación?
- Identificá qué opciones en el mapa de posibilidades no está viendo o subestimando
- Evaluá el nivel real de compromiso para el cambio
- Formulá las hipótesis como preguntas de trabajo abiertas, no como veredictos

Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, con esta estructura exacta:
{
  "perfilActual": "2-3 oraciones sobre quién es hoy este profesional${hasCv ? ', integrando lo que muestra su CV' : ''}",
  "tensionCentral": "La paradoja o tensión central que lo trajo aquí, en 1-2 oraciones",
  "tipoDeFreno": "Aptitud",
  "fortalezasOcultas": ["algo que tiene y no está valorando 1", "fortaleza 2", "fortaleza 3"],
  "brechaIdentificada": "La distancia real entre dónde está y dónde quiere estar",
  "hipotesisDeTrabajo": ["hipótesis sobre la causa raíz 1", "hipótesis alternativa 2", "hipótesis 3"],
  "primerPasoConcreto": "El paso más pequeño y accionable que podría dar esta semana para comenzar a moverse",
  "mensajePersonalizado": "Un párrafo de coaching directo, empático pero sin complacencia. Incluí al menos una pregunta potente que lo invite a reflexionar."
}

Notas: el campo tipoDeFreno debe ser exactamente "Aptitud", "Actitud" o "Mixto". Usá 'vos'. Sin frases corporativas vacías. SOLO el JSON.`
}

const DEMO_RESULT: DiagnosisResult = {
  perfilActual:
    'Profesional con sólida trayectoria técnica en consultoría, actualmente en un punto de inflexión entre consolidar su expertise o dar un salto hacia roles de mayor impacto estratégico. Sus respuestas revelan alguien que sabe ejecutar muy bien, pero que empieza a cuestionar si está en el lugar correcto para crecer.',
  tensionCentral:
    'La paradoja central es que sus habilidades son su ancla: lo hacen valioso donde está, pero también lo inmovilizan. Cuanto mejor ejecuta en su rol actual, más difícil se vuelve justificar —y visualizar— el cambio.',
  tipoDeFreno: 'Mixto',
  fortalezasOcultas: [
    'Capacidad analítica desarrollada que va mucho más allá de su rol actual y que el mercado paga bien en posiciones de liderazgo',
    'Autoconciencia inusual: pocas personas identifican con tanta precisión el tipo de freno que tienen',
    'Historial de permanencia que indica lealtad y profundidad, no estancamiento',
  ],
  brechaIdentificada:
    'La distancia no es de habilidades técnicas —esas están. La brecha está en la narrativa: no tiene claro cómo contar su historia de forma que conecte con el próximo paso que quiere dar.',
  hipotesisDeTrabajo: [
    '¿El estancamiento que sentís es sobre el trabajo en sí, o sobre el impacto que ese trabajo tiene en el mundo y en tu propio desarrollo?',
    '¿Qué pasaría si el próximo movimiento no fuera necesariamente "más grande", sino simplemente más alineado con lo que te importa?',
    '¿Hay decisiones que ya tomaste internamente pero que todavía no se tradujeron en acciones concretas?',
  ],
  primerPasoConcreto:
    'Esta semana: escribí en un papel (sí, papel) una sola oración que describa cómo querés que alguien te presente en una reunión dentro de 2 años. Sin cargo, sin empresa — solo lo que querés que esa persona diga sobre vos.',
  mensajePersonalizado:
    '— MODO DEMO — Este es un resultado simulado para testear el flujo. Tu situación muestra una combinación interesante: tenés las herramientas, pero el mapa no está claro todavía. Eso no es un problema de capacidad — es una pregunta de dirección. Y esa pregunta tiene respuesta. La pregunta que me queda es: ¿qué te haría saber que tomaste la decisión correcta?',
}

async function analyzeWithGemini(answers: Answers, cvFile: File | null): Promise<DiagnosisResult> {
  const parts: AiPart[] = []

  if (cvFile) {
    const base64 = await fileToBase64(cvFile)
    parts.push({ inlineData: { mimeType: 'application/pdf', data: base64 } })
  }

  parts.push({ text: buildPrompt(answers, !!cvFile) })

  const response = await callAi(parts)
  if ('demo' in response) {
    await new Promise((r) => setTimeout(r, 1500))
    return DEMO_RESULT
  }

  const jsonMatch = response.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('La IA no devolvió un diagnóstico válido. Intentá de nuevo.')

  return JSON.parse(jsonMatch[0]) as DiagnosisResult
}

// ── Step: Intro ────────────────────────────────────────────────────────────

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="mb-8 text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
          <span className="text-2xl">◈</span>
        </div>
        <h2 className="mb-3">Diagnóstico de Carrera</h2>
        <p className="leading-relaxed text-text-muted">
          Este proceso tiene <strong className="text-foreground font-semibold">2 partes</strong>: primero
          te hacemos las preguntas que haría cualquier consultor de RRHH, y después podés subir tu
          CV para que la IA lo analice junto con tus respuestas.
        </p>
      </div>

      <div className="card mb-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
          ¿Qué vas a obtener?
        </p>
        <ul className="space-y-3">
          {[
            'Claridad sobre el nudo de tu situación actual',
            'Fortalezas que quizás no estás viendo',
            '3 hipótesis de trabajo para explorar en el Discovery',
            'Un diagnóstico IA personalizado, listo para usar',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
              <span className="mt-0.5 font-bold text-primary">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-6 text-center text-xs text-text-muted">
        5 preguntas + subir tu CV (opcional) · ~10 minutos
      </p>

      <button onClick={onStart} className="btn-primary w-full py-3.5 text-base">
        Empezar diagnóstico →
      </button>
    </div>
  )
}

// ── Step: Questions ────────────────────────────────────────────────────────

const GROW_COLORS: Record<string, string> = {
  Goal: '#f97316',
  Reality: '#6366f1',
  Options: '#0ea5e9',
  Will: '#10b981',
}

function QuestionsScreen({
  answers,
  onAnswer,
  onComplete,
  onBack,
}: {
  answers: Answers
  onAnswer: (id: string, value: string) => void
  onComplete: () => void
  onBack: () => void
}) {
  const [idx, setIdx] = useState(0)
  const q = QUESTIONS[idx]
  const isLast = idx === QUESTIONS.length - 1
  const canContinue = (answers[q.id] ?? '').trim().length >= 10
  const progress = ((idx + 1) / QUESTIONS.length) * 100
  const growColor = GROW_COLORS[q.etiquetaGrow] ?? '#f97316'

  const handleNext = () => (isLast ? onComplete() : setIdx((i) => i + 1))

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-text-muted">Pregunta {idx + 1} de {QUESTIONS.length}</span>
          <span className="font-medium" style={{ color: growColor }}>
            {q.etiquetaGrow}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border-color">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: growColor }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="card mb-5">
        <p
          className="mb-1 text-xs font-semibold uppercase tracking-widest"
          style={{ color: growColor }}
        >
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

      {/* Nav */}
      <div className="flex gap-3">
        <button
          onClick={idx === 0 ? onBack : () => setIdx((i) => i - 1)}
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-white"
        >
          ← Atrás
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 rounded-xl py-3 font-semibold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: canContinue ? `linear-gradient(135deg, ${growColor}, ${growColor}cc)` : '#9ca3af' }}
        >
          {isLast ? 'Continuar al CV →' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}

// ── Step: CV Upload ────────────────────────────────────────────────────────

function CVUploadScreen({
  onAnalyze,
  onSkip,
  onBack,
}: {
  onAnalyze: (file: File) => void
  onSkip: () => void
  onBack: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
      setFile(f)
    } else {
      alert('Solo aceptamos PDF por ahora. Exportá tu CV desde Word o LinkedIn como PDF.')
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
          <span className="text-2xl">⬆</span>
        </div>
        <h2 className="mb-3">Subí tu CV</h2>
        <p className="leading-relaxed text-text-muted">
          La IA va a analizar tu CV junto con tus respuestas para darte un diagnóstico
          más preciso y personalizado.
        </p>
        <p className="mt-2 text-xs text-text-muted">Solo PDF · No se almacena · Solo para este análisis</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
        className="mb-6 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all"
        style={{
          borderColor: dragOver ? '#f97316' : file ? '#10b981' : '#e5e7eb',
          background: dragOver ? 'rgba(249,115,22,0.04)' : file ? '#f0fdf4' : 'white',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {file ? (
          <>
            <div className="mb-2 text-3xl text-green-500">✓</div>
            <p className="font-semibold text-green-700">{file.name}</p>
            <p className="mt-1 text-xs text-text-muted">{(file.size / 1024).toFixed(0)} KB · Click para cambiar</p>
          </>
        ) : (
          <>
            <div className="mb-3 text-3xl text-text-muted">↑</div>
            <p className="font-medium text-foreground">Arrastrá tu CV acá o hacé click</p>
            <p className="mt-1 text-xs text-text-muted">Solo PDF · Máximo 10 MB</p>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-white"
        >
          ← Atrás
        </button>
        <button
          onClick={() => file && onAnalyze(file)}
          disabled={!file}
          className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Analizar con IA →
        </button>
      </div>

      <button
        onClick={onSkip}
        className="mt-4 w-full text-xs text-text-muted underline underline-offset-2 transition hover:text-foreground"
      >
        Continuar sin CV (el análisis será menos preciso)
      </button>
    </div>
  )
}

// ── Step: Analyzing — AI Active state ─────────────────────────────────────

function AnalyzingScreen() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000)
    return () => clearInterval(t)
  }, [])

  const messages = [
    'Leyendo tus respuestas…',
    'Identificando el tipo de freno…',
    'Detectando fortalezas ocultas…',
    'Formulando hipótesis de trabajo…',
    'Preparando tu diagnóstico…',
  ]

  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      {/* Apple Intelligence shimmer ring */}
      <div className="relative mx-auto mb-10 h-20 w-20">
        <div className="ai-ring absolute inset-0 rounded-full" />
        <div
          className="absolute flex items-center justify-center rounded-full bg-background"
          style={{ inset: '3px' }}
        >
          <span className="text-xl text-text-muted">✦</span>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-semibold tracking-tight">Analizando tu perfil</h2>
      <p
        key={tick}
        className="ai-result text-sm text-text-muted"
        style={{ minHeight: '1.25rem' }}
      >
        {messages[tick % messages.length]}
      </p>
      <p className="mt-4 text-xs text-text-muted opacity-60">Esto puede tomar 15–30 segundos.</p>
    </div>
  )
}

// ── Step: Summary — AI Resolved state ─────────────────────────────────────

const FRENO_CONFIG: Record<TipoDeFreno, { label: string; color: string; bg: string; desc: string }> = {
  Aptitud: {
    label: 'Freno de Aptitud',
    color: '#4f46e5',
    bg: 'rgba(238,236,255,0.7)',
    desc: 'El camino pasa por capacitación, nuevos proyectos y mentoreo técnico.',
  },
  Actitud: {
    label: 'Freno de Actitud',
    color: '#7c3aed',
    bg: 'rgba(245,243,255,0.8)',
    desc: 'El camino pasa por reflexión de valores, claridad de dirección y rediseño de rol.',
  },
  Mixto: {
    label: 'Freno Mixto',
    color: '#b45309',
    bg: 'rgba(255,251,235,0.8)',
    desc: 'Hay componentes de ambos. Empezar por la dirección antes de capacitarse.',
  },
}

function SummaryScreen({
  result,
  onDiscovery,
  onRestart,
}: {
  result: DiagnosisResult
  onDiscovery: () => void
  onRestart: () => void
}) {
  const freno = FRENO_CONFIG[result.tipoDeFreno] ?? FRENO_CONFIG['Mixto']

  return (
    <div className="ai-result mx-auto max-w-2xl">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          HR Coach IA · Metodología GROW
        </p>
        <h2 className="mb-1">Tu Diagnóstico</h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* Mensaje personalizado — AI tint */}
        <div
          className="ai-tint rounded-2xl p-6"
          style={{ borderLeft: `3px solid #f97316` }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Para vos
          </p>
          <p className="italic leading-relaxed text-foreground">"{result.mensajePersonalizado}"</p>
        </div>

        {/* Tipo de freno */}
        <div className="rounded-2xl border p-5" style={{ background: freno.bg, borderColor: freno.color + '30' }}>
          <span
            className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: freno.color, color: 'white' }}
          >
            {freno.label}
          </span>
          <p className="text-sm leading-relaxed" style={{ color: freno.color }}>
            {freno.desc}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Perfil Actual</p>
            <p className="text-sm leading-relaxed text-text-muted">{result.perfilActual}</p>
          </div>
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Tensión Central</p>
            <p className="text-sm leading-relaxed text-text-muted">{result.tensionCentral}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Fortalezas Ocultas</p>
            <ul className="space-y-2">
              {result.fortalezasOcultas.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 font-bold text-primary">·</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Brecha Identificada</p>
            <p className="text-sm leading-relaxed text-text-muted">{result.brechaIdentificada}</p>
          </div>
        </div>

        {/* Hipótesis */}
        <div className="card">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Hipótesis de Trabajo — para explorar en el Discovery
          </p>
          <ol className="space-y-3">
            {result.hipotesisDeTrabajo.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-sm font-semibold text-primary">{i + 1}.</span>
                <p className="text-sm leading-relaxed text-text-muted">{h}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Primer paso — verde */}
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-green-700">
            Primer Paso Esta Semana
          </p>
          <p className="text-sm leading-relaxed text-green-800">{result.primerPasoConcreto}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={onDiscovery} className="btn-primary flex-1 py-4 text-base" style={{ minWidth: 200 }}>
          Ir al Discovery →
        </button>
        <button
          onClick={onRestart}
          className="rounded-xl border border-border-color px-6 py-4 text-sm text-text-muted transition hover:bg-white"
        >
          Reiniciar
        </button>
      </div>
    </div>
  )
}

// ── Main: DiagnosisFlow ────────────────────────────────────────────────────

export function DiagnosisFlow({ onBack, onDiscovery }: { onBack: () => void; onDiscovery: (result: DiagnosisResult) => void }) {
  const [step, setStep] = useState<FlowStep>('intro')
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnswer = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }))

  const handleAnalyze = async (cvFile: File | null) => {
    setStep('analyzing')
    setError(null)
    try {
      const r = await analyzeWithGemini(answers, cvFile)
      setResult(r)
      setStep('summary')
      trackEvent('diagnosis_completed', { hasCv: !!cvFile })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setStep('cv-upload')
    }
  }

  const handleRestart = () => {
    setAnswers({})
    setResult(null)
    setError(null)
    setStep('intro')
  }

  const stepLabel: Record<FlowStep, string> = {
    intro: '',
    questions: 'Preguntas',
    'cv-upload': 'Subir CV',
    analyzing: 'Analizando',
    summary: 'Resultados',
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm">
        <div className="section-container flex items-center gap-4 py-4">
          <button
            onClick={onBack}
            className="text-sm text-text-muted transition-colors hover:text-foreground"
          >
            ← Inicio
          </button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Career<span className="text-primary">Path</span>
          </span>
          {stepLabel[step] && (
            <span className="ml-auto text-xs text-text-muted">
              Diagnóstico · {stepLabel[step]}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        {error && (
          <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {step === 'intro' && (
          <IntroScreen
            onStart={() => {
              trackEvent('diagnosis_started')
              setStep('questions')
            }}
          />
        )}
        {step === 'questions' && (
          <QuestionsScreen
            answers={answers}
            onAnswer={handleAnswer}
            onComplete={() => setStep('cv-upload')}
            onBack={onBack}
          />
        )}
        {step === 'cv-upload' && (
          <CVUploadScreen
            onAnalyze={(f) => handleAnalyze(f)}
            onSkip={() => handleAnalyze(null)}
            onBack={() => setStep('questions')}
          />
        )}
        {step === 'analyzing' && <AnalyzingScreen />}
        {step === 'summary' && result && (
          <SummaryScreen
            result={result}
            onDiscovery={() => onDiscovery(result)}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  )
}
