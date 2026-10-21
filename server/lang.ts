import type { Lang } from '../shared/i18n.js'

// El modelo a veces sigue el idioma del historial en vez del que se le pidió. Antes de entregar una
// respuesta se comprueba con una heurística simple (palabras muy comunes de cada idioma) y, si salió
// en el idioma equivocado, se reintenta una vez.

const ES = /\b(el|la|los|las|que|qué|de|del|para|con|por|una|un|tu|te|es|en|cómo|lo|se|pero|más|sobre|hoy|aquí|cuéntame)\b/gi
const EN = /\b(the|and|you|your|to|of|is|are|for|with|that|this|what|how|it|in|on|be|about|today|here|tell)\b/gi

export function wrongLanguage(text: string, lang: Lang): boolean {
  if (text.trim().length < 25) return false // demasiado corto para decidir
  const es = text.match(ES)?.length ?? 0
  const en = text.match(EN)?.length ?? 0
  return lang === 'en' ? es >= 3 && es > en : en >= 3 && en > es
}

/**
 * Red de seguridad contra las dos formas con género que el modelo suelta por costumbre cuando todavía no
 * sabe nada de la persona: el "Bienvenida" del saludo y el "juntas/juntos". Solo para español.
 */
export function neutralizeGender(text: string, lang: Lang): string {
  if (lang !== 'es') return text
  return text
    .replace(/^\s*¡?bienvenid[ao]s?\s*[,.!]?\s*(.)/i, (_m, c: string) => `Hola. ${c.toUpperCase()}`)
    .replace(/(?<![\p{L}])juntas(?![\p{L}])|(?<![\p{L}])juntos(?![\p{L}])/giu, 'en conjunto')
}
