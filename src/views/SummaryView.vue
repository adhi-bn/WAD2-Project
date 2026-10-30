<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { CATS, META, KEYS } from '../data/catalog.js'
import { money, money2, total, grams, kg, spec } from '../logic/builder.js'
import { state, layout, discountOf, toast, addToCart, saveBuild } from '../store.js'
import Keyboard3DView from '../components/Keyboard3DView.vue'
import TypeTesterView from '../components/TypeTesterView.vue'
import ProfileChips from '../components/ProfileChips.vue'
import VirtualKeyboardTester from '../components/VirtualKeyboardTester.vue'

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

const b = computed(() => state.build)
const L = computed(() => layout())
const hasUnknownPrice = computed(() => CATS.some((group) => !Number.isFinite(b.value?.[group]?.price)))
const t = computed(() => hasUnknownPrice.value ? null : total(b.value))
const disc = computed(() => t.value === null ? 0 : discountOf(t.value))
const needsSavedBuildReview = computed(() => Boolean(state.savedBuildReview?.issues?.length))
const canAddToCart = computed(() => t.value !== null && !needsSavedBuildReview.value)
const g = computed(() => grams(b.value))
const left = computed(() => {
  if (t.value === null) return 'Budget unavailable until every Part has a current price'
  const d = state.answers.budget - t.value
  return d >= 0 ? `${money(d)} under budget` : `${money(-d)} over budget`
})
const pct = computed(() => t.value === null ? '0%' : Math.min(100, (t.value / state.answers.budget) * 100) + '%')
const title = computed(() => {
  if (b.value.case?.unavailable) return `Your ${L.value}% saved keyboard Build`
  return `Your ${L.value}% ${b.value.case.frame === 'metal' ? 'aluminium' : b.value.case.frame === 'pcb' ? 'open-frame' : 'plastic'} keyboard`
})

// Plain-language ratings for sound, feel and weight.
const perf = computed(() => {
  const x = b.value, sw = x.switches.type
  const soft = ['pcp', 'fr4p'].includes(x.plate.id), foam = x.foam.id
  const loud = ({ silent: 1, linear: 2, tactile: 3, clicky: 5 }[sw] || 0) + (foam === 'none' && sw !== 'clicky' && sw !== 'silent' ? 1 : 0)
  const sound = sw === 'silent' ? 'Near-silent, soft bottom-out. Fine for shared offices and late-night calls.'
    : sw === 'clicky' ? 'A loud click on every press. Great on your own, noisy for people nearby.'
    : soft && foam !== 'none' ? 'Deep, muted "thock". The soft plate and foam round off the sound.'
    : !soft && foam === 'none' ? 'Crisp, bright "clack" from the stiff plate and open case.'
    : 'Balanced, poppy sound. Not too deep, not too sharp.'
  const feel = `${sw[0].toUpperCase() + sw.slice(1)} ${x.switches.force} switches on a ${x.plate.feel} ${x.plate.name.toLowerCase()}.`
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
  return [
    `Case, plate and PCB are all ${L.value}% layout`,
    x.pcb.hot ? 'Hot-swap PCB: switches push in, no soldering needed' : 'Solder PCB: you will need a soldering iron to fit the switches',
    `${keys} keys, so ${x.switches.buy} switches (packs of 10) leaves ${x.switches.buy - keys} spares`,
    `MX-style switches fit the plate and ${x.keycaps.prof} profile keycaps`,
    `${x.stabs.n} stabilisers for the spacebar, shifts, enter and backspace${L.value === '100' ? ', plus numpad keys' : ''}`,
    x.pcb.wl ? `Wireless PCB battery fits inside the ${x.case.name.toLowerCase()}` : 'Connects over USB-C',
  ]
})

