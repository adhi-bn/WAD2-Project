<script setup>
/**
 * @fileoverview BuildPreviewCanvas component.
 * Renders the interactive 3D part-by-part keyboard build preview (Base Case, Switches, Keycaps)
 * driven reactively by the Build store or explicit Part props, featuring OrbitControls,
 * camera angle presets, constant 3-layer exploded view with Combine/Explode toggle,
 * an explicit schematic non-claim caption, WebGL fallback detection,
 * and an accessible plain-HTML selected parts summary (ADR-0008).
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  isWebGLAvailable,
  createBuildPreviewScene,
  normalizePreviewPart,
} from '../lib/buildPreviewScene.js'
import { build } from '../stores/build.js'

const props = defineProps({
  barebones: {
    type: Object,
    default: undefined,
  },
  switches: {
    type: Object,
    default: undefined,
  },
  keycaps: {
    type: Object,
    default: undefined,
  },
  loadGlb: {
    type: Boolean,
    default: undefined,
  },
  rendererFactory: {
    type: Function,
    default: null,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  layout: {
    type: String,
    default: '75',
  },
})

// Currency formatter for plain-HTML summary
const money = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'code',
})

const rootRef = ref(null)
const canvasRef = ref(null)
const status = ref('checking') // 'checking' | 'ready' | 'unavailable' | 'error'
const isFallback = ref(false)
const errorMsg = ref('')
const activePreset = ref('isometric')
const isReducedMotion = ref(false)
const isExplodedView = ref(true)
const liveStatusText = ref('')

let sceneInstance = null
let observer = null
let mediaQueryList = null
let isIntersecting = true

// Prop vs. Store fallback: if prop is defined, prioritize prop; otherwise fallback to build store (REV-4).
const activeBarebones = computed(() =>
  props.barebones !== undefined ? props.barebones : build.barebones
)
const activeSwitches = computed(() =>
  props.switches !== undefined ? props.switches : build.switches
)
const activeKeycaps = computed(() =>
  props.keycaps !== undefined ? props.keycaps : build.keycaps
)

// Normalized part descriptors for plain-HTML accessibility summary
const normBarebones = computed(() => normalizePreviewPart('barebones', activeBarebones.value))
const normSwitches = computed(() => normalizePreviewPart('switches', activeSwitches.value))
const normKeycaps = computed(() => normalizePreviewPart('keycaps', activeKeycaps.value))

const activeLayers = computed(() => [
  { id: 'barebones', label: 'Barebones kit (Base Case)', part: normBarebones.value },
  { id: 'switches', label: 'Switches', part: normSwitches.value },
  { id: 'keycaps', label: 'Keycaps', part: normKeycaps.value },
])

/**
 * Screen-reader status announcement string for semantic status reporting (AC-14).
 */
const statusAnnouncement = computed(() => {
  if (liveStatusText.value) {
    return liveStatusText.value
  }
  let msg =
    status.value === 'ready'
      ? '3D Ready'
      : status.value === 'checking'
        ? 'Loading 3D...'
        : status.value === 'unavailable'
          ? '3D Unavailable'
          : '3D Render error'
  if (isReducedMotion.value) {
    msg += ' · Reduced motion active'
  }
  return msg
})

// Watch active trio reactively and sync 3D scene layers
watch(
  [activeBarebones, activeSwitches, activeKeycaps],
  ([newBb, newSw, newKc]) => {
    sceneInstance?.syncBuildState({
      barebones: newBb,
      switches: newSw,
      keycaps: newKc,
    })
  },
  { deep: true },
)

// Watch layout prop and dynamically update scene layout
watch(
  () => props.layout,
  async (newLayout) => {
    if (!newLayout) return
    const cleanLayout = String(newLayout).replace('%', '').trim()
    liveStatusText.value = `Switched 3D preview to ${cleanLayout}% layout.`
    await sceneInstance?.setLayout?.(cleanLayout)
  },
)

/**
 * Selects an active camera angle preset view ('isometric', 'top', 'side').
 *
 * @param {'isometric'|'top'|'side'} preset - Target camera preset.
 */
function selectPreset(preset) {
  activePreset.value = preset
  sceneInstance?.setCameraPreset(preset)
}

/**
 * Resets camera viewpoint back to default isometric angle.
 */
