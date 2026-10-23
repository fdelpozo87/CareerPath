/* eslint-disable @typescript-eslint/no-explicit-any -- el Supabase simulado y las respuestas JSON de los tests se manejan sin tipos */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gemini = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: gemini.generateContent }
    }
  },
}))

import { resetAuthCache } from '../server/auth'
import { buildAssignedMail, cleanRespuestas, handleEvaluaciones, normalizeCompetencias, normalizeInforme } from '../server/evaluaciones'
import { resetRateLimits } from '../server/guard'

const JEFA = '11111111-1111-4111-8111-111111111111'
const ANA = '22222222-2222-4222-8222-222222222222'
const LUIS = '33333333-3333-4333-8333-333333333333'
const INACTIVO = '44444444-4444-4444-8444-444444444444'

interface Db {
  users: Record<string, { id: string; email: string }>
  perfiles: Record<string, { estado: string; acceso_profesionales: boolean; acceso_empresas: boolean }>
  evaluaciones: Record<string, any>
  asignaciones: Record<string, any>
  mails: { to: string; subject: string }[]
  seq: number
}

/** Supabase de mentira: lo justo de PostgREST para las consultas de evaluaciones. */
function fakeSupabase(db: Db) {
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (url.includes('api.resend.com')) {
      db.mails.push({ to: body.to, subject: body.subject })
      return json({ id: 'm1' })
    }
    if (url.endsWith('/auth/v1/user')) {
      const u = db.users[String((init?.headers as Record<string, string>).Authorization).slice(7)]
      return u ? json({ id: u.id, email: u.email, email_confirmed_at: '2026-10-01T00:00:00Z', factors: [] }) : json({}, 401)
    }
    const perfil = (id: string) => {
      const u = Object.values(db.users).find((x) => x.id === id)
      const p = db.perfiles[id]
      return u && p ? { user_id: id, email: u.email, created_at: '2026-10-01T00:00:00Z', last_seen_at: new Date().toISOString(), ...p } : null
    }
    if (url.includes('/rest/v1/bivio_perfiles')) {
      if (method === 'PATCH') return new Response(null, { status: 204 })
      const byEmail = /email=eq\.([^&]+)/.exec(url)?.[1]
      const byId = /user_id=eq\.([^&]+)/.exec(url)?.[1]
      if (byEmail) {
        const u = Object.values(db.users).find((x) => x.email === decodeURIComponent(byEmail))
        return json(u && perfil(u.id) ? [perfil(u.id)] : [])
      }
      return json(byId && perfil(byId) ? [perfil(byId)] : [])
    }
    if (url.includes('/rest/v1/bivio_evaluaciones')) {
      if (method === 'POST') {
        const id = `e000000${++db.seq}-0000-4000-8000-000000000000`
        db.evaluaciones[id] = { id, created_at: new Date().toISOString(), ...body }
        return json([db.evaluaciones[id]], 201)
      }
      if (method === 'DELETE') {
        const id = /id=eq\.([^&]+)/.exec(url)?.[1] ?? ''
        const owner = /owner_id=eq\.([^&]+)/.exec(url)?.[1]
        const ev = db.evaluaciones[id]
        if (!ev || ev.owner_id !== owner) return json([])
        delete db.evaluaciones[id]
        for (const [k, a] of Object.entries(db.asignaciones)) if ((a as any).evaluacion_id === id) delete db.asignaciones[k]
        return json([{ id }])
      }
      const owner = /owner_id=eq\.([^&]+)/.exec(url)?.[1]
      return json(Object.values(db.evaluaciones).filter((e: any) => e.owner_id === owner).map((e: any) => ({ ...e, bivio_asignaciones: Object.values(db.asignaciones).filter((a: any) => a.evaluacion_id === e.id) })))
    }
    if (url.includes('/rest/v1/bivio_asignaciones')) {
      if (method === 'POST') {
        for (const row of body as any[]) {
          const id = `a000000${++db.seq}-0000-4000-8000-000000000000`
          db.asignaciones[id] = { id, estado: 'pendiente', respuestas: {}, informe: null, asignada_at: new Date().toISOString(), completada_at: null, ...row }
        }
        return json([], 201)
      }
      if (method === 'PATCH') {
        const id = /id=eq\.([^&]+)/.exec(url)?.[1] ?? ''
        Object.assign(db.asignaciones[id], body)
        return json([db.asignaciones[id]])
      }
      const withEv = (a: any) => ({ ...a, bivio_evaluaciones: db.evaluaciones[a.evaluacion_id] })
      const id = /[?&]id=eq\.([^&]+)/.exec(url)?.[1]
      if (id) return json(db.asignaciones[id] ? [withEv(db.asignaciones[id])] : [])
      const userId = /user_id=eq\.([^&]+)/.exec(url)?.[1]
      return json(Object.values(db.asignaciones).filter((a: any) => a.user_id === userId).map(withEv))
    }
    return json({}, 404)
  })
}

