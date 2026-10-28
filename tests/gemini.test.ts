import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GoogleGenerativeAI } from '@google/generative-ai'
import { resilientModel } from '../server/gemini'

// Plan B de modelo: si el principal está sobrecargado, se repite la llamada con el de respaldo.

function fakeGenAI(handlers: Record<string, () => Promise<string>>) {
  const used: string[] = []
  const genAI = {
    getGenerativeModel: (params: { model: string }) => ({
      generateContent: async () => {
        used.push(params.model)
        const text = await handlers[params.model]()
        return { response: { text: () => text } }
      },
    }),
  } as unknown as GoogleGenerativeAI
  return { genAI, used }
}
const overloaded = () => Promise.reject(Object.assign(new Error('[503 Service Unavailable] overloaded'), { status: 503 }))
const params = { model: 'principal' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('resilientModel', () => {
  it('usa el modelo de respaldo cuando el principal está sobrecargado', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'respaldo')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { genAI, used } = fakeGenAI({ principal: overloaded, respaldo: async () => 'respuesta del respaldo' })
    const res = await resilientModel(genAI, params).generateContent('hola')
    expect(res.response.text()).toBe('respuesta del respaldo')
    expect(used).toEqual(['principal', 'respaldo'])
  })

  it('no usa el respaldo si el principal responde', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'respaldo')
    const { genAI, used } = fakeGenAI({ principal: async () => 'ok', respaldo: overloaded })
    await resilientModel(genAI, params).generateContent('hola')
    expect(used).toEqual(['principal'])
  })

  it('un error que no es transitorio (pedido inválido) no se reintenta con otro modelo', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'respaldo')
    const { genAI, used } = fakeGenAI({ principal: () => Promise.reject(Object.assign(new Error('[400 Bad Request] blocked'), { status: 400 })), respaldo: async () => 'x' })
    await expect(resilientModel(genAI, params).generateContent('hola')).rejects.toThrow('400')
    expect(used).toEqual(['principal'])
  })

  it('sin modelo de respaldo configurado, el error sale tal cual', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', '')
    const { genAI, used } = fakeGenAI({ principal: overloaded })
    await expect(resilientModel(genAI, params).generateContent('hola')).rejects.toThrow('503')
    expect(used).toEqual(['principal'])
  })
})
