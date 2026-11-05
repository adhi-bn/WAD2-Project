import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import {
  createTypewriter,
  isReducedMotionPreferred,
  useTypewriter,
} from '../../src/lib/typewriter.js'

describe('createTypewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('respects initial delay before typing starts', () => {
    const onUpdate = vi.fn()
    const typewriter = createTypewriter({
      fullText: 'Swipe right on your dream keyboard.',
      initialDelay: 300,
      charDelay: 50,
      onUpdate,
    })

    typewriter.start()

    // Immediately at start, state is reset to 0 chars
    expect(typewriter.getState().currentLength).toBe(0)
    expect(typewriter.getState().plainText).toBe('')
    expect(typewriter.getState().emText).toBe('')
    expect(typewriter.getState().isComplete).toBe(false)

    // Advance 299ms: initial delay not yet elapsed, no chars typed
    vi.advanceTimersByTime(299)
    expect(typewriter.getState().currentLength).toBe(0)
    expect(typewriter.getState().plainText).toBe('')

    // Advance to 300ms: initial delay timer resolves and interval starts
    vi.advanceTimersByTime(1)
    expect(typewriter.getState().currentLength).toBe(0)

    // Advance 50ms (first char delay): first char appears
    vi.advanceTimersByTime(50)
    expect(typewriter.getState().currentLength).toBe(1)
    expect(typewriter.getState().plainText).toBe('S')
  })

  it('progresses character-by-character through prefix and emphasized text', () => {
    const onUpdate = vi.fn()
    const onComplete = vi.fn()
    const typewriter = createTypewriter({
      fullText: 'Swipe right on your dream keyboard.',
      prefixLength: 20,
      initialDelay: 300,
      charDelay: 50,
      onUpdate,
      onComplete,
    })

    typewriter.start()

    // Pass initial delay
    vi.advanceTimersByTime(300)

    // Advance through the 20-character prefix "Swipe right on your "
    vi.advanceTimersByTime(50 * 20)
    expect(typewriter.getState().currentLength).toBe(20)
    expect(typewriter.getState().plainText).toBe('Swipe right on your ')
    expect(typewriter.getState().emText).toBe('')
    expect(typewriter.getState().isComplete).toBe(false)

    // Advance 1 character into the emphasized section "d"
    vi.advanceTimersByTime(50)
    expect(typewriter.getState().currentLength).toBe(21)
    expect(typewriter.getState().plainText).toBe('Swipe right on your ')
    expect(typewriter.getState().emText).toBe('d')
    expect(typewriter.getState().isComplete).toBe(false)
  })

  it('sets completion flag, renders full text, and fires onComplete', () => {
    const onComplete = vi.fn()
    const typewriter = createTypewriter({
      fullText: 'Swipe right on your dream keyboard.',
      prefixLength: 20,
      initialDelay: 300,
      charDelay: 50,
      onComplete,
    })

    typewriter.start()

    // Total time = initialDelay (300) + 35 chars * 50ms = 2050ms
    vi.advanceTimersByTime(300 + 35 * 50)

    const finalState = typewriter.getState()
    expect(finalState.isComplete).toBe(true)
    expect(finalState.currentLength).toBe(35)
    expect(finalState.plainText).toBe('Swipe right on your ')
    expect(finalState.emText).toBe('dream keyboard.')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('immediately completes full text without timers when reducedMotion is true', () => {
    const onUpdate = vi.fn()
    const onComplete = vi.fn()
    const typewriter = createTypewriter({
      fullText: 'Swipe right on your dream keyboard.',
      prefixLength: 20,
      reducedMotion: true,
      onUpdate,
      onComplete,
    })

    // Pre-filled on creation
    expect(typewriter.getState().isComplete).toBe(true)
    expect(typewriter.getState().plainText).toBe('Swipe right on your ')
    expect(typewriter.getState().emText).toBe('dream keyboard.')

    typewriter.start()

    expect(typewriter.getState().isComplete).toBe(true)
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plainText: 'Swipe right on your ',
        emText: 'dream keyboard.',
        isComplete: true,
      })
    )
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Advancing timers should have no pending work and should not fire onComplete again
    vi.advanceTimersByTime(5000)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('cleans up timers and halts progression when stopped', () => {
    const typewriter = createTypewriter({
      fullText: 'Swipe right on your dream keyboard.',
      initialDelay: 300,
      charDelay: 50,
    })

    typewriter.start()
    vi.advanceTimersByTime(300 + 50 * 5) // Typed 5 chars
    expect(typewriter.getState().currentLength).toBe(5)

    typewriter.stop()

    // Advance further — state remains frozen at 5
    vi.advanceTimersByTime(2000)
    expect(typewriter.getState().currentLength).toBe(5)
    expect(typewriter.getState().isComplete).toBe(false)
  })

  it('returns cleanup function from start() that halts timers', () => {
    const typewriter = createTypewriter({
      fullText: 'Hello World',
      initialDelay: 100,
      charDelay: 20,
    })

    const cleanup = typewriter.start()
    vi.advanceTimersByTime(100 + 20 * 2)
    expect(typewriter.getState().currentLength).toBe(2)

    cleanup()

    vi.advanceTimersByTime(500)
    expect(typewriter.getState().currentLength).toBe(2)
  })
})

describe('useTypewriter composable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('provides reactive refs and cleans up timers on component unmount', async () => {
    let capturedState = null

    const TestComponent = defineComponent({
      setup() {
        const state = useTypewriter({
          initialDelay: 200,
          charDelay: 40,
          reducedMotion: false,
        })
        capturedState = state
        return { ...state }
      },
      template: '<div>{{ plainText }}{{ emText }}</div>',
    })

    const wrapper = mount(TestComponent)

    expect(capturedState.plainText.value).toBe('')
    expect(capturedState.isComplete.value).toBe(false)

    // Advance past initial delay + 3 chars
    vi.advanceTimersByTime(200 + 40 * 3)
    await wrapper.vm.$nextTick()
    expect(capturedState.plainText.value.length).toBe(3)

    // Unmount the component to trigger onUnmounted cleanup
    wrapper.unmount()

    // Advancing further should not tick the typewriter
    vi.advanceTimersByTime(3000)
    expect(capturedState.plainText.value.length).toBe(3)
    expect(capturedState.isComplete.value).toBe(false)
  })

  it('honors reduced motion in useTypewriter', () => {
    const { plainText, emText, isComplete, reducedMotion } = useTypewriter({
      reducedMotion: true,
    })

    expect(reducedMotion.value).toBe(true)
    expect(plainText.value).toBe('Swipe right on your ')
    expect(emText.value).toBe('dream keyboard.')
    expect(isComplete.value).toBe(true)
  })
})

describe('isReducedMotionPreferred', () => {
  it('returns false when window or matchMedia is undefined', () => {
    const origMatchMedia = window.matchMedia
    delete window.matchMedia
    expect(isReducedMotionPreferred()).toBe(false)
    window.matchMedia = origMatchMedia
  })

  it('reflects matchMedia result for prefers-reduced-motion', () => {
    const origMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    expect(isReducedMotionPreferred()).toBe(true)
    window.matchMedia = origMatchMedia
  })
})
