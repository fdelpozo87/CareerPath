import { useEffect, useState } from 'react'
import { THEME_EVENT, getThemeMode, resolveTheme, setThemeMode } from '../lib/theme'

// Botón de sol/luna para pasar de modo claro a oscuro. Muestra la acción que va a hacer: la luna
// en modo claro (para oscurecer) y el sol en modo oscuro (para aclarar).

const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...icon}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...icon}>
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  )
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => resolveTheme(getThemeMode()))

  // Se actualiza también cuando el tema cambia por otro lado (el sistema, otra pestaña de la app).
  useEffect(() => {
    const sync = () => setTheme(resolveTheme(getThemeMode()))
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const dark = theme === 'dark'
  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <button
      type="button"
      onClick={() => setThemeMode(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-color bg-card text-foreground transition-colors hover:bg-secondary"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
