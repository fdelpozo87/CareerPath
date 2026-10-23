import { describe, expect, it } from 'vitest'
import { hasAuthParams, langFromPath, pathForLang } from '../shared/langPath'
import { renderPage, sitemapXml } from '../vite.site'

describe('idioma en la URL', () => {
  it('lee el idioma del primer tramo de la ruta', () => {
    expect(langFromPath('/en/')).toBe('en')
    expect(langFromPath('/es')).toBe('es')
    expect(langFromPath('/en/algo')).toBe('en')
    expect(langFromPath('/')).toBeNull()
    expect(langFromPath('/english')).toBeNull()
    expect(langFromPath('/x/en/')).toBeNull()
  })

  it('cambia el idioma de la ruta sin perder el resto', () => {
    expect(pathForLang('/', 'en')).toBe('/en/')
    expect(pathForLang('/es/', 'en')).toBe('/en/')
    expect(pathForLang('/en', 'es')).toBe('/es/')
    expect(pathForLang('/en/algo', 'es')).toBe('/es/algo')
    expect(pathForLang('/english', 'es')).toBe('/es/english')
  })

  it('no toca la dirección de un enlace de acceso hasta leerlo', () => {
    expect(hasAuthParams('', '#access_token=abc&type=magiclink')).toBe(true)
    expect(hasAuthParams('?code=abc', '')).toBe(true)
    expect(hasAuthParams('', '#error_description=expired')).toBe(true)
    expect(hasAuthParams('', '#privacidad')).toBe(false)
    expect(hasAuthParams('?utm=1', '#admin')).toBe(false)
  })
})

describe('páginas por idioma y sitemap', () => {
  const tpl = '<html lang="__LANG__"><title>__TITLE__</title><link href="__SITE_URL__/__LANG__/"><div id="root">__STATIC__</div></html>'

  it('cada versión sale con su idioma, título y contenido, sin marcas sueltas', () => {
    const en = renderPage(tpl, 'en', 'https://x.test')
    expect(en).toContain('lang="en"')
    expect(en).toContain('<title>Bivio - Your next career step</title>')
    expect(en).toContain('https://x.test/en/')
    expect(en).toContain('Your next career step, designed with you')
    expect(en).not.toMatch(/__[A-Z_]+__/)
    expect(renderPage(tpl, 'es', 'https://x.test')).toContain('Tu próximo paso de carrera, pensado contigo')
  })

  it('el sitemap lista las dos versiones con sus alternativas', () => {
    const xml = sitemapXml('https://x.test')
    expect(xml).toContain('<loc>https://x.test/es/</loc>')
    expect(xml).toContain('<loc>https://x.test/en/</loc>')
    expect(xml).toContain('hreflang="en" href="https://x.test/en/"')
    expect(xml).toContain('hreflang="x-default"')
  })
})
