import { useEffect, useState } from 'react'
import Header from './components/Header'
import Landing from './components/Landing'
import CompanySection from './components/CompanySection'
import Footer from './components/Footer'
import { CompanyFlow } from './components/CompanyFlow'
import AccessGate from './components/AccessGate'
import PrivacyPolicy from './components/PrivacyPolicy'
import { CoachFlow } from './components/coach/CoachFlow'
import { clearSession, hasProgress, loadSession, newSession } from './lib/coach/session'
import type { Path, Session } from './lib/coach/types'
import { ACCESS_LOST_EVENT, checkAccess, clearAccessCode, getAccessCode, getAccessLabel, saveAccessCode } from './lib/access'
import type { AccountInfo } from './components/AccountMenu'
import { trackEvent } from './lib/tracking'

type View = 'landing' | 'coach' | 'company' | 'privacidad'

const isPrivacyHash = () => window.location.hash === '#privacidad'

type Access = { state: 'checking' } | { state: 'locked'; error?: string } | { state: 'open' }

function App() {
  const [view, setView] = useState<View>(() => (isPrivacyHash() ? 'privacidad' : 'landing'))
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>({ state: 'checking' })
  const [label, setLabel] = useState<string | null>(getAccessLabel)
  // Se relee al volver a la landing para reflejar el progreso guardado.
  const saved = view === 'landing' ? loadSession() : null

  // Acceso de prueba: pregunta al servidor si hace falta código y si el guardado sirve.
  // En local (sin ACCESS_CODES) el servidor responde "no requerido" y no se muestra nada.
  useEffect(() => {
    let alive = true
    checkAccess(getAccessCode() ?? undefined)
      .then((s) => {
        if (!alive) return
        setAccess(!s.required || s.ok ? { state: 'open' } : { state: 'locked', error: s.error })
        // Refresca el apodo del código guardado (por ejemplo, si cambió en el servidor).
        const code = getAccessCode()
        if (s.ok && s.label && code) {
          saveAccessCode(code, s.label)
          setLabel(s.label)
        }
      })
      // Sin conexión no se puede decidir; si el servidor exige código, cada pedido a la API lo valida igual.
      .catch(() => alive && setAccess({ state: 'open' }))
    // Al perder el acceso se sale del chat: la sesión ya está guardada en el navegador y
    // se retoma desde "Retomar" al volver a entrar (evita remontar con una copia vieja).
    const lost = () => {
      setAccess({ state: 'locked' })
      setView('landing')
    }
    window.addEventListener(ACCESS_LOST_EVENT, lost)
    return () => {
      alive = false
      window.removeEventListener(ACCESS_LOST_EVENT, lost)
    }
  }, [])

  // La política de privacidad tiene URL propia (#privacidad) para poder enlazarla.
  useEffect(() => {
    const onHash = () => {
      if (isPrivacyHash()) {
        trackEvent('privacy_viewed')
        setView('privacidad')
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const startPath = (path: Path) => {
    if (hasProgress(saved) && !window.confirm('Tenés un proceso en curso. ¿Querés empezar uno nuevo? El anterior se va a borrar.')) {
      return
    }
    trackEvent('path_selected', { path })
    clearSession()
    setSession(newSession(path))
    setView('coach')
    window.scrollTo(0, 0)
  }

  // Cerrar sesión: se olvida el código en este navegador y se vuelve a la puerta de acceso. La
  // conversación queda guardada (se retoma al volver a entrar); para borrarla hay otra opción.
  const account: AccountInfo = {
    label,
    canLogout: getAccessCode() !== null,
    onLogout: () => {
      trackEvent('logged_out')
      clearAccessCode()
      setLabel(null)
      setSession(null)
      setView('landing')
      setAccess({ state: 'locked' })
      window.scrollTo(0, 0)
    },
    onDeleteData: () => {
      if (!window.confirm('¿Borrar tu conversación de este navegador? No se puede deshacer.')) return
      trackEvent('data_deleted')
      clearSession()
      setSession(null)
      setView('landing')
      window.scrollTo(0, 0)
    },
  }

  if (view === 'privacidad') {
    return (
      <PrivacyPolicy
        onBack={() => {
          history.replaceState(null, '', window.location.pathname)
          setView('landing')
        }}
      />
    )
  }

  if (access.state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p role="status" className="text-sm text-text-muted">
          Cargando…
        </p>
      </div>
    )
  }

  if (access.state === 'locked') {
    return (
      <AccessGate
        initialError={access.error}
        onGranted={(l) => {
          setLabel(l ?? null)
          setAccess({ state: 'open' })
        }}
      />
    )
  }

  if (view === 'coach' && session) {
    return (
      <CoachFlow
        initialSession={session}
        onExit={() => setView('landing')}
        onRestart={() => {
          clearSession()
          setSession(null)
          setView('landing')
        }}
        account={account}
      />
    )
  }

  if (view === 'company') {
    return <CompanyFlow onBack={() => setView('landing')} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Header account={account} />
      <main className="flex-1">
        <Landing
          onChoosePath={startPath}
          saved={hasProgress(saved) ? saved : null}
          onResume={() => {
            if (!saved) return
            trackEvent('session_resumed', { phase: saved.phase, stage: saved.stage })
            setSession(saved)
            setView('coach')
            window.scrollTo(0, 0)
          }}
        />
        <CompanySection onStart={() => setView('company')} />
      </main>
      <Footer />
    </div>
  )
}

export default App
