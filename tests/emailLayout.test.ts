import { describe, expect, it } from 'vitest'
import { renderEmailHtml, renderEmailText } from '../shared/emailLayout'

const base = { heading: 'Hola <b>', paragraphs: ['Uno & dos'], cta: { label: 'Entrar', url: 'https://app.test/x?a=1&b=2' }, note: 'Copia el enlace', footer: 'Pie' }

describe('diseño de los emails', () => {
  it('escapa el texto, lleva el logo desde la URL de assets y el botón con la URL', () => {
    const html = renderEmailHtml([base], 'https://app.test')
    expect(html).toContain('Hola &lt;b&gt;')
    expect(html).toContain('Uno &amp; dos')
    expect(html).toContain('https://app.test/email/logo.png')
    expect(html).toContain('https://app.test/x?a=1&amp;b=2')
    expect(html).not.toContain('<b>')
  })

  it('con varios bloques (idiomas) los muestra todos', () => {
    const html = renderEmailHtml([base, { ...base, heading: 'Second' }], 'https://app.test')
    expect(html).toContain('Second')
    expect(html).toContain('Hola')
  })

  it('la versión en texto trae título, enlace y pie', () => {
    const text = renderEmailText([base])
    expect(text).toContain('Hola <b>')
    expect(text).toContain('https://app.test/x?a=1&b=2')
    expect(text).toContain('Pie')
  })
})
