import { useState, useRef, useEffect } from 'react'
import { callCompanyAnalysis, fileToBase64 } from '../lib/aiClient'

// ── Types ──────────────────────────────────────────────────────────────────

type CaseType = 'rendimiento' | 'crecimiento'
type CompanyStep = 'intro' | 'context' | 'questions' | 'upload' | 'analyzing' | 'result'
type Answers = Record<string, string>
type TipoDeBrecha = 'Aptitud' | 'Actitud' | 'Mixto' | 'Crecimiento' | 'Movilidad'

interface CollaboratorContext {
  rol: string
  seniority: string
  tiempo: string
  casoTipo: CaseType
}

export interface CompanyDiagnosisResult {
  perfilDelColaborador: string
  situacionCentral: string
  tipoDeBrecha: TipoDeBrecha
  fortalezasDelColaborador: string[]
  hipotesisPrincipales: string[]
  guiaDeConversacion: {
    apertura: string
    preguntasClave: string[]
    cierre: string
  }
  planDeAccion: {
    bloque70: string[]
    bloque20: string[]
    bloque10: string[]
  }
  proximosPasos: string[]
  mensajeParaElLider: string
}

// ── Questions config ────────────────────────────────────────────────────────

const QUESTIONS_RENDIMIENTO = [
  {
    id: 'observacion',
    titulo: 'Lo que estás viendo',
    etiqueta: 'Situación',
    color: '#ef4444',
    pregunta: '¿Qué comportamientos o resultados concretos te generan preocupación? Describí específicamente lo que está pasando.',
    placeholder: 'Ej: En los últimos 2 sprints no cumplió los objetivos acordados. En reuniones participa menos y dos compañeros me comentaron fricciones con él/ella.',
    ayuda: 'Cuanto más específico, más preciso el diagnóstico. Hechos observables, no interpretaciones.',
  },
  {
    id: 'contexto',
    titulo: 'El contexto y el timing',
    etiqueta: 'Contexto',
    color: '#f97316',
    pregunta: '¿Desde cuándo notás este cambio? ¿Hubo algún evento, cambio organizacional o situación que lo precedió?',
    placeholder: 'Ej: Empezó hace 3 meses, coincidiendo con el cambio de PM. / No hay un evento claro, fue gradual a lo largo del año.',
    ayuda: 'El timing y el contexto revelan la causa raíz mejor que el síntoma en sí.',
  },
  {
    id: 'conversaciones',
    titulo: 'Conversaciones previas',
    etiqueta: 'Historial',
    color: '#6366f1',
    pregunta: '¿Qué conversaciones ya tuviste con esta persona al respecto? ¿Cómo respondió? ¿Qué funcionó o no funcionó?',
    placeholder: 'Ej: Tuvimos una 1:1 donde señalé los incumplimientos, lo tomó a la defensiva. / No hablé todavía, no sé cómo encararlo.',
    ayuda: 'Esto permite calibrar la próxima conversación y evitar repetir lo que no funcionó.',
  },
  {
    id: 'objetivo',
    titulo: 'El resultado que buscás',
    etiqueta: 'Objetivo',
    color: '#10b981',
    pregunta: '¿Qué resultado concreto querés que salga de este proceso? ¿Qué sería un éxito para vos en 30-60 días?',
    placeholder: 'Ej: Quiero que vuelva al nivel anterior y pueda sostenerlo. / Necesito saber si hay lugar para esta persona en el equipo o si es momento de una conversación más difícil.',
    ayuda: 'Definir el éxito antes de la conversación cambia completamente cómo la encarás.',
  },
]

