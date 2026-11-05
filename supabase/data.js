// Supabase seed data: every part option and the prebuilt keyboards people can pick from.
//
// Parts come from src/data/catalog.js (BASE), so the prices here match the app.
// Prebuilts are listed as part ids per category. Their totals are worked out with catalog()
// for each layout, so re-run the import after you change a price.
//
// Usage (after running supabase/schema.sql once):
//   import { createClient } from '@supabase/supabase-js'
//   import { importAll } from './supabase/data.js'
//   const supabase = createClient(URL, SERVICE_ROLE_KEY)   // server/script only, never in the browser
//   await importAll(supabase)

import { BASE, catalog, KEYS, META } from '../src/data/catalog.js'

const PART_CATS = ['case', 'plate', 'pcb', 'switches', 'keycaps', 'stabs', 'foam', 'cable']

/* ---------- 1. Parts table: one row per option ---------- */
// Each parts row holds the full part object in `data`, the same shape the app uses:
// p = flat price (60% layout), ps = per-switch price, pp = per-stabiliser price, g = grams,
// plus everything else about the part (feel, switch type, etc.). Prices are read from p, or ps/pp where a category uses them.
// One row per category, for the labels the app shows.
export const categories = PART_CATS.map((key, sort_order) => ({
  key,
  label: META[key].label,
  short: META[key].short,
  sort_order,
}))

// One row per option. data holds the full part object, the same shape the app loads.
export const parts = PART_CATS.flatMap((category) =>
  BASE[category].map((o, i) => ({ category_key: category, id: o.id, sort_order: i, data: o }))
)

/* ---------- 2. Prebuilt keyboards ---------- */
// Each entry picks one part id per category. Ids must exist in BASE.
// Stabilisers, switches, keycaps and so on are all in the parts table, so they can be swapped later.
export const prebuiltDefs = [
  {
    id: 'starter-60',
    name: 'Starter 60%',
    tagline: 'Compact, light and friendly for your first custom build.',
    layout: '60',
    sort_order: 1,
    parts: { case: 'abs', plate: 'pcp', pcb: 'hs', switches: 'gbrown', keycaps: 'blank', stabs: 'stock', foam: 'none', cable: 'std' },
  },
  {
    id: 'quiet-office-75',
    name: 'Quiet Office 75%',
    tagline: 'Arrows and F-row, dampened for shared spaces.',
    layout: '75',
    sort_order: 2,
    parts: { case: 'pc', plate: 'fr4p', pcb: 'hsrgb', switches: 'gsilent', keycaps: 'plainpbt', stabs: 'durock', foam: 'basic', cable: 'std' },
  },
  {
    id: 'premium-tactile-75',
    name: 'Premium Tactile 75%',
    tagline: 'Solid CNC aluminium with tactile switches you can feel.',
    layout: '75',
    sort_order: 3,
    parts: { case: 'alu', plate: 'alp', pcb: 'tri', switches: 'panda', keycaps: 'matte', stabs: 'tx', foam: 'full', cable: 'coil' },
  },
  {
    id: 'gaming-linear-75',
    name: 'Gaming Linear 75%',
    tagline: 'Smooth linear presses on an open PCB frame.',
    layout: '75',
    sort_order: 4,
    parts: { case: 'fr4', plate: 'alp', pcb: 'hs', switches: 'oilking', keycaps: 'dshot', stabs: 'durock', foam: 'basic', cable: 'coil' },
  },
  {
    id: 'desk-full-100',
    name: 'Full-size Desk 100%',
    tagline: 'Full layout with numpad for spreadsheets and numbers.',
    layout: '100',
    sort_order: 5,
    parts: { case: 'sandwich', plate: 'fr4p', pcb: 'hs', switches: 'gsilent', keycaps: 'plainpbt', stabs: 'durock', foam: 'basic', cable: 'std' },
  },
]

// Built in Node by pricing each prebuilt with the same catalog() the app uses.
export const prebuilts = prebuiltDefs.map((b) => {
  const options = catalog(b.layout)
  let price = 0
  let grams = 0
  for (const cat of PART_CATS) {
    const choice = options[cat].find((o) => o.id === b.parts[cat])
    if (!choice) throw new Error(`Prebuilt "${b.id}": unknown ${cat} id "${b.parts[cat]}"`)
    price += choice.price
    grams += choice.grams
  }
  return {
    id: b.id,
    name: b.name,
    tagline: b.tagline,
    layout: b.layout,
    keys: KEYS[b.layout],
    part_ids: b.parts,
    total_price_sgd: price,
    total_grams: grams,
    published: true,
    sort_order: b.sort_order,
  }
})

/* ---------- 3. Import helper ---------- */
// Pass a Supabase client. Upserts parts first (prebuilts refer to them), then prebuilts.
export async function importAll(supabase) {
  const c = await supabase.from('categories').upsert(categories, { onConflict: 'key' })
  if (c.error) throw c.error
  const p = await supabase.from('parts').upsert(parts, { onConflict: 'category_key,id' })
  if (p.error) throw p.error
  const b = await supabase.from('prebuilts').upsert(prebuilts, { onConflict: 'id' })
  if (b.error) throw b.error
  return { parts: parts.length, prebuilts: prebuilts.length }
}
