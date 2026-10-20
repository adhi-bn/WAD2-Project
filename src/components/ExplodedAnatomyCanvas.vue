<script setup>
/**
 * @fileoverview ExplodedAnatomyCanvas component.
 * Renders the 3D scroll-driven keyboard anatomy scene on an aria-hidden canvas
 * with WebGL capability detection, lifecycle pausing, and an accessible HTML fallback.
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import {
  ANATOMY_LAYERS,
  isWebGLAvailable,
  createExplodedAnatomyScene,
} from '../lib/explodedAnatomyScene.js'

const props = defineProps({
  activeLayerId: {
    type: String,
    default: '',
  },
  loadGlb: {
    type: Boolean,
    default: undefined,
  },
  rendererFactory: {
    type: Function,
    default: undefined,
  },
})

const rootRef = ref(null)
const canvasRef = ref(null)
const webglStatus = ref('checking')

let sceneInstance = null
let observer = null
let isIntersecting = true
let mediaQueryList = null
let scrollTicking = false
let rafScrollId = null

const isReducedMotion = ref(false)

const statusMessage = computed(() => {
  if (webglStatus.value === 'ready') {
    return '3D exploded keyboard anatomy loaded. Scroll or select layers to inspect bundled internals.'
  }
  return '3D graphics unavailable. An accessible 6-layer physical keyboard breakdown is displayed below.'
})

/**
 * Updates 3D scene explosion progress from DOM scroll positions.
 */
function updateScrollProgress() {
  scrollTicking = false
  rafScrollId = null
  if (isReducedMotion.value) return
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const lookEl = document.querySelector('.hs-look')
  const endEl = document.querySelector('.hs-end')
  if (!lookEl || !endEl) return

  const lookRect = lookEl.getBoundingClientRect()
  const endRect = endEl.getBoundingClientRect()

  const startY = lookRect.top + window.scrollY
  const endY = endRect.bottom + window.scrollY
  const total = endY - startY
  if (total <= 0) return

  const current = window.scrollY + window.innerHeight * 0.5 - startY
  const progress = Math.max(0, Math.min(1, current / total))
  sceneInstance?.setExplosionProgress(progress, { smooth: true })
}

/**
 * Computes scroll progress spanning from when .hs-look approaches viewport to when .hs-end exits,
 * throttled to at most once per animation frame via requestAnimationFrame.
 */
function handleScroll() {
  if (isReducedMotion.value) return
  if (scrollTicking) return
  scrollTicking = true
  if (typeof requestAnimationFrame !== 'undefined') {
    rafScrollId = requestAnimationFrame(updateScrollProgress)
  } else {
    updateScrollProgress()
  }
}

/**
 * Responds to system motion preference changes dynamically.
 *
 * @param {MediaQueryListEvent} event - Media query change event.
 */
function handleMotionChange(event) {
  isReducedMotion.value = Boolean(event.matches)
  if (sceneInstance) {
    sceneInstance.setReducedMotion?.(isReducedMotion.value)
    if (!isReducedMotion.value) {
      handleScroll()
    }
  }
}

/**
 * Responds to document tab visibility changes to pause or resume rendering.
 */
function handleVisibilityChange() {
  if (!sceneInstance || typeof document === 'undefined') return
  if (document.visibilityState === 'hidden') {
    sceneInstance.pause()
  } else if (isIntersecting) {
    sceneInstance.resume()
  }
}

