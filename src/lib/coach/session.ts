import type { Path, Session } from './types'

// Los procesos viven en el navegador de la persona (sin registro). Pueden ser varios y ninguno se
// borra al empezar otro: se retoman — y con ellos los compromisos elegidos — más adelante (§5).

const KEY = 'cp_coach_sessions_v3'
const LEGACY_KEY = 'cp_coach_session_v2'
/** Cuántos procesos se guardan como máximo en el navegador. */
export const MAX_SESSIONS = 12

export function newSession(path: Path): Session {
  return {
    id: newId(),
    version: 2,
    path,
    phase: path === 'perfil' ? 'perfil' : 'chat',
    stage: 'diagnostico',
    messages: [],
    cubiertos: { diagnostico: [], discovery: [], plan: [] },
    sintesis: {},
    stageReady: false,
    documentos: [],
    updatedAt: new Date().toISOString(),
  }
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)

function readAll(): Session[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { items?: Session[] }
      return (parsed.items ?? []).filter((s) => s && s.version === 2 && typeof s.id === 'string')
    }
    // Migración: antes había un único proceso guardado. Pasa a ser el primero de la lista.
    const old = localStorage.getItem(LEGACY_KEY)
    if (old) {
      const s = JSON.parse(old) as Session
      if (s.version === 2) {
        const migrated = [{ ...s, id: s.id ?? newId() }]
        localStorage.setItem(KEY, JSON.stringify({ items: migrated }))
        localStorage.removeItem(LEGACY_KEY)
        return migrated
      }
    }
  } catch {
    // ignorado
  }
  return []
}

function writeAll(items: Session[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items }))
  } catch {
    // Sin storage (modo privado, cuota): el proceso sigue funcionando en memoria.
  }
}

/** Los procesos de esta persona con algo guardado, el más reciente primero. */
export function listSessions(): Session[] {
  return readAll()
    .filter(hasProgress)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveSession(session: Session) {
  const all = readAll()
  const exists = all.some((s) => s.id === session.id)
  // Un proceso existe desde que la persona escribe o carga su perfil, no desde que abre un camino.
  if (!exists && !hasProgress(session)) return
  const next = exists ? all.map((s) => (s.id === session.id ? session : s)) : [session, ...all]
  // Tope: si hay de más, se descartan los más viejos.
  writeAll(next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_SESSIONS))
}

export function deleteSession(id: string) {
  writeAll(readAll().filter((s) => s.id !== id))
}

export function clearAllSessions() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignorado
  }
}

export function hasProgress(s: Session | null): s is Session {
  // La apertura del coach no cuenta: un proceso existe desde que la persona escribe o carga su perfil.
  return !!s && (s.messages.some((m) => m.role === 'user' && !m.hidden) || !!s.perfil || !!s.informe)
}
