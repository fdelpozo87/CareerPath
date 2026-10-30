import { describe, expect, it } from 'vitest'
import { normalizeOffers, sharedDocKinds } from '../server/coach'
import { buildTurnSystemPrompt } from '../server/prompts'

// Camino A: el modelo decide si le sirve ver el CV o el LinkedIn, o si conviene el Camino B. El servidor limita cuándo y cuántas veces.

type Msg = { role: 'user' | 'model'; text: string }
const user = (text: string): Msg => ({ role: 'user', text })
const coach = (extra: Record<string, unknown> = {}): Msg => ({ role: 'model', text: JSON.stringify({ mensaje: 'ok', temaEnFoco: 'goal', ...extra }) })
const opening: Msg = user('(Inicio de la sesión, Camino A.)')
const turns = (n: number): Msg[] => [opening, ...Array.from({ length: n }, (_, i) => [coach(), user(`respuesta ${i + 1}`)]).flat()]

const base = { path: 'quiebre' as const, stage: 'diagnostico' as const, listo: false, derivacion: false }
const asks = { pideDocumentos: ['cv' as const] }

describe('normalizeOffers: pedir documentos', () => {
  it('no se pide al arrancar: hacen falta al menos dos respuestas de la persona', () => {
    expect(normalizeOffers(asks, { ...base, history: turns(0) })).toEqual({})
    expect(normalizeOffers(asks, { ...base, history: turns(1) })).toEqual({})
    expect(normalizeOffers(asks, { ...base, history: turns(2) })).toEqual({ pideDocumentos: ['cv'] })
  })

  it('el mensaje de control del inicio no cuenta como una respuesta', () => {
    expect(normalizeOffers(asks, { ...base, history: [opening, user('(otra instrucción)')] })).toEqual({})
  })

  it('se pide una sola vez: si ya se ofreció, no se insiste', () => {
    const history = [...turns(2), coach({ pideDocumentos: ['cv'] }), user('ahora no')]
    expect(normalizeOffers(asks, { ...base, history })).toEqual({})
  })

  it('no se piden los que la persona ya compartió', () => {
    const documentos = '=== CV ===\nTrabajé en…'
    expect(normalizeOffers({ pideDocumentos: ['cv'] }, { ...base, history: turns(3), documentos })).toEqual({})
    expect(normalizeOffers({ pideDocumentos: ['cv', 'linkedin'] }, { ...base, history: turns(3), documentos })).toEqual({ pideDocumentos: ['linkedin'] })
    expect(sharedDocKinds('=== CV ===\na\n\n=== LINKEDIN ===\nb')).toEqual(['cv', 'linkedin'])
  })

  it('descarta valores inventados y repetidos', () => {
    const raw = { pideDocumentos: ['cv', 'cv', 'pasaporte'] as never }
    expect(normalizeOffers(raw, { ...base, history: turns(3) })).toEqual({ pideDocumentos: ['cv'] })
  })

  it('nunca en el cierre de una etapa, ante una derivación, ni en el plan de acción', () => {
    expect(normalizeOffers(asks, { ...base, history: turns(3), listo: true })).toEqual({})
    expect(normalizeOffers(asks, { ...base, history: turns(3), derivacion: true })).toEqual({})
    expect(normalizeOffers(asks, { ...base, stage: 'plan', history: turns(3) })).toEqual({})
  })

  it('solo en el Camino A', () => {
    expect(normalizeOffers(asks, { ...base, path: 'perfil', history: turns(3) })).toEqual({})
    expect(normalizeOffers(asks, { ...base, path: 'formacion', history: turns(3) })).toEqual({})
  })
})

describe('normalizeOffers: sugerir el Camino B', () => {
  const suggest = { sugiereCamino: 'perfil' as const }

  it('hacen falta tres respuestas y se sugiere una sola vez', () => {
    expect(normalizeOffers(suggest, { ...base, history: turns(2) })).toEqual({})
    expect(normalizeOffers(suggest, { ...base, history: turns(3) })).toEqual({ sugiereCamino: 'perfil' })
    expect(normalizeOffers(suggest, { ...base, history: [...turns(3), coach({ sugiereCamino: 'perfil' }), user('sigo acá')] })).toEqual({})
  })

  it('solo vale "perfil", y no en cierres ni derivaciones', () => {
    expect(normalizeOffers({ sugiereCamino: 'formacion' as never }, { ...base, history: turns(3) })).toEqual({})
    expect(normalizeOffers(suggest, { ...base, history: turns(3), listo: true })).toEqual({})
    expect(normalizeOffers(suggest, { ...base, history: turns(3), derivacion: true })).toEqual({})
  })

  it('si en el mismo turno pide documentos, esa es la única oferta', () => {
    expect(normalizeOffers({ ...asks, ...suggest }, { ...base, history: turns(3) })).toEqual({ pideDocumentos: ['cv'] })
  })
})

describe('instrucciones del modelo', () => {
  const ctx = { stage: 'diagnostico' as const, path: 'quiebre' as const, sintesisPrevias: {} }

  it('el Camino A explica cuándo pedir documentos y cuándo sugerir el Camino B', () => {
    const p = buildTurnSystemPrompt(ctx)
    expect(p).toContain('La persona NO subió su CV ni su LinkedIn')
    expect(p).toContain('"pideDocumentos"')
    expect(p).toContain('Camino B')
  })

  it('los otros caminos no reciben esa guía', () => {
    expect(buildTurnSystemPrompt({ ...ctx, path: 'perfil' })).not.toContain('La persona NO subió su CV')
    expect(buildTurnSystemPrompt({ ...ctx, path: 'formacion' })).not.toContain('La persona NO subió su CV')
  })
})
