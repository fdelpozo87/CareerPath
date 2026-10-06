// Compila el CSS de la versión Jaspr (web_jaspr/): mismo Tailwind y mismos tokens que la versión
// React, pero escaneando las clases que aparecen en el código Dart.
//
//   node scripts/build-jaspr-css.mjs          # una vez
//
// Salida: web_jaspr/web/app.css (se genera, no se edita a mano).

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'web_jaspr/styles/app.css')
const out = path.join(root, 'web_jaspr/web/app.css')

const compiler = await compile(await readFile(entry, 'utf8'), {
  base: path.dirname(entry),
  onDependency: () => {},
})
const scanner = new Scanner({ sources: compiler.sources })
const css = compiler.build(scanner.scan())
await writeFile(out, css)
console.log(`app.css: ${(css.length / 1024).toFixed(1)} KB`)
