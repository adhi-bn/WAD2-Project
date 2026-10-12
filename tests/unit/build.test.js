import { describe, expect, it } from 'vitest'
import { checkCompatibility, computeBudget } from '../../src/domain/build.js'

const barebones5PinHotswap = { socket: 'hotswap', layout: 'ansi', price: 120 }
const switches5Pin = { pin: '5-pin', price: 40 }
const keycapsAnsi = { layout: 'ansi', price: 60 }

describe('checkCompatibility', () => {
  it('accepts a valid build', () => {
    expect(
      checkCompatibility({
        barebones: barebones5PinHotswap,
        switches: switches5Pin,
        keycaps: keycapsAnsi,
      }),
    ).toEqual({ compatible: true, reasons: [] })
  })

  it('rejects a build with missing slots', () => {
    const result = checkCompatibility({ barebones: barebones5PinHotswap })
    expect(result.compatible).toBe(false)
    expect(result.reasons).toContain('Missing switches')
    expect(result.reasons).toContain('Missing keycaps')
  })

  it('rejects a pin/socket mismatch', () => {
    const result = checkCompatibility({
      barebones: barebones5PinHotswap,
      switches: { pin: '3-pin', price: 40 },
      keycaps: keycapsAnsi,
    })
    expect(result.compatible).toBe(false)
    expect(result.reasons[0]).toMatch(/5-pin/)
  })

  it('rejects a keycap layout mismatch', () => {
    const result = checkCompatibility({
      barebones: barebones5PinHotswap,
      switches: switches5Pin,
      keycaps: { layout: 'iso', price: 60 },
    })
    expect(result.compatible).toBe(false)
    expect(result.reasons[0]).toMatch(/layout/)
  })
})

describe('computeBudget', () => {
  it('sums prices and reports within budget', () => {
    expect(computeBudget([barebones5PinHotswap, switches5Pin], 200)).toEqual({
      total: 160,
      withinBudget: true,
    })
  })

  it('reports over budget', () => {
    expect(computeBudget([barebones5PinHotswap, switches5Pin, keycapsAnsi], 200)).toEqual({
      total: 220,
      withinBudget: false,
    })
  })

  it('treats a missing limit as within budget', () => {
    expect(computeBudget([switches5Pin])).toEqual({ total: 40, withinBudget: true })
  })
})
