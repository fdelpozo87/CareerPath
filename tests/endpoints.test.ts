import { beforeEach, describe, expect, it, vi } from 'vitest'

// Gemini simulado: cada test define qué devuelve (o qué error tira) el modelo.
const gemini = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: gemini.generateContent }
    }
  },
}))

import { runEndpoint } from '../server/endpoints'
import { resetRateLimits } from '../server/guard'
import { askCounts } from '../server/coach'
import { wrongLanguage } from '../server/lang'
import { buildProfilePrompt, buildReportPrompt, buildTurnSystemPrompt } from '../server/prompts'
import { en, es } from '../shared/locales/dictionaries'
import { readFileSync } from 'node:fs'

const KEY = 'test-key'
let ipCounter = 0

function makeReq(body: unknown, opts: { method?: string; origin?: string | null; ip?: string; code?: string; lang?: string } = {}) {
  const headers: Record<string, string> = { host: 'careerpath.test', 'x-forwarded-for': opts.ip ?? `10.0.0.${++ipCounter}` }
  if (opts.code !== undefined) headers['x-access-code'] = opts.code
  if (opts.lang !== undefined) headers['x-lang'] = opts.lang
  if (opts.origin !== null) headers.origin = opts.origin ?? 'https://careerpath.test'
  return { method: opts.method ?? 'POST', headers, body, socket: {} } as unknown as Parameters<typeof runEndpoint>[1]
}

const modelReply = (obj: unknown) => ({ response: { text: () => JSON.stringify(obj) } })

/** Turno previo del coach en el que ya estaban todos los temas cubiertos (u omitidos): ahí hizo la pregunta de cierre. */
const closingAsked = (cubiertos: string[], omitidos: string[] = []) => ({
  role: 'model' as const,
  text: JSON.stringify({ mensaje: '¿Hay algo que quieras ajustar o sumar antes de que te arme el mapa?', objetivosCubiertos: cubiertos, temasOmitidos: omitidos }),
})
const ALL_A = ['goal', 'reality', 'options', 'will']

const turnBody = (overrides: Record<string, unknown> = {}) => ({
  mode: 'turno',
  stage: 'diagnostico',
  path: 'quiebre',
  history: [{ role: 'user', text: 'Hola' }],
  cubiertos: [],
  sintesisPrevias: {},
  ...overrides,
})

beforeEach(() => {
  // Los tests parten de "sin restricción de acceso" (como en local); cada uno que
  // necesite la puerta de acceso configura su propio entorno.
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('ACCESS_CODES', '')
  resetRateLimits()
  gemini.generateContent.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('capa HTTP', () => {
  it('rechaza métodos distintos de POST', async () => {
    const r = await runEndpoint('coach', makeReq(turnBody(), { method: 'GET' }), KEY)
    expect(r.status).toBe(405)
  })

  it('rechaza pedidos sin Origin o de otro sitio', async () => {
    expect((await runEndpoint('coach', makeReq(turnBody(), { origin: null }), KEY)).status).toBe(403)
    expect((await runEndpoint('coach', makeReq(turnBody(), { origin: 'https://evil.example' }), KEY)).status).toBe(403)
  })

  it('aplica rate limit por IP y devuelve Retry-After', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: '¿Qué te trae?', objetivosCubiertos: [] }))
    const statuses: number[] = []
    let last
    for (let i = 0; i < 21; i++) {
      last = await runEndpoint('coach', makeReq(turnBody(), { ip: '1.2.3.4' }), KEY)
      statuses.push(last.status)
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true)
    expect(last!.status).toBe(429)
    expect(last!.headers?.['Retry-After']).toBeDefined()
  })

  it('limita más estrictamente la lectura de documentos', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ texto: 'cv' }))
    let last
    for (let i = 0; i < 11; i++) last = await runEndpoint('coach', makeReq({ mode: 'extraer', pdfBase64: 'JVBERi0x' }, { ip: '5.6.7.8' }), KEY)
    expect(last!.status).toBe(429)
  })
})

