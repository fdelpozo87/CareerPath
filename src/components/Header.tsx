import AccountMenu, { type AccountInfo } from './AccountMenu'
import { tr } from '../lib/i18n'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

export default function Header({ account }: { account: AccountInfo }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm">
      <div className="section-container flex items-center justify-between py-4">
        <Logo />
        <div className="flex items-center gap-8">
          <nav className="hidden gap-8 md:flex">
            <a href="#profesional" className="text-sm text-text-muted transition-colors hover:text-foreground">
              {tr('nav.professionals')}
            </a>
            <a href="#empresa" className="text-sm text-text-muted transition-colors hover:text-foreground">
              {tr('nav.companies')}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <AccountMenu account={account} />
          </div>
        </div>
      </div>
    </header>
  )
}
