<script setup>
/**
 * @fileoverview BuildPreviewCanvas component.
 * Renders the interactive 3D part-by-part keyboard build preview (Base Case, Switches, Keycaps)
 * driven reactively by the Build store or explicit Part props, featuring OrbitControls,
 * camera angle presets, constant 3-layer exploded view with Combine/Explode toggle,
 * an explicit schematic non-claim caption, WebGL fallback detection,
 * dynamic layout-aware spec summary, and an accessible plain-HTML selected parts summary (ADR-0008).
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  isWebGLAvailable,
  createBuildPreviewScene,
  normalizePreviewPart,
} from '../lib/buildPreviewScene.js'
import { build } from '../stores/build.js'

// Monotonic instance counter for unique title IDs across component mounts (AC-R4)
let instanceCounter = 0

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

// Unique element ID for accessible title association (AC-R4)
const titleId = `build-preview-title-${++instanceCounter}`

// Currency formatter for plain-HTML summary
const money = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'code',
})

const rootRef = ref(null)
const canvasRef = ref(null)
const status = ref('checking') // 'checking' | 'loading' | 'ready' | 'fallback' | 'unavailable' | 'error'
const errorMsg = ref('')
const activePreset = ref('isometric')
const isReducedMotion = ref(false)
const isExplodedView = ref(true)
const liveAnnouncement = ref('')
const liveStatusText = liveAnnouncement

// Whether the canvas has something to draw. `fallback` still renders procedural
// geometry, so a failed/missing `.glb` must keep the canvas visible (ADR-0003
// guarantees a procedural fallback when assets are unavailable). Only a missing
// or broken WebGL context leaves nothing to render.
const hasLiveScene = computed(() => status.value !== 'unavailable' && status.value !== 'error')

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

/**
 * Layout-aware specification summary strings (AC-R4).
 */
const layoutSpec = computed(() => {
  const clean = String(props.layout || '75').replace('%', '').trim()
  if (clean === '60') {
    return { switchCount: '61 switches', ansi: 'ANSI 60%' }
  }
  if (clean === '100') {
    return { switchCount: '104 switches', ansi: 'ANSI 100%' }
  }
  return { switchCount: '81 switches', ansi: 'ANSI 75%' }
})

const specSummary = computed(() => layoutSpec.value)

// Normalized part descriptors for plain-HTML accessibility summary with layout-aware spec strings
const normBarebones = computed(() => {
  const norm = normalizePreviewPart('barebones', activeBarebones.value)
  if (norm.isSelected && norm.specSummary) {
    norm.specSummary = norm.specSummary.replace(/ANSI\s+\d+%/i, layoutSpec.value.ansi)
  }
  return norm
})
const normSwitches = computed(() => {
  const norm = normalizePreviewPart('switches', activeSwitches.value)
  if (norm.isSelected && norm.specSummary) {
    norm.specSummary = norm.specSummary.replace(/\d+\s+switches/i, layoutSpec.value.switchCount)
  }
  return norm
})
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
  let msg =
    status.value === 'ready'
      ? '3D Ready'
      : status.value === 'checking' || status.value === 'loading'
        ? 'Loading 3D...'
        : status.value === 'fallback'
          ? '3D Fallback'
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

