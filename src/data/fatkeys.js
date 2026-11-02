// The three FATKEY prebuilt keyboards shown on the home page.
// Each one picks a part id per category from src/data/catalog.js, so prices always come from the catalogue.
// All three are 75% layouts.
export const FATKEYS = [
  {
    id: 'fatkey',
    image: '/fatkey/fatkey.png',
    name: 'FATKEY',
    tagline: 'Compact and friendly. Plastic case, quiet switches and a soft, dampened sound.',
    layout: '75',
    look: { case: '#2a2c33', caseRough: 0.7, keycaps: '#e6e8ec', plate: '#f4f1e8', plateOpacity: 0.7 },
    part_ids: { case: 'abs', plate: 'pcp', pcb: 'hs', switches: 'gsilent', keycaps: 'plainpbt', stabs: 'durock', foam: 'basic', cable: 'std' },
  },
  {
    id: 'fatkey-pro',
    image: '/fatkey/fatkey-pro.png',
    name: 'FATKEY PRO',
    tagline: 'Clear see-through case, tactile switches and a full foam kit for a richer sound.',
    layout: '75',
    look: { case: '#bfe0f5', caseRough: 0.2, caseOpacity: 0.55, keycaps: '#3346FF', plate: '#ff8fd0', plateOpacity: 0.6 },
    part_ids: { case: 'pc', plate: 'fr4p', pcb: 'hsrgb', switches: 'panda', keycaps: 'kanagawa', stabs: 'durock', foam: 'full', cable: 'coil' },
  },
  {
    id: 'fatkey-pro-max',
    image: '/fatkey/fatkey-pro-max.png',
    name: 'FATKEY PRO MAX',
    tagline: 'Heavy CNC aluminium with a brass weight, smooth linear switches and wireless tri-mode.',
    layout: '75',
    look: { case: '#c9a24a', caseMetal: 1, caseRough: 0.3, keycaps: '#15171C', plate: '#ffffff', plateOpacity: 0.5 },
    part_ids: { case: 'alubrass', plate: 'alp', pcb: 'tri', switches: 'oilking', keycaps: 'dshot', stabs: 'tx', foam: 'full', cable: 'custom' },
  },
]
