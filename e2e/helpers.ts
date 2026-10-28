import type { Page, Route } from '@playwright/test'

// Simula lo que está afuera del navegador: Supabase (auth y tablas) y las funciones de /api. El sitio se compila con
// SUPABASE_URL=https://e2e.supabase.test (ver "e2e" en package.json), así que ningún pedido sale a la red real.

const SUPABASE = 'https://e2e.supabase.test'
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (email: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-e2e', email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`

const user = (email: string) => ({
  id: 'user-e2e',
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: '2026-10-01T00:00:00Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  identities: [],
  created_at: '2026-10-01T00:00:00Z',
})

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

export interface Mocks {
  /** Pedidos de registro recibidos (email y contraseña). */
  signups: { email: string; password: string }[]
  /** Turnos del coach recibidos. */
  turnos: number
}

/** Prepara los mocks. `loginEmail`: con qué email "entra" la contraseña. */
export async function mockBackend(page: Page, opts: { loginEmail?: string } = {}): Promise<Mocks> {
  const mocks: Mocks = { signups: [], turnos: 0 }
  const email = opts.loginEmail ?? 'persona@example.com'

  await page.route('**/_vercel/**', (r) => r.abort())

  await page.route(`${SUPABASE}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/token')) {
      return json(route, { access_token: jwt(email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-e2e', user: user(email) })
    }
    if (url.pathname.endsWith('/signup')) {
      mocks.signups.push(route.request().postDataJSON() as { email: string; password: string })
      return json(route, user((route.request().postDataJSON() as { email: string }).email))
    }
    if (url.pathname.endsWith('/user')) return json(route, user(email))
    return json(route, {})
  })
  await page.route(`${SUPABASE}/rest/v1/**`, (route) => json(route, []))

  await page.route('**/api/access', (route) => {
    const conSesion = Boolean(route.request().headers().authorization)
    return json(route, conSesion ? { required: true, mode: 'accounts', ok: true, isAdmin: false, areas: { profesionales: true, empresas: true } } : { required: true, mode: 'accounts', ok: false, reason: 'sin_sesion' })
  })
  await page.route('**/api/evaluaciones', (route) => json(route, { items: [], pendientes: 0 }))
  await page.route('**/api/coach', (route) => {
    mocks.turnos++
    return json(route, {
      data: {
        mensaje: mocks.turnos === 1 ? 'Hola, cuéntame qué está pasando con tu trabajo.' : 'Gracias por contarlo. ¿Qué es lo que más te pesa hoy?',
        objetivosCubiertos: [],
        temasOmitidos: [],
        listoParaAvanzar: false,
        derivacion: false,
      },
    })
  })
  return mocks
}
