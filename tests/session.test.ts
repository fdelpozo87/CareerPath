import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_SESSIONS, deleteSession, hasProgress, listSessions, newSession, saveSession } from '../src/lib/coach/session'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
  removeItem = (k: string) => void this.data.delete(k)
}

const talk = (s: ReturnType<typeof newSession>, at: string) => ({
  ...s,
  messages: [{ role: 'user' as const, text: 'Hola', stage: 'diagnostico' as const }],
  updatedAt: at,
})

describe('procesos guardados en el navegador', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  it('un proceso existe desde que la persona escribe, no desde que abre un camino', () => {
    const s = newSession('quiebre')
    // La apertura del coach es un mensaje de control oculto: no cuenta.
    const abierto = { ...s, messages: [{ role: 'user' as const, text: '(apertura)', hidden: true, stage: 'diagnostico' as const }] }
    expect(hasProgress(abierto)).toBe(false)
    saveSession(abierto)
    expect(listSessions()).toHaveLength(0)
    saveSession(talk(s, '2026-10-01T10:00:00Z'))
    expect(listSessions()).toHaveLength(1)
  })

  it('empezar otro camino no borra el anterior y la lista va del más reciente al más viejo', () => {
    const a = talk(newSession('quiebre'), '2026-10-01T10:00:00Z')
    const c = talk(newSession('formacion'), '2026-10-02T10:00:00Z')
    saveSession(a)
    saveSession(c)
    expect(listSessions().map((s) => s.path)).toEqual(['formacion', 'quiebre'])
  })

  it('guardar de nuevo actualiza el mismo proceso y borrar quita solo ese', () => {
    const a = talk(newSession('quiebre'), '2026-10-01T10:00:00Z')
    const c = talk(newSession('formacion'), '2026-10-02T10:00:00Z')
    saveSession(a)
    saveSession(c)
    saveSession({ ...a, stage: 'discovery', updatedAt: '2026-10-03T10:00:00Z' })
    expect(listSessions()).toHaveLength(2)
    expect(listSessions()[0].stage).toBe('discovery')
    deleteSession(a.id)
    expect(listSessions().map((s) => s.id)).toEqual([c.id])
  })

  it('migra el proceso único guardado antes', () => {
    const old = { ...talk(newSession('perfil'), '2026-09-30T10:00:00Z'), id: undefined }
    localStorage.setItem('cp_coach_session_v2', JSON.stringify(old))
    const list = listSessions()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBeTruthy()
    expect(localStorage.getItem('cp_coach_session_v2')).toBeNull()
  })

  it('descarta los más viejos al pasar el tope', () => {
    for (let i = 0; i < MAX_SESSIONS + 3; i++) {
      saveSession(talk(newSession('quiebre'), `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`))
    }
    const list = listSessions()
    expect(list).toHaveLength(MAX_SESSIONS)
    expect(list[0].updatedAt).toBe(`2026-10-${String(MAX_SESSIONS + 3).padStart(2, '0')}T10:00:00Z`)
  })
})
