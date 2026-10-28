import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../src/lib/coach/types'

// Sincronización de sesiones con la cuenta: se prueba la mezcla (gana la más nueva), el borrado desde otro dispositivo
// y el tope de tamaño, con un Supabase de mentira y un localStorage en memoria.

type Row = { user_id: string; process_id: string; data: Session; session_updated_at: string }
let rows: Row[] = []

vi.mock('../src/lib/cloud', () => {
  const builder = () => {
    const api = {
      select: () => api,
      order: () => api,
      limit: () => Promise.resolve({ data: [...rows], error: null }),
      upsert: (row: Row) => {
        rows = [...rows.filter((r) => r.process_id !== row.process_id), row]
        return Promise.resolve({ error: null })
      },
      delete: () => {
        const filters: Record<string, string> = {}
        const del = {
          eq: (k: string, v: string) => {
            filters[k] = v
            return del
          },
          then: (res: (v: unknown) => void) => {
            rows = rows.filter((r) => !Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, string>)[k] === v))
            res({ error: null })
          },
        }
        return del
      },
    }
    return api
  }
  return { getClient: () => ({ from: builder, auth: {} }), currentUser: async () => ({ id: 'u1', email: 'a@b.c' }) }
})
vi.mock('../src/lib/i18n', () => ({ getLang: () => 'es' }))

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

const { listSessions, saveSession, loadSessionById } = await import('../src/lib/coach/session')
const { pullAndMerge, pushSession, MAX_SESSION_BYTES } = await import('../src/lib/sync')

const mk = (id: string, updatedAt: string, texto = 'hola'): Session =>
  ({ id, version: 2, path: 'quiebre', phase: 'chat', stage: 'diagnostico', messages: [{ role: 'user', text: texto, stage: 'diagnostico' }], updatedAt, cubiertos: { diagnostico: [], discovery: [], plan: [] }, sintesis: {}, stageReady: false, documentos: [] }) as unknown as Session
const remoteRow = (s: Session): Row => ({ user_id: 'u1', process_id: s.id, data: s, session_updated_at: s.updatedAt })

beforeEach(() => {
  rows = []
  store.clear()
})

describe('pullAndMerge', () => {
  it('trae lo que solo está en la cuenta', async () => {
    rows = [remoteRow(mk('a', '2026-10-28T10:00:00.000Z', 'desde el celular'))]
    expect(await pullAndMerge()).toBe(1)
    expect(loadSessionById('a')?.messages[0].text).toBe('desde el celular')
  })

  it('sube lo que solo está en este navegador', async () => {
    saveSession(mk('b', '2026-10-28T10:00:00.000Z'), { silent: true })
    await pullAndMerge()
    expect(rows.map((r) => r.process_id)).toEqual(['b'])
  })

  it('de cada sesión gana la versión más nueva, en cualquier dirección', async () => {
    saveSession(mk('c', '2026-10-28T09:00:00.000Z', 'vieja local'), { silent: true })
    saveSession(mk('d', '2026-10-28T12:00:00.000Z', 'nueva local'), { silent: true })
    rows = [remoteRow(mk('c', '2026-10-28T11:00:00.000+00:00', 'nueva remota')), remoteRow(mk('d', '2026-10-28T10:00:00.000+00:00', 'vieja remota'))]
    await pullAndMerge()
    expect(loadSessionById('c')?.messages[0].text).toBe('nueva remota')
    expect(loadSessionById('d')?.messages[0].text).toBe('nueva local')
    expect(rows.find((r) => r.process_id === 'd')?.data.messages[0].text).toBe('nueva local')
  })

  it('una sesión sincronizada que se borró en otro dispositivo se borra acá, y una nueva no', async () => {
    rows = [remoteRow(mk('e', '2026-10-28T10:00:00.000Z'))]
    await pullAndMerge()
    expect(listSessions().map((s) => s.id)).toEqual(['e'])
    rows = [] // se borró desde el otro dispositivo
    saveSession(mk('f', '2026-10-28T11:00:00.000Z'), { silent: true }) // y acá se creó otra
    await pullAndMerge()
    expect(listSessions().map((s) => s.id)).toEqual(['f'])
    expect(rows.map((r) => r.process_id)).toEqual(['f'])
  })
})

describe('pushSession', () => {
  it('no sube una sesión sin progreso ni una demasiado grande', async () => {
    expect(await pushSession({ ...mk('g', '2026-10-28T10:00:00.000Z'), messages: [] })).toBe(false)
    expect(await pushSession(mk('h', '2026-10-28T10:00:00.000Z', 'x'.repeat(MAX_SESSION_BYTES)))).toBe(false)
    expect(rows).toHaveLength(0)
    expect(await pushSession(mk('i', '2026-10-28T10:00:00.000Z'))).toBe(true)
  })
})
