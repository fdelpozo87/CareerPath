import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/cloud', () => ({
  currentUser: vi.fn(async () => ({ id: 'u1', email: 'ana@x.test' })),
  listSavedReports: vi.fn(async () => [{ processId: 'p1', path: 'quiebre', informe: { objetivoSesion: 'x' }, compromisos: [0], updatedAt: '2026-10-01T00:00:00Z' }]),
}))
vi.mock('../src/lib/coach/session', () => ({
  listSessions: vi.fn(() => [{ id: 'p2', path: 'formacion', messages: [{ role: 'user', text: 'Hola', stage: 'diagnostico' }] }]),
}))

import { buildExport } from '../src/lib/exportData'
import { currentUser } from '../src/lib/cloud'

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null })
  vi.stubGlobal('navigator', { language: 'es-AR' })
})

describe('descargar mis datos', () => {
  it('junta lo del navegador y lo guardado en la cuenta', async () => {
    const data = await buildExport()
    expect(data.cuenta).toEqual({ email: 'ana@x.test' })
    expect(data.procesosEnEsteNavegador).toHaveLength(1)
    expect(data.informesGuardadosEnLaCuenta).toHaveLength(1)
    expect(Date.parse(data.exportadoEl)).not.toBeNaN()
  })

  it('sin cuenta exporta solo lo del navegador', async () => {
    vi.mocked(currentUser).mockResolvedValueOnce(null)
    const data = await buildExport()
    expect(data.cuenta).toBeNull()
    expect(data.informesGuardadosEnLaCuenta).toEqual([])
    expect(data.procesosEnEsteNavegador).toHaveLength(1)
  })
})
