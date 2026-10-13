// Tipos y objetivos de indagación compartidos entre el servidor (prompts) y
// el cliente (progreso visible de cada etapa).

export type Stage = 'diagnostico' | 'discovery' | 'plan'
// quiebre = Camino A (estancamiento), perfil = Camino B (cómo te lee un reclutador),
// formacion = Camino C (decidir en qué formarme; solo para mayores de 18).
export type Path = 'quiebre' | 'perfil' | 'formacion'

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

// Camino C — decidir en qué formarse. Misma estructura de tres etapas; cambian los temas.
// Importante: el servicio no conoce la oferta educativa vigente de ninguna región, así que
// estos objetivos indagan lo que la persona sabe, quiere y puede, no datos de instituciones.
export const FORMACION_OBJECTIVES: Record<Stage, StageObjective[]> = {
  diagnostico: [
    { id: 'proposito', omitible: false, label: 'Lo que querés lograr', descripcion: 'Qué quiere lograr con una formación (cambiar de rumbo, crecer en lo que hace, retomar estudios, especializarse), en sus propias palabras.' },
    { id: 'situacion', omitible: false, label: 'Tu situación hoy', descripcion: 'Su situación real: si trabaja, qué estudió o intentó antes, dónde vive y qué condiciones tiene (horarios, responsabilidades), con hechos concretos.' },
    { id: 'alternativas', omitible: true, label: 'Lo que ya evaluás', descripcion: 'Las opciones de formación que ya está considerando (curso, tecnicatura, carrera, posgrado, certificación), o lo que ya descartó y por qué. Puede no tener ninguna todavía.' },
    { id: 'compromiso', omitible: true, label: 'Lo que podés invertir', descripcion: 'Cuánto tiempo por semana y cuánto dinero (aproximado) puede y quiere dedicar, y por cuánto tiempo.' },
  ],
  discovery: [
    { id: 'intereses', omitible: false, label: 'Lo que te interesa', descripcion: 'Qué temas o actividades le interesan o le dan energía, con ejemplos concretos de su vida (no etiquetas generales).' },
    { id: 'aptitudes', omitible: true, label: 'Lo que se te da bien', descripcion: 'Qué hace bien o aprendió con facilidad según ella, y qué quisiera desarrollar. Con ejemplos, no con adjetivos.' },
    { id: 'criterios', omitible: false, label: 'Tus criterios', descripcion: 'Entre 3 y 5 criterios propios con los que va a comparar opciones (por ejemplo: costo, duración, modalidad, salida laboral, interés por el tema), ordenados por importancia según ella.' },
  ],
  plan: [
    { id: 'eleccion', omitible: false, label: 'Tu elección', descripcion: 'La opción que ELIGE explorar o encarar primero (la elige ella, no la propone el coach), o cuál sigue evaluando y qué le falta saber.' },
    { id: 'horizonte', omitible: false, label: 'Tu plazo', descripcion: 'Horizonte de tiempo elegido por la persona para decidir o empezar.' },
    { id: 'presupuesto', omitible: false, label: 'Tu presupuesto', descripcion: 'Cuánto tiempo y dinero asigna a esta formación (aproximado, definido por ella).' },
    { id: 'primer_paso', omitible: false, label: 'Tu primer paso', descripcion: 'Una acción concreta para las próximas semanas, formulada con quién o dónde, qué exactamente y para cuándo (por ejemplo: pedir información a una institución, hablar con alguien que ya lo estudió, probar una clase introductoria, inscribirse).' },
    { id: 'respaldo', omitible: true, label: 'Tu plan B', descripcion: 'Qué haría si la primera opción no funciona (no hay vacante, cambia el costo, no le gusta).' },
  ],
}

/** Los temas de indagación de una etapa según el camino elegido. */
export function objectivesFor(stage: Stage, path: Path = 'quiebre'): StageObjective[] {
  return path === 'formacion' ? FORMACION_OBJECTIVES[stage] : STAGE_OBJECTIVES[stage]
}

export const STAGE_ORDER: Stage[] = ['diagnostico', 'discovery', 'plan']

export const STAGE_LABEL: Record<Stage, string> = {
  diagnostico: 'Diagnóstico',
  discovery: 'Discovery',
  plan: 'Plan de Acción',
}

export const STAGE_COLOR: Record<Stage, string> = {
  // El burdeos del sistema (9,6:1 sobre el fondo). La etapa se distingue por el indicador de pasos, no por el color.
  diagnostico: '#7a1f3d',
  discovery: '#7a1f3d',
  plan: '#7a1f3d',
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

export const FORMACION_INTRO: Record<Stage, { queHacemos: string; despues: string; titulo: string }> = {
  diagnostico: {
    titulo: 'Tu mapa del Diagnóstico',
    queHacemos: 'Entender qué querés lograr y con qué condiciones contás',
    despues: 'Discovery: tus intereses y tus criterios',
  },
  discovery: {
    titulo: 'Tu mapa de Discovery',
    queHacemos: 'Aclarar qué te interesa y con qué criterios vas a comparar',
    despues: 'Plan de Acción: elegir y dar el primer paso',
  },
  plan: {
    titulo: 'Tu plan de formación, en tus palabras',
    queHacemos: 'Elegir por dónde empezar y darle forma',
    despues: 'Tu informe final',
  },
}

/** Orientación de cada etapa según el camino. */
export function introFor(stage: Stage, path: Path = 'quiebre') {
  return path === 'formacion' ? FORMACION_INTRO[stage] : STAGE_INTRO[stage]
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
