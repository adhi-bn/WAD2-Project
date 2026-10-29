// Shared app state (a tiny store with Vue's reactive()).
import { reactive } from 'vue'
import { catalog, CATS } from './data/catalog.js'
import { PRIZES } from './data/fatcat.js'
import { recommend, autoFix, total, money } from './logic/builder.js'
import { supabase, supabaseReady } from './lib/supabase.js'

const saved = (() => { try { return JSON.parse(localStorage.getItem('lct_ld') || '{}') } catch (e) { return {} } })()
const savedCart = (() => { try { return JSON.parse(localStorage.getItem('lct_cart') || '[]') } catch (e) { return [] } })()
const savedGuestDraft = (() => { try { return JSON.parse(localStorage.getItem('lct_guest_draft') || 'null') } catch (e) { return null } })()

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
  ui: { wheel: false, accountTransition: false },
  ld: Object.assign({ used: false, prize: null, code: null, expires: 0, applied: false }, saved), // lucky draw
  user: null, // signed-in Supabase user, or null
  savedBuilds: [], // the signed-in user's saved builds
  guestDraft: savedGuestDraft, // an explicitly preserved local Build, never uploaded automatically
})

let sessionRevision = 0
let isSigningOut = false

/**
 * Removes account-owned UI state before a session can be replaced.
 *
 * @returns {void}
 */
function clearAccountState() {
  state.savedBuilds = []
  Object.assign(state.ld, { used: false, prize: null, code: null, expires: 0, applied: false })
  saveLD()
}

/**
 * Clears the in-progress Build without assigning it to another account.
 *
 * @returns {void}
 */
function discardCurrentBuild() {
  state.build = null
  state.cat = null
  state.rec = null
  state.biscuit = false
}

export const layout = () => state.answers.layout || '75'

/**
 * Switches the active keyboard layout form-factor ('60', '75', or '100')
 * and resynchronizes all existing build items against the new layout's catalog
 * while preserving the customer's selected part IDs.
 *
 * @param {'60'|'75'|'100'|string} layoutCode - Target keyboard layout form-factor.
 * @returns {void}
 */
export function setLayout(layoutCode) {
  const code = String(layoutCode || '75').replace('%', '').trim()
  const validLayout = code === '60' || code === '100' ? code : '75'
  state.answers.layout = validLayout
  state.cat = catalog(validLayout)

  if (state.build) {
    const nextBuild = {}
    for (const c of CATS) {
      const currentPart = state.build[c]
      if (currentPart?.id) {
        const matching = state.cat[c]?.find((o) => o.id === currentPart.id)
        nextBuild[c] = matching || currentPart
      } else if (state.cat[c]?.length > 0) {
        nextBuild[c] = state.cat[c][0]
      }
    }
    state.build = nextBuild
  }

  if (state.rec) {
    const nextRec = {}
    for (const c of CATS) {
      const recPart = state.rec[c]
      if (recPart?.id) {
        const matching = state.cat[c]?.find((o) => o.id === recPart.id)
        nextRec[c] = matching || recPart
      } else if (state.cat[c]?.length > 0) {
        nextRec[c] = state.cat[c][0]
      }
    }
    state.rec = nextRec
  }
}

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

/**
 * Preserves the current Build as a local guest draft after the user explicitly chooses it.
 *
 * @returns {boolean} Whether a draft was available to preserve.
 */
export function preserveGuestDraft() {
  if (!state.build) return false
  state.guestDraft = { layout: layout(), part_ids: idsOf(state.build), budget: state.answers.budget }
  try { localStorage.setItem('lct_guest_draft', JSON.stringify(state.guestDraft)) } catch (e) { /* private mode */ }
  return true
}

/**
 * Restores a previously preserved guest Build without assigning it to the signed-in account.
 *
 * @returns {boolean} Whether a local guest draft was restored.
 */
export function restoreGuestDraft() {
  if (!state.guestDraft) {
    try { state.guestDraft = JSON.parse(localStorage.getItem('lct_guest_draft') || 'null') } catch (e) { state.guestDraft = null }
  }
  if (!state.guestDraft?.layout || !state.guestDraft?.part_ids) return false
  loadBuild(state.guestDraft)
  state.answers.budget = state.guestDraft.budget ?? state.answers.budget
  // Restoring is an explicit choice. Do not leave this device-only draft available to another account.
  try { localStorage.removeItem('lct_guest_draft') } catch (e) { /* private mode */ }
  state.guestDraft = null
  return true
}