const req = (token: string | null, body: unknown) =>
  ({
    method: 'POST',
    headers: { host: 'careerpath.test', origin: 'https://careerpath.test', 'x-forwarded-for': '10.7.7.7', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body,
    socket: {},
  }) as unknown as Parameters<typeof handleEvaluaciones>[0]

/** `key === null` simula que no hay API key de Gemini (modo demo). */
const call = (token: string | null, body: unknown, key: string | null = 'k') => handleEvaluaciones(req(token, body), key ?? undefined)

const modelDraft = {
  titulo: 'Evaluación · Ventas',
  competencias: [
    { nombre: 'Resultados', descripcion: 'Objetivos.', preguntas: ['Cuenta una entrega.', 'Cuenta un objetivo no logrado.'] },
    { nombre: 'Colaboración', descripcion: 'Trabajo con otras áreas.', preguntas: ['Cuenta una ayuda que diste.'] },
    { nombre: 'Aprendizaje', descripcion: '', preguntas: ['¿Qué aprendiste?'] },
  ],
}
const modelReply = (o: unknown) => ({ response: { text: () => JSON.stringify(o) } })

let db: Db
const evalBody = (extra: Record<string, unknown> = {}) => ({ action: 'crear', titulo: 'Evaluación 2026', area: 'Ventas', rol: 'Ejecutiva', periodo: '2026', competencias: modelDraft.competencias, emails: ['ana@x.test'], ...extra })
const answers = (comp: { id: string }[]) => ({ ...Object.fromEntries(comp.map((c) => [c.id, { nivel: 3, evidencia: 'Cerré tres cuentas nuevas en el trimestre y entregué el informe a tiempo.' }])), desarrollo: 'Quiero mejorar mi forma de presentar.' })

beforeEach(() => {
  resetRateLimits()
  resetAuthCache()
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('ADMIN_EMAIL', 'admin@bivio.test')
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('REMINDER_FROM', 'Bivio <hola@bivio.test>')
  gemini.generateContent.mockReset()
  db = {
    users: {
      tok_jefa: { id: JEFA, email: 'jefa@x.test' },
      tok_ana: { id: ANA, email: 'ana@x.test' },
      tok_luis: { id: LUIS, email: 'luis@x.test' },
      tok_inactivo: { id: INACTIVO, email: 'inactivo@x.test' },
    },
    perfiles: {
      [JEFA]: { estado: 'activo', acceso_profesionales: false, acceso_empresas: true },
      [ANA]: { estado: 'activo', acceso_profesionales: true, acceso_empresas: false },
      [LUIS]: { estado: 'activo', acceso_profesionales: false, acceso_empresas: false },
      [INACTIVO]: { estado: 'desactivado', acceso_profesionales: true, acceso_empresas: true },
    },
    evaluaciones: {},
    asignaciones: {},
    mails: [],
    seq: 0,
  }
  fakeSupabase(db)
  for (const m of ['log', 'warn', 'error'] as const) vi.spyOn(console, m).mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('evaluaciones: generar', () => {
  it('quien tiene "Para empresas" genera un borrador normalizado, con ids propios', async () => {
    gemini.generateContent.mockResolvedValue(modelReply(modelDraft))
    const res = await call('tok_jefa', { action: 'generar', modo: 'jefe', area: 'Ventas', rol: 'Ejecutiva', periodo: '2026' })
    expect(res.status).toBe(200)
    const b = res.body as { borrador: { titulo: string; competencias: { id: string }[] } }
    expect(b.borrador.competencias.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
    const prompt = String(gemini.generateContent.mock.calls[0][0])
    expect(prompt).toMatch(/PROHIBIDO preguntar o aludir a/)
    expect(prompt).toMatch(/No evalúas a nadie|NO evalúas a nadie/)
  })

  it('crear evaluaciones para otras personas exige "Para empresas"; evaluarse a sí mismo, cualquiera de las dos áreas', async () => {
    gemini.generateContent.mockResolvedValue(modelReply(modelDraft))
    expect((await call('tok_ana', { action: 'generar', modo: 'jefe', area: 'Ventas' })).status).toBe(403)
    expect((await call('tok_ana', { action: 'generar', modo: 'propia', area: 'Ventas' })).status).toBe(200)
    expect((await call('tok_luis', { action: 'generar', modo: 'propia', area: 'Ventas' })).status).toBe(403)
  })

  it('un ajuste manda el borrador actual y el cambio pedido', async () => {
    gemini.generateContent.mockResolvedValue(modelReply(modelDraft))
    await call('tok_jefa', { action: 'generar', modo: 'jefe', area: 'Ventas', ajuste: 'Agrega una competencia de liderazgo', previa: { titulo: 'T', competencias: modelDraft.competencias } })
    const prompt = String(gemini.generateContent.mock.calls[0][0])
    expect(prompt).toMatch(/Aplica SOLO este cambio/)
    expect(prompt).toContain('Agrega una competencia de liderazgo')
  })

  it('si la IA no aplicó una parte del pedido, la nota llega a la pantalla', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ ...modelDraft, nota: 'No agregué la pregunta sobre la edad: una evaluación solo trata sobre el trabajo.' }))
    const res = await call('tok_jefa', { action: 'generar', modo: 'jefe', area: 'Ventas', ajuste: 'Pregunta por la edad', previa: { titulo: 'T', competencias: modelDraft.competencias } })
    expect((res.body as any).nota).toMatch(/edad/)
  })

  it('sin sesión no entra, y sin API key responde en modo demo', async () => {
    expect((await call(null, { action: 'generar', area: 'x' })).status).toBe(401)
    const demo = await call('tok_jefa', { action: 'generar', modo: 'jefe', area: 'Ventas' }, null)
    expect(demo.body).toMatchObject({ demo: true })
  })

  it('una respuesta inservible del modelo no se guarda ni se muestra', async () => {
    gemini.generateContent.mockResolvedValue(modelReply({ titulo: 'x', competencias: [{ nombre: 'sola', preguntas: [] }] }))
    expect((await call('tok_jefa', { action: 'generar', modo: 'jefe', area: 'Ventas' })).status).toBe(502)
  })
})

