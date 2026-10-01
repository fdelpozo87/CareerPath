import type { Path, Stage } from '../../../shared/stages'

export type { Path, Stage }

export interface TurnResult {
  mensaje: string
  objetivosCubiertos: string[]
  listoParaAvanzar: boolean
  derivacion: boolean
  sintesisEtapa: string
}

export interface UiMessage {
  role: 'user' | 'model'
  /** Texto que ve la persona. */
  text: string
  /** Para turnos del modelo: el JSON crudo, que se reenvía como historial. */
  raw?: string
  /** Mensajes de control (inicio de etapa) que no se muestran en el chat. */
  hidden?: boolean
  stage: Stage
  derivacion?: boolean
}

export type DocTipo = 'cv' | 'linkedin'

/** Un documento que compartió la persona, ya convertido a texto. */
export interface ProfileDoc {
  tipo: DocTipo
  nombre: string
  texto: string
}

export interface Observation {
  observacion: string
  cita: string
  /** De qué documento sale la cita: "CV" o "LinkedIn". */
  fuente?: string
}

export interface ProfileReading {
  primeraImpresion: string
  fortalezas: Observation[]
  ausencias: Observation[]
  consistenciaMarca: string
  recomendaciones: { cambio: string; porQue: string; cita: string; fuente?: string; tipo: 'mercado' | 'decision_personal' }[]
  nota: number
  notaComunica: string
}

export interface ReportAction {
  texto: string
  bloque: '70' | '20' | '10'
  tipo: 'pedido' | 'oferta' | 'accion'
  fortalezaAncla: string
  cuatroC: string[]
}

export interface Report {
  objetivoSesion: string
  hallazgos: { texto: string; citaPersona: string }[]
  acciones: ReportAction[]
  metrica: string
  checkIn: string
  horizonte: string
  preguntaAbierta: string
}

export type Phase = 'perfil' | 'chat' | 'informe'

export interface Session {
  version: 2
  path: Path
  phase: Phase
  stage: Stage
  messages: UiMessage[]
  cubiertos: Record<Stage, string[]>
  sintesis: Partial<Record<Stage, string>>
  /** La etapa actual cumplió la regla de avance y espera que la persona continúe. */
  stageReady: boolean
  /** CV y/o LinkedIn: como mucho uno de cada tipo. */
  documentos: ProfileDoc[]
  perfil?: { puesto: string; lectura: ProfileReading; elegidas: number[] }
  informe?: Report
  /** Índices de acciones del informe que la persona asumió como compromiso. */
  compromisos?: number[]
  compromisosFecha?: string
  updatedAt: string
}
