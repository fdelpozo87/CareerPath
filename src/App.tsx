import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Landing from './components/Landing'
import CompanySection from './components/CompanySection'
import Footer from './components/Footer'
import AccessGate from './components/AccessGate'
import { AccountStatus, LoginGate, MfaGate, SetPasswordScreen } from './components/LoginGate'
import { mias as listMias } from './lib/evaluaciones'
import ConfirmDialog from './components/ConfirmDialog'
import { loadSyncPreference, pullAndMerge, resetSync, setSyncEnabled, startAutoSync, useSyncEnabled } from './lib/sync'
import { clearAllSessions, deleteSession, listSessions, loadSessionById, newSession, saveSession } from './lib/coach/session'
import { cloudEnabled, currentUser, deleteAccount, listSavedReports, onAuthChange, onPasswordRecovery, saveReport, sessionFromSaved, signOut, takePendingSave, type CloudUser } from './lib/cloud'
import { downloadMyData } from './lib/exportData'
import type { Path, Session } from './lib/coach/types'
import { ACCESS_LOST_EVENT, checkAccess, clearAccessCode, getAccessCode, getAccessLabel, saveAccessCode } from './lib/access'
import type { AccountInfo } from './components/AccountMenu'
import { trackEvent } from './lib/tracking'
import { tr, trn, useLang } from './lib/i18n'

// Lo que no se necesita para ver la portada se descarga recién al entrar (el primer paquete queda liviano).
const CompanyFlow = lazy(() => import('./components/CompanyFlow').then((m) => ({ default: m.CompanyFlow })))
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })))
const EvaluacionesPage = lazy(() => import('./components/evaluaciones/EvaluacionesPage').then((m) => ({ default: m.EvaluacionesPage })))
const CoachFlow = lazy(() => import('./components/coach/CoachFlow').then((m) => ({ default: m.CoachFlow })))
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'))
const PasswordDialog = lazy(() => import('./components/PasswordDialog'))
const MfaSettingsDialog = lazy(() => import('./components/MfaSettingsDialog'))

type View = 'landing' | 'coach' | 'company' | 'privacidad' | 'admin' | 'evaluaciones'

const isPrivacyHash = () => window.location.hash === '#privacidad'
const isAdminHash = () => window.location.hash === '#admin'
const isEvalHash = () => window.location.hash === '#evaluaciones'

type Pending = { kind: 'deleteAll' } | { kind: 'deleteOne'; id: string } | { kind: 'deleteAccount' } | { kind: 'syncOn' } | { kind: 'syncOff' }

type Access =
  | { state: 'checking' }
  | { state: 'locked'; error?: string } // puerta del código de invitación
  | { state: 'login'; error?: string } // puerta por cuenta (email)
  | { state: 'pending' }
  | { state: 'mfa' }
  | { state: 'disabled' }
  | { state: 'open' }

