// Traducción compartida entre el navegador y el servidor. Los textos viven en
// shared/locales/{es,en}.json y se compilan con `node scripts/gen-i18n.mjs`.

import { en, es, type Key } from './locales/dictionaries.js'

export type { Key }
export type Lang = 'es' | 'en'
export const LANGS: readonly Lang[] = ['es', 'en']
export const DEFAULT_LANG: Lang = 'es'

export type Vars = Record<string, string | number>

export const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en'

function fill(text: string, vars?: Vars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text
}

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const dict: Record<string, string> = lang === 'en' ? en : es
  return fill(dict[key] ?? key, vars)
}

/** Plural simple: busca `${base}.one` (n === 1) o `${base}.other`. Siempre expone {n}. */
export function translateN(lang: Lang, base: string, n: number, vars?: Vars): string {
  return translate(lang, `${base}.${n === 1 ? 'one' : 'other'}` as Key, { n, ...vars })
}
