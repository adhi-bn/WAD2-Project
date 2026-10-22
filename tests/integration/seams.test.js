import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseClient, getSupabase } from '../../src/lib/supabase.js'
import { fetchJson } from '../../src/lib/http.js'

describe('supabase seam', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns null without credentials (null-safe)', () => {
    expect(createSupabaseClient(undefined, undefined)).toBeNull()
    expect(createSupabaseClient('https://x.supabase.co', '')).toBeNull()
  })

  it('creates a client when both values are present', () => {
    const client = createSupabaseClient('https://example.supabase.co', 'anon-key')
    expect(client).toBeTruthy()
    expect(typeof client.auth.getSession).toBe('function')
  })

  it('getSupabase is null when env vars are unset', async () => {
    vi.resetModules()
    const mod = await import('../../src/lib/supabase.js')
    expect(mod.getSupabase()).toBeNull()
  })

  it('getSupabase builds a client from env vars', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const mod = await import('../../src/lib/supabase.js')
    expect(mod.getSupabase()).toBeTruthy()
  })
})

describe('http seam', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('parses JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ parts: [] }) })),
    )
    await expect(fetchJson('/api/parts')).resolves.toEqual({ parts: [] })
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, statusText: 'Server Error' })),
    )
    await expect(fetchJson('/api/parts')).rejects.toThrow('fetchJson 500 Server Error')
  })
})
