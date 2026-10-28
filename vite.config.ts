import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sitePlugin } from './vite.site'

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
      // Borrado de cuenta y panel de administración (misma lógica que api/account.ts y api/admin.ts).
      for (const [route, file, fn] of [
        ['account', '/server/account.ts', 'handleAccount'],
        ['admin', '/server/admin.ts', 'handleAdmin'],
        ['evaluaciones', '/server/evaluaciones.ts', 'handleEvaluaciones'],
        ['comentarios', '/server/comentarios.ts', 'handleComentarios'],
      ] as const) {
        server.middlewares.use(`/api/${route}`, async (req, res) => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const raw = Buffer.concat(chunks).toString('utf-8')
            const mod = await server.ssrLoadModule(file)
            const result = await mod[fn](Object.assign(req, { body: raw ? JSON.parse(raw) : undefined }), geminiApiKey)
            res.statusCode = result.status
            res.end(JSON.stringify(result.body))
          } catch {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Algo falló de nuestro lado.' }))
          }
        })
      }
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
  // El servidor (borrar cuenta, recordatorios) lee estas variables con process.env.
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'REMINDER_FROM', 'APP_URL', 'ADMIN_EMAIL', 'REQUIRE_LOGIN', 'ADMIN_REQUIRE_MFA', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL'] as const) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }
  // Al navegador solo llegan la URL y la clave anónima de Supabase (públicas por diseño, la seguridad la
  // da RLS). Nunca la service role: por eso se definen una por una y no se abre un prefijo entero.
  const publicSupabase = {
    __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''),
    __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''),
  }
  return {
    define: publicSupabase,
    plugins: [react(), tailwindcss(), sitePlugin(), devApi(env.GEMINI_API_KEY)],
  }
})
