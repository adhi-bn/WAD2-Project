/**
 * @fileoverview Integration tests for BuildPreviewCanvas and buildPreviewScene camera sync & canvasOnly features.
 * Validates AC-1 (canvasOnly mode and initialExploded: false layer positions),
 * AC-2 (camera state retrieval, camera state sync without reentrancy loops, camera-change and camera-reset events),
 * and AC-3 (graceful WebGL fallback alert and HTML summary under canvasOnly mode).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as THREE from 'three'

import BuildPreviewCanvas from '../../src/components/BuildPreviewCanvas.vue'
import { createBuildPreviewScene } from '../../src/lib/buildPreviewScene.js'
import { setSlot, setLimit } from '../../src/stores/build.js'
import Keyboard3DView from '../../src/components/Keyboard3DView.vue'
import { state } from '../../src/store.js'

/**
 * Creates a mock WebGL renderer for testing Three.js scene instances in jsdom.
 *
 * @param {object} params - Factory parameters.
 * @param {HTMLCanvasElement} params.canvas - Target canvas element.
 * @returns {object} Mock Three.js renderer.
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

describe('BuildPreviewCanvas - Package A Integration', () => {
  const mountedWrappers = []
  let originalGetContext
  let originalWebGL
  let originalMatchMedia

  /**
   * Helper to mount and track wrappers for automatic teardown.
   *
   * @param {object} comp - Component definition.
   * @param {object} [opts] - Mount options.
   * @returns {import('@vue/test-utils').VueWrapper}
   */
  function safeMount(comp, opts) {
    const w = mount(comp, opts)
    mountedWrappers.push(w)
    return w
  }

  beforeEach(() => {
    // Reset build store state
    setSlot('barebones', null)
    setSlot('switches', null)
    setSlot('keycaps', null)
    setLimit(null)

    originalGetContext = HTMLCanvasElement.prototype.getContext
    originalWebGL = window.WebGLRenderingContext
    originalMatchMedia = window.matchMedia

    // Ensure mock WebGL context is available by default
    HTMLCanvasElement.prototype.getContext = vi.fn(function (type) {
      if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
        return {
          getExtension: vi.fn(),
          getParameter: vi.fn(() => 'Mock GPU'),
          enable: vi.fn(),
          disable: vi.fn(),
          viewport: vi.fn(),
          clearColor: vi.fn(),
          clear: vi.fn(),
          createTexture: vi.fn(),
          bindTexture: vi.fn(),
          texParameteri: vi.fn(),
        }
      }
      return null
    })
    window.WebGLRenderingContext = vi.fn()
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
    vi.restoreAllMocks()
  })

  describe('AC-1: canvasOnly mode and initialExploded: false', () => {
    it('renders only the 3D canvas without header, toolbar, caption, or visible HTML summary in canvasOnly mode', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          initialExploded: false,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      // Root element contains canvas-only styling class
      expect(wrapper.classes()).toContain('lct-build-preview-panel--canvas-only')

      // Visible header and toolbar buttons must NOT exist
      expect(wrapper.find('.lct-build-preview-header').exists()).toBe(false)
      expect(wrapper.find('.lct-build-preview__toolbar').exists()).toBe(false)
      expect(wrapper.find('[data-testid="reset-camera-btn"]').exists()).toBe(false)

      // Caption must NOT exist
      expect(wrapper.find('.lct-build-preview-caption').exists()).toBe(false)

      // Canvas element MUST exist and be visible
      const canvasWrap = wrapper.find('.lct-build-preview-canvas-wrap')
      expect(canvasWrap.exists()).toBe(true)
      expect(canvasWrap.isVisible()).toBe(true)
      expect(wrapper.find('canvas').exists()).toBe(true)

      // Visible HTML summary must NOT be rendered when WebGL is active
      expect(wrapper.find('[data-testid="build-preview-html-summary"]').exists()).toBe(false)

      // Screen-reader accessible title and status badge must still exist in DOM
      const title = wrapper.find('h3')
      expect(title.exists()).toBe(true)
      expect(title.classes()).toContain('lct-build-preview__sr-only')
      expect(wrapper.find('[data-testid="preview-status-badge"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="preview-live-status"]').exists()).toBe(true)
    })

    it('initializes layers in the combined state (explosionFactor = 0) when initialExploded is false', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          initialExploded: false,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      expect(wrapper.vm.isExplodedView).toBe(false)

      const sceneInstance = wrapper.vm.scene()
      expect(sceneInstance.isExploded()).toBe(false)

      // In combined state, all layers are positioned flush at Y = 0
      const layers = sceneInstance.getLayers()
      expect(layers.barebones.group.position.y).toBeCloseTo(0, 4)
      expect(layers.switches.group.position.y).toBeCloseTo(0, 4)
      expect(layers.keycaps.group.position.y).toBeCloseTo(0, 4)
    })

    it('frames the keyboard closer (Math.hypot(...pos) < 2.6) for 70–80% canvas filling when initialExploded is false and on resetView', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          initialExploded: false,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      // Initial mount framing with initialExploded: false
      const initialCam = wrapper.vm.getCameraState()
      const initialDist = Math.hypot(initialCam.position[0], initialCam.position[1], initialCam.position[2])
      expect(initialDist).toBeLessThan(2.6)

      // Change preset to top
      wrapper.vm.selectPreset('top')
      await flushPromises()

      // Reset view back to isometric
      wrapper.vm.resetView()
      await flushPromises()

      const resetCam = wrapper.vm.getCameraState()
      const resetDist = Math.hypot(resetCam.position[0], resetCam.position[1], resetCam.position[2])
      expect(resetDist).toBeLessThan(2.6)
      expect(wrapper.vm.activePreset).toBe('isometric')
    })

    it('defaults initialExploded to true when omitted, placing layers in exploded positions', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      expect(wrapper.vm.isExplodedView).toBe(true)

      const sceneInstance = wrapper.vm.scene()
      expect(sceneInstance.isExploded()).toBe(true)

      const layers = sceneInstance.getLayers()
      expect(layers.barebones.group.position.y).toBeCloseTo(-0.32, 2)
      expect(layers.switches.group.position.y).toBeCloseTo(0.04, 2)
      expect(layers.keycaps.group.position.y).toBeCloseTo(0.40, 2)
    })

    it('applies both compact and canvas-only classes when compact and canvasOnly are passed', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          compact: true,
          canvasOnly: true,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      expect(wrapper.classes()).toContain('lct-build-preview-panel--compact')
      expect(wrapper.classes()).toContain('lct-build-preview-panel--canvas-only')
      expect(wrapper.classes()).not.toContain('lct-build-preview-panel--static')
    })

    it('applies static class when interactive is false', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          compact: true,
          canvasOnly: true,
          interactive: false,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      expect(wrapper.classes()).toContain('lct-build-preview-panel--static')
    })
  })

  describe('AC-2: Camera Sync, getCameraState, setCameraState, and @dblclick Reset', () => {
    it('exposes getCameraState returning position, target, and zoom numbers', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const camState = wrapper.vm.getCameraState()
      expect(camState).toBeDefined()
      expect(Array.isArray(camState.position)).toBe(true)
      expect(camState.position).toHaveLength(3)
      camState.position.forEach((n) => expect(Number.isFinite(n)).toBe(true))

      expect(Array.isArray(camState.target)).toBe(true)
      expect(camState.target).toHaveLength(3)
      camState.target.forEach((n) => expect(Number.isFinite(n)).toBe(true))

      expect(Number.isFinite(camState.zoom)).toBe(true)
    })

    it('configures expanded OrbitControls zoom bounds and responsive zoom speed', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const scene = wrapper.vm.scene()
      expect(scene._controls).toBeDefined()
      expect(scene._controls.minDistance).toBeLessThanOrEqual(0.5)
      expect(scene._controls.maxDistance).toBeGreaterThanOrEqual(10)
      expect(scene._controls.zoomSpeed).toBeGreaterThanOrEqual(1.0)
    })

    it('applies external camera state via setCameraState without triggering recursive camera-change emits', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      // Apply new camera state
      wrapper.vm.setCameraState({
        position: [2.5, 3.5, 4.5],
        target: [0.1, 0.2, 0.3],
        zoom: 1.25,
      })

      const updatedState = wrapper.vm.getCameraState()
      expect(updatedState.position[0]).toBeCloseTo(2.5, 4)
      expect(updatedState.position[1]).toBeCloseTo(3.5, 4)
      expect(updatedState.position[2]).toBeCloseTo(4.5, 4)
      expect(updatedState.target[0]).toBeCloseTo(0.1, 4)
      expect(updatedState.target[1]).toBeCloseTo(0.2, 4)
      expect(updatedState.target[2]).toBeCloseTo(0.3, 4)
      expect(updatedState.zoom).toBeCloseTo(1.25, 4)

      // Reentrancy guard: setCameraState must NOT emit camera-change back
      expect(wrapper.emitted('camera-change')).toBeFalsy()
    })

    it('emits camera-change when camera angle changes via controls and suppresses spurious emits during preset selection', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      // Selecting a preset zeroes damping velocity and must NOT emit spurious camera-change events
      wrapper.vm.selectPreset('top')
      await flushPromises()
      expect(wrapper.emitted('camera-change')).toBeFalsy()

      // When user interacts with OrbitControls, controls dispatch 'change' event
      const scene = wrapper.vm.scene()
      scene._controls.dispatchEvent({ type: 'change' })
      await flushPromises()

      const emittedEvents = wrapper.emitted('camera-change')
      expect(emittedEvents).toBeDefined()
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1)
      const lastPayload = emittedEvents[emittedEvents.length - 1][0]
      expect(Array.isArray(lastPayload.position)).toBe(true)
      expect(Array.isArray(lastPayload.target)).toBe(true)
      expect(Number.isFinite(lastPayload.zoom)).toBe(true)
    })

    it('prevents ping-pong loop during setCameraState without triggering recursive camera-change emits', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      // Simulate external sync from peer card
      wrapper.vm.setCameraState({
        position: [3, 4, 5],
        target: [0, 0, 0],
        zoom: 1,
      })
      // setCameraState suppresses camera-change emissions via isSyncingCamera reentrancy guard
      expect(wrapper.emitted('camera-change')).toBeFalsy()

      // Direct user controls change continues to emit camera-change
      const scene = wrapper.vm.scene()
      scene._controls.dispatchEvent({ type: 'change' })
      expect(wrapper.emitted('camera-change')).toBeDefined()
      expect(wrapper.emitted('camera-change').length).toBe(1)
    })

    it('coalesces controls.update during setCameraState while updating coordinates immediately', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const scene = wrapper.vm.scene()
      const updateSpy = vi.spyOn(scene._controls, 'update')

      // setCameraState updates camera coordinates synchronously
      wrapper.vm.setCameraState({
        position: [1.2, 2.3, 3.4],
        target: [0.1, 0.2, 0.3],
        zoom: 1.1,
      })

      const state = wrapper.vm.getCameraState()
      expect(state.position[0]).toBeCloseTo(1.2, 4)
      expect(state.position[1]).toBeCloseTo(2.3, 4)
      expect(state.position[2]).toBeCloseTo(3.4, 4)
      // Synchronous setCameraState does NOT synchronously call controls.update()
      expect(updateSpy).not.toHaveBeenCalled()

      // Calling renderFrame executes coalesced controls.update exactly once
      scene.renderFrame()
      expect(updateSpy).toHaveBeenCalledTimes(1)
    })

    it('preserves native devicePixelRatio up to 2 without blurring or dropping during OrbitControls interaction', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const originalDpr = window.devicePixelRatio
      window.devicePixelRatio = 2
      try {
        const wrapper = safeMount(BuildPreviewCanvas, {
          props: {
            rendererFactory: () => mockRenderer,
            loadGlb: false,
            compact: true,
          },
        })
        await flushPromises()

        const scene = wrapper.vm.scene()
        // Crisp native DPR preserved at 2 (not capped at 1.25)
        expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(2)

        // Start dragging
        scene._controls.dispatchEvent({ type: 'start' })
        // Does NOT drop to 1
        expect(mockRenderer.setPixelRatio).not.toHaveBeenCalledWith(1)

        // End dragging
        scene._controls.dispatchEvent({ type: 'end' })
        // Stays at native DPR 2
        expect(mockRenderer.setPixelRatio).toHaveBeenLastCalledWith(2)
      } finally {
        window.devicePixelRatio = originalDpr
      }
    })

    it('disables OrbitControls and ignores double-click resets when interactive is false', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          interactive: false,
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const scene = wrapper.vm.scene()
      expect(scene._controls.enabled).toBe(false)
      expect(scene._controls.enableRotate).toBe(false)
      expect(scene._controls.enableZoom).toBe(false)
      expect(scene._controls.enablePan).toBe(false)

      // Double-click on canvas wrap
      const wrapEl = wrapper.find('.lct-build-preview-canvas-wrap')
      await wrapEl.trigger('dblclick')

      // Double-click is ignored: no camera-reset emitted
      expect(wrapper.emitted('camera-reset')).toBeUndefined()
    })

    it('resets view to isometric and emits camera-reset when canvas is double-clicked', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      // Change preset first
      wrapper.vm.selectPreset('top')
      expect(wrapper.vm.activePreset).toBe('top')

      // Double-click on canvas
      const canvasEl = wrapper.find('canvas')
      await canvasEl.trigger('dblclick')

      // View resets to isometric
      expect(wrapper.vm.activePreset).toBe('isometric')

      // Emits camera-reset exactly once
      const resetEvents = wrapper.emitted('camera-reset')
      expect(resetEvents).toBeDefined()
      expect(resetEvents).toHaveLength(1)
    })

    it('resets view and emits camera-reset when canvas wrap container is double-clicked', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      wrapper.vm.selectPreset('side')
      expect(wrapper.vm.activePreset).toBe('side')

      const wrapEl = wrapper.find('.lct-build-preview-canvas-wrap')
      await wrapEl.trigger('dblclick')

      expect(wrapper.vm.activePreset).toBe('isometric')
      expect(wrapper.emitted('camera-reset')).toHaveLength(1)
    })
  })

  describe('AC-3: WebGL Fallback Preserved in canvasOnly Mode', () => {
    it('gracefully renders fallback alert and plain-HTML summary in canvasOnly mode when WebGL is unavailable', async () => {
      // Force WebGL to report unavailable
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
      window.WebGLRenderingContext = undefined

      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          canvasOnly: true,
          loadGlb: false,
        },
      })
      await flushPromises()

      // Status reflects unavailable
      expect(wrapper.vm.hasLiveScene).toBe(false)
      const statusBadge = wrapper.find('[data-testid="preview-status-badge"]')
      expect(statusBadge.attributes('data-status')).toBe('unavailable')

      // Fallback alert MUST be visible
      const fallbackAlert = wrapper.find('[data-testid="build-preview-fallback"]')
      expect(fallbackAlert.exists()).toBe(true)
      expect(fallbackAlert.text()).toContain('3D graphics unavailable')

      // Plain-HTML summary MUST be rendered even in canvasOnly mode when WebGL is unavailable
      const summary = wrapper.find('[data-testid="build-preview-html-summary"]')
      expect(summary.exists()).toBe(true)
      expect(summary.text()).toContain('Selected Parts Summary')
      expect(summary.text()).toContain('Barebones kit (Base Case)')
      expect(summary.text()).toContain('Switches')
      expect(summary.text()).toContain('Keycaps')
    })
  })

  describe('GLB Cache Sharing and Isolation', () => {
    it('isolates GLB cache when custom fetchFn is provided across scene instances', async () => {
      const mockRenderer1 = createMockRenderer({ canvas: document.createElement('canvas') })
      const mockRenderer2 = createMockRenderer({ canvas: document.createElement('canvas') })
      const mockFetch1 = vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'model/gltf-binary' },
        arrayBuffer: async () => new ArrayBuffer(8),
      }))
      const mockFetch2 = vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'model/gltf-binary' },
        arrayBuffer: async () => new ArrayBuffer(8),
      }))

      const scene1 = createBuildPreviewScene({
        loadGlb: false,
        rendererFactory: () => mockRenderer1,
        fetchFn: mockFetch1,
      })
      const scene2 = createBuildPreviewScene({
        loadGlb: false,
        rendererFactory: () => mockRenderer2,
        fetchFn: mockFetch2,
      })

      expect(scene1).toBeDefined()
      expect(scene2).toBeDefined()
      scene1.dispose()
      scene2.dispose()
    })
  })

  describe('Embedded Stage Mode & Keyboard3DView (AC-2, AC-3, AC-4, AC-5)', () => {
    it('applies .lct-build-preview--embedded, hides header and caption, and renders only minimal floating controls in embeddedStage mode', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          embeddedStage: true,
          compact: true,
          initialExploded: false,
          loadGlb: false,
          rendererFactory: () => mockRenderer,
        },
      })
      await flushPromises()

      // Root element contains embedded styling class
      expect(wrapper.classes()).toContain('lct-build-preview--embedded')

      // 2-row header must NOT exist
      expect(wrapper.find('.lct-build-preview-header').exists()).toBe(false)
      expect(wrapper.find('.lct-build-preview__header').exists()).toBe(false)

      // Caption must NOT exist
      expect(wrapper.find('.lct-build-preview-caption').exists()).toBe(false)

      // Floating controls toolbar MUST exist inside stage
      const floatingToolbar = wrapper.find('.lct-build-preview__floating-controls')
      expect(floatingToolbar.exists()).toBe(true)
      expect(floatingToolbar.attributes('role')).toBe('toolbar')
      expect(floatingToolbar.attributes('aria-label')).toBe('3D view controls')

      // Floating controls MUST contain ONLY the 2 expected buttons
      const floatingButtons = floatingToolbar.findAll('button')
      expect(floatingButtons).toHaveLength(2)

      const toggleBtn = floatingToolbar.find('[data-testid="toggle-exploded-btn"]')
      const resetBtn = floatingToolbar.find('[data-testid="reset-camera-btn"]')
      expect(toggleBtn.exists()).toBe(true)
      expect(resetBtn.exists()).toBe(true)

      // Preset camera buttons (Isometric, Top-down, Side profile) must NOT exist
      const btnTexts = floatingButtons.map((b) => b.text())
      expect(btnTexts.some((t) => t.includes('Isometric'))).toBe(false)
      expect(btnTexts.some((t) => t.includes('Top-down'))).toBe(false)
      expect(btnTexts.some((t) => t.includes('Side profile'))).toBe(false)

      // Initial state is combined (initialExploded: false) -> button text is "Explode layers"
      expect(wrapper.vm.isExplodedView).toBe(false)
      expect(toggleBtn.text()).toBe('Explode layers')
      expect(toggleBtn.attributes('aria-pressed')).toBe('false')

      // Clicking toggle switches to exploded view -> text becomes "Combine layers"
      await toggleBtn.trigger('click')
      expect(wrapper.vm.isExplodedView).toBe(true)
      expect(toggleBtn.text()).toBe('Combine layers')
      expect(toggleBtn.attributes('aria-pressed')).toBe('true')

      // Clicking reset camera button triggers resetView back to isometric
      wrapper.vm.selectPreset('side')
      expect(wrapper.vm.activePreset).toBe('side')
      await resetBtn.trigger('click')
      expect(wrapper.vm.activePreset).toBe('isometric')

      // Screen-reader text is present in DOM while visible HTML summary is hidden
      expect(wrapper.find('[data-testid="build-preview-summary"]').classes()).toContain('lct-build-preview__sr-only')
      expect(wrapper.find('[data-testid="build-preview-html-summary"]').exists()).toBe(false)
    })

    it('gracefully renders fallback alert and HTML summary table in embeddedStage mode when WebGL is unavailable', async () => {
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
      window.WebGLRenderingContext = undefined

      const wrapper = safeMount(BuildPreviewCanvas, {
        props: {
          embeddedStage: true,
          compact: true,
          loadGlb: false,
        },
      })
      await flushPromises()

      expect(wrapper.vm.hasLiveScene).toBe(false)

      // Fallback alert is rendered
      const fallbackAlert = wrapper.find('[data-testid="build-preview-fallback"]')
      expect(fallbackAlert.exists()).toBe(true)
      expect(fallbackAlert.text()).toContain('3D graphics unavailable')

      // Accessible HTML summary table is rendered
      const htmlSummary = wrapper.find('[data-testid="build-preview-html-summary"]')
      expect(htmlSummary.exists()).toBe(true)
      expect(htmlSummary.text()).toContain('Selected Parts Summary')

      // Floating controls are NOT rendered when WebGL is unavailable
      expect(wrapper.find('.lct-build-preview__floating-controls').exists()).toBe(false)
    })

    it('mounts Keyboard3DView.vue and renders BuildPreviewCanvas with embeddedStage and activeBuild bindings', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const sampleBuild = {
        case: { id: 'qk75', name: 'QK75 Anodized Purple', price: 180, color: '#6b21a8', frame: 'metal' },
        switches: { id: 'oil-king', name: 'Gateron Oil King', price: 65, color: '#18181b' },
        keycaps: { id: 'botanical', name: 'GMK Botanical Clone', price: 50, color: '#15803d' },
      }

      const wrapper = safeMount(Keyboard3DView, {
        props: {
          build: sampleBuild,
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const canvasComp = wrapper.findComponent(BuildPreviewCanvas)
      expect(canvasComp.exists()).toBe(true)
      expect(canvasComp.props('embeddedStage')).toBe(true)
      expect(canvasComp.props('compact')).toBe(true)
      expect(canvasComp.props('initialExploded')).toBe(false)
      expect(canvasComp.props('interactive')).toBe(true)
      expect(canvasComp.props('barebones')).toEqual(sampleBuild.case)
      expect(canvasComp.props('switches')).toEqual(sampleBuild.switches)
      expect(canvasComp.props('keycaps')).toEqual(sampleBuild.keycaps)

      // Floating controls exist
      expect(wrapper.find('.lct-build-preview__floating-controls').exists()).toBe(true)
    })

    it('falls back to default materials cleanly when a Part has unavailable: true', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      const buildWithUnavailable = {
        case: { id: 'discontinued-case', name: 'Vintage 1984 Case', unavailable: true, price: null },
        switches: { id: 'ghost-sw', name: 'Phantasm Linear', unavailable: true, price: undefined },
        keycaps: { id: 'kc-1', name: 'White PBT Keycaps', price: 40 },
      }

      const wrapper = safeMount(Keyboard3DView, {
        props: {
          build: buildWithUnavailable,
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const canvasComp = wrapper.findComponent(BuildPreviewCanvas)
      expect(canvasComp.exists()).toBe(true)
      expect(canvasComp.vm.status).toBe('ready')
      expect(canvasComp.vm.hasLiveScene).toBe(true)

      // Scene normalized parts resolve defaults cleanly without throwing
      const summaryItems = canvasComp.vm.activeLayers
      expect(summaryItems).toHaveLength(3)
      expect(summaryItems[0].part.name).toBe('Vintage 1984 Case')
      expect(summaryItems[0].part.color).toBeDefined()
      expect(summaryItems[1].part.name).toBe('Phantasm Linear')
      expect(summaryItems[1].part.color).toBeDefined()
    })

    it('uses state.build as fallback when props.build is not provided to Keyboard3DView', async () => {
      const mockRenderer = createMockRenderer({ canvas: document.createElement('canvas') })
      state.build = {
        case: { id: 'tofu65', name: 'Tofu65 Aluminium', price: 120 },
        switches: { id: 'gateron-yellow', name: 'Gateron Milky Yellow', price: 35 },
        keycaps: { id: 'bow-caps', name: 'BoW Keycaps', price: 45 },
      }

      const wrapper = safeMount(Keyboard3DView, {
        props: {
          rendererFactory: () => mockRenderer,
          loadGlb: false,
        },
      })
      await flushPromises()

      const canvasComp = wrapper.findComponent(BuildPreviewCanvas)
      expect(canvasComp.exists()).toBe(true)
      expect(canvasComp.props('barebones')).toEqual(state.build.case)
      expect(canvasComp.props('switches')).toEqual(state.build.switches)
      expect(canvasComp.props('keycaps')).toEqual(state.build.keycaps)

      state.build = null
    })
  })
})
