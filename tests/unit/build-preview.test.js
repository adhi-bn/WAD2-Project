/**
 * @fileoverview Unit tests for 3D Build Preview scene engine and domain helpers.
 * Tests 3-layer ADR-0008 boundary, Part presets, Part normalization, drop curves,
 * Three.js scene orchestration, camera presets, and GPU resource disposal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import {
  BUILD_PREVIEW_LAYERS,
  BUILD_PREVIEW_LAYER_IDS,
  normalizePreviewPart,
  computeDropOffset,
  isColorLight,
  isWebGLAvailable,
  createBuildPreviewScene,
  ensureTopDownKeycapUVs,
  loadKeycapTexture,
  loadKeycapLegendTexture,
  LEGEND_TEXTURE_PATHS,
  textureCache,
  LAYOUT_SCALES,
  LAYOUT_MODELS,
  KEYCAP_COLORWAYS,
  getKeycapColorway,
  applyBarebonesGeometryVariant,
  DEFAULT_CAMERA_PRESETS,
  TOP_LEGEND_TEXTURE_PATHS,
  loadTopLegendTexture,
  createTopLegendsOverlay,
  isSideLegendMesh,
} from '../../src/lib/buildPreviewScene.js'
import {
  SWITCH_LAYOUTS,
  SWITCH_LAYOUT_POSITIONS,
  SWITCH_LAYOUT_POSITIONS_60,
  SWITCH_LAYOUT_POSITIONS_100,
} from '../../src/lib/keyboardSwitchLayout.js'
import { checkCompatibility } from '../../src/domain/build.js'

/**
 * Test fixture presets for barebones, switches, and keycaps.
 */
const PREVIEW_PART_PRESETS = Object.freeze({
  barebones: Object.freeze([
    Object.freeze({
      id: 'bb-frosted-pc',
      name: 'Frosted Polycarbonate Base',
      price: 135,
      socket: 'hotswap',
      pin: null,
      layout: 'ansi',
      color: '#e2e8f0',
      accentColor: '#94a3b8',
      stemColor: null,
      finish: 'Frosted Polycarbonate',
      metalness: 0.1,
      roughness: 0.35,
      opacity: 0.85,
    }),
    Object.freeze({
      id: 'bb-navy-alu',
      name: 'Anodized Navy Aluminum Base',
      price: 185,
      socket: 'hotswap',
      pin: null,
      layout: 'ansi',
      color: '#1e293b',
      accentColor: '#38bdf8',
      stemColor: null,
      finish: 'Anodized Aluminum',
      metalness: 0.8,
      roughness: 0.25,
      opacity: 1.0,
    }),
    Object.freeze({
      id: 'bb-retro-cream',
      name: 'Retro Cream Base',
      price: 120,
      socket: 'hotswap',
      pin: null,
      layout: 'ansi',
      color: '#fef3c7',
      accentColor: '#f59e0b',
      stemColor: null,
      finish: 'Powder-coated Matte',
      metalness: 0.15,
      roughness: 0.65,
      opacity: 1.0,
    }),
  ]),
  switches: Object.freeze([
    Object.freeze({
      id: 'sw-tangerine',
      name: 'C³Equalz Tangerine Linear',
      price: 65,
      socket: null,
      pin: '5-pin',
      layout: null,
      color: '#ea580c',
      accentColor: '#22c55e',
      stemColor: '#22c55e',
      finish: 'Translucent UHMWPE Housing',
      metalness: 0.05,
      roughness: 0.25,
      opacity: 0.9,
    }),
    Object.freeze({
      id: 'sw-panda',
      name: 'Holy Panda Tactile',
      price: 75,
      socket: null,
      pin: '5-pin',
      layout: null,
      color: '#f8fafc',
      accentColor: '#f97316',
      stemColor: '#f97316',
      finish: 'Solid Nylon / Polycarbonate',
      metalness: 0.05,
      roughness: 0.5,
      opacity: 1.0,
    }),
    Object.freeze({
      id: 'sw-blue',
      name: 'Gateron Blue Clicky (3-pin)',
      price: 35,
      socket: null,
      pin: '3-pin',
      layout: null,
      color: '#0284c7',
      accentColor: '#ffffff',
      stemColor: '#0284c7',
      finish: 'Translucent Polycarbonate',
      metalness: 0.05,
      roughness: 0.35,
      opacity: 0.85,
    }),
  ]),
  keycaps: Object.freeze([
    Object.freeze({
      id: 'kc-botanical',
      name: 'Cherry Botanical PBT Keycaps',
      price: 85,
      socket: null,
      pin: null,
      layout: 'ansi',
      color: '#166534',
      accentColor: '#86efac',
      stemColor: null,
      finish: 'Dye-sub PBT Matte',
      metalness: 0.05,
      roughness: 0.65,
      opacity: 1.0,
      textureUrl: null,
      artMode: null,
      legendStyle: 'side',
    }),
    Object.freeze({
      id: 'kc-laser',
      name: 'GMK Laser Double-shot Keycaps',
      price: 140,
      socket: null,
      pin: null,
      layout: 'ansi',
      color: '#312e81',
      accentColor: '#ec4899',
      stemColor: null,
      finish: 'Double-shot ABS Semi-gloss',
      metalness: 0.05,
      roughness: 0.45,
      opacity: 1.0,
      textureUrl: null,
      artMode: null,
      legendStyle: 'top',
    }),
    Object.freeze({
      id: 'kc-french-iso',
      name: 'Retro Classic ISO French AZERTY',
      price: 55,
      socket: null,
      pin: null,
      layout: 'iso',
      color: '#e2d9cc',
      accentColor: '#b45309',
      stemColor: null,
      finish: 'Textured PBT',
      metalness: 0.05,
      roughness: 0.8,
      opacity: 1.0,
      textureUrl: null,
      artMode: null,
      legendStyle: 'top',
    }),
    Object.freeze({
      id: 'theme',
      name: 'Themed PBT Keycaps (Le Chaton Anime Mural)',
      price: 69,
      socket: null,
      pin: null,
      layout: 'ansi',
      color: '#f8fafc',
      accentColor: '#f97316',
      stemColor: null,
      finish: 'Dye-sub PBT Mural',
      metalness: 0.05,
      roughness: 0.75,
      opacity: 1.0,
      textureUrl: '/textures/keycaps/anime-cat-town.jpg',
      artMode: 'full',
      legendColor: '#ffffff',
      legendEmissive: '#fef08a',
      legendEmissiveIntensity: 0.75,
      legendStyle: 'side',
    }),
    Object.freeze({
      id: 'kanagawa',
      name: 'Great Wave Kanagawa Dye-Sub Keycaps',
      price: 79,
      socket: null,
      pin: null,
      layout: 'ansi',
      color: '#f8fafc',
      accentColor: '#0284c7',
      stemColor: null,
      finish: 'Dye-sub PBT Mural',
      metalness: 0.05,
      roughness: 0.75,
      opacity: 1.0,
      textureUrl: '/textures/keycaps/kanagawa-wave.jpg',
      artMode: 'full',
      legendColor: '#ffffff',
      legendEmissive: '#38bdf8',
      legendEmissiveIntensity: 0.85,
      legendStyle: 'side',
    }),
  ]),
})

