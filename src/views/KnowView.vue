<script setup>
// "Know your keyboard": one card per layer, in the same order as the 3D model.
// The id on each layer is the layer id the 3D scene uses, so the matching part lights up as you scroll.
import { ref, onMounted, onUnmounted } from 'vue'
import ExplodedAnatomyCanvas from '../components/ExplodedAnatomyCanvas.vue'

const layers = [
  { id: 'keycaps', n: 'Layer 1 of 6 · top', t: 'Keycaps', d: 'What your fingers touch, and most of the look. PBT keeps its texture; ABS gets shiny but takes bright colours.', facts: [['Profiles', 'Cherry, XDA, MOA'], ['You choose', 'Plain, styled or textured']] },
  { id: 'switches', n: 'Layer 2 of 6', t: 'Switches', d: 'One under every key. They decide the feel and most of the sound.', facts: [['Types', 'Linear, tactile, clicky, silent'], ['75% board', '84 keys, so buy 90']] },
  { id: 'plate', n: 'Layer 3 of 6', t: 'Plate', d: 'Holds the switches in place. Softer plates flex and sound deeper; stiffer ones sound brighter.', facts: [['Soft', 'Polycarbonate, FR4'], ['Stiff', 'Aluminium, brass']] },
  { id: 'pcb', n: 'Layer 4 of 6', t: 'PCB', d: 'The circuit board that turns key presses into letters on screen.', facts: [['Hot-swap', 'Change switches, no soldering'], ['Wireless', 'Needs room for a battery']] },
  { id: 'foam', n: 'Layer 5 of 6', t: 'Foam', d: 'Fills the hollow space inside the case. It removes pinging and gives that deep, muted "thock".', facts: [['Basic', 'Case foam and switch pad'], ['Full', 'PE sheet and tape mod']] },
  { id: 'case', n: 'Layer 6 of 6 · bottom', t: 'Case', d: 'Sets the weight, the look and the base of the sound.', facts: [['Light', 'ABS or open frame'], ['Heavy', 'CNC aluminium, brass weight']] },
]

// The layer whose card is nearest the middle of the screen is the one the 3D model highlights.
const activeLayerId = ref('')
let ticking = false

function updateActiveLayer() {
  ticking = false
  const cards = document.querySelectorAll('.layer-step-section')
  const mid = window.innerHeight * 0.5
  let best = null
  let bestDist = Infinity
  cards.forEach((card) => {
    const r = card.getBoundingClientRect()
    const dist = Math.abs((r.top + r.bottom) / 2 - mid)
    if (dist < bestDist) { bestDist = dist; best = card }
  })
  activeLayerId.value = best && bestDist < window.innerHeight * 0.5 ? best.dataset.layerId : ''
}

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(updateActiveLayer)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  updateActiveLayer()
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <section class="screen know" id="know">
    <ExplodedAnatomyCanvas :active-layer-id="activeLayerId" />

    <div class="ks" data-layer="-1">
      <div class="wrap">
        <div class="glass kintro">
          <div class="eyebrow">Know your keyboard</div>
          <h1>Every keyboard is six layers.</h1>
          <p>Scroll to take this one apart. Each layer is something you choose in the builder.</p>
          <div class="cue"><i></i>Scroll to explode</div>
        </div>
      </div>
    </div>

    <div
      v-for="(l, i) in layers"
      :key="l.id"
      class="ks layer-step-section"
      :class="{ 'hs-look': i === 0, 'hs-end': i === layers.length - 1 }"
      :data-layer-id="l.id"
      :aria-current="activeLayerId === l.id ? 'step' : undefined"
    >
      <div class="wrap">
        <div class="glass layer-step-card" :class="{ 'is-active-step': activeLayerId === l.id }">
          <div class="eyebrow">{{ l.n }}</div>
          <h2>{{ l.t }}</h2>
          <p>{{ l.d }}</p>
          <ul v-if="l.facts.length" class="facts">
            <li v-for="f in l.facts" :key="f[0]"><b>{{ f[0] }}</b><span>{{ f[1] }}</span></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="ks">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">Back together</div>
          <h2>Now build yours.</h2>
          <p>Pick each layer in the builder and see, hear and price it before you buy.</p>
          <div class="acts"><router-link to="/swipe" class="ui-btn primary">Start swiping →</router-link></div>
        </div>
      </div>
    </div>
  </section>
</template>
