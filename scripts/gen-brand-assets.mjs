// Genera con Chrome (sin cabeza) los archivos de la marca que no se pueden escribir a mano:
//   public/favicon.svg, icon-192.png, icon-512.png, apple-touch-icon.png,
//   public/email/logo.png (símbolo + palabra, para los mails) y public/og-image.png / og-image-en.png (al compartir el enlace).
// Usa las tipografías del proyecto (node_modules/@fontsource-variable) y los colores de src/index.css.
//
//   npm run brand            (usa Chrome de macOS; en otro sistema: CHROME=/ruta/a/chrome npm run brand)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PUBLIC = resolve('public')
const FONTS = resolve('node_modules/@fontsource-variable')
const font = (pkg, file) => pathToFileURL(join(FONTS, pkg, 'files', file)).href

const C = { primary: '#6a3fc1', primaryDark: '#3e2280', lila: '#e9e2fa', accent: '#f28c38', ink: '#1f1533', bruma: '#faf9fc' }

const fontFaces = `
@font-face{font-family:'DM Sans Variable';font-weight:100 1000;src:url('${font('dm-sans', 'dm-sans-latin-wght-normal.woff2')}') format('woff2-variations')}
@font-face{font-family:'Plus Jakarta Sans Variable';font-weight:200 800;src:url('${font('plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2')}') format('woff2-variations')}
*{box-sizing:border-box;margin:0}
body{font-family:'DM Sans Variable',system-ui,sans-serif}`

/** El símbolo: un trazo que sube, se curva y sigue hasta un punto. Mismo dibujo que src/components/Logo.tsx. */
const mark = (stroke, dot, size) =>
  `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><path d="M7 37c3-8 8-13 14-9 4 3 5 8 9 8 5 0 8-6 8-15" fill="none" stroke="${stroke}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="10" r="4.5" fill="${dot}"/></svg>`

/** La palabra "bivio" con los puntos de las dos "i" dibujados aparte (violeta y mandarina). */
const wordmark = (color, dot1, size) => {
  const i = (c) => `<span style="position:relative;display:inline-block">ı<span style="position:absolute;left:50%;top:.1em;width:.2em;height:.2em;border-radius:50%;background:${c};transform:translateX(-50%)"></span></span>`
  return `<span style="font-size:${size}px;line-height:1;color:${color};letter-spacing:-.02em">b${i(dot1)}v${i(C.accent)}o</span>`
}

const page = (w, h, body, bg = 'transparent') => `<!doctype html><meta charset="utf-8"><style>${fontFaces}html,body{width:${w}px;height:${h}px;background:${bg};overflow:hidden}</style>${body}`

const tmp = mkdtempSync(join(tmpdir(), 'bivio-brand-'))
let n = 0
function shot(file, w, h, body, { bg = 'transparent' } = {}) {
  const html = join(tmp, `p${n++}.html`)
  writeFileSync(html, page(w, h, body, bg))
  execFileSync(CHROME, [
    '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, `--default-background-color=${bg === 'transparent' ? '00000000' : 'ffffffff'}`,
    `--screenshot=${join(PUBLIC, file)}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' })
  console.log('✓', file, `${w}×${h}`)
}

// Favicon: vectorial, claro y oscuro.
writeFileSync(
  join(PUBLIC, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <title>Bivio</title>
  <style>
    .t { stroke: ${C.primary}; }
    @media (prefers-color-scheme: dark) { .t { stroke: #b79cf2; } }
  </style>
  <path class="t" d="M7 37c3-8 8-13 14-9 4 3 5 8 9 8 5 0 8-6 8-15" fill="none" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="38" cy="10" r="4.5" fill="${C.accent}"/>
</svg>
`,
)
console.log('✓ favicon.svg')

// Íconos de la app: baldosa violeta con el símbolo en blanco (entra en la zona segura de los íconos "maskable").
for (const [file, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  const m = Math.round(size * 0.62)
  shot(file, size, size, `<div style="width:${size}px;height:${size}px;background:${C.primary};display:flex;align-items:center;justify-content:center">${mark('#ffffff', C.accent, m)}</div>`, { bg: C.primary })
}

// Logo de los mails (se muestra a 148×40; se genera al triple para pantallas nítidas).
shot('email/logo.png', 444, 120, `<div style="height:120px;display:flex;align-items:center;gap:20px">${mark(C.primary, C.accent, 108)}${wordmark(C.ink, C.primary, 88)}</div>`)

// Imágenes para compartir el enlace (WhatsApp, LinkedIn, Slack, X).
const og = { es: ['Tu próximo paso de carrera, pensado contigo', 'Coach de carrera con IA para profesionales y empresas'], en: ['Your next career step, designed with you', 'An AI career coach for professionals and companies'] }
for (const [lang, [title, sub]] of Object.entries(og)) {
  const fork = `<svg viewBox="0 0 240 120" width="420" height="210" style="position:absolute;right:48px;bottom:56px">
    <path d="M20 96 C60 96 80 64 112 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 12"><path d="M112 60 C150 56 170 24 214 22"/><path d="M112 60 C150 64 176 92 214 96"/><path d="M112 60 L214 60"/></g>
    <g fill="${C.lila}"><circle cx="214" cy="22" r="6"/><circle cx="214" cy="60" r="6"/><circle cx="214" cy="96" r="6"/></g>
    <circle cx="112" cy="60" r="20" fill="${C.accent}" opacity=".28"/><circle cx="112" cy="60" r="12" fill="${C.accent}"/></svg>`
  shot(
    lang === 'es' ? 'og-image.png' : 'og-image-en.png', 1200, 630,
    `<div style="position:relative;width:1200px;height:630px;background:${C.primary};color:#fff;padding:64px 72px">
      <div style="display:flex;align-items:center;gap:18px">${mark('#ffffff', C.accent, 72)}${wordmark('#ffffff', '#ffffff', 64)}</div>
      <h1 style="position:absolute;left:72px;top:210px;width:700px;font:700 68px/1.1 'Plus Jakarta Sans Variable',sans-serif;letter-spacing:-.025em">${title}</h1>
      <p style="position:absolute;left:72px;bottom:64px;width:600px;font-size:30px;line-height:1.35;color:${C.lila}">${sub}</p>
      ${fork}
    </div>`,
    { bg: C.primary },
  )
}