const STARTER_BUILD_PARTS = Object.freeze({
  barebones: PREVIEW_PART_PRESETS.barebones[0],
  switches: PREVIEW_PART_PRESETS.switches[0],
  keycaps: PREVIEW_PART_PRESETS.keycaps[0],
})


/**
 * Creates a mock WebGL renderer for testing in jsdom.
 *
 * @param {object} params
 * @param {HTMLCanvasElement} params.canvas
 * @returns {object} Mock renderer.
 */
function createMockRenderer({ canvas }) {
  return {
    domElement: canvas,
    render: vi.fn(),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    dispose: vi.fn(),
    toneMapping: 0,
    toneMappingExposure: 1,
    outputColorSpace: THREE.SRGBColorSpace,
  }
}

describe('3D Build Preview Layers Domain Schema (ADR-0008)', () => {
  it('defines strictly 3 active visual layers in assembled order', () => {
    expect(BUILD_PREVIEW_LAYERS).toHaveLength(3)

    const expectedIds = ['barebones', 'switches', 'keycaps']
    const actualIds = BUILD_PREVIEW_LAYERS.map((layer) => layer.id)
    expect(actualIds).toEqual(expectedIds)
    expect(BUILD_PREVIEW_LAYER_IDS).toEqual(expectedIds)
  })

  it('excludes internal layers (Plate, PCB, Foam, Stabilizers) per ADR-0008', () => {
    const layerIds = BUILD_PREVIEW_LAYERS.map((l) => l.id)
    expect(layerIds).not.toContain('plate')
    expect(layerIds).not.toContain('pcb')
    expect(layerIds).not.toContain('foam')
    expect(layerIds).not.toContain('stabs')
  })

  it('supports string inclusion checks and has required descriptors', () => {
    expect(BUILD_PREVIEW_LAYER_IDS.includes('barebones')).toBe(true)
    expect(BUILD_PREVIEW_LAYER_IDS.includes('switches')).toBe(true)
    expect(BUILD_PREVIEW_LAYER_IDS.includes('keycaps')).toBe(true)
    expect(BUILD_PREVIEW_LAYER_IDS.includes('plate')).toBe(false)
    expect(BUILD_PREVIEW_LAYERS.some((l) => l.id === 'barebones')).toBe(true)
    expect(BUILD_PREVIEW_LAYERS.some((l) => l.id === 'switches')).toBe(true)
    expect(BUILD_PREVIEW_LAYERS.some((l) => l.id === 'keycaps')).toBe(true)
    expect(BUILD_PREVIEW_LAYERS.some((l) => l.id === 'plate')).toBe(false)

    for (const layer of BUILD_PREVIEW_LAYERS) {
      expect(typeof layer.name).toBe('string')
      expect(typeof layer.label).toBe('string')
      expect(typeof layer.nodeName).toBe('string')
      expect(layer.baseY).toBe(0) // Assembled resting height baked into geometry at y = 0 (REV-2)
      expect(typeof layer.description).toBe('string')
    }
  })

  it('defines vertical exploded separation offsets with clear air gaps', () => {
    const bb = BUILD_PREVIEW_LAYERS.find((l) => l.id === 'barebones')
    const sw = BUILD_PREVIEW_LAYERS.find((l) => l.id === 'switches')
    const kc = BUILD_PREVIEW_LAYERS.find((l) => l.id === 'keycaps')

    expect(bb.explodedY).toBe(-0.32)
    expect(sw.explodedY).toBe(0.04)
    expect(kc.explodedY).toBe(0.40)

    expect(sw.explodedY - bb.explodedY).toBeCloseTo(0.36, 2)
    expect(kc.explodedY - sw.explodedY).toBeCloseTo(0.36, 2)
  })
})


describe('PREVIEW_PART_PRESETS and STARTER_BUILD_PARTS', () => {
  it('defines rich demo Part presets for barebones, switches, and keycaps', () => {
    expect(PREVIEW_PART_PRESETS.barebones.length).toBeGreaterThanOrEqual(3)
    expect(PREVIEW_PART_PRESETS.switches.length).toBeGreaterThanOrEqual(3)
    expect(PREVIEW_PART_PRESETS.keycaps.length).toBeGreaterThanOrEqual(3)

    const requiredKeys = [
      'id',
      'name',
      'price',
      'socket',
      'pin',
      'layout',
      'color',
      'accentColor',
      'stemColor',
      'finish',
      'metalness',
      'roughness',
    ]

    for (const slot of ['barebones', 'switches', 'keycaps']) {
      for (const preset of PREVIEW_PART_PRESETS[slot]) {
        for (const key of requiredKeys) {
          expect(preset).toHaveProperty(key)
        }
        expect(typeof preset.id).toBe('string')
        expect(typeof preset.name).toBe('string')
        expect(typeof preset.price).toBe('number')
        expect(preset.color).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      }
    }
  })

  it('includes popular keyboard aesthetics mentioned in requirements', () => {
    const bbNames = PREVIEW_PART_PRESETS.barebones.map((p) => p.name.toLowerCase())
    expect(bbNames.some((n) => n.includes('polycarbonate'))).toBe(true)
    expect(bbNames.some((n) => n.includes('aluminum') || n.includes('navy'))).toBe(true)
    expect(bbNames.some((n) => n.includes('cream'))).toBe(true)

    const swNames = PREVIEW_PART_PRESETS.switches.map((p) => p.name.toLowerCase())
    expect(swNames.some((n) => n.includes('tangerine'))).toBe(true)
    expect(swNames.some((n) => n.includes('panda'))).toBe(true)
    expect(swNames.some((n) => n.includes('blue') && n.includes('3-pin'))).toBe(true)

    const kcNames = PREVIEW_PART_PRESETS.keycaps.map((p) => p.name.toLowerCase())
    expect(kcNames.some((n) => n.includes('botanical'))).toBe(true)
    expect(kcNames.some((n) => n.includes('laser'))).toBe(true)
    expect(kcNames.some((n) => n.includes('iso') || n.includes('french'))).toBe(true)
  })

  it('provides a compatible STARTER_BUILD_PARTS trio matching domain rules', () => {
    expect(STARTER_BUILD_PARTS.barebones).toBeDefined()
    expect(STARTER_BUILD_PARTS.switches).toBeDefined()
    expect(STARTER_BUILD_PARTS.keycaps).toBeDefined()

    const compatibility = checkCompatibility(STARTER_BUILD_PARTS)
    expect(compatibility.compatible).toBe(true)
    expect(compatibility.reasons).toEqual([])
    expect(compatibility.incomplete).toBe(false)
    expect(compatibility.incompatible).toBe(false)
  })
})

