import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimits } from '../server/guard'
import { durableLimit } from '../server/limits'

const RULE = { limit: 3, windowMs: 60_000 }

/** Contador compartido de mentira, con la misma lógica que la función SQL (ventana fija). */
function fakeCounter(opts: { fail?: boolean } = {}) {
  const counts = new Map<string, number>()
  const calls: string[] = []
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    calls.push(String(_url))
    if (opts.fail) return new Response('{}', { status: 500 })
    const b = JSON.parse(String(init?.body)) as { p_key: string; p_limit: number }
    const n = (counts.get(b.p_key) ?? 0) + 1
    counts.set(b.p_key, n)
    return new Response(JSON.stringify([{ ok: n <= b.p_limit, hits: n, retry_after_s: 42 }]), { status: 200 })
  })
  return { counts, calls }
}

beforeEach(() => {
  resetRateLimits()
  vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('límite de uso compartido', () => {
  it('cuenta en la base y corta al pasar el tope', async () => {
    fakeCounter()
    const r = []
    for (let i = 0; i < 5; i++) r.push(await durableLimit('usuario:u1', { limit: 3, windowMs: 86_400_000 }))
    expect(r.map((x) => x.ok)).toEqual([true, true, true, false, false])
    expect(r[3].retryAfterS).toBeGreaterThan(0)
  })

  it('lo que cuenta una instancia lo ve la otra (el contador no es de memoria)', async () => {
    const shared = fakeCounter()
    await durableLimit('usuario:u2', RULE)
    await durableLimit('usuario:u2', RULE)
    resetRateLimits() // otra instancia: su memoria arranca vacía
    await durableLimit('usuario:u2', RULE)
    const cuarta = await durableLimit('usuario:u2', RULE)
    expect(shared.counts.get('usuario:u2')).toBe(4)
    expect(cuarta.ok).toBe(false)
  })

  it('el tope en memoria frena primero y no llama a la base', async () => {
    const shared = fakeCounter()
    for (let i = 0; i < 3; i++) await durableLimit('ip:1', RULE)
    const callsBefore = shared.calls.length
    expect((await durableLimit('ip:1', RULE)).ok).toBe(false)
    expect(shared.calls.length).toBe(callsBefore)
  })

  it('si la base falla, vale el tope en memoria (no se corta el servicio)', async () => {
    fakeCounter({ fail: true })
    expect((await durableLimit('usuario:u3', RULE)).ok).toBe(true)
    expect((await durableLimit('usuario:u3', RULE)).ok).toBe(true)
  })

  it('sin Supabase usa solo la memoria', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect((await durableLimit('solo-memoria', RULE)).ok).toBe(true)
    expect(f).not.toHaveBeenCalled()
  })
})
