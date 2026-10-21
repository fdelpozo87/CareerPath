import { describe, expect, it } from 'vitest'
import { marketSearches } from '../server/coach'
import { MAX_MARKET_PER_CONVERSATION, cleanSources } from '../server/market'
import { buildTurnSystemPrompt } from '../server/prompts'
import { en, es } from '../shared/locales/dictionaries'

describe('datos de mercado con fuente', () => {
  it('solo se enlazan fuentes https, sin repetir y con tope', () => {
    const chunk = (uri: string, title: string) => ({ web: { uri, title } })
    const out = cleanSources({
      groundingChunks: [
        chunk('https://a.example/1', 'a.example'),
        chunk('https://a.example/2', 'a.example'),
        chunk('http://inseguro.example/x', 'inseguro.example'),
        chunk('javascript:alert(1)', 'xss'),
        chunk('https://b.example/1', ''),
        chunk('https://c.example', 'c.example'),
        chunk('https://d.example', 'd.example'),
        chunk('https://e.example', 'e.example'),
        chunk('https://f.example', 'f.example'),
      ],
    })
    expect(out.map((s) => s.titulo)).toEqual(['a.example', 'c.example', 'd.example', 'e.example'])
    expect(cleanSources(undefined)).toEqual([])
  })

  it('cuenta los turnos que ya usaron datos de mercado y no se confunde con texto viejo', () => {
    const turn = (extra: object) => ({ role: 'model' as const, text: JSON.stringify({ mensaje: 'x', ...extra }) })
    const history = [
      { role: 'user' as const, text: 'hola' },
      turn({ fuentes: [{ titulo: 'a.example', url: 'https://a.example' }] }),
      turn({ fuentes: [] }),
      turn({}),
      { role: 'model' as const, text: 'no es JSON' },
      turn({ fuentes: [{ titulo: 'b.example', url: 'https://b.example' }] }),
    ]
    expect(marketSearches(history)).toBe(2)
    expect(MAX_MARKET_PER_CONVERSATION).toBeGreaterThan(2)
  })

  it('el prompt pide la búsqueda y prohíbe inventar cifras (A, B y C)', () => {
    for (const path of ['quiebre', 'perfil', 'formacion'] as const) {
      const p = buildTurnSystemPrompt({ stage: 'diagnostico', path, sintesisPrevias: {} })
      expect(p).toMatch(/"consultaMercado"/)
      expect(p).toMatch(/Nunca agregues cifras que no estén en ese bloque/)
    }
    expect(buildTurnSystemPrompt({ stage: 'discovery', path: 'formacion', sintesisPrevias: {} })).toMatch(/solo puedes usar los que aparezcan en un bloque "DATOS DE MERCADO"/)
  })

  it('los avisos al modelo y los textos de fuentes existen en los dos idiomas', () => {
    for (const d of [es, en]) {
      for (const k of ['srv.market.ok', 'srv.market.none', 'srv.market.limit', 'chat.sources.title', 'chat.sources.note'] as const) expect(d[k]).toBeTruthy()
    }
    expect(es['srv.market.ok']).toContain('{sources}')
    expect(en['srv.market.ok']).toContain('{date}')
  })
})

describe('red de seguridad para las preguntas de mercado', () => {
  it('reconoce preguntas por sueldos, costos y salida laboral', async () => {
    const { looksLikeMarketQuestion } = await import('../server/market')
    for (const t of ['¿Cuánto cuesta una diplomatura?', 'qué sueldo se cobra al empezar', 'Quiero saber la salida laboral', 'How much does it cost?', 'What are the salaries like?']) {
      expect(looksLikeMarketQuestion(t), t).toBe(true)
    }
    for (const t of ['Me gusta trabajar con personas', 'Tengo 29 años y trabajo en logística', 'No sé qué estudiar']) {
      expect(looksLikeMarketQuestion(t), t).toBe(false)
    }
  })
})

describe('red de seguridad contra formas con género', () => {
  it('cambia el saludo con género y "juntas/juntos" en español', async () => {
    const { neutralizeGender } = await import('../server/lang')
    expect(neutralizeGender('Bienvenida, qué bueno tenerte por aquí.', 'es')).toBe('Hola. Qué bueno tenerte por aquí.')
    expect(neutralizeGender('¡Bienvenido! Vamos a recorrerlo juntos.', 'es')).toBe('Hola. Vamos a recorrerlo en conjunto.')
    expect(neutralizeGender('Lo vemos juntas, paso a paso.', 'es')).toBe('Lo vemos en conjunto, paso a paso.')
  })

  it('no toca palabras que solo contienen esas letras ni el inglés', async () => {
    const { neutralizeGender } = await import('../server/lang')
    expect(neutralizeGender('Es una conjuntas rara', 'es')).toBe('Es una conjuntas rara')
    expect(neutralizeGender('Welcome, we will do it together', 'en')).toBe('Welcome, we will do it together')
  })
})

describe('informe con plan completo', () => {
  it('el prompt pide plazos y que se señalen los huecos sin inventar acciones', async () => {
    const { buildReportPrompt } = await import('../server/prompts')
    const p = buildReportPrompt({ path: 'quiebre', sintesisPrevias: {} })
    expect(p).toMatch(/Cada acción dice para cuándo/)
    expect(p).toMatch(/NO inventes una/)
    expect(p).toMatch(/"faltaParaCompletar"/)
    expect(p).toMatch(/No agregues acciones para cubrirlas/)
  })

  it('normalizeReport deja una lista corta de textos', async () => {
    const { normalizeReport } = await import('../server/coach')
    const out = normalizeReport({ objetivoSesion: 'x', faltaParaCompletar: ['  Un plan B  ', '', 5, 'a'.repeat(400), 'c', 'd', 'e'] })
    expect(out.faltaParaCompletar).toEqual(['Un plan B', 'a'.repeat(240), 'c', 'd'])
    expect(normalizeReport({}).faltaParaCompletar).toEqual([])
    expect(normalizeReport({ faltaParaCompletar: 'no es lista' }).faltaParaCompletar).toEqual([])
  })
})
