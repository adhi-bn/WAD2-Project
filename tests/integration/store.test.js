import { beforeEach, describe, expect, it } from 'vitest'
import { budget, build, compatibility, setLimit, setSlot } from '../../src/stores/build.js'

describe('build store', () => {
  beforeEach(() => {
    setSlot('barebones', null)
    setSlot('switches', null)
    setSlot('keycaps', null)
    setLimit(null)
  })

  it('reports incomplete and zero budget when empty', () => {
    expect(compatibility.value).toEqual({
      compatible: false,
      reasons: ['Missing barebones kit', 'Missing switches', 'Missing keycaps'],
      incomplete: true,
      incompatible: false,
    })
    expect(budget.value).toEqual({ total: 0, withinBudget: true, error: null })
  })

  it('derives compatibility and budget from the chosen slots', () => {
    setSlot('barebones', { socket: 'hotswap', layout: 'ansi', price: 120 })
    setSlot('switches', { pin: '5-pin', price: 40 })
    setSlot('keycaps', { layout: 'ansi', price: 60 })
    setLimit(200)

    expect(build.barebones.socket).toBe('hotswap')
    expect(compatibility.value).toEqual({
      compatible: true,
      reasons: [],
      incomplete: false,
      incompatible: false,
    })
    expect(budget.value).toEqual({ total: 220, withinBudget: false, error: null })
  })

  it('propagates clash flags and keeps the invalid selection', () => {
    setSlot('barebones', { socket: 'hotswap', layout: 'ansi', price: 120 })
    setSlot('switches', { pin: '3-pin', price: 40 })

    expect(compatibility.value.incompatible).toBe(true)
    expect(compatibility.value.compatible).toBe(false)
    expect(build.switches.pin).toBe('3-pin')
  })

  it('propagates a budget error and keeps the invalid selection', () => {
    setSlot('switches', { pin: '5-pin', price: 'free' })

    expect(budget.value.total).toBeNull()
    expect(budget.value.withinBudget).toBe(false)
    expect(budget.value.error).toEqual(expect.any(String))
    expect(build.switches.price).toBe('free')
  })

  it('ignores unknown slots', () => {
    setSlot('frame', { price: 999 })
    expect('frame' in build).toBe(false)
  })
})
