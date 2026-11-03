// Loads the parts catalogue from Supabase and replaces the local copy in catalog.js.
// If Supabase is not configured, the request fails, or it is slow, the local copy stays in use.
import { supabase, supabaseReady } from '../lib/supabase.js'
import { BASE, META, CATS } from './catalog.js'

const TIMEOUT_MS = 4000

function withTimeout(promise) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Catalogue request timed out')), TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function loadRemoteCatalog() {
  if (!supabaseReady || !supabase) return false
  try {
    const [cats, parts] = await withTimeout(Promise.all([
      supabase.from('categories').select('key,label,short,sort_order').order('sort_order'),
      supabase.from('parts').select('category_key,id,sort_order,data').order('sort_order'),
    ]))
    if (cats.error || parts.error) throw cats.error || parts.error
    if (!cats.data?.length || !parts.data?.length) return false

    for (const c of cats.data) {
      if (META[c.key]) META[c.key] = { label: c.label, short: c.short }
    }
    // Rows come back sorted by sort_order, so filtering keeps the same option order as before.
    for (const k of CATS) {
      const rows = parts.data.filter((r) => r.category_key === k)
      if (rows.length) BASE[k] = rows.map((r) => r.data)
    }
    return true
  } catch (err) {
    console.warn('Using the local parts catalogue:', err.message)
    return false
  }
}
