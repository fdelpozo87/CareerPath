import type { Path, Session } from './types'

// La sesión vive en el navegador de la persona (sin registro). Permite retomar
// el proceso — y en particular los compromisos elegidos — más adelante (§5).

const KEY = 'cp_coach_session_v2'

export function newSession(path: Path): Session {
  return {
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

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s.version === 2 ? s : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Sin storage (modo privado, cuota): la sesión sigue funcionando en memoria.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignorado
  }
}

export function hasProgress(s: Session | null): s is Session {
  return !!s && (s.messages.length > 0 || !!s.perfil || !!s.informe)
}