describe('/api/coach', () => {
  it('valida el payload', async () => {
    expect((await runEndpoint('coach', makeReq({ mode: 'x' }), KEY)).status).toBe(400)
    expect((await runEndpoint('coach', makeReq(turnBody({ stage: 'otra' })), KEY)).status).toBe(400)
    // El historial debe empezar con la persona, no con el modelo.
    expect((await runEndpoint('coach', makeReq(turnBody({ history: [{ role: 'model', text: 'x' }] })), KEY)).status).toBe(400)
    expect((await runEndpoint('coach', makeReq(turnBody({ history: [{ role: 'user', text: 'x'.repeat(6001) }] })), KEY)).status).toBe(400)
  })

  it('no deja avanzar de etapa si faltan objetivos, aunque el modelo lo pida (§3)', async () => {
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: 'Listo', objetivosCubiertos: ['goal', 'inventado'], listoParaAvanzar: true, sintesisEtapa: 'x' }),
    )
    const r = await runEndpoint('coach', makeReq(turnBody()), KEY)
    const data = (r.body as { data: { listoParaAvanzar: boolean; objetivosCubiertos: string[]; sintesisEtapa: string } }).data
    expect(data.listoParaAvanzar).toBe(false)
    expect(data.objetivosCubiertos).toEqual(['goal']) // descarta ids inválidos
    expect(data.sintesisEtapa).toBe('')
  })

  it('avanza cuando todos los objetivos están cubiertos (acumulando los previos)', async () => {
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: 'Cerramos', objetivosCubiertos: ['will'], listoParaAvanzar: true, sintesisEtapa: 'Síntesis' }),
    )
    const history = [{ role: 'user', text: 'Hola' }, closingAsked(ALL_A), { role: 'user', text: 'No, así está bien.' }]
    const r = await runEndpoint('coach', makeReq(turnBody({ cubiertos: ['goal', 'reality', 'options'], history })), KEY)
    const data = (r.body as { data: { listoParaAvanzar: boolean; sintesisEtapa: string } }).data
    expect(data.listoParaAvanzar).toBe(true)
    expect(data.sintesisEtapa).toBe('Síntesis')
  })

  it('reintenta una vez si el modelo devuelve JSON roto', async () => {
    gemini.generateContent
      .mockResolvedValueOnce({ response: { text: () => '{"mensaje": "cortado' } })
      .mockResolvedValueOnce(modelReply({ mensaje: 'OK', objetivosCubiertos: [] }))
    const r = await runEndpoint('coach', makeReq(turnBody()), KEY)
    expect(r.status).toBe(200)
    expect(gemini.generateContent).toHaveBeenCalledTimes(2)
  })

  it('no expone el error crudo del proveedor ni la key', async () => {
    gemini.generateContent.mockRejectedValue(
      new Error('[GoogleGenerativeAI Error]: Error fetching https://generativelanguage.googleapis.com/...?key=AIzaSyFAKEFAKEFAKEFAKEFAKE12345: [404 Not Found] model gone'),
    )
    const r = await runEndpoint('coach', makeReq(turnBody()), KEY)
    const text = JSON.stringify(r.body)
    expect(r.status).toBe(502)
    expect(text).not.toMatch(/AIza|googleapis|404|model/)
    // Y el log tampoco imprime la key.
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).not.toMatch(/AIzaSyFAKE/)
  })

  it('mapea la sobrecarga del proveedor (429) a un mensaje amable', async () => {
    gemini.generateContent.mockRejectedValue(new Error('[429 Too Many Requests] quota'))
    const r = await runEndpoint('coach', makeReq(turnBody()), KEY)
    expect(r.status).toBe(503)
    expect((r.body as { error: string }).error).toMatch(/demanda/)
  })

  it('funciona en modo demo sin API key', async () => {
    const r = await runEndpoint('coach', makeReq(turnBody()), undefined)
    expect(r.status).toBe(200)
    expect((r.body as { demo: boolean }).demo).toBe(true)
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })

  it('lectura de perfil exige texto suficiente', async () => {
    const r = await runEndpoint('coach', makeReq({ mode: 'perfil', puesto: 'PM', perfilTexto: 'corto' }), KEY)
    expect(r.status).toBe(400)
  })
})

describe('mapa de cierre de etapa', () => {
  const history = [
    { role: 'user', text: '(apertura)' },
    closingAsked(ALL_A),
    { role: 'user', text: 'Quiero pasar a producto, pero no sé si estoy lista. Hace 4 años soy analista.' },
  ]
  const ready = (extra: Record<string, unknown>) =>
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: 'Cerramos', objetivosCubiertos: ['goal', 'reality', 'options', 'will'], listoParaAvanzar: true, ...extra }),
    )
  const run = async () => {
    const r = await runEndpoint('coach', makeReq(turnBody({ history })), KEY)
    return (r.body as { data: { sintesisEtapa: string; sintesisItems: { id: string; texto: string; cita: string }[]; preguntaPuente: string } }).data
  }

  it('conserva las citas textuales y descarta las que la persona no dijo (guardrail §5)', async () => {
    ready({
      sintesisItems: [
        { id: 'goal', texto: 'Querés pasar a producto.', cita: 'no sé si estoy lista' },
        { id: 'reality', texto: 'Sos analista hace 4 años.', cita: 'me siento un fracaso total' }, // inventada
      ],
    })
    const d = await run()
    expect(d.sintesisItems.find((i) => i.id === 'goal')?.cita).toBe('no sé si estoy lista')
    expect(d.sintesisItems.find((i) => i.id === 'reality')?.cita).toBe('') // se descarta la cita, se conserva el texto
    expect(d.sintesisItems.find((i) => i.id === 'reality')?.texto).toBe('Sos analista hace 4 años.')
  })

  it('ignora la puntuación al comparar citas', async () => {
    ready({ sintesisItems: [{ id: 'goal', texto: 'x', cita: '“Quiero pasar a producto”' }] })
    expect((await run()).sintesisItems[0].cita).toContain('Quiero pasar a producto')
  })

  it('descarta ids que no son de la etapa, duplicados y textos vacíos, y ordena según la etapa', async () => {
    ready({
      sintesisItems: [
        { id: 'will', texto: 'Tercero', cita: '' },
        { id: 'inventado', texto: 'No va', cita: '' },
        { id: 'goal', texto: 'Primero', cita: '' },
        { id: 'goal', texto: 'Duplicado', cita: '' },
        { id: 'options', texto: '   ', cita: '' },
      ],
    })
    const d = await run()
    expect(d.sintesisItems.map((i) => i.id)).toEqual(['goal', 'will'])
    expect(d.sintesisItems[0].texto).toBe('Primero')
  })

  it('compone el resumen desde el mapa si el modelo lo omitió, y limita los largos', async () => {
    ready({ sintesisItems: [{ id: 'goal', texto: 'A'.repeat(900), cita: '' }], preguntaPuente: 'B'.repeat(900) })
    const d = await run()
    expect(d.sintesisEtapa.length).toBe(400)
    expect(d.preguntaPuente.length).toBe(300)
  })

  it('si el modelo cierra la etapa con el mensaje vacío, usa un cierre cálido (no "¿Me contás más?")', async () => {
    ready({ mensaje: '', sintesisItems: [{ id: 'goal', texto: 'x', cita: '' }] })
    const r = await runEndpoint('coach', makeReq(turnBody({ history })), KEY)
    const msg = (r.body as { data: { mensaje: string } }).data.mensaje
    expect(msg).toMatch(/mapa/)
    expect(msg).not.toMatch(/contás un poco más/)
  })

  it('si la etapa no está completa, no devuelve mapa ni pregunta aunque el modelo los mande', async () => {
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: 'Seguimos', objetivosCubiertos: ['goal'], listoParaAvanzar: true, sintesisItems: [{ id: 'goal', texto: 'x', cita: '' }], preguntaPuente: '¿?' }),
    )
    const d = await run()
    expect(d.sintesisItems).toEqual([])
    expect(d.preguntaPuente).toBe('')
    expect(d.sintesisEtapa).toBe('')
  })
})

