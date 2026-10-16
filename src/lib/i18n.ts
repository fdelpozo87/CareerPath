import { useSyncExternalStore } from 'react'
import { DEFAULT_LANG, isLang, translate, translateN, type Key, type Lang, type Vars } from '../../shared/i18n'
import type { Stage } from '../../shared/stages'

// Idioma de la interfaz: español (neutro latinoamericano) o inglés. La elección se guarda en el
// navegador; si no hay ninguna, se usa el idioma del navegador. Los componentes llaman a tr() al
// renderizar; App se vuelve a dibujar cuando cambia el idioma, y con él todo lo de abajo.

export type { Key, Lang }

const STORAGE_KEY = 'cp_lang'
export const LANG_EVENT = 'cp:lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // Sin storage: se usa el idioma del navegador.
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LANG
}

let current: Lang = detect()
const listeners = new Set<() => void>()

export const getLang = (): Lang => current

export const tr = (key: Key, vars?: Vars): string => translate(current, key, vars)
export const trn = (base: string, n: number, vars?: Vars): string => translateN(current, base, n, vars)

/** Nombre de una etapa en el idioma actual. */
export const stageLabel = (stage: Stage): string => tr(`stage.${stage}` as Key)

/** Refleja el idioma en el documento (lector de pantalla, traductor del navegador, título de la pestaña). */
export function applyLang(): void {
  document.documentElement.lang = current
  document.title = tr('meta.title')
  document.querySelector('meta[name="description"]')?.setAttribute('content', tr('meta.description'))
}

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Sin storage: vale para esta visita.
  }
  applyLang()
  listeners.forEach((l) => l())
  window.dispatchEvent(new Event(LANG_EVENT))
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Para el componente raíz: se vuelve a renderizar cuando cambia el idioma. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang)
}
