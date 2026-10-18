<script setup>
function kbSVG() {
  const main = [
    [...Array(13).fill(1), 2],
    [1.5, ...Array(12).fill(1), 1.5],
    [1.75, ...Array(11).fill(1), 2.25],
    [2.25, ...Array(10).fill(1), 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ]
  const top = 1.25
  const rows = []
  main.forEach((row, rowIndex) => {
    let x = 0
    row.forEach((width) => {
      rows.push([x, top + rowIndex, width])
      x += width
    })
  })
  for (let i = 0; i < 16; i++) rows.push([i, 0, 1])
  for (let r = 0; r < 5; r++) rows.push([15, top + r, 1])
  const widthUnits = 16
  const heightUnits = top + 5
  const unitPx = 10
  const accent = main.flat().length
  return `<svg class="kb" viewBox="-6 -6 ${widthUnits * unitPx + 12} ${heightUnits * unitPx + 12}" aria-hidden="true"><rect class="f" x="-5" y="-5" width="${widthUnits * unitPx + 10}" height="${heightUnits * unitPx + 10}" rx="6"/>${rows.map(([x, y, w], i) => `<rect class="k ${i === accent ? 'a' : ''}" x="${x * unitPx + 0.8}" y="${y * unitPx + 0.8}" width="${w * unitPx - 1.6}" height="${unitPx - 1.6}" rx="1.6"/>`).join('')}</svg>`
}

const demoKb = kbSVG()

const layers = ['Barebones kit', '5-pin Switches', 'Keycaps', 'Case + Plate + PCB + Foam']

const steps = [
  {
    n: '01',
    t: 'Set your budget',
    d: 'Track gross and net S$ totals live. Going over budget warns you and will never block your build.',
  },
  {
    n: '02',
    t: 'Pick each part',
    d: 'Choose your barebones kit, 5-pin switches, and keycaps. Every swap shows the price difference right away.',
  },
  {
    n: '03',
    t: 'See the whole board',
    d: 'Live S$ total cost and an instant compatibility check across layout, profile, and our 5-pin-only switch policy.',
  },
  {
    n: '04',
    t: 'Review your build',
    d: 'Inspect your complete three-Part specification anytime as a guest, with no sign-up required.',
  },
]
</script>

<template>
  <section class="screen" id="home">
    <div class="wrap">
      <div class="hero">
        <div>
          <div class="eyebrow">Custom mechanical keyboards · priced in S$</div>
          <h1>Swipe right on your <em>dream keyboard.</em></h1>
          <p class="lede">
            Pick three core Parts — barebones kit, 5-pin switches, and keycaps — with a live S$ budget meter.
            Going over your budget shows a warning and will never block your build.
          </p>
          <div class="ctas">
            <RouterLink to="/builder" class="ui-btn primary big">
              Start building
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </RouterLink>
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

    <div class="hs hs-look">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">Look inside</div>
          <h2>Build your keyboard across three core parts.</h2>
          <p>
            Every build combines a barebones kit (case, plate, PCB, and foam bundled together), 5-pin switches, and keycaps — and you get to choose every part.
          </p>
          <div class="layerchips">
            <span v-for="l in layers" :key="l">{{ l }}</span>
          </div>
          <div class="acts">
            <RouterLink to="/builder" class="ui-btn">Explore the builder →</RouterLink>
          </div>
        </div>
      </div>
    </div>

    <div class="hs">
      <div class="wrap">
        <div class="row g-3">
          <div v-for="s in steps" :key="s.n" class="col-12 col-sm-6 col-lg-3">
            <div class="step">
              <div class="num">{{ s.n }}</div>
              <h3>{{ s.t }}</h3>
              <p>{{ s.d }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hs hs-end">
      <div class="wrap">
        <div class="glass">
          <div class="eyebrow">Back together</div>
          <h2>Now put it together your way.</h2>
          <p>Three parts and we check compatibility and budget for you. Ask Biscuit if you need a hand.</p>
          <div class="acts">
            <RouterLink to="/builder" class="ui-btn primary">Start building →</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
