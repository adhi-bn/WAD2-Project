<script setup>
// 3D keyboard built with Three.js.
// mode="home": faint background that explodes as you scroll the home page.
// mode="know": full teardown; highlights the layer whose card is in the middle of the screen.
// mode="off":  hidden and not rendering.
// It reads the page's sections by selector: '#home .hs-end' and '#know .ks'.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({ mode: { type: String, default: 'off' } })
const canvas = ref(null)
const labHost = ref(null)
const failed = ref(false)

let renderer, scene, camera, raf = 0, explode = 0, W0 = 1, H0 = 1, mx = 0, my = 0, t0 = 0
const LAYERS = [
  { key: 'keycaps', name: 'Keycaps', off: 7.4, ay: 1.6 },
  { key: 'switches', name: 'Switches', off: 5.5, ay: 1.2 },
  { key: 'plate', name: 'Plate', off: 3.9, ay: 1.0 },
  { key: 'pcb', name: 'PCB', off: 2.5, ay: 0.7 },
  { key: 'foam', name: 'Foam', off: 1.25, ay: 0.5 },
  { key: 'case', name: 'Case', off: 0, ay: 0.9 },
]
const groups = {}, mats = {}
const W = 16, D = 6.25
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const absTop = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : 1e9)

function buildScene() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300)
  // Three r155+ uses physical light units, so intensities are scaled by PI.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3040, 0.55 * Math.PI))
  const key = new THREE.DirectionalLight(0xffffff, 0.8 * Math.PI); key.position.set(9, 16, 12); scene.add(key)
  const rim = new THREE.DirectionalLight(0x8ea0ff, 0.45 * Math.PI); rim.position.set(-12, 6, -10); scene.add(rim)
  const warm = new THREE.PointLight(0xffb070, 0.35 * Math.PI, 80, 0); warm.position.set(6, 4, 8); scene.add(warm)

  // Draw order for see-through layers: case first, keycaps last, so upper layers blend over lower ones
  // instead of a plate hiding switches drawn before it.
  LAYERS.forEach((L, i) => { groups[L.key] = new THREE.Group(); groups[L.key].renderOrder = LAYERS.length - i; scene.add(groups[L.key]); mats[L.key] = [] })
  const mat = (l, c, o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.05 }, o || {})); mats[l].push(m); return m }
  const box = (l, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); groups[l].add(o); return o }

  // 75% layout in key units.
  const rows = [[...Array(13).fill(1), 2], [1.5, ...Array(12).fill(1), 1.5], [1.75, ...Array(11).fill(1), 2.25], [2.25, ...Array(10).fill(1), 2.75], [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25]]
  const KEYS = []
  for (let i = 0; i < 16; i++) KEYS.push({ x: i, r: 0, w: 1 })
  rows.forEach((row, ri) => { let x = 0; row.forEach((w) => { KEYS.push({ x, r: 1.25 + ri, w }); x += w }); KEYS.push({ x: 15, r: 1.25 + ri, w: 1 }) })
  const cx = W / 2, cz = D / 2

  const caseM = mat('case', 0x2a2d35, { roughness: 0.45, metalness: 0.25 })
  box('case', W + 0.9, 0.35, D + 0.9, caseM, 0, 0.175, 0)
  box('case', W + 0.9, 0.95, 0.3, caseM, 0, 0.6, -(D + 0.6) / 2)
  box('case', W + 0.9, 0.75, 0.3, caseM, 0, 0.5, (D + 0.6) / 2)
  box('case', 0.3, 0.9, D + 0.3, caseM, -(W + 0.6) / 2, 0.55, 0)
  box('case', 0.3, 0.9, D + 0.3, caseM, (W + 0.6) / 2, 0.55, 0)
  box('foam', W - 0.1, 0.18, D - 0.1, mat('foam', 0xf1d7c4, { roughness: 1 }), 0, 0.48, 0)
  box('pcb', W, 0.08, D, mat('pcb', 0x1d6a49, { roughness: 0.6 }), 0, 0.66, 0)
  const gold = mat('pcb', 0xd8b44c, { roughness: 0.3, metalness: 0.8 })
  KEYS.forEach((k) => box('pcb', 0.16, 0.02, 0.16, gold, k.x + k.w / 2 - cx, 0.71, k.r + 0.5 - cz))
  box('pcb', 1.1, 0.12, 0.8, mat('pcb', 0x15171c, { roughness: 0.4 }), 3.2, 0.74, -2.6)
  box('plate', W + 0.1, 0.07, D + 0.1, mat('plate', 0xb9bec7, { roughness: 0.32, metalness: 0.7 }), 0, 0.98, 0)
  const hs = mat('switches', 0x2b2f38, { roughness: 0.5 }), ht = mat('switches', 0xe9e6df, { roughness: 0.6 }), st = mat('switches', 0xf2a65a, { roughness: 0.5 })
  KEYS.forEach((k) => {
    const x = k.x + k.w / 2 - cx, z = k.r + 0.5 - cz
    box('switches', 0.6, 0.22, 0.6, hs, x, 0.9, z)
    box('switches', 0.58, 0.16, 0.58, ht, x, 1.09, z)
    box('switches', 0.16, 0.16, 0.16, st, x, 1.25, z)
  })
  // Keycaps are square frustums: a 4-sided cylinder turned 45 degrees.
  const capGeo = new THREE.CylinderGeometry(0.72 / Math.SQRT2, 0.94 / Math.SQRT2, 0.46, 4, 1); capGeo.rotateY(Math.PI / 4)
  const cC = mat('keycaps', 0xe2dbcf, { roughness: 0.75 }), cG = mat('keycaps', 0xb8bec9, { roughness: 0.7 })
  const cB = mat('keycaps', 0x3346ff, { roughness: 0.6 }), cA = mat('keycaps', 0xffb020, { roughness: 0.6 })
  KEYS.forEach((k, i) => {
    const m = i === 0 ? cA : k.w >= 6 ? cB : k.w > 1 || k.r === 0 || k.x === 15 ? cG : cC
    const o = new THREE.Mesh(capGeo, m)
    o.position.set(k.x + k.w / 2 - cx, 1.56, k.r + 0.5 - cz)
    o.scale.x = (k.w - 0.06) / 0.94
    groups.keycaps.add(o)
  })
  LAYERS.forEach((L) => { const d = document.createElement('div'); d.className = 'l3d'; d.textContent = L.name; labHost.value.appendChild(d); L.el = d; L.alpha = 1 })
}

