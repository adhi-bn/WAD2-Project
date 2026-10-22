<script setup>
import { computed } from 'vue'
import { state, openWheel } from './store.js'
import { CAT_SVG } from './data/fatcat.js'
import FatCat from './components/FatCat.vue'

const stages = [
  { name: 'swipe', to: '/swipe', n: 1, label: 'Swipe' },
  { name: 'parts', to: '/parts', n: 2, label: 'Parts' },
  { name: 'build', to: '/build', n: 3, label: 'Build' },
  { name: 'buy', to: '/cart', n: 4, label: 'Cart' },
]
const enabled = (s) => s.name === 'swipe' || (state.build && state.reached[s.name]) || (s.name === 'parts' && state.build)

// Event countdown: ends at 23:59, three days from today.
const evEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(23, 59, 0, 0); return d.getTime() })()
const countdown = computed(() => {
  const s = Math.max(0, Math.floor((evEnd - state.now) / 1000))
  const p = (n) => String(n).padStart(2, '0')
  return `Ends in ${Math.floor(s / 86400)}d ${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
})
</script>

<template>
  <div class="event">
    <div class="wrap">
      <span class="evtag">Event</span>
      <span><b>Fat Cat Lucky Draw</b> · spin once, win up to 15% off your build</span>
      <span class="evcd">{{ countdown }}</span>
      <button type="button" @click="openWheel">Spin now</button>
    </div>
  </div>

  <header class="top">
    <div class="wrap">
      <router-link to="/" class="brand" aria-label="Le Chaton Typers home">
        <span class="brandcat" v-html="CAT_SVG"></span><span class="brandtxt">Le Chaton Typers</span>
      </router-link>
      <div class="topnav">
        <router-link to="/" class="navlink" active-class="on" aria-label="Home">
          <span class="full">Home</span><span class="short">Home</span>
        </router-link>
        <router-link to="/know" class="navlink" active-class="on">
          <span class="full">Know your keyboard</span><span class="short">Learn</span>
        </router-link>
        <router-link to="/builder" class="navlink" active-class="on" aria-label="Builder">
          <span class="full">Builder</span><span class="short">Builder</span>
        </router-link>
        <router-link to="/about" class="navlink" active-class="on" aria-label="About us">
          <span class="full">About us</span><span class="short">About</span>
        </router-link>
        <router-link to="/account" class="navlink" active-class="on">
          <span class="full">{{ state.user ? 'Profile' : 'Sign in' }}</span><span class="short">{{ state.user ? 'Profile' : 'Sign in' }}</span>
        </router-link>
        <nav class="stages" aria-label="Progress">
          <template v-for="s in stages" :key="s.name">
            <router-link v-if="enabled(s)" :to="s.to" class="stg" active-class="on">
              <span class="n">{{ s.n }}</span><span class="lbl">{{ s.label }}</span>
            </router-link>
            <span v-else class="stg dis" aria-disabled="true"><span class="n">{{ s.n }}</span><span class="lbl">{{ s.label }}</span></span>
          </template>
        </nav>
      </div>
    </div>
  </header>

  <main>
    <router-view />
  </main>

  <footer><div class="wrap">Le Chaton Typers · test build · sample prices in Singapore dollars</div></footer>

  <FatCat />
  <div class="lct-toast" :class="{ 'is-show': state.toast }" role="status" aria-live="polite">{{ state.toast }}</div>
</template>
