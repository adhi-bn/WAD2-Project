<script setup>
// Tinder-style swipe questionnaire.
// Drag the card: right = confirm the tapped option, left = no preference. Arrow keys work too.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { QUESTIONS } from '../data/catalog.js'
import { visFor, tierFor, money } from '../logic/builder.js'
import { state, finishQuiz, toast } from '../store.js'

const router = useRouter()
// If Biscuit already built a keyboard for this visitor, ask before the cards replace it.
const askStart = ref(!!(state.biscuit && state.build))
function startOver() { state.biscuit = false; askStart.value = false }
function keepBiscuit() { router.push('/parts') }
const A = state.answers
const qi = ref(0)
const dx = ref(0), dy = ref(0), dragging = ref(false), fly = ref(null)
const q = computed(() => QUESTIONS[qi.value])
const next = computed(() => QUESTIONS[qi.value + 1])
const tier = computed(() => tierFor(A.budget))
const gaugeDash = computed(() => `${((A.budget - 120) / 1080) * 100} 100`)
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const cardStyle = computed(() => {
  if (fly.value) {
    const r = fly.value === 'right'
    return { transition: 'transform .35s ease, opacity .35s ease', transform: `translate(${r ? 140 : -140}%,20px) rotate(${r ? 22 : -22}deg)`, opacity: 0 }
  }
  return { transition: dragging.value ? 'none' : 'transform .3s ease', transform: `translate(${dx.value}px,${dy.value * 0.25}px) rotate(${dx.value / 18}deg)` }
})
const yesOpacity = computed(() => (fly.value === 'right' ? 1 : Math.max(0, Math.min(1, dx.value / 100))))
const noOpacity = computed(() => (fly.value === 'left' ? 1 : Math.max(0, Math.min(1, -dx.value / 100))))

function canCommit(dir) {
  if (q.value.type === 'budget') return dir === 'right'
  return dir === 'left' || !!A[q.value.key]
}
function commit(dir) {
  if (fly.value) return
  if (!canCommit(dir)) { toast('Tap an option first, or swipe left for no preference'); return }
  if (q.value.type !== 'budget' && dir === 'left') A[q.value.key] = null
  fly.value = dir
  setTimeout(() => {
    fly.value = null; dx.value = 0; dy.value = 0
    if (qi.value < QUESTIONS.length - 1) qi.value++
    else { finishQuiz(); router.push('/parts') }
  }, reduce ? 0 : 300)
}
function pick(v) { A[q.value.key] = v; setTimeout(() => commit('right'), 200) }
function back() { if (qi.value > 0 && !fly.value) qi.value-- }

let sx = 0, sy = 0
function down(e) {
  if (e.target.closest('button,input,label,a') || fly.value) return
  dragging.value = true; sx = e.clientX; sy = e.clientY; dx.value = 0; dy.value = 0
  e.currentTarget.setPointerCapture(e.pointerId)
}
function move(e) { if (dragging.value) { dx.value = e.clientX - sx; dy.value = e.clientY - sy } }
function up() {
  if (!dragging.value) return
  dragging.value = false
  const dir = dx.value > 0 ? 'right' : 'left'
  if (Math.abs(dx.value) > 100 && canCommit(dir)) return commit(dir)
  if (Math.abs(dx.value) > 100) toast('Tap an option first, or swipe left for no preference')
  dx.value = 0; dy.value = 0
}
function onKey(e) {
  if (e.target.matches('input') || askStart.value) return
  if (e.key === 'ArrowLeft' && q.value.type !== 'budget') commit('left')
  if (e.key === 'ArrowRight') commit('right')
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<template>
  <section class="screen" id="quiz">
    <div class="wrap quiz">
      <div v-if="askStart" class="glass keepask">
        <div class="eyebrow">Biscuit's pick</div>
        <h2>You already have Biscuit's build. Start over?</h2>
        <div class="acts">
          <button type="button" class="ui-btn primary" @click="startOver">Yes</button>
          <button type="button" class="ui-btn" @click="keepBiscuit">No</button>
        </div>
      </div>
      <template v-else>
      <div class="qhead">
        <div class="eyebrow">Question {{ qi + 1 }} of {{ QUESTIONS.length }} · {{ q.eyebrow }}</div>
        <h1>{{ q.title }}</h1>
        <div class="dots"><i v-for="(x, i) in QUESTIONS" :key="i" :class="{ done: i < qi, now: i === qi }"></i></div>
      </div>

      <div class="deck">
        <div v-if="next" class="scard back">
          <div class="eyebrow">{{ next.eyebrow }}</div>
          <h2>{{ next.title }}</h2>
        </div>

        <div :key="qi" class="scard top" :class="{ budget: q.type === 'budget' }" :style="cardStyle"
             @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
          <span class="stamp yes" :style="{ opacity: yesOpacity }">{{ q.type === 'budget' ? 'LOCKED' : 'PICKED' }}</span>
          <span v-if="q.type !== 'budget'" class="stamp no" :style="{ opacity: noOpacity }">ANY</span>

          <template v-if="q.type === 'budget'">
            <div class="eyebrow">Drag the meter · swipe right to lock</div>
            <svg class="gauge" viewBox="0 0 200 118" aria-hidden="true">
              <path class="trk" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke-width="16" stroke-linecap="round" />
              <path class="val" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke-width="16" stroke-linecap="round" pathLength="100" :stroke-dasharray="gaugeDash" />
              <text x="20" y="116" text-anchor="middle">120</text><text x="180" y="116" text-anchor="middle">1.2k</text>
            </svg>
            <div class="gaugeval"><div class="amt mono">{{ money(A.budget) }}</div><div class="tier">{{ tier[0] }}</div></div>
            <div class="budgetdesc">{{ tier[1] }}</div>
            <label for="budget" class="eyebrow" style="margin-top: 6px">Budget range</label>
            <input id="budget" v-model.number="A.budget" type="range" min="120" max="1200" step="10" />
            <div class="presets">
              <button v-for="v in [150, 300, 500, 800]" :key="v" type="button" @click="A.budget = v">{{ money(v) }}</button>
            </div>
          </template>

          <template v-else>
            <div class="eyebrow">{{ q.eyebrow }} · tap one, or swipe left for no preference</div>
            <div class="levels" :class="{ tight: q.opts.length > 3 }">
              <button v-for="o in q.opts" :key="o.v" type="button" class="level" :class="{ sel: A[q.key] === o.v }" @click="pick(o.v)">
                <span class="vis" v-html="visFor(q.key, o.v)"></span><b>{{ o.t }}</b><span>{{ o.d }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="controls">
        <div v-if="q.type !== 'budget'" class="ctrl">
          <button type="button" class="round no" aria-label="No preference" @click="commit('left')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
          </button><span>No preference</span>
        </div>
        <div class="ctrl">
          <button type="button" class="round sm" aria-label="Go back one card" :disabled="qi === 0" @click="back">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button><span>Back</span>
        </div>
        <div class="ctrl">
          <button type="button" class="round yes" aria-label="Confirm" @click="commit('right')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button><span>{{ q.type === 'budget' ? 'Lock it in' : 'Pick' }}</span>
        </div>
      </div>
      <div class="hint">
        <template v-if="q.type === 'budget'">Set the meter, then swipe right or tap <b>Lock it in</b></template>
        <template v-else>Tap an option, or drag the card: right to confirm, left for no preference. Keys <kbd>←</kbd> <kbd>→</kbd> work too.</template>
      </div>
      <div class="text-center mt-3">
        <router-link to="/parts" class="ui-btn">Skip quiz, pick parts myself →</router-link>
      </div>
      </template>
    </div>
  </section>
</template>