describe('normalizePreviewPart', () => {
  it('returns safe fallback descriptors for null, undefined, and empty objects', () => {
    const nullNorm = normalizePreviewPart('barebones', null)
    expect(nullNorm.isSelected).toBe(false)
    expect(nullNorm.id).toBeNull()
    expect(nullNorm.name).toBe('Not selected')
    expect(nullNorm.price).toBe(0)
    expect(nullNorm.color).toBe('#12151c')
    expect(nullNorm.slot).toBe('barebones')
    expect(nullNorm.specSummary).toBe('No part selected')

    const emptyNorm = normalizePreviewPart('switches', {})
    expect(emptyNorm.isSelected).toBe(false)
    expect(emptyNorm.name).toBe('Not selected')
    expect(emptyNorm.slot).toBe('switches')
    expect(emptyNorm.stemColor).toBe('#d9468f')

    const undefNorm = normalizePreviewPart('keycaps', undefined)
    expect(undefNorm.isSelected).toBe(false)
    expect(undefNorm.name).toBe('Not selected')
    expect(undefNorm.slot).toBe('keycaps')
  })

  it('normalizes minimal domain test Part stubs cleanly', () => {
    const domainBarebones = { socket: 'hotswap', layout: 'ansi', price: 120 }
    const normBb = normalizePreviewPart('barebones', domainBarebones)

    expect(normBb.isSelected).toBe(true)
    expect(normBb.socket).toBe('hotswap')
    expect(normBb.layout).toBe('ansi')
    expect(normBb.price).toBe(120)
    expect(typeof normBb.color).toBe('string')
    expect(typeof normBb.metalness).toBe('number')
    expect(typeof normBb.roughness).toBe('number')

    const domainSwitches = { pin: '5-pin', price: 40 }
    const normSw = normalizePreviewPart('switches', domainSwitches)
    expect(normSw.isSelected).toBe(true)
    expect(normSw.pin).toBe('5-pin')
    expect(normSw.price).toBe(40)
    expect(normSw.stemColor).toBe('#d9468f')

    const domainKeycaps = { layout: 'ansi', price: 60 }
    const normKc = normalizePreviewPart('keycaps', domainKeycaps)
    expect(normKc.isSelected).toBe(true)
    expect(normKc.layout).toBe('ansi')
    expect(normKc.price).toBe(60)
  })

  it('normalizes catalog parts from catalog.js and extracts semantic colors', () => {
    const catalogCase = {
      id: 'alu',
      name: 'CNC aluminium case',
      frame: 'metal',
      w: 'normal',
      g: 1250,
      p: 179,
    }
    const normCase = normalizePreviewPart('case', catalogCase)
    expect(normCase.slot).toBe('barebones') // slot 'case' mapped to 'barebones'
    expect(normCase.id).toBe('alu')
    expect(normCase.price).toBe(179)
    expect(normCase.metalness).toBe(0.8)
    expect(normCase.finishLabel).toContain('Aluminium')

    const catalogSwitch = {
      id: 'gyellow',
      name: 'Gateron Milky Yellow Pro',
      type: 'linear',
      ps: 0.25,
      force: '50 g',
    }
    const normSwitch = normalizePreviewPart('switches', catalogSwitch)
    expect(normSwitch.id).toBe('gyellow')
    expect(normSwitch.price).toBe(20) // 0.25 * 81 = 20.25 -> 20
    expect(normSwitch.stemColor).toBe('#eab308') // yellow stem
    expect(normSwitch.color).toBe('#fef9c3') // milky body
    expect(normSwitch.finishLabel).toBe('linear switch')

    const catalogKeycaps = {
      id: 'matte',
      name: 'Textured matte PBT keycap set',
      style: 'textured',
      p: 49,
      prof: 'XDA',
    }
    const normKeycaps = normalizePreviewPart('keycaps', catalogKeycaps)
    expect(normKeycaps.id).toBe('matte')
    expect(normKeycaps.price).toBe(49)
    expect(normKeycaps.finishLabel).toBe('XDA profile')
  })

  it('preserves all properties on preset parts', () => {
    const preset = PREVIEW_PART_PRESETS.keycaps[0]
    const norm = normalizePreviewPart('keycaps', preset)

    expect(norm.id).toBe(preset.id)
    expect(norm.name).toBe(preset.name)
    expect(norm.price).toBe(preset.price)
    expect(norm.color).toBe(preset.color)
    expect(norm.accentColor).toBe(preset.accentColor)
    expect(norm.roughness).toBe(preset.roughness)
  })
})

describe('computeDropOffset', () => {
  it('returns 0 when progress >= 1', () => {
    expect(computeDropOffset(1.0)).toBe(0)
    expect(computeDropOffset(1.5)).toBe(0)
  })

  it('returns 0 when reducedMotion is true for any progress value', () => {
    expect(computeDropOffset(0, { reducedMotion: true })).toBe(0)
    expect(computeDropOffset(0.5, { reducedMotion: true })).toBe(0)
    expect(computeDropOffset(1.0, { reducedMotion: true })).toBe(0)
  })

  it('returns dropHeight at progress 0 and decays monotonically toward 0', () => {
    const h = 1.65
    expect(computeDropOffset(0, { dropHeight: h })).toBeCloseTo(h, 4)

    const offsetMid = computeDropOffset(0.5, { dropHeight: h })
    expect(offsetMid).toBeGreaterThan(0)
    expect(offsetMid).toBeLessThan(h)

    const offsetLate = computeDropOffset(0.8, { dropHeight: h })
    expect(offsetLate).toBeGreaterThan(0)
    expect(offsetLate).toBeLessThan(offsetMid)
  })

  it('handles non-finite and edge values safely', () => {
    expect(computeDropOffset(NaN)).toBe(0)
    expect(computeDropOffset(undefined)).toBe(0)
    expect(computeDropOffset(-1, { dropHeight: 1.65 })).toBe(1.65)
  })
})

describe('isColorLight helper', () => {
  it('correctly assesses luminance of light and dark colors', () => {
    expect(isColorLight('#ffffff')).toBe(true)
    expect(isColorLight('#fef3c7')).toBe(true)
    expect(isColorLight('#000000')).toBe(false)
    expect(isColorLight('#12151c')).toBe(false)
    expect(isColorLight('#1e293b')).toBe(false)
  })
})

describe('isWebGLAvailable', () => {
  it('returns false in jsdom environment without WebGL context', () => {
    expect(isWebGLAvailable()).toBe(false)
  })

  it('returns true when a mock canvas with WebGL context is provided', () => {
    const mockCanvas = {
      getContext: vi.fn((type) => {
        if (type === 'webgl' || type === 'webgl2') return {}
        return null
      }),
    }
    expect(isWebGLAvailable(mockCanvas)).toBe(true)
  })
})

