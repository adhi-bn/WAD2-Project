<script setup>
// Biscuit the fat cat: floating mascot, chat box and the Spin-to-Win lucky draw.
// Presenter tip: type /win10, /win15, /win5 or /lose in the chat to fix the next spin.
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CAT_SVG, PRIZES, SLICES, VOUCHER_MINUTES } from '../data/fatcat.js'
import { state, toast, saveLD, resetLD, activeVoucher, timeLeft, openWheel, loadBuild, addToCart, choose } from '../store.js'
import { supabase, supabaseReady } from '../lib/supabase.js'
import { CATS } from '../data/catalog.js'

const router = useRouter()
const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false

/* ---------- chat ---------- */
const DEFAULT_CHIPS = [['spin', 'Spin the wheel'], ['switch', 'Help me pick switches'], ['store', 'Visit the store'], ['reset', 'Reset demo']]
const chatOpen = ref(false), hiddenCat = ref(false), tease = ref(false), badge = ref(true)
const msgs = ref([]), chips = ref(DEFAULT_CHIPS), input = ref(''), msgBox = ref(null)
let greeted = false, uid = 0

const scrollDown = () => nextTick(() => { if (msgBox.value) msgBox.value.scrollTop = 1e6 })
function addMsg(who, html) { msgs.value.push({ id: ++uid, who, html }); scrollDown() }
function botSay(html, chipList, notify) {
  const id = ++uid
  msgs.value.push({ id, who: 'bot', typing: true })
  scrollDown()
  setTimeout(() => {
    const m = msgs.value.find((x) => x.id === id)
    if (m) { m.typing = false; m.html = html }
    chips.value = chipList || DEFAULT_CHIPS
    if (notify && !chatOpen.value) badge.value = true
    scrollDown()
  }, 600)
}
function handle(k) {
  if (k === 'spin') {
    if (state.ld.used) {
      const v = activeVoucher()
      if (v) botSay(`You already spun! Your code <b>${state.ld.code}</b> (${v.name}) has ${timeLeft()} left.`, state.ld.applied ? null : [['apply', 'Apply to my build'], ...DEFAULT_CHIPS.slice(1)])
      else botSay('One spin per person, meow. Watch out for the next Fat Cat event! (Presenting? Tap <b>Reset demo</b>.)')
    } else { botSay('Paws crossed! Opening my wheel…'); setTimeout(openWheel, 800) }
    return
  }
  if (k === 'apply') return applyVoucher()
  if (k === 'switch') return botSay('Quick guide: <b>Linear</b> is smooth, <b>Tactile</b> has a bump you feel, <b>Clicky</b> adds a click, and <b>Silent</b> keeps the office happy. Want me to start the swipe cards?', [['quiz', 'Start swiping'], ['spin', 'Spin the wheel'], ['store', 'Visit the store']])
  if (k === 'quiz') { botSay("Off you go! I'll be right here."); setTimeout(() => router.push('/swipe'), 700); return }
  if (k === 'store') return botSay('Le Chaton Typers is at <b>[store address]</b>, open <b>[opening hours]</b>. Come try your build in store before you buy.')
  if (k === 'addAI' || k === 'openAI') {
    const pick = aiPick.value?.build
    if (!pick) return botSay("I've lost my suggestion, meow. Ask me again?")
    loadBuild(pick, { fromBiscuit: true })
    if (k === 'openAI') return router.push('/build')
    addToCart(`Biscuit's pick (${pick.layout}%)`)
    return router.push('/cart')
  }
  if (k === 'swapAI') {
    const c = aiPick.value?.change
    if (!c || !state.build) return botSay('Open a build first, then I can swap a part in for you.')
    choose(c.category, c.id)
    return botSay(`Swapped in <b>${esc(c.name)}</b>. The new total is on the build page.`)
  }
  if (k === 'reset') { resetLD(); botSay('Demo reset. My wheel is ready to spin again.') }
}
function tapChip(c) { addMsg('me', c[1]); handle(c[0]) }
function send() {
  const v = input.value.trim()
  if (!v) return
  input.value = ''
  addMsg('me', v)
  const t = v.toLowerCase()
  const rig = { '/win15': 'p15', '/win10': 'p10', '/win5': 'p5', '/win': 'p10', '/lose': 'none' }[t]
  if (rig) { forced = rig; return botSay(`Presenter mode: the next spin lands on <b>${PRIZES[rig].name}</b>.`) }
  if (/spin|wheel|draw|luck|prize|discount|voucher|promo|code/.test(t)) handle('spin')
  else if (/switch|linear|tactile|click|silent|thock|sound/.test(t)) handle('switch')
  else if (/store|shop|where|address|hour|open|visit/.test(t)) handle('store')
  else if (/^(hi|hello|hey|meow)/.test(t)) botSay('Meow! What can I help you with?')
  else if (supabaseReady) askBiscuit(v)
  else botSay("Meow? I'm a simple cat for now. Try one of the buttons below.")
}

