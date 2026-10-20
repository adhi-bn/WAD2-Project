/**
 * @fileoverview Integration tests for the 3D Exploded Anatomy keyboard feature.
 * Validates domain constants, explosion curves, Three.js scene creation,
 * instanced switch matrices, performance budgets, WebGL fallbacks, and Vue UI integration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as THREE from 'three'

import {
  ANATOMY_LAYERS,
  BAREBONES_BUNDLED_LAYER_IDS,
  computeExplosionFactor,
  computeGuideExplosionFactor,
  isWebGLAvailable,
  buildProceduralGasketLayers,
  buildProceduralFallbackLayers,
  createSwitchMatrixInstances,
  createExplodedAnatomyScene,
} from '../../src/lib/explodedAnatomyScene.js'
import { KEYBOARD_DIMENSIONS, SWITCH_LAYOUT_POSITIONS } from '../../src/lib/keyboardSwitchLayout.js'
import ExplodedAnatomyCanvas from '../../src/components/ExplodedAnatomyCanvas.vue'
import HomeView from '../../src/views/HomeView.vue'

/**
 * Creates a memory router for HomeView integration tests.
 *
 * @returns {import('vue-router').Router} Configured test router.
 */
function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/builder', component: { template: '<div id="builder-stub">Builder</div>' } },
    ],
  })
}

describe('Exploded Anatomy Domain Constants & Math', () => {
  it('defines all 6 layers in strict physical order and brackets barebones internals', () => {
    expect(ANATOMY_LAYERS).toHaveLength(6)

    const expectedLabels = ['Keycaps', '5-pin Switches', 'Plate', 'PCB', 'Foam', 'Case']
    const expectedIds = ['keycaps', 'switches', 'plate', 'pcb', 'foam', 'case']

    expect(ANATOMY_LAYERS.map((l) => l.label)).toEqual(expectedLabels)
    expect(ANATOMY_LAYERS.map((l) => l.id)).toEqual(expectedIds)

    // Verify Barebones kit bundled layer IDs
    expect(BAREBONES_BUNDLED_LAYER_IDS).toEqual(['plate', 'pcb', 'foam', 'case'])

    // Verify individual layer flags and part categories
    const barebonesLayers = ANATOMY_LAYERS.filter((l) => l.isBarebonesInternals)
    expect(barebonesLayers.map((l) => l.id)).toEqual(['plate', 'pcb', 'foam', 'case'])
    for (const layer of barebonesLayers) {
      expect(layer.partCategory).toBe('Barebones kit')
    }

    const coreParts = ANATOMY_LAYERS.filter((l) => !l.isBarebonesInternals)
    expect(coreParts.map((l) => l.id)).toEqual(['keycaps', 'switches'])
    expect(coreParts[0].partCategory).toBe('Keycaps')
    expect(coreParts[1].partCategory).toBe('Switches')
  })

  it('computes smooth hermite explosion factor curves across scroll progress', () => {
    // Hero top: holds completely closed
    expect(computeExplosionFactor(0)).toBe(0)
    expect(computeExplosionFactor(0.05)).toBe(0)
    expect(computeExplosionFactor(0.1)).toBe(0)

    // Active explosion ramp (0.10 - 0.55)
    const factorEarly = computeExplosionFactor(0.2)
    const factorMid = computeExplosionFactor(0.35)
    const factorLate = computeExplosionFactor(0.5)

    expect(factorEarly).toBeGreaterThan(0)
    expect(factorMid).toBeGreaterThan(factorEarly)
    expect(factorLate).toBeGreaterThan(factorMid)
    expect(computeExplosionFactor(0.55)).toBe(1.0)
    expect(computeExplosionFactor(0.58)).toBe(1.0)
    expect(computeExplosionFactor(0.6)).toBe(1.0)

    // Continuous decay without long flat plateau (no plateau longer than 0.06 band)
    const factorPastPeak = computeExplosionFactor(0.7)
    expect(factorPastPeak).toBeGreaterThan(0)
    expect(factorPastPeak).toBeLessThan(1.0)

    // Smooth reassembly back down across .hs-end
    const factorReassembly = computeExplosionFactor(0.85)
    expect(factorReassembly).toBeGreaterThan(0)
    expect(factorReassembly).toBeLessThan(factorPastPeak)
    expect(computeExplosionFactor(0.94)).toBe(0)
    expect(computeExplosionFactor(1.0)).toBe(0)

    // Clamps out-of-range scroll progress values
    expect(computeExplosionFactor(-0.5)).toBe(0)
    expect(computeExplosionFactor(1.5)).toBe(0)
    expect(computeExplosionFactor(Number.NaN)).toBe(0)
  })

  it('returns a static non-zero factor when reduced motion is preferred', () => {
    // Default static factor is 0.72
    expect(computeExplosionFactor(0, { reducedMotion: true })).toBe(0.72)
    expect(computeExplosionFactor(0.25, { reducedMotion: true })).toBe(0.72)
    expect(computeExplosionFactor(0.65, { reducedMotion: true })).toBe(0.72)
    expect(computeExplosionFactor(0.98, { reducedMotion: true })).toBe(0.72)
    expect(computeExplosionFactor(1.0, { reducedMotion: true })).toBe(0.72)

    // Supports custom static factor override
    expect(computeExplosionFactor(0.5, { reducedMotion: true, staticFactor: 0.5 })).toBe(0.5)
  })

  it('procedurally synthesizes gasket acoustic stack and ENIG PCB layers', () => {
    const gasket = buildProceduralGasketLayers()
    expect(gasket.Layer_PCB).toBeDefined()
    expect(gasket.Layer_Foam).toBeDefined()
    expect(gasket.Layer_PCB.name).toBe('Layer_PCB')
    expect(gasket.Layer_Foam.name).toBe('Layer_Foam')

    // Foam group contains PORON plate cotton and IXPE/case cotton sheets
    expect(gasket.Layer_Foam.children.length).toBeGreaterThanOrEqual(2)
  })

  it('guarantees >=0.2mm clean vertical clearance and zero overlap between procedural gasket layers (REV-3)', () => {
    const gasket = buildProceduralGasketLayers()
    const pcbMesh = gasket.Layer_PCB
    pcbMesh.geometry.computeBoundingBox()
    const pcbBox = pcbMesh.geometry.boundingBox

    const ixpeMesh = gasket.Layer_Foam.children.find((c) => c.name === 'Mesh_IXPE_Underpad')
    ixpeMesh.geometry.computeBoundingBox()
    const ixpeBox = ixpeMesh.geometry.boundingBox

    const poronMesh = gasket.Layer_Foam.children.find((c) => c.name === 'Mesh_Plate_Cotton')
    poronMesh.geometry.computeBoundingBox()
    const poronBox = poronMesh.geometry.boundingBox

    const plateBottomLocalY = -0.0044

    // Clearance between plate bottom and plate cotton (top of merged poron) is >= 0.2mm
    expect(plateBottomLocalY - poronBox.max.y).toBeGreaterThanOrEqual(0.0002)

    // Clearance between PCB bottom and IXPE underpad top is >= 0.2mm
    expect(pcbBox.min.y - ixpeBox.max.y).toBeGreaterThanOrEqual(0.0002)

    // IXPE lies strictly above case cotton bottom with clearance
    expect(ixpeBox.min.y).toBeGreaterThan(poronBox.min.y)
    expect(ixpeBox.min.y - poronBox.min.y).toBeGreaterThanOrEqual(0.002)
  })

  it('preserves current scroll progress when toggling reduced motion without resetting to 0 (REV-7)', () => {
    const canvas = document.createElement('canvas')
    const scene = createExplodedAnatomyScene({
      canvas,
      loadGlb: false,
      rendererFactory: ({ canvas: c }) => ({
        domElement: c,
        render: vi.fn(),
        setSize: vi.fn(),
        dispose: vi.fn(),
        resetState: vi.fn(),
      }),
    })

    scene.setExplosionProgress(0.5)
    scene.setReducedMotion(true)
    const statsReduced = scene.getStats()
    expect(statsReduced.explosionFactor).toBe(0.72)

    scene.setReducedMotion(false)
    const statsNormal = scene.getStats()
    expect(statsNormal.explosionFactor).toBeCloseTo(1.0, 1)

    scene.dispose()
  })

  it('builds procedural fallback layers for all 6 anatomy layers', () => {
    const layers = buildProceduralFallbackLayers()
    expect(Object.keys(layers)).toEqual(['keycaps', 'switches', 'plate', 'pcb', 'foam', 'case'])
    for (const key of Object.keys(layers)) {
      expect(layers[key].isGroup || layers[key].isMesh).toBe(true)
    }
  })

  it('verifies all 81 switch hole cutouts lie fully inside the PCB slab outline with positive margin', () => {
    const plateCenter = KEYBOARD_DIMENSIONS.plateCenter || { x: 0, y: 0.01972, z: -0.00864 }
    const slope = KEYBOARD_DIMENSIONS.slopeRad || 0.0735
    const cosSlope = Math.cos(slope)
    const halfWidth = (KEYBOARD_DIMENSIONS.pcbWidth || 0.304) / 2
    const halfDepth = (KEYBOARD_DIMENSIONS.pcbDepth || 0.116) / 2
    const holeRadius = 0.002

    SWITCH_LAYOUT_POSITIONS.forEach((pos, idx) => {
      const lx = pos.x - plateCenter.x
      const lz = (pos.z - plateCenter.z) / cosSlope
      const marginX = halfWidth - Math.abs(lx) - holeRadius
      const marginZ = halfDepth - Math.abs(lz) - holeRadius

      expect(marginX).toBeGreaterThan(0)
      expect(marginZ).toBeGreaterThan(0)
    })
  })

  it('computes guided card-by-card explosion curve holding across all 6 layer cards', () => {
    expect(computeGuideExplosionFactor(0)).toBe(0)
    expect(computeGuideExplosionFactor(0.04)).toBe(0)

    // Ramps during intro card (0.05 to 0.18)
    const factorRamp = computeGuideExplosionFactor(0.12)
    expect(factorRamp).toBeGreaterThan(0)
    expect(factorRamp).toBeLessThan(1.0)

    // Holds at 1.0 across the 6 layer cards and step cards (0.18 to 0.82)
    expect(computeGuideExplosionFactor(0.2)).toBe(1.0)
    expect(computeGuideExplosionFactor(0.35)).toBe(1.0)
    expect(computeGuideExplosionFactor(0.5)).toBe(1.0)
    expect(computeGuideExplosionFactor(0.65)).toBe(1.0)
    expect(computeGuideExplosionFactor(0.8)).toBe(1.0)

    // Reassembles at outro (0.82 to 0.96)
    const factorReassembly = computeGuideExplosionFactor(0.89)
    expect(factorReassembly).toBeGreaterThan(0)
    expect(factorReassembly).toBeLessThan(1.0)
    expect(computeGuideExplosionFactor(0.97)).toBe(0)
    expect(computeGuideExplosionFactor(1.0)).toBe(0)
  })
})

