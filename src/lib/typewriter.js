/**
 * Typewriter animation helper and Vue composable.
 * Provides character-by-character text typing with layout shift prevention,
 * emphasized segment support, timer cleanup, and prefers-reduced-motion fallback.
 */

import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue'

const DEFAULT_FULL_TEXT = 'Swipe right on your dream keyboard.'
const DEFAULT_PREFIX_LENGTH = 20 // Characters in 'Swipe right on your '
const DEFAULT_CHAR_DELAY = 50 // Delay in ms between each character (~40-60ms)
const DEFAULT_INITIAL_DELAY = 300 // Initial pause in ms before typing begins (~300ms)

/**
 * Checks if the user or environment prefers reduced motion.
 * Safe for SSR and environments without window / matchMedia.
 *
 * @returns {boolean} True if reduced motion is requested.
 */
export function isReducedMotionPreferred() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Creates a pure typewriter controller with start, stop, and state querying.
 *
 * @param {Object} [options={}] Configuration options.
 * @param {string} [options.fullText='Swipe right on your dream keyboard.'] Complete string to type out.
 * @param {number} [options.prefixLength=20] Character count of plain prefix before the <em> emphasis.
 * @param {number} [options.charDelay=50] Milliseconds per character during typing.
 * @param {number} [options.initialDelay=300] Milliseconds to wait before typing starts.
 * @param {boolean} [options.reducedMotion=false] Whether to skip animation and complete immediately.
 * @param {(state: { plainText: string, emText: string, isComplete: boolean, currentLength: number }) => void} [options.onUpdate] Callback on every character update.
 * @param {() => void} [options.onComplete] Callback when typing finishes.
 * @returns {{ start: () => (() => void), stop: () => void, getState: () => { plainText: string, emText: string, isComplete: boolean, currentLength: number } }} Typewriter controls.
 */
export function createTypewriter(options = {}) {
  const fullText = options.fullText ?? DEFAULT_FULL_TEXT
  const prefixLength = options.prefixLength ?? (
    fullText === DEFAULT_FULL_TEXT ? DEFAULT_PREFIX_LENGTH : fullText.length
  )
  const charDelay = options.charDelay ?? DEFAULT_CHAR_DELAY
  const initialDelay = options.initialDelay ?? DEFAULT_INITIAL_DELAY
  const reducedMotion = options.reducedMotion ?? false
  const onUpdate = options.onUpdate
  const onComplete = options.onComplete

  let initialTimer = null
  let intervalTimer = null
  let currentLength = 0
  let isComplete = false

  /**
   * Computes the split plain / emphasized state for a given typed length.
   *
   * @param {number} len Number of characters currently typed.
   * @param {boolean} complete Whether the typing sequence is complete.
   * @returns {{ plainText: string, emText: string, isComplete: boolean, currentLength: number }} Current slice state.
   */
  const computeState = (len, complete) => {
    const plain = fullText.slice(0, Math.min(len, prefixLength))
    const em = len > prefixLength ? fullText.slice(prefixLength, len) : ''
    return {
      plainText: plain,
      emText: em,
      isComplete: complete,
      currentLength: len,
    }
  }

  // Pre-fill state if reduced motion is preferred or text is empty
  if (reducedMotion || fullText.length === 0) {
    currentLength = fullText.length
    isComplete = true
  }

  let state = computeState(currentLength, isComplete)

  /**
   * Cleans up all pending timers and stops typing.
   */
  const stop = () => {
    if (initialTimer !== null) {
      clearTimeout(initialTimer)
      initialTimer = null
    }
    if (intervalTimer !== null) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
  }

  /**
   * Starts the typewriter animation sequence.
   *
   * @returns {() => void} Cleanup function to stop typing.
   */
  const start = () => {
    stop()

    // Reduced motion or empty text completes immediately without scheduling timers
    if (reducedMotion || fullText.length === 0) {
      currentLength = fullText.length
      isComplete = true
      state = computeState(currentLength, isComplete)
      onUpdate?.(state)
      onComplete?.()
      return stop
    }

    // Reset progress to beginning before typing starts
    currentLength = 0
    isComplete = false
    state = computeState(0, false)
    onUpdate?.(state)

    // Initial pause before typing begins
    initialTimer = setTimeout(() => {
      initialTimer = null

      intervalTimer = setInterval(() => {
        currentLength += 1
        if (currentLength >= fullText.length) {
          currentLength = fullText.length
          isComplete = true
          stop()
          state = computeState(currentLength, true)
          onUpdate?.(state)
          onComplete?.()
        } else {
          state = computeState(currentLength, false)
          onUpdate?.(state)
        }
      }, charDelay)
    }, initialDelay)

    return stop
  }

  /**
   * Retrieves the current snapshot of typewriter state.
   *
   * @returns {{ plainText: string, emText: string, isComplete: boolean, currentLength: number }} Current state snapshot.
   */
  const getState = () => state

  return {
    start,
    stop,
    getState,
  }
}

/**
 * Vue composable for hero typewriter animation with reactive state and lifecycle management.
 *
 * @param {string|Object} [textOrOptions] Optional text string or configuration options.
 * @param {Object} [maybeOptions] Optional options if first argument was text string.
 * @returns {{
 *   plainText: import('vue').Ref<string>,
 *   emText: import('vue').Ref<string>,
 *   isComplete: import('vue').Ref<boolean>,
 *   reducedMotion: import('vue').Ref<boolean>,
 *   start: () => (() => void),
 *   stop: () => void
 * }} Reactive typewriter refs and control functions.
 */
export function useTypewriter(textOrOptions, maybeOptions) {
  const options = typeof textOrOptions === 'string'
    ? { fullText: textOrOptions, ...maybeOptions }
    : { ...textOrOptions }

  const reduced = typeof options.reducedMotion === 'boolean'
    ? options.reducedMotion
    : isReducedMotionPreferred()

  const fullText = options.fullText ?? DEFAULT_FULL_TEXT
  const prefixLength = options.prefixLength ?? (
    fullText === DEFAULT_FULL_TEXT ? DEFAULT_PREFIX_LENGTH : fullText.length
  )

  const plainText = ref(reduced ? fullText.slice(0, prefixLength) : '')
  const emText = ref(reduced ? fullText.slice(prefixLength) : '')
  const isComplete = ref(reduced || fullText.length === 0)
  const reducedMotion = ref(reduced)

  const controller = createTypewriter({
    ...options,
    reducedMotion: reduced,
    onUpdate(updated) {
      plainText.value = updated.plainText
      emText.value = updated.emText
      isComplete.value = updated.isComplete
    },
    onComplete() {
      isComplete.value = true
    },
  })

  const start = () => controller.start()
  const stop = () => controller.stop()

  // In Vue component context, auto-start on mount and guarantee timer cleanup on unmount
  if (getCurrentInstance()) {
    onMounted(() => {
      start()
    })
    onUnmounted(() => {
      stop()
    })
  }

  return {
    plainText,
    emText,
    isComplete,
    reducedMotion,
    start,
    stop,
  }
}
