<script setup>
import { computed } from 'vue'
import { money } from '../logic/builder.js'
import { state, layout } from '../store.js'

const capital = (s) => s[0].toUpperCase() + s.slice(1)
const chips = computed(() => {
  const A = state.answers
  const one = (v, any, f) => (v ? { text: f(v), acc: true } : { text: any, acc: false })
  return [
    { text: `${layout()}% layout`, acc: true },
    one(A.weight, 'Any weight', (v) => `${capital(v)} weight`),
    one(A.frame, 'Any frame', (v) => `${v === 'pcb' ? 'PCB' : capital(v)} frame`),
    one(A.keycap, 'Any keycaps', (v) => `${capital(v)} keycaps`),
    one(A.switch, 'Any switches', (v) => `${capital(v)} switches`),
  ]
})
</script>

<template>
  <div class="chips">
    <span v-for="c in chips" :key="c.text" class="chip" :class="{ acc: c.acc }">{{ c.text }}</span>
    <span class="chip mono">Budget {{ money(state.answers.budget) }}</span>
  </div>
</template>