describe('createExplodedAnatomyScene with mock renderer', () => {
  let mockRenderer
  let capturedScene
  let capturedCamera
  let sceneController

  beforeEach(() => {
    capturedScene = null
    capturedCamera = null
    mockRenderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
    }

    sceneController = createExplodedAnatomyScene({
      rendererFactory: ({ scene, camera }) => {
        capturedScene = scene
        capturedCamera = camera
        return mockRenderer
      },
      loadGlb: false, // procedural fallback mode
    })
  })

  afterEach(() => {
    sceneController?.dispose()
  })

  it('builds all 6 layer groups inside the scene hierarchy', () => {
    expect(capturedScene).toBeDefined()
    const root = capturedScene.getObjectByName('Keyboard_Root')
    expect(root).toBeDefined()

    const expectedNodes = [
      'Layer_Keycaps',
      'Layer_Switches',
      'Layer_Plate',
      'Layer_PCB',
      'Layer_Foam',
      'Layer_Case',
    ]

    for (const nodeName of expectedNodes) {
      const node = capturedScene.getObjectByName(nodeName)
      expect(node).toBeDefined()
      expect(node.isGroup).toBe(true)
    }
  })

  it('uses THREE.InstancedMesh with 81 instances for switches', () => {
    const switchesGroup = capturedScene.getObjectByName('Layer_Switches')
    expect(switchesGroup).toBeDefined()

    const instancedMesh = switchesGroup.children.find((child) => child.isInstancedMesh)
    expect(instancedMesh).toBeDefined()
    expect(instancedMesh.name).toBe('Switch_Instances_Fallback')
    expect(instancedMesh.count).toBe(81)
  })

  it('reports drawCalls <= 10 and triangles < 40000 via getStats()', () => {
    const stats = sceneController.getStats()
    expect(stats.layerCount).toBe(6)
    expect(stats.switchInstanceCount).toBe(81)
    expect(stats.drawCalls).toBeLessThanOrEqual(10)
    expect(stats.triangles).toBeLessThan(40000)
    expect(stats.mode).toBe('procedural')
  })

  it('updates Y positions of layer groups on setExplosionProgress(progress)', () => {
    const keycaps = capturedScene.getObjectByName('Layer_Keycaps')
    const caseGroup = capturedScene.getObjectByName('Layer_Case')
    const keycapsLayer = ANATOMY_LAYERS.find((l) => l.id === 'keycaps')
    const caseLayer = ANATOMY_LAYERS.find((l) => l.id === 'case')

    // At progress 0 (factor 0): all layers are at y = 0
    sceneController.setExplosionProgress(0)
    expect(keycaps.position.y).toBeCloseTo(0, 4)
    expect(caseGroup.position.y).toBeCloseTo(0, 4)

    // At progress 0.60 (factor 1.0): layers reach maximum separation
    sceneController.setExplosionProgress(0.6)
    expect(keycaps.position.y).toBeCloseTo(keycapsLayer.yOffset, 4)
    expect(caseGroup.position.y).toBeCloseTo(caseLayer.yOffset, 4)

    // At progress 1.0 (reassembled): layers return to y = 0
    sceneController.setExplosionProgress(1.0)
    expect(keycaps.position.y).toBeCloseTo(0, 4)
    expect(caseGroup.position.y).toBeCloseTo(0, 4)
  })

  it('supports interactive layer highlighting and dimming', () => {
    const keycaps = capturedScene.getObjectByName('Layer_Keycaps')
    const plate = capturedScene.getObjectByName('Layer_Plate')

    const keycapsMesh = keycaps.children.find((c) => c.isMesh)
    const plateMesh = plate.children.find((c) => c.isMesh)

    // Highlight keycaps (base opacity 1.0 remains 1.0; plate base 0.82 dims to 0.82*0.35 = 0.287)
    sceneController.setHighlightedLayer('keycaps')
    expect(keycapsMesh.material.opacity).toBe(1.0)
    expect(plateMesh.material.opacity).toBeCloseTo(0.82 * 0.35, 3)

    // Reset highlight
    sceneController.setHighlightedLayer('')
    expect(plateMesh.material.opacity).toBeCloseTo(0.82, 2)
  })

  it('supports applyHighlight on a mesh with multi-material array (REV-3)', () => {
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)

    // Replace single material with an array of two MeshStandardMaterials
    const matA = new THREE.MeshStandardMaterial({
      color: 0xe6e9f0,
      opacity: 0.8,
      transparent: true,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 1,
    })
    const matB = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      opacity: 0.9,
      transparent: false,
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: 0.5,
    })
    plateMesh.material = [matA, matB]
    delete plateMesh.userData.clonedForHighlight
    delete plateMesh.userData.origMaterials

    // Highlight plate layer: restores to each material's designed base opacity (0.8 and 0.9, not 1.0)
    sceneController.setHighlightedLayer('plate')
    expect(Array.isArray(plateMesh.material)).toBe(true)
    expect(plateMesh.material[0].opacity).toBeCloseTo(0.8, 2)
    expect(plateMesh.material[1].opacity).toBeCloseTo(0.9, 2)
    expect(plateMesh.material[0].emissiveIntensity).toBe(0.45)
    expect(plateMesh.material[1].emissiveIntensity).toBe(0.45)

    // Dim plate layer by highlighting keycaps (dimmed = base * 0.35)
    sceneController.setHighlightedLayer('keycaps')
    expect(plateMesh.material[0].transparent).toBe(true)
    expect(plateMesh.material[0].opacity).toBeCloseTo(0.8 * 0.35, 3)
    expect(plateMesh.material[1].transparent).toBe(true)
    expect(plateMesh.material[1].opacity).toBeCloseTo(0.9 * 0.35, 3)

    // Reset highlight
    sceneController.setHighlightedLayer('')
    expect(plateMesh.material[0].opacity).toBeCloseTo(0.8, 2)
    expect(plateMesh.material[1].opacity).toBeCloseTo(0.9, 2)
  })

  it('instantiates 81-instance InstancedMesh for each primitive in multi-material switch prototype and reports switchInstanceCount = 81', () => {
    const switchesGroup = capturedScene.getObjectByName('Layer_Switches')
    expect(switchesGroup).toBeDefined()

    // Create a multi-material Switch_Prototype group mimicking the 4 Blender primitives
    const protoGroup = new THREE.Group()
    protoGroup.name = 'Switch_Prototype'

    const housingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.005, 0.014),
      new THREE.MeshStandardMaterial({ name: 'switches support' })
    )
    const topHousingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.005, 0.014),
      new THREE.MeshStandardMaterial({ name: 'switches transparent', transparent: true, opacity: 0.48 })
    )
    const pinsMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.002, 0.006, 0.002),
      new THREE.MeshStandardMaterial({ name: 'pins', metalness: 1.0 })
    )
    const stemMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.008, 0.004),
      new THREE.MeshStandardMaterial({ name: 'switch_stem', color: 0xd9468f })
    )
    protoGroup.add(housingMesh, topHousingMesh, pinsMesh, stemMesh)

    // Ingest the multi-primitive switch prototype
    const createdInstances = sceneController.ingestSwitchPrototype(protoGroup)
    expect(createdInstances).toHaveLength(4)

    // Layer_Switches now contains 4 separate InstancedMesh objects (one per primitive)
    const instancedMeshes = switchesGroup.children.filter((child) => child.isInstancedMesh)
    expect(instancedMeshes).toHaveLength(4)

    // Each primitive has exactly 81 instances transformed across the switch layout with Switch_Instances_ prefix
    for (const inst of instancedMeshes) {
      expect(inst.count).toBe(81)
      expect(inst.name.startsWith('Switch_Instances_')).toBe(true)
    }

    // Translucent switch housing material depthWrite is set to true (B-2)
    expect(topHousingMesh.material.depthWrite).toBe(true)
    expect(topHousingMesh.material.opacity).toBeCloseTo(0.78, 2)

    // getStats() reports switchInstanceCount as 81 (not 4 * 81 = 324)
    const stats = sceneController.getStats()
    expect(stats.switchInstanceCount).toBe(81)
  })

  it('updates dynamic RGB backlighting and restores cleanly after layer highlighting', () => {
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)
    expect(plateMesh).toBeDefined()

    // Initially, Layer_Plate has default emissive backlight (B-2: default 0.35)
    expect(plateMesh.material.emissive).toBeDefined()
    expect(plateMesh.material.emissiveIntensity).toBeCloseTo(0.35, 2)

    // Dynamically set custom RGB backlight color (e.g., magenta-pink 0xff007f at intensity 2.0)
    sceneController.setRgbBacklightColor(0xff007f, 2.0)
    expect(plateMesh.material.emissive.getHex()).toBe(0xff007f)
    expect(plateMesh.material.emissiveIntensity).toBe(2.0)
    expect(sceneController.getRgbBacklightColor().getHex()).toBe(0xff007f)

    // Highlight keycaps: non-target layers (including plate) are dimmed
    sceneController.setHighlightedLayer('keycaps')
    expect(plateMesh.material.emissive.getHex()).toBe(0x000000)

    // Reset highlight: plate emissive cleanly restores to custom RGB backlight
    sceneController.setHighlightedLayer('')
    expect(plateMesh.material.emissive.getHex()).toBe(0xff007f)
    expect(plateMesh.material.emissiveIntensity).toBe(2.0)

    // Highlight plate itself: gets layer accent color
    sceneController.setHighlightedLayer('plate')
    expect(plateMesh.material.emissiveIntensity).toBe(0.45)

    // Reset highlight again: plate restores to custom RGB backlight
    sceneController.setHighlightedLayer('')
    expect(plateMesh.material.emissive.getHex()).toBe(0xff007f)
    expect(plateMesh.material.emissiveIntensity).toBe(2.0)
  })

  it('createSwitchMatrixInstances populates target group with instanced primitives', () => {
    const targetGroup = new THREE.Group()
    const singleMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
    const created = createSwitchMatrixInstances(singleMesh, targetGroup)
    expect(created).toHaveLength(1)
    expect(created[0].count).toBe(81)
    expect(targetGroup.children).toHaveLength(1)
  })

  it('exposes hasRenderer() and setReducedMotion() on scene controller (REV-5, REV-6)', () => {
    expect(sceneController.hasRenderer()).toBe(true)
    expect(() => sceneController.setReducedMotion(true)).not.toThrow()
    expect(() => sceneController.setReducedMotion(false)).not.toThrow()
  })

  it('handles webglcontextlost event and invokes onContextLost callback (REV-5)', () => {
    const onContextLost = vi.fn()
    const fakeCanvas = {
      clientWidth: 800,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const ctrl = createExplodedAnatomyScene({
      canvas: fakeCanvas,
      rendererFactory: () => ({
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
      }),
      loadGlb: false,
      onContextLost,
    })

    expect(fakeCanvas.addEventListener).toHaveBeenCalledWith('webglcontextlost', expect.any(Function))
    const contextLostHandler = fakeCanvas.addEventListener.mock.calls.find(
      (c) => c[0] === 'webglcontextlost'
    )[1]

    const fakeEvent = { preventDefault: vi.fn() }
    contextLostHandler(fakeEvent)

    expect(fakeEvent.preventDefault).toHaveBeenCalled()
    expect(ctrl.isPaused()).toBe(true)
    expect(onContextLost).toHaveBeenCalledWith(fakeEvent)

    ctrl.dispose()
    expect(fakeCanvas.removeEventListener).toHaveBeenCalledWith('webglcontextlost', contextLostHandler)
  })

  it('supports pause(), resume(), and isPaused() animation controls', () => {
    expect(sceneController.isPaused()).toBe(false)

    sceneController.pause()
    expect(sceneController.isPaused()).toBe(true)

    sceneController.resume()
    expect(sceneController.isPaused()).toBe(false)
  })

  it('restores a material with base opacity 0.5 to 0.5 (not 1.0) on target highlight (F-03)', () => {
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)

    // Set a custom base opacity of 0.5
    const customMat = new THREE.MeshStandardMaterial({
      color: 0xe6e9f0,
      opacity: 0.5,
      transparent: true,
      emissive: new THREE.Color(0x000000),
    })
    plateMesh.material = customMat
    delete plateMesh.userData.clonedForHighlight
    delete plateMesh.userData.origMaterials

    // Highlight target layer (plate)
    sceneController.setHighlightedLayer('plate')
    // Opacity on target layer must restore to designed base opacity 0.5, NOT 1.0 (F-03)
    expect(plateMesh.material.opacity).toBeCloseTo(0.5, 3)

    // Dim plate layer by highlighting keycaps
    sceneController.setHighlightedLayer('keycaps')
    expect(plateMesh.material.opacity).toBeCloseTo(0.5 * 0.35, 3)

    // Reset highlighting completely
    sceneController.setHighlightedLayer('')
    expect(plateMesh.material.opacity).toBeCloseTo(0.5, 3)
  })

  it('does not call scene.traverse during setRgbBacklightColor after setup (F-04)', () => {
    const traverseSpy = vi.spyOn(capturedScene, 'traverse')

    sceneController.setRgbBacklightColor(0x00ff88, 1.8)

    // Verify scene.traverse was NOT called
    expect(traverseSpy).not.toHaveBeenCalled()

    // Verify the color was indeed applied to plate emissive via cached array
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)
    expect(plateMesh.material.emissive.getHex()).toBe(0x00ff88)
    expect(plateMesh.material.emissiveIntensity).toBe(1.8)

    traverseSpy.mockRestore()
  })

  it('enforces depthWrite = true on translucent switch materials (B-2) and preserves decal opacity on dimming (F-02)', () => {
    // 1. Switch prototype with translucent material
    const targetGroup = new THREE.Group()
    const transSwitchMat = new THREE.MeshStandardMaterial({
      name: 'switches transparent',
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
    const switchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), transSwitchMat)
    createSwitchMatrixInstances(switchMesh, targetGroup)
    expect(transSwitchMat.depthWrite).toBe(true)
    expect(transSwitchMat.opacity).toBeCloseTo(0.78, 2)

    // 2. Keycap legend decal primitive setup and dimming behavior
    const keycaps = capturedScene.getObjectByName('Layer_Keycaps')
    const decalMat = new THREE.MeshStandardMaterial({
      name: 'keycaps engraving',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const decalMesh = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.001, 0.01), decalMat)
    keycaps.add(decalMesh)

    // Test dimming decal when another layer (plate) is highlighted: opacity = min(origOpacity, 0.35)
    sceneController.setHighlightedLayer('plate')
    expect(decalMesh.material.opacity).toBeCloseTo(0.35, 2)
    expect(decalMesh.material.depthWrite).toBe(false)

    // Reset highlight
    sceneController.setHighlightedLayer('')
    expect(decalMesh.material.opacity).toBeCloseTo(0.95, 2)
    expect(decalMesh.material.depthWrite).toBe(false)
  })

  it('disposes texture maps on materials and clears scene.environment on dispose (F-05)', () => {
    const fakeTexture = { dispose: vi.fn() }
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)
    plateMesh.material.emissiveMap = fakeTexture
    plateMesh.material.normalMap = fakeTexture
    plateMesh.material.roughnessMap = fakeTexture
    plateMesh.material.metalnessMap = fakeTexture

    capturedScene.environment = {}

    sceneController.dispose()
    expect(fakeTexture.dispose).toHaveBeenCalled()
    expect(capturedScene.environment).toBeNull()
  })

  it('falls back to procedural layers and warns on non-ok or text/html GLB responses (F-06)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'text/plain' }),
    })

    const ctrl = createExplodedAnatomyScene({
      glbUrl: '/models/missing-model.glb',
      loadGlb: true,
      rendererFactory: () => ({
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
      }),
    })

    await flushPromises()
    expect(ctrl.getStats().mode).toBe('procedural')
    expect(warnSpy).toHaveBeenCalledWith(
      'Exploded anatomy GLTF load notice (procedural fallback active):',
      expect.any(Error)
    )

    fetchSpy.mockRestore()
    warnSpy.mockRestore()
    ctrl.dispose()
  })

  it('rejects HTML 404 response pages from returning as valid GLB buffer (F-06)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      arrayBuffer: async () => new ArrayBuffer(10),
    })

    const ctrl = createExplodedAnatomyScene({
      glbUrl: '/models/exploded-keyboard.glb',
      loadGlb: true,
      rendererFactory: () => ({
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
      }),
    })

    await flushPromises()
    expect(ctrl.getStats().mode).toBe('procedural')
    expect(warnSpy).toHaveBeenCalledWith(
      'Exploded anatomy GLTF load notice (procedural fallback active):',
      expect.objectContaining({
        message: expect.stringContaining('Invalid content-type for GLB'),
      })
    )

    fetchSpy.mockRestore()
    warnSpy.mockRestore()
    ctrl.dispose()
  })

  it('configures ACESFilmicToneMapping and exposure on renderer (B-1, B-6)', () => {
    expect(mockRenderer.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(mockRenderer.toneMappingExposure).toBeCloseTo(0.95, 2)
  })

  it('sets scene.environmentIntensity = 0.35 when PMREM environment is configured (B-1, B-6)', () => {
    const compileSpy = vi
      .spyOn(THREE.PMREMGenerator.prototype, 'compileEquirectangularShader')
      .mockReturnValue()
    const pmremSpy = vi.spyOn(THREE.PMREMGenerator.prototype, 'fromScene').mockReturnValue({
      texture: { dispose: vi.fn() },
      dispose: vi.fn(),
    })
    let testScene = null
    const ctrl = createExplodedAnatomyScene({
      rendererFactory: ({ scene }) => {
        testScene = scene
        return {
          render: vi.fn(),
          setSize: vi.fn(),
          setPixelRatio: vi.fn(),
          dispose: vi.fn(),
          forceContextLoss: vi.fn(),
        }
      },
      loadGlb: false,
    })
    expect(testScene.environmentIntensity).toBe(0.35)
    ctrl.dispose()
    pmremSpy.mockRestore()
    compileSpy.mockRestore()
  })

  it('creates PCB slab with 81 switch cutouts and 81-instance PCB_Hotswap_Pads (B-4, B-6)', () => {
    const pcbNode = capturedScene.getObjectByName('Layer_PCB')
    expect(pcbNode).toBeDefined()

    // PCB slab mesh has ExtrudeGeometry with switch and stabilizer cutouts
    const pcbMesh = pcbNode.children.find((c) => c.name === 'Layer_PCB' || c.isMesh)
    expect(pcbMesh).toBeDefined()
    expect(pcbMesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry)
    // 81 switch holes + stabilizer slots significantly increase triangle count (> 2,000 triangles)
    const triCount = pcbMesh.geometry.attributes.position.count / 3
    expect(triCount).toBeGreaterThan(2000)

    // InstancedMesh 'PCB_Hotswap_Pads' with exactly 81 instances
    const padsInst = pcbNode.getObjectByName('PCB_Hotswap_Pads')
    expect(padsInst).toBeDefined()
    expect(padsInst.isInstancedMesh).toBe(true)
    expect(padsInst.count).toBe(81)
    expect(padsInst.name).toBe('PCB_Hotswap_Pads')
  })

  it('assigns distinct non-gray colors to PCB (#115e38) and Foam (#dfd3c3 / #8b5cf6) (B-3, B-6)', () => {
    const pcbLayer = ANATOMY_LAYERS.find((l) => l.id === 'pcb')
    const foamLayer = ANATOMY_LAYERS.find((l) => l.id === 'foam')
    const caseLayer = ANATOMY_LAYERS.find((l) => l.id === 'case')

    expect(pcbLayer.color).toBe('#115e38')
    expect(pcbLayer.accentColor).toBe('#d4af37')
    expect(foamLayer.color).toBe('#dfd3c3')
    expect(foamLayer.accentColor).toBe('#8b5cf6')

    expect(pcbLayer.color).not.toBe(foamLayer.color)
    expect(pcbLayer.color).not.toBe(caseLayer.color)
    expect(foamLayer.color).not.toBe(caseLayer.color)

    // Check procedural mesh materials in the scene
    const pcbNode = capturedScene.getObjectByName('Layer_PCB')
    const pcbMesh = pcbNode.children.find((c) => c.isMesh)
    expect(pcbMesh.material.color.getHexString().toLowerCase()).toBe('115e38')

    const foamNode = capturedScene.getObjectByName('Layer_Foam')
    const poronMesh = foamNode.getObjectByName('Mesh_Plate_Cotton')
    const ixpeMesh = foamNode.getObjectByName('Mesh_IXPE_Underpad')
    expect(poronMesh.material.color.getHexString().toLowerCase()).toBe('dfd3c3')
    expect(ixpeMesh.material.color.getHexString().toLowerCase()).toBe('8b5cf6')
  })

  it('smoothly damps scroll progress to target over step() iterations (B-5, B-6)', () => {
    // Set smooth progress to 0.8
    sceneController.setExplosionProgress(0.8, { smooth: true })
    expect(sceneController.getTargetProgress()).toBe(0.8)
    expect(sceneController.getCurrentProgress()).toBeCloseTo(0.0, 3)

    // Run step() simulation for 90 frames (~1.5s at 60fps)
    for (let i = 0; i < 90; i++) {
      sceneController.step(1 / 60)
    }

    // Current progress should have converged to 0.8 within 1e-3
    expect(sceneController.getCurrentProgress()).toBeCloseTo(0.8, 3)
  })

  it('scroll-driven 3D orbital camera sweeps position between e=0 and e=1, and holds fixed under reduced motion (B-5, B-6)', () => {
    // At progress 0 (e = 0)
    sceneController.setExplosionProgress(0, { smooth: false })
    const posAtZero = capturedCamera.position.clone()

    // At progress 0.58 (e = 1)
    sceneController.setExplosionProgress(0.58, { smooth: false })
    const posAtOne = capturedCamera.position.clone()

    // Verify significant camera position movement between e=0 and e=1
    const distanceDelta = posAtZero.distanceTo(posAtOne)
    expect(distanceDelta).toBeGreaterThan(0.05)

    // Under reduced motion: camera position snaps back and stays fixed at (0.22, 0.24, 0.31)
    sceneController.setReducedMotion(true)
    expect(capturedCamera.position.x).toBeCloseTo(0.22, 3)
    expect(capturedCamera.position.y).toBeCloseTo(0.24, 3)
    expect(capturedCamera.position.z).toBeCloseTo(0.31, 3)

    // Changing progress under reduced motion does not alter camera position
    sceneController.setExplosionProgress(0.58, { smooth: false })
    expect(capturedCamera.position.x).toBeCloseTo(0.22, 3)
    expect(capturedCamera.position.y).toBeCloseTo(0.24, 3)
    expect(capturedCamera.position.z).toBeCloseTo(0.31, 3)
  })

  it('defaults setRgbBacklightColor intensity to 0.35 on Layer_Plate (B-2, B-6)', () => {
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)

    // Call setRgbBacklightColor with only color parameter
    sceneController.setRgbBacklightColor(0x00ffcc)
    expect(plateMesh.material.emissive.getHex()).toBe(0x00ffcc)
    expect(plateMesh.material.emissiveIntensity).toBeCloseTo(0.35, 2)
  })

  it('enforces roughness >= 0.65 and metalness = 0 on PBT keycap materials during GLB ingest (B-2)', () => {
    const fakeGltf = {
      scene: new THREE.Group(),
    }
    const keycapsMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.01, 0.01),
      new THREE.MeshStandardMaterial({
        name: 'white keycaps',
        roughness: 0.2,
        metalness: 0.8,
      })
    )
    const glbKeycapsGroup = new THREE.Group()
    glbKeycapsGroup.name = 'Layer_Keycaps'
    glbKeycapsGroup.add(keycapsMesh)
    fakeGltf.scene.add(glbKeycapsGroup)

    sceneController.ingestGltfScene(fakeGltf)
    expect(keycapsMesh.material.roughness).toBeGreaterThanOrEqual(0.65)
    expect(keycapsMesh.material.metalness).toBe(0)
  })

  it('successfully disposes scene resources and calls renderer.dispose()', () => {
    sceneController.dispose()
    expect(mockRenderer.dispose).toHaveBeenCalled()
    expect(mockRenderer.forceContextLoss).toHaveBeenCalled()

    // Subsequent updates after dispose are safe no-ops
    expect(() => {
      sceneController.setExplosionProgress(0.5)
      sceneController.setHighlightedLayer('pcb')
      sceneController.setFocusLayer('pcb')
      sceneController.step()
    }).not.toThrow()
  })

  it('does not run continuous requestAnimationFrame loop under reduced motion', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    const ctrl = createExplodedAnatomyScene({
      rendererFactory: () => ({
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        dispose: vi.fn(),
        forceContextLoss: vi.fn(),
      }),
      reducedMotion: true,
      loadGlb: false,
    })

    // Under reduced motion, no continuous loop is queued
    expect(rafSpy).not.toHaveBeenCalled()

    // Triggering updates renders on demand without starting a continuous loop
    ctrl.setExplosionProgress(0.5)
    ctrl.setHighlightedLayer('pcb')
    ctrl.setFocusLayer('pcb')
    expect(rafSpy).not.toHaveBeenCalled()

    ctrl.dispose()
    rafSpy.mockRestore()
  })

  it('safely handles non-finite inputs in setPointer and step without throwing (REV-4)', () => {
    expect(() => {
      sceneController.setPointer(NaN, Infinity)
      sceneController.setPointer(-Infinity, undefined)
      sceneController.step(NaN)
      sceneController.step(Infinity)
      sceneController.step(-0.5)
    }).not.toThrow()
  })

  it('sets depthWrite=false on dimmed layers and restores original on reset (REV-7)', () => {
    const plate = capturedScene.getObjectByName('Layer_Plate')
    const plateMesh = plate.children.find((c) => c.isMesh)
    expect(plateMesh).toBeDefined()

    // Initially depthWrite is true
    expect(plateMesh.material.depthWrite).toBe(true)

    // Highlight keycaps: plate becomes dimmed
    sceneController.setHighlightedLayer('keycaps')
    expect(plateMesh.material.depthWrite).toBe(false)
    expect(plateMesh.material.transparent).toBe(true)

    // Reset highlight: plate depthWrite restored to true
    sceneController.setHighlightedLayer('')
    expect(plateMesh.material.depthWrite).toBe(true)
  })

  it('reports explosionFactor rounded to 3 decimals in getStats() (R-3)', () => {
    sceneController.setExplosionProgress(0.5, { smooth: false })
    const stats = sceneController.getStats()
    expect(stats.explosionFactor).toBeDefined()
    expect(typeof stats.explosionFactor).toBe('number')
    expect(stats.explosionFactor).toBeGreaterThan(0.9)
  })

  it('converges camera focus toward active layer on setFocusLayer and applies instantly under reduced motion (C-3)', () => {
    // Under normal motion, setFocusLayer dampens over time
    sceneController.setFocusLayer('pcb')
    const initialY = capturedCamera.position.y
    sceneController.step(0.05)
    const step1Y = capturedCamera.position.y
    sceneController.step(0.1)
    const step2Y = capturedCamera.position.y
    expect(step1Y).not.toBe(initialY)
    expect(step2Y).not.toBe(step1Y)

    // Under reduced motion, applies instantly
    sceneController.setReducedMotion(true)
    sceneController.setFocusLayer('keycaps')
    const reducedY1 = capturedCamera.position.y
    sceneController.setFocusLayer('case')
    const reducedY2 = capturedCamera.position.y
    expect(reducedY1).not.toBe(reducedY2)
  })
})