const QUESTIONS_CRECIMIENTO = [
  {
    id: 'aspiracion',
    titulo: 'Hacia dónde quiere ir',
    etiqueta: 'Objetivo',
    color: '#10b981',
    pregunta: '¿Hacia dónde quiere crecer o moverse esta persona? ¿Lo expresó claramente o lo estás infiriendo vos?',
    placeholder: 'Ej: Me dijo que quiere liderar un equipo en 2 años. / Creo que quiere moverse a producto, aunque no lo dijo explícitamente.',
    ayuda: 'Hay diferencia entre lo que el colaborador expresó y lo que el líder infiere. Ambos son válidos pero requieren conversaciones distintas.',
  },
  {
    id: 'brechaActual',
    titulo: 'Fortalezas y brecha hoy',
    etiqueta: 'Realidad',
    color: '#6366f1',
    pregunta: '¿Cuáles son sus fortalezas más claras? ¿Y qué habilidades o comportamientos le faltan para el próximo nivel?',
    placeholder: 'Ej: Es muy sólido técnicamente y los clientes lo valoran mucho. Le falta comunicación ejecutiva y no toma decisiones sin validar con alguien.',
    ayuda: '"Le falta liderazgo" es demasiado vago. ¿Qué comportamientos concretos no están apareciendo todavía?',
  },
  {
    id: 'oportunidades',
    titulo: 'Las oportunidades disponibles',
    etiqueta: 'Opciones',
    color: '#0ea5e9',
    pregunta: '¿Qué oportunidades concretas existen en tu equipo o en la empresa para este camino de crecimiento?',
    placeholder: 'Ej: Se abre un rol de tech lead en Q3. / No hay un rol claro, pero podría liderar proyectos transversales. / En otra área hay más espacio.',
    ayuda: 'Si no hay oportunidades reales, el plan de desarrollo va a frustrar más que motivar. Mejor saberlo ahora.',
  },
  {
    id: 'alineacion',
    titulo: 'Alineación con el negocio',
    etiqueta: 'Compromiso',
    color: '#f97316',
    pregunta: '¿Qué tan alineado está su deseo de crecimiento con las necesidades del negocio? ¿El equipo gana con este movimiento?',
    placeholder: 'Ej: Totalmente alineado, necesitamos ese perfil. / Hay tensión: si crece en lo que quiere, perdemos su expertise actual.',
    ayuda: 'Los mejores planes de desarrollo son los que ganan tanto el colaborador como el equipo. Cuando hay tensión, hay que nombrarla.',
  },
]

// ── Demo results ────────────────────────────────────────────────────────────

const DEMO_RENDIMIENTO: CompanyDiagnosisResult = {
  perfilDelColaborador: 'Colaborador con buena base técnica que está atravesando un momento de desconexión visible. Lo que describe el líder sugiere un cambio de patrón, no un problema de capacidad — algo cambió en la relación de esta persona con su trabajo o con el equipo.',
  situacionCentral: 'La tensión central no es el rendimiento en sí, sino la brecha entre lo que esta persona puede hacer y lo que está eligiendo hacer. Eso es la señal de un freno de Actitud.',
  tipoDeBrecha: 'Actitud',
  fortalezasDelColaborador: [
    'Tiene experiencia suficiente para el rol — si no tuviera las habilidades, el deterioro habría sido más gradual y diferente',
    'El hecho de que sea visible para el líder sugiere que antes tenía un nivel de compromiso que valía la pena',
    'La capacidad de ajuste existe — la pregunta es si hay motivación para activarla',
  ],
  hipotesisPrincipales: [
    '¿Y si el problema real es que esta persona siente que su contribución no está siendo reconocida o que el rol dejó de tener sentido para ella?',
    '¿Qué pasaría si el cambio de contexto rompió algo que antes funcionaba y nadie lo nombró todavía?',
    '¿Hay algo que esta persona quiere pero no está pidiendo, y el bajo rendimiento es la forma indirecta de comunicarlo?',
  ],
  guiaDeConversacion: {
    apertura: 'Empezá desde la curiosidad, no desde el juicio. Algo como: "Quería hablar con vos sobre algo que estoy observando, y quiero entender mejor qué está pasando desde tu perspectiva antes de sacar conclusiones."',
    preguntasClave: [
      '¿Cómo te estás sintiendo con el trabajo últimamente? ¿Hay algo que cambió para vos en estos meses?',
      '¿Qué es lo que más te está costando del trabajo hoy?',
      'Si pudieras cambiar algo de tu rol o de cómo trabajás con el equipo, ¿qué sería?',
      '¿Qué necesitarías de mi parte para poder dar lo mejor de vos en los próximos 30 días?',
    ],
    cierre: 'Cerrá con un acuerdo concreto y revisable, no con un ultimátum. "¿Qué te comprometés a hacer diferente esta semana? Yo me comprometo a X. Nos reunimos en 2 semanas a revisar." El compromiso bilateral convierte la conversación en un punto de inflexión.',
  },
  planDeAccion: {
    bloque70: [
      'Asignarle un proyecto acotado con ownership real y visibilidad — sin micromanagement para ver qué aparece',
      'Redefinir 1-2 responsabilidades del rol alineadas a sus intereses declarados en la conversación',
    ],
    bloque20: [
      'Programar check-ins quincenales de 30 minutos enfocados en cómo está la persona, no solo en los resultados',
      'Conectarlo con alguien del equipo ampliado que tenga el perfil al que aspira',
    ],
    bloque10: [
      'Identificar junto con él/ella un curso o recurso concreto que refuerce algo que quiere desarrollar — que lo elija, no que se lo impongas',
    ],
  },
  proximosPasos: [
    'Esta semana: agendá la 1:1 con un frame explícito: "quiero entender cómo estás", no "quiero hablar de tu rendimiento"',
    'En 30 días: si no hay cambio visible después de la conversación, definí con RRHH qué sigue — no dejes pasar más de un mes sin una decisión',
  ],
  mensajeParaElLider: '— MODO DEMO — Lo que describís tiene las características de un freno de Actitud, no de Aptitud. Eso es buena y mala noticia al mismo tiempo: es más recuperable, pero requiere una conversación real, no solo más seguimiento de métricas. Antes de esa conversación, una pregunta: ¿qué tan seguido tenés 1:1s con esta persona donde la pregunta central no sea el trabajo, sino cómo está ella o él?',
}