describe('una etapa cerrada no se reabre sola', () => {
  const all4 = ['goal', 'reality', 'options', 'will']
  const asked = (extra: Record<string, unknown> = {}) =>
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: '¿Qué parte de tu recorrido querés mirar más?', objetivosCubiertos: all4, listoParaAvanzar: false, ...extra }),
    )

  it('si ya estaba cerrada y el modelo responde con otra pregunta, sigue cerrada', async () => {
    asked()
    const r = await runEndpoint('coach', makeReq(turnBody({ cubiertos: all4, etapaCerrada: true })), KEY)
    expect((r.body as { data: { listoParaAvanzar: boolean } }).data.listoParaAvanzar).toBe(true)
  })

  it('sin cierre previo, el modelo que pregunta no cierra (el criterio sigue siendo el de siempre)', async () => {
    asked()
    const r = await runEndpoint('coach', makeReq(turnBody({ cubiertos: all4, etapaCerrada: false })), KEY)
    expect((r.body as { data: { listoParaAvanzar: boolean } }).data.listoParaAvanzar).toBe(false)
  })

  it('no fuerza el cierre si faltan temas, aunque el cliente diga que estaba cerrada', async () => {
    asked({ objetivosCubiertos: ['goal'] })
    const r = await runEndpoint('coach', makeReq(turnBody({ cubiertos: ['goal'], etapaCerrada: true })), KEY)
    expect((r.body as { data: { listoParaAvanzar: boolean } }).data.listoParaAvanzar).toBe(false)
  })

  it('rechaza un etapaCerrada que no sea booleano', async () => {
    expect((await runEndpoint('coach', makeReq(turnBody({ etapaCerrada: 'si' })), KEY)).status).toBe(400)
  })

  it('le indica al modelo que no abra temas nuevos cuando la etapa está cerrada', () => {
    const ctx = { stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {} } as const
    expect(buildTurnSystemPrompt({ ...ctx, etapaCerrada: true })).toMatch(/La etapa ya está cerrada[\s\S]*NO abras temas nuevos/)
    expect(buildTurnSystemPrompt({ ...ctx, etapaCerrada: false })).not.toMatch(/La etapa ya está cerrada/)
  })
})

describe('cuando la persona esquiva un tema', () => {
  const coachTurn = (foco: string) => ({ role: 'model' as const, text: JSON.stringify({ mensaje: 'x', temaEnFoco: foco }) })
  const user = (text: string) => ({ role: 'user' as const, text })

  it('cuenta cuántas veces se preguntó por cada tema que sigue pendiente', () => {
    const history = [user('hola'), coachTurn('goal'), user('a'), coachTurn('options'), user('no sé'), coachTurn('options'), user('...'), coachTurn('will')]
    // goal ya está cubierto: no cuenta. options se preguntó 2 veces y sigue pendiente. will, 1.
    expect(askCounts(history, 'diagnostico', ['goal'])).toEqual({ options: 2, will: 1 })
  })

  it('ignora turnos sin JSON (sesiones viejas) y temas de otra etapa', () => {
    const history = [user('hola'), { role: 'model' as const, text: 'texto suelto' }, coachTurn('horizonte')]
    expect(askCounts(history, 'diagnostico', [])).toEqual({})
  })

  it('le dice al modelo qué temas están cubiertos, cuáles faltan y cuántas veces ya preguntó', () => {
    const prompt = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {}, cubiertos: ['goal'], intentos: { options: 2 } })
    expect(prompt).toMatch(/"goal" \[cubierto\]/)
    expect(prompt).toMatch(/"options" \[PENDIENTE — ya preguntaste por este tema 2 veces/)
    expect(prompt).toMatch(/"will" \[pendiente — todavía no preguntaste/)
    expect(prompt).toMatch(/Cuando la persona esquiva un tema/)
    expect(prompt).toMatch(/no ofrezcas esa elección más de dos veces seguidas/i)
  })

  const focusOf = async (raw: Record<string, unknown>, cubiertos: string[] = []) => {
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'x', objetivosCubiertos: cubiertos, listoParaAvanzar: false, ...raw }))
    const r = await runEndpoint('coach', makeReq(turnBody({ cubiertos })), KEY)
    return (r.body as { data: { temaEnFoco: string } }).data.temaEnFoco
  }

  it('devuelve el tema en foco solo si es de la etapa y sigue pendiente', async () => {
    expect(await focusOf({ temaEnFoco: 'options' }, ['goal'])).toBe('options')
    expect(await focusOf({ temaEnFoco: 'inventado' })).toBe('')
    expect(await focusOf({ temaEnFoco: 'horizonte' })).toBe('') // es de otra etapa
    expect(await focusOf({ temaEnFoco: 'goal', objetivosCubiertos: ['goal'] }, ['goal'])).toBe('') // ya cubierto
    expect(await focusOf({})).toBe('')
  })
})

