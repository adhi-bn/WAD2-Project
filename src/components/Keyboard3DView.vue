<script setup>
/**
 * @fileoverview Keyboard3DView component.
 * Embeds the 3D part-by-part interactive build preview into the /build summary panel (ADR-0008).
 * Renders BuildPreviewCanvas with embeddedStage=true, compact=true, and initialExploded=false
 * while binding to the active build state or explicit build prop (AC-2, AC-3, AC-4, AC-5).
 */

import { computed } from 'vue'
import BuildPreviewCanvas from './BuildPreviewCanvas.vue'
import { state, layout } from '../store.js'

const props = defineProps({
  /**
   * Optional custom build object to preview. Falls back to state.build when null or omitted.
   */
  build: {
    type: Object,
    default: null,
  },
  /**
   * Optional test injection renderer factory for mock WebGL scenes in test environments.
   */
  rendererFactory: {
    type: Function,
    default: null,
  },
  /**
   * Optional flag to override GLB loading.
   */
  loadGlb: {
    type: Boolean,
    default: undefined,
  },
  /**
   * Optional custom fetch function for network/asset tests.
   */
  fetchFn: {
    type: Function,
    default: null,
  },
})

// Resolve active build from prop or store fallback
const activeBuild = computed(() => props.build ?? state.build)

// Resolve active layout form-factor string ('60', '75', '100')
const activeLayout = computed(() => String(activeBuild.value?.layout || layout() || '75'))
</script>

<template>
  <BuildPreviewCanvas
    :barebones="activeBuild?.case ?? activeBuild?.barebones ?? null"
    :switches="activeBuild?.switches ?? null"
    :keycaps="activeBuild?.keycaps ?? null"
    :layout="activeLayout"
    :compact="true"
    :embedded-stage="true"
    :initial-exploded="false"
    :interactive="true"
    :renderer-factory="rendererFactory"
    :load-glb="loadGlb"
    :fetch-fn="fetchFn"
  />
</template>