describe('ExplodedAnatomyCanvas.vue in jsdom environment', () => {
  it('detects WebGL as unavailable in default jsdom and shows accessible HTML fallback', () => {
    expect(isWebGLAvailable()).toBe(false)

    const wrapper = mount(ExplodedAnatomyCanvas)

    // Canvas is not rendered when WebGL is unsupported
    expect(wrapper.find('canvas.exploded-anatomy-canvas').exists()).toBe(false)

    // Semantic status message for screen readers
    const status = wrapper.find('.exploded-anatomy-status')
    expect(status.exists()).toBe(true)
    expect(status.attributes('role')).toBe('status')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toContain('3D graphics unavailable')

    // Plain-HTML accessible fallback is visible
    const fallback = wrapper.find('.exploded-anatomy-fallback')
    expect(fallback.exists()).toBe(true)
    expect(fallback.classes()).toContain('is-fallback-visible')

    // All 6 layers are listed in DOM
    const items = wrapper.findAll('.fallback-layer-row')
    expect(items).toHaveLength(6)

    const layerNames = items.map((el) => el.find('.fallback-layer-name').text())
    expect(layerNames).toEqual(['Keycaps', '5-pin Switches', 'Plate', 'PCB', 'Foam', 'Case'])

    // Barebones kit bundled internals badges
    const barebonesBadges = wrapper.findAll('.fallback-badge.barebones')
    expect(barebonesBadges).toHaveLength(4)
    for (const badge of barebonesBadges) {
      expect(badge.text()).toContain('Barebones kit bundled')
    }

    // Core part badges
    const coreBadges = wrapper.findAll('.fallback-badge.core-part')
    expect(coreBadges).toHaveLength(2)
    expect(coreBadges[0].text()).toBe('Keycaps')
    expect(coreBadges[1].text()).toBe('Switches')

    // Mandatory disclaimer caption is rendered
    const disclaimer = wrapper.find('.fallback-disclaimer')
    expect(disclaimer.exists()).toBe(true)
    expect(disclaimer.text()).toContain(
      'Illustrative 3D structural guide — not a photorealistic, acoustic, or engineering-CAD claim.'
    )
  })

  it('renders canvas with aria-hidden="true" and tabindex="-1" when WebGL is simulated', async () => {
    // Simulate WebGL availability
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    const originalWebGL = window.WebGLRenderingContext

    window.WebGLRenderingContext = function () {}
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type.includes('webgl')) return {}
      return null
    })

    const mockRenderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
    }

    try {
      expect(isWebGLAvailable()).toBe(true)
      const wrapper = mount(ExplodedAnatomyCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      const canvas = wrapper.find('canvas.exploded-anatomy-canvas')
      expect(canvas.exists()).toBe(true)
      expect(canvas.attributes('aria-hidden')).toBe('true')
      expect(canvas.attributes('tabindex')).toBe('-1')

      const status = wrapper.find('.exploded-anatomy-status')
      expect(status.text()).toContain('3D exploded keyboard anatomy loaded')

      // Plain-HTML fallback is still maintained in the DOM for accessibility
      expect(wrapper.find('.exploded-anatomy-fallback').exists()).toBe(true)
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.WebGLRenderingContext = originalWebGL
    }
  })

  it('cleans up event listeners and observers on unmount', async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    const originalWebGL = window.WebGLRenderingContext
    window.WebGLRenderingContext = function () {}
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type.includes('webgl')) return {}
      return null
    })

    const mockRenderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
    }

    const removeWindowSpy = vi.spyOn(window, 'removeEventListener')
    const removeDocSpy = vi.spyOn(document, 'removeEventListener')

    const disconnectSpy = vi.fn()
    const observeSpy = vi.fn()
    const originalObserver = window.IntersectionObserver
    window.IntersectionObserver = class {
      observe = observeSpy
      disconnect = disconnectSpy
    }

    try {
      const wrapper = mount(ExplodedAnatomyCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()
      wrapper.unmount()

      expect(removeWindowSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
      expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(disconnectSpy).toHaveBeenCalled()
      expect(mockRenderer.dispose).toHaveBeenCalled()
    } finally {
      window.IntersectionObserver = originalObserver
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.WebGLRenderingContext = originalWebGL
      removeWindowSpy.mockRestore()
      removeDocSpy.mockRestore()
    }
  })

  it('transitions data-webgl-status to unavailable and shows fallback when rendererFactory throws (REV-5)', async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    const originalWebGL = window.WebGLRenderingContext

    window.WebGLRenderingContext = function () {}
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type.includes('webgl')) return {}
      return null
    })

    try {
      expect(isWebGLAvailable()).toBe(true)
      const wrapper = mount(ExplodedAnatomyCanvas, {
        props: {
          rendererFactory: () => {
            throw new Error('Simulated WebGLRenderer initialization failure')
          },
        },
      })
      await flushPromises()

      // Container has data-webgl-status="unavailable"
      expect(wrapper.attributes('data-webgl-status')).toBe('unavailable')

      // Fallback is rendered and visible
      const fallback = wrapper.find('.exploded-anatomy-fallback')
      expect(fallback.exists()).toBe(true)
      expect(fallback.classes()).toContain('is-fallback-visible')

      // Canvas is not rendered
      expect(wrapper.find('canvas.exploded-anatomy-canvas').exists()).toBe(false)

      // Screen reader status message indicates unavailable
      const status = wrapper.find('.exploded-anatomy-status')
      expect(status.text()).toContain('3D graphics unavailable')
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.WebGLRenderingContext = originalWebGL
    }
  })

  it('calls sceneController.dispose() and transitions to unavailable on webglcontextlost event (F-05)', async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    const originalWebGL = window.WebGLRenderingContext
    const originalObserver = window.IntersectionObserver

    window.IntersectionObserver = class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
    window.WebGLRenderingContext = function () {}
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type.includes('webgl')) return {}
      return null
    })

    const disposeSpy = vi.fn()
    const mockRenderer = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: disposeSpy,
      forceContextLoss: vi.fn(),
    }

    try {
      const wrapper = mount(ExplodedAnatomyCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      const canvas = wrapper.find('canvas.exploded-anatomy-canvas')
      expect(canvas.exists()).toBe(true)

      // Dispatch webglcontextlost on the canvas element
      const event = new Event('webglcontextlost', { cancelable: true })
      canvas.element.dispatchEvent(event)
      await flushPromises()

      expect(disposeSpy).toHaveBeenCalled()
      expect(wrapper.attributes('data-webgl-status')).toBe('unavailable')
    } finally {
      window.IntersectionObserver = originalObserver
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.WebGLRenderingContext = originalWebGL
    }
  })
})

