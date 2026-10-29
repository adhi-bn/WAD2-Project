<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { CATS, META } from '../data/catalog.js'
import { money, money2, signed, total, grams, kg, spec, reason, preferred, bestFit, whyText } from '../logic/builder.js'
import { state, layout, setLayout, choose, discountOf, activeVoucher, timeLeft, finishQuiz } from '../store.js'
import { build as domainBuild, setSlot } from '../stores/build.js'
import SwitchAudioPreview from '../components/SwitchAudioPreview.vue'
import BuildPreviewCanvas from '../components/BuildPreviewCanvas.vue'

if (!state.build) finishQuiz()

const router = useRouter()
const catIdx = ref(0)
const cat = computed(() => CATS[catIdx.value])
const b = computed(() => state.build)

// Watch reactive build state and sync active domainBuild slots on part selection (AC-R5, AC-R10)
watch(
  () => [b.value?.case, b.value?.switches, b.value?.keycaps],
  ([newCase, newSwitches, newKeycaps]) => {
    if (newCase && domainBuild.barebones?.id !== newCase.id) {
      setSlot('barebones', newCase)
    }
    if (newSwitches && domainBuild.switches?.id !== newSwitches.id) {
      setSlot('switches', newSwitches)
    }
    if (newKeycaps && domainBuild.keycaps?.id !== newKeycaps.id) {
      setSlot('keycaps', newKeycaps)
    }
  },
  { deep: true, immediate: true },
)
const cur = computed(() => b.value[cat.value])
const answers = computed(() => ({ ...state.answers, layout: layout() }))
const fit = computed(() => bestFit(cat.value, state.cat, b.value, state.rec))

const layoutOptions = ['60', '75', '100']
const currentLayout = computed(() => state.answers.layout || '75')
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')
const otherChips = computed(() => {
  const A = state.answers
  const one = (v, any, f) => (v ? { text: f(v), acc: true } : { text: any, acc: false })
  return [
    one(A.weight, 'Any weight', (v) => `${capital(v)} weight`),
    one(A.frame, 'Any frame', (v) => `${v === 'pcb' ? 'PCB' : capital(v)} frame`),
    one(A.keycap, 'Any keycaps', (v) => `${capital(v)} keycaps`),
    one(A.switch, 'Any switches', (v) => `${capital(v)} switches`),
  ]
})

// Three picks: one cheaper than the best fit, the best fit, and one pricier.
const three = computed(() => {
  const c = cat.value
  const pref = preferred(c, answers.value, state.cat).filter((o) => !reason(c, o, b.value))
  let pool = pref.length >= 3 || (pref.length >= 2 && pref.includes(fit.value)) ? pref : state.cat[c].filter((o) => !reason(c, o, b.value))
  if (!pool.includes(fit.value)) pool = [...pool, fit.value]
  pool = [...new Set(pool)].sort((a, z) => a.price - z.price || a.name.localeCompare(z.name))
  const i = pool.indexOf(fit.value), s = Math.max(0, Math.min(i - 1, pool.length - 3))
  return pool.slice(s, s + 3)
})
const all = computed(() => [...state.cat[cat.value]].sort((a, z) => a.price - z.price))
const prefAll = computed(() => preferred(cat.value, answers.value, state.cat))
const tag = (o) => (o === fit.value ? 'Best fit for you' : o.price < fit.value.price ? 'Save' : o.price > fit.value.price ? 'Upgrade' : 'Alternative')
const delta = (o) => {
  if (o === cur.value) return { cls: 'same', text: 'Selected' }
  const d = o.price - cur.value.price
  return { cls: d > 0 ? 'up' : d < 0 ? 'down' : 'same', text: signed(d) }
}

const t = computed(() => total(b.value))
const disc = computed(() => discountOf(t.value))
const left = computed(() => { const d = state.answers.budget - t.value; return d >= 0 ? `${money(d)} under budget` : `${money(-d)} over budget` })
const pct = computed(() => Math.min(100, (t.value / state.answers.budget) * 100) + '%')
const over = computed(() => t.value > state.answers.budget)

