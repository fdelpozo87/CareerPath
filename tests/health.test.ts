import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleHealth, resetHealthCache } from '../server/health'

beforeEach(() => {
  resetHealthCache()
  vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('GEMINI_API_KEY', 'g')
  vi.stubEnv('RESEND_API_KEY', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('/api/health', () => {
  it('200 cuando Supabase responde, y dice qué está configurado sin mostrar secretos', async () => {
    vi.stubGlobal('fetch', async () => new Response('[]', { status: 200 }))
    const r = await handleHealth()
    expect(r.status).toBe(200)
    expect(r.body.checks).toEqual({ supabase: 'ok', gemini: 'configurado', email: 'falta' })
    expect(JSON.stringify(r.body)).not.toContain('service')
  })

  it('503 cuando Supabase no responde', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('fetch failed')
    })
    const r = await handleHealth()
    expect(r.status).toBe(503)
    expect(r.body.ok).toBe(false)
  })

  it('503 cuando Supabase contesta con error', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }))
    expect((await handleHealth()).status).toBe(503)
  })

  it('sin Supabase configurado (modo local) no es un error', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    const r = await handleHealth()
    expect(r.status).toBe(200)
    expect(r.body.checks.supabase).toBe('falta')
  })

  it('no consulta a Supabase más de una vez cada 20 segundos', async () => {
    const f = vi.fn(async () => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', f)
    await handleHealth(1_000_000)
    await handleHealth(1_005_000)
    expect(f).toHaveBeenCalledTimes(1)
    await handleHealth(1_030_000)
    expect(f).toHaveBeenCalledTimes(2)
  })
})
