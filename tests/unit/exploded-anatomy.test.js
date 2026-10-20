/**
 * @fileoverview Pure unit tests for 3D Exploded Anatomy domain data, layout geometry,
 * and mathematical explosion curves. Zero DOM or browser dependencies.
 */

import { describe, it, expect } from 'vitest'
import {
  ANATOMY_LAYERS,
  BAREBONES_BUNDLED_LAYER_IDS,
  computeGuideExplosionFactor,
  computeExplosionFactor,
} from '../../src/lib/explodedAnatomyScene.js'
import {
  KEYBOARD_DIMENSIONS,
  SWITCH_LAYOUT_POSITIONS,
} from '../../src/lib/keyboardSwitchLayout.js'
import {
  ANATOMY_GUIDE_STEPS,
  ANATOMY_GUIDE_OUTRO,
} from '../../src/lib/anatomyGuide.js'

describe('Anatomy Layers Domain Schema', () => {
  it('defines exactly 6 physical layers in strict top-to-bottom order', () => {
    expect(ANATOMY_LAYERS).toHaveLength(6)

    const expectedOrder = ['keycaps', 'switches', 'plate', 'pcb', 'foam', 'case']
    const actualOrder = ANATOMY_LAYERS.map((layer) => layer.id)
    expect(actualOrder).toEqual(expectedOrder)
  })

  it('brackets Plate, PCB, Foam, and Case as Barebones kit bundled internals', () => {
    expect(BAREBONES_BUNDLED_LAYER_IDS).toEqual(['plate', 'pcb', 'foam', 'case'])

    for (const layer of ANATOMY_LAYERS) {
      if (BAREBONES_BUNDLED_LAYER_IDS.includes(layer.id)) {
        expect(layer.isBarebonesInternals).toBe(true)
        expect(layer.partCategory).toBe('Barebones kit')
      } else {
        expect(layer.isBarebonesInternals).toBe(false)
      }
    }
  })

  it('provides valid hex color tokens and descriptions for each layer', () => {
    const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
    for (const layer of ANATOMY_LAYERS) {
      expect(layer.color).toMatch(hexRegex)
      expect(layer.description.length).toBeGreaterThan(15)
      expect(typeof layer.yOffset).toBe('number')
    }
  })
})

describe('Keyboard Switch Layout and Physical Dimensions', () => {
  it('defines valid physical dimensions matching Attack Shark X85 CAD model', () => {
    expect(KEYBOARD_DIMENSIONS.width).toBeCloseTo(0.3225, 3)
    expect(KEYBOARD_DIMENSIONS.depth).toBeCloseTo(0.1382, 3)
    expect(KEYBOARD_DIMENSIONS.plateWidth).toBeCloseTo(0.3061, 3)
    expect(KEYBOARD_DIMENSIONS.plateDepth).toBeCloseTo(0.1188, 3)
    expect(KEYBOARD_DIMENSIONS.pcbWidth).toBeCloseTo(0.304, 3)
    expect(KEYBOARD_DIMENSIONS.pcbDepth).toBeCloseTo(0.116, 3)
    expect(KEYBOARD_DIMENSIONS.slopeRad).toBeCloseTo(0.0735, 3)
    expect(KEYBOARD_DIMENSIONS.plateCenter).toBeDefined()
    expect(typeof KEYBOARD_DIMENSIONS.plateCenter.x).toBe('number')
    expect(typeof KEYBOARD_DIMENSIONS.plateCenter.y).toBe('number')
    expect(typeof KEYBOARD_DIMENSIONS.plateCenter.z).toBe('number')
  })

  it('defines exactly 81 switch positions within outer keyboard boundaries', () => {
    expect(SWITCH_LAYOUT_POSITIONS).toHaveLength(81)

    const halfWidth = KEYBOARD_DIMENSIONS.width / 2
    const halfDepth = KEYBOARD_DIMENSIONS.depth / 2

    for (const pos of SWITCH_LAYOUT_POSITIONS) {
      expect(pos.x).toBeGreaterThan(-halfWidth)
      expect(pos.x).toBeLessThan(halfWidth)
      expect(pos.z).toBeGreaterThan(-halfDepth)
      expect(pos.z).toBeLessThan(halfDepth)
      expect(Number.isFinite(pos.y)).toBe(true)
    }
  })
})

