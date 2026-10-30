import { expect, test } from '@playwright/test'
import { mockBackend } from './helpers'

test.describe('entrada a Bivio', () => {
  test('las pestañas, la validación y el registro con contraseña', async ({ page }) => {
    const mocks = await mockBackend(page)
    await page.goto('/es/')

    await expect(page.getByRole('tab', { name: 'Ingresar' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qué bueno verte de nuevo')

    await page.getByRole('tab', { name: 'Crear cuenta' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crea tu cuenta')

    await page.getByLabel('Tu email').fill('nueva@example.com')
    await page.getByLabel('Contraseña').fill('corta')
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
    await expect(page.getByRole('alert')).toContainText('muy corta')
    expect(mocks.signups).toHaveLength(0)

    await page.getByLabel('Contraseña').fill('una frase larga y segura')
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
    await expect(page.getByRole('status')).toContainText('nueva@example.com')
    expect(mocks.signups).toHaveLength(1)
    expect(mocks.signups[0]).toMatchObject({ email: 'nueva@example.com', password: 'una frase larga y segura' })
  })

  test('ingresar con contraseña, elegir un camino y conversar con el coach', async ({ page }) => {
    const mocks = await mockBackend(page, { loginEmail: 'persona@example.com' })
    await page.goto('/es/')

    await page.getByLabel('Tu email').fill('persona@example.com')
    await page.getByLabel('Contraseña').fill('una frase larga y segura')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).last().click()

    // Inicio: el saludo (sin nombre hasta que lo tengamos), la primera sesión y los tres caminos.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola. ¿Por dónde quieres empezar hoy?')
    await expect(page.getByRole('heading', { level: 2, name: 'Elige tu primera sesión' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Quiero dar un paso, pero no sé cuál' })).toBeVisible()
    const caminos = page.locator('#profesional').getByRole('button', { name: /^Empezar/ })
    await expect(caminos).toHaveCount(3)

    // Camino A: primero la pantalla de inicio, sin llamar al coach todavía.
    await caminos.first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Esto es lo que vamos a hacer' })).toBeVisible()
    await expect(page.getByText('Me cuentas qué te está pasando.')).toBeVisible()
    expect(mocks.turnos).toBe(0)

    // "¿Empezamos?" abre la conversación directamente con la primera pregunta: sin etapa 0 ni bloque "Antes de empezar".
    await page.getByRole('button', { name: /Empezamos/ }).click()
    await expect(page.getByText('Hola. Te acompaño en este espacio: aquí voy a preguntar más de lo que voy a responder')).toBeVisible()
    await expect(page.getByText('¿Qué es lo que te trae por aquí y qué esperas poder destrabar en este momento?')).toBeVisible()
    // La apertura del Camino A es un texto fijo: tampoco gasta una llamada al coach.
    expect(mocks.turnos).toBe(0)
    await expect(page.getByText('Antes de empezar')).toHaveCount(0)
    await expect(page.getByText('Etapa 0')).toHaveCount(0)
    await expect(page.getByRole('progressbar', { name: 'Avance de la etapa' })).toBeVisible()
    await expect(page.getByText('Etapa 1 de 3 · Diagnóstico')).toBeVisible()
    // Si cuesta empezar, hay frases para tomar debajo de la primera pregunta.
    await expect(page.getByRole('button', { name: 'Siento que estoy estancado/a' })).toBeVisible()

    // La persona responde y el coach contesta.
    await page.getByRole('textbox').fill('Siento que me estanqué en mi trabajo')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('Gracias por contarlo.')).toBeVisible()
    expect(mocks.turnos).toBe(1)
  })

  test('olvidé mi contraseña manda el email de recuperación', async ({ page }) => {
    let recuperaciones = 0
    await mockBackend(page)
    await page.route('https://e2e.supabase.test/auth/v1/recover**', (route) => {
      recuperaciones++
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.goto('/es/')
    await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
    await expect(page.getByRole('alert')).toContainText('Escribe primero tu email')
    await page.getByLabel('Tu email').fill('persona@example.com')
    await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
    await expect(page.getByRole('status')).toContainText('persona@example.com')
    expect(recuperaciones).toBe(1)
  })

  test('el idioma viene de la URL: /en/ abre en inglés con su canonical', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good to see you again')
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/en\/$/)
  })

  /** Entra, abre el Camino A, empieza y manda `n` respuestas, esperando la contestación del coach cada vez. */
  async function entrarYConversar(page: import('@playwright/test').Page, n: number) {
    await page.goto('/es/')
    await page.getByLabel('Tu email').fill('persona@example.com')
    await page.getByLabel('Contraseña').fill('una frase larga y segura')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).last().click()
    await page.locator('#profesional').getByRole('button', { name: /^Empezar/ }).first().click()
    await page.getByRole('button', { name: /Empezamos/ }).click()
    await expect(page.getByText('Hola. Te acompaño en este espacio')).toBeVisible()
    // En el Camino A el CV no se pide de entrada: no hay botón de documentos en el encabezado.
    await expect(page.getByRole('button', { name: /Sumar mi CV o LinkedIn/ })).toHaveCount(0)
    for (let i = 1; i <= n; i++) {
      await page.getByRole('textbox').fill(`Respuesta número ${i}`)
      await page.getByRole('button', { name: 'Enviar' }).click()
      await expect(page.getByText(`Respuesta número ${i}`)).toBeVisible()
      await expect(page.getByRole('textbox')).toBeEnabled()
    }
  }

  test('camino A: el coach sugiere sumar el CV cuando lo amerita, y se puede dejar pasar', async ({ page }) => {
    await mockBackend(page, { turnExtras: { 2: { pideDocumentos: ['cv'] } } })
    await entrarYConversar(page, 1)
    await expect(page.getByText('Si quieres, comparte tu CV o tu LinkedIn')).toHaveCount(0)
    await page.getByRole('textbox').fill('Respuesta número 2')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('Si quieres, comparte tu CV o tu LinkedIn')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sumar mi CV' })).toBeVisible()
    await page.getByRole('button', { name: 'Ahora no' }).click()
    await expect(page.getByText('Si quieres, comparte tu CV o tu LinkedIn')).toHaveCount(0)
  })

  test('camino A: el coach sugiere el Camino B y la persona puede pasar a él', async ({ page }) => {
    await mockBackend(page, { turnExtras: { 3: { sugiereCamino: 'perfil' } } })
    await entrarYConversar(page, 3)
    await expect(page.getByText('Esto también se puede trabajar en el Camino B')).toBeVisible()
    await page.getByRole('button', { name: 'Ir al Camino B' }).click()
    // Arranca el Camino B desde su pantalla de inicio.
    await expect(page.getByRole('heading', { level: 1, name: 'Esto es lo que vamos a hacer' })).toBeVisible()
    await expect(page.getByText('Subes tu CV o tu perfil de LinkedIn.')).toBeVisible()
  })

  test('el mapa de la Exploración muestra el ikigai con las palabras de la persona y deja el centro para ella', async ({ page }) => {
    const ikigai = { ama: 'enseñar a mis compañeros', bueno: 'ordenar procesos', mundo: '', pagan: 'mantener los reportes' }
    await mockBackend(page, {
      turnExtras: {
        1: {
          listoParaAvanzar: true,
          sintesisEtapa: 'Resumen de lo que dijiste.',
          sintesisItems: [{ id: 'ikigai', texto: 'Disfrutas enseñar y se te da bien ordenar procesos.', cita: '', ikigai }],
          preguntaPuente: '¿Qué ves en el cruce?',
        },
      },
    })
    await entrarYConversar(page, 1)
    const chart = page.getByTestId('ikigai-chart')
    await expect(chart).toBeVisible()
    await expect(chart.getByText('enseñar a mis compañeros').first()).toBeVisible()
    await expect(chart.getByText('mantener los reportes').first()).toBeVisible()
    // La mirada que la persona no dijo queda en blanco, sin inventarla; el centro lo nombra ella.
    await expect(chart.getByText('Todavía no lo dijiste').first()).toBeVisible()
    await expect(chart.getByText('Lo nombras tú')).toBeVisible()
    await expect(page.getByText('Es una herramienta para pensar, no un resultado')).toBeVisible()
  })
})
