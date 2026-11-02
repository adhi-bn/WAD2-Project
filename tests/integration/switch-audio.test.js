import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import SwitchAudioPreview from '../../src/components/SwitchAudioPreview.vue'
import { BASE } from '../../src/data/catalog.js'

enableAutoUnmount(afterEach)

let latestSource
let latestGain
let latestAudioContext
let originalAudioContext
let originalWebkitAudioContext

class MockAudioContext {
  constructor() {
    this.state = 'suspended'
    this.currentTime = 0
    this.destination = {}
    latestAudioContext = this
  }

  resume = vi.fn(function () {
    this.state = 'running'
    return Promise.resolve()
  })

  close = vi.fn(function () {
    this.state = 'closed'
    return Promise.resolve()
  })

  decodeAudioData = vi.fn().mockResolvedValue({ duration: 4.25 })

  createBufferSource() {
    latestSource = {
      buffer: null,
      onended: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    return latestSource
  }

  createGain() {
    latestGain = {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
    return latestGain
  }
}

beforeEach(() => {
  latestSource = null
  latestGain = null
  latestAudioContext = null
  originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')
  originalWebkitAudioContext = Object.getOwnPropertyDescriptor(window, 'webkitAudioContext')
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  }))
})

afterEach(() => {
  vi.useRealTimers()
  if (originalAudioContext) Object.defineProperty(window, 'AudioContext', originalAudioContext)
  else delete window.AudioContext
  if (originalWebkitAudioContext) Object.defineProperty(window, 'webkitAudioContext', originalWebkitAudioContext)
  else delete window.webkitAudioContext
  vi.unstubAllGlobals()
})

