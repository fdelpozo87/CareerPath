import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getLang } from './i18n'
import type { Path, Report, Session } from './coach/types'

// Cuenta opcional (Supabase): la persona puede guardar su informe y sus compromisos con su email, verlos
// desde otro dispositivo y pedir un recordatorio del check-in. Nunca se guarda la conversación.
// Sin cuenta, todo sigue viviendo solo en el navegador. La seguridad la da RLS (supabase/migrations).

declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

export interface CloudUser {
  id: string
  email: string
}

export interface SavedReport {
  processId: string
  path: Path
  informe: Report
  compromisos: number[]
  compromisosFecha?: string
  updatedAt: string
}

export const cloudEnabled = (): boolean => Boolean(__SUPABASE_URL__ && __SUPABASE_ANON_KEY__)

let client: SupabaseClient | null | undefined
function sb(): SupabaseClient | null {
  if (client === undefined) {
    client = cloudEnabled()
      ? createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } })
      : null
  }
  return client
}

const toUser = (u: { id: string; email?: string | null } | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email ?? '' } : null)

export async function currentUser(): Promise<CloudUser | null> {
  const c = sb()
  if (!c) return null
  try {
    return toUser((await c.auth.getSession()).data.session?.user)
  } catch {
    return null
  }
}

/** Avisa cada vez que alguien entra o sale. Devuelve la función para dejar de escuchar. */
export function onAuthChange(cb: (user: CloudUser | null) => void): () => void {
  const c = sb()
  if (!c) return () => {}
  const { data } = c.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)))
  return () => data.subscription.unsubscribe()
}

/** Qué mensaje mostrar cuando falla el envío del enlace (para que la persona sepa qué hacer). */
export function loginErrorKey(e: unknown): 'login.error.rate' | 'login.error.network' | 'login.error.email' | 'login.error' {
  const err = e as { code?: string; status?: number; name?: string } | null
  const code = err?.code ?? ''
  if (code.includes('rate_limit') || err?.status === 429) return 'login.error.rate'
  if (code === 'validation_failed' || code.startsWith('email_address')) return 'login.error.email'
  // Sin respuesta del servicio (red caída, dirección del proyecto mal cargada en el build).
  if (err?.name === 'AuthRetryableFetchError' || err?.status === 0 || e instanceof TypeError) return 'login.error.network'
  return 'login.error'
}

/** Manda un enlace de acceso al email. No hay contraseña. */
export async function sendLoginLink(email: string): Promise<void> {
  const c = sb()
  if (!c) throw new Error('cloud_off')
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  if (error) throw error
}

/** Header con el token de la sesión de la cuenta, para los pedidos a /api (vacío si no hay sesión). */
export async function authHeader(): Promise<Record<string, string>> {
  const c = sb()
  if (!c) return {}
  try {
    const token = (await c.auth.getSession()).data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export async function signOut(): Promise<void> {
  await sb()?.auth.signOut()
}

// Si la persona pide el enlace antes de entrar, al volver del mail se guarda sola lo que había elegido.
const PENDING_KEY = 'cp_pending_save'
export interface PendingSave {
  processId: string
  remindDays: number | null
}
export function setPendingSave(p: PendingSave) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p))
  } catch {
    // ignorado
  }
}
export function takePendingSave(): PendingSave | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    localStorage.removeItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingSave) : null
  } catch {
    return null
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Guarda (o actualiza) el informe y los compromisos de un proceso. Con `remindDays`, agenda un recordatorio. */
export async function saveReport(session: Session, remindDays: number | null): Promise<void> {
  const c = sb()
  const user = await currentUser()
  if (!c || !user || !session.informe) throw new Error('cloud_unavailable')
  const lang = getLang()
  const { data, error } = await c
    .from('bivio_informes')
    .upsert(
      {
        user_id: user.id,
        process_id: session.id,
        path: session.path,
        informe: session.informe,
        compromisos: session.compromisos ?? [],
        compromisos_fecha: session.compromisosFecha ?? null,
        lang,
      },
      { onConflict: 'user_id,process_id' },
    )
    .select('id')
    .single()
  if (error) throw error
  if (remindDays) {
    const { error: e2 } = await c
      .from('bivio_recordatorios')
      .upsert({ user_id: user.id, informe_id: data.id, due_at: new Date(Date.now() + remindDays * DAY_MS).toISOString(), lang, sent_at: null }, { onConflict: 'informe_id' })
    if (e2) throw e2
  } else {
    await c.from('bivio_recordatorios').delete().eq('informe_id', data.id)
  }
}

export async function listSavedReports(): Promise<SavedReport[]> {
  const c = sb()
  if (!c || !(await currentUser())) return []
  const { data, error } = await c.from('bivio_informes').select('process_id,path,informe,compromisos,compromisos_fecha,updated_at').order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({
    processId: r.process_id as string,
    path: r.path as Path,
    informe: r.informe as Report,
    compromisos: (r.compromisos as number[]) ?? [],
    compromisosFecha: (r.compromisos_fecha as string | null) ?? undefined,
    updatedAt: r.updated_at as string,
  }))
}

export async function deleteSavedReport(processId: string): Promise<void> {
  const user = await currentUser()
  if (!user) return
  await sb()?.from('bivio_informes').delete().eq('user_id', user.id).eq('process_id', processId)
}

/** Borra la cuenta y todo lo guardado (el servidor la elimina con su token; lo guardado se va en cascada). */
export async function deleteAccount(): Promise<void> {
  const c = sb()
  const token = (await c?.auth.getSession())?.data.session?.access_token
  if (!c || !token) throw new Error('cloud_unavailable')
  const res = await fetch('/api/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-lang': getLang() },
    body: JSON.stringify({ action: 'delete' }),
  })
  if (!res.ok) throw new Error('delete_failed')
  await c.auth.signOut()
}

/** Un informe guardado en la cuenta, convertido en un proceso que se puede retomar desde la home. */
export function sessionFromSaved(r: SavedReport): Session {
  return {
    id: r.processId,
    version: 2,
    path: r.path,
    phase: 'informe',
    stage: 'plan',
    messages: [],
    cubiertos: { diagnostico: [], discovery: [], plan: [] },
    sintesis: {},
    stageReady: true,
    documentos: [],
    informe: r.informe,
    compromisos: r.compromisos.length > 0 ? r.compromisos : undefined,
    compromisosFecha: r.compromisosFecha,
    updatedAt: r.updatedAt,
  }
}
