import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Landing from './components/Landing'
import CompanySection from './components/CompanySection'
import Footer from './components/Footer'
import { CompanyFlow } from './components/CompanyFlow'
import AccessGate from './components/AccessGate'
import ConfirmDialog from './components/ConfirmDialog'
import PrivacyPolicy from './components/PrivacyPolicy'
import { CoachFlow } from './components/coach/CoachFlow'
import { clearAllSessions, deleteSession, listSessions, newSession } from './lib/coach/session'
import type { Path, Session } from './lib/coach/types'
import { ACCESS_LOST_EVENT, checkAccess, clearAccessCode, getAccessCode, getAccessLabel, saveAccessCode } from './lib/access'
import type { AccountInfo } from './components/AccountMenu'
import { trackEvent } from './lib/tracking'
import { tr, useLang } from './lib/i18n'

type View = 'landing' | 'coach' | 'company' | 'privacidad'

const isPrivacyHash = () => window.location.hash === '#privacidad'

type Pending = { kind: 'deleteAll' } | { kind: 'deleteOne'; id: string }

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
  // Se relee al volver a la landing (o al borrar un proceso) para reflejar lo guardado.
  const [listVersion, setListVersion] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const processes = useMemo(() => (view === 'landing' ? listSessions() : []), [view, listVersion])

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

  // Empezar un camino nunca borra los otros procesos: se suma a la lista.
  const startPath = (path: Path) => {
    trackEvent('path_selected', { path })
    setSession(newSession(path))
    setView('coach')
    window.scrollTo(0, 0)
  }

  const deleteAll = () => {
    trackEvent('data_deleted')
    clearAllSessions()
    setSession(null)
    setView('landing')
    setListVersion((v) => v + 1)
    window.scrollTo(0, 0)
  }

  const deleteOne = (id: string) => {
    trackEvent('process_deleted')
    deleteSession(id)
    if (session?.id === id) setSession(null)
    setView('landing')
    setListVersion((v) => v + 1)
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
    onDeleteData: () => setPending({ kind: 'deleteAll' }),
  }

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.kind === 'deleteOne' ? tr('process.deleteTitle') : tr('account.deleteTitle')}
      body={pending?.kind === 'deleteOne' ? tr('process.deleteConfirm') : tr('account.deleteConfirm')}
      confirmLabel={pending?.kind === 'deleteOne' ? tr('process.deleteAction') : tr('account.deleteAction')}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending
        setPending(null)
        if (action?.kind === 'deleteAll') deleteAll()
        else if (action) deleteOne(action.id)
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
        onRestart={() => deleteOne(session.id)}
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
          processes={processes}
          onResume={(id) => {
            const saved = processes.find((p) => p.id === id)
            if (!saved) return
            trackEvent('session_resumed', { phase: saved.phase, stage: saved.stage })
            setSession(saved)
            setView('coach')
            window.scrollTo(0, 0)
          }}
          onDelete={(id) => setPending({ kind: 'deleteOne', id })}
        />
        <CompanySection onStart={() => setView('company')} />
      </main>
      <Footer />
      {confirmDialog}
    </div>
  )
}

export default App