function resetView() {
  activePreset.value = 'isometric'
  sceneInstance?.resetCamera()
}

/**
 * Toggles between exploded 3-layer view and combined assembled view.
 */
function toggleExplodedView() {
  isExplodedView.value = !isExplodedView.value
  sceneInstance?.setExploded(isExplodedView.value)
}

/**
 * Handles document visibility change events to pause/resume rendering when off-screen.
 */
function handleVisibilityChange() {
  if (!sceneInstance || typeof document === 'undefined') return
  if (document.visibilityState === 'hidden') {
    sceneInstance.pause()
  } else if (isIntersecting) {
    sceneInstance.resume()
  }
}

/**
 * Handles prefers-reduced-motion media query changes.
 *
 * @param {MediaQueryListEvent|{ matches: boolean }} event - Media query change event.
 */
function handleMotionChange(event) {
  isReducedMotion.value = Boolean(event?.matches)
  sceneInstance?.setReducedMotion(isReducedMotion.value)
}

/**
 * Formats a part's price into currency string, rendering SGD 0.00 when price is 0 (REV-19).
 *
 * @param {object} part - Normalized part descriptor.
 * @returns {string} Formatted price or em dash ('—') if unselected or invalid.
 */
function formatPartPrice(part) {
  if (
    part?.isSelected &&
    part.price !== null &&
    part.price !== undefined &&
    Number.isFinite(Number(part.price))
  ) {
    return money.format(Number(part.price))
  }
  return '—'
}

onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)')
    isReducedMotion.value = Boolean(mediaQueryList?.matches)
    if (mediaQueryList?.addEventListener) {
      mediaQueryList.addEventListener('change', handleMotionChange)
    } else if (mediaQueryList?.addListener) {
      mediaQueryList.addListener(handleMotionChange)
    }
  }

  if (!props.rendererFactory && !isWebGLAvailable(canvasRef.value)) {
    status.value = 'unavailable'
    isFallback.value = true
    return
  }

  const shouldLoadGlb =
    props.loadGlb !== undefined && props.loadGlb !== null
      ? props.loadGlb
      : typeof window !== 'undefined' &&
        !window.navigator?.userAgent?.includes('jsdom') &&
        Boolean(window.location?.origin && window.location.origin !== 'null')

  try {
    sceneInstance = createBuildPreviewScene({
      canvas: canvasRef.value,
      layout: props.layout,
      loadGlb: shouldLoadGlb,
      rendererFactory: props.rendererFactory,
      reducedMotion: isReducedMotion.value,
      onCameraPresetChange: (preset) => {
        activePreset.value = preset
      },
      onLoad: () => {
        status.value = 'ready'
      },
      onError: (err) => {
        status.value = 'error'
        isFallback.value = true
        errorMsg.value = err?.message || 'WebGL error'
      },
    })

    if (!sceneInstance) {
      status.value = 'unavailable'
      isFallback.value = true
      return
    }

    if (canvasRef.value) {
      canvasRef.value.__sceneInstance = sceneInstance
    }

    status.value = 'ready'
    sceneInstance.syncBuildState(
      {
        barebones: activeBarebones.value,
        switches: activeSwitches.value,
        keycaps: activeKeycaps.value,
      },
      { animate: false },
    )
  } catch (err) {
    status.value = 'error'
    isFallback.value = true
    errorMsg.value = err?.message || 'WebGL error'
    return
  }

  if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isIntersecting = entry.isIntersecting
          if (entry.isIntersecting) {
            sceneInstance?.resume()
          } else {
            sceneInstance?.pause()
          }
        }
      },
      { threshold: 0, rootMargin: '300px 0px' },
    )
    const target = rootRef.value || canvasRef.value
    if (target) observer.observe(target)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  if (mediaQueryList) {
    if (mediaQueryList.removeEventListener) {
      mediaQueryList.removeEventListener('change', handleMotionChange)
    } else if (mediaQueryList.removeListener) {
      mediaQueryList.removeListener(handleMotionChange)
    }
    mediaQueryList = null
  }
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (sceneInstance) {
    sceneInstance.dispose()
    sceneInstance = null
  }
})

defineExpose({
  scene: () => sceneInstance,
  status,
  isFallback,
  activePreset,
  isExplodedView,
  liveStatusText,
  selectPreset,
  resetView,
  toggleExplodedView,
})
</script>

