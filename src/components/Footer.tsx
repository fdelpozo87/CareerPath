import { tr } from '../lib/i18n'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="border-t border-border-color py-10 md:py-14">
      <div className="section-container">
        <div className="mb-10 grid gap-8 text-sm md:grid-cols-3">
          <div>
            <Logo className="mb-3" />
            <p className="text-text-muted">{tr('footer.tagline')}</p>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">{tr('footer.links')}</p>
            <ul className="space-y-2 text-text-muted">
              <li><a href="#" className="transition-colors hover:text-foreground">{tr('footer.home')}</a></li>
              <li><a href="#profesional" className="transition-colors hover:text-foreground">{tr('nav.professionals')}</a></li>
              <li><a href="#empresa" className="transition-colors hover:text-foreground">{tr('nav.companies')}</a></li>
              <li><a href="#privacidad" className="transition-colors hover:text-foreground">{tr('footer.privacy')}</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-medium text-foreground">{tr('footer.rubika')}</p>
            <ul className="space-y-2 text-text-muted">
              <li>
                <a href="https://rubikanetworking.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                  {tr('footer.web')}
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/company/rubika-networking" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                  {tr('footer.linkedin')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border-color pt-5 text-center text-xs text-text-muted">{tr('footer.copyright')}</div>
      </div>
    </footer>
  )
}