const DEMO_CRECIMIENTO: CompanyDiagnosisResult = {
  perfilDelColaborador: 'Colaborador en un momento de inflexión positiva: tiene la base para dar el próximo paso y está mostrando señales de estar listo. El riesgo no es el crecimiento en sí — es que si el líder no activa un plan concreto pronto, la energía se va a frustrar o la persona va a buscar ese espacio en otro lado.',
  situacionCentral: 'La oportunidad central es real y bien identificada. La tensión está en que crecer requiere dejar algo: si sube de nivel, alguien tiene que absorber lo que hace hoy. Eso no es excusa para no avanzar — es una variable más del plan.',
  tipoDeBrecha: 'Crecimiento',
  fortalezasDelColaborador: [
    'Ya tiene el respeto del equipo, que es lo más difícil de construir cuando alguien sube de nivel',
    'Su solidez técnica le da credibilidad para liderar — no va a necesitar demostrar expertise, puede enfocarse en el impacto',
    'El hecho de que lo esté expresando activamente es una fortaleza de autoconciencia que no todos tienen',
  ],
  hipotesisPrincipales: [
    '¿Y si lo que realmente necesita este colaborador no es un nuevo rol, sino más autonomía y responsabilidad en el actual — y de eso sale el salto natural?',
    '¿Qué pasaría si la brecha real no es de habilidades sino de exposición: nunca le dieron el espacio para demostrar que puede?',
    '¿Hay algo que el líder no está nombrando sobre por qué no ocurrió el movimiento antes — deadline, presupuesto, estructura?',
  ],
  guiaDeConversacion: {
    apertura: 'Abrí desde el reconocimiento antes de hablar del plan: "Quería hablar específicamente sobre tu crecimiento porque creo que estás en un buen momento y quiero que tengamos una conversación clara sobre hacia dónde vas."',
    preguntasClave: [
      'Cuando imaginás que estés en el próximo nivel, ¿qué querés que sea diferente en tu día a día — no en el título, sino en cómo trabajás?',
      '¿Qué creés que te falta todavía para llegar ahí? ¿Y qué creés que ya tenés?',
      '¿Qué obstáculos reales ves, dentro o fuera de tu control?',
      'Si pudieras diseñar los próximos 6 meses para prepararte para ese paso, ¿qué incluirías?',
    ],
    cierre: 'Cerrá con un plan conjunto, no unilateral. "¿Qué acordamos como próximo paso concreto? Yo de mi lado hago X, vos te comprometés a Y. Nos revisamos en Z semanas." El plan co-construido tiene 3 veces más probabilidad de ejecutarse.',
  },
  planDeAccion: {
    bloque70: [
      'Asignarle ownership total de un proyecto cross-funcional con visibilidad hacia arriba — que lo maneje solo/a, incluyendo las partes incómodas',
      'Darle responsabilidad de onboarding o mentoreo de alguien más junior — mejor forma de desarrollar liderazgo que cualquier curso',
    ],
    bloque20: [
      'Conectarlo con alguien que ya esté en el nivel al que aspira — dentro o fuera de la empresa — para que tenga un modelo de referencia real',
      'Incluirlo en 1-2 reuniones de liderazgo donde normalmente no estaría — exposición al tipo de conversaciones que va a tener que manejar',
    ],
    bloque10: [
      'Un programa de comunicación ejecutiva o liderazgo situacional — que lo elija él/ella de una lista corta que vos armás',
    ],
  },
  proximosPasos: [
    'Esta semana: agendá la 1:1 de carrera con el frame explícito de "quiero hablar de tu crecimiento" — no improvises esta conversación',
    'En 30 días: definí con él/ella el primer proyecto del plan y poné una fecha de revisión formal en 90 días',
  ],
  mensajeParaElLider: '— MODO DEMO — Lo que describís es una de las mejores situaciones que puede tener un líder: alguien con potencial que lo está expresando. El riesgo no es si va a poder crecer — ese potencial existe. El riesgo es que si no pasa nada concreto en los próximos 60-90 días, la energía de esta persona va a buscar otro lugar donde canalizarse. La pregunta que te hago: ¿qué te está frenando a vos para hacer este movimiento antes?',
}

