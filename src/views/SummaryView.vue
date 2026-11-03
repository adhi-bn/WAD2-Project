<script setup>
/**
 * @fileoverview SummaryView component (/build).
 * Renders the final build summary sheet with an interactive 3D model / type tester stage,
 * real-time compatibility checks, parts breakdown with canonical currency formatting,
 * baseline diff tracking for saved builds, and cart submission guards.
 */

import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { CATS, META, KEYS } from '../data/catalog.js'
import { money, money2, total, grams, kg, spec, reason } from '../logic/builder.js'
import { state, layout, discountOf, toast, addToCart, saveBuild } from '../store.js'
import Keyboard3DView from '../components/Keyboard3DView.vue'
import TypeTesterView from '../components/TypeTesterView.vue'

const router = useRouter()
const buildName = ref(state.editingSavedBuildName || '')
const saving = ref(false)

// Two views of the build: 3D (default) and a type tester. The last choice is remembered for the visit.
const VIEWS = [{ id: '3d', label: '3D view' }, { id: 'type', label: 'Type tester' }]
const VIEW_KEY = 'summaryView'
function readView() {
  try {
    const v = sessionStorage.getItem(VIEW_KEY)
    return VIEWS.some((x) => x.id === v) ? v : '3d'
  } catch {
    return '3d'
  }
}
const view = ref(readView())
function setView(id) {
  view.value = id
  try { sessionStorage.setItem(VIEW_KEY, id) } catch { /* storage blocked: the choice lasts for this page only */ }
}

/**
 * Handles keyboard arrow navigation between 3D view and Type tester tabs (IMP-7).
 */
function switchView() {
  const nextId = view.value === '3d' ? 'type' : '3d'
  setView(nextId)
  if (typeof document !== 'undefined') {
    document.getElementById(`tab-${nextId}`)?.focus()
  }
}

const b = computed(() => state.build || {})
const L = computed(() => layout())
const hasUnknownPrice = computed(() => CATS.some((group) => !Number.isFinite(b.value?.[group]?.price)))
const t = computed(() => hasUnknownPrice.value ? null : total(b.value))
const disc = computed(() => t.value === null ? 0 : discountOf(t.value))
const needsSavedBuildReview = computed(() => Boolean(state.savedBuildReview?.issues?.length))
const g = computed(() => grams(b.value))
const left = computed(() => {
  if (t.value === null) return 'Budget unavailable until every Part has a current price'
  const d = state.answers.budget - t.value
  return d >= 0 ? `${money(d)} under budget` : `${money(-d)} over budget`
})
const title = computed(() => {
  if (!b.value?.case) return `Your ${L.value}% keyboard`
  if (b.value.case?.unavailable) return `Your ${L.value}% saved keyboard Build`
  return `Your ${L.value}% ${b.value.case.frame === 'metal' ? 'aluminium' : b.value.case.frame === 'pcb' ? 'open-frame' : 'plastic'} keyboard`
})

// Plain-language ratings for sound, feel and weight.
const perf = computed(() => {
  const x = b.value
  if (!x?.switches || !x?.plate || !x?.foam) return []
  const sw = x.switches.type
  const soft = ['pcp', 'fr4p'].includes(x.plate.id), foam = x.foam.id
  const loud = ({ silent: 1, linear: 2, tactile: 3, clicky: 5 }[sw] || 0) + (foam === 'none' && sw !== 'clicky' && sw !== 'silent' ? 1 : 0)
  const sound = sw === 'silent' ? 'Near-silent, soft bottom-out. Fine for shared offices and late-night calls.'
    : sw === 'clicky' ? 'A loud click on every press. Great on your own, noisy for people nearby.'
    : soft && foam !== 'none' ? 'Deep, muted "thock". The soft plate and foam round off the sound.'
    : !soft && foam === 'none' ? 'Crisp, bright "clack" from the stiff plate and open case.'
    : 'Balanced, poppy sound. Not too deep, not too sharp.'
  const feel = `${sw ? sw[0].toUpperCase() + sw.slice(1) : ''} ${x.switches.force} switches on a ${x.plate.feel} ${x.plate.name?.toLowerCase() || ''}.`
  const wn = g.value < 800 ? 1 : g.value < 1100 ? 2 : g.value < 1500 ? 3 : g.value < 2100 ? 4 : 5
  const wt = `About ${kg(g.value)}. ${wn <= 2 ? 'Easy to throw in a bag.' : wn === 3 ? 'Stays put, still portable.' : 'Desk-bound and very solid.'}`
  return [
    { k: 'Loudness', n: loud, d: sound },
    { k: 'Typing feel', n: { linear: 3, tactile: 4, clicky: 4, silent: 3 }[sw] || 0, d: feel },
    { k: 'Weight', n: wn, d: wt },
  ]
})
const checks = computed(() => {
  const x = b.value, keys = KEYS[L.value]
  if (!x?.pcb || !x?.switches || !x?.keycaps || !x?.stabs || !x?.case) return []
  return [
    `Case, plate and PCB are all ${L.value}% layout`,
    x.pcb.hot ? 'Hot-swap PCB: switches push in, no soldering needed' : 'Solder PCB: you will need a soldering iron to fit the switches',
    `${keys} keys, so ${x.switches.buy} switches (packs of 10) leaves ${x.switches.buy - keys} spares`,
    `MX-style switches fit the plate and ${x.keycaps.prof} profile keycaps`,
    `${x.stabs.n} stabilisers for the spacebar, shifts, enter and backspace${L.value === '100' ? ', plus numpad keys' : ''}`,
    x.pcb.wl ? `Wireless PCB battery fits inside the ${x.case.name?.toLowerCase() || ''}` : 'Connects over USB-C',
  ]
})

