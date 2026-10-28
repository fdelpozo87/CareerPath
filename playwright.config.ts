import { defineConfig } from '@playwright/test'

// Pruebas de punta a punta: el sitio ya compilado (npm run e2e) en un Chrome de verdad, con Supabase y el servidor
// simulados en el navegador (ver e2e/helpers.ts). No gastan modelo ni tocan datos reales.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Usa el Chrome instalado (en GitHub Actions ya viene): no hace falta bajar navegadores.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173/es/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
