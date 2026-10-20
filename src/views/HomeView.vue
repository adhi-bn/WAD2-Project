<script setup>
/**
 * @fileoverview HomeView component.
 * Renders the landing screen with an interactive 3D exploded keyboard anatomy backdrop,
 * guided card-by-card physical layer walk-through, interactive layer focus chips,
 * and clear calls-to-action leading into the keyboard builder.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import ExplodedAnatomyCanvas from '../components/ExplodedAnatomyCanvas.vue'
import { ANATOMY_LAYERS } from '../lib/explodedAnatomyScene.js'
import {
  ANATOMY_GUIDE_STEPS,
  ANATOMY_GUIDE_OUTRO,
} from '../lib/anatomyGuide.js'

function kbSVG() {
  const main = [
    [...Array(13).fill(1), 2],
    [1.5, ...Array(12).fill(1), 1.5],
    [1.75, ...Array(11).fill(1), 2.25],
    [2.25, ...Array(10).fill(1), 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ]
  const top = 1.25
  const rows = []
  main.forEach((row, rowIndex) => {
    let x = 0
    row.forEach((width) => {
      rows.push([x, top + rowIndex, width])
      x += width
    })
  })
  for (let i = 0; i < 16; i++) rows.push([i, 0, 1])
  for (let r = 0; r < 5; r++) rows.push([15, top + r, 1])
  const widthUnits = 16
  const heightUnits = top + 5
  const unitPx = 10
  const accent = main.flat().length
  return `<svg class="kb" viewBox="-6 -6 ${widthUnits * unitPx + 12} ${heightUnits * unitPx + 12}" aria-hidden="true"><rect class="f" x="-5" y="-5" width="${widthUnits * unitPx + 10}" height="${heightUnits * unitPx + 10}" rx="6"/>${rows.map(([x, y, w], i) => `<rect class="k ${i === accent ? 'a' : ''}" x="${x * unitPx + 0.8}" y="${y * unitPx + 0.8}" width="${w * unitPx - 1.6}" height="${unitPx - 1.6}" rx="1.6"/>`).join('')}</svg>`
}

const demoKb = kbSVG()

const rootRef = ref(null)
const activeLayerId = ref('')

let isProgrammaticScrolling = false
let programmaticTargetId = ''
let programmaticScrollTimeout = null
let rafScrollId = null
let scrollTicking = false

/**
 * Resets the programmatic scrolling lock flag.
 */
function clearProgrammaticScrollLock() {
  isProgrammaticScrolling = false
  programmaticTargetId = ''
  if (programmaticScrollTimeout !== null) {
    clearTimeout(programmaticScrollTimeout)
    programmaticScrollTimeout = null
  }
}

/**
 * Event handler for user wheel/touch interaction during smooth scroll.
 */
function onUserScrollInteraction() {
  if (isProgrammaticScrolling) {
    clearProgrammaticScrollLock()
  }
}

/**
 * Event handler for scroll end to unlock user scroll processing.
 */
function onScrollEnd() {
  clearProgrammaticScrollLock()
  if (typeof window !== 'undefined') {
    window.removeEventListener('scrollend', onScrollEnd)
  }
}

/**
 * Selects an anatomical layer from chip interaction and smoothly scrolls
 * the matching card into viewport center. Locks programmatic scrolling to avoid
 * thrashing intermediate cards during smooth scroll (REV-1).
 *
 * @param {string} layerId - Target layer identifier.
 */
function selectLayer(layerId) {
  if (activeLayerId.value === layerId) {
    activeLayerId.value = ''
    clearProgrammaticScrollLock()
  } else {
    activeLayerId.value = layerId
    isProgrammaticScrolling = true
    programmaticTargetId = layerId
    if (programmaticScrollTimeout !== null) {
      clearTimeout(programmaticScrollTimeout)
    }

    const cardEl =
      rootRef.value?.querySelector?.(`.layer-step-section[data-layer-id="${layerId}"]`) ||
      (typeof document !== 'undefined'
        ? document.querySelector(`.layer-step-section[data-layer-id="${layerId}"]`)
        : null)
    if (cardEl && typeof cardEl.scrollIntoView === 'function') {
      cardEl.scrollIntoView({
        behavior: 'auto',
        block: 'center',
      })
    }

    if (typeof window !== 'undefined') {
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', onScrollEnd, { once: true, passive: true })
      }
      programmaticScrollTimeout = setTimeout(() => {
        onScrollEnd()
      }, 5000)
    }
  }
}

const nonBarebonesLayers = Object.freeze(
  ANATOMY_LAYERS.filter((l) => !l.isBarebonesInternals)
)

const barebonesLayers = Object.freeze(
  ANATOMY_LAYERS.filter((l) => l.isBarebonesInternals)
)