describe('createBuildPreviewScene Controller Interface', () => {
  it('disposal test: verifies that geometry and material .dispose() spies are called when scene.dispose() runs', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    const threeScene = scene.getScene()
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshBasicMaterial()
    const geoDisposeSpy = vi.spyOn(geo, 'dispose')
    const matDisposeSpy = vi.spyOn(mat, 'dispose')

    const testMesh = new THREE.Mesh(geo, mat)
    threeScene.add(testMesh)

    scene.dispose()

    expect(geoDisposeSpy).toHaveBeenCalled()
    expect(matDisposeSpy).toHaveBeenCalled()
  })

  let canvas

  beforeEach(() => {
    canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true })
  })

  it('initializes cleanly with mock renderer factory and procedural fallback', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    expect(scene).toBeDefined()
    expect(scene.hasRenderer()).toBe(true)

    const stats = scene.getStats()
    expect(stats.activeLayers).toBe(3)
    expect(stats.mode).toBe('procedural')
    expect(stats.triangles).toBeLessThan(40000)
    expect(stats.drawCalls).toBeLessThanOrEqual(8)

    scene.dispose()
  })

  it('fails gracefully or throws when WebGL is unavailable and no rendererFactory is provided', () => {
    const onError = vi.fn()
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      onError,
    })

    // In jsdom without WebGL, onError is called and scene is null or degraded
    expect(onError).toHaveBeenCalled()
    if (scene) {
      expect(scene.hasRenderer()).toBe(false)
    }
  })

  it('manages camera presets: isometric, top, and side', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    expect(scene.getCameraPreset()).toBe('isometric')

    scene.setCameraPreset('top')
    expect(scene.getCameraPreset()).toBe('top')

    scene.setCameraPreset('side')
    expect(scene.getCameraPreset()).toBe('side')

    scene.resetCamera()
    expect(scene.getCameraPreset()).toBe('isometric')

    scene.dispose()
  })

  it('updates layer part materials and triggers drop animation on change', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    const initialStates = scene.getLayerStates()
    expect(initialStates.barebones.status).toBe('empty')
    expect(initialStates.switches.status).toBe('empty')
    expect(initialStates.keycaps.status).toBe('empty')

    // Apply new part to switches
    const newSwitch = PREVIEW_PART_PRESETS.switches[0]
    scene.updateLayerPart('switches', newSwitch, { animate: true })

    const updatedStates = scene.getLayerStates()
    expect(updatedStates.switches.status).toBe('configured')
    expect(updatedStates.switches.part.name).toBe(newSwitch.name)
    expect(updatedStates.switches.dropProgress).toBe(0) // Animation started

    // Step animation forward
    scene.step(0.21) // Halfway through 0.42s
    const midStates = scene.getLayerStates()
    expect(midStates.switches.dropProgress).toBeGreaterThan(0)
    expect(midStates.switches.dropProgress).toBeLessThan(1)

    scene.step(0.3) // Exceed total 0.42s
    const doneStates = scene.getLayerStates()
    expect(doneStates.switches.dropProgress).toBe(1) // Completed

    scene.dispose()
  })

  it('syncs full build state and accepts case as alias for barebones', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    const newCase = PREVIEW_PART_PRESETS.barebones[1]
    const newSwitches = PREVIEW_PART_PRESETS.switches[1]
    const newKeycaps = PREVIEW_PART_PRESETS.keycaps[1]

    scene.syncBuildState(
      {
        case: newCase,
        switches: newSwitches,
        keycaps: newKeycaps,
      },
      { animate: false }
    )

    const states = scene.getLayerStates()
    expect(states.barebones.part.id).toBe(newCase.id)
    expect(states.switches.part.id).toBe(newSwitches.id)
    expect(states.keycaps.part.id).toBe(newKeycaps.id)
    // When animate is false, dropProgress is immediately settled
    expect(states.barebones.dropProgress).toBe(1)
    expect(states.switches.dropProgress).toBe(1)
    expect(states.keycaps.dropProgress).toBe(1)

    scene.dispose()
  })

  it('supports pause, resume, and isPaused controls', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    expect(scene.isPaused()).toBe(false)
    scene.pause()
    expect(scene.isPaused()).toBe(true)
    scene.resume()
    expect(scene.isPaused()).toBe(false)

    scene.dispose()
  })

  it('honors reduced motion by settling layers immediately without drop animation', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      reducedMotion: true,
      rendererFactory: createMockRenderer,
    })

    const newSwitch = PREVIEW_PART_PRESETS.switches[0]
    scene.updateLayerPart('switches', newSwitch, { animate: true })

    const states = scene.getLayerStates()
    expect(states.switches.dropProgress).toBe(1) // Settled immediately

    scene.setReducedMotion(false)
    scene.updateLayerPart('keycaps', PREVIEW_PART_PRESETS.keycaps[0], { animate: true })
    const statesNormal = scene.getLayerStates()
    expect(statesNormal.keycaps.dropProgress).toBe(0) // Animatible

    scene.dispose()
  })

  it('skips the drop animation on software-rendered GPUs (SwiftShader/CI runners)', () => {
    const softwareRenderer = {
      ...createMockRenderer({ canvas }),
      // Reports a software rasteriser the way headless Chromium does.
      getContext: () => ({
        getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null),
        getParameter: () => 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      }),
    }
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: () => softwareRenderer,
    })

    scene.updateLayerPart('switches', PREVIEW_PART_PRESETS.switches[0], { animate: true })

    // A software driver needs hundreds of ms per frame, so animating would stall
    // the page; the layer settles immediately (one render) instead.
    expect(scene.getLayerStates().switches.dropProgress).toBe(1)

    scene.dispose()
  })

  it('disposes resources and renderer without throwing', () => {
    const mockRenderer = createMockRenderer({ canvas })
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: () => mockRenderer,
    })

    expect(() => scene.dispose()).not.toThrow()
    expect(mockRenderer.dispose).toHaveBeenCalled()
    // Subsequent calls are idempotent
    expect(() => scene.dispose()).not.toThrow()
  })

  it('REV-2: all 3 layers have assembled resting baseY === 0 while dropping from baseY + dropOffset', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    const states = scene.getLayerStates()
    for (const id of ['barebones', 'switches', 'keycaps']) {
      // Resting position is baseY = 0
      expect(states[id].dropProgress).toBe(1)
    }

    // Trigger drop on switches
    scene.updateLayerPart('switches', PREVIEW_PART_PRESETS.switches[0], { animate: true })
    const droppingStates = scene.getLayerStates()
    expect(droppingStates.switches.dropProgress).toBe(0)
    // Offset at progress 0 is 1.65 > 0
    expect(computeDropOffset(0)).toBe(1.65)

    // Complete drop animation
    scene.step(0.45)
    const finishedStates = scene.getLayerStates()
    expect(finishedStates.switches.dropProgress).toBe(1)
    expect(computeDropOffset(finishedStates.switches.dropProgress)).toBe(0)

    scene.dispose()
  })

  it('REV-9: clearing a slot to null does not start a drop animation', () => {
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    // Configure switches first and complete drop
    scene.updateLayerPart('switches', PREVIEW_PART_PRESETS.switches[0], { animate: true })
    scene.step(0.5)
    expect(scene.getLayerStates().switches.dropProgress).toBe(1)

    // Now clear slot to null with animate: true
    scene.updateLayerPart('switches', null, { animate: true })
    const states = scene.getLayerStates()
    expect(states.switches.status).toBe('empty')
    // Must remain 1 immediately without dropping ghost mesh
    expect(states.switches.dropProgress).toBe(1)

    scene.dispose()
  })

  it('REV-8: invokes onCameraPresetChange on setCameraPreset and resetCamera', () => {
    const onCameraPresetChange = vi.fn()
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
      onCameraPresetChange,
    })

    scene.setCameraPreset('top')
    expect(onCameraPresetChange).toHaveBeenCalledWith('top')

    scene.setCameraPreset('side')
    expect(onCameraPresetChange).toHaveBeenCalledWith('side')

    scene.resetCamera()
    expect(onCameraPresetChange).toHaveBeenCalledWith('isometric')

    scene.dispose()
  })

  it('REV-3: GLB load failure triggers onLoad fallback without calling onError', async () => {
    const onLoad = vi.fn()
    const onError = vi.fn()

    // Mock global fetch to simulate network error for GLB
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))

    try {
      const scene = createBuildPreviewScene({
        canvas,
        loadGlb: true,
        rendererFactory: createMockRenderer,
        onLoad,
        onError,
      })

      // Allow async fetch microtask to run
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onError).not.toHaveBeenCalled()
      expect(onLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          fallback: true,
          error: expect.any(Error),
        })
      )
      expect(scene.getStats().mode).toBe('procedural')

      scene.dispose()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('Top-Down Keycap UV Projection & Artwork Texture Support', () => {
  it('includes anime-cat and kanagawa presets in PREVIEW_PART_PRESETS.keycaps', () => {
    const themePreset = PREVIEW_PART_PRESETS.keycaps.find((p) => p.id === 'theme')
    expect(themePreset).toBeDefined()
    expect(themePreset.textureUrl).toBe('/textures/keycaps/anime-cat-town.jpg')
    expect(themePreset.artMode).toBe('full')

    const wavePreset = PREVIEW_PART_PRESETS.keycaps.find((p) => p.id === 'kanagawa')
    expect(wavePreset).toBeDefined()
    expect(wavePreset.textureUrl).toBe('/textures/keycaps/kanagawa-wave.jpg')
    expect(wavePreset.artMode).toBe('full')
  })

  it('normalizes keycaps artwork attributes and infers textureUrl and artMode by id/name', () => {
    // Explicit textureUrl pass-through
    const custom = normalizePreviewPart('keycaps', {
      id: 'custom-art',
      name: 'Custom Mural',
      textureUrl: '/textures/custom.jpg',
      artMode: 'framed',
    })
    expect(custom.textureUrl).toBe('/textures/custom.jpg')
    expect(custom.artMode).toBe('framed')

    // Inferred for 'theme' / anime mural
    const theme = normalizePreviewPart('keycaps', { id: 'theme', name: 'Themed PBT keycap set' })
    expect(theme.textureUrl).toBe('/textures/keycaps/anime-cat-town.jpg')
    expect(theme.artMode).toBe('full')

    // Inferred for 'kanagawa' / Great Wave
    const wave = normalizePreviewPart('keycaps', { id: 'kanagawa', name: 'Great Wave Kanagawa dye-sub set' })
    expect(wave.textureUrl).toBe('/textures/keycaps/kanagawa-wave.jpg')
    expect(wave.artMode).toBe('full')

    // Non-textured keycaps have null textureUrl and artMode
    const blank = normalizePreviewPart('keycaps', { id: 'blank', name: 'Blank PBT keycaps' })
    expect(blank.textureUrl).toBeNull()
    expect(blank.artMode).toBeNull()

    // Unselected slot has null textureUrl and artMode
    const unselected = normalizePreviewPart('keycaps', null)
    expect(unselected.textureUrl).toBeNull()
    expect(unselected.artMode).toBeNull()
  })

  it('ensureTopDownKeycapUVs generates valid planar UVs spanning [0, 1] across X and Z', () => {
    const group = new THREE.Group()
    // Create two mesh blocks representing keys at (x: -0.15, z: -0.05) and (x: 0.15, z: 0.05)
    const geo1 = new THREE.BoxGeometry(0.02, 0.01, 0.02)
    const mesh1 = new THREE.Mesh(geo1, new THREE.MeshStandardMaterial())
    mesh1.position.set(-0.15, 0, -0.05)

    const geo2 = new THREE.BoxGeometry(0.02, 0.01, 0.02)
    const mesh2 = new THREE.Mesh(geo2, new THREE.MeshStandardMaterial())
    mesh2.position.set(0.15, 0, 0.05)

    group.add(mesh1)
    group.add(mesh2)

    const bbox = ensureTopDownKeycapUVs(group)
    expect(bbox).not.toBeNull()
    expect(bbox.width).toBeGreaterThan(0.2)
    expect(bbox.depth).toBeGreaterThan(0.08)

    // Check that meshes have updated UV Float32BufferAttributes
    expect(mesh1.geometry.attributes.uv).toBeDefined()
    expect(mesh1.geometry.attributes.isTopFace).toBeDefined()
    expect(mesh1.userData.topDownProjected).toBe(true)

    // Check UV ranges are clamped in [0, 1]
    const uvs1 = mesh1.geometry.attributes.uv
    for (let i = 0; i < uvs1.count; i++) {
      expect(uvs1.getX(i)).toBeGreaterThanOrEqual(0.0)
      expect(uvs1.getX(i)).toBeLessThanOrEqual(1.0)
      expect(uvs1.getY(i)).toBeGreaterThanOrEqual(0.0)
      expect(uvs1.getY(i)).toBeLessThanOrEqual(1.0)
    }
  })

  it('ensureTopDownKeycapUVs reuses the projection on repeat calls (no per-pick re-projection)', () => {
    const group = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.02), new THREE.MeshStandardMaterial())
    group.add(mesh)

    const first = ensureTopDownKeycapUVs(group)
    const firstUv = mesh.geometry.attributes.uv
    const second = ensureTopDownKeycapUVs(group)

    // Same bounds object and untouched uv attribute => cached, not re-projected
    expect(second).toBe(first)
    expect(mesh.geometry.attributes.uv).toBe(firstUv)
    expect(group.userData.topDownBounds).toBe(first)
  })

  it('ensureTopDownKeycapUVs handles empty groups gracefully without throwing', () => {
    const emptyGroup = new THREE.Group()
    expect(ensureTopDownKeycapUVs(emptyGroup)).toBeNull()
    expect(ensureTopDownKeycapUVs(null)).toBeNull()
  })

  it('loadKeycapTexture caches textures in textureCache and configures SRGBColorSpace', () => {
    const testUrl = '/textures/keycaps/anime-cat-town.jpg'
    const onComplete = vi.fn()
    const texture = loadKeycapTexture(testUrl, onComplete)

    expect(texture).toBeDefined()
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(texture.flipY).toBe(true)
    expect(textureCache.has(testUrl)).toBe(true)
    expect(textureCache.get(testUrl)).toBe(texture)

    // Repeated call returns cached instance immediately
    const cached = loadKeycapTexture(testUrl)
    expect(cached).toBe(texture)
  })
})

