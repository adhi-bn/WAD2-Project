import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Controls what the mocked Supabase seam reports for each test.
const state = vi.hoisted(() => ({ ready: true, client: null }))
vi.mock('../../src/lib/supabase.js', () => ({
  get supabaseReady() {
    return state.ready
  },
  get supabase() {
    return state.client
  },
}))

import { loadRemoteCatalog } from '../../src/data/remoteCatalog.js'
import { BASE, META, CATS } from '../../src/data/catalog.js'

// Keep a copy of the local catalogue so each test starts from the same data.
const LOCAL_BASE = structuredClone(BASE)
const LOCAL_META = structuredClone(META)

// A query builder that resolves to `result`, the same chain the loader uses.
function query(result) {
  const q = {
    select: () => q,
    order: () => q,
    abortSignal: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return q
}

// Rows shaped like the Supabase tables: one category row per group, one parts row per option.
function validRows() {
  const categories = CATS.map((key, i) => ({ key, label: `${key} label`, short: key, sort_order: i }))
  const parts = CATS.flatMap((k) => LOCAL_BASE[k].map((o, i) => ({ category_key: k, id: o.id, sort_order: i, data: o })))
  return { categories, parts }
}

function fakeClient({ categories, parts }) {
  return {
    from: (table) => query(table === 'categories' ? categories : parts),
  }
}

beforeEach(() => {
  state.ready = true
  state.client = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  // Put the local catalogue back exactly as it was.
  for (const k of CATS) {
    BASE[k] = structuredClone(LOCAL_BASE[k])
    META[k] = structuredClone(LOCAL_META[k])
  }
})

describe('loadRemoteCatalog', () => {
  it('uses the local copy when Supabase is not configured', async () => {
    state.ready = false
    expect(await loadRemoteCatalog()).toBe(false)
    expect(BASE).toEqual(LOCAL_BASE)
  })

  it('uses the local copy when there is no client', async () => {
    state.client = null
    expect(await loadRemoteCatalog()).toBe(false)
    expect(BASE).toEqual(LOCAL_BASE)
  })

  it('replaces the local copy with the Supabase rows on success', async () => {
    const rows = validRows()
    rows.parts = rows.parts.map((r) => (r.category_key === 'case' && r.id === 'abs' ? { ...r, data: { ...r.data, name: 'ABS, from Supabase' } } : r))
    state.client = fakeClient(rows)

    expect(await loadRemoteCatalog()).toBe(true)
    expect(BASE.case.find((o) => o.id === 'abs').name).toBe('ABS, from Supabase')
    expect(META.case.label).toBe('case label')
    expect(BASE.case.map((o) => o.id)).toEqual(LOCAL_BASE.case.map((o) => o.id))
  })

  it('keeps the local copy when one category is missing (partial response)', async () => {
    const rows = validRows()
    rows.parts = rows.parts.filter((r) => r.category_key !== 'keycaps')
    state.client = fakeClient(rows)

    expect(await loadRemoteCatalog()).toBe(false)
    expect(BASE).toEqual(LOCAL_BASE)
    expect(META).toEqual(LOCAL_META)
  })

  it('keeps the local copy when the categories request fails', async () => {
    const rows = validRows()
    state.client = {
      from: (table) => query(table === 'categories' ? { data: null, error: new Error('permission denied') } : { data: rows.parts, error: null }),
    }

    expect(await loadRemoteCatalog()).toBe(false)
    expect(BASE).toEqual(LOCAL_BASE)
    expect(console.warn).toHaveBeenCalled()
  })

  it('keeps the local copy when a row is malformed, without partly applying the others', async () => {
    const rows = validRows()
    // The part's id does not match its row, so the row is invalid.
    rows.parts = rows.parts.map((r, i) => (i === 0 ? { ...r, id: 'wrong-id' } : r))
    state.client = fakeClient(rows)

    expect(await loadRemoteCatalog()).toBe(false)
    expect(BASE).toEqual(LOCAL_BASE)
    expect(META).toEqual(LOCAL_META)
  })
})
