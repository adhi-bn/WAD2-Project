/**
 * @fileoverview Pure unit tests for scroll progress calculation and bottom collapse behavior.
 * Validates computeStoryProgress against various viewport heights, forward/reverse scrolling,
 * and degenerate edge cases.
 */

import { describe, it, expect } from 'vitest'
import { computeStoryProgress } from '../../src/lib/scrollProgress.js'
import { computeGuideExplosionFactor } from '../../src/lib/explodedAnatomyScene.js'

describe('computeStoryProgress', () => {
  // Standard test scenario:
  // A landing page where the story begins at startY = 800 and ends at endY = 4800 (total = 4000).
  // Total page scrollHeight = 5200.
  const startY = 800
  const endY = 4800
  const pageHeight = 5200

  describe('Top and before-start behavior', () => {
    it('returns 0 when scrolled to the very top (scrollY = 0)', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH
      const progress = computeStoryProgress({
        scrollY: 0,
        viewportH,
        startY,
        endY,
        maxScroll,
      })

      expect(progress).toBe(0)
    })

    it('returns 0 when scroll position has not yet reached story midpoint threshold', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH

      // Start coordinate is 800. Viewport midpoint threshold: scrollY + 400 < 800 => scrollY < 400
      expect(computeStoryProgress({ scrollY: 100, viewportH, startY, endY, maxScroll })).toBe(0)
      expect(computeStoryProgress({ scrollY: 399, viewportH, startY, endY, maxScroll })).toBe(0)
      expect(computeStoryProgress({ scrollY: 400, viewportH, startY, endY, maxScroll })).toBe(0)
    })

    it('returns 0 for negative scrollY (elastic rubber-band overscroll at page top)', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH

      expect(computeStoryProgress({ scrollY: -50, viewportH, startY, endY, maxScroll })).toBe(0)
      expect(computeStoryProgress({ scrollY: -200, viewportH, startY, endY, maxScroll })).toBe(0)
    })
  })

  describe('Mid-scroll progression', () => {
    it('returns expected normalized intermediate values proportional to effective range', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH // 4400
      // maxCurrent = 4400 + 400 - 800 = 4000.
      // total = 4800 - 800 = 4000.
      // effectiveRange = min(4000, 4000) = 4000.

      // At scrollY = 1400: current = 1400 + 400 - 800 = 1000 => progress = 1000 / 4000 = 0.25
      const progressQuarter = computeStoryProgress({
        scrollY: 1400,
        viewportH,
        startY,
        endY,
        maxScroll,
      })
      expect(progressQuarter).toBeCloseTo(0.25, 4)

      // At scrollY = 2400: current = 2400 + 400 - 800 = 2000 => progress = 2000 / 4000 = 0.5
      const progressHalf = computeStoryProgress({
        scrollY: 2400,
        viewportH,
        startY,
        endY,
        maxScroll,
      })
      expect(progressHalf).toBeCloseTo(0.5, 4)

      // At scrollY = 3400: current = 3400 + 400 - 800 = 3000 => progress = 3000 / 4000 = 0.75
      const progressThreeQuarters = computeStoryProgress({
        scrollY: 3400,
        viewportH,
        startY,
        endY,
        maxScroll,
      })
      expect(progressThreeQuarters).toBeCloseTo(0.75, 4)
    })
  })

  describe('Bottom collapse (scrollY = maxScroll) across multiple viewport heights (AC-1)', () => {
    // Test viewport heights explicitly called out in AC-3: 600px, 800px, 1080px, 1200px
    const testViewports = [600, 800, 1080, 1200]

    for (const viewportH of testViewports) {
      it(`returns exactly 1.0 at scrollY = maxScroll for viewport height ${viewportH}px`, () => {
        const maxScroll = pageHeight - viewportH
        const progress = computeStoryProgress({
          scrollY: maxScroll,
          viewportH,
          startY,
          endY,
          maxScroll,
        })

        // Progress must be exactly 1 (which is >= 0.96)
        expect(progress).toBe(1)

        // When progress >= 0.96, the 3D model collapses back to factor 0.0
        const explosionFactor = computeGuideExplosionFactor(progress)
        expect(explosionFactor).toBe(0.0)
      })
    }

    it('returns 1.0 when scrollY exceeds maxScroll (elastic overscroll at bottom)', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH
      const progress = computeStoryProgress({
        scrollY: maxScroll + 150,
        viewportH,
        startY,
        endY,
        maxScroll,
      })

      expect(progress).toBe(1)
    })

    it('guarantees progress = 1.0 even when the story end element is placed below reachable midpoint', () => {
      // Scenario where endY is 6000 but the page ends at 5000 (end element is near or below page bottom)
      const storyEndY = 6000
      const pageH = 5000
      const viewportH = 800
      const maxScroll = pageH - viewportH // 4200

      const progressAtBottom = computeStoryProgress({
        scrollY: maxScroll,
        viewportH,
        startY: 600,
        endY: storyEndY,
        maxScroll,
      })

      expect(progressAtBottom).toBe(1)
    })
  })

  describe('Smooth forward and backward progression', () => {
    it('produces monotonically non-decreasing progress when scrolling forward', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH
      const stepSize = 25
      let prevProgress = -1

      for (let y = 0; y <= maxScroll; y += stepSize) {
        const progress = computeStoryProgress({
          scrollY: y,
          viewportH,
          startY,
          endY,
          maxScroll,
        })

        expect(progress).toBeGreaterThanOrEqual(prevProgress)
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(1)
        prevProgress = progress
      }

      // Reaches 1 at the end
      expect(prevProgress).toBe(1)
    })

    it('reverses smoothly when scrolling back up', () => {
      const viewportH = 800
      const maxScroll = pageHeight - viewportH
      const stepSize = 25
      let prevProgress = 2

      for (let y = maxScroll; y >= 0; y -= stepSize) {
        const progress = computeStoryProgress({
          scrollY: y,
          viewportH,
          startY,
          endY,
          maxScroll,
        })

        expect(progress).toBeLessThanOrEqual(prevProgress)
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(1)
        prevProgress = progress
      }

      // Reaches 0 at the top
      expect(prevProgress).toBe(0)
    })
  })

  describe('Degenerate cases and boundary safety', () => {
    it('returns 0 when total <= 0 (endY <= startY)', () => {
      // endY equal to startY
      expect(
        computeStoryProgress({
          scrollY: 500,
          viewportH: 800,
          startY: 1000,
          endY: 1000,
          maxScroll: 2000,
        })
      ).toBe(0)

      // endY before startY (inverted geometry)
      expect(
        computeStoryProgress({
          scrollY: 500,
          viewportH: 800,
          startY: 1000,
          endY: 500,
          maxScroll: 2000,
        })
      ).toBe(0)
    })

    it('returns 0 when effectiveRange <= 0', () => {
      // Page is shorter than startY so maxCurrent <= 0
      expect(
        computeStoryProgress({
          scrollY: 0,
          viewportH: 600,
          startY: 2000,
          endY: 3000,
          maxScroll: 100, // maxCurrent = 100 + 300 - 2000 = -1600 <= 0
        })
      ).toBe(0)

      // Negative maxScroll passed
      expect(
        computeStoryProgress({
          scrollY: 0,
          viewportH: 600,
          startY: 1000,
          endY: 2000,
          maxScroll: -500,
        })
      ).toBe(0)
    })

    it('safely handles non-finite and missing parameters without throwing', () => {
      // No arguments
      expect(computeStoryProgress()).toBe(0)

      // Empty object
      expect(computeStoryProgress({})).toBe(0)

      // Null and undefined guards
      expect(computeStoryProgress({ scrollY: null, viewportH: undefined })).toBe(0)

      // NaN guards on all properties
      expect(
        computeStoryProgress({
          scrollY: NaN,
          viewportH: 800,
          startY: 1000,
          endY: 3000,
          maxScroll: 2000,
        })
      ).toBe(0)

      expect(
        computeStoryProgress({
          scrollY: 500,
          viewportH: NaN,
          startY: 1000,
          endY: 3000,
          maxScroll: 2000,
        })
      ).toBe(0)

      expect(
        computeStoryProgress({
          scrollY: 500,
          viewportH: 800,
          startY: NaN,
          endY: 3000,
          maxScroll: 2000,
        })
      ).toBe(0)

      expect(
        computeStoryProgress({
          scrollY: 500,
          viewportH: 800,
          startY: 1000,
          endY: NaN,
          maxScroll: 2000,
        })
      ).toBe(0)

      // When maxScroll is NaN or undefined, it cleanly falls back to total
      const progressWithoutMax = computeStoryProgress({
        scrollY: 2400,
        viewportH: 800,
        startY: 800,
        endY: 4800,
        maxScroll: NaN,
      })
      // current = 2400 + 400 - 800 = 2000. total = 4000. progress = 2000 / 4000 = 0.5
      expect(progressWithoutMax).toBeCloseTo(0.5, 4)

      const progressWithNullMax = computeStoryProgress({
        scrollY: 2400,
        viewportH: 800,
        startY: 800,
        endY: 4800,
        maxScroll: null,
      })
      expect(progressWithNullMax).toBeCloseTo(0.5, 4)

      // Infinite scrollY handled safely (non-finite returns 0)
      expect(
        computeStoryProgress({
          scrollY: Infinity,
          viewportH: 800,
          startY: 800,
          endY: 4800,
          maxScroll: 4000,
        })
      ).toBe(0)

      expect(
        computeStoryProgress({
          scrollY: -Infinity,
          viewportH: 800,
          startY: 800,
          endY: 4800,
          maxScroll: 4000,
        })
      ).toBe(0)

      // Very large finite scrollY clamped to 1
      expect(
        computeStoryProgress({
          scrollY: 100000,
          viewportH: 800,
          startY: 800,
          endY: 4800,
          maxScroll: 4000,
        })
      ).toBe(1)
    })
  })
})