describe('SwitchAudioPreview', () => {
  it('links every available sample to a supplied recording, including the Gazzew Boba variants', () => {
    const recordedParts = BASE.switches.filter((option) => option.sample)

    expect(recordedParts).toHaveLength(11)
    expect(new Set(recordedParts.map((option) => option.type))).toEqual(new Set(['linear', 'silent', 'tactile', 'clicky']))
    for (const part of recordedParts) {
      expect(part.sample).toMatch(/\.mp3$/)
      expect(existsSync(resolve(process.cwd(), 'public', part.sample.slice(1)))).toBe(true)
    }
    expect(BASE.switches.find((option) => option.id === 'u4').sample).toBe('/switch-audio/gazzew-boba-u4.mp3')
    expect(BASE.switches.find((option) => option.id === 'u4t').sample).toBe('/switch-audio/gazzew-boba.mp3')
  })

  it('plays the dedicated recording linked to Gazzew Boba U4', async () => {
    const part = BASE.switches.find((option) => option.id === 'u4')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    await wrapper.get('button[aria-label="Play sample for Gazzew Boba U4 silent tactile"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('button[aria-label="Pause sample for Gazzew Boba U4 silent tactile"]').text()).toBe('Pause')
    expect(fetch).toHaveBeenCalledWith('/switch-audio/gazzew-boba-u4.mp3', expect.any(Object))
    expect(latestSource.start).toHaveBeenCalledWith(0, 0)
    expect(wrapper.get('[role="status"]').text()).toContain('Playing silent typing sample')
  })

  it('plays the sample linked to the selected switch and applies mute and volume', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    expect(wrapper.get('[role="status"]').text()).toContain('linear typing sample')
    expect(latestSource).toBeNull()
    expect(latestAudioContext).toBeNull()
    expect(fetch).not.toHaveBeenCalled()

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/switch-audio/gateron-milky-yellows.mp3', expect.any(Object))
    expect(latestAudioContext.resume).toHaveBeenCalledOnce()
    expect(latestSource.start).toHaveBeenCalledOnce()
    expect(wrapper.get('[role="status"]').text()).toContain('Playing linear typing sample')
    expect(wrapper.find('.switch-audio__time').text()).toContain('0:04.3')

    await wrapper.get('button[aria-label="Mute switch sample"]').trigger('click')
    expect(latestGain.gain.value).toBe(0)
    expect(wrapper.get('button[aria-label="Mute switch sample"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toContain('Muted')

    await wrapper.get('input[aria-label="Volume for Gateron Milky Yellow Pro sample"]').setValue('0.4')
    expect(latestGain.gain.value).toBe(0.4)
    expect(wrapper.get('button[aria-label="Mute switch sample"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('input[aria-label="Volume for Gateron Milky Yellow Pro sample"]').attributes('aria-valuetext')).toBe('40%')
    expect(wrapper.text()).toContain('40%')

    await wrapper.get('button[aria-label="Mute switch sample"]').trigger('click')
    expect(latestGain.gain.value).toBe(0)
  })

  it('pauses, resumes, and seeks without leaving multiple samples playing', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })
    const controls = wrapper.find('.switch-audio__controls')
    expect(controls.find('button[aria-label^="Play sample"]').exists()).toBe(true)
    expect(controls.find('button[aria-label="Mute switch sample"]').exists()).toBe(true)
    expect(controls.find('input[aria-label="Volume for Gateron Milky Yellow Pro sample"]').exists()).toBe(true)
    expect(controls.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').text()).toBe('Play')
    expect(controls.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').attributes('aria-pressed')).toBeUndefined()
    expect(controls.get('button[aria-label="Mute switch sample"]').find('svg').exists()).toBe(true)

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    const firstSource = latestSource

    const seek = wrapper.get('.switch-audio__seek')
    seek.element.value = '1.25'
    await seek.trigger('input')
    expect(latestSource).toBe(firstSource)
    expect(wrapper.get('[role="status"]').text()).toContain('Playing linear typing sample')

    seek.element.value = '2.5'
    await seek.trigger('input')
    expect(latestSource).toBe(firstSource)
    await seek.trigger('change')
    const seekSource = latestSource
    expect(firstSource.stop).toHaveBeenCalledOnce()
    expect(seekSource.start).toHaveBeenCalledWith(0, 2.5)
    expect(wrapper.find('.switch-audio__time').text()).toContain('0:02.5')

    await wrapper.get('button[aria-label="Pause sample for Gateron Milky Yellow Pro"]').trigger('click')
    expect(seekSource.stop).toHaveBeenCalledOnce()
    expect(wrapper.get('[role="status"]').text()).toContain('Paused playback')

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    expect(latestSource).not.toBe(seekSource)
    expect(latestSource.start).toHaveBeenCalledWith(0, 2.5)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('updates playback progress and reports the ended state', async () => {
    vi.useFakeTimers()
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    const seek = wrapper.get('.switch-audio__seek')
    const initialAccessibleTime = seek.attributes('aria-valuetext')
    await seek.trigger('focus')
    latestAudioContext.currentTime = 1.5
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.switch-audio__time').text()).toContain('0:01.5')
    expect(seek.attributes('aria-valuetext')).toBe(initialAccessibleTime)

    latestSource.onended()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.switch-audio__time').text()).toContain('0:04.3')
    expect(wrapper.get('[role="status"]').text()).toContain('Playback finished')
  })

  it('recreates a closed audio context after the system closes it', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    const closedContext = latestAudioContext
    await wrapper.get('button[aria-label="Pause sample for Gateron Milky Yellow Pro"]').trigger('click')
    closedContext.state = 'closed'

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()

    expect(latestAudioContext).not.toBe(closedContext)
    expect(latestAudioContext.state).toBe('running')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(latestSource.start).toHaveBeenCalledOnce()
  })

  it('commits keyboard seeking and reports source-start errors without leaving playback active', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    const seek = wrapper.get('.switch-audio__seek')
    seek.element.value = '1.25'
    await seek.trigger('input')
    await seek.trigger('keyup', { key: 'ArrowRight' })
    const keyboardSource = latestSource
    expect(keyboardSource.start).toHaveBeenCalledWith(0, 1.25)
    await seek.trigger('change')
    expect(latestSource).toBe(keyboardSource)

    seek.element.value = '1.75'
    await seek.trigger('input')
    await seek.trigger('blur')
    expect(latestSource.start).toHaveBeenCalledWith(0, 1.75)

    latestAudioContext.createBufferSource = vi.fn(() => {
      throw new Error('Audio source unavailable')
    })
    seek.element.value = '2'
    await seek.trigger('input')
    await seek.trigger('change')

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not play the recorded sample')
    expect(wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').text()).toBe('Play')
  })

  it('stops playback and closes Web Audio resources when unmounted', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    const source = latestSource
    const context = latestAudioContext

    wrapper.unmount()

    expect(source.stop).toHaveBeenCalledOnce()
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('updates playback and profile linkage when the selected switch changes', async () => {
    const first = BASE.switches.find((option) => option.id === 'gyellow')
    const next = BASE.switches.find((option) => option.id === 'gbrown')
    const wrapper = mount(SwitchAudioPreview, { props: { part: first } })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ part: next })

    expect(latestSource.stop).toHaveBeenCalledOnce()
    expect(wrapper.get('[role="status"]').text()).toContain('tactile typing sample linked to Gateron Brown Pro')
    expect(wrapper.get('button[aria-label="Play sample for Gateron Brown Pro"]').element.disabled).toBe(false)

    await wrapper.get('button[aria-label="Play sample for Gateron Brown Pro"]').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenLastCalledWith('/switch-audio/gateron-gpro-brown.mp3', expect.any(Object))
    expect(latestSource.start).toHaveBeenCalledWith(0, 0)
  })

  it('handles missing or incomplete Parts and disables unavailable playback controls', () => {
    const emptyWrapper = mount(SwitchAudioPreview)
    expect(emptyWrapper.text()).toContain('Selected switch')
    expect(emptyWrapper.get('[role="status"]').text()).toContain('No recorded sample is available')
    expect(emptyWrapper.get('button[aria-label="Play sample for Selected switch"]').element.disabled).toBe(true)

    const part = { id: 'unrecorded', name: 'Unrecorded switch', type: 'tactile' }
    const wrapper = mount(SwitchAudioPreview, { props: { part } })

    expect(wrapper.get('[role="status"]').text()).toContain('No recorded sample is available')
    expect(wrapper.text()).toContain('Sample unavailable')
    expect(wrapper.get('[role="status"]').classes()).toContain('visually-hidden')
    expect(wrapper.get('button[aria-label="Play sample for Unrecorded switch"]').element.disabled).toBe(true)
    expect(fetch).not.toHaveBeenCalled()

    const nullWrapper = mount(SwitchAudioPreview, { props: { part: null } })
    expect(nullWrapper.text()).toContain('Selected switch')
    expect(nullWrapper.get('[role="status"]').text()).toContain('No recorded sample is available')

    const unnamedWrapper = mount(SwitchAudioPreview, { props: { part: { sample: '/switch-audio/sample.mp3' } } })
    expect(unnamedWrapper.get('.switch-audio__heading p').text()).toContain('Recorded Switch typing sample')
  })

  it('shows visible and accessible errors when the recorded sample cannot load or decode', async () => {
    const part = BASE.switches.find((option) => option.id === 'cream')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })
    fetch.mockResolvedValueOnce({ ok: false, status: 404 })

    await wrapper.get('button[aria-label="Play sample for Akko V3 Cream Yellow Pro"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not play the recorded sample')

    fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    })
    latestAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Invalid audio data'))

    await wrapper.get('button[aria-label="Play sample for Akko V3 Cream Yellow Pro"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not play the recorded sample')
  })

  it('does not let a stale decode replace the newly selected sample', async () => {
    const first = BASE.switches.find((option) => option.id === 'gyellow')
    const next = BASE.switches.find((option) => option.id === 'gbrown')
    const wrapper = mount(SwitchAudioPreview, { props: { part: first } })
    const pendingDecodes = []
    class DeferredAudioContext extends MockAudioContext {
      decodeAudioData = vi.fn(() => new Promise((resolve) => pendingDecodes.push(resolve)))
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: DeferredAudioContext })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()
    expect(pendingDecodes).toHaveLength(1)

    await wrapper.setProps({ part: next })
    await wrapper.get('button[aria-label="Play sample for Gateron Brown Pro"]').trigger('click')
    await flushPromises()
    expect(pendingDecodes).toHaveLength(2)

    const currentBuffer = { duration: 5 }
    pendingDecodes[1](currentBuffer)
    await flushPromises()
    expect(latestSource.buffer).toBe(currentBuffer)

    pendingDecodes[0]({ duration: 3 })
    await flushPromises()
    await wrapper.get('button[aria-label="Pause sample for Gateron Brown Pro"]').trigger('click')
    await wrapper.get('button[aria-label="Play sample for Gateron Brown Pro"]').trigger('click')
    await flushPromises()

    expect(latestSource.buffer).toBe(currentBuffer)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('uses the WebKit AudioContext fallback when the standard name is unavailable', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined })
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: MockAudioContext })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()

    expect(latestAudioContext).toBeInstanceOf(MockAudioContext)
    expect(latestSource.start).toHaveBeenCalledOnce()
  })

  it('resumes an interrupted AudioContext before playback', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })
    class InterruptedAudioContext extends MockAudioContext {
      constructor() {
        super()
        this.state = 'interrupted'
      }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: InterruptedAudioContext })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()

    expect(latestAudioContext.resume).toHaveBeenCalledOnce()
    expect(latestAudioContext.state).toBe('running')
    expect(latestSource.start).toHaveBeenCalledOnce()
  })

  it('reports a playback error when the browser refuses to resume its audio context', async () => {
    const part = BASE.switches.find((option) => option.id === 'gyellow')
    const wrapper = mount(SwitchAudioPreview, { props: { part } })
    const resumeError = new Error('User activation required')
    class BlockedAudioContext extends MockAudioContext {
      resume = vi.fn().mockRejectedValue(resumeError)
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: BlockedAudioContext })

    await wrapper.get('button[aria-label="Play sample for Gateron Milky Yellow Pro"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not play the recorded sample')
    expect(latestAudioContext.resume).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
    expect(latestSource).toBeNull()
  })
})
