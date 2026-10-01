import { createHash, timingSafeEqual } from 'node:crypto'

// Acceso de prueba por código de invitación.
//
// Mientras la app se prueba fuera de local, nadie debería poder usar la API de
// Gemini (y gastar su cuota) sin invitación. ACCESS_CODES define quién entra:
//
//   ACCESS_CODES=ana:K7QM-X2PD-9RTA,luis:H4WZ-3NCB-6YEF
//
// "ana" es una etiqueta para identificar el uso en los logs (sin datos
// personales); lo que va después de ":" es el código que se le entrega.
// Para revocar a alguien se borra su entrada y se redeploya.
//
// Reglas:
// - Producción (Vercel) sin ACCESS_CODES → la API NO responde (falla cerrada):
//   un deploy sin configurar nunca queda abierto por descuido.
// - Local, sin ACCESS_CODES → sin acceso restringido, como siempre.
// - Los códigos se comparan por hash y en tiempo constante.

interface Tester {
  label: string
  hash: Buffer
}

/** Mayúsculas y sin separadores: "k7qm x2pd-9rta" == "K7QMX2PD9RTA". */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

const sha = (s: string) => createHash('sha256').update(s).digest()

function readTesters(): Tester[] {
  return (process.env.ACCESS_CODES ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry, i) => {
      const sep = entry.indexOf(':')
      const label = (sep > 0 ? entry.slice(0, sep) : `tester${i + 1}`).trim().slice(0, 40)
      const code = normalizeCode(sep > 0 ? entry.slice(sep + 1) : entry)
      // Un código corto sería adivinable: se descarta en vez de aceptarlo.
      return code.length >= 8 ? [{ label, hash: sha(code) }] : []
    })
}

export type AccessState =
  | { mode: 'open' }
  | { mode: 'unconfigured' }
  | { mode: 'gated'; check: (code: string | undefined) => string | null }

export function accessState(): AccessState {
  const testers = readTesters()
  if (testers.length === 0) {
    return process.env.VERCEL ? { mode: 'unconfigured' } : { mode: 'open' }
  }
  return {
    mode: 'gated',
    // Devuelve la etiqueta de quien presentó un código válido, o null.
    check(code) {
      if (!code || code.length > 100) return null
      const candidate = sha(normalizeCode(code))
      let found: string | null = null
      // Recorre todos (sin cortar al primero) para no filtrar cuál coincide por tiempo.
      for (const t of testers) if (timingSafeEqual(candidate, t.hash)) found = t.label
      return found
    },
  }
}
