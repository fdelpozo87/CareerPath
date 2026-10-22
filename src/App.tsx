import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Landing from './components/Landing'
import CompanySection from './components/CompanySection'
import Footer from './components/Footer'
import { CompanyFlow } from './components/CompanyFlow'
import AccessGate from './components/AccessGate'
import { AccountStatus, LoginGate, MfaGate, SetPasswordScreen } from './components/LoginGate'
import { AdminPanel } from './components/AdminPanel'
import PasswordDialog from './components/PasswordDialog'
import MfaSettingsDialog from './components/MfaSettingsDialog'
import ConfirmDialog from './components/ConfirmDialog'
import PrivacyPolicy from './components/PrivacyPolicy'
import { CoachFlow } from './components/coach/CoachFlow'
import { clearAllSessions, deleteSession, listSessions, loadSessionById, newSession, saveSession } from './lib/coach/session'
import { cloudEnabled, currentUser, deleteAccount, listSavedReports, onAuthChange, onPasswordRecovery, saveReport, sessionFromSaved, signOut, takePendingSave, type CloudUser } from './lib/cloud'
import { downloadMyData } from './lib/exportData'
import type { Path, Session } from './lib/coach/types'
import { ACCESS_LOST_EVENT, checkAccess, clearAccessCode, getAccessCode, getAccessLabel, saveAccessCode } from './lib/access'
import type { AccountInfo } from './components/AccountMenu'
import { trackEvent } from './lib/tracking'
import { tr, trn, useLang } from './lib/i18n'

type View = 'landing' | 'coach' | 'company' | 'privacidad' | 'admin'

const isPrivacyHash = () => window.location.hash === '#privacidad'
const isAdminHash = () => window.location.hash === '#admin'

type Pending = { kind: 'deleteAll' } | { kind: 'deleteOne'; id: string } | { kind: 'deleteAccount' }

type Access =
  | { state: 'checking' }
  | { state: 'locked'; error?: string } // puerta del código de invitación
  | { state: 'login'; error?: string } // puerta por cuenta (email)
  | { state: 'pending' }
  | { state: 'mfa' }
  | { state: 'disabled' }
  | { state: 'open' }