// Watch layout prop and dynamically update scene layout; await setLayout FIRST before announcing (AC-R4, AC-R11)
watch(
  () => props.layout,
  async (newLayout) => {
    if (!newLayout) return
    const cleanLayout = String(newLayout).replace('%', '').trim()
    if (sceneInstance) {
      await sceneInstance.setLayout?.(cleanLayout)
      liveAnnouncement.value = `Switched 3D preview to ${cleanLayout}% layout.`
    }
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

  const doc = canvasRef.value?.ownerDocument || (typeof document !== 'undefined' ? document : null)
  if (!props.rendererFactory && !isWebGLAvailable(doc)) {
    status.value = 'unavailable'
    return
  }

  const shouldLoadGlb =
    props.loadGlb !== undefined && props.loadGlb !== null
      ? props.loadGlb
      : typeof window !== 'undefined' &&
        !window.navigator?.userAgent?.includes('jsdom') &&
        Boolean(window.location?.origin && window.location.origin !== 'null')

  try {
    status.value = shouldLoadGlb ? 'loading' : 'ready'

    sceneInstance = createBuildPreviewScene({
      canvas: canvasRef.value,
      layout: props.layout,
      loadGlb: shouldLoadGlb,
      rendererFactory: props.rendererFactory,
      reducedMotion: isReducedMotion.value,
      onCameraPresetChange: (preset) => {
        activePreset.value = preset
      },
      onLoad: ({ fallback } = {}) => {
        status.value = fallback ? 'fallback' : 'ready'
        if (!liveAnnouncement.value || liveAnnouncement.value === '3D preview ready.' || liveAnnouncement.value === '3D preview using procedural fallback.') {
          liveAnnouncement.value = fallback
            ? '3D preview using procedural fallback.'
            : '3D preview ready.'
        }
      },
      onError: (err) => {
        status.value = 'error'
        errorMsg.value = err?.message || 'WebGL error'
      },
      onContextRestored: () => {
        status.value = 'ready'
        liveAnnouncement.value = '3D preview restored.'
      },
    })

    if (!sceneInstance) {
      status.value = 'error'
      return
    }

    if (canvasRef.value) {
      canvasRef.value.__sceneInstance = sceneInstance
    }

    if (!shouldLoadGlb) {
      status.value = 'ready'
    }

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
})

onUnmounted(() => {
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
  hasLiveScene,
  activePreset,
  isExplodedView,
  liveStatusText,
  liveAnnouncement,
  specSummary,
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
    :aria-labelledby="titleId"
  >
    <!-- Header with semantic screen-reader status and compact toolbar (AC-R1) -->
    <div class="lct-build-preview-header lct-build-preview__header">
      <!-- Row 1: Title and Status Badge on left, Reset View button on right -->
      <div class="lct-build-preview__title-row">
        <div class="lct-build-preview__title-group">
          <h3 :id="titleId" class="lct-build-preview-title lct-build-preview__title">3D Build Preview</h3>

          <!-- Visually-hidden status badge announcing ready state to screen-readers (AC-14, AC-R4) -->
          <span
            class="lct-build-preview__sr-only lct-build-preview-status-badge"
            role="status"
            aria-live="polite"
            :data-status="status"
            data-testid="preview-status-badge"
          >
            {{ statusAnnouncement }}
          </span>
          <span
            class="lct-build-preview__sr-only lct-build-preview-live-status"
            role="status"
            aria-live="polite"
            data-testid="preview-live-status"
          >
            {{ liveStatusText }}
          </span>
        </div>

        <button
          type="button"
          class="lct-preview-btn lct-btn-preset lct-btn-preset--reset lct-build-preview__preset-btn lct-build-preview__reset-btn"
          data-testid="reset-camera-btn"
          @click="resetView"
        >
          Reset view
        </button>
      </div>

      <!-- Row 2: Camera controls toolbar with 4 pills -->
      <div
        class="lct-build-preview-controls lct-build-preview__toolbar"
        role="toolbar"
        aria-label="3D camera controls"
      >
        <button
          type="button"
          class="lct-preview-btn lct-btn-preset lct-build-preview__preset-btn"
          :class="{ active: activePreset === 'isometric' }"
          :aria-pressed="activePreset === 'isometric'"
          @click="selectPreset('isometric')"
        >
          Isometric
        </button>
        <button
          type="button"
          class="lct-preview-btn lct-btn-preset lct-build-preview__preset-btn"
          :class="{ active: activePreset === 'top' }"
          :aria-pressed="activePreset === 'top'"
          @click="selectPreset('top')"
        >
          Top-down
        </button>
        <button
          type="button"
          class="lct-preview-btn lct-btn-preset lct-build-preview__preset-btn"
          :class="{ active: activePreset === 'side' }"
          :aria-pressed="activePreset === 'side'"
          @click="selectPreset('side')"
        >
          Side profile
        </button>
        <button
          type="button"
          class="lct-preview-btn lct-btn-preset lct-preview-btn--accent lct-build-preview__preset-btn"
          :aria-pressed="!isExplodedView"
          @click="toggleExplodedView"
        >
          {{ isExplodedView ? 'Combine layers' : 'Explode layers' }}
        </button>
      </div>
    </div>

    <!-- 3D Canvas Container -->
    <div
      v-show="hasLiveScene"
      class="lct-build-preview-canvas-wrap lct-build-preview-viewport lct-build-preview__stage"
    >
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
      v-if="!hasLiveScene"
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
    <!-- In compact mode when WebGL is active, screen-reader text provides accessible summary (AC-R14) -->
    <div
      class="lct-build-preview-summary"
      :class="{ 'lct-build-preview__sr-only': compact && hasLiveScene }"
      data-testid="build-preview-summary"
    >
      <div v-if="compact && hasLiveScene" class="lct-build-preview__sr-only">
        <span v-for="layer in activeLayers" :key="layer.id">
          {{ layer.label }}: {{ layer.part.name }}.
        </span>
      </div>

      <div
        v-if="!compact || !hasLiveScene"
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
    </div>
  </section>
</template>

<style scoped>
.lct-build-preview__sr-only {
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

.lct-build-preview-header,
.lct-build-preview__header {
  width: 100%;
}

.lct-build-preview__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.75rem;
  margin-bottom: 8px;
}

.lct-build-preview__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.lct-build-preview-title,
.lct-build-preview__title {
  font-family: "Unbounded", "Arial Black", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--ink, #12151c);
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.lct-build-preview-panel--compact .lct-build-preview-title {
  font-size: 15px;
}

.lct-build-preview-controls,
.lct-build-preview__toolbar {
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

.lct-btn-preset--reset,
.lct-build-preview__reset-btn {
  margin-left: 0;
  flex-shrink: 0;
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
</style>
