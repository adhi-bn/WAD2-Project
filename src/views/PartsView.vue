<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { CATS, META } from '../data/catalog.js'
import { money, money2, signed, total, grams, kg, spec, reason, preferred, bestFit, whyText } from '../logic/builder.js'
import { state, layout, choose, discountOf, activeVoucher, timeLeft } from '../store.js'
import ProfileChips from '../components/ProfileChips.vue'

// The first five parts get their own tabs. Stabilisers, foam and cable share one Add-ons tab.
const MAIN = CATS.slice(0, 5)
const ADDONS = CATS.slice(5)
const ADDON_INDEX = MAIN.length

const router = useRouter()
const catIdx = ref(0)
const onAddons = computed(() => catIdx.value >= ADDON_INDEX)
const cat = computed(() => CATS[catIdx.value])
const b = computed(() => state.build)
const answers = computed(() => ({ ...state.answers, layout: layout() }))

// Per-part helpers, so the same card markup works for one part or for each add-on.
const sections = computed(() => (onAddons.value ? ADDONS : [cat.value]))
const curOf = (c) => b.value[c]
const fitOf = (c) => bestFit(c, state.cat, b.value, state.rec)
const allOf = (c) => [...state.cat[c]].sort((a, z) => a.price - z.price)
const prefOf = (c) => preferred(c, answers.value, state.cat)
// Compare parts by id: the build's parts are copies, so object identity misses pre-selected ones (e.g. FATKEY).
const isFit = (c, o) => o.id === fitOf(c).id
const isSel = (c, o) => o.id === curOf(c)?.id
const tag = (c, o) => (isFit(c, o) ? 'Best fit for you' : o.price < fitOf(c).price ? 'Save' : o.price > fitOf(c).price ? 'Upgrade' : 'Alternative')
const delta = (c, o) => {
  const cu = curOf(c)
  if (o.id === cu.id) return { cls: 'same', text: 'Selected' }
  const d = o.price - cu.price
  return { cls: d > 0 ? 'up' : d < 0 ? 'down' : 'same', text: signed(d) }
}
const addonTotal = computed(() => ADDONS.reduce((s, c) => s + b.value[c].price, 0))

const t = computed(() => total(b.value))
const disc = computed(() => discountOf(t.value))
const left = computed(() => { const d = state.answers.budget - t.value; return d >= 0 ? `${money(d)} under budget` : `${money(-d)} over budget` })
const pct = computed(() => Math.min(100, (t.value / state.answers.budget) * 100) + '%')
const over = computed(() => t.value > state.answers.budget)

function go(i) { catIdx.value = i; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function prevPart() { if (catIdx.value > 0) go(catIdx.value - 1) }
function nextPart() { if (onAddons.value) router.push('/build'); else go(catIdx.value + 1) }
const nextLabel = computed(() => (onAddons.value ? 'See my keyboard →' : catIdx.value + 1 === ADDON_INDEX ? 'Next: Add-ons →' : `Next: ${META[CATS[catIdx.value + 1]].label} →`))
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
          <ProfileChips />
        </div>
        <router-link to="/swipe" class="ui-btn">Retake the quiz</router-link>
      </div>

      <div class="layout">
        <div>
          <div class="tabs" role="tablist">
            <button v-for="(c, i) in MAIN" :key="c" type="button" class="tab" :class="{ on: i === catIdx }" role="tab" :aria-selected="i === catIdx" @click="go(i)">
              <span class="k">{{ String(i + 1).padStart(2, '0') }} · {{ META[c].short }}</span>
              <span class="v">{{ money(b[c].price) }}</span>
            </button>
            <button type="button" class="tab" :class="{ on: onAddons }" role="tab" :aria-selected="onAddons" @click="go(ADDON_INDEX)">
              <span class="k">{{ String(ADDON_INDEX + 1).padStart(2, '0') }} · Add-ons</span>
              <span class="v">{{ money(addonTotal) }}</span>
            </button>
          </div>

          <template v-if="!onAddons">
            <div class="catintro">
              <div class="eyebrow">Part {{ catIdx + 1 }} of {{ CATS.length }}</div>
              <h2>{{ META[cat].label }}</h2>
              <p>{{ whyText(cat, b, answers) }}</p>
            </div>
          </template>
          <template v-else>
            <div class="catintro">
              <div class="eyebrow">Parts {{ ADDON_INDEX + 1 }} to {{ CATS.length }} of {{ CATS.length }}</div>
              <h2>Add-ons</h2>
              <p>Stabilisers, foam and cable. Pick one card in each section.</p>
            </div>
          </template>

<<<<<<< Updated upstream
          <div class="row g-3">
            <div v-for="o in three" :key="o.id" class="col-12 col-md-4">
              <button type="button" class="opt w-100 h-100" :class="{ sel: o === cur }" @click="choose(cat, o.id)">
                <span class="tag" :class="{ fit: o === fit }">{{ tag(o) }}</span>
                <span class="name">{{ o.name }}</span>
                <span class="spec">{{ spec(cat, o) }}</span>
                <span class="foot"><span class="price">{{ money(o.price) }}</span><span class="delta" :class="delta(o).cls">{{ delta(o).text }}</span></span>
              </button>
=======
          <div v-for="c in sections" :key="c" :style="onAddons ? 'margin-top: 28px' : null">
            <template v-if="onAddons">
              <h3 style="margin: 0 0 4px">{{ META[c].label }}</h3>
              <p class="sub" style="margin: 0 0 12px">{{ whyText(c, b, answers) }}</p>
            </template>

            <SwitchAudioPreview v-if="c === 'switches'" :part="curOf(c)" />

            <div class="row g-3">
              <div v-for="o in allOf(c)" :key="o.id" class="col-12 col-md-4">
                <button type="button" class="opt w-100 h-100" :class="{ sel: isSel(c, o) }" :disabled="!!reason(c, o, b)" @click="choose(c, o.id)">
                  <span class="tag" :class="{ fit: isFit(c, o) }">{{ tag(c, o) }}</span>
                  <span v-if="prefOf(c).some((p) => p.id === o.id) && prefOf(c).length < allOf(c).length" class="tagmatch">your style</span>
                  <span class="name">{{ o.name }}</span>
                  <span :class="reason(c, o, b) ? 'why' : 'spec'">{{ reason(c, o, b) || spec(c, o) }}</span>
                  <span class="foot"><span class="price">{{ money(o.price) }}</span><span v-if="!reason(c, o, b)" class="delta" :class="delta(c, o).cls">{{ delta(c, o).text }}</span></span>
                </button>
              </div>
>>>>>>> Stashed changes
            </div>
          </div>

          <div class="navrow">
            <button type="button" class="ui-btn" :disabled="catIdx === 0" @click="prevPart">← Previous part</button>
            <button type="button" class="ui-btn primary" @click="nextPart">{{ nextLabel }}</button>
          </div>
        </div>

        <aside class="sheet">
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
