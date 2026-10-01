import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: sirve /api/coach, /api/analyze y /api/access con `npm run dev` usando la misma
// capa que las funciones de Vercel (server/endpoints.ts), cargada con
// ssrLoadModule para que los cambios en el servidor se tomen sin reiniciar.
// En producción Vercel usa api/*.ts; este plugin no corre ahí.
const MAX_BODY_BYTES = 4_500_000 // mismo tope que Vercel

function devApi(geminiApiKey: string | undefined): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      for (const endpoint of ['coach', 'analyze', 'access'] as const) {
        server.middlewares.use(`/api/${endpoint}`, async (req, res) => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const chunks: Buffer[] = []
            let size = 0
            for await (const chunk of req) {
              size += (chunk as Buffer).length
              if (size > MAX_BODY_BYTES) {
                res.statusCode = 413
                res.end(JSON.stringify({ error: 'El pedido es demasiado grande.' }))
                return
              }
              chunks.push(chunk as Buffer)
            }
            const raw = Buffer.concat(chunks).toString('utf-8')
            let body: unknown
            try {
              body = raw ? JSON.parse(raw) : undefined
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Payload inválido' }))
              return
            }
            const { runEndpoint } = await server.ssrLoadModule('/server/endpoints.ts')
            const result = await runEndpoint(endpoint, Object.assign(req, { body }), geminiApiKey)
            for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v as string)
            res.statusCode = result.status
            res.end(JSON.stringify(result.body))
          } catch {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Algo falló de nuestro lado. Intentá de nuevo.' }))
          }
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL
  if (env.ALLOWED_ORIGINS) process.env.ALLOWED_ORIGINS = env.ALLOWED_ORIGINS
  if (env.ACCESS_CODES && !process.env.ACCESS_CODES) process.env.ACCESS_CODES = env.ACCESS_CODES
  return {
    plugins: [react(), tailwindcss(), devApi(env.GEMINI_API_KEY)],
  }
})