describe('dejar un tema para más adelante', () => {
  const coachAsked = (foco: string) => ({ role: 'model', text: JSON.stringify({ mensaje: 'x', temaEnFoco: foco }) })
  // La persona ya contó su objetivo, su situación y su compromiso; sobre los caminos preguntaron y no contestó.
  const talked = [
    { role: 'user', text: 'Quiero pasar a producto. Hace 4 años soy analista. Voy a dedicarle dos horas por semana.' },
    coachAsked('options'),
    { role: 'user', text: 'Prefiero no hablar de eso ahora.' },
  ]
  const three = ['goal', 'reality', 'will']
  // Después de que dejó "options", el coach ya hizo la pregunta de cierre y ella confirmó.
  const confirmed = [...talked, closingAsked(three, ['options']), { role: 'user', text: 'No, así está bien.' }]
  const reply = (extra: Record<string, unknown>) =>
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: 'Está perfecto, lo dejamos.', objetivosCubiertos: three, listoParaAvanzar: true, ...extra }),
    )
  type Data = { listoParaAvanzar: boolean; temasOmitidos: string[]; sintesisEtapa: string; sintesisItems: { id: string; omitido?: boolean; texto: string }[] }
  const run = async (overrides: Record<string, unknown> = {}) => {
    const r = await runEndpoint('coach', makeReq(turnBody({ history: talked, cubiertos: three, ...overrides })), KEY)
    return (r.body as { data: Data }).data
  }
  const items = [
    { id: 'goal', texto: 'Querés pasar a producto.', cita: '' },
    { id: 'reality', texto: 'Sos analista hace 4 años.', cita: '' },
    { id: 'will', texto: 'Dos horas por semana.', cita: '' },
  ]

  it('si la persona eligió dejarlo, la etapa cierra y el tema queda como "para más adelante" (no como cubierto)', async () => {
    reply({ temasOmitidos: ['options'], sintesisItems: items })
    const d = await run({ history: confirmed, omitidos: ['options'] })
    expect(d.listoParaAvanzar).toBe(true)
    expect(d.temasOmitidos).toEqual(['options'])
    const dejado = d.sintesisItems.find((i) => i.id === 'options')
    expect(dejado?.omitido).toBe(true)
    expect(dejado?.texto).toMatch(/más adelante/)
    expect(d.sintesisEtapa).toMatch(/Dejó para más adelante: tus caminos/)
  })

  it('no lo acepta si nunca se le preguntó por ese tema (la persona no tuvo la oportunidad de contestar)', async () => {
    reply({ temasOmitidos: ['options'], sintesisItems: items })
    const d = await run({ history: [{ role: 'user', text: 'Quiero pasar a producto.' }] })
    expect(d.temasOmitidos).toEqual([])
    expect(d.listoParaAvanzar).toBe(false)
  })

  it('no deja omitir lo imprescindible, aunque el modelo lo intente', async () => {
    reply({ objetivosCubiertos: ['reality', 'options', 'will'], temasOmitidos: ['goal'], sintesisItems: items })
    const r = await runEndpoint('coach', makeReq(turnBody({ history: [{ role: 'user', text: 'x' }, coachAsked('goal'), { role: 'user', text: 'no sé' }], cubiertos: ['reality', 'options', 'will'] })), KEY)
    const d = (r.body as { data: Data }).data
    expect(d.temasOmitidos).toEqual([])
    expect(d.listoParaAvanzar).toBe(false) // sin objetivo no hay etapa cerrada
  })

  it('respeta el tope de un tema por etapa', async () => {
    reply({ objetivosCubiertos: ['goal', 'reality'], temasOmitidos: ['options', 'will'], sintesisItems: items })
    const history = [{ role: 'user', text: 'x' }, coachAsked('options'), { role: 'user', text: 'no' }, coachAsked('will'), { role: 'user', text: 'tampoco' }]
    const d = await run({ history, cubiertos: ['goal', 'reality'] })
    expect(d.temasOmitidos).toEqual(['options']) // el primero; el segundo no entra
    expect(d.listoParaAvanzar).toBe(false) // "will" sigue pendiente
  })

  it('un tema omitido antes sigue contando en los turnos siguientes', async () => {
    reply({ sintesisItems: items })
    const d = await run({ omitidos: ['options'], history: confirmed })
    expect(d.temasOmitidos).toEqual(['options'])
    expect(d.listoParaAvanzar).toBe(true)
  })

  it('si después la persona sí lo cuenta, deja de figurar como omitido', async () => {
    reply({ objetivosCubiertos: [...three, 'options'], sintesisItems: [...items, { id: 'options', texto: 'Ve tres caminos.', cita: '' }] })
    const d = await run({ omitidos: ['options'], cubiertos: three })
    expect(d.temasOmitidos).toEqual([])
    expect(d.sintesisItems.find((i) => i.id === 'options')?.omitido).toBeUndefined()
  })

  it('en un turno de seguimiento sin mapa nuevo no se manda un mapa con solo los temas dejados', async () => {
    reply({ mensaje: 'De nada.', sintesisItems: [] })
    const d = await run({ omitidos: ['options'], etapaCerrada: true })
    expect(d.listoParaAvanzar).toBe(true)
    expect(d.sintesisItems).toEqual([]) // el cliente conserva el mapa anterior
  })

  it('valida el payload', async () => {
    expect((await runEndpoint('coach', makeReq(turnBody({ omitidos: 'options' })), KEY)).status).toBe(400)
    expect((await runEndpoint('coach', makeReq(turnBody({ omitidos: [1, 2] })), KEY)).status).toBe(400)
  })

  it('le dice al modelo qué temas se pueden dejar, cuáles no, y cuál ya está omitido', () => {
    const prompt = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {}, cubiertos: ['goal'], omitidos: ['options'], intentos: {} })
    expect(prompt).toMatch(/"goal" \[cubierto\] \(NO se puede dejar/)
    expect(prompt).toMatch(/"options" \[OMITIDO — la persona eligió dejarlo para más adelante\] \(se puede dejar/)
    expect(prompt).toMatch(/"reality" \[pendiente[^\]]*\] \(NO se puede dejar/)
    expect(prompt).toMatch(/como máximo 1 por etapa/)
  })
})

