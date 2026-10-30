import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import VirtualKeyboardTester from '../../src/components/VirtualKeyboardTester.vue'
import { BASE } from '../../src/data/catalog.js'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

enableAutoUnmount(afterEach)

let fetchedSource
let createdSource
let rejectNextPlayback = false
let rejectNextLoad = false
const OriginalAudioContext = window.AudioContext
const OriginalFetch = window.fetch

class MockAudioContext {
  constructor() {
    this.state = 'suspended'
    this.destination = {}
  }
  resume = vi.fn(() => {
    if (rejectNextPlayback) return Promise.reject(new Error('NotAllowedError'))
    this.state = 'running'
    return Promise.resolve()
  })
  close = vi.fn(() => Promise.resolve())
  decodeAudioData = vi.fn(() => rejectNextLoad
    ? Promise.reject(new Error('Decode failed'))
    : Promise.resolve({ duration: 0.1 }))
  createBufferSource() {
    const source = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }
    createdSource = source
    return source
  }
}

beforeEach(() => {
  createdSource = null
  fetchedSource = null
  rejectNextPlayback = false
  rejectNextLoad = false
  window.AudioContext = MockAudioContext
  window.fetch = vi.fn(async (source) => {
    fetchedSource = source
    return { ok: true, arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(8))) }
  })
})

afterEach(() => {
  window.AudioContext = OriginalAudioContext
  window.fetch = OriginalFetch
})

describe('VirtualKeyboardTester', () => {
  it('binds an existing MP3 one-key recording to every switch', () => {
    for (const part of BASE.switches) {
      expect(part.onePressSample).toBeTruthy()
      expect(existsSync(resolve(process.cwd(), `public${part.onePressSample}`))).toBe(true)
    }
  })

  it('presses and releases physical and pointer keys with the selected switch sound', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: {
        layout: '60',
        switchPart: { id: 'cream', onePressSample: '/switch-audio-onekey/akko-onepress.mp3' },
      },
    })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
    await flushPromises()
    expect(fetchedSource).toBe('/switch-audio-onekey/akko-onepress.mp3')
    expect(createdSource.start).toHaveBeenCalledWith(0)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(false)

    const escape = wrapper.get('[data-key-id="Escape"]')
    await escape.trigger('pointerdown', { pointerId: 1 })
    expect(wrapper.find('[data-key-id="Escape"].pressed').exists()).toBe(true)
    await escape.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.find('[data-key-id="Escape"].pressed').exists()).toBe(false)
  })

  it('cancels Space keydown to prevent page scrolling', async () => {
    mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: null },
    })
    const space = new KeyboardEvent('keydown', { code: 'Space', cancelable: true, bubbles: true })

    window.dispatchEvent(space)

    expect(space.defaultPrevented).toBe(true)
  })

  it('does not play an unrelated sample when the switch has no one-key recording', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: { id: 'gyellow' } },
    })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    await flushPromises()
    expect(fetchedSource).toBeNull()
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))
  })

  it('shows an error when audio playback rejects', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: { id: 'cream', onePressSample: '/switch-audio-onekey/akko-onepress.mp3' } },
    })
    await flushPromises()
    rejectNextPlayback = true

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('playback was blocked')
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
  })

  it('shows an error when the switch audio fails to load', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: { id: 'cream', onePressSample: '/missing.mp3' } },
    })
    await flushPromises()
    rejectNextLoad = true
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('could not be loaded')
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
  })

  it('ignores keyboard activation while a text control has focus', async () => {
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '60', switchPart: { id: 'cream', onePressSample: '/switch-audio-onekey/akko-onepress.mp3' } } })
    await flushPromises()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }))

    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(false)
    input.remove()
  })

  it('maps AZERTY-style characters by event.key without shifting layout codes', async () => {
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '60', switchPart: null } })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'a' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
    expect(wrapper.find('[data-key-id="KeyQ"].pressed').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'a' }))

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'q' }))
    expect(wrapper.find('[data-key-id="KeyQ"].pressed').exists()).toBe(true)
  })

  it('maps shifted symbols to their physical US keyboard keys', async () => {
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '60', switchPart: null } })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '!', shiftKey: true }))
    expect(wrapper.find('[data-key-id="Digit1"].pressed').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1', key: '!' }))
    expect(wrapper.find('[data-key-id="Digit1"].pressed').exists()).toBe(false)
  })

  it('ignores keys absent from a 60% layout and keys absent from a full-size layout', async () => {
    const compact = mount(VirtualKeyboardTester, { props: { layout: '60', switchPart: null } })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F1', key: 'F1' }))
    expect(compact.find('[data-key-id="F1"].pressed').exists()).toBe(false)
    compact.unmount()

    const fullSize = mount(VirtualKeyboardTester, { props: { layout: '100', switchPart: null } })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F13', key: 'F13' }))
    expect(fullSize.find('[data-key-id="F13"].pressed').exists()).toBe(false)
  })
})
