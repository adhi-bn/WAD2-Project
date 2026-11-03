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
  createGain() {
    return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
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
  it('keeps the keyboard tester host out of the tab order', () => {
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '75', switchPart: null } })
    const host = wrapper.get('.virtual-keyboard-tester')

    expect(host.attributes('tabindex')).toBeUndefined()
  })

  it('does not steal focus on mount and still captures physical key presses', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: null },
      attachTo: document.body,
    })
    await flushPromises()

    expect(document.activeElement).not.toBe(wrapper.element)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
  })

  it('binds an existing MP3 one-press recording to every switch', () => {
    for (const part of BASE.switches) {
      expect(part.onePressSample).toBeTruthy()
      expect(existsSync(resolve(process.cwd(), `public${part.onePressSample}`))).toBe(true)
    }
  })

  it('presses and releases physical and pointer keys with the selected switch sound', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: {
        layout: '60',
        switchPart: { id: 'cream', onePressSample: '/switch-audio-one-press/akko-one-press.mp3' },
      },
    })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
    await flushPromises()
    expect(fetchedSource).toBe('/switch-audio-one-press/akko-one-press.mp3')
    expect(createdSource.start).toHaveBeenCalledWith(0)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(false)

    const escape = wrapper.get('[data-key-id="Escape"]')
    await escape.trigger('pointerdown', { pointerId: 1 })
    expect(wrapper.find('[data-key-id="Escape"].pressed').exists()).toBe(true)
    await escape.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.find('[data-key-id="Escape"].pressed').exists()).toBe(false)
  })

  it('maps 75% Backquote, navigation, and arrow presses to their matching keycaps', async () => {
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '75', switchPart: null } })
    const keyIds = [...wrapper.element.querySelectorAll('[data-key-id]')].map((key) => key.dataset.keyId)
    expect(keyIds).toHaveLength(84)
    expect(new Set(keyIds).size).toBe(84)

    for (const [code, key] of [
      ['Backquote', '`'],
      ['PageUp', 'PageUp'],
      ['PageDown', 'PageDown'],
      ['Home', 'Home'],
      ['ArrowUp', 'ArrowUp'],
      ['End', 'End'],
      ['ArrowLeft', 'ArrowLeft'],
      ['ArrowDown', 'ArrowDown'],
      ['ArrowRight', 'ArrowRight'],
    ]) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key }))
      expect(wrapper.find(`[data-key-id="${code}"].pressed`).exists()).toBe(true)
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key }))
      expect(wrapper.find(`[data-key-id="${code}"].pressed`).exists()).toBe(false)
    }
  })

  it('maps the spaced 100% function groups, system keys, arrows, and numpad presses', async () => {
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '100', switchPart: null } })
    const keyIds = [...wrapper.element.querySelectorAll('[data-key-id]')].map((key) => key.dataset.keyId)
    expect(keyIds).toHaveLength(104)
    expect(new Set(keyIds).size).toBe(104)

    for (const [code, key] of [
      ['F1', 'F1'],
      ['F5', 'F5'],
      ['F9', 'F9'],
      ['PrintScreen', 'PrintScreen'],
      ['ScrollLock', 'ScrollLock'],
      ['Pause', 'Pause'],
      ['ArrowUp', 'ArrowUp'],
      ['NumLock', 'NumLock'],
      ['Numpad7', '7'],
      ['NumpadAdd', '+'],
      ['NumpadEnter', 'Enter'],
    ]) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key }))
      expect(wrapper.find(`[data-key-id="${code}"].pressed`).exists()).toBe(true)
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key }))
      expect(wrapper.find(`[data-key-id="${code}"].pressed`).exists()).toBe(false)
    }
  })

  it('cancels Space keydown to prevent page scrolling', async () => {
    mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: null },
    })
    const space = new KeyboardEvent('keydown', { code: 'Space', cancelable: true, bubbles: true })

    window.dispatchEvent(space)

    expect(space.defaultPrevented).toBe(true)
  })

  it('keeps mute focused after activation while physical typing still works', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: null },
      attachTo: document.body,
    })
    const muteButton = wrapper.get('.switch-audio__mute')
    muteButton.element.focus()

    await muteButton.trigger('click')

    expect(document.activeElement).toBe(muteButton.element)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    expect(wrapper.find('[data-key-id="KeyA"].pressed').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not play an unrelated sample when the switch has no one-press recording', async () => {
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

  it('links, mutes, and reports the selected switch recording status', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: {
        layout: '60',
        switchPart: { id: 'cream', name: 'Akko V3 Cream Yellow Pro', onePressSample: '/switch-audio-one-press/akko-one-press.mp3' },
      },
    })
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Akko V3 Cream Yellow Pro recording linked')
    await wrapper.get('button[aria-label="Mute switch sample"]').trigger('click')
    expect(wrapper.get('button[aria-label="Mute switch sample"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toContain('Muted')
  })

  it('shows an error when audio playback rejects', async () => {
    const wrapper = mount(VirtualKeyboardTester, {
      props: { layout: '60', switchPart: { id: 'cream', onePressSample: '/switch-audio-one-press/akko-one-press.mp3' } },
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
    const wrapper = mount(VirtualKeyboardTester, { props: { layout: '60', switchPart: { id: 'cream', onePressSample: '/switch-audio-one-press/akko-one-press.mp3' } } })
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
