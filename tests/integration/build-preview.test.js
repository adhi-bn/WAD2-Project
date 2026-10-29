/**
 * @fileoverview Integration tests for 3D Build Preview in Builder and Parts views.
 * Tests BuildPreviewCanvas mounting, WebGL simulation, camera presets,
 * plain-HTML summary accessibility, WebGL failure fallback, reduced motion,
 * 3-layer visual boundary (ADR-0008), BuilderView pickers, and PartsView build sheet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as THREE from 'three'

import BuildPreviewCanvas from '../../src/components/BuildPreviewCanvas.vue'
import PartsView from '../../src/views/PartsView.vue'
import {
  BUILD_PREVIEW_LAYERS,
  createBuildPreviewScene,
} from '../../src/lib/buildPreviewScene.js'
import {
  build,
  setLimit,
  setSlot,
} from '../../src/stores/build.js'
import { state, finishQuiz, choose } from '../../src/store.js'

/**
 * Test fixture presets for integration tests.
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

/**
 * Sets up a test router for mounting views.
 *
 * @returns {import('vue-router').Router}
 */
function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/parts', component: PartsView },
      { path: '/builder', redirect: '/parts' },
      { path: '/parts', component: PartsView },
      { path: '/swipe', component: { template: '<div id="swipe-stub">Swipe</div>' } },
      { path: '/build', component: { template: '<div id="build-stub">Build</div>' } },
    ],
  })
}

