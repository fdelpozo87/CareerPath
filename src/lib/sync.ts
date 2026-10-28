import { useSyncExternalStore } from 'react'
import { currentUser, getClient } from './cloud'
import { deleteSession, hasProgress, listSessions, loadSessionById, onSessionChange, saveSession } from './coach/session'
import { getLang } from './i18n'
import type { Session } from './coach/types'

// Sincronización OPCIONAL de las sesiones del coach con la cuenta, para seguirlas desde otro dispositivo.
// Está apagada por defecto: sin activarla, la conversación sigue viviendo solo en este navegador. Activada, se guarda
// la sesión completa (lo que la persona escribió y los documentos que subió) en `bivio_sesiones`, protegida por RLS.
// La preferencia vive en la cuenta (user_metadata), no en el navegador, para que valga en todos los dispositivos.

const TABLE = 'bivio_sesiones'
const META_KEY = 'sync_sesiones'
const NUDGE_KEY = 'avisos_sesion'
const SYNCED_KEY = 'cp_synced_ids'
/** Tope por sesión: una más grande queda solo en el navegador. */
export const MAX_SESSION_BYTES = 400_000
const PUSH_DELAY_MS = 2000
const PULL_LIMIT = 50

let enabled = false
/** Aviso por mail si la persona deja una sesión a medias (solo con la sincronización encendida). */
let nudge = false
const subs = new Set<() => void>()
function setEnabled(v: boolean) {
  if (v === enabled) return
  enabled = v
  subs.forEach((f) => f())
}
function setNudge(v: boolean) {
  if (v === nudge) return
  nudge = v
  subs.forEach((f) => f())
}

/** ¿La sincronización está activada para la cuenta que tiene la sesión iniciada? */
export function useSyncEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => enabled,
    () => false,
  )
}

/** ¿La persona pidió que le avisen por mail si deja una sesión a medias? */
export function useNudgeEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => nudge,
    () => false,
  )
}

export const isSyncEnabled = () => enabled

/** Lee la preferencia de la cuenta (al entrar). Sin sesión, queda apagada. */
export async function loadSyncPreference(): Promise<boolean> {
  const c = getClient()
  const user = c ? (await c.auth.getSession()).data.session?.user : null
  const on = user?.user_metadata?.[META_KEY] === true
  setEnabled(on)
  setNudge(on && user?.user_metadata?.[NUDGE_KEY] === true)
  return on
}

/** Al cerrar sesión: apaga la sincronización en esta pestaña y deja de subir lo pendiente. */
export function resetSync() {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
  setEnabled(false)
  setNudge(false)
}

const readSynced = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
const writeSynced = (ids: Iterable<string>) => {
  try {
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...ids]))
  } catch {
    // ignorado
  }
}

const ts = (iso: string) => Date.parse(iso) || 0

/** Sube una sesión. Devuelve false si no hay nada que subir o si es demasiado grande. */
export async function pushSession(s: Session): Promise<boolean> {
  const c = getClient()
  const user = await currentUser()
  if (!c || !user || !hasProgress(s) || JSON.stringify(s).length > MAX_SESSION_BYTES) return false
  const { error } = await c
    .from(TABLE)
    .upsert({ user_id: user.id, process_id: s.id, path: s.path, data: s, lang: getLang(), session_updated_at: s.updatedAt, avisar: nudge, nudged_at: null }, { onConflict: 'user_id,process_id' })
  if (error) throw error
  return true
}

async function removeRemote(id: string) {
  const c = getClient()
  const user = await currentUser()
  if (!c || !user) return
  await c.from(TABLE).delete().eq('user_id', user.id).eq('process_id', id)
  const ids = readSynced()
  ids.delete(id)
  writeSynced(ids)
}

/** Borra todo lo que la cuenta tiene sincronizado. */
export async function removeAllRemote() {
  const c = getClient()
  const user = await currentUser()
  if (!c || !user) return
  const { error } = await c.from(TABLE).delete().eq('user_id', user.id)
  if (error) throw error
  writeSynced([])
}

