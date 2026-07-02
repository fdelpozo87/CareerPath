export default function Footer() {
  return (
    <footer className="border-t border-border-color py-10 md:py-14">
      <div className="section-container">
        <div className="mb-10 grid gap-8 text-sm md:grid-cols-3">
          <div>
            <div className="mb-3 text-base font-semibold tracking-tight text-foreground">
              Career<span className="text-primary">Path</span>
            </div>
            <p className="text-text-muted">Tu próximo paso de carrera, pensado con vos.</p>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">Links</p>
            <ul className="space-y-2 text-text-muted">
              <li><a href="#" className="transition-colors hover:text-foreground">Inicio</a></li>
              <li><a href="#profesional" className="transition-colors hover:text-foreground">Para Profesionales</a></li>
              <li><a href="#empresa" className="transition-colors hover:text-foreground">Para Empresas</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">Rubika</p>
            <ul className="space-y-2 text-text-muted">
              <li>
                <a href="https://rubikanetworking.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                  Web
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/company/rubika-networking" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border-color pt-5 text-center text-xs text-text-muted">
          © 2026 CareerPath by Rubika Networking. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}
