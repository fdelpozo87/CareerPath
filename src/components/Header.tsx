export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm">
      <div className="section-container flex items-center justify-between py-4">
        <div className="text-xl font-semibold tracking-tight text-foreground">
          Career<span className="text-primary-ink">Path</span>
        </div>
        <nav className="hidden gap-8 md:flex">
          <a href="#profesional" className="text-sm text-text-muted transition-colors hover:text-foreground">
            Para Profesionales
          </a>
          <a href="#empresa" className="text-sm text-text-muted transition-colors hover:text-foreground">
            Para Empresas
          </a>
        </nav>
      </div>
    </header>
  )
}