// ── Gemini API ──────────────────────────────────────────────────────────────

async function analyzeWithGemini(
  ctx: CollaboratorContext,
  answers: Answers,
  docFile: File | null,
): Promise<CompanyDiagnosisResult> {
  // El prompt se arma en el servidor (server/company.ts): acá solo van los datos.
  const response = await callCompanyAnalysis({
    contexto: ctx,
    respuestas: answers,
    pdfBase64: docFile ? await fileToBase64(docFile) : undefined,
  })
  if ('demo' in response) {
    await new Promise((r) => setTimeout(r, 1500))
    return ctx.casoTipo === 'rendimiento' ? DEMO_RENDIMIENTO : DEMO_CRECIMIENTO
  }
  return response.data as CompanyDiagnosisResult
}

// ── Step: Intro ─────────────────────────────────────────────────────────────

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="mb-8 text-center">
        <div
          className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <span className="text-2xl">◈</span>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Para Líderes y RRHH</p>
        <h2 className="mb-3">Preparar conversación de desarrollo</h2>
        <p className="leading-relaxed text-text-muted">
          Describís la situación de un colaborador y la IA te genera un{' '}
          <strong className="text-foreground font-semibold">diagnóstico + guía de conversación 1:1 + plan de acción</strong>{' '}
          listo para usar.
        </p>
      </div>

      <div className="card mb-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">¿Qué vas a obtener?</p>
        <ul className="space-y-3">
          {[
            'Diagnóstico del tipo de brecha (Aptitud / Actitud / Crecimiento)',
            '3 hipótesis sobre la causa raíz real',
            'Guía de conversación 1:1 con preguntas potentes',
            'Plan de Acción 70-20-10 personalizado',
            'Próximos pasos concretos para vos como líder',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-text-muted">
              <span className="mt-0.5 font-bold text-primary">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-6 text-center text-xs text-text-muted">
        4 preguntas + evaluación opcional (PDF) · ~8 minutos
      </p>

      <button onClick={onStart} className="btn-primary w-full py-3.5 text-base">
        Empezar análisis →
      </button>
    </div>
  )
}

// ── Step: Context form ──────────────────────────────────────────────────────

