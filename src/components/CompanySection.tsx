export default function CompanySection({ onStart }: { onStart?: () => void }) {
  const useCases = [
    {
      icon: '↘',
      title: 'Bajo rendimiento',
      desc: 'Diagnóstico Aptitud/Actitud y guía de conversación 1:1 para reencauzar a un colaborador.',
      color: '#ef4444',
      bg: 'rgba(254,242,242,0.6)',
    },
    {
      icon: '↗',
      title: 'Crecimiento y movilidad',
      desc: 'Plan de desarrollo 70-20-10 y conversación de carrera para el próximo nivel o el cambio de área.',
      color: '#10b981',
      bg: 'rgba(240,253,244,0.6)',
    },
  ]

  const outputs = [
    'Diagnóstico del tipo de brecha (Aptitud / Actitud / Crecimiento)',
    '3 hipótesis sobre la causa raíz real',
    'Guía de conversación 1:1 con preguntas potentes listas para usar',
    'Plan de Acción 70-20-10 personalizado',
    'Próximos pasos concretos para vos como líder',
  ]

  const comparisons = [
    { aspecto: 'Coach externo', valor: '$100–300/sesión por colaborador', icon: '✕' },
    { aspecto: 'Herramientas genéricas', valor: 'Sin contexto real del colaborador', icon: '✕' },
    { aspecto: 'CareerPath B2B', valor: 'Proceso equivalente, escalable, sin costo marginal', icon: '✓' },
  ]

  return (
    <section id="empresa" className="border-t border-border-color py-16 md:py-28">
      <div className="section-container">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary-ink">Para Empresas</p>
          <h2 className="mb-4">
            Escalá el desarrollo de tu equipo<br className="hidden md:block" /> sin escalar la estructura.
          </h2>
          <p className="mx-auto max-w-xl text-lg text-text-muted">
            Una herramienta para líderes y RRHH que convierte contexto real del colaborador
            en diagnóstico accionable y guía de conversación — en minutos.
          </p>
        </div>

        {/* Use cases */}
        <div className="mb-10 grid gap-5 md:grid-cols-2">
          {useCases.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border p-6"
              style={{ borderColor: c.color + '30', background: c.bg }}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-xl font-bold" style={{ color: c.color }}>{c.icon}</span>
                <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-text-muted">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="card mb-10">
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Qué genera la IA en cada análisis
          </p>
          <ul className="space-y-3">
            {outputs.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-0.5 font-bold text-primary-ink">→</span>
                {item}
              </li>
            ))}
          </ul>
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
              <span
                className="mt-0.5 text-base font-bold"
                style={{ color: c.icon === '✓' ? '#10b981' : '#ef4444' }}
              >
                {c.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{c.aspecto}</p>
                <p className="text-xs leading-relaxed text-text-muted">{c.valor}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA block */}
        <div
          className="rounded-2xl border border-border-color bg-white p-8 md:p-12"
          style={{ boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
        >
          <div className="mx-auto max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary-ink">
              Fase 1 · Sin integración requerida
            </p>
            <h3 className="mb-3">Probalo ahora con un caso real</h3>
            <p className="mb-8 text-text-muted">
              Describís la situación de un colaborador. Podés subir la evaluación de desempeño como contexto adicional.
              En menos de 10 minutos tenés el diagnóstico y la guía lista para tu próxima 1:1.
            </p>
            <button className="btn-primary px-8 py-3.5 text-base" onClick={onStart}>
              Empezar análisis de equipo →
            </button>
            <p className="mt-4 text-xs text-text-muted">
              Sin registro · Evaluación de desempeño opcional (PDF) · Resultado inmediato
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
