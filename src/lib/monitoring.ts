import { track } from '@vercel/analytics'

// Monitoreo de errores del cliente. Sentry se carga solo si VITE_SENTRY_DSN
// está configurada (el DSN es público por diseño, no es un secreto) y en un
// chunk aparte, para no sumar peso a quien no lo usa.
//
// Privacidad: nunca se envía el contenido de la conversación ni de los
// documentos. Se descartan breadcrumbs de consola e inputs, los cuerpos de
// pedidos y cualquier texto largo en los mensajes de error.

type SentryLike = { captureException: (e: unknown, where: string) => void }
let sentry: SentryLike | null = null

const MAX_MESSAGE = 200

function scrub(text: string | undefined): string | undefined {
  if (!text) return text
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}…` : text
}

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window.error'))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'unhandledrejection'))

  if (!dsn) return
  try {
    const Sentry = await import('@sentry/react')
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Sentry v11: nada de datos de usuario, cookies, headers, query params ni cuerpos.
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, urlQueryParams: false, httpBodies: [] },
      tracesSampleRate: 0,
      beforeBreadcrumb(crumb) {
        if (crumb.category === 'console' || crumb.category?.startsWith('ui.input')) return null
        return crumb
      },
      beforeSend(event) {
        if (event.request) {
          delete event.request.data
          delete event.request.cookies
        }
        for (const ex of event.exception?.values ?? []) ex.value = scrub(ex.value)
        event.message = scrub(event.message)
        return event
      },
    })
    sentry = { captureException: (e, where) => Sentry.captureException(e, { tags: { where } }) }
  } catch {
    // Si Sentry no carga (bloqueador de anuncios, red), la app sigue igual.
  }
}

export function reportError(error: unknown, where: string) {
  const name = error instanceof Error ? error.name : typeof error
  try {
    // Solo metadatos: nunca el mensaje completo (puede contener texto de la persona).
    track('client_error', { where, name })
  } catch {
    // ignorado
  }
  sentry?.captureException(error, where)
}
