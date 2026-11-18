import AccountMenu, { type AccountInfo } from './AccountMenu'
import { tr } from '../lib/i18n'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

export default function Header({ account, areas, onCompany }: { account: AccountInfo; areas?: { profesionales: boolean; empresas: boolean }; onCompany?: () => void }) {
  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-2">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-border-color/70 bg-background/88 px-5 py-3 shadow-[0_4px_20px_-6px_rgb(31_21_51/0.12)] backdrop-blur-md">
        <Logo />
        <div className="flex items-center gap-8">
          <nav className="hidden gap-8 md:flex">
            {areas?.profesionales !== false && (
              <a href="#profesional" className="text-sm text-text-muted transition-colors hover:text-foreground">
                {tr('nav.professionals')}
              </a>
            )}
            {onCompany
              ? <button type="button" onClick={onCompany} className="text-sm text-text-muted transition-colors hover:text-foreground">{tr('nav.companies')}</button>
              : <a href="#empresa" className="text-sm text-text-muted transition-colors hover:text-foreground">{tr('nav.companies')}</a>
            }
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