/* ---------- Biscuit's advisor (Gemini, through the advisor function) ---------- */
const aiBusy = ref(false), aiPick = ref(null), photoIn = ref(null)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

async function askBiscuit(text, image = null) {
  if (aiBusy.value) return botSay('One question at a time, meow.')
  aiBusy.value = true
  botSay('Let me think…')
  const { data, error } = await supabase.functions.invoke('advisor', {
    body: { message: text, image, origin: window.location.origin, layout: state.answers.layout || undefined },
  })
  aiBusy.value = false
  let problem = data?.error
  if (error) problem = (await error.context?.json?.().catch(() => null))?.error || 'Biscuit could not answer just now.'
  if (problem) return botSay(esc(problem), DEFAULT_CHIPS)

  let html = esc(data.reply)
  if (data.note) html += `<br><small>${esc(data.note)}</small>`
  const chipList = []
  aiPick.value = data
  if (data.build) {
    const b = data.build
    html += `<br><br><b>Suggested build (${b.layout}%): S$${b.total}</b><br>` + CATS.map((c) => `${c}: ${esc(b.names[c])}`).join('<br>')
    chipList.push(['addAI', 'Add to cart'], ['openAI', 'Open in builder'])
  }
  if (data.change) {
    html += `<br><br>Suggested swap: <b>${esc(data.change.name)}</b> (S$${data.change.price})`
    if (state.build) chipList.push(['swapAI', 'Swap it in'])
  }
  botSay(html, chipList.length ? [...chipList, ['spin', 'Spin the wheel']] : DEFAULT_CHIPS)
}

function pickPhoto() { photoIn.value?.click() }
function onPhoto(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  if (!supabaseReady) return botSay('My photo eyes are not connected yet, meow.')
  if (f.size > 4 * 1024 * 1024) return botSay('That photo is too big. Try one under 4 MB.')
  const reader = new FileReader()
  reader.onload = () => {
    const data = String(reader.result).split(',')[1]
    const text = input.value.trim()
    input.value = ''
    addMsg('me', `📷 ${f.name}${text ? ' · ' + text : ''}`)
    askBiscuit(text || 'Suggest a build that looks like this keyboard.', { mime_type: f.type || 'image/jpeg', data })
  }
  reader.readAsDataURL(f)
}

function openChat() {
  chatOpen.value = true; badge.value = false; tease.value = false
  if (!greeted) {
    greeted = true
    botSay("Meow! I'm <b>Biscuit</b>, the fat cat of Le Chaton Typers. Not sure what to build? Tell me what you want, or send a photo of a keyboard you like.", [])
    setTimeout(() => botSay('This week only: spin my lucky wheel for up to <b>15% off</b> your keyboard build.'), 1300)
  }
}
onMounted(() => {
  setTimeout(() => { if (!chatOpen.value && !hiddenCat.value && !state.ld.used) tease.value = true }, 3500)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.ui.wheel) closeWheel() })
})

