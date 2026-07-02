export default function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="py-20 md:py-36">
      <div className="section-container text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-color bg-white px-4 py-1.5 text-xs font-medium text-text-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Powered by AI · HR Coaching metodología GROW
        </div>

        <h1 className="mb-5 max-w-3xl mx-auto leading-tight">
          Tu próximo paso de carrera,{' '}
          <span className="text-primary">pensado con vos</span>
        </h1>

        <p className="mb-12 mx-auto max-w-xl text-lg leading-relaxed text-text-muted">
          Un proceso estructurado que te lleva de la confusión a la claridad y al plan.
          Para profesionales y equipos. Disponible cuando lo necesitás.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={() => scrollTo('profesional')}
            className="btn-primary px-8 py-3.5 text-base"
          >
            Soy Profesional
          </button>
          <button
            onClick={() => scrollTo('empresa')}
            className="btn-secondary px-8 py-3.5 text-base"
          >
            Soy Empresa
          </button>
        </div>
      </div>
    </section>
  )
}