describe('el cierre es en dos pasos: primero la pregunta, después el mapa', () => {
  const first = [{ role: 'user', text: 'Hola' }, { role: 'model', text: JSON.stringify({ objetivosCubiertos: ['goal', 'reality', 'options'] }) }, { role: 'user', text: 'Dos horas por semana.' }]
  const run = async (raw: Record<string, unknown>, history: unknown[] = first) => {
    gemini.generateContent.mockResolvedValue(modelReply({ objetivosCubiertos: ALL_A, ...raw }))
    const r = await runEndpoint('coach', makeReq(turnBody({ history, cubiertos: ['goal', 'reality', 'options'] })), KEY)
    return (r.body as { data: { mensaje: string; listoParaAvanzar: boolean; sintesisItems: unknown[] } }).data
  }

  it('si el modelo junta la pregunta y el cierre en un turno, el servidor no cierra todavía', async () => {
    const d = await run({ mensaje: 'Gracias por contarme eso. ¿Repasamos lo que vimos?', listoParaAvanzar: true, sintesisItems: [{ id: 'goal', texto: 'x', cita: '' }] })
    expect(d.listoParaAvanzar).toBe(false)
    expect(d.sintesisItems).toEqual([])
    expect(d.mensaje).toBe('Gracias por contarme eso. ¿Hay algo que quieras ajustar o sumar antes de que te arme el mapa?')
  })

  it('si ya hizo la pregunta en el turno anterior, el siguiente sí cierra', async () => {
    const history = [...first, closingAsked(ALL_A), { role: 'user', text: 'No, está bien.' }]
    const d = await run({ mensaje: 'Gracias.', listoParaAvanzar: true, sintesisItems: [{ id: 'goal', texto: 'x', cita: '' }] }, history)
    expect(d.listoParaAvanzar).toBe(true)
  })

  it('si el modelo no hace la pregunta de ajuste, el servidor la agrega', async () => {
    const d = await run({ mensaje: '¿Querés contarme algo más sobre tu jefe?', listoParaAvanzar: false })
    expect(d.mensaje).toBe('¿Hay algo que quieras ajustar o sumar antes de que te arme el mapa?')
    expect(d.listoParaAvanzar).toBe(false)
  })

  it('conserva la pregunta del modelo si ya es la de ajuste', async () => {
    const d = await run({ mensaje: '¿Querés cambiar algo de lo que me contaste antes de seguir? ¿Algo para ajustar?', listoParaAvanzar: false })
    expect(d.mensaje).toContain('ajustar')
  })
})

describe('no se promete un mapa que no puede existir', () => {
  const history = [
    { role: 'user', text: '(apertura)' },
    { role: 'model', text: '{"temaEnFoco":"reality"}' },
    { role: 'user', text: 'Prefiero dejarlo para más adelante.' },
  ]
  const ask = async (raw: Record<string, unknown>) => {
    gemini.generateContent.mockResolvedValue(modelReply({ objetivosCubiertos: ['goal'], listoParaAvanzar: false, ...raw }))
    const r = await runEndpoint('coach', makeReq(turnBody({ history, cubiertos: ['goal'] })), KEY)
    return (r.body as { data: { mensaje: string } }).data.mensaje
  }

  it('saca la frase del mapa si falta un tema obligatorio y conserva el resto', async () => {
    const m = await ask({ mensaje: 'Entiendo que hoy no tengas ganas, no hay apuro. Te dejo armado tu mapa y lo retomamos cuando quieras.' })
    expect(m).toBe('Entiendo que hoy no tengas ganas, no hay apuro.')
  })

  it('si solo quedaba la promesa, dice la verdad y nombra el tema que falta', async () => {
    const m = await ask({ mensaje: 'Te dejo armado tu mapa con lo que construiste.' })
    expect(m).toContain('me falta que me cuentes')
    expect(m).toContain('Dónde estás hoy')
    expect(m).toContain('queda guardada')
    expect(m.toLowerCase()).not.toContain('te dejo armado')
  })

  it('no toca el mensaje cuando la etapa sí puede cerrarse (la pregunta de cierre menciona el mapa)', async () => {
    gemini.generateContent.mockResolvedValue(
      modelReply({
        mensaje: '¿Hay algo que quieras ajustar o sumar antes de que te arme el mapa?',
        objetivosCubiertos: ['goal', 'reality', 'options', 'will'],
        listoParaAvanzar: false,
      }),
    )
    const r = await runEndpoint('coach', makeReq(turnBody({ history })), KEY)
    expect((r.body as { data: { mensaje: string } }).data.mensaje).toBe('¿Hay algo que quieras ajustar o sumar antes de que te arme el mapa?')
  })

  it('el prompt lista los temas obligatorios que faltan y prohíbe ofrecer dejarlos', () => {
    const p = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {}, cubiertos: ['goal'] })
    expect(p).toContain('NO se puede dejar para más adelante')
    expect(p).toContain('- "reality" (Dónde estás hoy)')
    expect(p).not.toContain('- "goal" (Lo que buscás)') // ya cubierto
    // sin temas obligatorios pendientes (o con la etapa cerrada) el bloque no aparece
    const cerrada = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {}, cubiertos: ['goal'], etapaCerrada: true })
    expect(cerrada).not.toContain('Lo que todavía falta y NO se puede dejar')
  })

  it('la regla de cierre pide una pregunta corta y no un resumen', () => {
    const p = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {} })
    expect(p).toContain('UNA sola oración corta')
    expect(p).toContain('NO resumas')
    expect(p).not.toContain('hiciste un resumen con las palabras de la persona')
  })
})

