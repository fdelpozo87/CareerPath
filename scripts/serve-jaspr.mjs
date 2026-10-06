// Servidor local para probar la versión Jaspr con la API real:
//   - sirve web_jaspr/build/jaspr (el resultado de `jaspr build`)
//   - reenvía /api/* a la API local (por defecto el servidor de desarrollo de Vite en :5173)
//
//   npm run dev                      # en otra terminal: levanta la API local
//   node scripts/serve-jaspr.mjs     # http://localhost:8080
//
// Variables: PORT (8080), API_TARGET (http://localhost:5173).

import { createServer, request as httpRequest } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web_jaspr/build/jaspr')
const port = Number(process.env.PORT ?? 8080)
const api = new URL(process.env.API_TARGET ?? 'http://localhost:5173')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/api/')) {
    const proxied = httpRequest(
      { host: api.hostname, port: api.port, path: url.pathname + url.search, method: req.method, headers: { ...req.headers, host: api.host, origin: api.origin } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      },
    )
    proxied.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `No hay API en ${api.origin}. Levantala con "npm run dev".` }))
    })
    req.pipe(proxied)
    return
  }
  // Los scripts de Vercel Analytics no existen en local: se responde vacío para no ensuciar la consola.
  if (url.pathname.startsWith('/_vercel/')) {
    res.writeHead(200, { 'Content-Type': 'text/javascript' })
    res.end('')
    return
  }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    // Como en Vercel: cualquier ruta desconocida vuelve a la app.
    res.writeHead(200, { 'Content-Type': TYPES['.html'] })
    res.end(await readFile(path.join(root, 'index.html')))
  }
}).listen(port, () => console.log(`Jaspr en http://localhost:${port}  (API → ${api.origin})`))