const CASO_OPTIONS: { value: CaseType; icon: string; titulo: string; desc: string; color: string; bg: string }[] = [
  {
    value: 'rendimiento',
    icon: '↘',
    titulo: 'Rendimiento o comportamiento',
    desc: 'Resultados por debajo de lo esperado, cambio de actitud o fricción con el equipo',
    color: '#ef4444',
    bg: 'rgba(254,242,242,0.8)',
  },
  {
    value: 'crecimiento',
    icon: '↗',
    titulo: 'Crecimiento o movilidad',
    desc: 'La persona quiere crecer de nivel, cambiar de área o asumir nuevas responsabilidades',
    color: '#10b981',
    bg: 'rgba(240,253,244,0.8)',
  },
]

function ContextForm({
  onSubmit,
  onBack,
}: {
  onSubmit: (ctx: CollaboratorContext) => void
  onBack: () => void
}) {
  const [rol, setRol] = useState('')
  const [seniority, setSeniority] = useState('')
  const [tiempo, setTiempo] = useState('')
  const [casoTipo, setCasoTipo] = useState<CaseType | null>(null)

  const canContinue = rol.trim().length >= 2 && seniority && tiempo && casoTipo

  const handleSubmit = () => {
    if (!canContinue || !casoTipo) return
    onSubmit({ rol, seniority, tiempo, casoTipo })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">Paso 1</p>
        <h3 className="text-xl font-semibold">Contame sobre el colaborador</h3>
        <p className="mt-1 text-sm text-text-muted">No necesitamos el nombre — solo el contexto relevante.</p>
      </div>

      <div className="card mb-5 space-y-5">
        {/* Rol */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Rol del colaborador</label>
          <input
            type="text"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            placeholder="Ej: Desarrollador frontend, Analista de datos, Product Manager"
            className="w-full rounded-xl border border-border-color p-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Seniority */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Seniority</label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-card p-3 text-sm outline-none transition-colors focus:border-primary"
            >
              <option value="">Seleccioná</option>
              <option>Junior (0-2 años)</option>
              <option>Semi-senior (2-4 años)</option>
              <option>Senior (4-8 años)</option>
              <option>Lead / Staff (8+ años)</option>
              <option>Gerencia / Dirección</option>
            </select>
          </div>

          {/* Tiempo en equipo */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Tiempo en el equipo</label>
            <select
              value={tiempo}
              onChange={(e) => setTiempo(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-card p-3 text-sm outline-none transition-colors focus:border-primary"
            >
              <option value="">Seleccioná</option>
              <option>Menos de 6 meses</option>
              <option>6 a 12 meses</option>
              <option>1 a 3 años</option>
              <option>Más de 3 años</option>
            </select>
          </div>
        </div>
      </div>

      {/* Caso tipo */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-medium text-foreground">¿Cuál es la situación?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CASO_OPTIONS.map((opt) => {
            const selected = casoTipo === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setCasoTipo(opt.value)}
                className="rounded-2xl border p-5 text-left transition-all"
                style={{
                  borderColor: selected ? opt.color : '#e5e7eb',
                  background: selected ? opt.bg : 'white',
                  boxShadow: selected ? `0 0 0 2px ${opt.color}30` : 'none',
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: opt.color }}>{opt.icon}</span>
                  <span className="font-semibold text-foreground text-sm">{opt.titulo}</span>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">{opt.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-card"
        >
          ← Atrás
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canContinue}
          className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}

// ── Step: Questions ─────────────────────────────────────────────────────────

function QuestionsScreen({
  casoTipo,
  answers,
  onAnswer,
  onComplete,
  onBack,
}: {
  casoTipo: CaseType
  answers: Answers
  onAnswer: (id: string, value: string) => void
  onComplete: () => void
  onBack: () => void
}) {
  const questions = casoTipo === 'rendimiento' ? QUESTIONS_RENDIMIENTO : QUESTIONS_CRECIMIENTO
  const [idx, setIdx] = useState(0)
  const q = questions[idx]
  const isLast = idx === questions.length - 1
  const canContinue = (answers[q.id] ?? '').trim().length >= 10
  const progress = ((idx + 1) / questions.length) * 100

  const handleNext = () => (isLast ? onComplete() : setIdx((i) => i + 1))

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-text-muted">Pregunta {idx + 1} de {questions.length}</span>
          <span className="font-medium" style={{ color: q.color }}>{q.etiqueta}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border-color">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: q.color }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="card mb-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: q.color }}>
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
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-card"
        >
          ← Atrás
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 rounded-xl py-3 font-semibold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: canContinue ? `linear-gradient(135deg, ${q.color}, ${q.color}cc)` : '#9ca3af',
          }}
        >
          {isLast ? 'Continuar a documentación →' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}

// ── Step: Document upload ────────────────────────────────────────────────────

function DocUploadScreen({
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
      alert('Solo aceptamos PDF. Exportá el documento como PDF e intentá de nuevo.')
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 text-center">
        <div
          className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <span className="text-2xl">⬆</span>
        </div>
        <h2 className="mb-3">Documentación del colaborador</h2>
        <p className="leading-relaxed text-text-muted">
          Subí la evaluación de desempeño, feedback 360 o cualquier documento relevante para un análisis más preciso.
        </p>
        <p className="mt-2 text-xs text-text-muted">Solo PDF · No se almacena · Solo para este análisis</p>
      </div>

      {/* Drop zone */}
      {/* Botón real (no un div clickeable): recibe foco y se activa con Enter/Espacio. */}
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
        aria-label={file ? `Documento: ${file.name}. Activar para elegir otro PDF` : 'Elegir el documento del colaborador en PDF'}
        className="mb-6 block w-full cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all"
        style={{
          borderColor: dragOver ? '#c2410c' : file ? '#047857' : '#e5e7eb',
          background: dragOver ? 'rgba(194,65,12,0.04)' : file ? '#f0fdf4' : 'white',
        }}
      >
        {file ? (
          <>
            <span className="mb-2 block text-3xl text-primary" aria-hidden="true">✓</span>
            <span className="block font-semibold text-primary">{file.name}</span>
            <span className="mt-1 block text-xs text-text-muted">{(file.size / 1024).toFixed(0)} KB · Click para cambiar</span>
          </>
        ) : (
          <>
            <span className="mb-3 block text-3xl text-text-muted" aria-hidden="true">↑</span>
            <span className="block font-medium text-foreground">Arrastrá el documento acá o hacé click</span>
            <span className="mt-1 block text-xs text-text-muted">Evaluación de desempeño, feedback 360, perfil — Solo PDF · Máx 10 MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f) }}
      />

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-border-color px-5 py-3 text-sm text-text-muted transition hover:bg-card"
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
        Continuar sin documento (el análisis se basa solo en tus respuestas)
      </button>
    </div>
  )
}