function go(i) { catIdx.value = i; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function nextPart() { if (catIdx.value < CATS.length - 1) go(catIdx.value + 1); else router.push('/build') }
onMounted(() => document.body.classList.add('hasbar'))
onBeforeUnmount(() => document.body.classList.remove('hasbar'))
</script>

<template>
  <section class="screen" id="parts">
    <div class="wrap">
      <div class="phead">
        <div>
          <div class="eyebrow">Step 2 · Choose your parts</div>
          <h1>Your keyboard, part by part</h1>
          <div class="summary-pills chips" role="group" aria-label="Layout selector and build profile">
            <div class="layout-selector d-inline-flex gap-1" role="group" aria-label="Keyboard layout">
              <button
                v-for="opt in layoutOptions"
                :key="opt"
                type="button"
                class="pill chip"
                :class="{ pri: currentLayout === opt, acc: currentLayout === opt }"
                :aria-pressed="currentLayout === opt"
                :aria-label="`${opt}% layout`"
                @click="setLayout(opt)"
              >
                {{ opt }}%
              </button>
            </div>
            <span v-for="c in otherChips" :key="c.text" class="chip pill" :class="{ acc: c.acc }">{{ c.text }}</span>
            <span class="chip pill mono">Budget {{ money(state.answers.budget) }}</span>
          </div>
        </div>
        <router-link to="/swipe" class="ui-btn">Retake the quiz</router-link>
      </div>

      <div class="layout">
        <div>
          <div class="tabs" role="tablist">
            <button v-for="(c, i) in CATS" :key="c" type="button" class="tab" :class="{ on: i === catIdx }" role="tab" :aria-selected="i === catIdx" @click="catIdx = i">
              <span class="k">{{ String(i + 1).padStart(2, '0') }} · {{ META[c].short }}</span>
              <span class="v">{{ money(b[c].price) }}</span>
            </button>
          </div>

          <div class="catintro">
            <div class="eyebrow">Part {{ catIdx + 1 }} of {{ CATS.length }}</div>
            <h2>{{ META[cat].label }}</h2>
            <p>{{ whyText(cat, b, answers) }}</p>
          </div>

          <SwitchAudioPreview v-if="cat === 'switches'" :part="cur" />

          <div class="row g-3">
            <div v-for="o in three" :key="o.id" class="col-12 col-md-4">
              <button type="button" class="opt w-100 h-100" :class="{ sel: o === cur }" @click="choose(cat, o.id)">
                <span class="tag" :class="{ fit: o === fit }">{{ tag(o) }}</span>
                <span class="name">{{ o.name }}</span>
                <span class="spec">{{ spec(cat, o) }}</span>
                <span class="foot"><span class="price">{{ money(o.price) }}</span><span class="delta" :class="delta(o).cls">{{ delta(o).text }}</span></span>
              </button>
            </div>
          </div>

          <details class="more">
            <summary>All {{ META[cat].label.toLowerCase() }} options ({{ all.length }})</summary>
            <button v-for="o in all" :key="o.id" type="button" class="prow" :class="{ sel: o === cur }" :disabled="!!reason(cat, o, b)" @click="choose(cat, o.id)">
              <span>
                <span class="n">{{ o.name }}</span>
                <span v-if="prefAll.includes(o) && prefAll.length < all.length" class="tagmatch">your style</span><br />
                <span :class="reason(cat, o, b) ? 'why' : 's'">{{ reason(cat, o, b) || spec(cat, o) }}</span>
              </span>
              <span class="p">{{ money(o.price) }}</span>
              <span v-if="reason(cat, o, b)"></span>
              <span v-else class="delta" :class="delta(o).cls">{{ delta(o).text }}</span>
            </button>
          </details>

          <div class="navrow">
            <button type="button" class="ui-btn" :disabled="catIdx === 0" @click="go(catIdx - 1)">← Previous part</button>
            <button type="button" class="ui-btn primary" @click="nextPart">
              {{ catIdx === CATS.length - 1 ? 'See my keyboard →' : `Next: ${META[CATS[catIdx + 1]].label} →` }}
            </button>
          </div>
        </div>

        <aside class="sheet">
          <BuildPreviewCanvas
            :barebones="domainBuild.barebones ?? b?.case"
            :switches="domainBuild.switches ?? b?.switches"
            :keycaps="domainBuild.keycaps ?? b?.keycaps"
            :layout="state.answers.layout || '75'"
            compact
            class="mb-3"
          />
          <h3>Build so far</h3>
          <ol>
            <li v-for="c in CATS" :key="c"><span class="k">{{ META[c].short }}</span><span class="nm" :title="b[c].name">{{ b[c].name }}</span><span class="pr">{{ b[c].price ? money(b[c].price) : '—' }}</span></li>
          </ol>
          <div class="tot"><span>Total</span><span class="mono"><s v-if="disc > 0">{{ money(t) }}</s>{{ disc > 0 ? money2(t - disc) : money(t) }}</span></div>
          <div v-if="disc > 0" class="vline"><span>{{ state.ld.code }} · {{ activeVoucher().name }}</span><span class="mono">−{{ money2(disc) }}</span></div>
          <div class="meter" :class="{ over }"><i :style="{ width: pct }"></i></div>
          <div class="meterlab"><span>{{ left }}</span><span>of {{ money(state.answers.budget) }}</span></div>
        </aside>
      </div>
    </div>

    <div class="bar">
      <div class="wrap">
        <div class="t">
          <div class="lab">
            <template v-if="disc > 0">Build total with {{ state.ld.code }} · you save {{ money2(disc) }} · code expires in {{ timeLeft() }}</template>
            <template v-else>Build total · {{ left }} · about {{ kg(grams(b)) }}</template>
          </div>
          <div class="amt">{{ disc > 0 ? money2(t - disc) : money(t) }}</div>
          <div class="meter" :class="{ over }"><i :style="{ width: pct }"></i></div>
        </div>
        <router-link to="/build" class="ui-btn primary">Review build →</router-link>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 12px;
}
.layout-selector {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.summary-pills .pill {
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--line, #d6dae3);
  color: var(--ink, #12151c);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  line-height: 1.4;
  text-decoration: none;
}
.summary-pills button.pill:hover {
  border-color: var(--accent, #3346ff);
}
.summary-pills .pill.pri {
  background: var(--accent, #3346ff) !important;
  border-color: var(--accent, #3346ff) !important;
  color: var(--accent-ink, #ffffff) !important;
}
.summary-pills button.pill:not(.pri) {
  background: var(--surface, #ffffff);
  border-color: var(--line, #d6dae3);
  color: var(--ink, #12151c);
}
.summary-pills button.pill:not(.pri):hover {
  border-color: var(--accent, #3346ff);
  background: var(--surface-2, #f4f5f9);
}
.summary-pills button.pill:focus-visible {
  outline: 2px solid var(--accent, #3346ff);
  outline-offset: 2px;
}

@media (min-width: 1080px) {
  #parts .layout,
  .layout {
    grid-template-columns: minmax(0, 1fr) 390px;
  }
}
</style>
