// Tipos y objetivos de indagación compartidos entre el servidor (prompts) y
// el cliente (progreso visible de cada etapa).

import { translate, type Key, type Lang } from './i18n.js'

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
  /** Instrucción para el modelo (no se muestra a la persona). El nombre visible vive en shared/locales (obj.<id>). */
  descripcion: string
}

// §3 Capa 1 — objetivos de indagación fijos por etapa (qué debe quedar
// cubierto, nunca el texto literal de la pregunta).
export const STAGE_OBJECTIVES: Record<Stage, StageObjective[]> = {
  diagnostico: [
    { id: 'goal', omitible: false, descripcion: 'Goal: el objetivo explicitado por la persona con sus propias palabras.' },
    { id: 'reality', omitible: false, descripcion: 'Reality: su situación y el freno que percibe, con datos concretos (hechos que pasaron), no solo juicios.' },
    { id: 'options', omitible: true, descripcion: 'Options: más de un camino visible nombrado por la persona, no uno solo.' },
    { id: 'will', omitible: true, descripcion: 'Will: qué intentó hasta ahora y cuál es su nivel real de compromiso con moverse.' },
  ],
  discovery: [
    { id: 'reencuadre', omitible: true, descripcion: 'El obstáculo principal TAL COMO LO NOMBRÓ la persona (el suyo, no uno que supongas tú), trabajado: qué lo hace pesado, qué ya probó o qué lo volvería más manejable, y reencuadrado con datos propios, no con su primera lectura.' },
    { id: 'escenarios', omitible: false, descripcion: 'Al menos 2 escenarios narrados por la persona como su propia historia de transición, incluyendo cada camino que nombró antes (también el que mencionó de pasada: si quedó afuera, pregúntale si lo descarta o lo quiere explorar). Antes de cerrar, cuál le gustaría llevar al Plan o si sigue entre más de uno: lo elige ella.' },
    { id: 'cuatro_c', omitible: true, descripcion: 'Qué fortalece o debilita cada escenario en preocupación por el futuro (concern), control, curiosidad y confianza — según la persona.' },
  ],
  plan: [
    { id: 'objetivo_desarrollo', omitible: false, descripcion: 'Objetivo de desarrollo elegido por la persona (no asignado por ti).' },
    { id: 'horizonte', omitible: false, descripcion: 'Horizonte de tiempo elegido por la persona.' },
    { id: 'accion_fortaleza', omitible: true, descripcion: 'Al menos una acción anclada en una fortaleza que la persona nombró antes en la conversación (no una que infieras tú).' },
    { id: 'pedido', omitible: false, descripcion: 'Al menos una acción formulada como pedido explícito (a quién, qué exactamente, para cuándo) y, si corresponde, una oferta (cómo y a quién pone a disposición su valor).' },
    { id: 'metrica', omitible: true, descripcion: 'Métrica de avance y cadencia de check-in definidas por la persona.' },
  ],
}

// Camino C — decidir en qué formarse. Misma estructura de tres etapas; cambian los temas.
// Importante: el servicio no conoce la oferta educativa vigente de ninguna región, así que
// estos objetivos indagan lo que la persona sabe, quiere y puede, no datos de instituciones.
export const FORMACION_OBJECTIVES: Record<Stage, StageObjective[]> = {
  diagnostico: [
    { id: 'proposito', omitible: false, descripcion: 'Qué quiere lograr con una formación (cambiar de rumbo, crecer en lo que hace, retomar estudios, especializarse), en sus propias palabras.' },
    { id: 'situacion', omitible: false, descripcion: 'Su situación real: si trabaja, qué estudió o intentó antes, dónde vive y qué condiciones tiene (horarios, responsabilidades), con hechos concretos.' },
    { id: 'alternativas', omitible: true, descripcion: 'Las opciones de formación que ya está considerando (curso, tecnicatura, carrera, posgrado, certificación), o lo que ya descartó y por qué. Puede no tener ninguna todavía.' },
    { id: 'compromiso', omitible: true, descripcion: 'Cuánto tiempo por semana y cuánto dinero (aproximado) puede y quiere dedicar, y por cuánto tiempo.' },
  ],
  discovery: [
    { id: 'intereses', omitible: false, descripcion: 'Qué temas o actividades le interesan o le dan energía, con ejemplos concretos de su vida (no etiquetas generales).' },
    { id: 'aptitudes', omitible: true, descripcion: 'Qué hace bien o aprendió con facilidad según ella, y qué quisiera desarrollar. Con ejemplos, no con adjetivos.' },
    { id: 'criterios', omitible: false, descripcion: 'Entre 3 y 5 criterios propios con los que va a comparar opciones (por ejemplo: costo, duración, modalidad, salida laboral, interés por el tema), ordenados por importancia según ella. Se arman de a uno por turno, con ella: no pidas la lista completa y ordenada en una sola pregunta.' },
    { id: 'comparacion', omitible: false, descripcion: 'Compara, con SUS criterios, las opciones que nombró (si todavía no tiene ninguna, las que surjan de lo que le interesa): para cada una, qué cumple y qué no según ella, y qué le falta averiguar. Es una comparación que arma ella con tu ayuda, no un ranking tuyo.' },
  ],
  plan: [
    { id: 'eleccion', omitible: false, descripcion: 'La opción que ELIGE explorar o encarar primero (la elige ella, no la propone el coach), o cuál sigue evaluando y qué le falta saber.' },
    { id: 'horizonte', omitible: false, descripcion: 'Horizonte de tiempo elegido por la persona para decidir o empezar.' },
    { id: 'presupuesto', omitible: false, descripcion: 'Cuánto tiempo y dinero asigna a esta formación (aproximado, definido por ella).' },
    { id: 'primer_paso', omitible: false, descripcion: 'Una acción concreta para las próximas semanas, formulada con quién o dónde, qué exactamente y para cuándo (por ejemplo: pedir información a una institución, hablar con alguien que ya lo estudió, probar una clase introductoria, inscribirse).' },
    { id: 'respaldo', omitible: true, descripcion: 'Qué haría si la primera opción no funciona (no hay vacante, cambia el costo, no le gusta).' },
  ],
}