/**
 * Mezcla lo de este navegador con lo de la cuenta: de cada sesión gana la versión más nueva. Una sesión que ya se había
 * sincronizado y ya no está en la cuenta se borró desde otro dispositivo: se borra acá también. Devuelve cuántas
 * sesiones cambiaron en este navegador (para refrescar la lista).
 */
export async function pullAndMerge(): Promise<number> {
  const c = getClient()
  const user = await currentUser()
  if (!c || !user) return 0
  const { data, error } = await c.from(TABLE).select('process_id,data,session_updated_at').order('session_updated_at', { ascending: false }).limit(PULL_LIMIT)
  if (error || !data) throw error ?? new Error('sync_failed')

  let changed = 0
  const remote = new Map<string, number>()
  for (const r of data) {
    const s = r.data as Session
    if (!s || s.version !== 2 || typeof s.id !== 'string') continue
    remote.set(s.id, ts(r.session_updated_at as string))
    const local = loadSessionById(s.id)
    if (!local || ts(local.updatedAt) < ts(s.updatedAt)) {
      saveSession(s, { silent: true })
      changed++
    }
  }

  const synced = readSynced()
  for (const local of listSessions()) {
    const remoteTs = remote.get(local.id)
    if (remoteTs === undefined) {
      if (synced.has(local.id)) {
        deleteSession(local.id, { silent: true })
        changed++
      } else if (await pushSession(local)) remote.set(local.id, ts(local.updatedAt))
    } else if (remoteTs < ts(local.updatedAt) && (await pushSession(local))) remote.set(local.id, ts(local.updatedAt))
  }
  writeSynced(remote.keys())
  return changed
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Sube los cambios apenas se guardan (con una pausa corta) y propaga los borrados. Devuelve la función para detenerlo. */
export function startAutoSync(): () => void {
  return onSessionChange((change) => {
    if (!enabled) return
    if (change.type === 'save') {
      const id = change.session.id
      clearTimeout(timers.get(id))
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id)
          void pushSession(change.session)
            .then(() => {
              const ids = readSynced()
              ids.add(id)
              writeSynced(ids)
            })
            .catch((e) => console.error(e))
        }, PUSH_DELAY_MS),
      )
    } else if (change.type === 'delete') {
      clearTimeout(timers.get(change.id))
      timers.delete(change.id)
      void removeRemote(change.id).catch((e) => console.error(e))
    } else {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
      void removeAllRemote().catch((e) => console.error(e))
    }
  })
}

/**
 * Activa o apaga la sincronización de la cuenta. Al activar se mezcla y se sube lo que hay; al apagar se puede pedir
 * que también se borre lo que ya estaba en la cuenta. Devuelve cuántas sesiones cambiaron en este navegador.
 */
export async function setSyncEnabled(on: boolean, opts?: { deleteRemote?: boolean }): Promise<number> {
  const c = getClient()
  if (!c) throw new Error('cloud_unavailable')
  // Al apagar la sincronización se apagan también los avisos: sin las sesiones en la cuenta, no hay de qué avisar.
  const { error } = await c.auth.updateUser({ data: { [META_KEY]: on, ...(on ? {} : { [NUDGE_KEY]: false }) } })
  if (error) throw error
  setEnabled(on)
  if (!on) setNudge(false)
  if (on) {
    try {
      return await pullAndMerge()
    } catch (e) {
      // No se pudo subir nada (por ejemplo, falta la tabla): se deshace, para no quedar "activada" sin funcionar.
      setEnabled(false)
      await c.auth.updateUser({ data: { [META_KEY]: false } }).catch(() => {})
      throw e
    }
  }
  if (opts?.deleteRemote) await removeAllRemote()
  return 0
}

/** Activa o apaga el aviso por mail de sesiones a medias (requiere la sincronización encendida). */
export async function setNudgeEnabled(on: boolean): Promise<void> {
  const c = getClient()
  const user = await currentUser()
  if (!c || !user || !enabled) throw new Error('cloud_unavailable')
  const { error } = await c.auth.updateUser({ data: { [NUDGE_KEY]: on } })
  if (error) throw error
  setNudge(on)
  // Las sesiones que ya estaban subidas toman la nueva preferencia.
  const { error: e2 } = await c.from(TABLE).update({ avisar: on }).eq('user_id', user.id)
  if (e2) throw e2
}
