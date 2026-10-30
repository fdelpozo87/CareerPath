import { describe, expect, it } from 'vitest'
import { cleanIkigai, cleanItems } from '../server/coach'
import { buildTurnSystemPrompt } from '../server/prompts'
import { objectivesFor } from '../shared/stages'

// El ikigai: un tema más de la Exploración de los caminos A y C, armado solo con lo que la persona dijo.

const ids = (stage: 'diagnostico' | 'discovery' | 'plan', path: 'quiebre' | 'perfil' | 'formacion') => objectivesFor(stage, path).map((o) => o.id)

describe('el tema "ikigai"', () => {
  it('está en la Exploración del Camino A (tras el obstáculo) y del C (tras intereses y aptitudes)', () => {
    expect(ids('discovery', 'quiebre')).toEqual(['reencuadre', 'ikigai', 'escenarios', 'cuatro_c'])
    expect(ids('discovery', 'formacion')).toEqual(['intereses', 'aptitudes', 'ikigai', 'criterios', 'comparacion'])
  })

  it('no está en el Camino B ni en las otras etapas', () => {
    expect(ids('discovery', 'perfil')).not.toContain('ikigai')
    for (const path of ['quiebre', 'perfil', 'formacion'] as const) {
      expect(ids('diagnostico', path)).not.toContain('ikigai')
      expect(ids('plan', path)).not.toContain('ikigai')
    }
  })

  it('se puede dejar para más adelante (no bloquea el cierre de la etapa)', () => {
    expect(objectivesFor('discovery', 'quiebre').find((o) => o.id === 'ikigai')?.omitible).toBe(true)
  })
})

const dijo =
  'me encanta enseñar a mis compañeros cuando alguien se traba con una planilla. se me da bien ordenar procesos y explicar con calma. ' +
  'en mi equipo siempre falta alguien que documente como se hace cada cosa. hoy me pagan por mantener los reportes mensuales.'
const userText = dijo.toLowerCase()

describe('cleanIkigai', () => {
  const completo = { ama: 'enseñar a mis compañeros', bueno: 'ordenar procesos y explicar con calma', mundo: 'alguien que documente cada cosa', pagan: 'mantener los reportes mensuales' }

  it('conserva las frases que salen de lo que la persona dijo', () => {
    expect(cleanIkigai(completo, userText)).toEqual(completo)
  })

  it('deja en blanco una frase inventada, pero conserva el resto', () => {
    const r = cleanIkigai({ ...completo, pagan: 'liderar una startup de criptomonedas en Dubái' }, userText)
    expect(r).toMatchObject({ ama: completo.ama, bueno: completo.bueno, mundo: completo.mundo, pagan: '' })
  })

  it('con menos de dos frases con contenido no hay gráfico', () => {
    expect(cleanIkigai({ ama: 'enseñar a mis compañeros', bueno: '', mundo: 'viajar por el espacio', pagan: '' }, userText)).toBeUndefined()
  })

  it('ignora lo que no tiene la forma esperada y recorta lo largo', () => {
    expect(cleanIkigai('texto', userText)).toBeUndefined()
    expect(cleanIkigai(null, userText)).toBeUndefined()
    expect(cleanIkigai({ ama: 123, bueno: ['x'], mundo: null, pagan: undefined }, userText)).toBeUndefined()
    const largo = `enseñar a mis compañeros ${'cuando se traban '.repeat(20)}`
    expect(cleanIkigai({ ...completo, ama: largo }, `${userText} cuando se traban`)!.ama.length).toBeLessThanOrEqual(90)
  })
})

describe('cleanItems con el ikigai', () => {
  const item = { id: 'ikigai', texto: 'Disfrutas enseñar y se te da bien ordenar.', cita: 'me encanta enseñar a mis compañeros', ikigai: { ama: 'enseñar a mis compañeros', bueno: 'ordenar procesos', mundo: '', pagan: 'mantener los reportes mensuales' } }

  it('el elemento del ikigai lleva sus cuatro miradas validadas', () => {
    const [r] = cleanItems([item], 'discovery', userText, 'quiebre')
    expect(r.id).toBe('ikigai')
    expect(r.ikigai).toEqual({ ama: 'enseñar a mis compañeros', bueno: 'ordenar procesos', mundo: '', pagan: 'mantener los reportes mensuales' })
    expect(r.cita).toBe('me encanta enseñar a mis compañeros')
  })

  it('otros temas no pueden traer un "ikigai", y en el Camino B el tema ni existe', () => {
    const otro = cleanItems([{ id: 'escenarios', texto: 'Dos escenarios.', cita: '', ikigai: item.ikigai }], 'discovery', userText, 'quiebre')
    expect(otro[0].ikigai).toBeUndefined()
    expect(cleanItems([item], 'discovery', userText, 'perfil')).toEqual([])
  })
})

describe('instrucciones del modelo', () => {
  const ctx = { stage: 'discovery' as const, sintesisPrevias: {} }

  it('la Exploración de A y C explica cómo trabajar el ikigai, sin nombrarlo por la persona', () => {
    for (const path of ['quiebre', 'formacion'] as const) {
      const p = buildTurnSystemPrompt({ ...ctx, path })
      expect(p).toContain('el ikigai')
      expect(p).toContain('NUNCA le digas cuál es su ikigai')
      expect(p).toContain('"ikigai": { "ama"')
    }
    expect(buildTurnSystemPrompt({ ...ctx, path: 'formacion' })).toContain('Reutiliza lo que ya contó')
    expect(buildTurnSystemPrompt({ ...ctx, path: 'quiebre' })).not.toContain('Reutiliza lo que ya contó')
  })

  it('el Camino B y las otras etapas no reciben esa guía', () => {
    expect(buildTurnSystemPrompt({ ...ctx, path: 'perfil' })).not.toContain('NUNCA le digas cuál es su ikigai')
    expect(buildTurnSystemPrompt({ ...ctx, stage: 'diagnostico', path: 'quiebre' })).not.toContain('NUNCA le digas cuál es su ikigai')
    expect(buildTurnSystemPrompt({ ...ctx, stage: 'plan', path: 'formacion' })).not.toContain('NUNCA le digas cuál es su ikigai')
  })
})
