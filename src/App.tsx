import { useEffect, useState } from 'react'
import Header from './components/Header'
import Landing from './components/Landing'
import CompanySection from './components/CompanySection'
import Footer from './components/Footer'
import { CompanyFlow } from './components/CompanyFlow'
import AccessGate from './components/AccessGate'
import ConfirmDialog from './components/ConfirmDialog'
import PrivacyPolicy from './components/PrivacyPolicy'
import { CoachFlow } from './components/coach/CoachFlow'
import { clearSession, hasProgress, loadSession, newSession } from './lib/coach/session'
import type { Path, Session } from './lib/coach/types'
import { ACCESS_LOST_EVENT, checkAccess, clearAccessCode, getAccessCode, getAccessLabel, saveAccessCode } from './lib/access'
import type { AccountInfo } from './components/AccountMenu'
import { trackEvent } from './lib/tracking'
import { tr, useLang } from './lib/i18n'

type View = 'landing' | 'coach' | 'company' | 'privacidad'

const isPrivacyHash = () => window.location.hash === '#privacidad'

type Pending = { kind: 'start'; path: Path } | { kind: 'delete' }

type Access = { state: 'checking' } | { state: 'locked'; error?: string } | { state: 'open' }

function App() {
  // Se vuelve a dibujar cuando cambia el idioma (y con él, todo lo que cuelga de acá).
  useLang()
  const [view, setView] = useState<View>(() => (isPrivacyHash() ? 'privacidad' : 'landing'))
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>({ state: 'checking' })
  const [label, setLabel] = useState<string | null>(getAccessLabel)
  // Confirmación pendiente (reemplaza a window.confirm, que algunos navegadores bloquean).
  const [pending, setPending] = useState<Pending | null>(null)
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

  const beginPath = (path: Path) => {
    trackEvent('path_selected', { path })
    clearSession()
    setSession(newSession(path))
    setView('coach')
    window.scrollTo(0, 0)
  }

  const startPath = (path: Path) => {
    if (hasProgress(saved)) setPending({ kind: 'start', path })
    else beginPath(path)
  }

  const deleteData = () => {
    trackEvent('data_deleted')
    clearSession()
    setSession(null)
    setView('landing')
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
    onDeleteData: () => setPending({ kind: 'delete' }),
  }

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.kind === 'delete' ? tr('account.deleteTitle') : tr('app.resumeTitle')}
      body={pending?.kind === 'delete' ? tr('account.deleteConfirm') : tr('app.resumeConfirm')}
      confirmLabel={pending?.kind === 'delete' ? tr('account.deleteAction') : tr('app.resumeAction')}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending
        setPending(null)
        if (action?.kind === 'delete') deleteData()
        else if (action) beginPath(action.path)
      }}
    />
  )

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
          {tr('common.loading')}
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
        confirmDialog={confirmDialog}
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
      {confirmDialog}
    </div>
  )
}

export default App