// ── Step: Analyzing ─────────────────────────────────────────────────────────

function AnalyzingScreen({ casoTipo }: { casoTipo: CaseType }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2200)
    return () => clearInterval(t)
  }, [])

  const messages =
    casoTipo === 'rendimiento'
      ? [
          'Leyendo el contexto del colaborador…',
          'Identificando el tipo de brecha…',
          'Analizando la causa raíz posible…',
          'Construyendo la guía de conversación…',
          'Preparando el plan de acción…',
        ]
      : [
          'Leyendo el perfil y la aspiración…',
          'Evaluando fortalezas y brecha real…',
          'Identificando oportunidades de desarrollo…',
          'Construyendo la guía de conversación 1:1…',
          'Diseñando el plan 70-20-10…',
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

      <h2 className="mb-3 text-xl font-semibold tracking-tight">Analizando la situación</h2>
      <p key={tick} className="ai-result text-sm text-text-muted" style={{ minHeight: '1.25rem' }}>
        {messages[tick % messages.length]}
      </p>
      <p className="mt-4 text-xs text-text-muted opacity-60">Esto puede tomar 15–30 segundos.</p>
    </div>
  )
}

// ── Step: Result ─────────────────────────────────────────────────────────────

const BRECHA_CONFIG: Record<TipoDeBrecha, { label: string; color: string; bg: string; desc: string }> = {
  Aptitud: {
    label: 'Brecha de Aptitud',
    color: '#4f46e5',
    bg: 'rgba(238,236,255,0.7)',
    desc: 'El camino pasa por capacitación, nuevos proyectos con ownership real y mentoreo técnico.',
  },
  Actitud: {
    label: 'Brecha de Actitud',
    color: '#7c3aed',
    bg: 'rgba(245,243,255,0.8)',
    desc: 'El camino pasa por conversación genuina, claridad de expectativas y rediseño de motivación.',
  },
  Mixto: {
    label: 'Brecha Mixta',
    color: '#b45309',
    bg: 'rgba(255,251,235,0.8)',
    desc: 'Hay componentes de los dos. Empezar por la motivación antes de poner el foco en las habilidades.',
  },
  Crecimiento: {
    label: 'Plan de Crecimiento',
    color: '#059669',
    bg: 'rgba(240,253,244,0.8)',
    desc: 'La persona tiene el potencial. El trabajo es construir el camino y darle la exposición que necesita.',
  },
  Movilidad: {
    label: 'Plan de Movilidad',
    color: '#0284c7',
    bg: 'rgba(240,249,255,0.8)',
    desc: 'El movimiento es hacia otra área o rol. Requiere plan de transición y gestión del reemplazo.',
  },
}