/**
 * Copies the itemized parts list and total to the clipboard using canonical money formatting.
 */
function copyList() {
  const txt = CATS.map((c) => {
    const p = b.value?.[c]
    const priceStr = !Number.isFinite(p?.price) ? 'Unavailable' : p.price ? money(p.price) : 'Included'
    return `${META[c].label}: ${p?.name || 'Unavailable'} (${priceStr})`
  }).join('\n') + `\nTotal: ${t.value === null ? 'unavailable' : money(t.value)}`
  navigator.clipboard?.writeText(txt).then(() => toast('Parts list copied'), () => toast('Copy is blocked here. Select the table to copy it.'))
}

/**
 * Resolves an alert status tag for a keyboard part in the summary table.
 * Returns 'Unavailable' when the part is missing or has no finite price,
 * 'Incompatible' or 'Price changed' when flagged by saved build revalidation review or live compatibility,
 * or 'Differs from saved' when the customer modified a slot from the loaded saved build baseline.
 *
 * @param {string} c - Catalogue category/component group key.
 * @returns {'Unavailable'|'Incompatible'|'Price changed'|'Differs from saved'|null}
 */
function partStatusTag(c) {
  // 1. Part missing or price unknown -> Unavailable
  if (!b.value?.[c] || b.value[c].unavailable || !Number.isFinite(b.value[c].price)) {
    return 'Unavailable'
  }

  // 2. Saved build revalidation review issues -> Incompatible or Price changed
  const issues = state.savedBuildReview?.issues || []
  const matchingIssue = issues.find((issue) => issue.group === c && issue.type === 'incompatible')
    || issues.find((issue) => issue.group === c && issue.type === 'price-changed')

  if (matchingIssue) {
    return matchingIssue.type === 'incompatible' ? 'Incompatible' : 'Price changed'
  }

  // 3. Real-time compatibility
  if (!b.value[c]?.unavailable && reason(c, b.value[c], b.value)) {
    return 'Incompatible'
  }

  // 4. Baseline diff (STD-05: strictly check savedBuildBaselineIds without fallback)
  const baselineId = state.savedBuildBaselineIds?.[c]
  if (baselineId && b.value?.[c]?.id !== baselineId) {
    return 'Differs from saved'
  }

  return null
}

const partStatusTags = computed(() => Object.fromEntries(CATS.map((c) => [c, partStatusTag(c)])))

// Block checkout when there are pricing issues, saved build reviews pending, or unaddressed blocking errors (ADV-2)
const hasBlockingIssue = computed(() => CATS.some((c) => ['Unavailable', 'Incompatible'].includes(partStatusTags.value[c])))
const canAddToCart = computed(() => t.value !== null && !needsSavedBuildReview.value && !hasBlockingIssue.value)