describe('Multi-Layout Switch Coordinates (60%, 75%, 100%)', () => {
  it('exports SWITCH_LAYOUTS map containing 60, 75, and 100 layouts', () => {
    expect(SWITCH_LAYOUTS['60']).toBeDefined()
    expect(SWITCH_LAYOUTS['75']).toBeDefined()
    expect(SWITCH_LAYOUTS['100']).toBeDefined()

    expect(SWITCH_LAYOUTS['60']).toHaveLength(61)
    expect(SWITCH_LAYOUTS['75']).toHaveLength(81)
    expect(SWITCH_LAYOUTS['100']).toHaveLength(104)

    expect(SWITCH_LAYOUT_POSITIONS_60).toHaveLength(61)
    expect(SWITCH_LAYOUT_POSITIONS).toHaveLength(81)
    expect(SWITCH_LAYOUT_POSITIONS_100).toHaveLength(104)
  })

  it('centers 60% and 100% switch matrix coordinate bounds around origin (0, 0)', () => {
    // 60% layout centering check
    let minX60 = Infinity
    let maxX60 = -Infinity
    let minZ60 = Infinity
    let maxZ60 = -Infinity
    for (const pos of SWITCH_LAYOUT_POSITIONS_60) {
      if (pos.x < minX60) minX60 = pos.x
      if (pos.x > maxX60) maxX60 = pos.x
      if (pos.z < minZ60) minZ60 = pos.z
      if (pos.z > maxZ60) maxZ60 = pos.z
    }
    const midX60 = (minX60 + maxX60) / 2
    const midZ60 = (minZ60 + maxZ60) / 2
    expect(Math.abs(midX60)).toBeLessThan(0.005)
    expect(Math.abs(midZ60)).toBeLessThan(0.005)

    // 100% layout centering check
    let minX100 = Infinity
    let maxX100 = -Infinity
    let minZ100 = Infinity
    let maxZ100 = -Infinity
    for (const pos of SWITCH_LAYOUT_POSITIONS_100) {
      if (pos.x < minX100) minX100 = pos.x
      if (pos.x > maxX100) maxX100 = pos.x
      if (pos.z < minZ100) minZ100 = pos.z
      if (pos.z > maxZ100) maxZ100 = pos.z
    }
    const midX100 = (minX100 + maxX100) / 2
    const midZ100 = (minZ100 + maxZ100) / 2
    expect(Math.abs(midX100)).toBeLessThan(0.005)
    expect(Math.abs(midZ100)).toBeLessThan(0.005)
  })
})