<template>
  <section
    ref="rootRef"
    class="lct-build-preview-panel"
    :class="{ 'lct-build-preview-panel--compact': compact }"
    aria-labelledby="build-preview-title"
  >
    <!-- Header with semantic screen-reader status and compact toolbar -->
    <div class="lct-build-preview-header">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 id="build-preview-title" class="lct-build-preview-title">3D Build Preview</h2>

        <!-- Visually-hidden status badge announcing ready state to screen-readers (AC-14) -->
        <span
          class="visually-hidden lct-build-preview-status-badge"
          role="status"
          aria-live="polite"
          :data-status="status"
        >
          {{ statusAnnouncement }}
        </span>
        <span
          class="visually-hidden lct-build-preview-live-status"
          role="status"
          aria-live="polite"
        >
          {{ liveStatusText }}
        </span>

        <!-- Sleek micro-pill toolbar buttons -->
        <div class="lct-build-preview-controls" role="toolbar" aria-label="3D camera controls">
          <button
            type="button"
            class="lct-preview-btn lct-btn-preset"
            :class="{ active: activePreset === 'isometric' }"
            :aria-pressed="activePreset === 'isometric'"
            @click="selectPreset('isometric')"
          >
            Isometric
          </button>
          <button
            type="button"
            class="lct-preview-btn lct-btn-preset"
            :class="{ active: activePreset === 'top' }"
            :aria-pressed="activePreset === 'top'"
            @click="selectPreset('top')"
          >
            Top-down
          </button>
          <button
            type="button"
            class="lct-preview-btn lct-btn-preset"
            :class="{ active: activePreset === 'side' }"
            :aria-pressed="activePreset === 'side'"
            @click="selectPreset('side')"
          >
            Side profile
          </button>
          <button
            type="button"
            class="lct-preview-btn lct-btn-preset lct-preview-btn--accent"
            :aria-pressed="!isExplodedView"
            @click="toggleExplodedView"
          >
            {{ isExplodedView ? 'Combine layers' : 'Explode layers' }}
          </button>
          <button
            type="button"
            class="lct-preview-btn lct-btn-preset lct-btn-preset--reset"
            @click="resetView"
          >
            Reset view
          </button>
        </div>
      </div>
    </div>

    <!-- 3D Canvas Container -->
    <div class="lct-build-preview-canvas-wrap lct-build-preview-viewport">
      <canvas
        ref="canvasRef"
        class="lct-build-preview-canvas"
        tabindex="-1"
        aria-hidden="true"
      ></canvas>
    </div>

    <!-- Schematic non-claim caption -->
    <p class="lct-build-preview-caption">
      Schematic 3D Build preview — visual aid for Keycaps, Switches, and Base (Case) only; makes no photorealistic, acoustic, or engineering-accuracy claim.
    </p>

    <!-- WebGL Fallback Alert -->
    <div
      v-if="isFallback || status === 'unavailable' || status === 'error'"
      class="lct-build-preview-fallback"
      role="alert"
      data-testid="build-preview-fallback"
    >
      <p class="mb-0">
        <strong>3D graphics unavailable.</strong>
        {{ errorMsg || 'WebGL could not be initialized. An accessible summary of your selected parts is provided below.' }}
      </p>
    </div>

    <!-- Plain-HTML Selected Parts Summary (accessible even with no WebGL) -->
    <!-- In compact mode, only shown if WebGL failed (isFallback), because 'Build so far' already lists parts -->
    <div
      v-if="!compact || isFallback"
      class="lct-build-preview-summary"
      data-testid="build-preview-html-summary"
    >
      <h3 class="lct-summary-title">Selected Parts Summary</h3>
      <ul class="lct-summary-list">
        <li
          v-for="layer in activeLayers"
          :key="layer.id"
          class="lct-summary-item"
          :data-layer="layer.id"
        >
          <div class="lct-summary-item-left">
            <span
              class="lct-color-swatch"
              :style="{ backgroundColor: layer.part.color }"
              :title="'Color: ' + layer.part.color"
              aria-hidden="true"
            ></span>
            <div class="lct-summary-details">
              <span class="lct-summary-layer-label">{{ layer.label }}</span>
              <span class="lct-summary-part-name">{{ layer.part.name }}</span>
              <span v-if="layer.part.specSummary" class="lct-summary-part-spec">
                {{ layer.part.specSummary }}
              </span>
            </div>
          </div>
          <span class="lct-summary-part-price">
            {{ formatPartPrice(layer.part) }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style>
.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.lct-build-preview-panel {
  background: var(--surface, #ffffff);
  border: 1px solid var(--line, #d6dae3);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(18, 21, 28, 0.06), 0 10px 30px rgba(24, 32, 80, 0.10);
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.lct-build-preview-panel--compact {
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0 0 14px 0;
  margin-bottom: 14px;
  border-bottom: 1px dashed var(--line, #d6dae3);
  gap: 10px;
}

.lct-build-preview-header {
  width: 100%;
}

.lct-build-preview-title {
  font-family: "Unbounded", "Arial Black", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--ink, #12151c);
  letter-spacing: -0.01em;
}

.lct-build-preview-panel--compact .lct-build-preview-title {
  font-size: 15px;
}

.lct-build-preview-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.lct-preview-btn {
  appearance: none;
  background: var(--surface-2, #f4f5f9);
  color: var(--ink, #12151c);
  border: 1px solid var(--line, #d6dae3);
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11.5px;
  line-height: 1.2;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.lct-preview-btn:hover {
  border-color: var(--ink, #12151c);
}

.lct-preview-btn:focus-visible {
  outline: 2px solid var(--accent, #3346ff);
  outline-offset: 2px;
}

.lct-preview-btn.active,
.lct-preview-btn[aria-pressed="true"] {
  background: var(--accent, #3346ff);
  border-color: var(--accent, #3346ff);
  color: #ffffff;
}

.lct-preview-btn--accent {
  background: var(--accent-soft, #e2e5ff);
  color: var(--accent, #3346ff);
  border-color: color-mix(in srgb, var(--accent, #3346ff) 30%, transparent);
}

.lct-preview-btn--accent:hover {
  background: var(--accent, #3346ff);
  color: #ffffff;
  border-color: var(--accent, #3346ff);
}

.lct-preview-btn--accent[aria-pressed="true"] {
  background: var(--accent, #3346ff);
  border-color: var(--accent, #3346ff);
  color: #ffffff;
}

.lct-btn-preset--reset {
  margin-left: auto;
}

.lct-build-preview-canvas-wrap {
  position: relative;
  width: 100%;
  height: 360px;
  background: var(--surface-2, #f4f5f9);
  border: 1px solid var(--line, #d6dae3);
  border-radius: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.lct-build-preview-panel--compact .lct-build-preview-canvas-wrap,
.lct-build-preview-panel--compact .lct-build-preview-viewport {
  border: none;
  height: 280px;
}

.lct-build-preview-canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

.lct-build-preview-caption {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--muted, #596072);
  font-style: italic;
  margin: 0;
}

.lct-build-preview-fallback {
  background: var(--no-soft, #fce6dd);
  border: 1px solid color-mix(in srgb, var(--no, #d2461a) 30%, transparent);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 15px;
  color: var(--ink, #12151c);
}

.lct-build-preview-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}

.lct-summary-title {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted, #596072);
  margin: 0;
  font-family: var(--mono, "JetBrains Mono", monospace);
}

.lct-summary-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lct-summary-item {
  background: var(--surface-2, #f4f5f9);
  border: 1px solid var(--line, #d6dae3);
  border-radius: 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lct-summary-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.lct-color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 6px;
  border: 1px solid var(--line, #d6dae3);
  flex-shrink: 0;
}

.lct-summary-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.lct-summary-layer-label {
  font-family: var(--mono, "JetBrains Mono", monospace);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted, #596072);
  line-height: 1.2;
}

.lct-summary-part-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink, #12151c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.lct-summary-part-spec {
  font-size: 11.5px;
  color: var(--muted, #596072);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.lct-summary-part-price {
  font-family: var(--mono, "JetBrains Mono", monospace);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink, #12151c);
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
  text-align: right;
}

@media (max-width: 760px) {
  .lct-build-preview-canvas-wrap {
    height: 250px;
  }
}

@media (min-width: 1080px) {
  #parts .layout {
    grid-template-columns: minmax(0, 1fr) 390px;
  }
}
</style>
