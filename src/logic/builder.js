// Pure helpers: formatting, compatibility rules and the recommendation engine.
import { CATS, META, KEYS, ALLOC } from '../data/catalog.js'

export const money = (n) => 'S$' + Math.round(n).toLocaleString('en-SG')
export const money2 = (n) => {
  const r = Math.round(n * 100) / 100
  return 'S$' + r.toLocaleString('en-SG', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 })
}
export const signed = (n) => (n === 0 ? 'Same price' : (n > 0 ? '+' : '−') + 'S$' + Math.abs(Math.round(n)).toLocaleString('en-SG'))
export const total = (b) => CATS.reduce((s, c) => s + (b[c] ? b[c].price : 0), 0)
export const grams = (b) => CATS.reduce((s, c) => s + (b[c].grams || 0), 0)
export const kg = (g) => (g / 1000).toFixed(g < 1000 ? 2 : 1) + ' kg'
const cap = (s) => s[0].toUpperCase() + s.slice(1)

/* ---------- small drawings ---------- */
export function kbSVG(L) {
  const main = [[...Array(13).fill(1), 2], [1.5, ...Array(12).fill(1), 1.5], [1.75, ...Array(11).fill(1), 2.25], [2.25, ...Array(10).fill(1), 2.75], [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25]]
  const top = L === '60' ? 0 : 1.25, R = []
  main.forEach((r, ri) => { let x = 0; r.forEach((w) => { R.push([x, top + ri, w]); x += w }) })
  let W = 15
  if (L === '75') { for (let i = 0; i < 16; i++) R.push([i, 0, 1]); for (let r = 0; r < 5; r++) R.push([15, top + r, 1]); W = 16 }
  if (L === '100') {
    for (let i = 0; i < 15; i++) R.push([i, 0, 1])
    const nx = 15.5
    for (let i = 0; i < 3; i++) { R.push([nx + i, 0, 1]); R.push([nx + i, top, 1]); R.push([nx + i, top + 1, 1]); R.push([nx + i, top + 4, 1]) }
    R.push([nx + 1, top + 3, 1])
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) R.push([19.5 + c, top + r, 1])
    W = 23.5
  }
  const u = 10, H = top + 5, accent = L === '60' ? 0 : main.flat().length
  return `<svg class="kb" viewBox="-6 -6 ${W * u + 12} ${H * u + 12}" aria-hidden="true"><rect class="f" x="-5" y="-5" width="${W * u + 10}" height="${H * u + 10}" rx="6"/>${R.map(([x, y, w], i) => `<rect class="k ${i === accent ? 'a' : ''}" x="${x * u + 0.8}" y="${y * u + 0.8}" width="${w * u - 1.6}" height="${u - 1.6}" rx="1.6"/>`).join('')}</svg>`
}
export function curve(t) {
  const d = { linear: 'M6 25 L58 5', tactile: 'M6 25 L20 14 L25 9 L29 16 L58 5', clicky: 'M6 25 L20 13 L24 6 L26 18 L58 5', silent: 'M6 25 L50 9 Q56 7 58 7' }[t]
  return `<svg class="curve" viewBox="0 0 64 30" aria-hidden="true"><path class="ax" d="M4 27H62M4 27V2"/><path d="${d}"/></svg>`
}
export function visFor(key, v) {
  if (key === 'layout') return kbSVG(v)
  if (key === 'weight') { const n = { light: 1, normal: 2, heavy: 3 }[v]; return `<span class="bars">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}" style="height:${6 + i * 5}px"></i>`).join('')}</span>` }
  if (key === 'frame') return `<span class="sw ${v}"></span>`
  if (key === 'keycap') return `<span class="cap ${v}">A</span>`
  if (key === 'switch') return curve(v)
  return ''
}
export function tierFor(v) {
  if (v < 200) return ['Starter', 'A solid hot-swap board with good switches and PBT caps.']
  if (v < 400) return ['Sweet spot', 'Premium switches, nicer keycaps, foam and screw-in stabs.']
  if (v < 700) return ['Custom', 'Aluminium cases, wireless boards and top-tier switches.']
  return ['Endgame', 'Brass-weighted cases, the best switches and statement keycaps.']
}

/* ---------- parts ---------- */
export function spec(cat, o) {
  switch (cat) {
    case 'case': return `${o.frame === 'metal' ? 'Metal' : o.frame === 'pcb' ? 'PCB-style frame' : 'Plastic'} · about ${kg(o.grams)}${o.nobatt ? ' · no battery bay' : ''}`
    case 'plate': return `${cap(o.feel)} · ${o.grams} g`
    case 'pcb': return `${o.hot ? 'Hot-swap' : 'Solder only'} · ${o.wl ? '2.4 GHz, Bluetooth and wired' : 'Wired USB-C'}`
    case 'switches': return `${cap(o.type)} · ${o.force} · ${o.buy} switches`
    case 'keycaps': return `${cap(o.style)} · ${o.prof} profile`
    case 'stabs': return `Set of ${o.n} · ${o.id === 'stock' ? 'rattle more on long keys' : 'screw-in, less rattle'}`
    case 'foam': return o.p ? 'Fills hollow space, deeper sound' : 'Stock sound'
    case 'cable': return o.p ? 'Matches your build, detachable' : 'Usually comes with the PCB or case'
  }
  return ''
}
/** Why option o can't go in build b ('' if it fits). */
export function reason(cat, o, b) {
  if (cat === 'case' && o.nobatt && b.pcb && b.pcb.wl) return "No room for the wireless PCB's battery"
  if (cat === 'pcb' && o.wl && b.case && b.case.nobatt) return `No battery room in the ${b.case.name.toLowerCase()}`
  return ''
}
/** Swap out parts that no longer fit. `keep` is the part the user just chose. Returns messages. */
export function autoFix(b, CAT, keep) {
  const notes = []
  for (const cat of CATS) {
    if (cat === keep) continue
    const r = reason(cat, b[cat], b)
    if (!r) continue
    const opts = CAT[cat].filter((o) => !reason(cat, o, b))
    if (!opts.length) continue
    const old = b[cat]
    const pick = opts.reduce((a, o) => (Math.abs(o.price - old.price) < Math.abs(a.price - old.price) ? o : a))
    b[cat] = pick
    notes.push(`${META[cat].label} switched to ${pick.name}. ${r}.`)
  }
  return notes
}
/** Options that match the customer's swipe answers (falls back to all). */
export function preferred(cat, A, CAT) {
  let list = CAT[cat]
  const by = (fn) => { const f = list.filter(fn); if (f.length) list = f }
  if (cat === 'case') { if (A.frame) by((o) => o.frame === A.frame); if (A.weight) by((o) => o.w === A.weight) }
  if (cat === 'plate') {
    if (A.switch === 'silent' && A.weight !== 'heavy') by((o) => o.id === 'pcp')
    else if (A.weight) by((o) => o.w === A.weight)
  }
  if (cat === 'pcb' && A.budget >= 150) by((o) => o.hot)
  if (cat === 'switches' && A.switch) by((o) => o.type === A.switch)
  if (cat === 'keycaps' && A.keycap) by((o) => o.style === A.keycap)
  if (cat === 'foam' && A.switch === 'silent') by((o) => o.id !== 'none')
  return list
}
function pickTier(list, alloc) {
  const within = list.filter((o) => o.price <= alloc)
  if (!within.length) return list.reduce((a, o) => (o.price < a.price ? o : a))
  return within.reduce((a, o) => (o.price > a.price ? o : a))
}
/** The recommendation engine: allocate the budget, then upgrade/downgrade until it fits. */
export function recommend(A, CAT) {
  const b = {}, P = {}
  CATS.forEach((c) => { P[c] = preferred(c, A, CAT) })
  for (const c of CATS) b[c] = pickTier(P[c].filter((o) => !reason(c, o, b)), ALLOC[c] * A.budget)
  autoFix(b, CAT)
  const up = ['case', 'pcb', 'switches', 'keycaps', 'stabs', 'foam', 'cable', 'plate']
  const upgrade = () => {
    for (let i = 0; i < 60; i++) {
      let best = null
      for (const c of up) {
        const cur = b[c]
        const ups = P[c].filter((o) => o.price > cur.price && !reason(c, o, b)).sort((a, z) => a.price - z.price)
        if (!ups.length) continue
        const trial = { ...b, [c]: ups[0] }
        if (total(trial) > A.budget) continue
        const ratio = cur.price / Math.max(1, ALLOC[c] * A.budget)
        if (!best || ratio < best.ratio) best = { ratio, trial }
      }
      if (!best) break
      Object.assign(b, best.trial)
    }
  }
  upgrade()
  for (let i = 0; i < 60 && total(b) > A.budget; i++) {
    let best = null
    for (const c of CATS) {
      const cur = b[c]
      let downs = P[c].filter((o) => o.price < cur.price && !reason(c, o, b))
      if (!downs.length) downs = CAT[c].filter((o) => o.price < cur.price && !reason(c, o, b))
      if (!downs.length) continue
      const pick = downs.sort((a, z) => z.price - a.price)[0]
      const ratio = cur.price / Math.max(1, ALLOC[c] * A.budget)
      if (!best || ratio > best.ratio) best = { ratio, c, pick }
    }
    if (!best) break
    b[best.c] = best.pick
  }
  upgrade()
  return b
}
export function bestFit(cat, CAT, b, rec) {
  const ok = CAT[cat].filter((o) => !reason(cat, o, b))
  if (ok.includes(rec[cat])) return rec[cat]
  return ok.reduce((a, o) => (Math.abs(o.price - rec[cat].price) < Math.abs(a.price - rec[cat].price) ? o : a))
}
export function whyText(cat, b, A) {
  const L = A.layout || '75'
  switch (cat) {
    case 'case': return `The case sets most of the weight, look and sound. ${A.frame === 'metal' ? 'Aluminium gives a dense, premium feel.' : A.frame === 'pcb' ? 'Open and sandwich frames show off the board and keep it slim.' : A.frame === 'plastic' ? 'Plastic keeps it light and gives a warmer, rounder sound.' : 'Pick the material you like the look of.'}`
    case 'plate': return 'The plate holds the switches. Softer plates flex and sound deeper; brass and aluminium feel stiffer and brighter.'
    case 'pcb': return 'The circuit board. Hot-swap lets you pull and change switches without soldering. Wireless adds 2.4 GHz and Bluetooth with a built-in battery.'
    case 'switches': return `Your ${L}% board has ${KEYS[L]} keys, so you need ${b.switches.buy} switches (sold in packs of 10). The spares cover any duds.`
    case 'keycaps': return 'PBT keeps its texture and does not go shiny. Profile changes the shape: Cherry is low and sculpted, XDA and MOA are flatter and rounder.'
    case 'stabs': return `Your spacebar, shifts, enter and backspace${L === '100' ? " plus the numpad's big keys" : ''} need ${b.stabs.n} stabilisers. Screw-in stabs rattle less.`
    case 'foam': return 'Foam fills the hollow space inside the case. It removes pinging and gives a deeper, more muted sound.'
    case 'cable': return 'Any USB-C cable works. Coiled cables are for looks and match your keycap colours.'
  }
  return ''
}

