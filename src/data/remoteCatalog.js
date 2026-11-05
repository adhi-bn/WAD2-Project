// Loads the parts catalogue from Supabase and replaces the local copy in catalog.js.
// If Supabase is not configured, a request fails or times out, or the data is incomplete,
// the local copy stays in use. The new data is checked in full before anything is replaced.
import { supabase, supabaseReady } from '../lib/supabase.js'
import { BASE, META, CATS } from './catalog.js'

// The app waits for this long at startup at most, then uses the local copy.
const TIMEOUT_MS = 2000

// The price field for each category. Every other category is priced with `p`.
const PRICE_FIELD = { switches: 'ps', stabs: 'pp' }

// Prices and weights must be finite, non-negative numbers.
const isAmount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0

/**
 * Turn one parts row into the part object the app uses. The row's id must match the part's id,
 * and its price (and weight, when present) must be a finite, non-negative number.
 * @param {{category_key: string, id: string, data: object}} row
 * @returns {object} the part object from the row's data
 * @throws {Error} when the row does not hold a valid part
 */
function rowToPart(row) {
  const part = row.data
  if (!part || typeof part !== 'object' || part.id !== row.id || typeof part.name !== 'string') {
    throw new Error(`Bad part row: ${row.category_key}/${row.id}`)
  }
  const field = PRICE_FIELD[row.category_key] ?? 'p'
  if (!isAmount(part[field]) || (part.g !== undefined && !isAmount(part.g))) {
    throw new Error(`Bad part price: ${row.category_key}/${row.id}`)
  }
  return part
}

/**
 * Load the catalogue from Supabase. The local copy is replaced only when every category is valid.
 * @returns {Promise<boolean>} true when the Supabase copy is in use, false when the local copy is kept.
 */
export async function loadRemoteCatalog() {
  if (!supabaseReady || !supabase) return false
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    const [cats, parts] = await Promise.all([
      supabase.from('categories').select('key,label,short,sort_order').order('sort_order').abortSignal(signal),
      supabase.from('parts').select('category_key,id,sort_order,data').order('sort_order').abortSignal(signal),
    ])
    if (cats.error) throw cats.error
    if (parts.error) throw parts.error

    // Build complete candidate copies first, so a partial response never mixes with the local copy.
    const nextMeta = {}
    for (const c of cats.data ?? []) nextMeta[c.key] = { label: c.label, short: c.short }
    const nextBase = {}
    for (const k of CATS) {
      const rows = (parts.data ?? []).filter((r) => r.category_key === k)
      if (!rows.length || !nextMeta[k]) throw new Error(`Supabase catalogue is missing ${k}`)
      nextBase[k] = rows.map(rowToPart)
    }

    // Every category is valid, so commit them together.
    for (const k of CATS) {
      META[k] = nextMeta[k]
      BASE[k] = nextBase[k]
    }
    return true
  } catch (err) {
    console.warn('Using the local parts catalogue:', err.message)
    return false
  }
}
