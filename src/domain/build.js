// Domain seed for a Build (see CONTEXT.md): the pure rules the app builds on.
//
// Vocabulary: a Build is one Part per slot. The three essential slots here are
// the Barebones kit, switches, and keycaps. The objects carry the physical
// fields the rules need:
//   barebones: { socket: 'hotswap' | 'solder', layout: 'ansi' | 'iso', price }
//   switches:  { pin: '5-pin' | '3-pin', price }
//   keycaps:   { layout: 'ansi' | 'iso', price }
// A keycap's layout is the single layout that set is declared to cover, not a
// claim about every keycap set.

/**
 * Whether switches, keycaps, and barebones fit together, plus why not.
 * Missing slots are incomplete; known clashes among present slots are
 * incompatible. Both are reported independently so a partial selection still
 * surfaces the mismatches it already proves.
 * @returns {{ compatible: boolean, reasons: string[], incomplete: boolean, incompatible: boolean }}
 */
export function checkCompatibility({ barebones, switches, keycaps } = {}) {
  const reasons = []
  let incomplete = false
  let incompatible = false

  // All three essential slots are needed for a complete build.
  if (!barebones) {
    reasons.push('Missing barebones kit')
    incomplete = true
  }
  if (!switches) {
    reasons.push('Missing switches')
    incomplete = true
  }
  if (!keycaps) {
    reasons.push('Missing keycaps')
    incomplete = true
  }

  // Current project scope: only 5-pin switches are offered, regardless of
  // socket type. This is a product restriction, not a physical claim, so it is
  // reported on its own and even before the barebones is selected.
  if (switches && switches.pin !== '5-pin') {
    reasons.push(`Only 5-pin switches are offered for now, got ${switches.pin}`)
    incompatible = true
  }

  // A keycap/barebones arrangement clash is only known once both are present.
  if (keycaps && barebones && keycaps.layout !== barebones.layout) {
    reasons.push(
      `Keycap layout ${keycaps.layout} does not match barebones layout ${barebones.layout}`,
    )
    incompatible = true
  }

  return {
    compatible: !incomplete && !incompatible,
    reasons,
    incomplete,
    incompatible,
  }
}

// Money is compared in integer cents; reject anything that is not a finite,
// nonnegative number of whole cents (or safely representable once summed).
// Convert from the number's canonical decimal string: scientific notation has
// no whole/fraction split, and more than two fraction digits is a fractional
// cent. This avoids the x100 float rounding that can land a cent off near the
// safe-integer limit.
function toCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  const text = String(value)
  if (text.includes('e') || text.includes('E')) return null
  const [whole, fraction = ''] = text.split('.')
  if (fraction.length > 2) return null
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`)
  return Number.isSafeInteger(cents) ? cents : null
}

function describeAmount(value) {
  if (value === undefined) return 'missing'
  if (typeof value !== 'number') return `not a number (${typeof value})`
  return String(value)
}

/**
 * Live price total of a Build compared against the user's limit.
 * A null/undefined limit means "no limit chosen yet", treated as within budget.
 * Invalid prices (missing/string/negative/NaN/Infinity, fractional cents,
 * unsafe ranges) or an invalid supplied limit produce total:null and an error
 * instead of silently coercing or pretending zero.
 * @returns {{ total: number|null, withinBudget: boolean, error: string|null }}
 */
export function computeBudget(parts = [], limit) {
  let cents = 0
  for (const part of parts) {
    const partCents = toCents(part?.price)
    if (partCents === null) {
      return {
        total: null,
        withinBudget: false,
        error: `Invalid price: ${describeAmount(part?.price)}`,
      }
    }
    cents += partCents
    if (!Number.isSafeInteger(cents)) {
      return { total: null, withinBudget: false, error: 'Total exceeds safe money range' }
    }
  }

  let limitCents = null
  if (limit != null) {
    limitCents = toCents(limit)
    if (limitCents === null) {
      return {
        total: null,
        withinBudget: false,
        error: `Invalid limit: ${describeAmount(limit)}`,
      }
    }
  }

  // A cent total is only safe if cents/100 round-trips back to exactly the
  // same cents. Near Number precision limits, converting safe integer cents
  // back to a currency number can lose a cent, which would show a total equal
  // to the limit while the cents comparison says over.
  const total = cents / 100
  if (toCents(total) !== cents) {
    return {
      total: null,
      withinBudget: false,
      error: 'Total too large to represent to the cent',
    }
  }

  return {
    total,
    withinBudget: limitCents === null ? true : cents <= limitCents,
    error: null,
  }
}
