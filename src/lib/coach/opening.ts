import { translate, type Lang } from '../../../shared/i18n'
import { getLang } from '../i18n'
import type { Path, Stage, TurnResult } from './types'

// Apertura con texto fijo del Camino A: el primer mensaje del coach no lo escribe el modelo, así la persona siempre ve
// exactamente el mismo saludo y no se gasta una llamada. Tiene la forma de un turno del coach (con su JSON, que se
// reenvía como historial) y deja marcado el tema "goal" como ya preguntado: es lo que pregunta el texto.

/** `lang`: el idioma del texto (por defecto, el de la interfaz). */
export function scriptedOpening(path: Path, stage: Stage, lang: Lang = getLang()): TurnResult | null {
  if (path !== 'quiebre' || stage !== 'diagnostico') return null
  return {
    mensaje: translate(lang, 'chat.opening.quiebre'),
    temaEnFoco: 'goal',
    temasOmitidos: [],
    objetivosCubiertos: [],
    listoParaAvanzar: false,
    derivacion: false,
    sintesisEtapa: '',
    sintesisItems: [],
    preguntaPuente: '',
  }
}
