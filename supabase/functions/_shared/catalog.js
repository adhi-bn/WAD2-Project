// Parts catalogue and swipe questions.
// Prices are sample figures in SGD for the 60% layout; catalog() scales them for 75% and 100%.
// This file is pure JavaScript with no imports. supabase/functions/_shared/catalog.js is a copy
// that the checkout function uses to price orders on the server, so keep the two in sync.

export const BASE = {
  case: [
    { id: 'abs', name: 'ABS plastic case', frame: 'plastic', w: 'light', g: 380, p: 39 },
    { id: 'fr4', name: 'Open-frame FR4 case', frame: 'pcb', w: 'light', g: 320, p: 55, nobatt: true },
    { id: 'sandwich', name: 'Acrylic sandwich case', frame: 'pcb', w: 'normal', g: 720, p: 75, nobatt: true },
    { id: 'pc', name: 'Frosted polycarbonate case', frame: 'plastic', w: 'normal', g: 650, p: 85 },
    { id: 'alu', name: 'CNC aluminium case', frame: 'metal', w: 'normal', g: 1250, p: 179 },
    { id: 'alubrass', name: 'CNC aluminium case with brass weight', frame: 'metal', w: 'heavy', g: 1900, p: 269 },
  ],
  plate: [
    { id: 'pcp', name: 'Polycarbonate plate', w: 'light', g: 55, p: 19, feel: 'soft and flexy' },
    { id: 'fr4p', name: 'FR4 plate', w: 'normal', g: 70, p: 19, feel: 'balanced flex' },
    { id: 'alp', name: 'Aluminium plate', w: 'normal', g: 120, p: 25, feel: 'firm' },
    { id: 'brp', name: 'Brass plate', w: 'heavy', g: 320, p: 49, feel: 'stiff and solid' },
  ],
  pcb: [
    { id: 'solder', name: 'Solder PCB, wired USB-C', g: 90, p: 29, hot: false, wl: false },
    { id: 'hs', name: 'Hot-swap PCB, wired USB-C', g: 95, p: 45, hot: true, wl: false },
    { id: 'hsrgb', name: 'Hot-swap PCB with south-facing RGB', g: 100, p: 59, hot: true, wl: false },
    { id: 'tri', name: 'Tri-mode wireless hot-swap PCB', g: 150, p: 95, hot: true, wl: true },
  ],
  switches: [
    { id: 'gyellow', name: 'Gateron Milky Yellow Pro', type: 'linear', ps: 0.25, force: '50 g', sample: '/switch-audio/gateron-milky-yellows.m4a' },
    { id: 'cream', name: 'Akko V3 Cream Yellow Pro', type: 'linear', ps: 0.32, force: '50 g', sample: '/switch-audio/akko-cream-yellows.m4a' },
    { id: 'oilking', name: 'Gateron Oil King', type: 'linear', ps: 0.65, force: '55 g', sample: '/switch-audio/gateron-oil-kings.m4a' },
    { id: 'gsilent', name: 'Gateron Silent Red', type: 'silent', ps: 0.35, force: '45 g', sample: '/switch-audio/gateron-silent-reds.m4a' },
    { id: 'shrimp', name: 'Durock Shrimp Silent', type: 'silent', ps: 0.7, force: '62 g', sample: '/switch-audio/durock-silent.m4a' },
    { id: 'u4', name: 'Gazzew Boba U4 silent tactile', type: 'silent', ps: 0.8, force: '62 g', sample: '/switch-audio/gazzew-boba-u4.m4a' },
    { id: 'gbrown', name: 'Gateron Brown Pro', type: 'tactile', ps: 0.25, force: '55 g', sample: '/switch-audio/gateron-gpro-brown.m4a' },
    { id: 'u4t', name: 'Gazzew Boba U4T', type: 'tactile', ps: 0.8, force: '62 g', sample: '/switch-audio/gazzew-boba.m4a' },
    { id: 'panda', name: 'Glorious Panda', type: 'tactile', ps: 0.85, force: '67 g', sample: '/switch-audio/glorious-panda.m4a' },
    { id: 'gblue', name: 'Gateron Blue Pro', type: 'clicky', ps: 0.25, force: '60 g', sample: '/switch-audio/gateron-gpro-blue.m4a' },
    { id: 'jade', name: 'Kailh Box Jade', type: 'clicky', ps: 0.45, force: '50 g', sample: '/switch-audio/kailh-jades.m4a' },
  ],
  keycaps: [
    { id: 'blank', name: 'Blank PBT keycap set', style: 'plain', p: 29, prof: 'Cherry' },
    { id: 'plainpbt', name: 'Dye-sub PBT keycap set', style: 'plain', p: 45, prof: 'Cherry' },
    { id: 'matte', name: 'Textured matte PBT keycap set', style: 'textured', p: 49, prof: 'XDA' },
    { id: 'theme', name: 'Themed PBT keycap set', style: 'styled', p: 69, prof: 'Cherry' },
    { id: 'stone', name: 'Stone-texture PBT keycap set', style: 'textured', p: 85, prof: 'MOA' },
    { id: 'dshot', name: 'Double-shot ABS keycap set', style: 'styled', p: 129, prof: 'Cherry' },
  ],
  stabs: [
    { id: 'stock', name: 'Stock plate-mount stabilisers', pp: 1.2 },
    { id: 'durock', name: 'Durock V2 screw-in stabilisers', pp: 5.8 },
    { id: 'tx', name: 'TX AP screw-in stabilisers', pp: 9 },
  ],
  foam: [
    { id: 'none', name: 'No extra dampening', p: 0, g: 0 },
    { id: 'basic', name: 'Case foam and switch pad', p: 15, g: 40 },
    { id: 'full', name: 'Full foam kit with PE sheet and tape mod', p: 32, g: 60 },
  ],
  cable: [
    { id: 'std', name: 'Standard USB-C cable', p: 0 },
    { id: 'coil', name: 'Coiled USB-C cable with aviator connector', p: 39 },
    { id: 'custom', name: 'Custom sleeved coiled cable', p: 75 },
  ],
}