const selectedLayer = computed(() => {
  return ANATOMY_LAYERS.find((l) => l.id === activeLayerId.value) || null
})

/**
 * Updates the active layer identifier based on which guided layer card's center
 * is closest to the vertical center of the viewport. Ignored during programmatic scroll (REV-1).
 */
function updateActiveLayerOnScroll() {
  scrollTicking = false
  rafScrollId = null
  if (isProgrammaticScrolling) return
  const sections =
    rootRef.value?.querySelectorAll?.('.layer-step-section') ||
    (typeof document !== 'undefined'
      ? document.querySelectorAll('.layer-step-section')
      : [])
  if (!sections || sections.length === 0) return

  const vHeight = typeof window !== 'undefined' ? window.innerHeight || 800 : 800
  const vCenter = vHeight * 0.5
  let closestSection = null
  let minDistance = Infinity

  sections.forEach((sec) => {
    const rect = sec.getBoundingClientRect()
    const secCenter = (rect.top + rect.bottom) * 0.5
    const dist = Math.abs(secCenter - vCenter)
    if (dist < minDistance) {
      minDistance = dist
      closestSection = sec
    }
  })

  if (closestSection && minDistance < vHeight * 0.5) {
    const matchedId = closestSection.dataset.layerId || ''
    if (isProgrammaticScrolling) {
      if (matchedId === programmaticTargetId) {
        clearProgrammaticScrollLock()
      } else {
        return
      }
    }
    activeLayerId.value = matchedId
  } else if (!isProgrammaticScrolling && !programmaticTargetId && minDistance > vHeight * 0.85) {
    activeLayerId.value = ''
  }
}

/**
 * Throttled window scroll event handler.
 */
function handleWindowScroll() {
  if (scrollTicking) return
  scrollTicking = true
  if (typeof requestAnimationFrame !== 'undefined') {
    rafScrollId = requestAnimationFrame(updateActiveLayerOnScroll)
  } else {
    updateActiveLayerOnScroll()
  }
}

/**
 * Passive window resize event handler to update active card on viewport/orientation change (REV-6).
 */
function handleWindowResize() {
  handleWindowScroll()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
    window.addEventListener('resize', handleWindowResize, { passive: true })
    window.addEventListener('wheel', onUserScrollInteraction, { passive: true })
    window.addEventListener('touchmove', onUserScrollInteraction, { passive: true })
    handleWindowScroll()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleWindowScroll)
    window.removeEventListener('resize', handleWindowResize)
    window.removeEventListener('scrollend', onScrollEnd)
    window.removeEventListener('wheel', onUserScrollInteraction)
    window.removeEventListener('touchmove', onUserScrollInteraction)
  }
  if (rafScrollId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(rafScrollId)
    rafScrollId = null
  }
  clearProgrammaticScrollLock()
})

const steps = [
  {
    n: '01',
    t: 'Set your budget',
    d: 'Track gross and net S$ totals live. Going over budget warns you and will never block your build.',
  },
  {
    n: '02',
    t: 'Pick each part',
    d: 'Choose your barebones kit, 5-pin switches, and keycaps. Every swap shows the price difference right away.',
  },
  {
    n: '03',
    t: 'See the whole board',
    d: 'Live S$ total cost and an instant compatibility check across layout, profile, and our 5-pin-only switch policy.',
  },
  {
    n: '04',
    t: 'Review your build',
    d: 'Inspect your complete three-Part specification anytime as a guest, with no sign-up required.',
  },
]
</script>

