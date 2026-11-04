/**
 * @fileoverview Unit tests for smooth scroll integration seam (Lenis + GSAP ScrollTrigger).
 * Verifies lifecycle management, ticker synchronization, prefers-reduced-motion compliance,
 * and scrollToTarget delegation / fallback behaviors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initSmoothScroll,
  destroySmoothScroll,
  getLenis,
  isReducedMotionPreferred,
  scrollToTarget,
} from '../../src/lib/smoothScroll.js'

describe('smoothScroll seam module', () => {
  beforeEach(() => {
    destroySmoothScroll()
  })

  afterEach(() => {
    destroySmoothScroll()
  })

  describe('isReducedMotionPreferred', () => {
    it('returns false when window or matchMedia is unavailable', () => {
      expect(isReducedMotionPreferred(null)).toBe(false)
      expect(isReducedMotionPreferred({})).toBe(false)
    })

    it('returns true when media query matches reduce', () => {
      const mockWin = {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      }
      expect(isReducedMotionPreferred(mockWin)).toBe(true)
      expect(mockWin.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    })

    it('returns false when media query does not match reduce', () => {
      const mockWin = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      }
      expect(isReducedMotionPreferred(mockWin)).toBe(false)
    })
  })

  describe('initSmoothScroll and destroySmoothScroll lifecycle', () => {
    it('returns null if win is null or undefined', () => {
      const instance = initSmoothScroll({ win: null })
      expect(instance).toBeNull()
      expect(getLenis()).toBeNull()
    })

    it('returns null if running in jsdom without an injected LenisClass', () => {
      const mockWin = {
        navigator: { userAgent: 'Mozilla/5.0 jsdom' },
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      }
      const instance = initSmoothScroll({ win: mockWin })
      expect(instance).toBeNull()
    })

    it('returns null if prefers-reduced-motion is enabled', () => {
      const mockWin = {
        navigator: { userAgent: 'Chrome/120' },
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      }
      const instance = initSmoothScroll({ win: mockWin })
      expect(instance).toBeNull()
      expect(getLenis()).toBeNull()
    })

    it('instantiates Lenis and wires GSAP ticker and ScrollTrigger updates', () => {
      let registeredScrollCb = null
      const mockLenisInstance = {
        on: vi.fn((event, cb) => {
          if (event === 'scroll') registeredScrollCb = cb
        }),
        raf: vi.fn(),
        destroy: vi.fn(),
      }
      const MockLenis = vi.fn().mockImplementation(() => mockLenisInstance)

      let registeredTickerFn = null
      const mockGsap = {
        registerPlugin: vi.fn(),
        ticker: {
          add: vi.fn((fn) => {
            registeredTickerFn = fn
          }),
          remove: vi.fn(),
          lagSmoothing: vi.fn(),
        },
      }

      const mockScrollTrigger = {
        update: vi.fn(),
      }

      const listeners = {}
      const mockMql = {
        matches: false,
        addEventListener: vi.fn((ev, cb) => {
          listeners[ev] = cb
        }),
        removeEventListener: vi.fn((ev) => {
          delete listeners[ev]
        }),
      }

      const mockWin = {
        navigator: { userAgent: 'Chrome/120' },
        matchMedia: vi.fn().mockReturnValue(mockMql),
      }

      const instance = initSmoothScroll({
        win: mockWin,
        LenisClass: MockLenis,
        gsapInstance: mockGsap,
        ScrollTriggerPlugin: mockScrollTrigger,
      })

      expect(instance).toBe(mockLenisInstance)
      expect(getLenis()).toBe(mockLenisInstance)
      expect(MockLenis).toHaveBeenCalledWith({
        duration: 1.05,
        smoothWheel: true,
        syncTouch: false,
      })

      // Verifies ScrollTrigger.update registration
      expect(mockLenisInstance.on).toHaveBeenCalledWith('scroll', mockScrollTrigger.update)

      // Verifies GSAP ticker connection and lag smoothing
      expect(mockGsap.ticker.add).toHaveBeenCalled()
      expect(mockGsap.ticker.lagSmoothing).toHaveBeenCalledWith(0)

      // Driving the ticker callback should convert seconds to milliseconds for Lenis.raf
      registeredTickerFn(0.016)
      expect(mockLenisInstance.raf).toHaveBeenCalledWith(16)

      // Calling initSmoothScroll again should return the existing active instance
      const duplicate = initSmoothScroll({ win: mockWin, LenisClass: MockLenis })
      expect(duplicate).toBe(mockLenisInstance)

      // Calling destroySmoothScroll should clean up ticker, listeners, and destroy instance
      destroySmoothScroll()
      expect(mockGsap.ticker.remove).toHaveBeenCalledWith(registeredTickerFn)
      expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
      expect(mockLenisInstance.destroy).toHaveBeenCalled()
      expect(getLenis()).toBeNull()
    })

    it('automatically tears down when prefers-reduced-motion becomes active', () => {
      const mockLenisInstance = {
        on: vi.fn(),
        raf: vi.fn(),
        destroy: vi.fn(),
      }
      const MockLenis = vi.fn().mockImplementation(() => mockLenisInstance)

      let motionChangeCb = null
      const mockMql = {
        matches: false,
        addEventListener: vi.fn((ev, cb) => {
          if (ev === 'change') motionChangeCb = cb
        }),
        removeEventListener: vi.fn(),
      }

      const mockWin = {
        navigator: { userAgent: 'Chrome/120' },
        matchMedia: vi.fn().mockReturnValue(mockMql),
      }

      initSmoothScroll({
        win: mockWin,
        LenisClass: MockLenis,
      })
      expect(getLenis()).toBe(mockLenisInstance)

      // Trigger motion change event indicating reduced motion was turned on
      motionChangeCb({ matches: true })
      expect(mockLenisInstance.destroy).toHaveBeenCalled()
      expect(getLenis()).toBeNull()
    })
  })

  describe('scrollToTarget delegation and fallback', () => {
    it('delegates to lenis.scrollTo when Lenis instance is active', () => {
      const mockLenisInstance = {
        on: vi.fn(),
        raf: vi.fn(),
        destroy: vi.fn(),
        scrollTo: vi.fn(),
      }
      const MockLenis = vi.fn().mockImplementation(() => mockLenisInstance)

      initSmoothScroll({
        win: { navigator: { userAgent: 'Chrome/120' }, matchMedia: () => ({ matches: false }) },
        LenisClass: MockLenis,
      })

      const handled = scrollToTarget('#target-section', { offset: -50, immediate: true })
      expect(handled).toBe(true)
      expect(mockLenisInstance.scrollTo).toHaveBeenCalledWith('#target-section', {
        offset: -50,
        immediate: true,
      })
    })

    it('falls back to window.scrollTo for numeric targets when Lenis is inactive', () => {
      const originalScrollTo = window.scrollTo
      window.scrollTo = vi.fn()

      try {
        const handled = scrollToTarget(350, { immediate: false })
        expect(handled).toBe(false)
        expect(window.scrollTo).toHaveBeenCalledWith({
          top: 350,
          behavior: 'smooth',
        })

        const handledImmediate = scrollToTarget(0, { immediate: true })
        expect(handledImmediate).toBe(false)
        expect(window.scrollTo).toHaveBeenCalledWith({
          top: 0,
          behavior: 'instant',
        })
      } finally {
        window.scrollTo = originalScrollTo
      }
    })

    it('falls back to element.scrollIntoView for DOM elements when Lenis is inactive', () => {
      const mockElement = {
        scrollIntoView: vi.fn(),
      }

      const handled = scrollToTarget(mockElement, { immediate: false })
      expect(handled).toBe(false)
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })

      const handledImmediate = scrollToTarget(mockElement, { immediate: true })
      expect(handledImmediate).toBe(false)
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'center',
      })
    })

    it('resolves string selectors to elements and falls back to scrollIntoView', () => {
      const el = document.createElement('div')
      el.id = 'test-layer'
      el.scrollIntoView = vi.fn()
      document.body.appendChild(el)

      try {
        const handled = scrollToTarget('#test-layer', { immediate: false })
        expect(handled).toBe(false)
        expect(el.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'center',
        })
      } finally {
        document.body.removeChild(el)
      }
    })
  })
})