const title2 = computed(() => buildName.value.trim() || title.value)
async function saveNow() {
  if (!state.user) { toast('Sign in to save your build.'); router.push('/account'); return }
  saving.value = true
  const res = await saveBuild(title2.value)
  saving.value = false
  toast(res.error || 'Build saved to your account.')
}
onMounted(() => document.body.classList.add('hasbar'))
onBeforeUnmount(() => document.body.classList.remove('hasbar'))
function addNow() {
  if (!canAddToCart.value) {
    toast('Review the changed Parts before adding this Saved build to your cart.')
    return
  }
  addToCart(title2.value)
  router.push('/cart')
}
</script>

<template>
  <section class="screen" id="summary">
    <div class="wrap">
      <div class="phead">
        <div class="phead-title">
          <div class="eyebrow">Build Summary</div>
          <h1>{{ title }}</h1>
        </div>
        <div class="save-build-top">
          <label for="buildName" class="eyebrow">Name and save this Build</label>
          <div class="actions">
            <input id="buildName" v-model="buildName" class="form-control" :placeholder="title" aria-label="Name for this build" />
            <button type="button" class="ui-btn primary" :disabled="saving" @click="saveNow">{{ saving ? 'Saving…' : state.editingSavedBuildId ? 'Update build' : 'Save build' }}</button>
          </div>
          <p v-if="!state.user" class="fine">Sign in to save it to your Profile.</p>
        </div>
        <div class="perf">
          <div v-for="p in perf" :key="p.k" class="pf">
            <b>{{ p.k }}</b>
            <span class="segs"><i v-for="i in 5" :key="i" :class="{ on: i <= p.n }"></i></span>
            <span>{{ p.d }}</span>
          </div>
        </div>
      </div>

      <div class="sumgrid">
        <!-- Full-width 3D stage and Type tester tab panel (IMP-6) -->
        <div class="panel view-stage-panel">
          <div v-if="hasUnknownPrice || needsSavedBuildReview" class="saved-build-warning" role="status">
            <strong>This Saved build needs review.</strong>
            <template v-if="hasUnknownPrice">A previously selected Part is no longer available or has no current price. Choose an available Part before using its Budget or checkout preview.</template>
            <template v-else>A selected Part, price, or compatibility rule has changed. Review the Parts before using the cart or checkout preview.</template>
          </div>
          <div class="viewtoggle" role="tablist" aria-label="Keyboard view">
            <button
              v-for="v in VIEWS"
              :id="'tab-' + v.id"
              :key="v.id"
              type="button"
              role="tab"
              class="ui-btn"
              :class="{ primary: view === v.id }"
              :aria-selected="view === v.id"
              aria-controls="summary-view-panel"
              :tabindex="view === v.id ? 0 : -1"
              @click="setView(v.id)"
              @keydown.left.prevent="switchView"
              @keydown.right.prevent="switchView"
            >
              {{ v.label }}
            </button>
          </div>
          <div
            id="summary-view-panel"
            class="viewpanel"
            role="tabpanel"
            :aria-labelledby="'tab-' + view"
          >
            <Keyboard3DView v-if="view === '3d'" :build="b" />
            <TypeTesterView v-else :build="b" />
          </div>
        </div>

        <!-- 2-Column lower grid: Left column = Parts breakdown table -->
        <div class="panel parts-panel">
          <div class="panel-header">
            <h3>Parts breakdown</h3>
            <button type="button" class="ui-btn" @click="copyList">Copy parts list</button>
          </div>
          <div class="scroll">
            <table class="tbl">
              <thead><tr><th>Part</th><th>Pick</th><th class="r">Price</th></tr></thead>
              <tbody>
                <tr v-for="c in CATS" :key="c" :class="{ 'is-flagged-part': Boolean(partStatusTags[c]) }">
                  <td>{{ META[c].label }}</td>
                  <td>
                    {{ b[c]?.name || 'Unavailable' }}
                    <span v-if="partStatusTags[c]" class="part-status-tag" :data-testid="'part-status-tag-' + c">{{ partStatusTags[c] }}</span>
                    <span v-if="b[c] && !b[c].unavailable" class="sub">{{ spec(c, b[c]) }}</span>
                  </td>
                  <td class="r">{{ !Number.isFinite(b[c]?.price) ? 'Unavailable' : b[c].price ? money(b[c].price) : 'Included' }}</td>
                </tr>
              </tbody>
              <tfoot><tr><td colspan="2">Total</td><td class="r">{{ t === null ? 'Unavailable' : disc > 0 ? `${money2(t - disc)} after voucher` : money(t) }}</td></tr></tfoot>
            </table>
          </div>
        </div>

        <!-- 2-Column lower grid: Right column = Compatibility check list -->
        <div class="panel compatibility-panel">
          <h3>Compatibility check</h3>
          <ul class="checks">
            <li v-for="c in checks" :key="c">
              <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".15" /><path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>{{ c }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Sticky bottom summary bar -->
    <div class="bar">
      <div class="wrap">
        <div class="t">
          <div class="lab">
            <template v-if="t === null">Build total · Unavailable until every Part has a current price</template>
            <template v-else-if="disc > 0">Build total with {{ state.ld.code }} · you save {{ money2(disc) }}</template>
            <template v-else>Build total · {{ left }}</template>
          </div>
          <div class="amt">{{ t === null ? 'Unavailable' : disc > 0 ? money2(t - disc) : money(t) }}</div>
        </div>
        <div class="bar-actions">
          <router-link to="/parts" class="ui-btn">← Change parts</router-link>
          <button type="button" class="ui-btn primary" :disabled="!canAddToCart" @click="addNow">{{ canAddToCart ? 'Add to cart →' : 'Review Parts to add to cart' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Page layout spacing */
#summary {
  padding-top: 16px;
  padding-bottom: 24px;
}

/* Header grid: Title and Save build card in a clean 2-column top grid */
#summary .phead {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

#summary .phead-title {
  min-width: 0;
}

#summary .phead-title h1 {
  margin: 4px 0 0;
}

