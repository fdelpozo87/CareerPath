import type { ApiRequest, ApiResponse } from '../server/http.js'
import { runReminders } from '../server/reminders.js'
import { logEvent } from '../server/guard.js'

// Lo llama el cron de Vercel (vercel.json). Vercel manda `Authorization: Bearer $CRON_SECRET`:
// sin ese secreto configurado, o con uno distinto, no se manda nada.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    logEvent('error', 'recordatorios_sin_secreto', { hint: 'Falta CRON_SECRET en el entorno de Vercel' })
    return res.status(503).json({ error: 'No configurado' })
  }
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'No autorizado' })
  try {
    res.status(200).json(await runReminders())
  } catch (e) {
    logEvent('error', 'recordatorios_error', { error: e instanceof Error ? e : String(e) })
    res.status(500).json({ error: 'Falló el envío' })
  }
}
