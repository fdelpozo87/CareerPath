// Genera códigos de acceso de prueba para ACCESS_CODES.
//   npm run access:code -- ana luis marta
// Imprime una entrada por persona y la línea lista para pegar en Vercel / .env.
import { randomInt } from 'node:crypto'

// Sin I, L, O, 0, 1: no se confunden al dictarlos o copiarlos.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const newCode = () => `${group()}-${group()}-${group()}` // 12 caracteres ≈ 59 bits

const names = process.argv.slice(2).filter((n) => /^[a-zA-Z0-9_-]{1,40}$/.test(n))
if (names.length === 0) {
  console.error('Uso: npm run access:code -- nombre1 nombre2 ...   (letras, números, - o _)')
  process.exit(1)
}

const entries = names.map((n) => [n, newCode()])
console.log('\nCódigos para entregar (uno por persona, por un canal privado):\n')
for (const [n, c] of entries) console.log(`  ${n.padEnd(14)} ${c}`)
console.log('\nLínea para ACCESS_CODES (Vercel → Settings → Environment Variables, o .env):\n')
console.log(`  ACCESS_CODES=${entries.map(([n, c]) => `${n}:${c}`).join(',')}\n`)
