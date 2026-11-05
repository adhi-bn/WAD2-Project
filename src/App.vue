<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { initSmoothScroll, destroySmoothScroll, getLenis } from './lib/smoothScroll.js'
import { state, openWheel } from './store.js'
import { CAT_SVG } from './data/fatcat.js'
import FatCat from './components/FatCat.vue'

const stages = [
  { name: 'swipe', to: '/swipe', n: 1, label: 'Swipe' },
  { name: 'parts', to: '/parts', n: 2, label: 'Parts' },
  { name: 'build', to: '/build', n: 3, label: 'Build' },
  { name: 'buy', to: '/cart', n: 4, label: 'Cart' },
]
const enabled = (s) => s.name === 'swipe' || s.name === 'parts' || (state.build && state.reached[s.name])

// Single nav data list rendered twice (desktop header row + mobile drawer); the
// account label stays reactive because the list is computed from sign-in state.
const navLinks = computed(() => [
  { to: '/', label: 'Home', aria: 'Home' },
  { to: '/know', label: 'Know your keyboard' },
  { to: '/compare', label: 'Compare', aria: 'Compare builds' },
  { to: '/about', label: 'About us', aria: 'About us' },
  { to: '/account', label: state.user ? 'Profile' : 'Sign in', aria: state.user ? 'Profile' : 'Sign in' },
])

