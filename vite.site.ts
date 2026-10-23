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

export const sitemapXml = (site: string) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

export const llmsTxt = (site: string) => `# Bivio

> Bivio es un coach de carrera con IA, en español e inglés, para profesionales y empresas. Acompaña con una conversación guiada (preguntas, no veredictos) para decidir el próximo paso de carrera, y ayuda a las empresas a armar evaluaciones de desempeño con competencias y preguntas sobre hechos concretos.

## Qué ofrece

- Para profesionales: tres caminos de conversación guiada (sentirse estancado/a, explorar el mercado empezando por el perfil, decidir qué estudiar) que terminan en un informe con compromisos.
- Para empresas: evaluaciones de desempeño asignadas por email, con autoevaluación, puntaje de 1 a 5 por competencia de quien evalúa e informe.
- Privacidad: se puede usar sin cuenta; los datos se pueden descargar y borrar desde el menú de la cuenta.

## Enlaces

- [Portada](${site}/): los tres caminos y cómo empezar.
- [Política de privacidad](${site}/#privacidad): qué datos se tratan y cómo se borran.
`

/** Reemplaza __SITE_URL__ en index.html y publica robots.txt, sitemap.xml y llms.txt con la URL real. */
export function sitePlugin(): Plugin {
  const site = siteUrl()
  return {
    name: 'bivio-site',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', site),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(site) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(site) })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(site) })
    },
  }
}