function App() {
  // Se vuelve a dibujar cuando cambia el idioma (y con él, todo lo que cuelga de acá).
  useLang()
  const [view, setView] = useState<View>(() => (isPrivacyHash() ? 'privacidad' : isAdminHash() ? 'admin' : 'landing'))
  const [isAdmin, setIsAdmin] = useState(false)
  // Contraseña (opcional): el diálogo del menú y la pantalla de "olvidé mi contraseña".
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [mfaSettingsOpen, setMfaSettingsOpen] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>({ state: 'checking' })
  const [label, setLabel] = useState<string | null>(getAccessLabel)
  // Confirmación pendiente (reemplaza a window.confirm, que algunos navegadores bloquean).
  const [pending, setPending] = useState<Pending | null>(null)
  // Cuenta opcional: quién tiene la sesión iniciada y un aviso breve (guardado, recuperado).
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Se relee al volver a la landing (o al borrar un proceso) para reflejar lo guardado.
  const [listVersion, setListVersion] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const processes = useMemo(() => (view === 'landing' ? listSessions() : []), [view, listVersion])

  // Cuenta opcional. Al entrar (por ejemplo, al volver del enlace del mail): se guarda lo que la persona
  // había elegido antes de pedir el enlace y se recuperan en este navegador los informes de su cuenta.
  const accessOpen = access.state === 'open'
  useEffect(() => {
    if (!cloudEnabled()) return
    let alive = true
    const onUser = async (user: CloudUser | null) => {
      if (!alive) return
      setCloudUser(user)
      // Guardar y recuperar informes solo tiene sentido con acceso (una cuenta pendiente no puede escribir).
      if (!user || !accessOpen) return
      try {
        const pending = takePendingSave()
        const local = pending ? loadSessionById(pending.processId) : null
        if (pending && local?.informe) {
          await saveReport(local, pending.remindDays)
          if (alive) setNotice(tr('cloud.autoSaved', { email: user.email }))
        }
        const known = new Set(listSessions().map((s) => s.id))
        const missing = (await listSavedReports()).filter((r) => !known.has(r.processId))
        for (const r of missing) saveSession(sessionFromSaved(r))
        if (missing.length > 0 && alive) {
          setNotice(trn('cloud.imported', missing.length))
          setListVersion((v) => v + 1)
        }
      } catch (e) {
        console.error(e)
      }
    }
    void currentUser().then(onUser)
    const off = onAuthChange((u) => void onUser(u))
    return () => {
      alive = false
      off()
    }
  }, [accessOpen])

  // Acceso: pregunta al servidor si hace falta código o cuenta y si lo que hay sirve. En local, sin
  // ACCESS_CODES ni Supabase, responde "no requerido" y no se muestra nada. Con cuentas, entra solo
  // quien tiene sesión y fue aprobado; las cuentas nuevas quedan pendientes.
  const refreshAccess = useCallback(async () => {
    try {
      const s = await checkAccess(getAccessCode() ?? undefined)
      if (s.mode === 'accounts') {
        setIsAdmin(Boolean(s.isAdmin))
        if (!cloudEnabled()) setAccess({ state: 'login', error: tr('login.notConfigured') })
        else if (s.ok) setAccess({ state: 'open' })
        else if (s.reason === 'mfa_requerido') setAccess({ state: 'mfa' })
        else if (s.reason === 'pendiente') setAccess({ state: 'pending' })
        else if (s.reason === 'desactivado') setAccess({ state: 'disabled' })
        else if (s.reason === 'no_disponible') setAccess({ state: 'login', error: tr('srv.authDown') })
        else setAccess({ state: 'login' })
        return
      }
      setIsAdmin(false)
      setAccess(!s.required || s.ok ? { state: 'open' } : { state: 'locked', error: s.error })
      // Refresca el apodo del código guardado (por ejemplo, si cambió en el servidor).
      const code = getAccessCode()
      if (s.ok && s.label && code) {
        saveAccessCode(code, s.label)
        setLabel(s.label)
      }
    } catch {
      // Sin conexión no se puede decidir; si el servidor exige acceso, cada pedido a la API lo valida igual.
      setAccess({ state: 'open' })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta inicial al servidor; el estado se actualiza al responder
    void refreshAccess()
    // Al perder el acceso (código revocado, cuenta desactivada o sesión vencida) se sale del chat: la
    // sesión ya está guardada en el navegador y se retoma desde "Retomar" al volver a entrar.
    const lost = () => {
      setView('landing')
      void refreshAccess()
    }
    window.addEventListener(ACCESS_LOST_EVENT, lost)
    // Entrar o salir de la cuenta (por ejemplo, al volver del enlace del mail) cambia el acceso.
    const off = onAuthChange(() => void refreshAccess())
    const offRecovery = onPasswordRecovery(() => setRecovery(true))
    return () => {
      window.removeEventListener(ACCESS_LOST_EVENT, lost)
      off()
      offRecovery()
    }
  }, [refreshAccess])

  // La política de privacidad tiene URL propia (#privacidad) para poder enlazarla.
  useEffect(() => {
    const onHash = () => {
      if (isPrivacyHash()) {
        trackEvent('privacy_viewed')
        setView('privacidad')
        window.scrollTo(0, 0)
      } else if (isAdminHash()) {
        setView('admin')
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
    label: cloudUser?.email ?? label,
    canLogout: getAccessCode() !== null,
    onAdmin: isAdmin
      ? () => {
          window.location.hash = '#admin'
          setView('admin')
          window.scrollTo(0, 0)
        }
      : undefined,
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
    onExport: () => {
      downloadMyData().catch((e) => {
        console.error(e)
        setNotice(tr('account.export.error'))
      })
    },
    cloud: cloudUser
      ? {
          email: cloudUser.email,
          onSignOut: () => {
            void signOut()
            setNotice(null)
          },
          onDeleteAccount: () => setPending({ kind: 'deleteAccount' }),
          onPassword: () => setPasswordOpen(true),
          onMfa: () => setMfaSettingsOpen(true),
        }
      : undefined,
  }

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.kind === 'deleteOne' ? tr('process.deleteTitle') : pending?.kind === 'deleteAccount' ? tr('cloud.deleteTitle') : tr('account.deleteTitle')}
      body={pending?.kind === 'deleteOne' ? tr('process.deleteConfirm') : pending?.kind === 'deleteAccount' ? tr('cloud.deleteConfirm') : tr('account.deleteConfirm')}
      confirmLabel={pending?.kind === 'deleteOne' ? tr('process.deleteAction') : pending?.kind === 'deleteAccount' ? tr('cloud.deleteAction') : tr('account.deleteAction')}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending
        setPending(null)
        if (action?.kind === 'deleteAll') deleteAll()
        else if (action?.kind === 'deleteAccount') {
          deleteAccount()
            .then(() => setNotice(null))
            .catch((e) => {
              console.error(e)
              setNotice(tr('cloud.error'))
            })
        } else if (action) deleteOne(action.id)
      }}
    />
  )

  const passwordDialog = (
    <>
    <MfaSettingsDialog open={mfaSettingsOpen} onClose={() => setMfaSettingsOpen(false)} />
    <PasswordDialog
      open={passwordOpen}
      onClose={() => setPasswordOpen(false)}
      onSaved={() => {
        setPasswordOpen(false)
        setNotice(tr('password.saved'))
      }}
    />
    </>
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

  // Volvió del enlace de "olvidé mi contraseña": primero elige la nueva.
  if (recovery) {
    return (
      <SetPasswordScreen
        onDone={() => {
          setRecovery(false)
          setNotice(tr('password.saved'))
          void refreshAccess()
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

  if (access.state === 'login') return <LoginGate initialError={access.error} />
  if (access.state === 'mfa') return <MfaGate onDone={() => void refreshAccess()} />
  if (access.state === 'pending' || access.state === 'disabled') {
    return <AccountStatus kind={access.state === 'pending' ? 'pendiente' : 'desactivado'} onRecheck={() => void refreshAccess()} />
  }

  // El panel de usuarios existe solo para quien administra (el servidor lo verifica en cada pedido).
  if (view === 'admin') {
    if (isAdmin) {
      return (
        <AdminPanel
          onBack={() => {
            history.replaceState(null, '', window.location.pathname)
            setView('landing')
          }}
        />
      )
    }
  }

  if (view === 'coach' && session) {
    return (
      <CoachFlow
        initialSession={session}
        onExit={() => setView('landing')}
        onRestart={() => deleteOne(session.id)}
        account={account}
        confirmDialog={
          <>
            {confirmDialog}
            {passwordDialog}
          </>
        }
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
        {notice && (
          <div role="status" className="mx-auto mt-6 flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-foreground">
            <p>{notice}</p>
            <button onClick={() => setNotice(null)} className="shrink-0 font-semibold underline underline-offset-2">
              {tr('cloud.dismiss')}
            </button>
          </div>
        )}
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
      {passwordDialog}
    </div>
  )
}

export default App
