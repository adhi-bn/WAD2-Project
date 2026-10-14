import { describe, expect, it } from 'vitest'
import { checkCompatibility, computeBudget } from '../../src/domain/build.js'

const barebonesHotswapAnsi = { socket: 'hotswap', layout: 'ansi', price: 120 }
const switches5Pin = { pin: '5-pin', price: 40 }
const keycapsAnsi = { layout: 'ansi', price: 60 }

describe('checkCompatibility', () => {
  it('accepts a complete, matching build', () => {
    expect(
      checkCompatibility({
        barebones: barebonesHotswapAnsi,
        switches: switches5Pin,
        keycaps: keycapsAnsi,
      }),
    ).toEqual({ compatible: true, reasons: [], incomplete: false, incompatible: false })
  })

  it('flags every missing slot as incomplete but not incompatible', () => {
    expect(checkCompatibility()).toEqual({
      compatible: false,
      reasons: ['Missing barebones kit', 'Missing switches', 'Missing keycaps'],
      incomplete: true,
      incompatible: false,
    })
  })

  it('reports a complete clash as incompatible, not incomplete', () => {
    const result = checkCompatibility({
      barebones: { socket: 'solder', layout: 'ansi', price: 1 },
      switches: { pin: '3-pin', price: 1 },
      keycaps: { layout: 'iso', price: 1 },
    })
    expect(result.incomplete).toBe(false)
    expect(result.incompatible).toBe(true)
    expect(result.compatible).toBe(false)
    expect(result.reasons).toHaveLength(2)
  })

  it('reports missing slots and known clashes independently', () => {
    const result = checkCompatibility({
      barebones: { socket: 'hotswap', layout: 'ansi', price: 1 },
      keycaps: { layout: 'iso', price: 1 },
    })
    expect(result.incomplete).toBe(true)
    expect(result.incompatible).toBe(true)
    expect(result.compatible).toBe(false)
    expect(result.reasons).toContain('Missing switches')
    expect(result.reasons.some((reason) => /layout/.test(reason))).toBe(true)
  })

  it.each(['hotswap', 'solder'])('accepts 5-pin switches on a %s socket', (socket) => {
    const result = checkCompatibility({
      barebones: { socket, layout: 'ansi', price: 1 },
      switches: switches5Pin,
      keycaps: keycapsAnsi,
    })
    expect(result).toEqual({
      compatible: true,
      reasons: [],
      incomplete: false,
      incompatible: false,
    })
  })

  it.each(['hotswap', 'solder'])('rejects 3-pin switches on a %s socket', (socket) => {
    const result = checkCompatibility({
      barebones: { socket, layout: 'ansi', price: 1 },
      switches: { pin: '3-pin', price: 1 },
      keycaps: keycapsAnsi,
    })
    expect(result.incompatible).toBe(true)
    expect(result.reasons.some((reason) => /5-pin/.test(reason))).toBe(true)
  })

  it('reports 3-pin switches even when the barebones is absent', () => {
    const result = checkCompatibility({ switches: { pin: '3-pin', price: 1 } })
    expect(result.incomplete).toBe(true)
    expect(result.incompatible).toBe(true)
    expect(result.compatible).toBe(false)
  })
})

describe('computeBudget', () => {
  it('sums prices and reports within budget', () => {
    expect(computeBudget([barebonesHotswapAnsi, switches5Pin], 200)).toEqual({
      total: 160,
      withinBudget: true,
      error: null,
    })
  })

  it('reports over budget', () => {
    expect(computeBudget([barebonesHotswapAnsi, switches5Pin, keycapsAnsi], 200)).toEqual({
      total: 220,
      withinBudget: false,
      error: null,
    })
  })

  it('treats a missing limit as no target yet', () => {
    expect(computeBudget([switches5Pin])).toEqual({ total: 40, withinBudget: true, error: null })
  })

  it('compares money in integer cents (0.1 + 0.2 <= 0.3)', () => {
    expect(computeBudget([{ price: 0.1 }, { price: 0.2 }], 0.3)).toEqual({
      total: 0.3,
      withinBudget: true,
      error: null,
    })
  })

  it('treats a genuine one-cent overage as over budget', () => {
    expect(computeBudget([{ price: 0.1 }, { price: 0.2 }], 0.29)).toEqual({
      total: 0.3,
      withinBudget: false,
      error: null,
    })
  })

  it('allows an explicit zero price', () => {
    expect(computeBudget([{ price: 0 }], 0)).toEqual({ total: 0, withinBudget: true, error: null })
  })

  it('accepts ordinary two-decimal prices', () => {
    expect(computeBudget([{ price: 0.29 }, { price: 1.01 }], 1.3)).toEqual({
      total: 1.3,
      withinBudget: true,
      error: null,
    })
  })

  it('handles large canonical-safe amounts without float off-by-cent', () => {
    expect(computeBudget([{ price: 90071992547409.9 }], 90071992547409.89)).toEqual({
      total: 90071992547409.9,
      withinBudget: false,
      error: null,
    })
  })

  it.each([
    ['missing price', {}],
    ['string price', { price: '120' }],
    ['negative price', { price: -1 }],
    ['NaN price', { price: NaN }],
    ['Infinity price', { price: Infinity }],
    ['tiny sub-cent price', { price: 1e-9 }],
    ['sub-cent precision', { price: 1.000000001 }],
    ['excess fractional cent', { price: 1.005 }],
    ['unsafe price', { price: 1e16 }],
  ])('rejects an invalid price: %s', (_label, part) => {
    const result = computeBudget([part], 100)
    expect(result.total).toBeNull()
    expect(result.withinBudget).toBe(false)
    expect(result.error).toEqual(expect.any(String))
  })

  it.each([
    ['string limit', '200'],
    ['negative limit', -1],
    ['NaN limit', NaN],
    ['Infinity limit', Infinity],
    ['excess fractional cent limit', 1.005],
  ])('rejects an invalid limit: %s', (_label, limit) => {
    const result = computeBudget([switches5Pin], limit)
    expect(result.total).toBeNull()
    expect(result.withinBudget).toBe(false)
    expect(result.error).toEqual(expect.any(String))
  })

  it('rejects a total beyond safe integer cents', () => {
    const result = computeBudget([{ price: 5e13 }, { price: 5e13 }])
    expect(result.total).toBeNull()
    expect(result.withinBudget).toBe(false)
    expect(result.error).toEqual(expect.any(String))
  })

  it('rejects a safe-cents sum whose total loses the last cent', () => {
    // Integer sum 9007199254740991 cents is safe, but /100 rounds to the
    // 9007199254740990-cent target, hiding a real one-cent excess.
    const result = computeBudget([{ price: 90071992547409.9 }, { price: 0.01 }], 90071992547409.9)
    expect(result).toEqual({
      total: null,
      withinBudget: false,
      error: expect.any(String),
    })
  })
})
