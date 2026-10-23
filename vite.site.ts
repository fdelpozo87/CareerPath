import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

// Datos de la web para buscadores, redes e IA: la URL pública se toma del entorno para que, el día que haya dominio propio,
// alcance con definir SITE_URL (sin tocar archivos). Sin eso, se usa la que da Vercel y, por último, la actual.
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.SITE_URL ?? (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://career-path-ruby.vercel.app')
  return raw.replace(/\/+$/, '')
}

export const robotsTxt = (site: string) => `# Bivio: la portada y la política de privacidad son públicas; la API y las cuentas no.
User-agent: *
Allow: /
Disallow: /api/

# Los asistentes de IA pueden leer y citar la portada.
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${site}/sitemap.xml
`

export const LANGS = ['es', 'en'] as const
type L = (typeof LANGS)[number]

export const sitemapXml = (site: string) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(
  (l) => `  <url>
    <loc>${site}/${l}/</loc>
${LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${site}/${a}/"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site}/es/"/>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`,
).join('\n')}
</urlset>
`

export const llmsTxt = (site: string) => `# Bivio

> Bivio es un coach de carrera con IA, en español e inglés, para profesionales y empresas. Acompaña con una conversación guiada (preguntas, no veredictos) para decidir el próximo paso de carrera, y ayuda a las empresas a armar evaluaciones de desempeño con competencias y preguntas sobre hechos concretos.
> Bivio is an AI career coach, in Spanish and English, for professionals and companies: a guided conversation (questions, not verdicts) to decide the next career step, and performance evaluations for companies.

## Qué ofrece / What it offers

- Para profesionales: tres caminos de conversación guiada (sentirse estancado/a, explorar el mercado empezando por el perfil, decidir qué estudiar) que terminan en un informe con compromisos.
- Para empresas: evaluaciones de desempeño asignadas por email, con autoevaluación, puntaje de 1 a 5 por competencia de quien evalúa e informe.
- Privacidad: se puede usar sin cuenta; los datos se pueden descargar y borrar desde el menú de la cuenta.

## Enlaces / Links

- [Bivio en español](${site}/es/): los tres caminos y cómo empezar.
- [Bivio in English](${site}/en/): the three paths and how to start.
- [Política de privacidad](${site}/es/#privacidad) · [Privacy policy](${site}/en/#privacidad)
`

const STATIC: Record<L, { h1: string; lede: string; noscript: string; ogLocale: string; ogAlt: string; ogImage: string }> = {
  es: {
    h1: 'Tu próximo paso de carrera, pensado contigo',
    lede: 'Coach de carrera con IA para profesionales y empresas. Una conversación guiada, con preguntas y sin veredictos, para decidir qué sigue.',
    noscript: 'Bivio necesita JavaScript para funcionar. Actívalo en tu navegador y recarga la página.',
    ogLocale: 'es_AR',
    ogAlt: 'Bivio: tu próximo paso de carrera, pensado contigo',
    ogImage: 'og-image.png',
  },
  en: {
    h1: 'Your next career step, designed with you',
    lede: 'An AI career coach for professionals and companies. A guided conversation, with questions and no verdicts, to decide what comes next.',
    noscript: 'Bivio needs JavaScript to work. Turn it on in your browser and reload the page.',
    ogLocale: 'en_US',
    ogAlt: 'Bivio: your next career step, designed with you',
    ogImage: 'og-image-en.png',
  },
}

const escAttr = (v: string) => v.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

/** La portada de un idioma lista para publicar: título, descripción, etiquetas y contenido en el HTML inicial. */
export function renderPage(template: string, lang: L, site: string): string {
  const dict = JSON.parse(readFileSync(new URL(`./shared/locales/${lang}.json`, import.meta.url), 'utf-8')) as Record<string, string>
  const t = STATIC[lang]
  const other = LANGS.find((l) => l !== lang)!
  const main = `<main style="max-width:44rem;margin:0 auto;padding:4rem 1.5rem;font-family:'Hanken Grotesk',system-ui,sans-serif;line-height:1.6">
        <p><strong>Bivio</strong></p>
        <h1 style="font-family:Fraunces,Georgia,serif;font-weight:500;line-height:1.15">${t.h1}</h1>
        <p>${t.lede}</p>
        <ul>
          <li>${dict['landing.pathA.title']}</li>
          <li>${dict['landing.pathB.title']}</li>
          <li>${dict['landing.pathC.title']}</li>
        </ul>
        <p><a href="/${other}/">${other === 'en' ? 'English' : 'Español'}</a></p>
        <noscript><p>${t.noscript}</p></noscript>
      </main>`
  return template
    .replaceAll('__STATIC__', main)
    .replaceAll('__LANG__', lang)
    .replaceAll('__TITLE__', escAttr(dict['meta.title']))
    .replaceAll('__DESCRIPTION__', escAttr(dict['meta.description']))
    .replaceAll('__OG_LOCALE__', t.ogLocale)
    .replaceAll('__OG_LOCALE_ALT__', STATIC[other].ogLocale)
    .replaceAll('__OG_ALT__', escAttr(t.ogAlt))
    .replaceAll('__OG_IMAGE__', t.ogImage)
    .replaceAll('__SITE_URL__', site)
}

/**
 * Publica robots.txt, sitemap.xml y llms.txt con la URL real, y una portada estática por idioma (/es/ y /en/):
 * cada una con su título, su descripción, su canonical y los hreflang. "/" sigue sirviendo la versión en español
 * (la app la lleva al idioma que corresponda) y las demás rutas caen a esa misma portada.
 */
export function sitePlugin(): Plugin {
  const site = siteUrl()
  let template = ''
  let outDir = 'dist'
  return {
    name: 'bivio-site',
    configResolved: (c) => {
      outDir = resolve(c.root, c.build.outDir)
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        template = html
        return renderPage(html, 'es', site)
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(site) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(site) })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(site) })
    },
    closeBundle() {
      if (!template) return
      for (const lang of LANGS) {
        mkdirSync(resolve(outDir, lang), { recursive: true })
        writeFileSync(resolve(outDir, lang, 'index.html'), renderPage(template, lang, site))
      }
    },
  }
}
