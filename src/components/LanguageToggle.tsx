import { LANGS } from '../../shared/i18n'
import { setLang, tr, useLang, type Key } from '../lib/i18n'

// Selector de idioma: dos botones (ES · EN) con el activo resaltado. Cada nombre de idioma se
// escribe en su propio idioma (para quien no entiende el actual) y lleva su atributo lang.

export default function LanguageToggle() {
  const lang = useLang()
  return (
    <div role="group" aria-label={tr('lang.label')} className="flex h-10 shrink-0 items-center rounded-full border border-border-color bg-card p-1">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          aria-label={tr(`lang.${l}` as Key)}
          title={tr(`lang.${l}` as Key)}
          onClick={() => setLang(l)}
          className={`h-8 min-w-9 rounded-full px-2 text-xs font-semibold transition-colors ${
            lang === l ? 'bg-primary text-on-primary' : 'text-text-muted hover:text-foreground'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
