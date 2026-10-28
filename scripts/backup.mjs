#!/usr/bin/env node
// Copia de seguridad de los datos de Bivio: baja cada tabla de Supabase (por la API REST, con la service role) a un JSON.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run backup            # deja los archivos en backups/AAAA-MM-DD/
//   BACKUP_DIR=/ruta npm run backup                                      # otra carpeta
//
// Lo que NO incluye: las contraseñas y los factores de verificación (viven en auth.users, que la API REST no expone).
// Para recuperar una cuenta alcanza con que la persona use "Olvidé mi contraseña". Los archivos tienen datos personales:
// no se commitean (backups/ está en .gitignore) y el workflow semanal los sube cifrados. Ver docs/OPERACION.md.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/+$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

// bivio_limites (contadores de límites de uso) no se respalda: se reconstruye sola.
const TABLAS = ['bivio_perfiles', 'bivio_informes', 'bivio_recordatorios', 'bivio_auditoria', 'bivio_evaluaciones', 'bivio_asignaciones', 'bivio_compartidas', 'bivio_sesiones', 'bivio_comentarios']
const PAGINA = 1000

const day = new Date().toISOString().slice(0, 10)
const dir = join(process.env.BACKUP_DIR ?? 'backups', day)
await mkdir(dir, { recursive: true })

let fallas = 0
const resumen = {}
for (const tabla of TABLAS) {
  const filas = []
  try {
    for (let desde = 0; ; desde += PAGINA) {
      const res = await fetch(`${URL_BASE}/rest/v1/${tabla}?select=*`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${desde}-${desde + PAGINA - 1}`, 'Range-Unit': 'items' },
      })
      // 404 / PGRST205: la tabla no existe (la migración no se corrió): se avisa pero no se corta el resto.
      if (res.status === 404) throw new Error('la tabla no existe (¿falta correr su migración?)')
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
      const pagina = await res.json()
      filas.push(...pagina)
      if (pagina.length < PAGINA) break
    }
    await writeFile(join(dir, `${tabla}.json`), JSON.stringify(filas, null, 2))
    resumen[tabla] = filas.length
  } catch (e) {
    fallas++
    resumen[tabla] = `ERROR: ${e instanceof Error ? e.message : e}`
  }
}

await writeFile(join(dir, '_resumen.json'), JSON.stringify({ fecha: new Date().toISOString(), tablas: resumen }, null, 2))
console.log(`Copia en ${dir}`)
for (const [t, n] of Object.entries(resumen)) console.log(`  ${t}: ${n}`)
if (fallas > 0) {
  console.error(`${fallas} tabla(s) con error.`)
  process.exit(1)
}