function AppInner() {
  // Se vuelve a dibujar cuando cambia el idioma (y con él, todo lo que cuelga de acá).
  const lang = useLang()
  const [view, setView] = useState<View>(() => (isPrivacyHash() ? 'privacidad' : isAdminHash() ? 'admin' : isEvalHash() ? 'evaluaciones' : 'landing'))
  const [isAdmin, setIsAdmin] = useState(false)
  // Qué partes del servicio tiene habilitadas la cuenta (sin dato: las dos).
  const [areas, setAreas] = useState<{ profesionales: boolean; empresas: boolean }>({ profesionales: true, empresas: true })
  // Contraseña (opcional): el diálogo del menú y la pantalla de "olvidé mi contraseña".
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [mfaSettingsOpen, setMfaSettingsOpen] = useState(false)
  // Evaluaciones de desempeño: cuántas tiene pendientes de responder la persona.
  const [evalPending, setEvalPending] = useState(0)
  const [recovery, setRecovery] = useState(false)
  // Cada pantalla tiene su título en la pestaña (también para quien comparte o guarda el enlace).
  useEffect(() => {
    document.title = view === 'landing' ? tr('meta.title') : tr(`meta.title.${view}`)
  }, [view, lang])
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>({ state: 'checking' })
  const [label, setLabel] = useState<string | null>(getAccessLabel)
  // Confirmación pendiente (reemplaza a window.confirm, que algunos navegadores bloquean).
  const [pending, setPending] = useState<Pending | null>(null)
  // Sincronización opcional de las sesiones con la cuenta (ver src/lib/sync.ts).
  const syncOn = useSyncEnabled()
  useEffect(() => startAutoSync(), [])
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
      if (!user) resetSync()
      // Guardar y recuperar informes solo tiene sentido con acceso (una cuenta pendiente no puede escribir).
      if (!user || !accessOpen) return
      try {
        // Si la cuenta tiene activada la sincronización, se mezclan las sesiones de este navegador con las de la cuenta.
        if (await loadSyncPreference()) {
          const changed = await pullAndMerge().catch(() => 0)
          if (changed > 0 && alive) setListVersion((v) => v + 1)
        }
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

  // Con la cuenta activa, se pregunta cuántas evaluaciones tiene pendientes (para el aviso del menú).
  useEffect(() => {
    if (!accessOpen || !cloudUser) return
    let alive = true
    listMias()
      .then((m) => alive && setEvalPending(m.pendientes))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [accessOpen, cloudUser])

  // Acceso: pregunta al servidor si hace falta código o cuenta y si lo que hay sirve. En local, sin
  // ACCESS_CODES ni Supabase, responde "no requerido" y no se muestra nada. Con cuentas, entra solo
  // quien tiene sesión y fue aprobado; las cuentas nuevas quedan pendientes.
  const refreshAccess = useCallback(async () => {
    try {
      const s = await checkAccess(getAccessCode() ?? undefined)
      if (s.mode === 'accounts') {
        setIsAdmin(Boolean(s.isAdmin))
        setAreas(s.areas ?? { profesionales: true, empresas: true })
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
      setAreas({ profesionales: true, empresas: true })
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
      } else if (isEvalHash()) {
        setView('evaluaciones')
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Vuelve a la home; con `anchor`, baja a esa parte ("Para profesionales" o "Para empresas").
  const goLanding = (anchor?: 'profesional' | 'empresa') => {
    history.replaceState(null, '', window.location.pathname)
    setView('landing')
    window.scrollTo(0, 0)
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 80)
  }

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
    onEvaluaciones: cloudUser
      ? () => {
          window.location.hash = '#evaluaciones'
          setView('evaluaciones')
          window.scrollTo(0, 0)
        }
      : undefined,
    evalPending,
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
          sync: { enabled: syncOn, onToggle: () => setPending({ kind: syncOn ? 'syncOff' : 'syncOn' }) },
        }
      : undefined,
  }

  const dialog = (() => {
    switch (pending?.kind) {
      case 'deleteOne':
        return { title: tr('process.deleteTitle'), body: tr(syncOn ? 'sync.deleteOneConfirm' : 'process.deleteConfirm'), label: tr('process.deleteAction') }
      case 'deleteAccount':
        return { title: tr('cloud.deleteTitle'), body: tr('cloud.deleteConfirm'), label: tr('cloud.deleteAction') }
      case 'syncOn':
        return { title: tr('sync.onTitle'), body: tr('sync.onBody'), label: tr('sync.onAction') }
      case 'syncOff':
        return { title: tr('sync.offTitle'), body: tr('sync.offBody'), label: tr('sync.offAction') }
      default:
        return { title: tr('account.deleteTitle'), body: tr(syncOn ? 'sync.deleteAllConfirm' : 'account.deleteConfirm'), label: tr('account.deleteAction') }
    }
  })()

  const changeSync = (on: boolean) =>
    setSyncEnabled(on, { deleteRemote: !on })
      .then((changed) => {
        if (changed > 0) setListVersion((v) => v + 1)
        setNotice(tr(on ? 'sync.onDone' : 'sync.offDone'))
      })
      .catch((e) => {
        console.error(e)
        setNotice(tr('sync.error'))
      })

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={dialog.title}
      body={dialog.body}
      confirmLabel={dialog.label}
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
        } else if (action?.kind === 'syncOn') void changeSync(true)
        else if (action?.kind === 'syncOff') void changeSync(false)
        else if (action?.kind === 'deleteOne') deleteOne(action.id)
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

  // Cuenta activa pero sin ninguna parte habilitada: se le explica en lugar de mostrarle una pantalla vacía.
  if (access.state === 'open' && !isAdmin && !areas.profesionales && !areas.empresas) {
    return <AccountStatus kind="sin_areas" onRecheck={() => void refreshAccess()} />
  }

  if (access.state === 'login') return <LoginGate initialError={access.error} />
  if (access.state === 'mfa') return <MfaGate onDone={() => void refreshAccess()} />
  if (access.state === 'pending' || access.state === 'disabled') {
    return <AccountStatus kind={access.state === 'pending' ? 'pendiente' : 'desactivado'} onRecheck={() => void refreshAccess()} />
  }

  // Evaluaciones de desempeño (solo con cuenta): el servidor decide qué puede hacer cada persona.
  if (view === 'evaluaciones' && cloudUser) {
    return (
      <EvaluacionesPage
        canCreate={isAdmin || areas.empresas}
        canSelf={isAdmin || areas.empresas || areas.profesionales}
        isAdmin={isAdmin}
        onPending={setEvalPending}
        account={account}
        areas={areas}
        onBack={() => goLanding()}
        onNavigate={(anchor) => goLanding(anchor)}
      />
    )
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
      <Header account={account} areas={areas} />
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
          showPaths={areas.profesionales}
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
        {areas.empresas && (
          <CompanySection
            onStart={() => setView('company')}
            onEvaluaciones={
              cloudUser
                ? () => {
                    window.location.hash = '#evaluaciones'
                    setView('evaluaciones')
                    window.scrollTo(0, 0)
                  }
                : undefined
            }
          />
        )}
      </main>
      <Footer areas={areas} />
      {confirmDialog}
      {passwordDialog}
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-background text-sm text-text-muted">{tr('app.loading')}</div>}>
      <AppInner />
    </Suspense>
  )
}

export default App
