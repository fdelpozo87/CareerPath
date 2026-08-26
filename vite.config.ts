import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: sirve /api/analyze localmente con `npm run dev`, espejando
// api/analyze.ts, para no depender de `vercel dev` (que pide login) solo
// para probar los flujos de IA en desarrollo. Vercel usa api/analyze.ts
// directamente en producción — este plugin no corre ahí.
function devAnalyzeApi(geminiApiKey: string | undefined): Plugin {
  return {
    name: 'dev-analyze-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (!geminiApiKey) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ demo: true }))
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const { parts } = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')

          if (!Array.isArray(parts) || parts.length === 0) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Payload inválido' }))
            return
          }

          const { GoogleGenerativeAI } = await import('@google/generative-ai')
          const genAI = new GoogleGenerativeAI(geminiApiKey)
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
          const result = await model.generateContent(parts)
          const text = result.response.text().trim()

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ text }))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Error al consultar la IA' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devAnalyzeApi(env.GEMINI_API_KEY)],
  }
})
