<script setup>
import { kbSVG } from '../logic/builder.js'
import { openWheel } from '../store.js'

const demoKb = kbSVG('75')
const steps = [
  { n: '01', t: 'Swipe your style', d: 'Layout, weight, frame, keycaps, switches and a budget meter.' },
  { n: '02', t: 'Pick each part', d: 'Three picks per part. Every swap shows the price difference right away.' },
  { n: '03', t: 'See the whole board', d: 'Total cost, sound, feel, weight and a compatibility check.' },
  { n: '04', t: 'Save and order', d: 'Save your build to your account, add it to the cart and pay securely.' },
]
const layers = ['Keycaps', 'Switches', 'Plate', 'PCB', 'Foam', 'Case']
</script>

<template>
  <section class="screen" id="home">
    <div class="wrap">
      <div class="hero">
        <div>
          <div class="eyebrow">Custom mechanical keyboards · priced in S$</div>
          <h1>Swipe right on your <em>dream keyboard.</em></h1>
          <p class="lede">Six quick cards: layout, weight, frame, keycaps, switches and budget. We pick every part, show what each swap does to the price, then save it or order it here.</p>
          <div class="ctas">
            <router-link to="/swipe" class="ui-btn primary big">
              Start swiping
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </router-link>
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

    <!-- The 3D keyboard behind these sections explodes as they scroll past. -->
    <div class="hs hs-look">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">Look inside</div>
          <h2>Every keyboard is six layers.</h2>
          <p>Keep scrolling. The keyboard behind this page is coming apart, and you get to choose every layer.</p>
          <div class="layerchips"><span v-for="l in layers" :key="l">{{ l }}</span></div>
          <div class="acts"><router-link to="/know" class="ui-btn">Know your keyboard →</router-link></div>
        </div>
      </div>
    </div>

    <div class="hs">
      <div class="wrap">
        <div class="row g-3">
          <div v-for="s in steps" :key="s.n" class="col-12 col-sm-6 col-lg-3">
            <div class="step"><div class="num">{{ s.n }}</div><h3>{{ s.t }}</h3><p>{{ s.d }}</p></div>
          </div>
        </div>
      </div>
    </div>

    <div class="hs hs-end">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">Back together</div>
          <h2>Now put it together your way.</h2>
          <p>Six swipes and we pick every layer for you. Biscuit's lucky draw is on, too.</p>
          <div class="acts">
            <router-link to="/swipe" class="ui-btn primary">Start swiping →</router-link>
            <button type="button" class="ui-btn" @click="openWheel">Spin the lucky wheel</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