// Event countdown: ends at 23:59, three days from today.
const evEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(23, 59, 0, 0); return d.getTime() })()
const countdown = computed(() => {
  const s = Math.max(0, Math.floor((evEnd - state.now) / 1000))
  const p = (n) => String(n).padStart(2, '0')
  return `Ends in ${Math.floor(s / 86400)}d ${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
})

/* ---------- mobile navigation drawer ---------- */
const route = useRoute()
const drawerOpen = ref(false)
const drawerEl = ref(null)
const navOpenerEl = ref(null)
let drawerMql = null

const FOCUSABLE = 'a[href], button:not([disabled])'
const isMobileNav = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 900px)').matches
    : true

/**
 * Opens the mobile navigation drawer, locks background scrolling, and moves focus
 * to the first drawer link. Focus is trapped inside the drawer while it is open.
 *
 * @returns {void}
 */
function openDrawer() {
  drawerOpen.value = true
  nextTick(() => {
    drawerEl.value?.querySelector('.navlink')?.focus()
  })
}

/**
 * Closes the mobile navigation drawer and releases the background scroll lock.
 *
 * @param {{ restoreFocus?: boolean }} [options={}] - Pass `restoreFocus: false` when
 *   closing after navigation or a breakpoint change, where returning focus to the
 *   (possibly hidden) hamburger trigger would be wrong.
 * @returns {void}
 */
function closeDrawer({ restoreFocus = true } = {}) {
  if (!drawerOpen.value) return
  drawerOpen.value = false
  if (!restoreFocus) return

  // Restore on the next animation frame: the link click's default focus handling
  // and Vue's inert/display updates settle after the synchronous nextTick.
  nextTick(() => {
    const restore = () => {
      if (drawerOpen.value || !isMobileNav()) return
      navOpenerEl.value?.focus()
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore)
    else restore()
  })
}

/**
 * Closes the drawer on link activation and returns focus to the trigger.
 * Covers same-route links, where the route watcher does not fire.
 *
 * @returns {void}
 */
function onDrawerNavClick() {
  closeDrawer()
}

/**
 * Global keydown handler active only while the drawer is open: Escape closes it,
 * Tab is cycled within it so the inert background is never a keyboard trap.
 *
 * @param {KeyboardEvent} e - Keydown event.
 * @returns {void}
 */
function onDrawerGlobalKeydown(e) {
  if (!drawerOpen.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeDrawer()
    return
  }
  if (e.key !== 'Tab') return
  const items = [...(drawerEl.value?.querySelectorAll(FOCUSABLE) || [])]
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (e.shiftKey && (active === first || !drawerEl.value.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * Applies or releases the background scroll lock (Lenis plus a body class) and the
 * global focus-trap listener while the drawer is open.
 *
 * @param {boolean} locked - Whether the drawer is open.
 * @returns {void}
 */
function setDrawerLock(locked) {
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('drawer-lock', locked)
    if (locked) document.addEventListener('keydown', onDrawerGlobalKeydown)
    else document.removeEventListener('keydown', onDrawerGlobalKeydown)
  }
  const lenis = getLenis()
  if (locked) lenis?.stop?.()
  else lenis?.start?.()
}

watch(drawerOpen, (open) => setDrawerLock(open))

/**
 * Handles the <=900px drawer breakpoint: above it the drawer must close and reset,
 * and the measured bar clearance var is re-scoped either way.
 *
 * @returns {void}
 */
function onDrawerBreakpoint() {
  if (!isMobileNav()) closeDrawer({ restoreFocus: false })
  syncBarHeight()
}

/* ---------- sticky bar height for page/toast/mascot clearance ---------- */
let barObserver = null

/**
 * Writes the sticky bar's rendered height to the body CSS var --lct-bar-h so mobile
 * page bottom padding, the toast, and the mascot/paw tab clear the bar (incl. safe
 * areas). The var is set only at <=900px on routes that render the bar (/parts and
 * /build); on barless routes and above 900px it is removed so the original fixed
 * offsets (toast 96px, paw tab 140px, body padding 104px) apply.
 * ponytail: ResizeObserver covers font-load and orientation changes without a loop.
 *
 * @returns {void}
 */
function syncBarHeight() {
  if (typeof document === 'undefined') return
  const bar = document.querySelector('.bar')
  if (bar && isMobileNav()) {
    document.body.style.setProperty('--lct-bar-h', `${Math.ceil(bar.offsetHeight)}px`)
  } else {
    document.body.style.removeProperty('--lct-bar-h')
  }
}

/**
 * (Re)binds the ResizeObserver around the rendered `.bar`, if any, then re-syncs the
 * measured height. Safe to call on every route change.
 *
 * @returns {void}
 */
function observeBar() {
  barObserver?.disconnect()
  barObserver = null
  const bar = typeof document !== 'undefined' ? document.querySelector('.bar') : null
  if (bar && typeof window !== 'undefined' && 'ResizeObserver' in window) {
    barObserver = new ResizeObserver(() => syncBarHeight())
    barObserver.observe(bar)
  }
  syncBarHeight()
}

// Merged route watcher: close the drawer before navigating (covers cross-route
// links), then re-measure the bar after the DOM updates.
watch(() => route.fullPath, async () => {
  closeDrawer()
  await nextTick()
  observeBar()
})

onMounted(() => {
  initSmoothScroll()
  observeBar()
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    drawerMql = window.matchMedia('(max-width: 900px)')
    if (drawerMql.addEventListener) drawerMql.addEventListener('change', onDrawerBreakpoint)
    else if (drawerMql.addListener) drawerMql.addListener(onDrawerBreakpoint)
  }
})

onUnmounted(() => {
  destroySmoothScroll()
  barObserver?.disconnect()
  barObserver = null
  if (drawerMql) {
    if (drawerMql.removeEventListener) drawerMql.removeEventListener('change', onDrawerBreakpoint)
    else if (drawerMql.removeListener) drawerMql.removeListener(onDrawerBreakpoint)
    drawerMql = null
  }
  setDrawerLock(false)
  if (typeof document !== 'undefined') {
    document.body.style.removeProperty('--lct-bar-h')
  }
})
</script>

<template>
  <div class="event" :inert="drawerOpen ? '' : null">
    <div class="wrap">
      <span class="evtag">Event</span>
      <span><b>Fat Cat Lucky Draw</b> · spin once, win up to 15% off your build</span>
      <span class="evcd">{{ countdown }}</span>
      <button type="button" @click="openWheel">Spin now</button>
    </div>
  </div>

  <header class="top" :inert="drawerOpen ? '' : null">
    <div class="wrap">
      <router-link to="/" class="brand" aria-label="Le Chaton Typers home">
        <span class="brandcat" v-html="CAT_SVG"></span><span class="brandtxt">Le Chaton Typers</span>
      </router-link>
      <div class="topnav">
        <nav class="topnav-links" aria-label="Main navigation">
          <router-link
            v-for="l in navLinks"
            :key="l.to"
            :to="l.to"
            class="navlink"
            active-class="on"
            :aria-current="route.path === l.to ? 'page' : undefined"
            :aria-label="l.aria || undefined"
          >{{ l.label }}</router-link>
        </nav>
        <button
          ref="navOpenerEl"
          type="button"
          class="navtoggle"
          aria-controls="lct-mobile-nav"
          :aria-expanded="drawerOpen"
          aria-label="Open navigation menu"
          @click="openDrawer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 8h16M4 16h16" />
          </svg>
        </button>
      </div>
    </div>
    <div class="progress-row">
      <div class="wrap">
        <nav class="stages" aria-label="Progress">
          <template v-for="s in stages" :key="s.name">
            <router-link v-if="enabled(s)" :to="s.to" class="stg" active-class="on">
              <span class="n">{{ s.n }}</span><span class="lbl">{{ s.label }}</span>
            </router-link>
            <span v-else class="stg dis" aria-disabled="true"><span class="n">{{ s.n }}</span><span class="lbl">{{ s.label }}</span><span class="visually-hidden">· locked</span></span>
          </template>
        </nav>
      </div>
    </div>
  </header>

  <!-- Mobile drawer rendered at the app root: the header's backdrop-filter would
       otherwise trap the drawer's position:fixed within the header box. -->
  <div
    id="lct-mobile-nav"
    ref="drawerEl"
    class="lct-drawer"
    :class="{ open: drawerOpen }"
    role="dialog"
    aria-modal="true"
    aria-label="Navigation menu"
  >
    <button type="button" class="drawer-close" aria-label="Close navigation menu" @click="closeDrawer">×</button>
    <nav class="drawer-links" aria-label="Main navigation">
      <router-link
        v-for="l in navLinks"
        :key="l.to"
        :to="l.to"
        class="navlink"
        active-class="on"
        :aria-current="route.path === l.to ? 'page' : undefined"
        :aria-label="l.aria || undefined"
        @click="onDrawerNavClick"
      >{{ l.label }}</router-link>
    </nav>
  </div>

  <main :inert="drawerOpen ? '' : null">
    <router-view />
  </main>

  <footer :inert="drawerOpen ? '' : null">
    <div class="wrap site-footer">
      <span>Le Chaton Typers · test build · sample prices in Singapore dollars</span>
      <nav aria-label="Legal information">
        <router-link to="/privacy">Privacy</router-link>
        <router-link to="/terms">Terms</router-link>
      </nav>
    </div>
  </footer>

  <div :inert="drawerOpen ? '' : null"><FatCat /></div>
  <div class="lct-toast" :class="{ 'is-show': state.toast }" role="status" aria-live="polite">{{ state.toast }}</div>
</template>