/* ---------- spin wheel ---------- */
const R = 100
const slices = SLICES.map((k, i) => {
  const p = PRIZES[k], a0 = ((i * 45 - 22.5) * Math.PI) / 180, a1 = ((i * 45 + 22.5) * Math.PI) / 180
  return {
    key: i, fill: p.fill, ink: p.ink, label: p.label,
    d: `M0 0 L${(R * Math.sin(a0)).toFixed(2)} ${(-R * Math.cos(a0)).toFixed(2)} A${R} ${R} 0 0 1 ${(R * Math.sin(a1)).toFixed(2)} ${(-R * Math.cos(a1)).toFixed(2)} Z`,
    tf: `rotate(${i * 45 - 90}) translate(60 0)`,
  }
})
const bulbs = Array.from({ length: 16 }, (_, i) => { const a = (i * 22.5 * Math.PI) / 180; return { i, x: 105 * Math.sin(a), y: -105 * Math.cos(a) } })
const rot = ref(0), spinning = ref(false), view = ref('form'), email = ref(''), err = ref(''), emailInput = ref(null), canvas = ref(null)
const resultKey = ref(null), fresh = ref(false)
let forced = null

watch(() => state.ui.wheel, (open) => {
  if (!open) return
  tease.value = false
  if (state.ld.used) { resultKey.value = state.ld.prize; fresh.value = false; view.value = 'result' }
  else { view.value = 'form'; nextTick(() => emailInput.value && emailInput.value.focus()) }
})
function closeWheel() { if (!spinning.value) state.ui.wheel = false }
function pickPrize() {
  const tot = Object.values(PRIZES).reduce((a, p) => a + p.w, 0)
  let r = Math.random() * tot
  for (const [k, p] of Object.entries(PRIZES)) { r -= p.w; if (r < 0) return k }
  return 'none'
}
function spin() {
  if (spinning.value || state.ld.used) return
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { err.value = 'Enter an email like name@example.com to spin.'; emailInput.value.focus(); return }
  err.value = ''; spinning.value = true
  const k = forced || pickPrize(); forced = null
  const idx = SLICES.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0)
  const i = idx[Math.floor(Math.random() * idx.length)]
  const want = (((-i * 45 + (Math.random() - 0.5) * 28) % 360) + 360) % 360
  const base = rot.value + 360 * 6
  rot.value = base + (((want - (base % 360)) + 360) % 360)
  setTimeout(() => {
    spinning.value = false
    Object.assign(state.ld, { used: true, prize: k, applied: false })
    if (PRIZES[k].code) { state.ld.code = PRIZES[k].code; state.ld.expires = Date.now() + VOUCHER_MINUTES * 60000 } else { state.ld.code = null; state.ld.expires = 0 }
    saveLD()
    resultKey.value = k; fresh.value = true; view.value = 'result'
    if (PRIZES[k].code) { confetti(); botSay(`You won <b>${PRIZES[k].name}</b>! Your code is <b>${PRIZES[k].code}</b>. It lasts ${VOUCHER_MINUTES} minutes.`, [['apply', 'Apply to my build'], ...DEFAULT_CHIPS.slice(1)], true) }
    else botSay('Aww, good try! No prize this time, but I still like you.', null, true)
  }, reduce ? 200 : 5400)
}
const result = computed(() => {
  const p = PRIZES[resultKey.value] || PRIZES.none, v = activeVoucher()
  return {
    eyebrow: fresh.value ? 'Your prize' : 'You already spun',
    title: p.code && !v ? 'Your voucher expired' : p.title,
    text: !p.code ? 'No prize this time. Thanks for playing, and happy building!' : !v ? 'Watch out for the next Fat Cat event.' : state.ld.applied ? 'It is applied to your build total.' : 'Use the code at checkout, or apply it to your build now.',
    showCode: !!v, canApply: !!v && !state.ld.applied,
  }
})
function applyVoucher() {
  const v = activeVoucher()
  if (!v) return botSay("You don't have an active voucher right now.")
  state.ld.applied = true; saveLD(); state.ui.wheel = false
  if (!state.build) { toast(`${state.ld.code} saved. It will apply once you have a build.`); botSay(`Saved! Let's make your keyboard first, then ${state.ld.code} comes off the total.`); router.push('/swipe'); return }
  toast(`${state.ld.code} applied: ${v.name} your build.`)
  botSay(`Done! <b>${state.ld.code}</b> is applied. Your total now shows the discount.`)
}
function copyCode() { navigator.clipboard?.writeText(state.ld.code || '').then(() => toast('Code copied'), () => toast('Copy is blocked here. Select the code instead.')) }