<template>
  <section class="screen" id="home" ref="rootRef">
    <!-- 3D Exploded Anatomy Canvas mounted as sticky/fixed background -->
    <ExplodedAnatomyCanvas :active-layer-id="activeLayerId" />

    <div class="wrap">
      <div class="hero">
        <div>
          <div class="eyebrow">Custom mechanical keyboards · priced in S$</div>
          <h1>Swipe right on your <em>dream keyboard.</em></h1>
          <p class="lede">
            Pick three core Parts — barebones kit, 5-pin switches, and keycaps — with a live S$ budget meter.
            Going over your budget shows a warning and will never block your build.
          </p>
          <div class="ctas">
            <RouterLink to="/builder" class="ui-btn primary big">
              Start building
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </RouterLink>
            <span class="fine">About 1 minute. No sign-up.</span>
          </div>
        </div>
        <div class="stackdemo" aria-hidden="true">
          <div class="scard c3"></div>
          <div class="scard c2"></div>
          <div class="scard c1">
            <span class="stamp yes">PICK</span>
            <div class="kbwrap" v-html="demoKb"></div>
            <h2>75%</h2>
            <p>Arrows and F-row, still compact. The popular middle.</p>
            <div class="eg">84 keys · 5 stabilisers · fits most desks</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Intro Card: Exploded Anatomy Initiation & Interactive Chips -->
    <div class="hs hs-look">
      <div class="wrap">
        <div class="glass intro-glass-card">
          <div class="eyebrow">Look inside</div>
          <h2>Build your keyboard across three core parts.</h2>
          <p>
            Every build combines a barebones kit (case, plate, PCB, and foam bundled together), 5-pin switches, and keycaps — and you get to choose every part.
          </p>

          <div class="layerchips" role="group" aria-label="Keyboard anatomical layers">
            <!-- Core individual parts: Keycaps and Switches -->
            <button
              v-for="layer in nonBarebonesLayers"
              :key="layer.id"
              type="button"
              class="layer-chip-btn"
              :class="{ 'is-active': activeLayerId === layer.id }"
              :aria-pressed="activeLayerId === layer.id ? 'true' : 'false'"
              @click="selectLayer(layer.id)"
            >
              <span class="chip-dot" :style="{ backgroundColor: layer.color }"></span>
              {{ layer.label }}
            </button>

            <!-- Barebones kit bundled internals group -->
            <div class="barebones-bracket">
              <div class="barebones-bracket-header">
                <span class="barebones-bracket-badge">Barebones kit (bundled internals)</span>
              </div>
              <div class="barebones-bracket-chips">
                <button
                  v-for="layer in barebonesLayers"
                  :key="layer.id"
                  type="button"
                  class="layer-chip-btn"
                  :class="{ 'is-active': activeLayerId === layer.id }"
                  :aria-pressed="activeLayerId === layer.id ? 'true' : 'false'"
                  @click="selectLayer(layer.id)"
                >
                  <span class="chip-dot" :style="{ backgroundColor: layer.color }"></span>
                  {{ layer.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Active layer description detail card -->
          <div v-if="selectedLayer" class="layer-detail-card" aria-live="polite">
            <div class="layer-detail-header">
              <span class="layer-detail-title">{{ selectedLayer.label }}</span>
              <span v-if="selectedLayer.isBarebonesInternals" class="layer-detail-tag barebones">
                Barebones kit bundled
              </span>
              <span v-else class="layer-detail-tag core-part">
                {{ selectedLayer.partCategory }}
              </span>
            </div>
            <p class="layer-detail-desc">{{ selectedLayer.description }}</p>
            <p v-if="selectedLayer.id === 'foam'" class="gasket-stack-info">
              <strong>Gasket acoustic stack:</strong> PORON plate cotton, IXPE switch underpad, PET film, and bottom case cotton.
            </p>
          </div>

          <p class="anatomy-disclaimer">
            Illustrative 3D structural guide — not a photorealistic, acoustic, or engineering-CAD claim.
          </p>

          <div class="acts">
            <RouterLink to="/builder" class="ui-btn">Explore the builder →</RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- 6 Guided Step-by-Step Layer Cards (C-2) -->
    <div
      v-for="(step, index) in ANATOMY_GUIDE_STEPS"
      :key="step.id"
      class="hs ks layer-step-section"
      :data-layer="index"
      :data-layer-id="step.id"
      :aria-current="activeLayerId === step.id ? 'step' : undefined"
    >
      <div class="wrap">
        <div class="glass layer-step-card" :class="{ 'is-active-step': activeLayerId === step.id }">
          <div class="step-card-header">
            <span class="eyebrow">{{ step.eyebrow }}</span>
            <span v-if="activeLayerId === step.id" class="active-step-pill" aria-label="Active inspected layer">
              Inspecting
            </span>
            <span v-else-if="step.isBarebonesInternals" class="layer-step-badge barebones">
              Barebones kit
            </span>
            <span v-else class="layer-step-badge core-part">
              Core Part
            </span>
          </div>
          <h2>{{ step.title }}</h2>
          <p class="step-summary">{{ step.summary }}</p>
          <ul v-if="step.facts && step.facts.length" class="facts">
            <li v-for="fact in step.facts" :key="fact[0]">
              <b>{{ fact[0] }}</b>
              <span>{{ fact[1] }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 4 Value Proposition Steps -->
    <div class="hs">
      <div class="wrap">
        <div class="row g-3">
          <div v-for="s in steps" :key="s.n" class="col-12 col-sm-6 col-lg-3">
            <div class="step">
              <div class="num">{{ s.n }}</div>
              <h3>{{ s.t }}</h3>
              <p>{{ s.d }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Outro Reassembly Card -->
    <div class="hs hs-end">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">{{ ANATOMY_GUIDE_OUTRO.eyebrow }}</div>
          <h2>{{ ANATOMY_GUIDE_OUTRO.title }}</h2>
          <p>{{ ANATOMY_GUIDE_OUTRO.summary }} Ask Biscuit if you need a hand.</p>
          <div class="acts">
            <RouterLink to="/builder" class="ui-btn primary">Start building →</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
