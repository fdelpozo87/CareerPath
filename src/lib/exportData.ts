import { currentUser, listSavedReports } from './cloud'
import { getLang } from './i18n'
import { listSessions } from './coach/session'

// "Descargar mis datos": todo lo que Bivio tiene de la persona, en un archivo que se arma y se baja en su
// propio navegador. Incluye los procesos guardados en este navegador (con su conversación) y, si tiene cuenta,
// lo que hay guardado en ella. No se manda a ningún servidor.

export async function buildExport() {
  const user = await currentUser()
  const saved = user ? await listSavedReports().catch(() => []) : []
  return {
    exportadoEl: new Date().toISOString(),
    idioma: getLang(),
    cuenta: user ? { email: user.email } : null,
    procesosEnEsteNavegador: listSessions(),
    informesGuardadosEnLaCuenta: saved,
  }
}

export async function downloadMyData(): Promise<void> {
  const data = await buildExport()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bivio-mis-datos-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
