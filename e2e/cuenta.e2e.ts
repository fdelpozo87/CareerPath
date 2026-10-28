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

    // Inicio: los tres caminos.
    await expect(page.getByRole('heading', { level: 2, name: 'Quiero dar un paso, pero no sé cuál' })).toBeVisible()
    const caminos = page.locator('#profesional').getByRole('button', { name: /^Empezar/ })
    await expect(caminos).toHaveCount(3)

    // Camino A: aparece el chat y el coach saluda.
    await caminos.first().click()
    await expect(page.getByText('Hola, cuéntame qué está pasando con tu trabajo.')).toBeVisible()

    // La persona responde y el coach contesta.
    await page.getByRole('textbox').fill('Siento que me estanqué en mi trabajo')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('Gracias por contarlo.')).toBeVisible()
    expect(mocks.turnos).toBeGreaterThanOrEqual(2)
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
})