onMounted(async () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)')
    isReducedMotion.value = Boolean(mediaQueryList?.matches)
    if (mediaQueryList?.addEventListener) {
      mediaQueryList.addEventListener('change', handleMotionChange)
    } else if (mediaQueryList?.addListener) {
      mediaQueryList.addListener(handleMotionChange)
    }
  }

  if (!isWebGLAvailable()) {
    webglStatus.value = 'unavailable'
    return
  }

  webglStatus.value = 'ready'
  await nextTick()

  if (canvasRef.value) {
    const shouldLoadGlb =
      props.loadGlb !== undefined
        ? props.loadGlb
        : typeof window !== 'undefined' &&
          !window.navigator?.userAgent?.includes('jsdom') &&
          Boolean(window.location?.origin && window.location.origin !== 'null')

    try {
      sceneInstance = createExplodedAnatomyScene({
        canvas: canvasRef.value,
        reducedMotion: isReducedMotion.value,
        loadGlb: shouldLoadGlb,
        rendererFactory: props.rendererFactory,
        onContextLost: () => {
          webglStatus.value = 'unavailable'
          if (sceneInstance) {
            sceneInstance.dispose()
            sceneInstance = null
          }
        },
      })

      if (!sceneInstance || !sceneInstance.hasRenderer()) {
        webglStatus.value = 'unavailable'
        return
      }
    } catch {
      webglStatus.value = 'unavailable'
      return
    }

    if (props.activeLayerId) {
      sceneInstance.setHighlightedLayer(props.activeLayerId)
      sceneInstance.setFocusLayer?.(props.activeLayerId)
    }

    // Pause rendering when anatomy scroll range exits viewport
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
        { threshold: 0 }
      )
      const targetEl =
        (typeof document !== 'undefined' &&
          (document.getElementById('home') || document.querySelector('.hs-look'))) ||
        rootRef.value ||
        canvasRef.value
      if (targetEl) {
        observer.observe(targetEl)
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll()
    }
  }
})

watch(
  () => props.activeLayerId,
  (newId) => {
    sceneInstance?.setHighlightedLayer(newId || '')
    sceneInstance?.setFocusLayer?.(newId || '')
  }
)

onUnmounted(() => {
  if (rafScrollId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(rafScrollId)
    rafScrollId = null
  }
  scrollTicking = false
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleScroll)
  }
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
</script>

<template>
  <div
    ref="rootRef"
    class="exploded-anatomy-container"
    :class="{ 'is-backdrop-active': webglStatus === 'ready' }"
    :data-webgl-status="webglStatus"
  >
    <!-- WebGL Canvas for 3D Exploded Anatomy (pointer-events: none, aria-hidden) -->
    <canvas
      v-if="webglStatus === 'ready'"
      ref="canvasRef"
      class="exploded-anatomy-canvas"
      aria-hidden="true"
      tabindex="-1"
    ></canvas>

    <!-- Semantic status message for screen readers -->
    <div class="exploded-anatomy-status sr-only" role="status" aria-live="polite">
      {{ statusMessage }}
    </div>

    <!-- Plain-HTML accessible anatomy list always present in DOM -->
    <div
      class="exploded-anatomy-fallback"
      :class="{ 'is-fallback-visible': webglStatus !== 'ready' }"
    >
      <div class="fallback-card">
        <div class="fallback-header">
          <span class="fallback-eyebrow">Keyboard Architecture</span>
          <h3 class="fallback-title">6-Layer Physical Stack</h3>
          <p class="fallback-subtitle">
            Physical layers from top to bottom, detailing how keycaps, switches, and the barebones
            kit gasket stack integrate together.
          </p>
        </div>

        <ol class="fallback-layers-list">
          <li
            v-for="layer in ANATOMY_LAYERS"
            :key="layer.id"
            class="fallback-layer-row"
            :class="{
              'is-barebones-internals': layer.isBarebonesInternals,
              'is-active': activeLayerId === layer.id,
            }"
          >
            <div class="fallback-layer-header">
              <span class="fallback-layer-name">{{ layer.label }}</span>
              <span v-if="layer.isBarebonesInternals" class="fallback-badge barebones">
                Barebones kit bundled
              </span>
              <span v-else class="fallback-badge core-part">
                {{ layer.partCategory }}
              </span>
            </div>
            <p class="fallback-layer-desc">{{ layer.description }}</p>
          </li>
        </ol>

        <p class="fallback-disclaimer">
          Illustrative 3D structural guide — not a photorealistic, acoustic, or engineering-CAD claim.
        </p>
      </div>
    </div>
  </div>
</template>
