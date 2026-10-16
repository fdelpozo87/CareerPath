import { tr, type Key } from '../lib/i18n'

export default function CompanySection({ onStart }: { onStart?: () => void }) {
  const useCases = [
    {
      icon: '↘',
      title: tr('company.uc1.title'),
      desc: tr('company.uc1.desc'),
      color: '#ef4444',
      bg: 'color-mix(in srgb, #ef4444 12%, var(--color-card))',
    },
    {
      icon: '↗',
      title: tr('company.uc2.title'),
      desc: tr('company.uc2.desc'),
      color: '#10b981',
      bg: 'color-mix(in srgb, #10b981 12%, var(--color-card))',
    },
  ]

  const outputs = [1, 2, 3, 4, 5].map((n) => tr(`company.out.${n}` as Key))

  const comparisons = [
    { aspecto: tr('company.cmp.1.title'), valor: tr('company.cmp.1.body'), icon: '✕' },
    { aspecto: tr('company.cmp.2.title'), valor: tr('company.cmp.2.body'), icon: '✕' },
    { aspecto: tr('company.cmp.3.title'), valor: tr('company.cmp.3.body'), icon: '✓' },
  ]

  return (
    <section id="empresa" className="border-t border-border-color py-16 md:py-28">
      <div className="section-container">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{tr('company.eyebrow')}</p>
          <h2 className="mb-4">
            {tr('company.title')}
          </h2>
          <p className="mx-auto max-w-xl text-lg text-text-muted">
            {tr('company.lede')}
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
            {tr('company.out.title')}
          </p>
          <ul className="space-y-3">
            {outputs.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-0.5 font-bold text-primary">→</span>
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
                borderColor: c.icon === '✓' ? '#10b98130' : 'var(--color-border-color)',
                background: c.icon === '✓' ? 'color-mix(in srgb, #10b981 12%, var(--color-card))' : 'var(--color-card)',
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
          className="rounded-2xl border border-border-color bg-card p-8 md:p-12"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <div className="mx-auto max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              {tr('company.cta.eyebrow')}
            </p>
            <h3 className="mb-3">{tr('company.cta.title')}</h3>
            <p className="mb-8 text-text-muted">
              {tr('company.cta.body')}
            </p>
            <button className="btn-primary px-8 py-3.5 text-base" onClick={onStart}>
              {tr('company.cta.button')}
            </button>
            <p className="mt-4 text-xs text-text-muted">
              {tr('company.cta.note')}
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
