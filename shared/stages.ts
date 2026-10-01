// Tipos y objetivos de indagación compartidos entre el servidor (prompts) y
// el cliente (progreso visible de cada etapa).

export type Stage = 'diagnostico' | 'discovery' | 'plan'
export type Path = 'quiebre' | 'perfil'

export interface StageObjective {
  id: string
  label: string
  descripcion: string
}

// §3 Capa 1 — objetivos de indagación fijos por etapa (qué debe quedar
// cubierto, nunca el texto literal de la pregunta).
export const STAGE_OBJECTIVES: Record<Stage, StageObjective[]> = {
  diagnostico: [
    { id: 'goal', label: 'Objetivo', descripcion: 'Goal: el objetivo explicitado por la persona con sus propias palabras.' },
    { id: 'reality', label: 'Situación', descripcion: 'Reality: su situación y el freno que percibe, con datos concretos (hechos que pasaron), no solo juicios.' },
    { id: 'options', label: 'Caminos', descripcion: 'Options: más de un camino visible nombrado por la persona, no uno solo.' },
    { id: 'will', label: 'Compromiso', descripcion: 'Will: qué intentó hasta ahora y cuál es su nivel real de compromiso con moverse.' },
  ],
  discovery: [
    { id: 'reencuadre', label: 'Obstáculo', descripcion: 'El obstáculo principal reencuadrado con datos propios de la persona, no con su primera lectura.' },
    { id: 'escenarios', label: 'Escenarios', descripcion: 'Al menos 2 escenarios narrados por la persona como su propia historia de transición.' },
    { id: 'cuatro_c', label: '4 C', descripcion: 'Qué fortalece o debilita cada escenario en preocupación por el futuro (concern), control, curiosidad y confianza — según la persona.' },
  ],
  plan: [
    { id: 'objetivo_desarrollo', label: 'Objetivo', descripcion: 'Objetivo de desarrollo elegido por la persona (no asignado por vos).' },
    { id: 'horizonte', label: 'Horizonte', descripcion: 'Horizonte de tiempo elegido por la persona.' },
    { id: 'accion_fortaleza', label: 'Fortaleza', descripcion: 'Al menos una acción anclada en una fortaleza que la persona nombró antes en la conversación (no una que infieras vos).' },
    { id: 'pedido', label: 'Pedido u oferta', descripcion: 'Al menos una acción formulada como pedido explícito (a quién, qué exactamente, para cuándo) y, si corresponde, una oferta (cómo y a quién pone a disposición su valor).' },
    { id: 'metrica', label: 'Seguimiento', descripcion: 'Métrica de avance y cadencia de check-in definidas por la persona.' },
  ],
}

export const STAGE_ORDER: Stage[] = ['diagnostico', 'discovery', 'plan']

export const STAGE_LABEL: Record<Stage, string> = {
  diagnostico: 'Diagnóstico',
  discovery: 'Discovery',
  plan: 'Plan de Acción',
}

export const STAGE_COLOR: Record<Stage, string> = {
  // Tonos con contraste AA como texto sobre fondo claro y con texto blanco encima.
  diagnostico: '#c2410c',
  discovery: '#4f46e5',
  plan: '#047857',
}