function ResultScreen({
  result,
  casoTipo,
  ctx,
  onRestart,
}: {
  result: CompanyDiagnosisResult
  casoTipo: CaseType
  ctx: CollaboratorContext
  onRestart: () => void
}) {
  const brecha = BRECHA_CONFIG[result.tipoDeBrecha] ?? BRECHA_CONFIG['Mixto']

  return (
    <div className="ai-result mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          HR Coach IA · Análisis del Colaborador
        </p>
        <h2 className="mb-1">
          {casoTipo === 'rendimiento' ? 'Diagnóstico de Rendimiento' : 'Plan de Desarrollo'}
        </h2>
        <p className="text-sm text-text-muted">
          {ctx.rol} · {ctx.seniority} · {ctx.tiempo} en el equipo
        </p>
      </div>

      <div className="flex flex-col gap-4">

        {/* Mensaje para el líder — AI tint, prominente */}
        <div className="ai-tint rounded-2xl p-6" style={{ borderLeft: '3px solid #f97316' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Para vos como líder</p>
          <p className="italic leading-relaxed text-foreground">"{result.mensajeParaElLider}"</p>
        </div>

        {/* Tipo de brecha */}
        <div className="rounded-2xl border p-5" style={{ background: brecha.bg, borderColor: brecha.color + '30' }}>
          <span
            className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: brecha.color, color: 'white' }}
          >
            {brecha.label}
          </span>
          <p className="text-sm leading-relaxed" style={{ color: brecha.color }}>{brecha.desc}</p>
        </div>

        {/* Perfil + Situación central */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Perfil del Colaborador</p>
            <p className="text-sm leading-relaxed text-text-muted">{result.perfilDelColaborador}</p>
          </div>
          <div className="card">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Situación Central</p>
            <p className="text-sm leading-relaxed text-text-muted">{result.situacionCentral}</p>
          </div>
        </div>

        {/* Fortalezas + Hipótesis */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Fortalezas del Colaborador</p>
            <ul className="space-y-2">
              {result.fortalezasDelColaborador.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 font-bold text-primary">·</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Hipótesis Principales</p>
            <ol className="space-y-3">
              {result.hipotesisPrincipales.map((h, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 shrink-0 text-sm font-semibold text-primary">{i + 1}.</span>
                  <p className="text-sm leading-relaxed text-text-muted">{h}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Guía de conversación */}
        <div className="card">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Guía de Conversación 1:1
          </p>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-accent-soft p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-accent-ink">Apertura</p>
              <p className="text-sm leading-relaxed text-accent-ink">{result.guiaDeConversacion.apertura}</p>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Preguntas Clave</p>
              <ol className="space-y-2.5">
                {result.guiaDeConversacion.preguntasClave.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-border-color bg-card p-3.5"
                  >
                    <span className="shrink-0 text-sm font-bold text-primary">{i + 1}</span>
                    <p className="text-sm leading-relaxed text-foreground">{p}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary-soft p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-primary">Cierre</p>
              <p className="text-sm leading-relaxed text-green-900">{result.guiaDeConversacion.cierre}</p>
            </div>
          </div>
        </div>

        {/* Plan de Acción 70-20-10 */}
        <div className="card">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Plan de Acción 70-20-10
          </p>
          <div className="space-y-3">
            {/* 70% */}
            <div className="rounded-xl border border-orange-100 bg-secondary p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-orange-700">
                70% — En el trabajo
              </p>
              <ul className="space-y-2">
                {result.planDeAccion.bloque70.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-orange-900">
                    <span className="mt-0.5 font-bold">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* 20% */}
            <div className="rounded-xl border border-indigo-100 bg-secondary p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                20% — De otros
              </p>
              <ul className="space-y-2">
                {result.planDeAccion.bloque20.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-indigo-900">
                    <span className="mt-0.5 font-bold">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* 10% */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">
                10% — Formación
              </p>
              <ul className="space-y-2">
                {result.planDeAccion.bloque10.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-emerald-900">
                    <span className="mt-0.5 font-bold">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Próximos pasos */}
        <div className="rounded-2xl border border-border-color bg-card p-5"
          style={{ boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Próximos Pasos — Para vos como líder
          </p>
          <ol className="space-y-3">
            {result.proximosPasos.map((paso, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: '#f97316' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-foreground">{paso}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => window.print()}
          className="rounded-xl border border-border-color px-6 py-4 text-sm text-text-muted transition hover:bg-card"
        >
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={onRestart}
          className="btn-primary flex-1 py-4 text-base"
          style={{ minWidth: 200 }}
        >
          Analizar otro colaborador →
        </button>
      </div>
    </div>
  )
}

// ── Main: CompanyFlow ────────────────────────────────────────────────────────

export function CompanyFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<CompanyStep>('intro')
  const [ctx, setCtx] = useState<CollaboratorContext | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<CompanyDiagnosisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnswer = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }))

  const handleAnalyze = async (docFile: File | null) => {
    if (!ctx) return
    setStep('analyzing')
    setError(null)
    try {
      const r = await analyzeWithGemini(ctx, answers, docFile)
      setResult(r)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setStep('upload')
    }
  }

  const handleRestart = () => {
    setCtx(null)
    setAnswers({})
    setResult(null)
    setError(null)
    setStep('intro')
  }

  const stepLabels: Partial<Record<CompanyStep, string>> = {
    context: 'Contexto',
    questions: 'Preguntas',
    upload: 'Documentación',
    analyzing: 'Analizando',
    result: 'Resultados',
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
          <span className="ml-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Empresas
          </span>
          {stepLabels[step] && (
            <span className="ml-auto text-xs text-text-muted">
              Desarrollo de Equipo · {stepLabels[step]}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        {error && (
          <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
            ⚠ {error}
          </div>
        )}

        {step === 'intro' && <IntroScreen onStart={() => setStep('context')} />}

        {step === 'context' && (
          <ContextForm
            onSubmit={(c) => { setCtx(c); setAnswers({}); setStep('questions') }}
            onBack={onBack}
          />
        )}

        {step === 'questions' && ctx && (
          <QuestionsScreen
            casoTipo={ctx.casoTipo}
            answers={answers}
            onAnswer={handleAnswer}
            onComplete={() => setStep('upload')}
            onBack={() => setStep('context')}
          />
        )}

        {step === 'upload' && (
          <DocUploadScreen
            onAnalyze={(f) => handleAnalyze(f)}
            onSkip={() => handleAnalyze(null)}
            onBack={() => setStep('questions')}
          />
        )}

        {step === 'analyzing' && ctx && <AnalyzingScreen casoTipo={ctx.casoTipo} />}

        {step === 'result' && result && ctx && (
          <ResultScreen
            result={result}
            casoTipo={ctx.casoTipo}
            ctx={ctx}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  )
}
