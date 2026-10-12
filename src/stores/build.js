import { computed, reactive } from 'vue'
import { checkCompatibility, computeBudget } from '../domain/build.js'

// Reactive Build store, no Pinia. State is the three essential slots plus the
// user's Budget limit; compatibility and budget are derived from the domain
// functions so the UI never re-implements the rules.
const SLOTS = ['barebones', 'switches', 'keycaps']

// ponytail: module-level singleton (one Build at a time); swap for Pinia if
// multiple saved builds or SSR enter scope.
export const build = reactive({
  barebones: null,
  switches: null,
  keycaps: null,
  limit: null,
})

export const compatibility = computed(() =>
  checkCompatibility({
    barebones: build.barebones,
    switches: build.switches,
    keycaps: build.keycaps,
  }),
)

export const budget = computed(() =>
  computeBudget([build.barebones, build.switches, build.keycaps].filter(Boolean), build.limit),
)

export function setSlot(slot, part) {
  if (SLOTS.includes(slot)) build[slot] = part
}

export function setLimit(limit) {
  build.limit = limit
}
