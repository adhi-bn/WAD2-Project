// Supabase client for the browser. The anon key is safe to ship: row level security limits what it can read.
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file (see .env.example).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && key)
export const supabase = supabaseReady ? createClient(url, key) : null
export const functionsUrl = url ? `${url}/functions/v1` : ''
export const anonKey = key || ''

// Seams used by the WAD2 tests. createSupabaseClient builds a client only when both
// values are present; getSupabase is the lazily cached, null-safe client for those values.
export function createSupabaseClient(url, key) {
  if (!url || !key) return null
  return createClient(url, key)
}

// ponytail: one lazily-cached client; add auth/realtime wiring when a feature needs it.
let cached
export function getSupabase() {
  if (cached !== undefined) return cached
  cached = createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
  return cached
}