/* Save build card */
#summary .save-build-top {
  background: var(--surface, #ffffff);
  border: 1px solid var(--line, #e2e4e9);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

#summary .save-build-top .eyebrow {
  margin-bottom: 2px;
}

#summary .save-build-top .actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

#summary .save-build-top .form-control {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 8px;
  padding-bottom: 8px;
}

#summary .save-build-top .ui-btn {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 8px 16px;
}

/* WCAG AA text contrast: dark muted ink on light surface (>= 4.5:1) */
#summary .save-build-top .fine {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted, #4b5262);
}

/* Full-width 3-column diagnostic rating row */
#summary .phead .perf {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 4px;
}

#summary .phead .pf {
  background: var(--surface, #ffffff);
  border: 1px solid var(--line, #e2e4e9);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

/* Responsive header stacking */
@media (max-width: 900px) {
  #summary .phead {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}

@media (max-width: 760px) {
  #summary .phead .perf {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}

/* Review grid: Full-width stage on top, then 2-column split below for Parts and Compatibility */
#summary .sumgrid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

#summary .sumgrid .view-stage-panel {
  grid-column: 1 / -1;
}

@media (max-width: 900px) {
  #summary .sumgrid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}

/* View toggle tabs and 3D preview viewport */
#summary .viewtoggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 14px;
}

#summary .viewtoggle .ui-btn {
  width: 100%;
  justify-content: center;
  border-radius: 12px;
  padding: 10px 14px;
}

#summary .viewpanel .view-placeholder {
  min-height: 380px;
}

@media (max-width: 760px) {
  #summary .viewpanel .view-placeholder {
    min-height: 280px;
  }
}

/* Parts breakdown panel header with compact action */
#summary .parts-panel .panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

#summary .parts-panel .panel-header h3 {
  margin: 0;
}

#summary .parts-panel .panel-header .ui-btn {
  font-size: 13px;
  padding: 6px 12px;
}

/* Red status alert tags and flagged part rows */
.part-status-tag {
  background: var(--lct-danger-tint, #FCE6DD);
  color: color-mix(in srgb, var(--lct-danger-orange, #D2461A) 82%, var(--lct-text-ink, #12151C));
  font-family: var(--mono, "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 6px;
  display: inline-block;
  margin-left: 8px;
  vertical-align: middle;
  border: 1px solid var(--lct-danger-orange, #D2461A);
  line-height: 1.3;
}

#summary .tbl tbody tr.is-flagged-part {
  background-color: color-mix(in srgb, var(--lct-danger-orange, #D2461A) 5%, transparent);
}

/* Sticky bar actions and body padding */
#summary .bar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

:global(body.hasbar) {
  padding-bottom: 104px;
}

@media (max-width: 760px) {
  :global(body.hasbar) {
    padding-bottom: 148px;
  }
}
</style>
