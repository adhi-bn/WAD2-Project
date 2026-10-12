// Domain seed for a Build (see CONTEXT.md): the pure rules the app builds on.
//
// Vocabulary: a Build is one Part per slot. The three essential slots here are
// the Barebones kit, switches, and keycaps. The objects carry the physical
// fields the rules need:
//   barebones: { socket: 'hotswap' | 'solder', layout: 'ansi' | 'iso', price }
//   switches:  { pin: '5-pin' | '3-pin', price }
//   keycaps:   { layout: 'ansi' | 'iso', price }

/**
 * Whether switches, keycaps, and barebones fit together.
 * @returns {{ compatible: boolean, reasons: string[] }}
 */
export function checkCompatibility({ barebones, switches, keycaps } = {}) {
  const reasons = []

  // All three essential slots must be chosen before anything can "fit".
  if (!barebones) reasons.push('Missing barebones kit')
  if (!switches) reasons.push('Missing switches')
  if (!keycaps) reasons.push('Missing keycaps')
  if (reasons.length > 0) return { compatible: false, reasons }

  // Genuine rule 1: a hot-swap socket needs PCB-mount (5-pin) switches.
  // A solder socket accepts either pin count.
  if (barebones.socket === 'hotswap' && switches.pin !== '5-pin') {
    reasons.push(`Hot-swap barebones needs 5-pin switches, got ${switches.pin}`)
  }

  // Genuine rule 2: keycaps are cut for one layout; they must match the barebones.
  if (keycaps.layout !== barebones.layout) {
    reasons.push(
      `Keycap layout ${keycaps.layout} does not match barebones layout ${barebones.layout}`,
    )
  }

  return { compatible: reasons.length === 0, reasons }
}

/**
 * Live price total of a Build compared against the user's limit.
 * A missing limit means "no limit chosen yet", treated as within budget.
 * @returns {{ total: number, withinBudget: boolean }}
 */
export function computeBudget(parts = [], limit) {
  const total = parts.reduce((sum, part) => sum + (part?.price ?? 0), 0)
  const withinBudget = limit == null ? true : total <= limit
  return { total, withinBudget }
}
