import type { Path, Stage, SynthesisItem } from '../../../shared/stages'

export type { Path, Stage, SynthesisItem }

export interface TurnResult {
  mensaje: string
  /** Tema (id) sobre el que gira la pregunta de este turno; "" si ninguno. */
  temaEnFoco: string
  /** Temas (ids) que la persona eligió dejar para más adelante. No son temas cubiertos. */
  temasOmitidos: string[]
  objetivosCubiertos: string[]
  listoParaAvanzar: boolean
  derivacion: boolean
  sintesisEtapa: string
  sintesisItems: SynthesisItem[]
  preguntaPuente: string
}

/** El mapa con el que cierra una etapa (lo que la persona dijo, ordenado). */
export interface StageMap {
  items: SynthesisItem[]
  pregunta: string
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
  /** Este mensaje del coach cerró la etapa: el mapa se muestra justo después. */
  cierraEtapa?: boolean
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
  /** Tema de la etapa sobre el que está preguntando el coach ahora (para resaltarlo en el encabezado). */
  foco?: string
  /** Temas que la persona eligió dejar para más adelante, por etapa. */
  omitidos?: Partial<Record<Stage, string[]>>
  /** El mapa de cierre de cada etapa, para mostrarlo en pantalla. */
  mapas?: Partial<Record<Stage, StageMap>>
  /** La etapa actual está cerrada y espera que la persona avance. Una vez cerrada, no se reabre sola. */
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
