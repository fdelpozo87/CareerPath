// Genera los diccionarios de idiomas a partir de la única fuente de textos:
//   shared/locales/es.json  y  shared/locales/en.json
// Salidas (se commitean):
//   shared/locales/dictionaries.ts          → React y servidor
//   web_jaspr/lib/i18n/strings.g.dart       → Jaspr
//
//   node scripts/gen-i18n.mjs          # genera
//   node scripts/gen-i18n.mjs --check  # solo verifica (para CI): falla si algo no coincide
//
// Reglas: los dos idiomas tienen exactamente las mismas claves y las mismas variables {nombre}.

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = async (f) => JSON.parse(await readFile(path.join(root, f), 'utf8'))
const es = await read('shared/locales/es.json')
const en = await read('shared/locales/en.json')

const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const problems = []
for (const k of Object.keys(es)) {
  if (!(k in en)) problems.push(`falta en inglés: ${k}`)
  else if (vars(es[k]) !== vars(en[k])) problems.push(`variables distintas en "${k}": es {${vars(es[k])}} / en {${vars(en[k])}}`)
}
for (const k of Object.keys(en)) if (!(k in es)) problems.push(`falta en español: ${k}`)
for (const [lang, d] of [['es', es], ['en', en]])
  for (const [k, v] of Object.entries(d)) if (typeof v !== 'string' || v.trim() === '') problems.push(`vacío en ${lang}: ${k}`)

if (problems.length) {
  console.error(`Textos inconsistentes (${problems.length}):\n- ${problems.slice(0, 40).join('\n- ')}`)
  process.exit(1)
}
const keys = Object.keys(es).sort()
console.log(`${keys.length} textos, es/en consistentes.`)
if (process.argv.includes('--check')) process.exit(0)

const sorted = (d) => Object.fromEntries(keys.map((k) => [k, d[k]]))
const header = '// GENERADO por scripts/gen-i18n.mjs a partir de shared/locales/*.json. No editar a mano.\n'

await writeFile(
  path.join(root, 'shared/locales/dictionaries.ts'),
  `${header}\nexport const es = ${JSON.stringify(sorted(es), null, 2)} as const\n\nexport type Key = keyof typeof es\n\nexport const en: Record<Key, string> = ${JSON.stringify(sorted(en), null, 2)}\n`,
)

const dart = (d) => keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(d[k]).replaceAll('$', '\\$')},`).join('\n')
await writeFile(
  path.join(root, 'web_jaspr/lib/i18n/strings.g.dart'),
  `${header}// dart format off\n\nconst stringsEs = <String, String>{\n${dart(es)}\n};\n\nconst stringsEn = <String, String>{\n${dart(en)}\n};\n`,
)
console.log('dictionaries.ts y strings.g.dart escritos.')