describe('Camino C: decidir en qué formarse', () => {
  const history = [
    { role: 'user', text: '(apertura)' },
    { role: 'model', text: '¿Qué querés lograr?' },
    { role: 'user', text: 'Quiero estudiar diseño UX, trabajo de día y tengo dos noches por semana libres.' },
  ]
  const ask = (overrides: Record<string, unknown> = {}) => runEndpoint('coach', makeReq(turnBody({ path: 'formacion', history, ...overrides })), KEY)
  type Data = { objetivosCubiertos: string[]; listoParaAvanzar: boolean; sintesisItems: { id: string }[] }

  it('acepta el camino y usa los temas de formación, no los de los otros caminos', async () => {
    gemini.generateContent.mockResolvedValue(
      modelReply({ mensaje: '¿Qué opciones mirás?', objetivosCubiertos: ['proposito', 'situacion', 'goal'], listoParaAvanzar: false }),
    )
    const r = await ask()
    expect(r.status).toBe(200)
    // "goal" es de los caminos A y B: no cuenta en el C.
    expect((r.body as { data: Data }).data.objetivosCubiertos).toEqual(['proposito', 'situacion'])
  })

  it('el prompt del Camino C declara que es para mayores de 18 y que no se conoce la oferta educativa', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'Hola', objetivosCubiertos: [] }))
    await ask()
    // El system prompt va en la configuración del modelo: se prueba directo sobre el constructor.
    const prompt = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'formacion', sintesisPrevias: {} })
    expect(prompt).toContain('mayores de 18')
    expect(prompt).toContain('No conoces la oferta educativa real')
    expect(prompt).toContain('"proposito"')
    expect(prompt).not.toContain('"goal"')
  })

  it('cierra la etapa solo con todos sus temas cubiertos y arma el mapa con ids del camino', async () => {
    gemini.generateContent.mockResolvedValue(
      modelReply({
        mensaje: 'Cerramos',
        objetivosCubiertos: ['proposito', 'situacion', 'alternativas', 'compromiso'],
        listoParaAvanzar: true,
        sintesisItems: [
          { id: 'proposito', texto: 'Querés estudiar diseño UX.', cita: 'Quiero estudiar diseño UX' },
          { id: 'goal', texto: 'No es de este camino', cita: '' },
        ],
      }),
    )
    const done = ['proposito', 'situacion', 'alternativas', 'compromiso']
    const confirmed = [...history.slice(0, 2), closingAsked(done), { role: 'user', text: 'No, así está bien. Quiero estudiar diseño UX.' }]
    const d = ((await ask({ history: confirmed })).body as { data: Data }).data
    expect(d.listoParaAvanzar).toBe(true)
    expect(d.sintesisItems.map((i) => i.id)).toEqual(['proposito'])
  })

  it('los temas de las otras rutas siguen siendo válidos en los caminos A y B', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'x', objetivosCubiertos: ['goal', 'proposito'] }))
    const r = await runEndpoint('coach', makeReq(turnBody({ history })), KEY)
    expect((r.body as { data: Data }).data.objetivosCubiertos).toEqual(['goal'])
  })

  it('el informe del Camino C pide presupuesto, plan B y comparativa solo con lo que la persona dijo', () => {
    const prompt = buildReportPrompt({ path: 'formacion', sintesisPrevias: {} })
    expect(prompt).toContain('"comparativa"')
    expect(prompt).toContain('sin inventar datos de instituciones')
    expect(buildReportPrompt({ path: 'quiebre', sintesisPrevias: {} })).not.toContain('"comparativa"')
  })
})