describe('evaluaciones: crear y asignar', () => {
  it('asigna a una cuenta activa y le manda el aviso por email', async () => {
    const res = await call('tok_jefa', evalBody())
    expect(res.status).toBe(200)
    expect((res.body as any).resultados).toEqual([{ email: 'ana@x.test', problema: null, avisado: true }])
    expect(db.mails).toEqual([{ to: 'ana@x.test', subject: 'Te asignaron una evaluación en Bivio' }])
    expect(Object.values(db.asignaciones)).toHaveLength(1)
  })

  it('los destinatarios sin cuenta o con cuenta inactiva no se asignan y se explica por qué', async () => {
    const res = await call('tok_jefa', evalBody({ emails: ['ana@x.test', 'nadie@x.test', 'inactivo@x.test'] }))
    const r = (res.body as any).resultados
    expect(r.map((x: any) => [x.email, x.problema])).toEqual([['ana@x.test', null], ['nadie@x.test', 'sin_cuenta'], ['inactivo@x.test', 'cuenta_inactiva']])
    expect(Object.values(db.asignaciones)).toHaveLength(1)
  })

  it('si ningún destinatario tiene cuenta, no se guarda nada', async () => {
    const res = await call('tok_jefa', evalBody({ emails: ['nadie@x.test'] }))
    expect(res.status).toBe(422)
    expect(Object.values(db.evaluaciones)).toHaveLength(0)
  })

  it('valida los datos y quien no tiene "Para empresas" no puede asignar', async () => {
    expect((await call('tok_jefa', evalBody({ emails: ['no-es-email'] }))).status).toBe(400)
    expect((await call('tok_jefa', evalBody({ competencias: [] }))).status).toBe(400)
    expect((await call('tok_jefa', evalBody({ emails: Array.from({ length: 21 }, (_, i) => `u${i}@x.test`) }))).status).toBe(400)
    expect((await call('tok_ana', evalBody())).status).toBe(403)
  })

  it('"propia": la persona se asigna la evaluación a sí misma y no se manda ningún mail', async () => {
    const res = await call('tok_ana', evalBody({ modo: 'propia', emails: ['otra@x.test'] }))
    expect(res.status).toBe(200)
    const asig = Object.values(db.asignaciones)[0] as any
    expect(asig.user_id).toBe(ANA)
    expect(Object.values(db.evaluaciones)[0]).toMatchObject({ tipo: 'directa', owner_id: ANA })
    expect(db.mails).toHaveLength(0)
  })
})

