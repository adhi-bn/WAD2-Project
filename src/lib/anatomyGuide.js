/**
 * @fileoverview Canonical copy and metadata for the guided part-by-part keyboard anatomy.
 * Steers users through the 6 physical layers of the keyboard with synchronized
 * 3D highlighting, layer focus, and beginner-friendly explanations per ADR-0003.
 * Adheres strictly to CONTEXT.md domain vocabulary (Part, Barebones kit, Exploded anatomy).
 */

/**
 * Introduction card copy for the guided exploded anatomy section.
 */
export const ANATOMY_GUIDE_INTRO = Object.freeze({
  eyebrow: 'Know your keyboard',
  title: 'Every keyboard is six physical layers.',
  summary:
    'Scroll to take this build apart. A Barebones kit bundles the case, plate, PCB, and gasket foam; you choose the switches and keycaps in the builder.',
})

/**
 * Outro card copy for the guided exploded anatomy section.
 */
export const ANATOMY_GUIDE_OUTRO = Object.freeze({
  eyebrow: 'Back together',
  title: 'Now put it together your way.',
  summary:
    'Choose your Barebones kit, 5-pin switches, and keycaps in the keyboard builder to see total price and compatibility in real time.',
})

/**
 * 6 guided physical steps matching ANATOMY_LAYERS in top-to-bottom sequence.
 *
 * @type {ReadonlyArray<{
 *   id: 'keycaps' | 'switches' | 'plate' | 'pcb' | 'foam' | 'case',
 *   eyebrow: string,
 *   title: string,
 *   summary: string,
 *   isBarebonesInternals: boolean,
 *   facts: ReadonlyArray<[string, string]>
 * }>}
 */
export const ANATOMY_GUIDE_STEPS = Object.freeze([
  {
    id: 'keycaps',
    eyebrow: 'Layer 1 of 6 · top',
    title: 'Keycaps',
    summary:
      'What your fingers touch, and most of the visual identity. PBT retains its textured matte feel, while ABS offers vivid dye colors.',
    isBarebonesInternals: false,
    facts: Object.freeze([
      ['Profiles', 'Cherry, XDA, and MOA sculpts'],
      ['You choose', 'Colors, novelty accents, and profiles'],
    ]),
  },
  {
    id: 'switches',
    eyebrow: 'Layer 2 of 6',
    title: '5-pin Switches',
    summary:
      'One seated under every key. Mechanical switches decide keystroke travel, actuation weight, and tactile actuation profile.',
    isBarebonesInternals: false,
    facts: Object.freeze([
      ['Types', 'Linear, tactile, clicky, and silent'],
      ['75% board', '81 switches in this compact matrix'],
    ]),
  },
  {
    id: 'plate',
    eyebrow: 'Layer 3 of 6',
    title: 'Positioning Plate',
    summary:
      'Holds every switch securely aligned over the circuit board. Softer materials flex under typing, while metal plates feel firm.',
    isBarebonesInternals: true,
    facts: Object.freeze([
      ['Soft', 'Polycarbonate and FR4 composite'],
      ['Stiff', 'Aluminium and solid brass'],
    ]),
  },
  {
    id: 'pcb',
    eyebrow: 'Layer 4 of 6',
    title: 'Hot-swap PCB',
    summary:
      'The printed circuit board detecting key presses. Hot-swap sockets let you push switches into place without any soldering iron.',
    isBarebonesInternals: true,
    facts: Object.freeze([
      ['Hot-swap', 'Swap 5-pin switches anytime with zero soldering'],
      ['Connectivity', 'Wired USB-C and low-latency wireless modes'],
    ]),
  },
  {
    id: 'foam',
    eyebrow: 'Layer 5 of 6',
    title: 'Multi-Layer Gasket Stack',
    summary:
      'Layered sound dampening sheets filling interior hollow space. Absorbs vibration and provides internal structural cushioning and vibration absorption.',
    isBarebonesInternals: true,
    facts: Object.freeze([
      ['Sound', 'PORON foam sheets and IXPE switch pads cushion mechanical impact'],
      ['Layers', 'Plate cotton, IXPE underpad, and case bottom cotton'],
    ]),
  },
  {
    id: 'case',
    eyebrow: 'Layer 6 of 6 · bottom',
    title: 'Case & Frame',
    summary:
      'The outer chassis setting the desk weight, typing angle, and base sound reverberation of your entire keyboard build.',
    isBarebonesInternals: true,
    facts: Object.freeze([
      ['Light', 'Molded ABS or compact composite chassis'],
      ['Heavy', 'CNC anodized aluminium with solid internal weight'],
    ]),
  },
])