function target() {
  const vh = innerHeight, y = scrollY
  if (props.mode === 'home') {
    const end = absTop(document.querySelector('#home .hs-end'))
    return sm(vh * 0.2, vh * 1.05, y) * (1 - sm(end - vh * 0.85, end - vh * 0.2, y))
  }
  const ks = document.querySelectorAll('#know .ks')
  if (!ks.length) return 0
  const last = absTop(ks[ks.length - 1])
  return sm(0, vh * 0.85, y) * (1 - sm(last - vh * 0.9, last - vh * 0.05, y))
}
function activeLayer() {
  if (props.mode !== 'know') return -1
  const mid = innerHeight / 2
  let best = -1, bd = 1e9
  document.querySelectorAll('#know .ks').forEach((s) => {
    const r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid)
    if (d < bd) { bd = d; best = +s.dataset.layer }
  })
  return best
}
function size() { W0 = innerWidth; H0 = innerHeight; renderer.setSize(W0, H0, false); camera.aspect = W0 / H0 }
const onResize = () => { if (props.mode !== 'off' && renderer) size() }
const onPointer = (e) => { mx = e.clientX / W0 - 0.5; my = e.clientY / H0 - 0.5 }
const v3 = new THREE.Vector3()

function frame(now) {
  if (props.mode === 'off') { raf = 0; return }
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now
  explode += (target() - explode) * (reduce ? 1 : Math.min(1, dt * 6))
  const e = explode, act = activeLayer(), vh = innerHeight
  LAYERS.forEach((L, i) => {
    groups[L.key].position.y = L.off * e
    const want = act >= 0 && act !== i ? 0.16 : 1
    L.alpha += (want - L.alpha) * Math.min(1, dt * 8)
    mats[L.key].forEach((m) => { m.transparent = L.alpha < 0.99; m.opacity = L.alpha; m.depthWrite = L.alpha > 0.5 })
  })
  // Framing: on Home the board sits low behind the hero, then lifts as it explodes.
  let ox = 0, oy = 0
  if (props.mode === 'know') { if (W0 > 860) ox = -0.17; else oy = W0 > 560 ? 0.12 : 0.2 }
  else { if (W0 > 860) ox = -0.14 * e; oy = (W0 > 560 ? -0.3 : -0.26) * (1 - e) + (W0 > 560 ? 0.04 : 0.2) * e }
  camera.setViewOffset(W0, H0, ox * W0, oy * H0, W0, H0)
  const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect)
  const R = Math.max(37 + 5 * e, (11 + 2 * e) / Math.tan(hHalf))
  const t = reduce ? 0 : now / 1000
  const az = THREE.MathUtils.degToRad(22 + 14 * e + mx * 10 + Math.sin(t * 0.25) * 3)
  const pol = THREE.MathUtils.degToRad(52 + 14 * e + my * 6)
  const ty = 0.9 + 3.6 * e
  camera.position.set(R * Math.sin(pol) * Math.sin(az), ty + R * Math.cos(pol), R * Math.sin(pol) * Math.cos(az))
  camera.lookAt(0, ty, 0)
  camera.updateProjectionMatrix()
  canvas.value.style.opacity = props.mode === 'home' ? 0.55 + 0.45 * sm(0, vh * 0.6, scrollY) : 1
  renderer.render(scene, camera)
  // Where each label should sit on screen, before spacing.
  const pos = LAYERS.map((L, i) => {
    v3.set(-W / 2 - 0.7, L.ay + L.off * e, 0).project(camera)
    return { i, x: (v3.x * 0.5 + 0.5) * W0, y: (-v3.y * 0.5 + 0.5) * H0 }
  })
  // Keep labels apart: if two sit closer than the label height, push the lower one down.
  const byY = [...pos].sort((a, b) => a.y - b.y)
  for (let k = 1; k < byY.length; k++) if (byY[k].y - byY[k - 1].y < 26) byY[k].y = byY[k - 1].y + 26
  pos.forEach(({ i, x, y }) => {
    const L = LAYERS[i]
    L.el.style.transform = `translate(${x - 10}px,${y}px) translate(-100%,-50%)`
    L.el.style.opacity = e > 0.55 ? (act === i ? 1 : W0 < 560 && props.mode === 'know' ? 0 : act < 0 ? 0.9 : 0.45) : 0
    L.el.classList.toggle('on', act === i)
  })
  raf = requestAnimationFrame(frame)
}
function start() {
  if (!renderer || props.mode === 'off') return
  size()
  explode = target()
  if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(frame) }
}

onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true })
  } catch (e) { failed.value = true; return }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  buildScene()
  addEventListener('resize', onResize)
  addEventListener('pointermove', onPointer)
  // Wait a frame so the new page's sections exist before measuring them.
  requestAnimationFrame(start)
})
watch(() => props.mode, () => requestAnimationFrame(start))
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  removeEventListener('resize', onResize)
  removeEventListener('pointermove', onPointer)
  renderer && renderer.dispose()
})
</script>

<template>
  <canvas ref="canvas" class="gl3d" aria-hidden="true" v-show="mode !== 'off' && !failed"></canvas>
  <div ref="labHost" class="labels3d" aria-hidden="true" v-show="mode !== 'off' && !failed"></div>
</template>