describe('Keycap Legends & Decal UV Preservation', () => {
  it('ensureTopDownKeycapUVs preserves existing atlas UV coordinates on decal/legend meshes', () => {
    const group = new THREE.Group()

    // 1. Regular keycap mesh
    const baseGeo = new THREE.BoxGeometry(0.02, 0.01, 0.02)
    const baseMesh = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ name: 'Mat_Keycap_Base' }))
    baseMesh.name = 'Keycap_Alpha_Q'
    baseMesh.position.set(-0.1, 0, 0)
    group.add(baseMesh)

    // 2. Decal legend mesh with custom atlas UVs
    const decalGeo = new THREE.PlaneGeometry(0.01, 0.01)
    const initialDecalUV = new Float32Array([0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 0.5, 0.5])
    decalGeo.setAttribute('uv', new THREE.BufferAttribute(initialDecalUV.slice(), 2))
    const decalMat = new THREE.MeshStandardMaterial({
      name: 'Mat_Engraving_Legends',
      transparent: true,
    })
    const decalMesh = new THREE.Mesh(decalGeo, decalMat)
    decalMesh.name = 'Layer_Keycaps_2'
    group.add(decalMesh)

    ensureTopDownKeycapUVs(group)

    // Base mesh gets top-down planar projection
    expect(baseMesh.userData.topDownProjected).toBe(true)
    expect(baseMesh.geometry.attributes.isTopFace).toBeDefined()

    // Decal mesh UVs are strictly preserved intact
    const preservedUVs = decalMesh.geometry.attributes.uv.array
    for (let i = 0; i < initialDecalUV.length; i++) {
      expect(preservedUVs[i]).toBeCloseTo(initialDecalUV[i], 5)
    }
    expect(decalMesh.userData.topDownProjected).toBeUndefined()
  })

  it('keeps decal lettering visible over textured artwork with crisp high-contrast emissive colors', () => {
    const canvas = document.createElement('canvas')
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: createMockRenderer,
    })

    // Simulate keycaps group with base keycap mesh and decal mesh
    const keycapsGroup = scene.getLayerStates().keycaps
    expect(keycapsGroup).toBeDefined()

    // 1. Kanagawa preset: dark blue lettering with deep blue emissive
    scene.updateLayerPart('keycaps', {
      id: 'kanagawa',
      name: 'Great Wave Kanagawa',
      textureUrl: '/textures/keycaps/kanagawa-wave.jpg',
      artMode: 'full',
      color: '#f8fafc',
    })

    const kanagawaNormalized = normalizePreviewPart('keycaps', {
      id: 'kanagawa',
      name: 'Great Wave Kanagawa',
      textureUrl: '/textures/keycaps/kanagawa-wave.jpg',
      artMode: 'full',
    })
    expect(kanagawaNormalized.legendColor).toBe('#ffffff')
    expect(kanagawaNormalized.legendEmissive).toBe('#38bdf8')
    expect(kanagawaNormalized.legendVariant).toBe('dark')
    expect(kanagawaNormalized.legendTextureUrl).toBe(LEGEND_TEXTURE_PATHS.dark)

    // 2. Theme preset: crisp white lettering with warm yellow emissive
    const themeNormalized = normalizePreviewPart('keycaps', {
      id: 'theme',
      name: 'Themed PBT Keycaps (Anime Cat Town)',
      textureUrl: '/textures/keycaps/anime-cat-town.jpg',
      artMode: 'full',
    })
    expect(themeNormalized.legendColor).toBe('#ffffff')
    expect(themeNormalized.legendEmissive).toBe('#fef08a')
    expect(themeNormalized.legendVariant).toBe('light')
    expect(themeNormalized.legendTextureUrl).toBe(LEGEND_TEXTURE_PATHS.light)

    // 3. Blank preset: legends hidden
    const blankNormalized = normalizePreviewPart('keycaps', {
      id: 'blank',
      name: 'Blank Keycaps',
    })
    expect(blankNormalized.id).toBe('blank')

    scene.dispose()
  })

  it('LEGEND_TEXTURE_PATHS defines light and dark crisp legend textures', () => {
    expect(LEGEND_TEXTURE_PATHS.light).toBe('/textures/keycaps/legends-crisp-light.png')
    expect(LEGEND_TEXTURE_PATHS.dark).toBe('/textures/keycaps/legends-crisp-dark.png')
  })

  it('loadKeycapLegendTexture loads with flipY=false and sRGB color space', () => {
    const dummyUrl = '/textures/keycaps/test-legend.png'
    const onComplete = vi.fn()
    const texture = loadKeycapLegendTexture(dummyUrl, onComplete)

    expect(texture).toBeDefined()
    expect(texture.flipY).toBe(false)
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(textureCache.has(dummyUrl)).toBe(true)

    // Repeated call returns cached instance
    const cached = loadKeycapLegendTexture(dummyUrl)
    expect(cached).toBe(texture)
  })
})