describe('Mathematical Explosion Factor Curves', () => {
  it('returns 0.0 at progress <= 0 and ramps smoothly during intro section', () => {
    expect(computeGuideExplosionFactor(0)).toBe(0.0)
    expect(computeGuideExplosionFactor(-0.5)).toBe(0.0)
    expect(computeGuideExplosionFactor(0.05)).toBeCloseTo(0.0, 2)

    // Active separation begins after hero and reaches full explosion by progress 0.22
    const factorIntro = computeGuideExplosionFactor(0.16)
    expect(factorIntro).toBeGreaterThan(0.0)
    expect(factorIntro).toBeLessThan(1.0)
  })

  it('holds full explosion (1.0) across all 6 guided layer cards', () => {
    // 0.18 through 0.82 is the guided card range holding at 1.0
    expect(computeGuideExplosionFactor(0.20)).toBe(1.0)
    expect(computeGuideExplosionFactor(0.50)).toBe(1.0)
    expect(computeGuideExplosionFactor(0.80)).toBe(1.0)
  })

  it('reassembles smoothly to 0.0 on the outro card', () => {
    const factorOutro = computeGuideExplosionFactor(0.88)
    expect(factorOutro).toBeGreaterThan(0.0)
    expect(factorOutro).toBeLessThan(1.0)

    expect(computeGuideExplosionFactor(0.96)).toBe(0.0)
    expect(computeGuideExplosionFactor(1.0)).toBe(0.0)
    expect(computeGuideExplosionFactor(1.5)).toBe(0.0)
  })

  it('returns staticFactor when reducedMotion is true', () => {
    expect(computeGuideExplosionFactor(0.0, { reducedMotion: true })).toBe(0.72)
    expect(computeGuideExplosionFactor(0.5, { reducedMotion: true })).toBe(0.72)
    expect(computeGuideExplosionFactor(1.0, { reducedMotion: true })).toBe(0.72)
    expect(computeGuideExplosionFactor(0.0, { reducedMotion: true, staticFactor: 0.8 })).toBe(0.8)
  })

  it('handles non-numeric and edge inputs gracefully', () => {
    expect(computeGuideExplosionFactor(NaN)).toBe(0.0)
    expect(computeGuideExplosionFactor(undefined)).toBe(0.0)
    expect(computeGuideExplosionFactor(null)).toBe(0.0)
  })

  it('legacy computeExplosionFactor curve maintains compatibility', () => {
    expect(computeExplosionFactor(0)).toBe(0.0)
    expect(computeExplosionFactor(0.6)).toBe(1.0)
    expect(computeExplosionFactor(1.0)).toBe(0.0)
    expect(computeExplosionFactor(0, { reducedMotion: true })).toBe(0.72)
  })
})

describe('Anatomy Guide Steps Data Structure', () => {
  it('defines 6 steps matching ANATOMY_LAYERS IDs', () => {
    expect(ANATOMY_GUIDE_STEPS).toHaveLength(6)
    const stepIds = ANATOMY_GUIDE_STEPS.map((s) => s.id)
    expect(stepIds).toEqual(['keycaps', 'switches', 'plate', 'pcb', 'foam', 'case'])
  })

  it('contains valid structural labels, summaries, and fact tuples', () => {
    for (const step of ANATOMY_GUIDE_STEPS) {
      expect(typeof step.eyebrow).toBe('string')
      expect(typeof step.title).toBe('string')
      expect(typeof step.summary).toBe('string')
      expect(step.summary.length).toBeGreaterThan(20)
      expect(Array.isArray(step.facts)).toBe(true)
      expect(step.facts.length).toBeGreaterThanOrEqual(2)

      for (const [label, value] of step.facts) {
        expect(typeof label).toBe('string')
        expect(typeof value).toBe('string')
        expect(label.length).toBeGreaterThan(0)
        expect(value.length).toBeGreaterThan(0)
      }
    }
  })

  it('does not contain the banned synonym "component" for Part', () => {
    const allText = JSON.stringify(ANATOMY_GUIDE_STEPS) + JSON.stringify(ANATOMY_GUIDE_OUTRO)
    expect(allText.toLowerCase()).not.toContain('component')
  })

  it('strictly adheres to non-acoustic simulation disclaimer', () => {
    const allText = JSON.stringify(ANATOMY_GUIDE_STEPS)
    // Confirms marketing acoustic claims were neutralized to structural damping descriptions
    expect(allText).not.toContain('deep, muted keystroke profile')
    expect(allText).not.toContain('dampen hollow resonance')
    expect(allText).not.toContain('Gasket Acoustic Stack')
  })
})
