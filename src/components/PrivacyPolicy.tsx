import { tr, type Key } from '../lib/i18n'
import LanguageToggle from './LanguageToggle'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

// Política de privacidad y términos de uso.
// BORRADOR: redactado a partir de lo que la app hace hoy con los datos. Antes
// de publicarlo debe revisarlo un/a abogado/a (Ley 25.326 de Protección de
// Datos Personales de Argentina y normativa de cada país donde se ofrezca).
// Los campos entre [corchetes] los completa el equipo.

const t = (key: string) => tr(`privacy.${key}` as Key)

/** Un ítem con parte en negrita: el texto va en dos claves (<base>.strong y <base>.rest). */
function Item({ base }: { base: string }) {
  return (
    <li>
      <strong className="text-foreground">{t(`${base}.strong`)}</strong>
      {t(`${base}.rest`)}
    </li>
  )
}

export default function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="border-b border-border-color bg-background">
        <div className="section-container flex items-center gap-4 py-4">
          <button onClick={onBack} className="text-sm text-text-muted transition-colors hover:text-foreground">
            {tr('common.back')}
          </button>
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="section-container max-w-3xl flex-1 py-12">
        <article className="space-y-8 text-sm leading-relaxed text-foreground [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text-muted [&_li]:text-text-muted">
          <header>
            <h1 className="mb-2 text-3xl">{t('title')}</h1>
            <p className="text-xs">{tr('privacy.updated', { date: t('date') })}</p>
            <p className="mt-2 rounded-xl border border-border-color bg-secondary p-3 text-xs">{t('draft')}</p>
          </header>

          <section>
            <h2>{t('s1.title')}</h2>
            <ul className="space-y-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <li key={n}>{t(`s1.${n}`)}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>{t('s2.title')}</h2>
            <p>{t('s2.body')}</p>
          </section>

          <section>
            <h2>{t('s3.title')}</h2>
            <ul className="space-y-2">
              {['a', 'b', 'c', 'd'].map((x) => (
                <Item key={x} base={`s3.${x}`} />
              ))}
            </ul>
          </section>

          <section>
            <h2>{t('s4.title')}</h2>
            <p>{t('s4.intro')}</p>
            <ul className="mt-2 space-y-1">
              {['g', 'v', 's'].map((x) => (
                <Item key={x} base={`s4.${x}`} />
              ))}
            </ul>
            <p className="mt-2">{t('s4.outside')}</p>
          </section>

          <section>
            <h2>{t('s5.title')}</h2>
            <p>{t('s5.body')}</p>
          </section>

          <section>
            <h2>{t('s6.title')}</h2>
            <p>{t('s6.body')}</p>
          </section>

          <section>
            <h2>{t('s7.title')}</h2>
            <ul className="space-y-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <li key={n}>{t(`s7.${n}`)}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>{t('s8.title')}</h2>
            <p>{t('s8.body')}</p>
          </section>
        </article>
      </main>
    </div>
  )
}