function copyList() {
  const txt = CATS.map((c) => `${META[c].label}: ${b.value[c].name} (${Number.isFinite(b.value[c].price) ? money(b.value[c].price) : 'unavailable'})`).join('\n') + `\nTotal: ${t.value === null ? 'unavailable' : money(t.value)}`
  navigator.clipboard?.writeText(txt).then(() => toast('Parts list copied'), () => toast('Copy is blocked here. Select the table to copy it.'))
}

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
        <div>
          <div class="eyebrow">Step 3 · Your keyboard</div>
          <h1>{{ title }}</h1>
          <ProfileChips />
        </div>
        <div class="perf">
          <div v-for="p in perf" :key="p.k" class="pf">
            <b>{{ p.k }}</b>
            <span class="segs"><i v-for="i in 5" :key="i" :class="{ on: i <= p.n }"></i></span>
            <span>{{ p.d }}</span>
          </div>
        </div>
        <div class="save-build-top">
          <label for="buildName" class="eyebrow">Name and save this Build</label>
          <div class="actions">
            <input id="buildName" v-model="buildName" class="form-control" :placeholder="title" aria-label="Name for this build" />
            <button type="button" class="ui-btn primary" :disabled="saving" @click="saveNow">{{ saving ? 'Saving…' : state.editingSavedBuildId ? 'Update build' : 'Save build' }}</button>
          </div>
          <p v-if="!state.user" class="fine">Sign in to save it to your Profile.</p>
        </div>
      </div>
      <div class="sumgrid sumgrid-single">
        <div class="panel">
          <div v-if="hasUnknownPrice || needsSavedBuildReview" class="saved-build-warning" role="status">
            <strong>This Saved build needs review.</strong>
            <template v-if="hasUnknownPrice">A previously selected Part is no longer available or has no current price. Choose an available Part before using its Budget or checkout preview.</template>
            <template v-else>A selected Part, price, or compatibility rule has changed. Review the Parts before using the cart or checkout preview.</template>
          </div>
          <div class="viewtoggle" role="tablist" aria-label="Keyboard view">
            <button v-for="v in VIEWS" :key="v.id" type="button" role="tab" class="ui-btn" :class="{ primary: view === v.id }" :aria-selected="view === v.id" @click="setView(v.id)">{{ v.label }}</button>
          </div>
          <div class="viewpanel" role="tabpanel">
            <Keyboard3DView v-if="view === '3d'" :build="b" />
            <TypeTesterView v-else :build="b" />
          </div>
          <VirtualKeyboardTester :layout="L" :switch-part="b.switches" />
        </div>

        <div class="panel">
          <div class="scroll">
            <table class="tbl">
              <thead><tr><th>Part</th><th>Pick</th><th class="r">Price</th></tr></thead>
              <tbody>
                <tr v-for="c in CATS" :key="c">
                  <td>{{ META[c].label }}</td>
                  <td>{{ b[c].name }}<span class="sub">{{ spec(c, b[c]) }}</span></td>
                  <td class="r">{{ !Number.isFinite(b[c].price) ? 'Unavailable' : b[c].price ? money(b[c].price) : 'Included' }}</td>
                </tr>
              </tbody>
              <tfoot><tr><td></td><td>Total</td><td class="r">{{ t === null ? 'Unavailable' : disc > 0 ? `${money2(t - disc)} after voucher` : money(t) }}</td></tr></tfoot>
            </table>
          </div>
        </div>

          <div class="panel">
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
          <button type="button" class="ui-btn" @click="copyList">Copy parts list</button>
          <button type="button" class="ui-btn primary" :disabled="!canAddToCart" @click="addNow">{{ canAddToCart ? 'Add to cart →' : 'Review Parts to add to cart' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Line the Save build box up with the Total column below it, using the same split as the review grid. */
#summary .phead {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
#summary .save-build-top {
  min-width: 0;
  width: 100%;
}
#summary .phead .perf {
  margin-top: 14px;
}
#summary .save-build-top {
  padding: 10px 12px;
}
#summary .save-build-top .eyebrow {
  margin-bottom: 6px;
}
#summary .save-build-top .actions {
  margin-top: 0;
  align-items: center;
  gap: 8px;
}
#summary .save-build-top .form-control {
  padding-top: 8px;
  padding-bottom: 8px;
}
#summary .save-build-top .ui-btn {
  padding: 8px 16px;
  white-space: nowrap;
}
#summary .save-build-top .fine {
  margin-top: 4px;
  font-size: 12px;
}
@media (max-width: 900px) {
  #summary .phead {
    grid-template-columns: minmax(0, 1fr);
  }
}
#summary .sumgrid-single {
  grid-template-columns: minmax(0, 1fr);
}
#summary .bar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}
@media (min-width: 760px) {
  #summary .perf {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
}
/* Tighter header: less empty space above, below and around the ratings. */
#summary {
  padding-top: 16px;
  padding-bottom: 16px;
}
#summary .phead {
  margin-bottom: 14px;
}
#summary .phead .perf {
  margin-top: 10px;
  gap: 8px;
}
#summary .phead .pf {
  padding: 10px 12px;
}
/* Four boxes in one row under the title: the three ratings and the Save build box. */
#summary .phead {
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.5fr);
  gap: 14px;
  align-items: stretch;
  margin-bottom: 18px;
}
#summary .phead > div:first-child {
  grid-column: 1 / -1;
}
#summary .phead .perf {
  grid-column: span 3;
  margin-top: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
#summary .phead .pf {
  padding: 12px 14px;
  height: 100%;
}
#summary .save-build-top {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 14px;
}
#summary .save-build-top .actions {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
@media (max-width: 900px) {
  #summary .phead {
    grid-template-columns: minmax(0, 1fr);
  }
  #summary .phead .perf {
    grid-column: 1;
  }
}
@media (max-width: 760px) {
  #summary .phead .perf {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Shorter row: compact rating boxes, and a Save build box with the name and button side by side. */
#summary .phead .pf {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  height: auto;
}
#summary .save-build-top {
  padding: 10px 12px;
  gap: 6px;
}
#summary .save-build-top .actions {
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}
#summary .save-build-top .form-control {
  flex: 1 1 auto;
  min-width: 0;
}
#summary .save-build-top .ui-btn {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 8px 14px;
}
/* Taller view area for the 3D view and type tester. */
#summary .viewpanel .view-placeholder {
  min-height: 520px;
}
@media (max-width: 760px) {
  #summary .viewpanel .view-placeholder {
    min-height: 380px;
  }
}
/* Leave room under the page for the floating bar, so the footer stays visible. Only while this page is open. */
:global(body.hasbar) {
  padding-bottom: 180px;
}
@media (max-width: 760px) {
  :global(body.hasbar) {
    padding-bottom: 260px;
  }
}
/* Full-width tabs for the 3D view and type tester. */
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
</style>
