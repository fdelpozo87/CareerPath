import { describe, expect, it } from 'vitest'
import { askCounts } from '../server/coach'
import { objectivesFor } from '../shared/stages'
import { scriptedOpening } from '../src/lib/coach/opening'

// La apertura fija del Camino A tiene que ser un turno válido: el servidor lee su JSON como historial.

describe('apertura fija del Camino A', () => {
  it('solo existe para el Camino A en el diagnóstico', () => {
    expect(scriptedOpening('quiebre', 'diagnostico')).not.toBeNull()
    expect(scriptedOpening('quiebre', 'discovery')).toBeNull()
    expect(scriptedOpening('perfil', 'diagnostico')).toBeNull()
    expect(scriptedOpening('formacion', 'diagnostico')).toBeNull()
  })

  it('dice el texto acordado y pregunta por lo que trae a la persona', () => {
    const t = scriptedOpening('quiebre', 'diagnostico', 'es')!
    expect(t.mensaje).toMatch(/^Hola\. Te acompaño en este espacio/)
    expect(t.mensaje).toContain('las conclusiones van a ser tuyas')
    expect(t.mensaje).toContain('¿Qué es lo que te trae por aquí y qué esperas poder destrabar en este momento?')
  })

  it('tiene su versión en inglés', () => {
    expect(scriptedOpening('quiebre', 'diagnostico', 'en')!.mensaje).toMatch(/^Hi\. I’m here with you in this space/)
  })

  it('el servidor la cuenta como la pregunta del objetivo ya hecha', () => {
    const t = scriptedOpening('quiebre', 'diagnostico')!
    expect(objectivesFor('diagnostico', 'quiebre').map((o) => o.id)).toContain(t.temaEnFoco)
    const history = [
      { role: 'user' as const, text: '(inicio)' },
      { role: 'model' as const, text: JSON.stringify(t) },
    ]
    expect(askCounts(history, 'diagnostico', [], [], 'quiebre')).toEqual({ goal: 1 })
  })
})
