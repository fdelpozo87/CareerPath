#!/usr/bin/env node
// Lista lo que todavía falta completar en la política de privacidad (los textos entre corchetes) y falla si
// queda algo. Se corre antes de abrir el servicio a más gente: `npm run legal:check`.

import { readFileSync } from 'node:fs'

const es = JSON.parse(readFileSync(new URL('../shared/locales/es.json', import.meta.url), 'utf-8'))
const pendientes = []
for (const [clave, texto] of Object.entries(es)) {
  if (!clave.startsWith('privacy.')) continue
  for (const m of String(texto).matchAll(/\[[^\]]+\]/g)) pendientes.push({ clave, texto: m[0] })
}

if (pendientes.length === 0) {
  console.log('✓ La política de privacidad no tiene datos pendientes.')
  process.exit(0)
}
console.log(`La política de privacidad tiene ${pendientes.length} dato(s) pendiente(s):\n`)
for (const p of pendientes) console.log(`  ${p.clave}\n    ${p.texto}\n`)
console.log('Quedan, además, la revisión legal del texto y de su traducción al inglés (ver docs/LEGAL_PENDIENTES.md).')
process.exit(1)
