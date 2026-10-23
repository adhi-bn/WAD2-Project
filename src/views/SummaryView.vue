<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CATS, META, KEYS } from '../data/catalog.js'
import { money, money2, total, grams, kg, spec, kbSVG } from '../logic/builder.js'
import { state, layout, discountOf, toast, addToCart, saveBuild } from '../store.js'
import ProfileChips from '../components/ProfileChips.vue'

const router = useRouter()
const buildName = ref('')
const saving = ref(false)

const b = computed(() => state.build)
const L = computed(() => layout())
const t = computed(() => total(b.value))
const disc = computed(() => discountOf(t.value))
const g = computed(() => grams(b.value))
const left = computed(() => { const d = state.answers.budget - t.value; return d >= 0 ? `${money(d)} under budget` : `${money(-d)} over budget` })
const pct = computed(() => Math.min(100, (t.value / state.answers.budget) * 100) + '%')
const title = computed(() => `Your ${L.value}% ${b.value.case.frame === 'metal' ? 'aluminium' : b.value.case.frame === 'pcb' ? 'open-frame' : 'plastic'} keyboard`)

// Plain-language ratings for sound, feel and weight.
const perf = computed(() => {
  const x = b.value, sw = x.switches.type
  const soft = ['pcp', 'fr4p'].includes(x.plate.id), foam = x.foam.id
  const loud = { silent: 1, linear: 2, tactile: 3, clicky: 5 }[sw] + (foam === 'none' && sw !== 'clicky' && sw !== 'silent' ? 1 : 0)
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
    { k: 'Typing feel', n: { linear: 3, tactile: 4, clicky: 4, silent: 3 }[sw], d: feel },
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
  const txt = CATS.map((c) => `${META[c].label}: ${b.value[c].name} (${b.value[c].price ? money(b.value[c].price) : 'included'})`).join('\n') + `\nTotal: ${money(t.value)}`
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
function addNow() {
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
      </div>
      <div class="sumgrid">
        <div class="panel">
          <div style="max-width: 520px; margin: 0 auto 16px" v-html="kbSVG(L)"></div>
          <div class="scroll">
            <table class="tbl">
              <thead><tr><th>Part</th><th>Pick</th><th class="r">Price</th></tr></thead>
              <tbody>
                <tr v-for="c in CATS" :key="c">
                  <td>{{ META[c].label }}</td>
                  <td>{{ b[c].name }}<span class="sub">{{ spec(c, b[c]) }}</span></td>
                  <td class="r">{{ b[c].price ? money(b[c].price) : 'Included' }}</td>
                </tr>
              </tbody>
              <tfoot><tr><td></td><td>Total</td><td class="r">{{ disc > 0 ? `${money2(t - disc)} after voucher` : money(t) }}</td></tr></tfoot>
            </table>
          </div>
          <div class="actions">
            <router-link to="/parts" class="ui-btn">← Change parts</router-link>
            <button type="button" class="ui-btn" @click="copyList">Copy parts list</button>
          </div>
          <div class="actions" style="margin-top: 12px">
            <input v-model="buildName" class="form-control" style="max-width: 260px" :placeholder="title" aria-label="Name for this build" />
            <button type="button" class="ui-btn" :disabled="saving" @click="saveNow">{{ saving ? 'Saving…' : 'Save build' }}</button>
            <button type="button" class="ui-btn primary" @click="addNow">Add to cart →</button>
          </div>
        </div>

        <div style="display: grid; gap: 16px">
          <div class="panel">
            <div class="bigtotal"><span class="eyebrow">Total</span><span class="amt">{{ disc > 0 ? money2(t - disc) : money(t) }}</span></div>
            <div class="meter" :class="{ over: t > state.answers.budget }"><i :style="{ width: pct }"></i></div>
            <div class="meterlab"><span>{{ left }}</span><span>Budget {{ money(state.answers.budget) }}</span></div>
            <div v-if="disc > 0" class="vline"><span>{{ state.ld.code }} voucher</span><span class="mono">−{{ money2(disc) }}</span></div>
            <div class="perf">
              <div v-for="p in perf" :key="p.k" class="pf">
                <b>{{ p.k }}</b>
                <span class="segs"><i v-for="i in 5" :key="i" :class="{ on: i <= p.n }"></i></span>
                <span>{{ p.d }}</span>
              </div>
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
    </div>
  </section>
</template>