/**
 * Resolves a Build left over from an externally changed account session.
 *
 * @param {{ preserveDraft: boolean }} options - Whether the user explicitly wants a local guest copy.
 * @returns {void}
 */
export function resolveAccountTransition({ preserveDraft }) {
  if (preserveDraft) preserveGuestDraft()
  discardCurrentBuild()
  state.ui.accountTransition = false
}

/* ---------- accounts and saved builds (Supabase) ---------- */
/**
 * Fetches the active account's saved Builds and ignores responses from an older session.
 *
 * @returns {Promise<void>}
 */
export async function refreshSaved() {
  if (!supabase || !state.user) { state.savedBuilds = []; return }
  const revision = sessionRevision
  const userId = state.user.id
  const { data, error } = await supabase.from('saved_builds').select('id, name, layout, part_ids, created_at').order('created_at', { ascending: false })
  // An account change while the request was pending must not populate the next profile.
  if (revision !== sessionRevision || state.user?.id !== userId) return
  if (error) { toast('Could not load your saved builds.'); return }
  state.savedBuilds = data
}
/**
 * Starts the Google OAuth redirect through the configured Supabase client.
 *
 * @returns {Promise<{error?: string}>} A truthful error when cloud authentication is unavailable or fails to start.
 */
export async function signInWithGoogle() {
  if (!supabase) return { error: 'Google sign-in is not configured yet.' }
  const redirectTo = `${window.location.origin}/account`
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  return error ? { error: error.message } : {}
}
/**
 * Saves the current Build for the active account and rejects a late response from an older session.
 *
 * @param {string} name - The user-facing name for the saved Build.
 * @returns {Promise<{error?: string}>} An error when saving is unavailable or unsuccessful.
 */
export async function saveBuild(name) {
  if (!state.build) return { error: 'No build in progress.' }
  if (!supabase || !state.user) return { error: 'Sign in to save your build.' }
  if (state.ui.accountTransition) return { error: 'Choose what to do with the previous account Build before saving.' }
  const revision = sessionRevision
  const userId = state.user.id
  const { error } = await supabase.from('saved_builds').insert({ user_id: state.user.id, name, layout: layout(), part_ids: idsOf(state.build) })
  if (revision !== sessionRevision || state.user?.id !== userId) return { error: 'Your account changed before the Build could be saved.' }
  if (error) return { error: 'Your build could not be saved. Please try again.' }
  await refreshSaved()
  return {}
}
/**
 * Deletes one saved Build for the active account without applying a stale follow-up refresh.
 *
 * @param {string} id - The saved Build identifier.
 * @returns {Promise<void>}
 */
export async function deleteSaved(id) {
  if (!supabase || !state.user) return
  const revision = sessionRevision
  const userId = state.user.id
  await supabase.from('saved_builds').delete().eq('id', id).eq('user_id', userId)
  if (revision !== sessionRevision || state.user?.id !== userId) return
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
/**
 * Signs out after the caller has explicitly chosen whether to preserve the current Build locally.
 *
 * @param {{ preserveDraft?: boolean }} options - Whether to preserve the in-progress Build as a guest draft.
 * @returns {Promise<{error?: string}>} A truthful error if Supabase rejects the sign-out.
 */
export async function signOut({ preserveDraft = false } = {}) {
  if (supabase) {
    isSigningOut = true
    try {
      const { error } = await supabase.auth.signOut()
      // Keep the current Build intact when Supabase cannot complete the sign-out.
      if (error) return { error: error.message }
    } catch (error) {
      return { error: error?.message || 'Unable to contact the sign-out service.' }
    } finally {
      isSigningOut = false
    }
  }
  if (preserveDraft) preserveGuestDraft()
  discardCurrentBuild()
  sessionRevision += 1
  clearAccountState()
  state.user = null
  return {}
}
if (supabaseReady) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const previousUserId = state.user?.id
    const nextUserId = session?.user?.id
    const isAccountSwitch = Boolean(previousUserId && nextUserId && previousUserId !== nextUserId)
    const isSignOut = Boolean(previousUserId && !nextUserId)
    sessionRevision += 1
    // Keep device-only lucky-draw state through an initial session restore and token refresh.
    if (isAccountSwitch || isSignOut) clearAccountState()
    state.user = session?.user ?? null
    // A Build cannot silently move from one account to another after an external session change.
    if (!isSigningOut && previousUserId && previousUserId !== nextUserId && state.build) state.ui.accountTransition = true
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
