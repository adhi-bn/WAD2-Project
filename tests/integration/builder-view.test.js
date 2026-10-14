import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import BuilderView from '../../src/views/BuilderView.vue'
import { build, setLimit, setSlot } from '../../src/stores/build.js'

const barebonesHotswapAnsi = { socket: 'hotswap', layout: 'ansi', price: 120 }
const switches5Pin = { pin: '5-pin', price: 40 }
const keycapsAnsi = { layout: 'ansi', price: 60 }

enableAutoUnmount(afterEach)

function fillValidBuild() {
  setSlot('barebones', barebonesHotswapAnsi)
  setSlot('switches', switches5Pin)
  setSlot('keycaps', keycapsAnsi)
}

describe('BuilderView', () => {
  beforeEach(() => {
    setSlot('barebones', null)
    setSlot('switches', null)
    setSlot('keycaps', null)
    setLimit(null)
  })

  it('shows Compatible with an SGD total for a complete fitting build', () => {
    fillValidBuild()
    setLimit(250)

    const text = mount(BuilderView).text()
    expect(text).toContain('Compatible')
    expect(text).not.toContain('Incompatible')
    expect(text).toContain('SGD')
    expect(text).toMatch(/220\.00/)
    expect(text).toContain('within budget')
  })

  it('shows Incompatible (never Incomplete) when a full build clashes', () => {
    setSlot('barebones', barebonesHotswapAnsi)
    setSlot('switches', switches5Pin)
    setSlot('keycaps', { layout: 'iso', price: 60 })
    setLimit(250)

    const text = mount(BuilderView).text()
    expect(text).toContain('Incompatible')
    expect(text).not.toContain('Incomplete')
    expect(text).toMatch(/layout/i)
  })

  it('shows Incomplete + Incompatible together for a partial build with a known clash', () => {
    setSlot('barebones', barebonesHotswapAnsi)
    setSlot('switches', { pin: '3-pin', price: 40 })

    const text = mount(BuilderView).text()
    expect(text).toContain('Incomplete')
    expect(text).toContain('Incompatible')
    expect(text).toContain('Missing keycaps')
    expect(text).toMatch(/5-pin/)
  })

  it('shows over budget and keeps the selected parts when a valid build exceeds its target', () => {
    fillValidBuild()
    setLimit(200)

    const text = mount(BuilderView).text()
    expect(text).toContain('over budget')
    expect(text).toMatch(/220\.00/)
    expect(build.barebones).toEqual(barebonesHotswapAnsi)
    expect(build.switches).toEqual(switches5Pin)
    expect(build.keycaps).toEqual(keycapsAnsi)
  })

  it('shows Budget unavailable and no verdict when a price is missing', () => {
    setSlot('barebones', barebonesHotswapAnsi)
    setSlot('switches', { pin: '5-pin' })
    setSlot('keycaps', keycapsAnsi)

    const text = mount(BuilderView).text()
    expect(text).toContain('Budget unavailable')
    expect(text).not.toContain('within budget')
    expect(text).not.toContain('over budget')
  })

  it('shows Budget unavailable and no false verdict for an invalid target', () => {
    fillValidBuild()
    setLimit('not-a-number')

    const text = mount(BuilderView).text()
    expect(text).toContain('Budget unavailable')
    expect(text).not.toContain('within budget')
    expect(text).not.toContain('over budget')
  })

  it('shows no target set without a limit, and within budget with one', () => {
    fillValidBuild()

    let text = mount(BuilderView).text()
    expect(text).toContain('no target set')
    expect(text).toContain('SGD')
    expect(text).not.toContain('within budget')
    expect(text).not.toContain('over budget')

    setLimit(300)
    text = mount(BuilderView).text()
    expect(text).toContain('within budget')
    expect(text).toMatch(/220\.00/)
  })
})
