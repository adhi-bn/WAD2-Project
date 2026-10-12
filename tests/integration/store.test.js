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
    })
    expect(budget.value).toEqual({ total: 0, withinBudget: true })
  })

  it('derives compatibility and budget from the chosen slots', () => {
    setSlot('barebones', { socket: 'hotswap', layout: 'ansi', price: 120 })
    setSlot('switches', { pin: '5-pin', price: 40 })
    setSlot('keycaps', { layout: 'ansi', price: 60 })
    setLimit(200)

    expect(build.barebones.socket).toBe('hotswap')
    expect(compatibility.value).toEqual({ compatible: true, reasons: [] })
    expect(budget.value).toEqual({ total: 220, withinBudget: false })
  })

  it('ignores unknown slots', () => {
    setSlot('frame', { price: 999 })
    expect('frame' in build).toBe(false)
  })
})
