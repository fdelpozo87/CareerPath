// Prueba de humo del deploy: recorre el Diagnóstico completo contra una URL real, como lo hace la app.
//
//   ACCESS_CODE='XXXX-XXXX-XXXX' node scripts/smoke.mjs https://career-path-ruby.vercel.app
//
// - El código se lee de la variable ACCESS_CODE y NO se imprime nunca.
// - Sin ACCESS_CODE funciona contra un servidor abierto (por ejemplo, localhost).
// - Cuesta unos centavos de Gemini (una conversación corta).
// Sale con código 0 si todo anda y 1 si algo falla.

import { setTimeout as sleep } from 'node:timers/promises'

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const code = process.env.ACCESS_CODE
const origin = new URL(base).origin
const SLOW_MS = 30_000 // Vercel corta las funciones a los 60 s: arriba de esto hay riesgo

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function post(path, body, withCode = true) {
  const started = Date.now()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(withCode && code ? { 'x-access-code': code } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, ms: Date.now() - started }
}

console.log(`\nProbando ${base}${code ? ' (con código de acceso)' : ' (sin código)'}\n`)

// 1) La puerta de acceso
const gate = await post('/api/access', {}, false)
const required = gate.json.required === true
check('La puerta de acceso responde', gate.status === 200, `exige código: ${required ? 'sí' : 'no'}`)
if (required) {
  const anon = await post('/api/coach', { mode: 'turno' }, false)
  check('Sin código, la API rechaza el pedido', anon.status === 401, `HTTP ${anon.status}`)
  if (!code) {
    console.log('\nEste servidor exige código y no pasaste ACCESS_CODE: no puedo seguir con la conversación.')
    process.exit(1)
  }
  const ok = await post('/api/access', { code })
  check('El código de acceso es válido', ok.status === 200 && ok.json.ok === true, `HTTP ${ok.status}`)
  if (!(ok.status === 200 && ok.json.ok === true)) process.exit(1)
}

// 2) Una conversación real: Diagnóstico completo
const PERSONA = [
  'Hace 4 años soy analista en un banco y me siento estancada. Quiero pasar a producto, pero no sé si estoy lista.',
  'El mes pasado pedí cambiarme al área de producto y me dijeron que no había vacantes. Desde ahí me siento un cero a la izquierda.',
  'Veo tres caminos: quedarme esperando, buscar en otra empresa un rol de producto, o hacer un curso y armar algo propio.',
  'Mandé algunos CVs sin foco. Estoy dispuesta a dedicarle tiempo real, dos horas por semana, a pensar esto bien.',
]
const OPEN =
  '(Inicio de la sesión, Camino A. Presentate en una oración — vas a preguntar más de lo que vas a responder y las conclusiones van a ser suyas — y hacé tu primera pregunta abierta.)'

const history = [{ role: 'user', text: OPEN }]
let cubiertos = []
const latencies = []
let closing = null
let canned = [...PERSONA]

for (let turn = 1; turn <= 14 && !closing; turn++) {
  const r = await post('/api/coach', { mode: 'turno', stage: 'diagnostico', path: 'quiebre', history, cubiertos, omitidos: [], sintesisPrevias: {} })
  latencies.push(r.ms)
  if (r.status !== 200 || !r.json.data) {
    check(`Turno ${turn} del coach`, false, `HTTP ${r.status} — ${r.json.error ?? 'sin datos'}`)
    process.exit(1)
  }
  const d = r.json.data
  cubiertos = d.objetivosCubiertos
  history.push({ role: 'model', text: JSON.stringify(d) })
  console.log(`   turno ${turn} (${(r.ms / 1000).toFixed(1)} s) temas ${cubiertos.length}/4 · coach: ${d.mensaje.replace(/\s+/g, ' ').slice(0, 90)}…`)
  if (turn === 1) check('El coach saluda y hace una primera pregunta', d.mensaje.length > 20, r.json.demo ? 'ATENCIÓN: está en modo demo (falta GEMINI_API_KEY)' : '')
  if (d.listoParaAvanzar) {
    closing = d
    break
  }
  const pidioConfirmar = /te representa|resumo|lo que dijiste/i.test(d.mensaje)
  history.push({ role: 'user', text: pidioConfirmar ? 'Sí, me representa.' : (canned.shift() ?? 'Sí, así es.') })
  await sleep(3200) // límite de 20 pedidos por minuto
}

check('La etapa cierra sola cuando se cubren los temas', Boolean(closing), closing ? `${latencies.length} turnos` : 'no cerró en 14 turnos')
if (closing) {
  const items = closing.sintesisItems ?? []
  check('El cierre trae el mapa con las frases de la persona', items.length >= 3, `${items.length} tarjetas, ${items.filter((i) => i.cita).length} con cita textual`)
  check('El cierre trae una pregunta para llevarse', typeof closing.preguntaPuente === 'string' && closing.preguntaPuente.length > 10)

  // 3) Después del mapa: un "gracias" no debe reabrir la etapa
  history.push({ role: 'user', text: 'Gracias, me gustó cómo quedó.' })
  await sleep(3200)
  const after = await post('/api/coach', { mode: 'turno', stage: 'diagnostico', path: 'quiebre', history, cubiertos, omitidos: [], etapaCerrada: true, sintesisPrevias: {} })
  latencies.push(after.ms)
  check('Una etapa cerrada no se reabre con un "gracias"', after.status === 200 && after.json.data?.listoParaAvanzar === true, `HTTP ${after.status}`)
}

// 4) Tiempos
const max = Math.max(...latencies)
const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
check('Ningún turno se acerca al límite de tiempo de Vercel', max < SLOW_MS, `promedio ${(avg / 1000).toFixed(1)} s, el más lento ${(max / 1000).toFixed(1)} s (límite de la función: 60 s)`)

const failed = results.filter((r) => !r).length
console.log(`\n${failed === 0 ? '✅ TODO BIEN' : `❌ ${failed} chequeo(s) fallaron`} — ${results.length - failed}/${results.length}\n`)
process.exit(failed === 0 ? 0 : 1)
