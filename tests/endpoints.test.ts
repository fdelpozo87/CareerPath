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

const KEY = 'test-key'
let ipCounter = 0

function makeReq(body: unknown, opts: { method?: string; origin?: string | null; ip?: string; code?: string } = {}) {
  const headers: Record<string, string> = { host: 'careerpath.test', 'x-forwarded-for': opts.ip ?? `10.0.0.${++ipCounter}` }
  if (opts.code !== undefined) headers['x-access-code'] = opts.code
  if (opts.origin !== null) headers.origin = opts.origin ?? 'https://careerpath.test'
  return { method: opts.method ?? 'POST', headers, body, socket: {} } as unknown as Parameters<typeof runEndpoint>[1]
}

const modelReply = (obj: unknown) => ({ response: { text: () => JSON.stringify(obj) } })

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
    const r = await runEndpoint('coach', makeReq(turnBody({ cubiertos: ['goal', 'reality', 'options'] })), KEY)
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
    expect((await runEndpoint('access', makeReq({ code: 'K7QM-X2PD-9RTA' }), KEY)).body).toEqual({ required: true, ok: true })
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