/* ---------- confetti ---------- */
function confetti() {
  if (reduce || !canvas.value) return
  const c = canvas.value, x = c.getContext('2d'), W = (c.width = innerWidth), H = (c.height = innerHeight)
  c.hidden = false
  const cols = ['#3346FF', '#FFB020', '#F2A65A', '#41D39C', '#FF8B61', '#F7B8B0']
  const ps = Array.from({ length: 160 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 240, y: H * 0.45, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5, r: Math.random() * 7 + 5, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, s: (Math.random() - 0.5) * 0.4 }))
  let f = 0
  ;(function tick() {
    x.clearRect(0, 0, W, H)
    ps.forEach((p) => { p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.s; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore() })
    if (++f < 120) requestAnimationFrame(tick); else { x.clearRect(0, 0, W, H); c.hidden = true }
  })()
}
</script>

<template>
  <div v-show="!hiddenCat" class="kitty">
    <div v-if="chatOpen" class="chat lct-chat" role="dialog" aria-modal="true" aria-label="Chat with Biscuit">
      <header class="lct-chat__header">
        <span class="av lct-chat__av" v-html="CAT_SVG"></span>
        <div class="who"><b>Biscuit</b><span>Le Chaton Typers' fat cat</span></div>
        <button type="button" class="ic lct-chat__close" aria-label="Minimise chat" @click="chatOpen = false">–</button>
        <button type="button" class="ic" aria-label="Hide Biscuit" @click="hiddenCat = true">×</button>
      </header>
      <div ref="msgBox" class="msgs lct-chat__messages" aria-live="polite">
        <template v-for="m in msgs" :key="m.id">
          <div v-if="m.typing" class="msg bot typing"><i></i><i></i><i></i></div>
          <div v-else-if="m.who === 'me'" class="msg me lct-chat__msg">{{ m.html }}</div>
          <div v-else class="msg bot lct-chat__msg" v-html="m.html"></div>
        </template>
      </div>
      <div class="quick"><button v-for="c in chips" :key="c[0]" type="button" class="lct-chat__chip" @click="tapChip(c)">{{ c[1] }}</button></div>
      <form class="chatin" @submit.prevent="send">
        <button type="button" class="ui-btn" aria-label="Send a photo of a keyboard" title="Send a photo" :disabled="aiBusy" @click="pickPhoto">📷</button>
        <input ref="photoIn" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPhoto" />
        <input v-model="input" class="lct-chat__input-field" placeholder="Ask Biscuit…" autocomplete="off" aria-label="Message Biscuit" />
        <button class="ui-btn primary lct-chat__send" type="submit" :disabled="aiBusy">Send</button>
      </form>
    </div>
    <div v-if="tease && !chatOpen" class="tease">
      <button type="button" class="x" aria-label="Dismiss" @click="tease = false">×</button>
      <p>Psst! Spin my lucky wheel for up to <b>15% off</b> your build.</p>
      <button type="button" class="ui-btn primary" @click="tease = false; openWheel()">Spin now</button>
    </div>
    <button type="button" class="catbtn lct-mascot" :aria-label="chatOpen ? 'Close chat with Biscuit' : (badge ? 'Open chat with Biscuit (1 unread message)' : 'Open chat with Biscuit')" @click="chatOpen ? (chatOpen = false) : openChat()">
      <span v-html="CAT_SVG"></span><span v-if="badge" class="cat-badge">1</span>
    </button>
  </div>
  <button v-if="hiddenCat" type="button" class="pawtab" aria-label="Bring Biscuit back" @click="hiddenCat = false">
    <span v-html="CAT_SVG"></span>Biscuit
  </button>

  <div v-if="state.ui.wheel" class="ld-modal" role="dialog" aria-modal="true" aria-labelledby="ldTitle" @click.self="closeWheel" @keydown.esc="closeWheel">
    <div class="wheelbox">
      <button type="button" class="mclose" aria-label="Close lucky draw" @click="closeWheel">×</button>
      <div class="wheelwrap">
        <svg id="wheel" viewBox="-114 -114 228 228" aria-hidden="true" :style="{ transform: `rotate(${rot}deg)`, transitionDuration: reduce ? '.01s' : '5.2s' }">
          <circle r="112" fill="#15171C" />
          <circle v-for="b in bulbs" :key="b.i" :cx="b.x.toFixed(2)" :cy="b.y.toFixed(2)" r="3.2" :fill="b.i % 2 ? '#FFB020' : '#FFF4DA'" />
          <template v-for="s in slices" :key="s.key">
            <path :d="s.d" :fill="s.fill" stroke="#15171C" stroke-width="1.5" />
            <text :transform="s.tf" text-anchor="middle" dominant-baseline="central" :fill="s.ink" font-family="Unbounded, 'Arial Black', sans-serif" font-weight="700" font-size="11.5">{{ s.label }}</text>
          </template>
          <circle r="25" fill="#15171C" />
        </svg>
        <svg class="pointer" viewBox="0 0 44 48" aria-hidden="true"><path d="M5 5 H39 L22 43 Z" fill="#FFB020" stroke="#15171C" stroke-width="4" stroke-linejoin="round" /></svg>
        <button type="button" class="hub" aria-label="Spin the wheel" :disabled="spinning || view !== 'form'" @click="spin">SPIN</button>
        <span class="wheelcat" v-html="CAT_SVG"></span>
      </div>

      <div class="ldside">
        <div v-if="view === 'form'" style="display: flex; flex-direction: column; gap: 14px">
          <div class="eyebrow">Event · Fat Cat Lucky Draw</div>
          <h2 id="ldTitle">Fat Cat Lucky Draw</h2>
          <p>Spin Biscuit's wheel once to win up to <b>15% off</b> your keyboard build.</p>
          <div class="prizes"><span class="pz gold">15% off</span><span class="pz blue">10% off</span><span class="pz dark">S$5 off</span></div>
          <form id="ldF" novalidate @submit.prevent="spin">
            <label for="ldEmail">Email for your voucher code</label>
            <input id="ldEmail" ref="emailInput" v-model="email" type="email" placeholder="you@example.com" autocomplete="email" :disabled="spinning" />
            <p v-if="err" class="err">{{ err }}</p>
            <button class="ui-btn primary big" type="submit" :disabled="spinning">{{ spinning ? 'Spinning…' : 'Spin the wheel' }}</button>
          </form>
          <button type="button" class="linkbtn" @click="closeWheel">No thanks, I'll pay full price</button>
          <p class="fine">One spin per person. Vouchers last {{ VOUCHER_MINUTES }} minutes. Demo only: your email is not sent or saved.</p>
        </div>
        <div v-else style="display: flex; flex-direction: column; gap: 14px">
          <div class="eyebrow">{{ result.eyebrow }}</div>
          <h2 id="ldTitle">{{ result.title }}</h2>
          <p>{{ result.text }}</p>
          <div v-if="result.showCode" class="codebox"><span class="mono">{{ state.ld.code }}</span><button type="button" class="ui-btn" @click="copyCode">Copy</button></div>
          <p v-if="result.showCode" class="timer">Expires in {{ timeLeft() }}</p>
          <div class="ldacts">
            <button v-if="result.canApply" type="button" class="ui-btn primary" @click="applyVoucher">{{ state.build ? 'Apply to my build' : 'Start building with it' }}</button>
            <button type="button" class="ui-btn" @click="closeWheel">Back to building</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <canvas ref="canvas" id="confetti" hidden></canvas>
</template>