export const CATS = ['case', 'plate', 'pcb', 'switches', 'keycaps', 'stabs', 'foam', 'cable']
export const META = {
  case: { label: 'Case', short: 'Case' },
  plate: { label: 'Plate', short: 'Plate' },
  pcb: { label: 'PCB', short: 'PCB' },
  switches: { label: 'Switches', short: 'Switch' },
  keycaps: { label: 'Keycaps', short: 'Caps' },
  stabs: { label: 'Stabilisers', short: 'Stabs' },
  foam: { label: 'Sound dampening', short: 'Foam' },
  cable: { label: 'Cable', short: 'Cable' },
}
export const SIZE = { 60: 1, 75: 1.2, 100: 1.5 }
export const KEYS = { 60: 61, 75: 84, 100: 104 }
export const STABS = { 60: 5, 75: 5, 100: 8 }
// Share of the budget each part gets before the recommender upgrades or downgrades.
export const ALLOC = { case: 0.33, plate: 0.05, pcb: 0.15, switches: 0.18, keycaps: 0.18, stabs: 0.04, foam: 0.03, cable: 0.04 }

/** Price and weight every option for one layout. */
export function catalog(L) {
  const f = SIZE[L], keys = KEYS[L], buy = Math.ceil(keys / 10) * 10
  return {
    case: BASE.case.map((o) => ({ ...o, price: Math.round(o.p * f), grams: Math.round(o.g * f) })),
    plate: BASE.plate.map((o) => ({ ...o, price: Math.round(o.p * f), grams: Math.round(o.g * f) })),
    pcb: BASE.pcb.map((o) => ({ ...o, price: Math.round(o.p * f), grams: Math.round(o.g * f) })),
    switches: BASE.switches.map((o) => ({ ...o, price: Math.round(o.ps * buy), grams: Math.round(keys * 5.5), buy })),
    keycaps: BASE.keycaps.map((o) => ({ ...o, price: Math.round(o.p * (L === '100' ? 1.1 : 1)), grams: Math.round(keys * 2.6) })),
    stabs: BASE.stabs.map((o) => ({ ...o, price: Math.round(o.pp * STABS[L]), grams: 0, n: STABS[L] })),
    foam: BASE.foam.map((o) => ({ ...o, price: Math.round(o.p * f), grams: Math.round(o.g * f) })),
    cable: BASE.cable.map((o) => ({ ...o, price: o.p, grams: 0 })),
  }
}

export const QUESTIONS = [
  { key: 'layout', eyebrow: 'Layout', title: 'Pick your layout', opts: [
    { v: '60', t: '60%', d: 'Compact. No arrows or F-row. More room for your mouse.' },
    { v: '75', t: '75%', d: 'Arrows and F-row, still compact. The popular middle.' },
    { v: '100', t: '100%', d: 'Full size with numpad. Best for numbers and spreadsheets.' } ] },
  { key: 'weight', eyebrow: 'Weight', title: 'How heavy should it feel?', opts: [
    { v: 'light', t: 'Light', d: 'Easy to carry to class or the office.' },
    { v: 'normal', t: 'Normal', d: 'Stays put on the desk, still portable.' },
    { v: 'heavy', t: 'Heavy', d: 'Solid and premium. It will not move.' } ] },
  { key: 'frame', eyebrow: 'Frame', title: 'Choose your frame', opts: [
    { v: 'metal', t: 'Metal', d: 'CNC aluminium. Premium, cool to the touch.' },
    { v: 'pcb', t: 'PCB', d: 'Open or sandwich frame that shows off the board.' },
    { v: 'plastic', t: 'Plastic', d: 'ABS or polycarbonate. Light, affordable, warmer sound.' } ] },
  { key: 'keycap', eyebrow: 'Keycaps', title: 'Keycap style', opts: [
    { v: 'plain', t: 'Plain', d: 'Clean single-colour sets with simple legends.' },
    { v: 'styled', t: 'Styled', d: 'Themed colourways and bold designs.' },
    { v: 'textured', t: 'Textured', d: 'Matte or grainy finish you can feel.' } ] },
  { key: 'switch', eyebrow: 'Switches', title: 'How should the keys feel?', opts: [
    { v: 'silent', t: 'Silent', d: 'Dampened and quiet for shared spaces.' },
    { v: 'linear', t: 'Linear', d: 'Smooth, straight press. Popular for gaming.' },
    { v: 'tactile', t: 'Tactile', d: 'A bump you feel as the key registers.' },
    { v: 'clicky', t: 'Clicky', d: 'A bump plus a loud click on every press.' } ] },
  { key: 'budget', eyebrow: 'Budget', title: 'Set your budget', type: 'budget' },
]

/**
 * Price a build from its part ids, the same way the app does. Throws on an unknown id.
 * Used by the checkout function so the charge never trusts prices sent from the browser.
 */
export function priceIds(L, ids) {
  const options = catalog(L)
  const lines = {}
  let total = 0
  for (const c of CATS) {
    const o = options[c].find((x) => x.id === ids[c])
    if (!o) throw new Error(`Unknown ${c} id "${ids[c]}"`)
    lines[c] = o
    total += o.price
  }
  return { total, lines }
}