describe('evaluaciones: responder, informe y quién ve qué', () => {
  async function asignar() {
    await call('tok_jefa', evalBody())
    const id = Object.keys(db.asignaciones)[0]
    const comp = (Object.values(db.evaluaciones)[0] as any).competencias as { id: string }[]
    return { id, comp }
  }

  it('lo asignado aparece en "Mis evaluaciones" de la persona, con quién la creó', async () => {
    await asignar()
    const res = await call('tok_ana', { action: 'mias' })
    expect((res.body as any).pendientes).toBe(1)
    expect((res.body as any).items[0]).toMatchObject({ titulo: 'Evaluación 2026', creadaPor: 'jefa@x.test', estado: 'pendiente' })
  })

  it('completarla genera el informe y quedan visibles para las dos personas', async () => {
    const { id, comp } = await asignar()
    gemini.generateContent.mockResolvedValue(modelReply({ resumen: 'Resumen.', fortalezas: [{ competencia: 'Resultados', texto: 'Cerró cuentas.', evidencia: 'Cerré tres cuentas' }], desarrollo: [], coherencia: [], planDesarrollo: [{ texto: 'Pedir feedback', bloque: '20', plazo: 'en 2 semanas' }], preguntasParaConversar: ['¿Qué te enorgullece?'] }))
    const sent = await call('tok_ana', { action: 'enviar', id, respuestas: answers(comp) })
    expect(sent.status).toBe(200)
    expect((db.asignaciones[id] as any).estado).toBe('completada')
    const prompt = String(gemini.generateContent.mock.calls[0][0])
    expect(prompt).toMatch(/no le pones nota ni emites un veredicto/)
    expect(prompt).toContain('Cerré tres cuentas nuevas')

    const suya = await call('tok_ana', { action: 'abrir', id })
    const jefa = await call('tok_jefa', { action: 'abrir', id })
    expect((suya.body as any).informe.resumen).toBe('Resumen.')
    expect((jefa.body as any).informe.resumen).toBe('Resumen.')
    expect((jefa.body as any).rol).toBe('creador')
    expect((jefa.body as any).respuestas.c1.nivel).toBe(3)
  })

  it('quien creó la evaluación NO ve respuestas ni informe hasta que la persona los envía', async () => {
    const { id, comp } = await asignar()
    await call('tok_ana', { action: 'guardar', id, respuestas: answers(comp) })
    const jefa = await call('tok_jefa', { action: 'abrir', id })
    expect((jefa.body as any).respuestas).toEqual({})
    expect((jefa.body as any).informe).toBeNull()
    expect((db.asignaciones[id] as any).estado).toBe('en_curso')
  })

  it('no se puede enviar incompleta (nivel y un ejemplo en cada competencia)', async () => {
    const { id, comp } = await asignar()
    const incompleta = { ...answers(comp), c2: { nivel: 3, evidencia: 'corto' } }
    const res = await call('tok_ana', { action: 'enviar', id, respuestas: incompleta })
    expect(res.status).toBe(400)
    expect(gemini.generateContent).not.toHaveBeenCalled()
  })

  it('quien creó la evaluación no puede responder por la otra persona, ni se puede reenviar una completada', async () => {
    const { id, comp } = await asignar()
    expect((await call('tok_jefa', { action: 'guardar', id, respuestas: answers(comp) })).status).toBe(403)
    gemini.generateContent.mockResolvedValue(modelReply({ resumen: 'ok' }))
    await call('tok_ana', { action: 'enviar', id, respuestas: answers(comp) })
    expect((await call('tok_ana', { action: 'guardar', id, respuestas: answers(comp) })).status).toBe(403)
  })

  it('una tercera persona no se entera de que existe: 404', async () => {
    const { id } = await asignar()
    expect((await call('tok_luis', { action: 'abrir', id })).status).toBe(404)
    expect((await call('tok_luis', { action: 'abrir', id: 'no-es-uuid' })).status).toBe(400)
  })

  it('quien creó ve el estado de cada asignación y puede eliminar la evaluación con sus respuestas', async () => {
    const { id } = await asignar()
    const creadas = await call('tok_jefa', { action: 'creadas' })
    expect((creadas.body as any).items[0].asignaciones[0]).toMatchObject({ email: 'ana@x.test', estado: 'pendiente' })
    expect((await call('tok_ana', { action: 'creadas' })).status).toBe(403)
    const evId = Object.keys(db.evaluaciones)[0]
    expect((await call('tok_ana', { action: 'eliminar', id: evId })).status).toBe(404) // no es suya
    expect((await call('tok_jefa', { action: 'eliminar', id: evId })).status).toBe(200)
    expect(db.asignaciones[id]).toBeUndefined()
  })
})

