// Loads parts and prebuilt keyboards into Supabase. Run from the project folder:
//   SUPABASE_URL=https://YOUR-PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node supabase/import-run.js
// The service role key bypasses row level security. Use it only on your own machine, never in the website.

import { createClient } from '@supabase/supabase-js'
import { importAll } from './data.js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}

const result = await importAll(createClient(url, key, { auth: { persistSession: false } }))
console.log(`Imported ${result.parts} parts and ${result.prebuilts} prebuilt keyboards.`)
