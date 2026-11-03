/**
 * @fileoverview Smooth scrolling seam module integrating Lenis with GSAP ScrollTrigger.
 * Provides synchronized smooth inertia scrolling, prefers-reduced-motion compliance,
 * and graceful fallback to native scrolling.
 */

import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register ScrollTrigger plugin with GSAP safely
if (typeof gsap !== 'undefined' && typeof gsap.registerPlugin === 'function') {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'function') {
    try {
      gsap.registerPlugin(ScrollTrigger)
    } catch {
      // Gracefully ignore in partial or mock DOM environments lacking matchMedia
    }
  }
}

/**
 * Active singleton instance of Lenis.
 * @type {Lenis|null}
 */
let lenisInstance = null

/**
 * Active GSAP instance controlling the ticker.
 * @type {Object|null}
 */
let activeGsap = null

/**
 * Ticker callback function bound to the active Lenis instance.
 * @type {Function|null}
 */
let activeTickerFn = null

/**
 * Active media query list for prefers-reduced-motion.
 * @type {MediaQueryList|null}
 */
let activeMql = null

/**
 * Active change listener for prefers-reduced-motion.
 * @type {Function|null}
 */
let activeMotionListener = null

/**
 * Checks if the user prefers reduced motion via the matchMedia API.
 *
 * @param {Window|Object|null} [win=typeof window !== 'undefined' ? window : null] - Window or mock window.
 * @returns {boolean} True if prefers-reduced-motion matches.
 */
export function isReducedMotionPreferred(win = typeof window !== 'undefined' ? window : null) {
  return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
}

/**
 * Initializes Lenis smooth scrolling and synchronizes its render loop with GSAP's ticker.
 * Bypasses initialization if reduced motion is preferred or if running in headless jsdom (unless injected).
 *
 * @param {Object} [options={}] - Configuration options for initialization and testing.
 * @param {Window|Object} [options.win] - Custom window object (useful for tests).
 * @param {typeof Lenis} [options.LenisClass] - Custom Lenis class constructor.
 * @param {Object} [options.gsapInstance] - Custom GSAP instance.
 * @param {Object} [options.ScrollTriggerPlugin] - Custom ScrollTrigger plugin.
 * @param {Object} [options.lenisOptions] - Additional options forwarded to Lenis constructor.
 * @returns {Lenis|null} The initialized Lenis instance or null if disabled.
 */