/** Los temas de indagación de una etapa según el camino elegido. */
// El ikigai: un tema más de la Exploración de los caminos A y C (el B no lo trabaja). Va después del tema que lo alimenta: en A,
// el obstáculo reencuadrado; en C, los intereses y aptitudes que la persona ya contó (así no se le vuelve a preguntar lo mismo).
const IKIGAI_OBJECTIVE: StageObjective = {
  id: 'ikigai',
  omitible: true,
  descripcion:
    'Ikigai, armado con SUS palabras (lo descubres preguntando, no lo deduces): qué ama o disfruta hacer, en qué se le da bien (con ejemplos), qué necesita el mundo o su entorno de lo que ella podría ofrecer, y por qué podrían pagarle (o ya le pagan). Está cubierto cuando nombró, aquí o antes en la conversación, al menos TRES de las cuatro; la que no dijo queda vacía (no la inventes). Nunca le digas cuál es su ikigai ni qué profesión o camino le corresponde: lo que hay en el cruce lo nombra ella.',
}
const IKIGAI_AFTER: Partial<Record<Path, string>> = { quiebre: 'reencuadre', formacion: 'aptitudes' }

const objectivesCache = new Map<string, StageObjective[]>()

export function objectivesFor(stage: Stage, path: Path = 'quiebre'): StageObjective[] {
  const key = `${stage}:${path}`
  const cached = objectivesCache.get(key)
  if (cached) return cached
  const base = path === 'formacion' ? FORMACION_OBJECTIVES[stage] : STAGE_OBJECTIVES[stage]
  const after = IKIGAI_AFTER[path]
  const at = stage === 'discovery' && after ? base.findIndex((o) => o.id === after) : -1
  const list = at === -1 ? base : [...base.slice(0, at + 1), IKIGAI_OBJECTIVE, ...base.slice(at + 1)]
  objectivesCache.set(key, list)
  return list
}

export const STAGE_ORDER: Stage[] = ['diagnostico', 'discovery', 'plan']

// Nombres de etapa, de tema y orientación de cada etapa: viven en shared/locales/{es,en}.json.
export const stageName = (stage: Stage, lang: Lang = 'es'): string => translate(lang, `stage.${stage}` as Key)
export const objectiveLabel = (id: string, lang: Lang = 'es'): string => translate(lang, `obj.${id}` as Key)

export const STAGE_COLOR: Record<Stage, string> = {
  // El color primario del tema activo (burdeos en claro, rosa en oscuro). La etapa se distingue por el indicador de pasos, no por el color.
  diagnostico: 'var(--color-primary)',
  discovery: 'var(--color-primary)',
  plan: 'var(--color-primary)',
}

/** Orientación de cada etapa según el camino: qué se hace ahora y qué viene después. */
export function introFor(stage: Stage, path: Path = 'quiebre', lang: Lang = 'es') {
  const group = path === 'formacion' ? 'formacion' : 'default'
  const at = (field: string) => translate(lang, `intro.${group}.${stage}.${field}` as Key)
  return { titulo: at('titulo'), queHacemos: at('queHacemos'), despues: at('despues') }
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
  /** Solo en el tema "ikigai": una frase corta de la persona por cada dimensión ("" si no la dijo). */
  ikigai?: Ikigai
}

/** Las cuatro miradas del ikigai, con las palabras de la persona. El cruce del centro no lo completa nadie más que ella. */
export interface Ikigai {
  /** Lo que ama o disfruta hacer. */
  ama: string
  /** En lo que se le da bien. */
  bueno: string
  /** Lo que el mundo o su entorno necesita. */
  mundo: string
  /** Por lo que podrían pagarle. */
  pagan: string
}

/** Cuántos temas puede dejar para después la persona en una misma etapa. Decisión de producto. */
export const MAX_OMITIDOS_POR_ETAPA = 1
