// Apariencia del sitio: claro, oscuro o automático (el del sistema). La elección se guarda en el
// navegador; se aplica como data-theme en <html> (los colores viven en src/index.css). El mismo
// criterio corre antes del primer dibujado, en index.html, para evitar un destello claro.

export type ThemeMode = 'light' | 'dark' | 'auto'

/** Se dispara cada vez que cambia el tema aplicado, para que los botones se actualicen. */
export const THEME_EVENT = 'cp:theme'

const KEY = 'cp_theme'
// Color de la barra del navegador en el celular.
const THEME_COLOR = { light: '#6a3fc1', dark: '#150e24' } as const

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

export function applyTheme(mode: ThemeMode = getThemeMode()): void {
  const theme = resolveTheme(mode)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    // Sin storage: la elección vale para esta visita.
  }
  applyTheme(mode)
}

/** En "automático", acompaña los cambios del sistema (por ejemplo, el modo nocturno del celular). */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== 'function') return
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'auto') applyTheme('auto')
  })
}
