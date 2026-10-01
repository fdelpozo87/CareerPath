import type { IncomingMessage, ServerResponse } from 'node:http'

// Tipos mínimos de las funciones de Vercel (Node runtime), que agrega `body`,
// `status()` y `json()` en tiempo de ejecución. Los definimos acá para no
// depender de @vercel/node, que arrastra dependencias con vulnerabilidades
// conocidas y solo se usaba por estos dos tipos.
export type ApiRequest = IncomingMessage & { body?: unknown }
export type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}
