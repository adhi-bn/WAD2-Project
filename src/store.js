// Shared app state (a tiny store with Vue's reactive()).
import { reactive } from 'vue'
import { catalog, CATS } from './data/catalog.js'
import { PRIZES } from './data/fatcat.js'
import { recommend, autoFix, total, money } from './logic/builder.js'
import { supabase, supabaseReady } from './lib/supabase.js'

const saved = (() => { try { return JSON.parse(localStorage.getItem('lct_ld') || '{}') } catch (e) { return {} } })()
const savedCart = (() => { try { return JSON.parse(localStorage.getItem('lct_cart') || '[]') } catch (e) { return [] } })()

export const state = reactive({
  answers: { layout: null, weight: null, frame: null, keycap: null, switch: null, budget: 350 },
  cat: null, // priced catalogue for the chosen layout
  rec: null, // the recommended build
  build: null, // the build the customer is editing
  biscuit: false, // true when the current build came from Biscuit's suggestion
  cart: savedCart, // [{ uid, name, layout, part_ids }], prices are worked out when shown
  reached: { home: true, know: true, swipe: true },
  toast: '',
  now: Date.now(),
  ui: { wheel: false },
  ld: Object.assign({ used: false, prize: null, code: null, expires: 0, applied: false }, saved), // lucky draw
  user: null, // signed-in Supabase user, or null
  savedBuilds: [], // the signed-in user's saved builds
})

export const layout = () => state.answers.layout || '75'

let toastTimer
export function toast(msg) {
  state.toast = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = '' }, 3400)
}

export function finishQuiz() {
  const A = { ...state.answers, layout: layout() }
  state.cat = catalog(A.layout)
  state.rec = recommend(A, state.cat)
  state.build = { ...state.rec }
  state.biscuit = false
  state.reached.build = false
  state.reached.buy = false
}

export function choose(cat, id) {
  const b = { ...state.build }
  const before = total(b)
  b[cat] = state.cat[cat].find((o) => o.id === id)
  const notes = autoFix(b, state.cat, cat)
  state.build = b
  const d = total(b) - before
  toast(notes.length ? notes.join(' ') : d === 0 ? 'No change to your total.' : `Total ${d > 0 ? 'up' : 'down'} ${money(Math.abs(d))}. Now ${money(total(b))}.`)
}

/* ---------- builds as plain ids (for the cart and for saving) ---------- */

// Turn a list of part ids back into a priced build for one layout.
export function buildFromIds(L, ids) {
  const options = catalog(L)
  const b = {}
  for (const c of CATS) b[c] = options[c].find((o) => o.id === ids[c])
  return b
}
export function idsOf(b) {
  return Object.fromEntries(CATS.map((c) => [c, b[c].id]))
}
// Price of a saved cart item at today's prices.
export function itemTotal(item) {
  return total(buildFromIds(item.layout, item.part_ids))
}
export function cartTotal() {
  return state.cart.reduce((s, it) => s + itemTotal(it), 0)
}

/* ---------- cart ---------- */
function saveCart() { try { localStorage.setItem('lct_cart', JSON.stringify(state.cart)) } catch (e) { /* private mode */ } }

export function addToCart(name) {
  state.cart.push({ uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, layout: layout(), part_ids: idsOf(state.build) })
  saveCart()
  toast('Added to your cart.')
}
export function removeFromCart(uid) {
  state.cart = state.cart.filter((it) => it.uid !== uid)
  saveCart()
}
export function clearCart() {
  state.cart = []
  saveCart()
}
// Open a cart item or saved build in the builder so it can be edited.
export function loadBuild(item, { fromBiscuit = false } = {}) {
  state.answers.layout = item.layout
  state.cat = catalog(item.layout)
  state.build = buildFromIds(item.layout, item.part_ids)
  // The parts page compares each part with the recommended build, so a loaded build needs one too.
  state.rec = { ...state.build }
  state.biscuit = fromBiscuit
  state.reached.build = false
}

/* ---------- accounts and saved builds (Supabase) ---------- */
export async function refreshSaved() {
  if (!supabase || !state.user) { state.savedBuilds = []; return }
  const { data, error } = await supabase.from('saved_builds').select('id, name, layout, part_ids, created_at').order('created_at', { ascending: false })
  if (error) { toast('Could not load your saved builds.'); return }
  state.savedBuilds = data
}
export async function saveBuild(name) {
  if (!supabase || !state.user) return { error: 'Sign in to save your build.' }
  const { error } = await supabase.from('saved_builds').insert({ user_id: state.user.id, name, layout: layout(), part_ids: idsOf(state.build) })
  if (error) return { error: 'Your build could not be saved. Please try again.' }
  await refreshSaved()
  return {}
}
export async function deleteSaved(id) {
  await supabase.from('saved_builds').delete().eq('id', id)
  await refreshSaved()
}
export async function signIn(email, password) {
  if (!supabase) return { error: 'Accounts are not set up yet.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { error: error.message } : {}
}
export async function signUp(email, password) {
  if (!supabase) return { error: 'Accounts are not set up yet.' }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }
  // With email confirmation on, there is no session until the link is clicked.
  return data.session ? {} : { info: 'Check your email and click the link to finish signing up.' }
}
export async function signOut() {
  if (supabase) await supabase.auth.signOut()
  state.savedBuilds = []
}
if (supabaseReady) {
  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null
    refreshSaved()
  })
}

/* ---------- lucky draw voucher ---------- */
export function saveLD() { try { localStorage.setItem('lct_ld', JSON.stringify(state.ld)) } catch (e) { /* private mode */ } }
export function activeVoucher() { return state.ld.code && state.now < state.ld.expires ? PRIZES[state.ld.prize] : null }
export function discountOf(t) {
  const v = activeVoucher()
  if (!v || !state.ld.applied) return 0
  return v.type === 'pct' ? Math.round(t * v.val) / 100 : Math.min(v.val, t)
}
export function timeLeft() {
  const s = Math.max(0, Math.round((state.ld.expires - state.now) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export function resetLD() { Object.assign(state.ld, { used: false, prize: null, code: null, expires: 0, applied: false }); saveLD() }
export function openWheel() { state.ui.wheel = true }

setInterval(() => {
  state.now = Date.now()
  if (state.ld.code && state.now > state.ld.expires) {
    const wasApplied = state.ld.applied
    state.ld.code = null
    state.ld.applied = false
    saveLD()
    if (wasApplied) toast('Your voucher expired.')
  }
}, 1000)
