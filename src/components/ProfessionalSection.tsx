interface ProfessionalSectionProps {
  onStartDiagnosis: () => void
}

export default function ProfessionalSection({ onStartDiagnosis }: ProfessionalSectionProps) {
  const steps = [
    {
      number: '01',
      title: 'Diagnóstico',
      tag: '~10 min',
      description:
        'Respondés 5 preguntas con metodología GROW. La IA identifica tu tipo de freno (Aptitud, Actitud o Mixto) y te devuelve las hipótesis sobre tu situación real.',
    },
    {
      number: '02',
      title: 'Discovery',
      tag: '~8 min',
      description:
        'Exploramos los escenarios posibles, reencuadramos el obstáculo principal y construimos la decisión núcleo de tu próximo movimiento.',
    },
    {
      number: '03',
      title: 'Plan de Acción',
      tag: '~5 min',
      description:
        'Generamos un plan 70-20-10 personalizado con accionables concretos, métricas de progreso y check-in semanal. Listo para imprimir.',
    },
  ]

  const comparisons = [
    { aspecto: 'Coach humano', valor: '$100–300/sesión', icon: '✕', color: '#ef4444' },
    { aspecto: 'ChatGPT', valor: 'Sin estructura ni proceso', icon: '✕', color: '#ef4444' },
    { aspecto: 'CareerPath', valor: 'Proceso equivalente, 10x más accesible', icon: '✓', color: '#10b981' },
  ]

  return (
    <section id="profesional" className="border-t border-border-color py-16 md:py-28">
      <div className="section-container">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Para Profesionales</p>
          <h2 className="mb-4">
            Estás estancado, desmotivado<br className="hidden md:block" /> o en un quiebre de carrera.
          </h2>
          <p className="mx-auto max-w-xl text-lg text-text-muted">
            No sabés si quedarte, crecer, cambiar de empresa o girar tu carrera.
            CareerPath te da el espacio para pensarlo con estructura — sin sesgos y cuando lo necesitás.
          </p>
        </div>

        {/* Steps */}
        <div className="mb-14 grid gap-6 md:grid-cols-3">
          {steps.map((step, idx) => (
            <div key={idx} className="card">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-2xl font-bold text-primary">{step.number}</span>
                <span className="rounded-full border border-border-color px-2.5 py-0.5 text-xs text-text-muted">
                  {step.tag}
                </span>
              </div>
              <h3 className="mb-2">{step.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Comparación */}
        <div className="mb-14 grid gap-4 md:grid-cols-3">
          {comparisons.map((c) => (
            <div
              key={c.aspecto}
              className="flex items-start gap-3 rounded-2xl border p-5"
              style={{
                borderColor: c.icon === '✓' ? '#10b98130' : '#e5e7eb',
                background: c.icon === '✓' ? 'rgba(240,253,244,0.6)' : 'white',
              }}
            >
              <span className="mt-0.5 text-base font-bold" style={{ color: c.color }}>{c.icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{c.aspecto}</p>
                <p className="text-xs leading-relaxed text-text-muted">{c.valor}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA block */}
        <div className="rounded-2xl bg-foreground p-8 text-white md:p-12">
          <div className="mx-auto max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Proceso completo · 3 conversaciones
            </p>
            <h3 className="mb-3 text-white">¿Listo para encontrar claridad?</h3>
            <p className="mb-8 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Empezá con el Diagnóstico. 5 preguntas, 10 minutos, y un mapa claro de tu situación real.
            </p>
            <button
              onClick={onStartDiagnosis}
              className="rounded-xl bg-white px-8 py-3.5 font-semibold text-foreground transition-all hover:shadow-lg active:scale-95"
            >
              Empezar mi diagnóstico →
            </button>
            <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Sin registro · Sin tarjeta · Resultado inmediato
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
