import { Component, type ReactNode } from 'react'
import { tr } from '../lib/i18n'
import { reportError } from '../lib/monitoring'

// Si un componente falla al renderizar, en vez de una pantalla en blanco se
// muestra una salida amable. La sesión guardada en el navegador no se pierde.

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    reportError(error, 'react.boundary')
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card max-w-md text-center" role="alert">
          <h1 className="mb-3 text-2xl">{tr('error.title')}</h1>
          <p className="mb-6 text-sm leading-relaxed text-text-muted">
            {tr('error.body')}
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full">
            {tr('common.reload')}
          </button>
        </div>
      </main>
    )
  }
}