export function initSmoothScroll(options = {}) {
  const win = options.win !== undefined ? options.win : (typeof window !== 'undefined' ? window : null)
  if (!win) return null

  // Skip smooth scroll inside jsdom test environments unless a mock LenisClass is explicitly provided
  const isJsdom = Boolean(win.navigator?.userAgent?.includes('jsdom'))
  if (isJsdom && !options.LenisClass) {
    return null
  }

  // Honor prefers-reduced-motion accessibility preference
  if (isReducedMotionPreferred(win)) {
    return null
  }

  // Return existing instance if already initialized to maintain a single scroll manager
  if (lenisInstance) {
    return lenisInstance
  }

  const ActiveLenis = options.LenisClass || Lenis
  const ActiveGsap = options.gsapInstance || gsap
  const ActiveScrollTrigger = options.ScrollTriggerPlugin || ScrollTrigger

  // Ensure ScrollTrigger is registered on the active GSAP instance
  if (ActiveGsap && ActiveScrollTrigger && typeof ActiveGsap.registerPlugin === 'function') {
    if (typeof win === 'undefined' || typeof win?.matchMedia === 'function') {
      try {
        ActiveGsap.registerPlugin(ActiveScrollTrigger)
      } catch {
        // Gracefully ignore in partial or mock DOM environments lacking matchMedia
      }
    }
  }

  // Instantiate Lenis with comfortable inertia duration and non-blocking touch sync
  lenisInstance = new ActiveLenis({
    duration: 1.05,
    smoothWheel: true,
    syncTouch: false,
    ...options.lenisOptions,
  })

  // Synchronize Lenis scroll updates with ScrollTrigger position tracking
  if (ActiveScrollTrigger && typeof ActiveScrollTrigger.update === 'function') {
    lenisInstance.on('scroll', ActiveScrollTrigger.update)
  }

  // Drive Lenis requestAnimationFrame through GSAP's synchronized ticker
  const tickerFn = (time) => {
    // Lenis expects milliseconds while GSAP ticker supplies seconds
    lenisInstance?.raf(time * 1000)
  }
  activeTickerFn = tickerFn
  activeGsap = ActiveGsap

  if (ActiveGsap?.ticker) {
    ActiveGsap.ticker.add(tickerFn)
    if (typeof ActiveGsap.ticker.lagSmoothing === 'function') {
      // Disable lag smoothing to prevent scroll jumping under heavy frame budgets
      ActiveGsap.ticker.lagSmoothing(0)
    }
  }

  // Listen for dynamic changes to prefers-reduced-motion to cleanly tear down if enabled
  if (win.matchMedia) {
    const mql = win.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = (event) => {
      const matches = Boolean(event?.matches ?? win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
      if (matches) {
        destroySmoothScroll()
      }
    }

    if (mql?.addEventListener) {
      mql.addEventListener('change', onMotionChange)
    } else if (mql?.addListener) {
      mql.addListener(onMotionChange)
    }

    activeMql = mql
    activeMotionListener = onMotionChange
  }

  return lenisInstance
}

/**
 * Tears down the active Lenis instance, detaches GSAP ticker callbacks, and removes media query listeners.
 */
export function destroySmoothScroll() {
  if (activeTickerFn && activeGsap?.ticker?.remove) {
    activeGsap.ticker.remove(activeTickerFn)
  }
  activeTickerFn = null
  activeGsap = null

  if (activeMql && activeMotionListener) {
    if (activeMql.removeEventListener) {
      activeMql.removeEventListener('change', activeMotionListener)
    } else if (activeMql.removeListener) {
      activeMql.removeListener(activeMotionListener)
    }
  }
  activeMql = null
  activeMotionListener = null

  if (lenisInstance) {
    if (typeof lenisInstance.destroy === 'function') {
      lenisInstance.destroy()
    }
    lenisInstance = null
  }
}

/**
 * Retrieves the current active Lenis instance, if any.
 *
 * @returns {Lenis|null} The active Lenis instance or null.
 */
export function getLenis() {
  return lenisInstance
}

/**
 * Scrolls to a target offset, element, or selector.
 * Uses Lenis smooth scrolling when active, otherwise falls back to window.scrollTo or element.scrollIntoView.
 *
 * @param {number|string|HTMLElement} target - Target pixel offset, CSS selector, or DOM element.
 * @param {Object} [options={}] - Options passed to Lenis or fallback scroll methods.
 * @param {boolean} [options.immediate=false] - Whether to jump immediately without inertia animation.
 * @param {number} [options.offset=0] - Pixel offset adjustment (for Lenis).
 * @param {number} [options.duration] - Optional animation duration override in seconds (for Lenis).
 * @returns {boolean} True if handled by Lenis, false if handled by native fallback or unhandled.
 */
export function scrollToTarget(target, options = {}) {
  // Delegate directly to Lenis if smooth scrolling is currently initialized
  if (lenisInstance && typeof lenisInstance.scrollTo === 'function') {
    lenisInstance.scrollTo(target, options)
    return true
  }

  // Fallback 1: Numeric top scroll position via window.scrollTo
  if (typeof target === 'number' && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({
      top: target,
      behavior: options.immediate ? 'instant' : 'smooth',
    })
    return false
  }

  // Resolve target if passed as a CSS selector string
  let element = target
  if (typeof target === 'string' && typeof document !== 'undefined') {
    element = document.querySelector(target)
  }

  // Fallback 2: DOM element scrollIntoView
  if (element && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({
      behavior: options.immediate ? 'instant' : 'smooth',
      block: 'center',
    })
    return false
  }

  return false
}