describe('evaluaciones: piezas puras', () => {
  it('normalizeCompetencias descarta lo inservible y numera', () => {
    expect(normalizeCompetencias([{ nombre: 'A', preguntas: ['p'] }, { nombre: '', preguntas: ['p'] }, { nombre: 'B', preguntas: ['q', '', 5] }])?.map((c) => [c.id, c.preguntas.length])).toEqual([['c1', 1], ['c2', 1]])
    expect(normalizeCompetencias([{ nombre: 'sola', preguntas: ['p'] }])).toBeNull()
    expect(normalizeCompetencias('x')).toBeNull()
  })

  it('normalizeInforme saca la frase de introducción del resumen', () => {
    expect(normalizeInforme({ resumen: 'Aquí tienes el resumen de tu autoevaluación. Mostraste resultados concretos en ventas.' }).resumen).toBe('Mostraste resultados concretos en ventas.')
    expect(normalizeInforme({ resumen: 'Mostraste resultados concretos.' }).resumen).toBe('Mostraste resultados concretos.')
  })

  it('normalizeInforme tolera cualquier forma del modelo', () => {
    const i = normalizeInforme({ resumen: 5, fortalezas: [{ texto: 'x' }, { nope: 1 }, null], planDesarrollo: [{ texto: 'a', bloque: '99' }], preguntasParaConversar: ['q', '', 3] })
    expect(i.fortalezas).toHaveLength(1)
    expect(i.planDesarrollo[0].bloque).toBe('70')
    expect(i.preguntasParaConversar).toEqual(['q'])
    expect(i.resumen).toBe('')
  })

  it('cleanRespuestas solo acepta competencias de la evaluación y niveles de 1 a 4', () => {
    const comp = [{ id: 'c1', nombre: 'A', descripcion: '', preguntas: ['p'] }]
    const out = cleanRespuestas({ c1: { nivel: 9, evidencia: 'x' }, c9: { nivel: 3, evidencia: 'y' }, desarrollo: 'z' }, comp) as any
    expect(out.c1).toEqual({ evidencia: 'x' })
    expect(out.c9).toBeUndefined()
    expect(out.desarrollo).toBe('z')
    expect(cleanRespuestas(null, comp)).toBeNull()
  })

  it('el mail de aviso dice quién la asignó, que es una autoevaluación y escapa el HTML', () => {
    const m = buildAssignedMail('es', 'Eval <b>2026</b>', 'jefa@x.test', 'https://app.example')
    expect(m.text).toContain('jefa@x.test')
    expect(m.text).toContain('autoevaluación')
    expect(m.html).toContain('Eval &lt;b&gt;2026&lt;/b&gt;')
  })
})
