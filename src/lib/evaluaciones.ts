import { authHeader } from './cloud'
import { getLang, tr } from './i18n'

// Cliente de /api/evaluaciones (server/evaluaciones.ts). Las reglas de quién ve qué las aplica el servidor.

export interface Competencia {
  id: string
  nombre: string
  descripcion: string
  preguntas: string[]
}

export interface Borrador {
  titulo: string
  competencias: Competencia[]
}

export interface Respuesta {
  nivel?: number
  evidencia: string
}
export type Respuestas = Record<string, Respuesta | string | undefined> & { desarrollo?: string }

export interface Informe {
  resumen: string
  fortalezas: { competencia: string; texto: string; evidencia: string }[]
  desarrollo: { competencia: string; texto: string; evidencia: string }[]
  coherencia: { competencia: string; nota: string }[]
  planDesarrollo: { texto: string; bloque: '70' | '20' | '10'; plazo: string }[]
  preguntasParaConversar: string[]
}

export type EstadoAsignacion = 'pendiente' | 'en_curso' | 'completada'

export interface ItemMia {
  id: string
  estado: EstadoAsignacion
  titulo: string
  area: string
  tipo: 'asignada' | 'directa'
  creadaPor: string
  asignadaAt: string
  completadaAt: string | null
}

export interface ItemCreada {
  id: string
  titulo: string
  area: string
  rol: string
  periodo: string
  createdAt: string
  asignaciones: { id: string; email: string; estado: EstadoAsignacion; completadaAt: string | null }[]
}

export interface Abierta {
  id: string
  estado: EstadoAsignacion
  /** 'responde': es quien se autoevalúa. 'creador': es quien la creó (ve respuestas e informe solo si ya se enviaron). */
  rol: 'responde' | 'creador'
  evaluacion: { titulo: string; area: string; rol: string; periodo: string; tipo: 'asignada' | 'directa'; competencias: Competencia[] }
  creadaPor: string
  email: string
  respuestas: Respuestas
  informe: Informe | null
  completadaAt: string | null
}

export interface ResultadoAsignacion {
  email: string
  problema: 'sin_cuenta' | 'cuenta_inactiva' | null
  avisado: boolean
}

export class EvalError extends Error {
  status: number
  extra: Record<string, unknown>
  constructor(message: string, status: number, extra: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/evaluaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lang': getLang(), ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new EvalError(json.error ?? tr('flow.err.generic'), res.status, json as Record<string, unknown>)
  return json
}

export const generar = (p: { modo: 'jefe' | 'propia'; area: string; rol: string; periodo: string; foco: string; ajuste?: string; previa?: Borrador }) =>
  call<{ borrador: Borrador; nota?: string; demo?: boolean }>({ action: 'generar', ...p })

export const crear = (p: { modo: 'jefe' | 'propia'; titulo: string; area: string; rol: string; periodo: string; competencias: Competencia[]; emails?: string[]; notify?: boolean }) =>
  call<{ ok: true; id: string; resultados: ResultadoAsignacion[] }>({ action: 'crear', ...p })

export const mias = () => call<{ items: ItemMia[]; pendientes: number }>({ action: 'mias' })
export const creadas = () => call<{ items: ItemCreada[] }>({ action: 'creadas' })
export const abrir = (id: string) => call<Abierta>({ action: 'abrir', id })
export const guardar = (id: string, respuestas: Respuestas) => call<{ ok: true }>({ action: 'guardar', id, respuestas })
export const enviar = (id: string, respuestas: Respuestas) => call<{ ok: true; informe: Informe }>({ action: 'enviar', id, respuestas })
export const eliminar = (id: string) => call<{ ok: true }>({ action: 'eliminar', id })

export const NIVEL_KEYS = ['eval.level.1', 'eval.level.2', 'eval.level.3', 'eval.level.4'] as const