describe('4-Zone Keycap Colorways', () => {
  it('defines 7 distinct 4-zone colorway palettes', () => {
    const expectedKeys = ['plainpbt', 'matte', 'stone', 'dshot', 'blank', 'theme', 'kanagawa']
    for (const key of expectedKeys) {
      const cw = KEYCAP_COLORWAYS[key]
      expect(cw).toBeDefined()
      expect(typeof cw.alphas).toBe('string')
      expect(typeof cw.modifiers).toBe('string')
      expect(typeof cw.accents).toBe('string')
      expect(typeof cw.spacebar).toBe('string')
    }
  })

  it('getKeycapColorway resolves matching colorway by id or part name', () => {
    expect(getKeycapColorway({ id: 'plainpbt' })).toBe(KEYCAP_COLORWAYS.plainpbt)
    expect(getKeycapColorway({ id: 'matte-dark' })).toBe(KEYCAP_COLORWAYS.matte)
    expect(getKeycapColorway({ name: 'Warm Stone PBT' })).toBe(KEYCAP_COLORWAYS.stone)
    expect(getKeycapColorway({ id: 'dshot-cyan' })).toBe(KEYCAP_COLORWAYS.dshot)
    expect(getKeycapColorway({ id: 'custom-unknown' })).toBeNull()
  })
})

describe('Barebones Case Silhouettes (high-profile, low-profile, sandwich)', () => {
  it('applies high-profile silhouette and toggles brass accent weight on alubrass', () => {
    const group = new THREE.Group()
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.12), new THREE.MeshStandardMaterial())
    caseMesh.name = 'Layer_Case'
    group.add(caseMesh)

    // alubrass: attaches and shows Brass_Weight_Accent
    const variant1 = applyBarebonesGeometryVariant({ id: 'alubrass', name: 'CNC Alu Brass' }, group)
    expect(variant1).toBe('high-profile')
    const brassAccent = group.getObjectByName('Brass_Weight_Accent')
    expect(brassAccent).toBeDefined()
    expect(brassAccent.visible).toBe(true)
    expect(caseMesh.scale.y).toBe(1.0)
    expect(caseMesh.position.y).toBe(0.0)

    // pc: hides Brass_Weight_Accent
    const variant2 = applyBarebonesGeometryVariant({ id: 'pc', name: 'Polycarbonate Base' }, group)
    expect(variant2).toBe('high-profile')
    expect(brassAccent.visible).toBe(false)
  })

  it('applies low-profile silhouette with slim floating switch case scale', () => {
    const group = new THREE.Group()
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.12), new THREE.MeshStandardMaterial())
    caseMesh.name = 'Layer_Case'
    group.add(caseMesh)

    const variant = applyBarebonesGeometryVariant({ id: 'abs', name: 'ABS Low Profile' }, group)
    expect(variant).toBe('low-profile')
    expect(caseMesh.scale.y).toBeCloseTo(0.58, 2)
    expect(caseMesh.position.y).toBeCloseTo(-0.008, 3)
  })

  it('applies sandwich silhouette with open-edge acrylic plates and standoffs', () => {
    const group = new THREE.Group()
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.12), new THREE.MeshStandardMaterial())
    caseMesh.name = 'Layer_Case'
    group.add(caseMesh)

    const variant = applyBarebonesGeometryVariant({ id: 'sandwich', name: 'Sandwich Acrylic Skeleton' }, group)
    expect(variant).toBe('sandwich')
    expect(caseMesh.visible).toBe(false)

    const sandwichGroup = group.getObjectByName('Sandwich_Group')
    expect(sandwichGroup).toBeDefined()
    expect(sandwichGroup.visible).toBe(true)

    const topPlate = sandwichGroup.getObjectByName('Sandwich_Top_Plate')
    const bottomPlate = sandwichGroup.getObjectByName('Sandwich_Bottom_Plate')
    expect(topPlate).toBeDefined()
    expect(bottomPlate).toBeDefined()

    // Verify 6 perimeter standoffs
    for (let i = 0; i < 6; i++) {
      expect(sandwichGroup.getObjectByName(`Sandwich_Standoff_${i}`)).toBeDefined()
    }
  })
})

describe('Multi-Layout Dynamic Switching (setLayout & getLayout)', () => {
  it('switches between 60%, 75%, and 100% layouts adjusting scale and switch matrix count', async () => {
    const canvas = document.createElement('canvas')
    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      layout: '75',
      rendererFactory: createMockRenderer,
    })

    expect(scene.getLayout()).toBe('75')
    expect(scene.getStats().layout).toBe('75')

    // Switch to 60% layout
    await scene.setLayout('60')
    expect(scene.getLayout()).toBe('60')
    expect(scene.getStats().layout).toBe('60')

    // Switch to 100% layout
    await scene.setLayout('100')
    expect(scene.getLayout()).toBe('100')
    expect(scene.getStats().layout).toBe('100')

    // Switch back to 75%
    await scene.setLayout('75')
    expect(scene.getLayout()).toBe('75')
    expect(scene.getStats().layout).toBe('75')

    scene.dispose()
  })

  it('configures top camera preset to prevent bezel/edge clipping in exploded and combined views', () => {
    expect(DEFAULT_CAMERA_PRESETS.top).toBeDefined()
    expect(DEFAULT_CAMERA_PRESETS.top.pos).toEqual([0, 3.65, 0.01])
    expect(DEFAULT_CAMERA_PRESETS.top.target).toEqual([0, 0.12, 0])
  })


})