describe('idiomas: español neutro latinoamericano e inglés', () => {
  const placeholders = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  // Formas de voseo que no deben quedar en ningún texto en español.
  const VOSEO = /(?<!\p{L})(vos|sos|tenés|querés|podés|acá|contame|decime|elegí|escribí|mirá|pedí|retomá|volvé|dejá|hacé|usá|preguntá|completá|marcá|empezá|probá|intentá|revisá|ingresá|esperá|entrá|abrí|tocá|subilo|pegá|arrastrá|elegís|escribís|sabés|necesitás|llevás|hablás)(?!\p{L})/iu

  it('los dos idiomas tienen las mismas claves y las mismas variables', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
    for (const k of Object.keys(es)) expect(placeholders(en[k as keyof typeof en]), k).toBe(placeholders(es[k as keyof typeof es]))
  })

  it('los diccionarios generados coinciden con los JSON de origen (correr node scripts/gen-i18n.mjs)', () => {
    const read = (n: string) => JSON.parse(readFileSync(new URL(`../shared/locales/${n}.json`, import.meta.url), 'utf8')) as Record<string, string>
    expect(read('es')).toEqual(es)
    expect(read('en')).toEqual(en)
  })

  it('ningún texto en español usa voseo', () => {
    const found = Object.entries(es).filter(([, v]) => VOSEO.test(v)).map(([k, v]) => `${k}: ${v}`)
    expect(found).toEqual([])
  })

  it('los prompts en español tampoco usan voseo', () => {
    const base = { stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {} } as const
    for (const text of [
      buildTurnSystemPrompt(base),
      buildTurnSystemPrompt({ ...base, path: 'formacion' }),
      buildReportPrompt({ path: 'quiebre', sintesisPrevias: {} }),
      buildProfilePrompt('PM'),
    ]) {
      // La directiva de idioma nombra esas palabras justamente para prohibirlas: no cuenta.
      const hits = text.replace(/.*nada de "vos".*/g, '').match(new RegExp(VOSEO.source, 'giu')) ?? []
      expect(hits).toEqual([])
      expect(text).toContain('español neutro latinoamericano')
    }
  })

  it('el prompt en inglés pide responder en inglés', () => {
    const p = buildTurnSystemPrompt({ stage: 'diagnostico', path: 'quiebre', sintesisPrevias: {}, lang: 'en' })
    expect(p).toContain('Reply ALWAYS in English')
    expect(p).not.toContain('español neutro latinoamericano')
    expect(buildReportPrompt({ path: 'quiebre', sintesisPrevias: {}, lang: 'en' })).toContain('Reply ALWAYS in English')
    expect(buildProfilePrompt('PM', 'en')).toContain('Reply ALWAYS in English')
  })

  it('el coach en inglés cierra con la pregunta de ajuste en inglés y sin promesas de mapa', async () => {
    const history = [{ role: 'user', text: 'Hi' }, { role: 'model', text: JSON.stringify({ objetivosCubiertos: ['goal', 'reality', 'options'] }) }, { role: 'user', text: 'Two hours a week.' }]
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'Want to say more about your boss?', objetivosCubiertos: ALL_A, listoParaAvanzar: false }))
    const r = await runEndpoint('coach', makeReq(turnBody({ history, cubiertos: ['goal', 'reality', 'options'], lang: 'en' })), KEY)
    expect((r.body as { data: { mensaje: string } }).data.mensaje).toBe('Is there anything you’d like to adjust or add before I put your map together?')

    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'I will leave your map ready for later.', objetivosCubiertos: ['goal'], listoParaAvanzar: false }))
    const r2 = await runEndpoint('coach', makeReq(turnBody({ history: [{ role: 'user', text: 'x' }], cubiertos: ['goal'], lang: 'en' })), KEY)
    const msg = (r2.body as { data: { mensaje: string } }).data.mensaje
    expect(msg).toContain('Where you are today')
    expect(msg.toLowerCase()).not.toContain('leave your map')
  })

  it('detecta si una respuesta salió en el idioma equivocado', () => {
    expect(wrongLanguage('Hola, cuéntame qué es lo que te trae por aquí hoy y cómo te sientes con tu trabajo.', 'en')).toBe(true)
    expect(wrongLanguage('Hello, tell me what brings you here today and how you feel about your work.', 'es')).toBe(true)
    expect(wrongLanguage('Hello, tell me what brings you here today and how you feel about your work.', 'en')).toBe(false)
    expect(wrongLanguage('Hola, cuéntame qué es lo que te trae por aquí hoy y cómo te sientes con tu trabajo.', 'es')).toBe(false)
    expect(wrongLanguage('Sí.', 'en')).toBe(false) // demasiado corto para decidir
    // Un par de palabras en otro idioma (feedback, coach) no cambia el veredicto.
    expect(wrongLanguage('Me contaste que el feedback de tu jefe te cayó mal; ¿qué fue lo que más te pesó de eso?', 'es')).toBe(false)
  })

  it('si el coach contesta en el idioma equivocado, se reintenta una vez con más énfasis', async () => {
    gemini.generateContent
      .mockResolvedValueOnce(modelReply({ mensaje: 'Hola, cuéntame qué es lo que te trae por aquí hoy y cómo te sientes con tu trabajo.', objetivosCubiertos: [] }))
      .mockResolvedValueOnce(modelReply({ mensaje: 'Hi, tell me what brings you here today and how you are feeling about your work.', objetivosCubiertos: [] }))
    const r = await runEndpoint('coach', makeReq(turnBody({ lang: 'en' })), KEY)
    expect(gemini.generateContent).toHaveBeenCalledTimes(2)
    expect((r.body as { data: { mensaje: string } }).data.mensaje).toMatch(/^Hi, tell me/)
    // el segundo intento lleva la nota de énfasis en el último mensaje
    expect(JSON.stringify(gemini.generateContent.mock.calls[1][0])).toContain('IMPORTANT: your reply must be in English only')
  })

  it('si la persona escribe en el otro idioma, el coach le contesta en el suyo y no se reintenta', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'Hola, cuéntame qué es lo que te trae por aquí hoy y cómo te sientes con tu trabajo.', objetivosCubiertos: [] }))
    const history = [{ role: 'user', text: 'Me siento estancada en mi trabajo y no sé qué hacer con eso, hace años que lo pienso.' }]
    await runEndpoint('coach', makeReq(turnBody({ lang: 'en', history })), KEY)
    expect(gemini.generateContent).toHaveBeenCalledTimes(1)
  })

  it('si la respuesta ya está en el idioma pedido, no se reintenta', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'Hi, tell me what brings you here today and how you are feeling about your work.', objetivosCubiertos: [] }))
    await runEndpoint('coach', makeReq(turnBody({ lang: 'en' })), KEY)
    expect(gemini.generateContent).toHaveBeenCalledTimes(1)
    // la nota de idioma viaja siempre en el último mensaje del usuario
    expect(JSON.stringify(gemini.generateContent.mock.calls[0][0])).toContain('(Reply in English.)')
  })

  it('el idioma del pedido se valida', async () => {
    expect((await runEndpoint('coach', makeReq(turnBody({ lang: 'fr' })), KEY)).status).toBe(400)
  })

  it('los mensajes de error siguen el idioma del header x-lang (español por defecto)', async () => {
    const es403 = await runEndpoint('coach', makeReq(turnBody(), { origin: 'https://evil.example' }), KEY)
    const en403 = await runEndpoint('coach', makeReq(turnBody(), { origin: 'https://evil.example', lang: 'en' }), KEY)
    expect((es403.body as { error: string }).error).toBe('Origen no permitido')
    expect((en403.body as { error: string }).error).toBe('Origin not allowed')
  })
})

describe('/api/analyze (Empresas)', () => {
  const companyBody = {
    contexto: { rol: 'Dev', seniority: 'Senior', tiempo: '2 años', casoTipo: 'rendimiento' },
    respuestas: { observacion: 'No cumple sprints', objetivo: 'Que vuelva a su nivel' },
  }

  it('ya no acepta prompts arbitrarios del cliente (proxy abierto cerrado)', async () => {
    const r = await runEndpoint('analyze', makeReq({ parts: [{ text: 'Escribime un poema' }] }), KEY)
    expect(r.status).toBe(400)
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })

  it('rechaza respuestas con claves desconocidas', async () => {
    const r = await runEndpoint('analyze', makeReq({ ...companyBody, respuestas: { hack: 'x' } }), KEY)
    expect(r.status).toBe(400)
  })

  it('arma el prompt en el servidor y devuelve el JSON del modelo', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ tipoDeBrecha: 'Aptitud' }))
    const r = await runEndpoint('analyze', makeReq(companyBody), KEY)
    expect(r.status).toBe(200)
    expect((r.body as { data: { tipoDeBrecha: string } }).data.tipoDeBrecha).toBe('Aptitud')
    const sent = JSON.stringify(gemini.generateContent.mock.calls[0][0])
    expect(sent).toContain('No cumple sprints')
    expect(sent).toContain('HR Coach')
  })
})

