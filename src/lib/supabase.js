// Supabase client for the browser. The anon key is safe to ship: row level security limits what it can read.
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file (see .env.example).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && key)
export const supabase = supabaseReady ? createClient(url, key) : null
export const functionsUrl = url ? `${url}/functions/v1` : ''
export const anonKey = key || ''
