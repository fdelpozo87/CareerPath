import { useState, type FormEvent } from 'react'
import { checkAccess, saveAccessCode } from '../lib/access'

// Pantalla de acceso de prueba: mientras CareerPath se prueba fuera de local,
// solo entra quien tiene un código de invitación. El código lo valida el
// servidor en cada pedido a la API; esta pantalla es solo la puerta visible.

interface AccessGateProps {
  /** Mensaje inicial, por ejemplo cuando el servidor no tiene el acceso configurado. */
  initialError?: string
  onGranted: () => void
}

export default function AccessGate({ initialError, onGranted }: AccessGateProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    try {
      const status = await checkAccess(value)
      if (status.ok) {
        saveAccessCode(value)
        onGranted()
        return
      }
      setError(status.error ?? 'Ese código no es válido.')
    } catch {
      setError('No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="border-b border-border-color">
        <div className="section-container py-4 text-xl font-semibold tracking-tight text-foreground">
          Career<span className="text-primary-ink">Path</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md">
          <h1 className="mb-3 text-2xl md:text-3xl">CareerPath está en pruebas privadas</h1>
          <p className="mb-6 text-sm leading-relaxed text-text-muted">
            Ingresá el código de acceso que te enviamos. Lo usamos para cuidar el costo del servicio mientras lo probamos con un grupo
            reducido de personas.
          </p>

          <form onSubmit={submit} noValidate>
            <label htmlFor="codigo" className="mb-2 block text-sm font-semibold text-foreground">
              Código de acceso
            </label>
            <input
              id="codigo"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              placeholder="XXXX-XXXX-XXXX"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'codigo-error' : undefined}
              className="w-full rounded-xl border border-border-color p-3 font-mono text-sm tracking-wider outline-none focus:border-primary"
            />
            <div id="codigo-error" role="alert" className="min-h-6 pt-2 text-sm text-red-700">
              {error}
            </div>
            <button type="submit" disabled={!code.trim() || busy} className="btn-primary mt-2 w-full py-3 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-xs text-text-muted">
            ¿No tenés código? Pedíselo a quien te invitó.{' '}
            <a href="#privacidad" className="underline underline-offset-2">
              Privacidad y términos
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
