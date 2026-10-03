// Tipos y objetivos de indagación compartidos entre el servidor (prompts) y
// el cliente (progreso visible de cada etapa).

export type Stage = 'diagnostico' | 'discovery' | 'plan'
export type Path = 'quiebre' | 'perfil'

export interface StageObjective {
  id: string
  /**
   * La persona puede elegir dejarlo "para más adelante" y la etapa cierra igual. Solo los temas
   * que el proceso puede sostener sin ellos. Sin un objetivo, un plazo o un pedido concreto no se
   * puede armar un plan (guardrail §5): esos no se pueden dejar.
   * Decisión de producto a validar con quien mantiene el guardrail.
   */
  omitible: boolean
  label: string
  descripcion: string
}

// §3 Capa 1 — objetivos de indagación fijos por etapa (qué debe quedar
// cubierto, nunca el texto literal de la pregunta).
export const STAGE_OBJECTIVES: Record<Stage, StageObjective[]> = {
  diagnostico: [
    { id: 'goal', omitible: false, label: 'Lo que buscás', descripcion: 'Goal: el objetivo explicitado por la persona con sus propias palabras.' },
    { id: 'reality', omitible: false, label: 'Dónde estás hoy', descripcion: 'Reality: su situación y el freno que percibe, con datos concretos (hechos que pasaron), no solo juicios.' },
    { id: 'options', omitible: true, label: 'Tus caminos', descripcion: 'Options: más de un camino visible nombrado por la persona, no uno solo.' },
    { id: 'will', omitible: true, label: 'Tu compromiso', descripcion: 'Will: qué intentó hasta ahora y cuál es su nivel real de compromiso con moverse.' },
  ],
  discovery: [
    { id: 'reencuadre', omitible: true, label: 'Tu obstáculo', descripcion: 'El obstáculo principal reencuadrado con datos propios de la persona, no con su primera lectura.' },
    { id: 'escenarios', omitible: false, label: 'Tus escenarios', descripcion: 'Al menos 2 escenarios narrados por la persona como su propia historia de transición.' },
    { id: 'cuatro_c', omitible: true, label: 'Qué te da fuerza', descripcion: 'Qué fortalece o debilita cada escenario en preocupación por el futuro (concern), control, curiosidad y confianza — según la persona.' },
  ],
  plan: [
    { id: 'objetivo_desarrollo', omitible: false, label: 'Tu objetivo', descripcion: 'Objetivo de desarrollo elegido por la persona (no asignado por vos).' },
    { id: 'horizonte', omitible: false, label: 'Tu plazo', descripcion: 'Horizonte de tiempo elegido por la persona.' },
    { id: 'accion_fortaleza', omitible: true, label: 'Desde tu fortaleza', descripcion: 'Al menos una acción anclada en una fortaleza que la persona nombró antes en la conversación (no una que infieras vos).' },
    { id: 'pedido', omitible: false, label: 'A quién le pedís', descripcion: 'Al menos una acción formulada como pedido explícito (a quién, qué exactamente, para cuándo) y, si corresponde, una oferta (cómo y a quién pone a disposición su valor).' },
    { id: 'metrica', omitible: true, label: 'Cómo lo seguís', descripcion: 'Métrica de avance y cadencia de check-in definidas por la persona.' },
  ],
}

export const STAGE_ORDER: Stage[] = ['diagnostico', 'discovery', 'plan']

export const STAGE_LABEL: Record<Stage, string> = {
  diagnostico: 'Diagnóstico',
  discovery: 'Discovery',
  plan: 'Plan de Acción',
}

export const STAGE_COLOR: Record<Stage, string> = {
  // El verde del sistema (7,7:1 sobre el fondo). La etapa se distingue por el indicador de pasos, no por el color.
  diagnostico: '#005c41',
  discovery: '#005c41',
  plan: '#005c41',
}

// Orientación: qué se hace en cada etapa y qué viene después (para que nadie
// se pregunte "¿dónde estoy?").
export const STAGE_INTRO: Record<Stage, { queHacemos: string; despues: string; titulo: string }> = {
  diagnostico: {
    titulo: 'Tu mapa del Diagnóstico',
    queHacemos: 'Entender dónde estás y qué querés',
    despues: 'Discovery: explorar caminos',
  },
  discovery: {
    titulo: 'Tu mapa de Discovery',
    queHacemos: 'Explorar caminos posibles',
    despues: 'Plan de Acción: pasos concretos',
  },
  plan: {
    titulo: 'Tu plan, en tus palabras',
    queHacemos: 'Convertirlo en pasos concretos',
    despues: 'Tu informe final',
  },
}

/** Una pieza del "mapa" con el que cierra cada etapa: lo que la persona dijo, ordenado. */
export interface SynthesisItem {
  /** id del objetivo de la etapa (ver STAGE_OBJECTIVES). */
  id: string
  /** 1-2 oraciones en segunda persona, con las palabras de la persona. */
  texto: string
  /** Frase breve, textual, de lo que la persona escribió. Puede ir vacía. */
  cita: string
  /** La persona eligió dejar este tema para más adelante: no es un tema cubierto. */
  omitido?: boolean
}

/** Cuántos temas puede dejar para después la persona en una misma etapa. Decisión de producto. */
export const MAX_OMITIDOS_POR_ETAPA = 1