describe('acceso de prueba (código de invitación)', () => {
  const CODES = 'ana:K7QM-X2PD-9RTA,luis:H4WZ3NCB6YEF'
  const ok = () => gemini.generateContent.mockResolvedValue(modelReply({ mensaje: 'Hola', objetivosCubiertos: [] }))

  it('sin ACCESS_CODES en local, la API queda abierta', async () => {
    ok()
    expect((await runEndpoint('coach', makeReq(turnBody()), KEY)).status).toBe(200)
    const r = await runEndpoint('access', makeReq({}), KEY)
    expect(r.body).toEqual({ required: false, ok: true })
  })

  it('con ACCESS_CODES, rechaza pedidos sin código o con un código incorrecto — sin llamar a Gemini', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    ok()
    expect((await runEndpoint('coach', makeReq(turnBody()), KEY)).status).toBe(401)
    expect((await runEndpoint('coach', makeReq(turnBody(), { code: 'AAAA-BBBB-CCCC' }), KEY)).status).toBe(401)
    expect((await runEndpoint('analyze', makeReq({}, { code: 'nope' }), KEY)).status).toBe(401)
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })

  it('acepta un código válido, sin importar mayúsculas ni separadores', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    ok()
    expect((await runEndpoint('coach', makeReq(turnBody(), { code: 'K7QM-X2PD-9RTA' }), KEY)).status).toBe(200)
    expect((await runEndpoint('coach', makeReq(turnBody(), { code: 'k7qm x2pd 9rta' }), KEY)).status).toBe(200)
    expect((await runEndpoint('coach', makeReq(turnBody(), { code: 'h4wz-3ncb-6yef' }), KEY)).status).toBe(200)
  })

  it('ignora entradas con códigos demasiado cortos (adivinables)', async () => {
    vi.stubEnv('ACCESS_CODES', 'corto:abc123')
    ok()
    // No hay códigos válidos configurados → en local queda abierto, pero "abc123" no es un código.
    expect((await runEndpoint('access', makeReq({ code: 'abc123' }), KEY)).body).toEqual({ required: false, ok: true })
  })

  it('en Vercel sin ACCESS_CODES falla cerrada (nunca queda abierto por descuido)', async () => {
    vi.stubEnv('VERCEL', '1')
    ok()
    const r = await runEndpoint('coach', makeReq(turnBody()), KEY)
    expect(r.status).toBe(503)
    expect((await runEndpoint('access', makeReq({}), KEY)).status).toBe(503)
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })

  it('/api/access distingue "falta código", "código válido" e "inválido"', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    expect((await runEndpoint('access', makeReq({}), KEY)).body).toEqual({ required: true, ok: false })
    expect((await runEndpoint('access', makeReq({ code: 'K7QM-X2PD-9RTA' }), KEY)).body).toEqual({ required: true, ok: true, label: 'ana' })
    const bad = await runEndpoint('access', makeReq({ code: 'ZZZZ-ZZZZ-ZZZZ' }), KEY)
    expect(bad.status).toBe(401)
    expect(JSON.stringify(bad.body)).not.toMatch(/ana|luis|K7QM/) // no filtra quién existe
    expect((await runEndpoint('access', makeReq({ code: 123 }), KEY)).status).toBe(400)
  })

  it('/api/access también exige que el pedido venga del propio sitio', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    expect((await runEndpoint('access', makeReq({ code: 'K7QM-X2PD-9RTA' }, { origin: 'https://evil.example' }), KEY)).status).toBe(403)
  })

  it('bloquea la adivinanza: tras 10 intentos fallidos, frena incluso al código correcto', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    const ip = '9.9.9.9'
    let last
    for (let i = 0; i < 10; i++) last = await runEndpoint('access', makeReq({ code: `BAD${i}-BAD${i}-BAD${i}` }, { ip }), KEY)
    expect(last!.status).toBe(401)
    const blocked = await runEndpoint('access', makeReq({ code: 'K7QM-X2PD-9RTA' }, { ip }), KEY)
    expect(blocked.status).toBe(429)
    expect(blocked.headers?.['Retry-After']).toBeDefined()
    // Otra IP no se ve afectada.
    expect((await runEndpoint('access', makeReq({ code: 'K7QM-X2PD-9RTA' }, { ip: '8.8.8.8' }), KEY)).status).toBe(200)
  })

  it('cada código tiene su propio tope diario (acota el gasto por persona)', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    ok()
    // 400 por día por código; se usan varias IP para no chocar con el límite por IP.
    let status = 200
    for (let i = 0; i < 401 && status === 200; i++) {
      status = (await runEndpoint('coach', makeReq(turnBody(), { code: 'K7QM-X2PD-9RTA', ip: `20.0.${Math.floor(i / 10)}.${i % 10}` }), KEY)).status
    }
    expect(status).toBe(429)
    // El código de otra persona sigue funcionando.
    expect((await runEndpoint('coach', makeReq(turnBody(), { code: 'H4WZ-3NCB-6YEF' }), KEY)).status).toBe(200)
  })

  it('el log identifica a la persona por etiqueta, no por código', async () => {
    vi.stubEnv('ACCESS_CODES', CODES)
    ok()
    await runEndpoint('coach', makeReq(turnBody(), { code: 'K7QM-X2PD-9RTA' }), KEY)
    const logged = vi.mocked(console.log).mock.calls.flat().join(' ')
    expect(logged).toContain('"who":"ana"')
    expect(logged).not.toMatch(/K7QM|X2PD|9RTA/)
  })
})