describe('Top-Printed vs Side-Printed Keycap Legends & Multi-Layout Overlay', () => {
  it('classifies keycap legendStyle accurately based on catalog specification', () => {
    // 1. Top-printed keycaps (plainpbt, dshot, laser, french, retro)
    const plainpbt = normalizePreviewPart('keycaps', { id: 'plainpbt', name: 'Dye-sub PBT keycap set' })
    expect(plainpbt.legendStyle).toBe('top')

    const dshot = normalizePreviewPart('keycaps', { id: 'dshot', name: 'Double-shot ABS keycap set' })
    expect(dshot.legendStyle).toBe('top')

    const laser = normalizePreviewPart('keycaps', { id: 'kc-laser', name: 'GMK Laser Double-shot Keycaps' })
    expect(laser.legendStyle).toBe('top')

    // 2. Side-printed keycaps (matte, stone, theme, kanagawa, botanical)
    const matte = normalizePreviewPart('keycaps', { id: 'matte', name: 'Textured matte PBT keycap set' })
    expect(matte.legendStyle).toBe('side')

    const stone = normalizePreviewPart('keycaps', { id: 'stone', name: 'Stone-texture PBT keycap set' })
    expect(stone.legendStyle).toBe('side')

    const theme = normalizePreviewPart('keycaps', { id: 'theme', name: 'Themed PBT Keycaps (Le Chaton Anime Mural)' })
    expect(theme.legendStyle).toBe('side')

    const kanagawa = normalizePreviewPart('keycaps', { id: 'kanagawa', name: 'Great Wave Kanagawa dye-sub set' })
    expect(kanagawa.legendStyle).toBe('side')

    const botanical = normalizePreviewPart('keycaps', { id: 'kc-botanical', name: 'Cherry Botanical PBT Keycaps' })
    expect(botanical.legendStyle).toBe('side')

    // 3. Blank keycaps (blank)
    const blank = normalizePreviewPart('keycaps', { id: 'blank', name: 'Blank PBT keycap set' })
    expect(blank.legendStyle).toBe('none')

    // 4. Unselected keycaps
    const unselected = normalizePreviewPart('keycaps', null)
    expect(unselected.legendStyle).toBe('none')
  })

  it('loadTopLegendTexture loads texture with sRGB color space and handles fallback gracefully', () => {
    const tex60 = loadTopLegendTexture('60')
    expect(tex60).toBeDefined()
    expect(tex60.colorSpace).toBe(THREE.SRGBColorSpace)

    const tex75 = loadTopLegendTexture('75')
    expect(tex75).toBeDefined()
    expect(tex75.colorSpace).toBe(THREE.SRGBColorSpace)

    const tex100 = loadTopLegendTexture('100')
    expect(tex100).toBeDefined()
    expect(tex100.colorSpace).toBe(THREE.SRGBColorSpace)
  })

  it('createTopLegendsOverlay extracts upward-facing triangles and creates planar top overlay mesh', () => {
    const group = new THREE.Group()

    // Create a mock keycap shell geometry (a flat top dish with normal pointing +Y)
    const geo = new THREE.BufferGeometry()
    // 2 triangles forming a quad
    const positions = new Float32Array([
      -0.01, 0.02, -0.01,
       0.01, 0.02, -0.01,
       0.01, 0.02,  0.01,
      -0.01, 0.02, -0.01,
       0.01, 0.02,  0.01,
      -0.01, 0.02,  0.01,
    ])
    const normals = new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

    const mat = new THREE.MeshStandardMaterial({ name: 'Keycap_White' })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'Layer_Keycaps'
    group.add(mesh)

    const overlay = createTopLegendsOverlay(group, {
      minX: -0.01,
      maxX: 0.01,
      minZ: -0.01,
      maxZ: 0.01,
      width: 0.02,
      depth: 0.02,
    })

    expect(overlay).toBeDefined()
    expect(overlay.name).toBe('Top_Legends_Overlay')
    expect(overlay.userData.isTopLegend).toBe(true)
    expect(overlay.renderOrder).toBe(25)
    expect(overlay.position.y).toBeCloseTo(0.00028, 5)
    expect(overlay.geometry.attributes.position.count).toBe(6)
    expect(overlay.geometry.attributes.uv.count).toBe(6)
    // Upright top-down UV orientation: at minZ (north / Esc row), v coordinate is 1.0
    expect(overlay.geometry.attributes.uv.getY(0)).toBeCloseTo(1.0, 4)
    expect(overlay.geometry.attributes.uv.getY(2)).toBeCloseTo(0.0, 4)
    expect(overlay.material.transparent).toBe(true)
    expect(overlay.material.depthWrite).toBe(false)
  })

  it('createTopLegendsOverlay filters inner stem cavity and side bevels', () => {
    const group = new THREE.Group()
    const geo = new THREE.BufferGeometry()
    // 2 triangles: one top-dish (Y=0.035, normal +Y), one inner stem cavity (Y=0.015, normal +Y)
    const positions = new Float32Array([
      // Top dish triangle
      -0.01, 0.035, -0.01,
       0.01, 0.035, -0.01,
       0.01, 0.035,  0.01,
      // Inner stem cavity triangle (low Y inside keycap)
      -0.01, 0.015, -0.01,
       0.01, 0.015, -0.01,
       0.01, 0.015,  0.01,
    ])
    const normals = new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'Keycap_Mat' }))
    group.add(mesh)

    const overlay = createTopLegendsOverlay(group)
    expect(overlay).toBeDefined()
    // Only the top dish triangle (3 vertices) should be extracted, inner cavity excluded
    expect(overlay.geometry.attributes.position.count).toBe(3)
  })

  it('verifies SWITCH_LAYOUTS contains watertight counts for 60%, 75%, and 100% layouts', () => {
    expect(SWITCH_LAYOUT_POSITIONS_60).toHaveLength(61)
    expect(SWITCH_LAYOUT_POSITIONS).toHaveLength(81)
    expect(SWITCH_LAYOUT_POSITIONS_100).toHaveLength(104)

    expect(SWITCH_LAYOUTS['60']).toHaveLength(61)
    expect(SWITCH_LAYOUTS['75']).toHaveLength(81)
    expect(SWITCH_LAYOUTS['100']).toHaveLength(104)
  })

  it('correctly distinguishes side legend engraving decals from physical keycap rows', () => {
    // 75% glTF layout: primitive 1 is 'keycaps engraving'
    const sideLegendMat = new THREE.MeshStandardMaterial({ name: 'keycaps engraving' })
    const sideLegendMesh = new THREE.Mesh(new THREE.BufferGeometry(), sideLegendMat)
    sideLegendMesh.name = 'Layer_Keycaps_2'

    expect(isSideLegendMesh(sideLegendMesh)).toBe(true)
    expect(isSideLegendMesh(sideLegendMesh, sideLegendMat)).toBe(true)

    // 60% glTF layout: Layer_Keycaps_2 is primitive 1 ('light gray keycap 2' - QWERTY row!)
    // It must NEVER be treated as a decal mesh
    const qwertyMat = new THREE.MeshStandardMaterial({ name: 'light gray keycap 2' })
    const qwertyMesh = new THREE.Mesh(new THREE.BufferGeometry(), qwertyMat)
    qwertyMesh.name = 'Layer_Keycaps_2'

    expect(isSideLegendMesh(qwertyMesh)).toBe(false)
    expect(isSideLegendMesh(qwertyMesh, qwertyMat)).toBe(false)

    // Other keycap materials
    const blackMat = new THREE.MeshStandardMaterial({ name: 'black gray keycaps' })
    const blackMesh = new THREE.Mesh(new THREE.BufferGeometry(), blackMat)
    blackMesh.name = 'Layer_Keycaps_3'

    expect(isSideLegendMesh(blackMesh)).toBe(false)
    expect(isSideLegendMesh(blackMesh, blackMat)).toBe(false)

    // Explicit userData flag
    const explicitLegendMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial())
    explicitLegendMesh.userData.isLegend = true
    expect(isSideLegendMesh(explicitLegendMesh)).toBe(true)
  })
})