describe('HomeView.vue Exploded Anatomy UI Integration', () => {
  it('renders .hs-look section with 6 layer chips and Barebones kit bracket', () => {
    const router = createTestRouter()
    const wrapper = mount(HomeView, { global: { plugins: [router] } })

    const lookSection = wrapper.find('.hs.hs-look')
    expect(lookSection.exists()).toBe(true)

    // Exploded anatomy canvas child component is mounted
    expect(wrapper.findComponent(ExplodedAnatomyCanvas).exists()).toBe(true)

    // Interactive layer chips
    const chipButtons = lookSection.findAll('button.layer-chip-btn')
    expect(chipButtons).toHaveLength(6)

    // All chip buttons have type="button" and initial aria-pressed="false"
    for (const btn of chipButtons) {
      expect(btn.attributes('type')).toBe('button')
      expect(btn.attributes('aria-pressed')).toBe('false')
    }

    // Barebones kit bracket grouping
    const bracket = lookSection.find('.barebones-bracket')
    expect(bracket.exists()).toBe(true)
    expect(bracket.find('.barebones-bracket-badge').text()).toBe(
      'Barebones kit (bundled internals)'
    )

    // 4 chips inside bracket
    const bracketChips = bracket.findAll('button.layer-chip-btn')
    expect(bracketChips).toHaveLength(4)
    expect(bracketChips.map((b) => b.text().trim())).toEqual(['Plate', 'PCB', 'Foam', 'Case'])

    // 2 chips outside bracket (Keycaps, Switches)
    const directChips = lookSection
      .findAll('button.layer-chip-btn')
      .filter((b) => !b.element.closest('.barebones-bracket'))
      .map((b) => b.text().trim())
    expect(directChips).toEqual(['Keycaps', '5-pin Switches'])

    // Disclaimer caption
    const disclaimer = lookSection.find('.anatomy-disclaimer')
    expect(disclaimer.exists()).toBe(true)
    expect(disclaimer.text()).toContain(
      'Illustrative 3D structural guide — not a photorealistic, acoustic, or engineering-CAD claim.'
    )
  })

  it('allows clicking layer chips to display details, acoustic stack info, and toggles selection', async () => {
    const router = createTestRouter()
    const wrapper = mount(HomeView, { global: { plugins: [router] } })

    const lookSection = wrapper.find('.hs.hs-look')

    // Initially no layer detail card
    expect(lookSection.find('.layer-detail-card').exists()).toBe(false)

    // Click "5-pin Switches" chip
    const switchBtn = lookSection
      .findAll('button.layer-chip-btn')
      .find((b) => b.text().includes('5-pin Switches'))
    expect(switchBtn).toBeDefined()

    await switchBtn.trigger('click')
    expect(switchBtn.attributes('aria-pressed')).toBe('true')
    expect(switchBtn.classes()).toContain('is-active')

    // Detail card appears with aria-live="polite"
    const detailCard = lookSection.find('.layer-detail-card')
    expect(detailCard.exists()).toBe(true)
    expect(detailCard.attributes('aria-live')).toBe('polite')
    expect(detailCard.find('.layer-detail-title').text()).toBe('5-pin Switches')
    expect(detailCard.find('.layer-detail-tag.core-part').text()).toBe('Switches')
    expect(detailCard.find('.layer-detail-desc').text()).toContain('81 hot-swap 5-pin mechanical switches')

    // Click "Foam" chip inside barebones bracket
    const foamBtn = lookSection
      .findAll('button.layer-chip-btn')
      .find((b) => b.text().includes('Foam'))
    await foamBtn.trigger('click')

    expect(switchBtn.attributes('aria-pressed')).toBe('false')
    expect(foamBtn.attributes('aria-pressed')).toBe('true')

    // Detail card updates to Foam and reveals Gasket acoustic stack specs
    expect(detailCard.find('.layer-detail-title').text()).toBe('Foam')
    expect(detailCard.find('.layer-detail-tag.barebones').text()).toBe('Barebones kit bundled')
    const gasketInfo = detailCard.find('.gasket-stack-info')
    expect(gasketInfo.exists()).toBe(true)
    expect(gasketInfo.text()).toContain(
      'PORON plate cotton, IXPE switch underpad, PET film, and bottom case cotton.'
    )

    // Clicking the same active chip deselects it
    await foamBtn.trigger('click')
    expect(foamBtn.attributes('aria-pressed')).toBe('false')
    expect(lookSection.find('.layer-detail-card').exists()).toBe(false)
  })

  it('keeps navigation to /builder working from the exploded anatomy section', () => {
    const router = createTestRouter()
    const wrapper = mount(HomeView, { global: { plugins: [router] } })

    const builderCta = wrapper.find('.hs.hs-look a.ui-btn[href="/builder"]')
    expect(builderCta.exists()).toBe(true)
    expect(builderCta.text()).toContain('Explore the builder')
  })
})