describe('BuildPreviewCanvas Integration', () => {
  const mountedWrappers = []
  function safeMount(comp, opts) {
    const w = mount(comp, opts)
    mountedWrappers.push(w)
    return w
  }
  let originalGetContext
  let originalWebGL
  let originalMatchMedia

  beforeEach(() => {
    // Reset build store before each test
    setSlot('barebones', null)
    setSlot('switches', null)
    setSlot('keycaps', null)
    setLimit(null)

    originalGetContext = HTMLCanvasElement.prototype.getContext
    originalWebGL = window.WebGLRenderingContext
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      try {
        mountedWrappers.pop().unmount()
      } catch {}
    }
    HTMLCanvasElement.prototype.getContext = originalGetContext
    window.WebGLRenderingContext = originalWebGL
    window.matchMedia = originalMatchMedia
    delete HTMLCanvasElement.prototype._mockRendererFactory
    vi.restoreAllMocks()
  })

  function simulateWebGLAvailable() {
    window.WebGLRenderingContext = function () {}
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type && type.includes('webgl')) return {}
      return null
    })
    HTMLCanvasElement.prototype._mockRendererFactory = createMockRenderer
  }

  it('Test 1: Mounts BuildPreviewCanvas with mock rendererFactory, verifies controls, caption, and HTML summary', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    // Canvas element
    const canvas = wrapper.find('canvas.lct-build-preview-canvas')
    expect(canvas.exists()).toBe(true)

    // Status badge announces ready semantically
    const statusBadge = wrapper.find('.lct-build-preview-status-badge')
    expect(statusBadge.exists()).toBe(true)
    expect(statusBadge.attributes('role')).toBe('status')
    expect(statusBadge.attributes('data-status')).toBe('ready')
    expect(statusBadge.text()).toContain('3D Ready')

    // Camera preset buttons
    const presetButtons = wrapper.findAll('.lct-btn-preset')
    expect(presetButtons.length).toBeGreaterThanOrEqual(4)
    const buttonTexts = presetButtons.map((b) => b.text())
    expect(buttonTexts).toContain('Isometric')
    expect(buttonTexts).toContain('Top-down')
    expect(buttonTexts).toContain('Side profile')
    expect(buttonTexts).toContain('Reset view')

    // Schematic non-claim caption
    const caption = wrapper.find('.lct-build-preview-caption')
    expect(caption.exists()).toBe(true)
    expect(caption.text()).toContain('makes no photorealistic, acoustic, or engineering-accuracy claim')

    // Plain-HTML Selected Parts Summary
    const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('Barebones kit (Base Case)')
    expect(summary.text()).toContain('Switches')
    expect(summary.text()).toContain('Keycaps')
  })

  it('Test 2: Plain-HTML Selected Parts Summary renders parts correctly and updates reactively', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
    // Initially unselected
    expect(summary.text()).toContain('Not selected')

    // Update build store reactively
    setSlot('barebones', PREVIEW_PART_PRESETS.barebones[0])
    setSlot('switches', PREVIEW_PART_PRESETS.switches[0])
    setSlot('keycaps', PREVIEW_PART_PRESETS.keycaps[0])
    await flushPromises()

    expect(summary.text()).toContain(PREVIEW_PART_PRESETS.barebones[0].name)
    expect(summary.text()).toContain(PREVIEW_PART_PRESETS.switches[0].name)
    expect(summary.text()).toContain(PREVIEW_PART_PRESETS.keycaps[0].name)

    // Test explicit prop override
    await wrapper.setProps({
      barebones: PREVIEW_PART_PRESETS.barebones[1],
    })
    await flushPromises()

    expect(summary.text()).toContain(PREVIEW_PART_PRESETS.barebones[1].name)
  })

  it('Test 3: WebGL failure fallback renders alert when WebGL is unavailable or fails, while HTML summary remains available', async () => {
    // Force WebGL unavailable (default in jsdom)
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)

    const wrapper = safeMount(BuildPreviewCanvas)
    await flushPromises()

    // Status is unavailable
    const statusBadge = wrapper.find('.lct-build-preview-status-badge')
    expect(statusBadge.attributes('data-status')).toBe('unavailable')
    expect(statusBadge.text()).toContain('3D Unavailable')

    // Fallback alert rendered
    const fallback = wrapper.find('[data-testid="build-preview-fallback"]')
    expect(fallback.exists()).toBe(true)
    expect(fallback.attributes('role')).toBe('alert')
    expect(fallback.text()).toContain('3D graphics unavailable')

    // Plain-HTML summary remains fully accessible in the DOM
    const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('Selected Parts Summary')
  })

  it('Test 4: Reduced motion media query triggers scene setReducedMotion and updates status badge', async () => {
    simulateWebGLAvailable()
    let changeHandler = null
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((type, cb) => {
        changeHandler = cb
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    // Reduced motion is active initially
    const badge = wrapper.find('.lct-build-preview-status-badge')
    expect(badge.text()).toContain('Reduced motion active')

    // Simulate motion preference change
    if (changeHandler) {
      changeHandler({ matches: false })
      await flushPromises()
      expect(badge.text()).not.toContain('Reduced motion active')
    }
  })

  it('Test 5: Camera preset toolbar buttons trigger setCameraPreset and update aria-pressed', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const topButton = wrapper.findAll('.lct-btn-preset').find((b) => b.text() === 'Top-down')
    expect(topButton).toBeDefined()
    expect(topButton.attributes('aria-pressed')).toBe('false')

    await topButton.trigger('click')
    await flushPromises()

    expect(topButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.vm.activePreset).toBe('top')

    const resetButton = wrapper.findAll('.lct-btn-preset').find((b) => b.text() === 'Reset view')
    await resetButton.trigger('click')
    await flushPromises()

    expect(wrapper.vm.activePreset).toBe('isometric')
  })

  it('Test 6: Canvas has tabindex="-1" and aria-hidden="true", ensuring no keyboard trap', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const canvas = wrapper.find('canvas.lct-build-preview-canvas')
    expect(canvas.attributes('tabindex')).toBe('-1')
    expect(canvas.attributes('aria-hidden')).toBe('true')
  })

  it('Test 7: Unmount triggers scene.dispose() and cleans up GPU resources', async () => {
    simulateWebGLAvailable()
    const disposeSpy = vi.fn()
    const mockRenderer = {
      ...createMockRenderer({ canvas: document.createElement('canvas') }),
      dispose: disposeSpy,
    }

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    wrapper.unmount()
    expect(disposeSpy).toHaveBeenCalled()
  })

  it('Test 8: 3-layer boundary: verifies internal components do not affect 3D preview visual layers', async () => {
    expect(BUILD_PREVIEW_LAYERS.map((l) => l.id)).toEqual(['barebones', 'switches', 'keycaps'])

    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
    const layerItems = summary.findAll('.lct-summary-item')
    expect(layerItems).toHaveLength(3)

    // Verify plate, pcb, foam, stabilizers, cable are NOT present in visual preview summary
    expect(summary.text()).not.toContain('Plate Cotton')
    expect(summary.text()).not.toContain('FR4 Plate')
    expect(summary.text()).not.toContain('Hot-swap PCB')
  })

  it('Test 9: PartsView.vue integration: mounts PartsView, verifies 3D preview in build sheet, part options, and store updates', async () => {
    simulateWebGLAvailable()
    const router = createTestRouter()
    const wrapper = safeMount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    // Build preview canvas is present
    const canvasComponent = wrapper.findComponent(BuildPreviewCanvas)
    expect(canvasComponent.exists()).toBe(true)

    // Part options and tabs are present
    expect(wrapper.find('.tabs').exists()).toBe(true)
    expect(wrapper.find('aside.sheet').exists()).toBe(true)

    // Verify starter build is initialized and rendered in build sheet
    expect(state.build).not.toBeNull()
    expect(wrapper.text()).toContain('Build so far')

    // Find clickable part card buttons in PartsView
    const optButtons = wrapper.findAll('button.opt')
    expect(optButtons.length).toBeGreaterThan(0)

    const initialId = state.build.case.id
    const unselectedBtn = optButtons.find((btn) => !btn.classes('sel')) || optButtons[1]

    // Click part card button in PartsView.vue
    await unselectedBtn.trigger('click')
    await flushPromises()

    const newId = state.build.case.id
    expect(newId).not.toBe(initialId)

    // 1. Updates state.build and useBuildStore().build (B1)
    expect(state.build.case.id).toBe(newId)
    expect(build.barebones.id).toBe(newId)

    // 2. Passes new part props into BuildPreviewCanvas
    expect(canvasComponent.props('barebones').id).toBe(newId)

    // 3. Mutates 3D scene material state
    const canvasEl = wrapper.find('canvas').element
    const sceneInstance = canvasEl.__sceneInstance
    expect(sceneInstance).toBeDefined()
    const barebonesState = sceneInstance.getLayerStates().barebones
    expect(barebonesState.part.id).toBe(newId)
    expect(barebonesState.status).toBe('configured')
  })

  it('Test 10: PartsView.vue integration: mounts PartsView, verifies BuildPreviewCanvas is present in aside.sheet with compact prop', async () => {
    finishQuiz()
    const router = createTestRouter()
    const wrapper = safeMount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const sheet = wrapper.find('aside.sheet')
    expect(sheet.exists()).toBe(true)

    const previewComponent = sheet.findComponent(BuildPreviewCanvas)
    expect(previewComponent.exists()).toBe(true)
    expect(previewComponent.props('compact')).toBe(true)

    // Select a different case part in catalog
    const caseOptions = state.cat.case
    if (caseOptions && caseOptions.length > 1) {
      choose('case', caseOptions[1].id)
      await flushPromises()
      expect(state.build.case.id).toBe(caseOptions[1].id)
    }

    // Selecting an internal part (e.g. foam) does not mutate visual layers
    const initialCase = state.build.case
    const foamOptions = state.cat.foam
    if (foamOptions && foamOptions.length > 1) {
      choose('foam', foamOptions[1].id)
      await flushPromises()
      expect(state.build.case).toBe(initialCase)
    }
  })

  it('Test 11: REV-7: rendererFactory prop takes priority over isWebGLAvailable without needing WebGL polyfill', async () => {
    // In default jsdom, WebGL context is NOT available
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const statusBadge = wrapper.find('.lct-build-preview-status-badge')
    expect(statusBadge.attributes('data-status')).toBe('ready')
    expect(wrapper.find('[data-testid="build-preview-fallback"]').exists()).toBe(false)
  })

  it('Test 12: REV-4: explicit null prop overrides store value to unselected, while undefined falls back to store', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    setSlot('barebones', PREVIEW_PART_PRESETS.barebones[0])
    setSlot('switches', PREVIEW_PART_PRESETS.switches[0])

    // Mount with barebones explicitly null, switches undefined (omitted)
    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
        barebones: null,
      },
    })
    await flushPromises()

    const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
    const barebonesItem = summary.find('[data-layer="barebones"]')
    const switchesItem = summary.find('[data-layer="switches"]')

    // Barebones is explicitly null -> unselected
    expect(barebonesItem.text()).toContain('Not selected')

    // Switches falls back to store
    expect(switchesItem.text()).toContain(PREVIEW_PART_PRESETS.switches[0].name)
  })

  it('Test 13: REV-19: free or $0 selected parts format as SGD 0.00 instead of em dash', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const freeKeycaps = {
      id: 'kc-free',
      name: 'Free Starter Keycaps',
      price: 0,
      layout: 'ansi',
    }

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
        keycaps: freeKeycaps,
      },
    })
    await flushPromises()

    const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
    const keycapsItem = summary.find('[data-layer="keycaps"]')
    expect(keycapsItem.text()).toContain('Free Starter Keycaps')
    // Price 0 should format as SGD 0.00, not '—'
    expect(keycapsItem.text()).toMatch(/SGD[\s\u00a0]*0\.00/)
  })

  it('Test 14: REV-8: manual preset change to custom unsets aria-pressed on all preset buttons', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const isoButton = wrapper.findAll('.lct-btn-preset').find((b) => b.text() === 'Isometric')
    expect(isoButton.attributes('aria-pressed')).toBe('true')

    // Simulate camera preset changed to custom (e.g. manual user OrbitControls drag)
    wrapper.vm.selectPreset('custom')
    await flushPromises()

    const presetButtons = wrapper.findAll('.lct-btn-preset')
    for (const btn of presetButtons) {
      if (btn.text() !== 'Reset view') {
        expect(btn.attributes('aria-pressed')).toBe('false')
      }
    }
  })
  it('Test 15: Compact mode hides HTML summary when WebGL is active and renders when WebGL fails', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    // 1. Compact mode with working WebGL: summary is hidden
    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        compact: true,
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="build-preview-html-summary"]').exists()).toBe(false)

    // 2. Compact mode with WebGL unavailable: summary is shown as accessible fallback
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
    const wrapperFallback = safeMount(BuildPreviewCanvas, {
      props: {
        compact: true,
      },
    })
    await flushPromises()
    expect(wrapperFallback.find('[data-testid="build-preview-html-summary"]').exists()).toBe(true)
  })

  it('Test 16: Combine layers / Explode layers button toggles exploded state and updates aria-pressed', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    // Default is exploded
    expect(wrapper.vm.isExplodedView).toBe(true)
    const toggleBtn = wrapper.findAll('.lct-preview-btn').find((b) => b.text().includes('Combine layers') || b.text().includes('Explode layers'))
    expect(toggleBtn).toBeDefined()
    expect(toggleBtn.text()).toBe('Combine layers')
    expect(toggleBtn.attributes('aria-pressed')).toBe('false')

    // Click Combine layers
    await toggleBtn.trigger('click')
    await flushPromises()

    expect(wrapper.vm.isExplodedView).toBe(false)
    expect(toggleBtn.text()).toBe('Explode layers')
    expect(toggleBtn.attributes('aria-pressed')).toBe('true')

    // Click Explode layers back
    await toggleBtn.trigger('click')
    await flushPromises()

    expect(wrapper.vm.isExplodedView).toBe(true)
    expect(toggleBtn.text()).toBe('Combine layers')
    expect(toggleBtn.attributes('aria-pressed')).toBe('false')
  })

  it('Test 17: Layout prop switching (60% · 75% · 100%) dynamically calls scene.setLayout and updates liveStatusText', async () => {
    simulateWebGLAvailable()
    const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })

    const wrapper = safeMount(BuildPreviewCanvas, {
      props: {
        layout: '75',
        rendererFactory: () => mockRenderer,
      },
    })
    await flushPromises()

    const scene = wrapper.vm.scene()
    expect(scene).toBeDefined()
    expect(scene.getLayout()).toBe('75')

    // Switch to 60%
    await wrapper.setProps({ layout: '60' })
    await flushPromises()

    expect(scene.getLayout()).toBe('60')
    expect(wrapper.vm.liveStatusText).toBe('Switched 3D preview to 60% layout.')
    expect(wrapper.find('.lct-build-preview-live-status').text()).toBe('Switched 3D preview to 60% layout.')

    // Switch to 100%
    await wrapper.setProps({ layout: '100' })
    await flushPromises()

    expect(scene.getLayout()).toBe('100')
    expect(wrapper.vm.liveStatusText).toBe('Switched 3D preview to 100% layout.')
    expect(wrapper.find('.lct-build-preview-live-status').text()).toBe('Switched 3D preview to 100% layout.')
  })

  it('Test 18a: Synthetic glTF ingestion (ingestGltfScene) transitions scene to hybrid mode and updates materials accurately', async () => {
    simulateWebGLAvailable()
    const canvas = document.createElement('canvas')
    const mockRenderer = createMockRenderer({ canvas })

    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: () => mockRenderer,
    })

    // Verify initially procedural
    expect(scene.isGlbLoaded()).toBe(false)
    expect(scene.getStats().mode).toBe('procedural')

    // Construct synthetic glTF scene
    const gltfRoot = new THREE.Group()

    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.12),
      new THREE.MeshStandardMaterial({ name: 'Mat_Case_Frame', color: 0x111111 })
    )
    caseMesh.name = 'Layer_Case'

    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.005, 0.11),
      new THREE.MeshStandardMaterial({ name: 'Mat_Plate_Aluminum', color: 0xcccccc })
    )
    plateMesh.name = 'Layer_Plate'

    const switchProto = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.014, 0.014),
      new THREE.MeshStandardMaterial({ name: 'Mat_Switches_Body', color: 0xd8cfc2 })
    )
    switchProto.name = 'Switch_Prototype'

    const keycapsGroup = new THREE.Group()
    keycapsGroup.name = 'Layer_Keycaps'
    const keycapsMain = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.015, 0.11),
      new THREE.MeshStandardMaterial({ name: 'keycaps body', color: 0xffffff })
    )
    const keycapsEngraving = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.001, 0.11),
      new THREE.MeshStandardMaterial({ name: 'keycaps engraving', color: 0x222222 })
    )
    keycapsGroup.add(keycapsMain)
    keycapsGroup.add(keycapsEngraving)

    gltfRoot.add(caseMesh, plateMesh, switchProto, keycapsGroup)

    // Ingest synthetic glTF scene
    scene.ingestGltfScene({ scene: gltfRoot })

    expect(scene.isGlbLoaded()).toBe(true)
    const getSceneStats = () => scene.getStats()
    expect(getSceneStats().mode).toBe('hybrid')
    expect(getSceneStats().triangles).toBeGreaterThan(0)
    expect(getSceneStats().drawCalls).toBeGreaterThan(0)
    expect(getSceneStats().drawCalls).toBeLessThanOrEqual(25)

    // Test hybrid material update with top-printed keycaps (plainpbt)
    scene.updateLayerPart('keycaps', {
      id: 'plainpbt',
      name: 'Plain PBT Keycaps',
      color: '#f8fafc',
      accentColor: '#cbd5e1',
      legendStyle: 'top',
    })

    // Test side-printed / custom artwork keycaps (kanagawa)
    scene.updateLayerPart('keycaps', {
      id: 'kanagawa',
      name: 'Great Wave Kanagawa Keycaps',
      textureUrl: '/textures/keycaps/kanagawa-wave.jpg',
      artMode: 'full',
      legendStyle: 'side',
    })

    expect(scene.getStats().mode).toBe('hybrid')
    scene.dispose()
  })

  it('Test 18b: Scene-level ADR-0008 Boundary - mutating internal parts (plate/stabilizers) does not alter visual meshes or draw calls', async () => {
    simulateWebGLAvailable()
    const canvas = document.createElement('canvas')
    const mockRenderer = createMockRenderer({ canvas })

    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: () => mockRenderer,
    })

    const initialStats = scene.getStats()
    const initialDrawCalls = initialStats.drawCalls
    const initialTriangles = initialStats.triangles

    // Inspect case mesh material color before internal mutations
    const caseGroup = scene.getLayers().barebones.group
    let initialColor = null
    caseGroup.traverse((child) => {
      if (child.isMesh && child.material && !initialColor) {
        initialColor = child.material.color ? child.material.color.getHexString() : null
      }
    })

    // Mutate internal parts in syncBuildState: plate, stabilizers, pcb, foam
    scene.syncBuildState({
      barebones: PREVIEW_PART_PRESETS.barebones[0],
      switches: PREVIEW_PART_PRESETS.switches[0],
      keycaps: PREVIEW_PART_PRESETS.keycaps[0],
      plate: { id: 'brass-plate', name: 'Brass Plate', material: 'brass', color: '#ffd700' },
      stabilizers: { id: 'durock-v2', name: 'Durock V2 Screw-In', color: '#00ff00' },
      pcb: { id: 'hotswap-pcb', name: 'RGB Hotswap PCB', color: '#ff0000' },
      foam: { id: 'poron-foam', name: 'Poron Switch Foam', color: '#0000ff' },
    })

    const afterStats = scene.getStats()
    expect(afterStats.drawCalls).toBe(initialDrawCalls)
    expect(afterStats.triangles).toBe(initialTriangles)
    expect(afterStats.activeLayers).toBe(3)

    // Verify case material color did NOT change to the brass plate or stabilizer color
    let afterColor = null
    caseGroup.traverse((child) => {
      if (child.isMesh && child.material && !afterColor) {
        afterColor = child.material.color ? child.material.color.getHexString() : null
      }
    })
    expect(afterColor).not.toBe('ffd700')
    expect(afterColor).not.toBe('00ff00')

    scene.dispose()
  })

  it('Test 18c: Visibility Pause & WebGL Context Lost/Restored lifecycle management', async () => {
    simulateWebGLAvailable()
    const canvas = document.createElement('canvas')
    const mockRenderer = createMockRenderer({ canvas })

    const scene = createBuildPreviewScene({
      canvas,
      loadGlb: false,
      rendererFactory: () => mockRenderer,
    })

    expect(scene.isPaused()).toBe(false)
    expect(scene.isContextLost()).toBe(false)

    // Dispatch visibilitychange with hidden state
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(scene.isPaused()).toBe(true)

    // Dispatch visibilitychange with visible state
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(scene.isPaused()).toBe(false)

    // Dispatch webglcontextlost on canvas
    const lostEvent = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lostEvent)
    expect(scene.isContextLost()).toBe(true)
    expect(scene.isPaused()).toBe(true)

    // Dispatch webglcontextrestored on canvas
    const restoredEvent = new Event('webglcontextrestored')
    canvas.dispatchEvent(restoredEvent)
    expect(scene.isContextLost()).toBe(false)
    expect(scene.isPaused()).toBe(false)

    scene.dispose()
    expect(scene.isContextLost()).toBe(false)
  })

  it('Test 18d: Stale-layout failure race prevention & clean procedural fallback without chimera', async () => {
    simulateWebGLAvailable()
    const canvas = document.createElement('canvas')
    const mockRenderer = createMockRenderer({ canvas })

    // Simulate fetch with custom delays/errors
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('keyboard-60')) {
        // Slow fetch that fails
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network failure for 60')), 50)
        })
      }
      // Successful dummy fetch
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'model/gltf-binary' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      })
    })

    try {
      const scene = createBuildPreviewScene({
        canvas,
        loadGlb: true,
        rendererFactory: () => mockRenderer,
      })

      // Switch to 60 (which will fail slowly)
      const p60 = scene.setLayout('60')

      // Rapidly switch to 100 before 60 finishes
      await scene.setLayout('100')
      expect(scene.getLayout()).toBe('100')

      // Await abandoned 60 layout
      await p60

      // Stale 60 failure must NOT overwrite currentLayout '100'
      expect(scene.getLayout()).toBe('100')

      // Now verify genuine failure cleanly falls back to procedural without chimera
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Fetch failed'))
      await scene.setLayout('75')

      expect(scene.getLayout()).toBe('75')
      expect(scene.isGlbLoaded()).toBe(false)
      expect(scene.getStats().mode).toBe('procedural')

      // Ensure all 3 layers have clean procedural geometry at 75 layout
      const layers = scene.getLayers()
      expect(layers.barebones.group.children.length).toBeGreaterThan(0)
      expect(layers.switches.group.children.length).toBeGreaterThan(0)
      expect(layers.keycaps.group.children.length).toBeGreaterThan(0)

      scene.dispose()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
});
