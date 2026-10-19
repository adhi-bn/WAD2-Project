<script setup>
// "Know your keyboard": one card per layer. data-layer matches the layer index in Keyboard3D.vue.
const layers = [
  { n: 'Layer 1 of 6 · top', t: 'Keycaps', d: 'What your fingers touch, and most of the look. PBT keeps its texture; ABS gets shiny but takes bright colours.', facts: [['Profiles', 'Cherry, XDA, MOA'], ['You choose', 'Plain, styled or textured']] },
  { n: 'Layer 2 of 6', t: 'Switches', d: 'One under every key. They decide the feel and most of the sound.', facts: [['Types', 'Linear, tactile, clicky, silent'], ['75% board', '84 keys, so buy 90']] },
  { n: 'Layer 3 of 6', t: 'Plate', d: 'Holds the switches in place. Softer plates flex and sound deeper; stiffer ones sound brighter.', facts: [['Soft', 'Polycarbonate, FR4'], ['Stiff', 'Aluminium, brass']] },
  { n: 'Layer 4 of 6', t: 'PCB', d: 'The circuit board that turns key presses into letters on screen.', facts: [['Hot-swap', 'Change switches, no soldering'], ['Wireless', 'Needs room for a battery']] },
  { n: 'Layer 5 of 6', t: 'Foam', d: 'Fills the hollow space inside the case. It removes pinging and gives that deep, muted "thock".', facts: [['Basic', 'Case foam and switch pad'], ['Full', 'PE sheet and tape mod']] },
  { n: 'Layer 6 of 6 · bottom', t: 'Case', d: 'Sets the weight, the look and the base of the sound.', facts: [['Light', 'ABS or open frame'], ['Heavy', 'CNC aluminium, brass weight']] },
]
</script>

<template>
  <section class="screen know" id="know">
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

    <div v-for="(l, i) in layers" :key="l.t" class="ks" :data-layer="i">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">{{ l.n }}</div>
          <h2>{{ l.t }}</h2>
          <p>{{ l.d }}</p>
          <ul v-if="l.facts.length" class="facts">
            <li v-for="f in l.facts" :key="f[0]"><b>{{ f[0] }}</b>{{ f[1] }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="ks" data-layer="-2">
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
