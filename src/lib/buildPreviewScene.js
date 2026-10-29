/**
 * @fileoverview 3D Build Preview Scene Engine for Lechaton Typers Builder.
 * Renders an interactive 3-layer part-by-part assembly preview (Base Case, Switches, Keycaps)
 * driven by reactive Build state per ADR-0008, featuring OrbitControls, smooth vertical
 * drop/snap assembly animations, and dynamic PBR material updating without per-SKU GLB downloads.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  SWITCH_LAYOUT_POSITIONS,
  SWITCH_LAYOUT_POSITIONS_60,
  SWITCH_LAYOUT_POSITIONS_100,
  SWITCH_LAYOUTS,
  KEYBOARD_DIMENSIONS,
} from './keyboardSwitchLayout.js'
import {
  createSwitchMatrixInstances,
  buildProceduralFallbackLayers,
} from './explodedAnatomyScene.js'

/**
 * Layout form-factor canonical scales to frame each keyboard snugly without edge clipping.
 *
 * @type {Readonly<{ '60': number, '75': number, '100': number }>}
 */
export const LAYOUT_SCALES = Object.freeze({
  '60': 6.35,
  '75': 5.75,
  '100': 4.65,
})

/**
 * GLTF asset model URLs indexed by layout form-factor code.
 *
 * @type {Readonly<{ '60': string, '75': string, '100': string }>}
 */
export const LAYOUT_MODELS = Object.freeze({
  '60': '/models/keyboard-60.glb',
  '75': '/models/exploded-keyboard.glb',
  '100': '/models/keyboard-100.glb',
})

/**
 * Top-printed keycap legend texture atlas paths indexed by layout form-factor code.
 *
 * @type {Readonly<{ '60': string, '75': string, '100': string }>}
 */
export const TOP_LEGEND_TEXTURE_PATHS = Object.freeze({
  '60': '/textures/keycaps/top-legends-60.png',
  '75': '/textures/keycaps/top-legends-75.png',
  '100': '/textures/keycaps/top-legends-100.png',
})

/**
 * 4-Zone Keycap Colorways for solid PBR keycap sets (alphas, modifiers, accents, spacebar).
 *
 * @type {Readonly<Record<string, { alphas: string, modifiers: string, accents: string, spacebar: string }>>}
 */
export const KEYCAP_COLORWAYS = Object.freeze({
  plainpbt: Object.freeze({
    alphas: '#f8fafc',
    modifiers: '#cbd5e1',
    accents: '#94a3b8',
    spacebar: '#cbd5e1',
  }),
  matte: Object.freeze({
    alphas: '#334155',
    modifiers: '#1e293b',
    accents: '#0ea5e9',
    spacebar: '#0f172a',
  }),
  stone: Object.freeze({
    alphas: '#e7e5e4',
    modifiers: '#a8a29e',
    accents: '#d97706',
    spacebar: '#78716c',
  }),
  dshot: Object.freeze({
    alphas: '#1e293b',
    modifiers: '#0f172a',
    accents: '#06b6d4',
    spacebar: '#1e293b',
  }),
  blank: Object.freeze({
    alphas: '#f1f5f9',
    modifiers: '#e2e8f0',
    accents: '#cbd5e1',
    spacebar: '#e2e8f0',
  }),
  theme: Object.freeze({
    alphas: '#fdf4ff',
    modifiers: '#4f46e5',
    accents: '#f59e0b',
    spacebar: '#6366f1',
  }),
  kanagawa: Object.freeze({
    alphas: '#fef3c7',
    modifiers: '#1e3a8a',
    accents: '#b91c1c',
    spacebar: '#1d4ed8',
  }),
})

/**
 * Resolves 4-Zone Keycap Colorway for a given part if applicable.
 *
 * @param {object} part - Part descriptor.
 * @returns {{ alphas: string, modifiers: string, accents: string, spacebar: string }|null}
 */
export function getKeycapColorway(part) {
  if (!part) return null
  const idLower = (part.id || '').toLowerCase()
  const nameLower = (part.name || '').toLowerCase()

  for (const key of Object.keys(KEYCAP_COLORWAYS)) {
    if (idLower === key || idLower.includes(key) || nameLower.includes(key)) {
      return KEYCAP_COLORWAYS[key]
    }
  }
  return null
}

/**
 * Safely checks WebGL/WebGL2 context availability in the current environment.
 * Accepts a Document, HTMLCanvasElement, or defaults to global document.
 *
 * @param {Document|HTMLCanvasElement|null} [target] - Document or canvas to test.
 * @returns {boolean} True if WebGL or WebGL2 context can be acquired.
 */
export function isWebGLAvailable(target = (typeof document !== 'undefined' ? document : null)) {
  if (!target) return false
  if (target._mockContext) return true
  try {
    let canvas
    if (typeof target.getContext === 'function') {
      canvas = target
    } else if (typeof target.createElement === 'function') {
      canvas = target.createElement('canvas')
    } else {
      return false
    }
    const win = target.defaultView || (typeof window !== 'undefined' ? window : null)
    if (win && !win.WebGLRenderingContext && !target.getContext) return false
    const gl =
      (canvas._mockContext ? canvas._mockContext : null) ||
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl)
  } catch {
    return false
  }
}

/**
 * 3 active visual layers for the interactive Build preview per ADR-0008.
 * Internal layers (Plate, PCB, Foam, Stabilizers) are deliberately decoupled from the 3D scene
 * to avoid mesh-clipping and reduce triangle overhead on mobile and desktop viewports.
 */
const rawLayers = [
  Object.freeze({
    id: 'barebones',
    slot: 'barebones',
    name: 'Base (Case)',
    label: 'Barebones kit (Base Case)',
    nodeName: 'Layer_Case',
    baseY: 0,
    explodedY: -0.32,
    description: 'Enclosure base chassis, rotary encoder knob, and weighted bottom case.',
  }),
  Object.freeze({
    id: 'switches',
    slot: 'switches',
    name: 'Switches',
    label: 'Switches',
    nodeName: 'Layer_Switches',
    baseY: 0,
    explodedY: 0.04,
    description: '81-key mechanical switch matrix seated into the hot-swap sockets.',
  }),
  Object.freeze({
    id: 'keycaps',
    slot: 'keycaps',
    name: 'Keycaps',
    label: 'Keycaps',
    nodeName: 'Layer_Keycaps',
    baseY: 0,
    explodedY: 0.40,
    description: 'Sculpted keycap set mounted directly onto the mechanical switch stems.',
  }),
]

export const BUILD_PREVIEW_LAYERS = Object.freeze(rawLayers)

/**
 * Canonical layer IDs for fast validation.
 *
 * @type {ReadonlyArray<string>}
 */
export const BUILD_PREVIEW_LAYER_IDS = Object.freeze(['barebones', 'switches', 'keycaps'])

/**
 * Determines whether a given hex color token has a light perceived luminance.
 *
 * @param {string} hexColor - Hex color string.
 * @returns {boolean} True if color is light, false otherwise.
 */
export function isColorLight(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') return false
  const hex = hexColor.replace('#', '')
  const num = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16)
  if (Number.isNaN(num)) return false
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return brightness > 0.5
}

/**
 * Infers aesthetic PBR color tokens from Part names or attributes.
 *
 * @param {string} slot - Normalized slot identifier ('barebones', 'switches', 'keycaps').
 * @param {object} part - Raw Part object.
 * @returns {string} Hex color token.
 */
function derivePartColor(slot, part) {
  if (part.color) return part.color
  if (part.colour) return part.colour

  const name = (part.name || '').toLowerCase()
  const id = (part.id || '').toLowerCase()

  if (slot === 'barebones') {
    if (name.includes('cream')) return '#fef3c7'
    if (name.includes('navy')) return '#1e293b'
    if (name.includes('polycarbonate') || id === 'pc') return '#cbd5e1'
    if (name.includes('acrylic') || id === 'sandwich') return '#f1f5f9'
    if (name.includes('fr4') || id === 'fr4') return '#1e293b'
    if (part.frame === 'metal' || name.includes('alu')) return '#1e293b'
    if (name.includes('obsidian') || name.includes('black')) return '#0f172a'
    return '#12151c'
  }

  if (slot === 'switches') {
    if (name.includes('milky')) return '#fef9c3'
    if (name.includes('oil king') || name.includes('black')) return '#18181b'
    if (name.includes('tangerine')) return '#ea580c'
    if (name.includes('sakura')) return '#f472b6'
    if (name.includes('panda')) return '#f8fafc'
    if (name.includes('blue')) return '#0284c7'
    if (name.includes('brown')) return '#92400e'
    if (name.includes('red')) return '#ef4444'
    if (name.includes('yellow')) return '#fef08a'
    if (name.includes('jade')) return '#059669'
    return '#d8cfc2'
  }

  if (slot === 'keycaps') {
    if (name.includes('botanical')) return '#15803d'
    if (name.includes('laser')) return '#4c1d95'
    if (name.includes('retro') || name.includes('beige')) return '#e2d9cc'
    if (name.includes('french') || name.includes('azerty')) return '#1e3a8a'
    if (name.includes('stone')) return '#78716c'
    if (name.includes('plain') || name.includes('white')) return '#f8fafc'
    if (name.includes('kanagawa') || name.includes('wave') || id === 'kanagawa') return '#f8fafc'
    if (name.includes('theme') || name.includes('mural') || name.includes('anime') || id === 'theme') return '#f8fafc'
    return '#2b303c'
  }

  return '#2b303c'
}

/**
 * Derives mechanical switch stem color for switches layer.
 *
 * @param {object} part - Raw Part object.
 * @returns {string} Hex color token.
 */
function deriveStemColor(part) {
  if (part.stemColor) return part.stemColor
  const name = (part.name || '').toLowerCase()
  if (name.includes('yellow')) return '#eab308'
  if (name.includes('red')) return '#ef4444'
  if (name.includes('blue')) return '#0284c7'
  if (name.includes('brown')) return '#92400e'
  if (name.includes('tangerine') || name.includes('orange')) return '#f97316'
  if (name.includes('panda')) return '#f59e0b'
  if (name.includes('sakura') || name.includes('pink')) return '#ec4899'
  if (name.includes('jade') || name.includes('green')) return '#10b981'
  if (name.includes('silent')) return '#fb7185'
  return '#d9468f'
}

/**
 * Normalizes any incoming Part shape (domain test stubs, catalog items, or rich presets)
 * into a standard visual & semantic preview descriptor.
 *
 * @param {string} slot - Target slot name ('barebones', 'case', 'switches', 'keycaps').
 * @param {object|null|undefined} part - Raw Part descriptor or null.
 * @returns {{
 *   slot: string,
 *   id: string|null,
 *   name: string,
 *   isSelected: boolean,
 *   color: string,
 *   accentColor: string,
 *   stemColor: string|null,
 *   metalness: number,
 *   roughness: number,
 *   opacity: number,
 *   layout: string|null,
 *   pin: string|null,
 *   socket: string|null,
 *   price: number,
 *   finishLabel: string,
 *   specSummary: string
 * }} Normalized Part descriptor.
 */
export function normalizePreviewPart(slot, part) {
  const normSlot = slot === 'case' ? 'barebones' : slot

  // Fallback defaults when slot is unselected / empty
  if (!part || typeof part !== 'object' || Object.keys(part).length === 0) {
    const isBarebones = normSlot === 'barebones'
    const isSwitches = normSlot === 'switches'
    return {
      slot: normSlot,
      id: null,
      name: 'Not selected',
      isSelected: false,
      color: isBarebones ? '#12151c' : isSwitches ? '#d8cfc2' : '#2b303c',
      accentColor: isSwitches ? '#d9468f' : '#f0b429',
      stemColor: isSwitches ? '#d9468f' : null,
      metalness: isBarebones ? 0.25 : 0.1,
      roughness: isBarebones ? 0.75 : isSwitches ? 0.6 : 0.5,
      opacity: 0.45,
      layout: null,
      pin: null,
      socket: null,
      price: 0,
      finishLabel: 'None',
      specSummary: 'No part selected',
      artworkUrl: null,
      textureUrl: null,
      artMode: null,
      legendColor: null,
      legendEmissive: null,
      legendEmissiveIntensity: null,
      legendStyle: 'none',
    }
  }

  const isBarebones = normSlot === 'barebones'
  const isSwitches = normSlot === 'switches'
  const isKeycaps = normSlot === 'keycaps'

  // Extract ID and Name
  const id = part.id ? String(part.id) : `${normSlot}-custom`
  const name =
    part.name ||
    (isBarebones ? 'Custom Barebones kit' : isSwitches ? 'Custom Switches' : 'Custom Keycaps')

  // Derive Price (SGD)
  let price = 0
  if (typeof part.price === 'number') {
    price = part.price
  } else if (typeof part.p === 'number') {
    price = part.p
  } else if (typeof part.ps === 'number') {
    price = Math.round(part.ps * 81)
  }

  // Derive Socket (Barebones)
  let socket = null
  if (part.socket) {
    socket = String(part.socket).toLowerCase()
  } else if (isBarebones) {
    socket = part.hot === false ? 'solder' : 'hotswap'
  }

  // Derive Pin (Switches)
  let pin = null
  if (part.pin) {
    pin = String(part.pin).toLowerCase()
  } else if (isSwitches) {
    pin = '5-pin'
  }

  // Derive Layout (ANSI vs ISO)
  let layout = null
  if (part.layout) {
    layout = String(part.layout).toLowerCase()
  } else if (!isSwitches) {
    layout = 'ansi'
  }

  // PBR Surface properties
  const color = derivePartColor(normSlot, part)
  const accentColor =
    part.accentColor ||
    (isSwitches ? deriveStemColor(part) : isKeycaps ? '#f0b429' : '#f0b429')
  const stemColor = isSwitches ? deriveStemColor(part) : null

  let metalness = 0.1
  if (typeof part.metalness === 'number') {
    metalness = part.metalness
  } else if (part.frame === 'metal' || (part.name && part.name.toLowerCase().includes('alu'))) {
    metalness = 0.8
  } else if (isBarebones) {
    metalness = 0.25
  }

  let roughness = 0.65
  if (typeof part.roughness === 'number') {
    roughness = part.roughness
  } else if (part.frame === 'metal') {
    roughness = 0.25
  } else if (isKeycaps) {
    roughness = 0.5
  } else if (isSwitches) {
    roughness = 0.6
  }

  let opacity = 1.0
  if (typeof part.opacity === 'number') {
    opacity = part.opacity
  } else if (
    part.name &&
    (part.name.toLowerCase().includes('polycarbonate') || part.name.toLowerCase().includes('acrylic'))
  ) {
    opacity = 0.85
  }

  // Textual Finish Label
  let finishLabel = 'Matte'
  if (part.finish) {
    finishLabel = part.finish
  } else if (part.finishLabel) {
    finishLabel = part.finishLabel
  } else if (part.frame === 'metal') {
    finishLabel = 'Anodized CNC Aluminium'
  } else if (part.prof) {
    finishLabel = `${part.prof} profile`
  } else if (part.type) {
    finishLabel = `${part.type} switch`
  }

  // Textual Spec Summary
  let specSummary = ''
  if (isBarebones) {
    specSummary = `${socket || 'hotswap'} · ${layout || 'ANSI 75%'}`
  } else if (isSwitches) {
    specSummary = `${pin || '5-pin'} · ${part.type ? `${part.type} ` : ''}81 switches`
  } else {
    specSummary = `${layout || 'ANSI'} · ${part.prof || 'PBT'}`
  }

  // Derive artworkUrl, textureUrl & artMode for keycaps artwork projection
  const artworkUrl = part.artworkUrl || null
  let textureUrl = part.textureUrl || artworkUrl || null
  let artMode = part.artMode || (textureUrl ? 'full' : null)

  if (isKeycaps && !textureUrl) {
    const idLower = id.toLowerCase()
    const nameLower = name.toLowerCase()
    if (
      idLower === 'kanagawa' ||
      idLower.includes('kanagawa') ||
      nameLower.includes('kanagawa') ||
      nameLower.includes('wave')
    ) {
      textureUrl = '/textures/keycaps/kanagawa-wave.jpg'
      artMode = part.artMode || 'full'
    } else if (
      idLower === 'theme' ||
      idLower === 'catmural' ||
      idLower.includes('anime') ||
      idLower.includes('mural') ||
      nameLower.includes('anime') ||
      nameLower.includes('mural') ||
      nameLower.includes('cat town')
    ) {
      textureUrl = '/textures/keycaps/anime-cat-town.jpg'
      artMode = part.artMode || 'full'
    }
  }

  // Derive legend colors & emissive for crisp lettering over artwork
  let legendColor = part.legendColor || null
  let legendEmissive = part.legendEmissive || null
  let legendEmissiveIntensity =
    typeof part.legendEmissiveIntensity === 'number' ? part.legendEmissiveIntensity : null

  if (isKeycaps && textureUrl) {
    const idLower = id.toLowerCase()
    const texLower = textureUrl.toLowerCase()
    const isLightArt =
      idLower.includes('kanagawa') ||
      texLower.includes('kanagawa') ||
      idLower.includes('wave')
    if (!legendColor) {
      legendColor = '#ffffff'
    }
    if (!legendEmissive) {
      legendEmissive = isLightArt ? '#38bdf8' : '#fef08a'
    }
    if (legendEmissiveIntensity === null) {
      legendEmissiveIntensity = isLightArt ? 0.85 : 0.75
    }
  }

  const isWave =
    id.toLowerCase().includes('kanagawa') ||
    (textureUrl && textureUrl.toLowerCase().includes('kanagawa')) ||
    id.toLowerCase().includes('wave')
  const legendVariant = part.legendVariant || (isWave ? 'dark' : 'light')
  const hasCustomLegendUrl = Boolean(part.legendTextureUrl)
  const is100Layout = String(part.layout || part.keyboardLayout || '').includes('100')
  const defaultSidePaths = is100Layout ? LEGEND_SIDE_100_TEXTURE_PATHS : LEGEND_TEXTURE_PATHS
  const legendTextureUrl =
    part.legendTextureUrl ||
    (isKeycaps ? (legendVariant === 'dark' ? defaultSidePaths.dark : defaultSidePaths.light) : null)

  // Derive legendStyle: 'top' | 'side' | 'none'
  let legendStyle = 'top'
  if (part.legendStyle) {
    legendStyle = String(part.legendStyle).toLowerCase()
  } else if (isKeycaps) {
    const idLower = id.toLowerCase()
    const nameLower = name.toLowerCase()
    if (idLower === 'blank' || nameLower.includes('blank')) {
      legendStyle = 'none'
    } else if (
      idLower === 'plainpbt' ||
      idLower === 'dshot' ||
      idLower.includes('laser') ||
      idLower.includes('french') ||
      idLower.includes('retro') ||
      nameLower.includes('plain') ||
      nameLower.includes('double-shot') ||
      nameLower.includes('dye-sub pbt keycap set')
    ) {
      legendStyle = 'top'
    } else if (
      idLower === 'matte' ||
      idLower === 'stone' ||
      idLower === 'theme' ||
      idLower === 'catmural' ||
      idLower === 'kanagawa' ||
      idLower.includes('botanical') ||
      nameLower.includes('matte') ||
      nameLower.includes('stone') ||
      nameLower.includes('mural') ||
      nameLower.includes('wave')
    ) {
      legendStyle = 'side'
    } else {
      legendStyle = textureUrl ? 'side' : 'top'
    }
  }

  return {
    slot: normSlot,
    id,
    name,
    isSelected: true,
    color,
    accentColor,
    stemColor,
    metalness,
    roughness,
    opacity,
    layout,
    pin,
    socket,
    price,
    finishLabel,
    specSummary,
    artworkUrl,
    textureUrl,
    artMode,
    legendColor,
    legendEmissive,
    legendEmissiveIntensity,
    legendVariant,
    legendTextureUrl,
    hasCustomLegendUrl,
    legendStyle,
  }
}

/**
 * Computes smooth ease-out vertical drop offset for part-by-part assembly animation.
 * Returns 0 under reduced motion or once animation completes (progress >= 1).
 *
 * @param {number} progress - Animation progress in [0, 1].
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.reducedMotion=false] - Whether reduced motion is requested.
 * @param {number} [options.dropHeight=1.65] - Total vertical drop distance in Three.js units.
 * @returns {number} Vertical offset in meters.
 */
export function computeDropOffset(progress, { reducedMotion = false, dropHeight = 1.65 } = {}) {
  if (reducedMotion) return 0
  if (!Number.isFinite(progress)) return 0
  if (progress >= 1) return 0
  if (progress <= 0) return dropHeight

  // Smooth trigonometric ease-out curve
  const easeFactor = 1 - Math.sin((progress * Math.PI) / 2)
  return easeFactor * dropHeight
}

/**
 * Iterates through a material or array of materials, calling the provided callback.
 *
 * @param {import('three').Material|import('three').Material[]} materialOrArray - Material instance or list.
 * @param {(material: import('three').Material, index: number) => void} fn - Callback function.
 */
function forEachMaterial(materialOrArray, fn) {
  if (!materialOrArray) return
  if (Array.isArray(materialOrArray)) {
    materialOrArray.forEach((mat, idx) => {
      if (mat) fn(mat, idx)
    })
  } else {
    fn(materialOrArray, 0)
  }
}

/**
 * Disposes all GPU buffers, geometries, materials, and textures recursively.
 *
 * @param {import('three').Object3D} obj - Root object to dispose.
 */
function disposeObject(obj) {
  if (!obj) return
  obj.traverse?.((child) => {
    if (child.geometry) {
      child.geometry.dispose?.()
    }
    if (child.material) {
      forEachMaterial(child.material, (mat) => {
        mat.map?.dispose?.()
        mat.emissiveMap?.dispose?.()
        mat.normalMap?.dispose?.()
        mat.roughnessMap?.dispose?.()
        mat.metalnessMap?.dispose?.()
        mat.dispose?.()
      })
    }
  })
}

/**
 * Calculates total triangle count in a BufferGeometry.
 *
 * @param {import('three').BufferGeometry} geometry - Buffer geometry to inspect.
 * @returns {number} Triangle count.
 */
function countGeometryTriangles(geometry) {
  if (!geometry) return 0
  if (geometry.index) return geometry.index.count / 3
  if (geometry.attributes?.position) return geometry.attributes.position.count / 3
  return 0
}

/**
 * In-memory texture cache for keycap artwork textures to avoid redundant network roundtrips.
 *
 * @type {Map<string, import('three').Texture>}
 */
export const textureCache = new Map()

/**
 * Normalizes layout form-factor code into a canonical string ('60', '75', '100').
 *
 * @param {string|number} [layoutCode='75'] - Raw layout code or percent string.
 * @returns {'60'|'75'|'100'} Canonical layout code.
 */
export function normalizeLayoutCode(layoutCode = '75') {
  const raw = String(layoutCode || '75').replace('%', '').trim()
  return raw === '60' || raw === '100' ? raw : '75'
}

/**
 * Unified cached texture loader for keycap artwork and legends.
 * Configures SRGB color space, filtering, and mipmaps.
 *
 * @param {string} url - Texture asset URL or relative path.
 * @param {object} [options={}] - Texture options.
 * @param {boolean} [options.flipY=true] - Whether to flip the texture along vertical axis.
 * @param {boolean} [options.clamp=false] - Whether to clamp texture to edges.
 * @param {Function} [options.onError] - Error callback on load failure.
 * @param {Map<string, import('three').Texture>} [options.cache=textureCache] - Cache Map to store loaded texture.
 * @param {Function} [onComplete] - Callback fired when texture finishes loading.
 * @returns {import('three').Texture|null} Cached or newly requested Texture instance.
 */
export function loadCachedTexture(url, { flipY = true, clamp = false, onError, cache = textureCache } = {}, onComplete) {
  if (!url || typeof url !== 'string') return null
  const cacheMap = cache || textureCache
  if (cacheMap.has(url)) {
    return cacheMap.get(url)
  }

  const applyTextureConfig = (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = Boolean(flipY)
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 8
    if (clamp) {
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
    }
    tex.needsUpdate = true
  }

  // Gracefully handle headless/jsdom testing environment where Image or WebGL is mocked
  if (typeof Image === 'undefined') {
    const dummyTexture = new THREE.Texture()
    dummyTexture.name = url
    applyTextureConfig(dummyTexture)
    cacheMap.set(url, dummyTexture)
    if (typeof onComplete === 'function') {
      onComplete(dummyTexture)
    }
    return dummyTexture
  }

  const loader = new THREE.TextureLoader()
  const texture = loader.load(
    url,
    (loadedTex) => {
      applyTextureConfig(loadedTex)
      if (typeof onComplete === 'function') {
        onComplete(loadedTex)
      }
    },
    undefined,
    (err) => {
      console.warn(`Failed to load texture (${url}):`, err)
      cacheMap.delete(url)
      if (typeof onError === 'function') {
        onError(err)
      }
    }
  )
  applyTextureConfig(texture)
  cacheMap.set(url, texture)
  return texture
}

/**
 * Loads keycap artwork texture with flipY=true.
 *
 * @param {string} url - Texture URL.
 * @param {Function} [onComplete] - Callback fired when texture finishes loading.
 * @param {object} [options={}] - Additional options.
 * @returns {import('three').Texture|null}
 */
export function loadKeycapTexture(url, onComplete, options = {}) {
  const cacheKey = options?.variant ? `${url}__${options.variant}` : url
  return loadCachedTexture(
    cacheKey,
    { flipY: true, cache: options?.cache || textureCache, onError: options?.onError },
    onComplete
  )
}

/**
 * Canonical high-contrast keycap legend texture atlas URLs.
 * Pre-composited with thick strokes and high-contrast outline halos.
 *
 * @type {Readonly<{ light: string, dark: string }>}
 */
export const LEGEND_TEXTURE_PATHS = Object.freeze({
  light: '/textures/keycaps/legends-crisp-light.png',
  dark: '/textures/keycaps/legends-crisp-dark.png',
})

/**
 * Side-printed legend atlas paths for 100% full-size layout (12 rows x 9 columns).
 * Extends base rows with rows 9-11 containing crisp side legends for all 23 right-side Numpad and Nav keys.
 *
 * @type {Readonly<{ light: string, dark: string }>}
 */
export const LEGEND_SIDE_100_TEXTURE_PATHS = Object.freeze({
  light: '/textures/keycaps/legends-side-100-light.png',
  dark: '/textures/keycaps/legends-side-100-dark.png',
})

/**
 * Loads side-printed keycap legend texture atlas with flipY=false matching GLTF UV convention.
 *
 * @param {string} url - Legend texture asset URL or relative path.
 * @param {Function} [onComplete] - Callback fired when texture finishes loading.
 * @param {object} [options={}] - Additional options.
 * @returns {import('three').Texture|null}
 */
export function loadKeycapLegendTexture(url, onComplete, options = {}) {
  return loadCachedTexture(
    url,
    { flipY: false, clamp: true, cache: options?.cache || textureCache, onError: options?.onError },
    onComplete
  )
}

/**
 * Loads a top-legend atlas texture for the given layout code ('60', '75', '100').
 *
 * @param {string} [layoutCode='75'] - Layout form-factor code ('60', '75', '100').
 * @param {Function} [onComplete] - Callback fired when texture finishes loading.
 * @param {object} [options={}] - Additional options.
 * @returns {import('three').Texture|null}
 */
export function loadTopLegendTexture(layoutCode = '75', onComplete, options = {}) {
  const normLayout = normalizeLayoutCode(layoutCode)
  const url = TOP_LEGEND_TEXTURE_PATHS[normLayout] || TOP_LEGEND_TEXTURE_PATHS['75']
  return loadCachedTexture(
    url,
    { flipY: true, cache: options?.cache || textureCache, onError: options?.onError },
    onComplete
  )
}

/**
 * Detects whether a mesh or material represents side-printed keycap legend engraving decals.
 * Never relies on fragile glTF primitive node indices (such as 'Layer_Keycaps_2').
 *
 * @param {THREE.Object3D} [child] - Candidate mesh node.
 * @param {THREE.Material} [mat] - Specific material instance if traversing materials.
 * @returns {boolean} True if the node or material represents side legend decals.
 */
export function isSideLegendMesh(child, mat) {
  if (mat) {
    const matName = (mat.name || '').toLowerCase()
    return (
      matName.includes('engraving') ||
      matName.includes('legend') ||
      matName.includes('decal') ||
      child?.userData?.isLegend === true
    )
  }
  if (!child) return false
  if (child.userData?.isLegend === true) return true
  const cName = (child.name || '').toLowerCase()
  if (
    cName.includes('legend') ||
    cName.includes('decal') ||
    cName.includes('engraving')
  ) {
    return true
  }
  let hasDecalMat = false
  if (child.material) {
    forEachMaterial(child.material, (m) => {
      const mName = (m?.name || '').toLowerCase()
      if (mName.includes('engraving') || mName.includes('legend') || mName.includes('decal')) {
        hasDecalMat = true
      }
    })
  }
  return hasDecalMat
}

/**
 * Computes the unified bounding box across all keycap meshes in `keycapGroup` (minX..maxX, minZ..maxZ)
 * and generates/updates top-down planar UV coordinates (`Float32BufferAttribute`) so artwork textures
 * span continuously from left-to-right (X: 0..1) and top-to-bottom (Z: 1..0 upright in top-down/isometric).
 *
 * For top-facing and upper-bevel vertices (`normal.y > 0.25` or upper 65% of vertex Y), UV coordinates
 * are projected planarly. Side skirt vertices wrap smoothly down the keycap skirts preserving 5-sided dye-sub aesthetics.
 * Also stores a per-vertex `isTopFace` attribute and `mesh.userData.topDownProjected = true`.
 * The resulting bounds are memoised on `keycapGroup.userData.topDownBounds`; repeat calls with no
 * unprojected meshes return them immediately (keycap geometry only changes on layout switch).
 *
 * @param {import('three').Group|import('three').Object3D} keycapGroup - Three.js Object3D / Group containing keycaps.
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number, width: number, depth: number }|null} Bounding box summary or null.
 */
export function ensureTopDownKeycapUVs(keycapGroup) {
  if (!keycapGroup || typeof keycapGroup.traverse !== 'function') return null

  if (typeof keycapGroup.updateMatrixWorld === 'function') {
    keycapGroup.updateMatrixWorld(true)
  }

  const meshes = []
  keycapGroup.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes?.position) {
      meshes.push(child)
    }
  })

  if (meshes.length === 0) return null

  const isDecalMesh = (child) => {
    if (!child || !child.isMesh) return false
    if (child.userData?.isTopLegend || child.name === 'Top_Legends_Overlay') {
      return true
    }
    return isSideLegendMesh(child)
  }

  // Keycap geometry is immutable between layout switches, so repeat calls (one
  // per Part selection) reuse the previous projection rather than re-projecting
  // every vertex of the whole board.
  const cachedBounds = keycapGroup.userData?.topDownBounds
  if (cachedBounds && meshes.every((m) => isDecalMesh(m) || m.userData?.topDownProjected)) {
    return cachedBounds
  }

  const invGroupMatrix = new THREE.Matrix4().copy(keycapGroup.matrixWorld).invert()
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const v = new THREE.Vector3()

  // First pass: compute unified bounding box across all keycap meshes in keycapGroup coordinate space
  const nonDecalMeshes = meshes.filter((m) => !isDecalMesh(m))
  const bboxMeshes = nonDecalMeshes.length > 0 ? nonDecalMeshes : meshes

  for (const mesh of bboxMeshes) {
    const toGroup = new THREE.Matrix4().multiplyMatrices(invGroupMatrix, mesh.matrixWorld)
    const pos = mesh.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(toGroup)
      if (v.x < minX) minX = v.x
      if (v.x > maxX) maxX = v.x
      if (v.z < minZ) minZ = v.z
      if (v.z > maxZ) maxZ = v.z
      if (v.y < minY) minY = v.y
      if (v.y > maxY) maxY = v.y
    }
  }

  const width = maxX - minX > 0.0001 ? maxX - minX : 1.0
  const depth = maxZ - minZ > 0.0001 ? maxZ - minZ : 1.0
  const height = maxY - minY > 0.0001 ? maxY - minY : 1.0
  const yUpper65 = minY + height * 0.35 // Upper 65% region threshold

  // Second pass: generate top-down planar UV mapping and per-vertex top face flags
  // CRITICAL: Do NOT overwrite the uv attribute on decal/legend meshes!
  for (const mesh of meshes) {
    if (isDecalMesh(mesh)) {
      continue
    }

    const toGroup = new THREE.Matrix4().multiplyMatrices(invGroupMatrix, mesh.matrixWorld)
    const pos = mesh.geometry.attributes.position
    const norm = mesh.geometry.attributes.normal
    const count = pos.count
    const uvs = new Float32Array(count * 2)
    const isTopFace = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(toGroup)

      // U: Left-to-right (minX -> 0.0, maxX -> 1.0)
      // V: Top-to-bottom (minZ / Esc row -> 1.0, maxZ / Spacebar row -> 0.0 upright)
      const u = Math.min(Math.max((v.x - minX) / width, 0.0), 1.0)
      const vCoord = Math.min(Math.max(1.0 - (v.z - minZ) / depth, 0.0), 1.0)

      uvs[i * 2] = u
      uvs[i * 2 + 1] = vCoord

      const ny = norm ? norm.getY(i) : 1.0
      isTopFace[i] = ny > 0.25 || v.y >= yUpper65 ? 1.0 : 0.0
    }

    mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    mesh.geometry.setAttribute('isTopFace', new THREE.Float32BufferAttribute(isTopFace, 1))
    mesh.geometry.attributes.uv.needsUpdate = true
    mesh.userData.topDownProjected = true
  }

  const bounds = { minX, maxX, minZ, maxZ, width, depth }
  if (keycapGroup.userData) keycapGroup.userData.topDownBounds = bounds
  return bounds
}

/**
 * Creates or updates a dedicated top-legends overlay mesh on the keycaps layer group.
 * Extracts upward-facing top-dish triangles (normal.y >= 0.65) and maps them with planar top-down UVs.
 *
 * @param {import('three').Group} keycapGroup - Keycaps layer group.
 * @param {object} [bounds] - Precomputed planar bounds { minX, maxX, minZ, maxZ, width, depth }.
 * @returns {import('three').Mesh|null} Created or existing top-legends overlay mesh.
 */
export function createTopLegendsOverlay(keycapGroup, bounds) {
  if (!keycapGroup || typeof keycapGroup.traverse !== 'function') return null

  // Clean up existing overlay if present
  let existingOverlay = null
  keycapGroup.traverse((child) => {
    if (child.userData?.isTopLegend || child.name === 'Top_Legends_Overlay') {
      existingOverlay = child
    }
  })
  if (existingOverlay && existingOverlay.parent) {
    existingOverlay.parent.remove(existingOverlay)
    existingOverlay.geometry?.dispose?.()
    existingOverlay.material?.dispose?.()
  }

  const meshes = []
  keycapGroup.traverse((child) => {
    if (child.isMesh && child.geometry && child.geometry.attributes?.position) {
      const isDecal =
        child.userData?.isTopLegend ||
        child.name === 'Top_Legends_Overlay' ||
        isSideLegendMesh(child)
      if (!isDecal) meshes.push(child)
    }
  })

  if (meshes.length === 0) return null

  // Determine planar bounds if not passed
  let { minX, maxX, minZ, maxZ, minY, maxY, width, depth } = bounds || {}
  const invGroupMatrix = new THREE.Matrix4().copy(keycapGroup.matrixWorld).invert()
  const v = new THREE.Vector3()

  if (minX === undefined || width === undefined || minY === undefined || maxY === undefined) {
    minX = Infinity
    maxX = -Infinity
    minZ = Infinity
    maxZ = -Infinity
    minY = Infinity
    maxY = -Infinity
    for (const mesh of meshes) {
      const toGroup = new THREE.Matrix4().multiplyMatrices(invGroupMatrix, mesh.matrixWorld)
      const pos = mesh.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(toGroup)
        if (v.x < minX) minX = v.x
        if (v.x > maxX) maxX = v.x
        if (v.z < minZ) minZ = v.z
        if (v.z > maxZ) maxZ = v.z
        if (v.y < minY) minY = v.y
        if (v.y > maxY) maxY = v.y
      }
    }
    width = maxX - minX > 0.0001 ? maxX - minX : 1.0
    depth = maxZ - minZ > 0.0001 ? maxZ - minZ : 1.0
  }

  const extractedPositions = []
  const extractedUVs = []

  for (const mesh of meshes) {
    const toGroup = new THREE.Matrix4().multiplyMatrices(invGroupMatrix, mesh.matrixWorld)
    const pos = mesh.geometry.attributes.position
    const norm = mesh.geometry.attributes.normal
    const index = mesh.geometry.index

    const checkAndAddTriangle = (i0, i1, i2) => {
      if (norm) {
        const ny0 = norm.getY(i0)
        const ny1 = norm.getY(i1)
        const ny2 = norm.getY(i2)
        if ((ny0 + ny1 + ny2) / 3.0 < 0.85) return
      }

      const p0 = new THREE.Vector3(pos.getX(i0), pos.getY(i0), pos.getZ(i0)).applyMatrix4(toGroup)
      const p1 = new THREE.Vector3(pos.getX(i1), pos.getY(i1), pos.getZ(i1)).applyMatrix4(toGroup)
      const p2 = new THREE.Vector3(pos.getX(i2), pos.getY(i2), pos.getZ(i2)).applyMatrix4(toGroup)

      // Exclude low inner-stem cavity triangles (cavity floor/ceiling sitting deep inside keycap)
      // Keycaps slope down from north (minZ, higher Y) to south (maxZ, lower Y)
      const avgY = (p0.y + p1.y + p2.y) / 3.0
      const avgZ = (p0.z + p1.z + p2.z) / 3.0
      if (Number.isFinite(maxY) && maxY > 0.030) {
        const progressZ = depth > 0.0001 ? Math.min(Math.max((avgZ - minZ) / depth, 0.0), 1.0) : 0.0
        const expectedDishY = maxY - progressZ * 0.0105
        if (avgY < expectedDishY - 0.0035) return
      } else if (Number.isFinite(minY) && Number.isFinite(maxY) && maxY > minY + 0.005) {
        if (avgY < minY + 0.62 * (maxY - minY)) return
      }

      // Collect positions
      extractedPositions.push(p0.x, p0.y, p0.z)
      extractedPositions.push(p1.x, p1.y, p1.z)
      extractedPositions.push(p2.x, p2.y, p2.z)

      // Compute planar top-down UVs matching atlas coordinates
      // U: Left-to-right (minX -> 0.0, maxX -> 1.0)
      // V: Top-to-bottom (minZ / Esc row -> 1.0, maxZ / Spacebar row -> 0.0 upright)
      const u0 = Math.min(Math.max((p0.x - minX) / width, 0.0), 1.0)
      const v0 = Math.min(Math.max(1.0 - (p0.z - minZ) / depth, 0.0), 1.0)
      const u1 = Math.min(Math.max((p1.x - minX) / width, 0.0), 1.0)
      const v1 = Math.min(Math.max(1.0 - (p1.z - minZ) / depth, 0.0), 1.0)
      const u2 = Math.min(Math.max((p2.x - minX) / width, 0.0), 1.0)
      const v2 = Math.min(Math.max(1.0 - (p2.z - minZ) / depth, 0.0), 1.0)

      extractedUVs.push(u0, v0, u1, v1, u2, v2)
    }

    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        checkAndAddTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2))
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        checkAndAddTriangle(i, i + 1, i + 2)
      }
    }
  }

  if (extractedPositions.length === 0) return null

  const overlayGeo = new THREE.BufferGeometry()
  overlayGeo.setAttribute('position', new THREE.Float32BufferAttribute(extractedPositions, 3))
  overlayGeo.setAttribute('uv', new THREE.Float32BufferAttribute(extractedUVs, 2))

  const overlayMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  })

  const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat)
  overlayMesh.name = 'Top_Legends_Overlay'
  overlayMesh.userData.isTopLegend = true
  overlayMesh.renderOrder = 25
  overlayMesh.position.y = 0.00028 // Physical elevation above top dish

  keycapGroup.add(overlayMesh)
  return overlayMesh
}

/**
 * Camera preset coordinates and target points for inspection views.
 */
export const DEFAULT_CAMERA_PRESETS = Object.freeze({
  isometric: Object.freeze({
    pos: [0.88, 2.12, 2.72],
    target: [0, 0.09, 0],
  }),
  top: Object.freeze({
    pos: [0, 3.65, 0.01],
    target: [0, 0.12, 0],
  }),
  side: Object.freeze({
    pos: [3.6, 0.55, 0],
    target: [0, 0.02, 0],
  }),
})

export const CAMERA_PRESETS = DEFAULT_CAMERA_PRESETS

/**
 * Applies one of 3 distinct case silhouettes (high-profile, low-profile, sandwich)
 * to a Barebones kit layer group.
 *
 * @param {object} spec - Normalized or raw Barebones part descriptor.
 * @param {import('three').Group} barebonesGroup - Target Barebones layer group.
 * @returns {'high-profile'|'low-profile'|'sandwich'} Applied silhouette variant.
 */
export function applyBarebonesGeometryVariant(spec, barebonesGroup) {
  if (!barebonesGroup) return 'high-profile'
  const idLower = (spec?.id || '').toLowerCase()
  const nameLower = (spec?.name || '').toLowerCase()
  const finishLower = (spec?.finish || '').toLowerCase()

  let variant = 'high-profile'
  if (
    idLower.includes('sandwich') ||
    nameLower.includes('sandwich') ||
    nameLower.includes('skeleton') ||
    finishLower.includes('sandwich')
  ) {
    variant = 'sandwich'
  } else if (
    idLower === 'abs' ||
    idLower === 'fr4' ||
    idLower.includes('low-profile') ||
    nameLower.includes('low-profile') ||
    nameLower.includes('floating') ||
    finishLower.includes('low-profile')
  ) {
    variant = 'low-profile'
  }

  const isAluBrass =
    idLower === 'alubrass' ||
    idLower.includes('alubrass') ||
    nameLower.includes('brass') ||
    finishLower.includes('brass')

  // Find main case mesh
  let caseMesh = null
  barebonesGroup.traverse((child) => {
    if (child.isMesh) {
      const cName = (child.name || '').toLowerCase()
      if (
        (cName.includes('case') || cName === 'mesh_case') &&
        !cName.includes('plate') &&
        !cName.includes('brass') &&
        !cName.includes('sandwich') &&
        !cName.includes('standoff')
      ) {
        caseMesh = child
      }
    }
  })

  // 1. Brass Weight Accent (gleaming brushed-brass bar on front chamfer for alubrass)
  let brassAccent = barebonesGroup.getObjectByName('Brass_Weight_Accent')
  if (isAluBrass) {
    if (!brassAccent) {
      const brassGeo = new THREE.BoxGeometry(0.26, 0.006, 0.016)
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.88,
        roughness: 0.22,
        name: 'Mat_Brass_Weight_Accent',
      })
      brassAccent = new THREE.Mesh(brassGeo, brassMat)
      brassAccent.name = 'Brass_Weight_Accent'
      brassAccent.position.set(0, 0.003, 0.062)
      barebonesGroup.add(brassAccent)
    }
    brassAccent.visible = true
  } else if (brassAccent) {
    brassAccent.visible = false
  }

  // 2. Sandwich Group (open-edge stacked acrylic frame with 2 plates & 6 standoffs)
  let sandwichGroup = barebonesGroup.getObjectByName('Sandwich_Group')
  if (variant === 'sandwich') {
    if (!sandwichGroup) {
      sandwichGroup = new THREE.Group()
      sandwichGroup.name = 'Sandwich_Group'

      const plateMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
        name: 'Mat_Sandwich_Plates',
      })
      const topPlateGeo = new THREE.BoxGeometry(0.31, 0.003, 0.12)
      const topPlate = new THREE.Mesh(topPlateGeo, plateMat)
      topPlate.name = 'Sandwich_Top_Plate'
      topPlate.position.set(0, 0.018, -0.008)
      sandwichGroup.add(topPlate)

      const bottomPlateGeo = new THREE.BoxGeometry(0.31, 0.003, 0.12)
      const bottomPlate = new THREE.Mesh(bottomPlateGeo, plateMat.clone())
      bottomPlate.name = 'Sandwich_Bottom_Plate'
      bottomPlate.position.set(0, 0.002, -0.008)
      sandwichGroup.add(bottomPlate)

      const standoffMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.25,
        name: 'Mat_Sandwich_Standoffs',
      })
      const standoffGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.022, 16)
      const standoffPositions = [
        [-0.145, 0.01, -0.056],
        [0.0, 0.01, -0.056],
        [0.145, 0.01, -0.056],
        [-0.145, 0.01, 0.044],
        [0.0, 0.01, 0.044],
        [0.145, 0.01, 0.044],
      ]
      standoffPositions.forEach((pos, idx) => {
        const standoff = new THREE.Mesh(standoffGeo, standoffMat)
        standoff.name = `Sandwich_Standoff_${idx}`
        standoff.position.set(pos[0], pos[1], pos[2])
        sandwichGroup.add(standoff)
      })

      barebonesGroup.add(sandwichGroup)
    }
    sandwichGroup.visible = true
    if (caseMesh) {
      caseMesh.visible = false
    }
  } else {
    if (sandwichGroup) {
      sandwichGroup.visible = false
    }
    if (caseMesh) {
      caseMesh.visible = true
      if (variant === 'low-profile') {
        caseMesh.scale.y = 0.58
        caseMesh.position.y = -0.008
      } else {
        caseMesh.scale.y = 1.0
        caseMesh.position.y = 0.0
      }
    }
  }

  return variant
}

/**
 * Creates and initializes the interactive 3D Build Preview scene.
 *
 * @param {object} [options={}] - Configuration options.
 * @param {HTMLCanvasElement} [options.canvas] - Target WebGL canvas element.
 * @param {Function} [options.onLoad] - Callback invoked when GLTF asset finishes loading.
 * @param {Function} [options.onError] - Callback invoked on WebGL or renderer creation failure.
 * @param {Function} [options.onCameraPresetChange] - Callback invoked when active camera preset changes.
 * @param {Function} [options.onContextRestored] - Callback invoked when WebGL context is restored.
 * @param {boolean} [options.loadGlb=true] - Whether to load the hybrid GLTF asset.
 * @param {string} [options.modelUrl='/models/exploded-keyboard.glb'] - URL to keyboard GLTF model.
 * @param {string} [options.layout='75'] - Initial layout form-factor ('60', '75', '100').
 * @param {Function} [options.rendererFactory] - Custom renderer factory for testing/mocking.
 * @param {boolean} [options.reducedMotion=false] - Initial reduced motion preference.
 * @returns {object|null} Controller object for the preview scene.
 */
export function createBuildPreviewScene({
  canvas,
  onLoad,
  onError,
  onCameraPresetChange,
  onContextRestored,
  loadGlb = true,
  modelUrl,
  layout = '75',
  rendererFactory,
  reducedMotion: initialReducedMotion = false,
} = {}) {
  let isDisposed = false
  let isPausedState = false
  let contextLost = false
  let animId = null
  let reducedMotion = Boolean(initialReducedMotion)
  let mode = 'procedural'
  let currentPreset = 'isometric'
  let lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now()

  let currentLayout = String(layout || '75').replace('%', '').trim()
  if (currentLayout !== '60' && currentLayout !== '100') {
    currentLayout = '75'
  }
  const defaultModelUrl = modelUrl || LAYOUT_MODELS[currentLayout] || LAYOUT_MODELS['75']
  const glbCache = new Map()
  const inFlightGlbPromises = new Map()
  const textureCache = new Map()

  // 1. Scene and Root Group Setup
  const scene = new THREE.Scene()
  const rootGroup = new THREE.Group()
  rootGroup.name = 'BuildPreview_Root'
  scene.add(rootGroup)

  // 2. Camera Setup (PerspectiveCamera 40deg)
  const clientW =
    canvas && canvas.clientWidth > 0
      ? canvas.clientWidth
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 800
  const clientH =
    canvas && canvas.clientHeight > 0
      ? canvas.clientHeight
      : typeof window !== 'undefined'
        ? window.innerHeight
        : 600
  const aspect = clientH > 0 && clientW > 0 ? clientW / clientH : 1.33

  const camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 100)
  const defaultIso = CAMERA_PRESETS.isometric
  camera.position.set(defaultIso.pos[0], defaultIso.pos[1], defaultIso.pos[2])
  camera.lookAt(defaultIso.target[0], defaultIso.target[1], defaultIso.target[2])

  // 3. Lighting Setup (Key, Rim, Fill directional lights + Ambient)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
  keyLight.position.set(4, 6, 5)
  const rimLight = new THREE.DirectionalLight(0x90b0e0, 0.9)
  rimLight.position.set(-4, 3, -4)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
  fillLight.position.set(0, 5, -5)
  scene.add(ambientLight, keyLight, rimLight, fillLight)

  // 4. Renderer Setup
  let renderer = null
  let pmremGenerator = null
  let envRenderTarget = null

  const effectiveRendererFactory =
    rendererFactory ||
    canvas?._mockRendererFactory ||
    (canvas?._mockRenderer ? () => canvas._mockRenderer : null)

  if (effectiveRendererFactory) {
    try {
      renderer = effectiveRendererFactory({ canvas, scene, camera })
    } catch (err) {
      if (typeof onError === 'function') onError(err)
      else throw err
      return null
    }
  } else {
    // A4: Check WebGL availability on canvas.ownerDocument (a throwaway canvas) instead of calling getContext
    // on the render canvas before THREE.WebGLRenderer is created (while still allowing custom test mock canvases
    // that define _mockContext or custom getContext spies when !canvas.ownerDocument or when a custom getContext spy is attached).
    const hasCustomSpy = Boolean(
      canvas &&
        (canvas._mockContext ||
          Object.prototype.hasOwnProperty.call(canvas, 'getContext') ||
          (typeof canvas.getContext === 'function' &&
            typeof HTMLCanvasElement !== 'undefined' &&
            canvas.getContext !== HTMLCanvasElement.prototype.getContext))
    )
    const webglTarget = !canvas?.ownerDocument || hasCustomSpy ? canvas : canvas.ownerDocument
    const webglOk = isWebGLAvailable(webglTarget)
    if (!webglOk) {
      const err = new Error('WebGL is not available in the current environment.')
      if (typeof onError === 'function') {
        onError(err)
        return null
      }
      throw err
    }
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: canvas?._mockContext || undefined,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
      renderer.setPixelRatio(dpr)
      renderer.setSize(canvas?.clientWidth || 800, canvas?.clientHeight || 600, false)
      renderer.outputColorSpace = THREE.SRGBColorSpace
    } catch (err) {
      if (typeof onError === 'function') {
        onError(err)
        return null
      }
      throw err
    }
  }

  // ACES Filmic Tone Mapping
  if (renderer) {
    try {
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 0.95
    } catch {
      // Guard against non-configurable mocks
    }
  }

  // RoomEnvironment Setup
  if (renderer) {
    try {
      pmremGenerator = new THREE.PMREMGenerator(renderer)
      pmremGenerator.compileEquirectangularShader?.()
      const roomEnv = new RoomEnvironment()
      envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04)
      roomEnv.dispose?.()
      if (scene) {
        scene.environment = envRenderTarget.texture
        scene.environmentIntensity = 0.35
      }
    } catch {
      // Graceful in tests
    }
  }

  // 5. OrbitControls Setup
  let controls = null
  let activeControlFrames = 0
  let targetExplosionFactor = 1.0 // 1.0 = exploded, 0.0 = combined
  let currentExplosionFactor = 1.0

  const handleControlsStart = () => {
    currentPreset = 'custom'
    if (typeof onCameraPresetChange === 'function') {
      onCameraPresetChange('custom')
    }
    activeControlFrames = 24
    if (!reducedMotion) {
      startAnimationLoop()
    }
  }

  const handleControlsChange = () => {
    activeControlFrames = 24
    if (reducedMotion || animId === null) {
      if (reducedMotion) {
        requestSingleFrame()
      } else {
        startAnimationLoop()
      }
    }
  }

  if (canvas && typeof canvas.addEventListener === 'function') {
    try {
      controls = new OrbitControls(camera, canvas)
      controls.enableDamping = !reducedMotion
      controls.dampingFactor = 0.08
      controls.rotateSpeed = 0.35
      controls.zoomSpeed = 0.65
      controls.enableRotate = true
      controls.enableZoom = true
      controls.enablePan = false
      controls.minDistance = 1.5
      controls.maxDistance = 8.0
      controls.maxPolarAngle = Math.PI / 2 - 0.05
      controls.target.set(defaultIso.target[0], defaultIso.target[1], defaultIso.target[2])
      controls.update()

      controls.addEventListener('start', handleControlsStart)
      controls.addEventListener('change', handleControlsChange)
    } catch {
      // OrbitControls may fail in headless/mock DOM
    }
  }

  // 6. 3 Active Visual Layer Groups (ADR-0008)
  // All 3 layers rest at baseY = 0 because GLB and procedural fallback meshes
  // already have their assembled resting Y coordinates baked into geometry (REV-2).
  const layers = {
    barebones: {
      id: 'barebones',
      baseY: 0,
      explodedY: -0.32,
      dropProgress: 1,
      group: new THREE.Group(),
    },
    switches: {
      id: 'switches',
      baseY: 0,
      explodedY: 0.04,
      dropProgress: 1,
      group: new THREE.Group(),
    },
    keycaps: {
      id: 'keycaps',
      baseY: 0,
      explodedY: 0.40,
      dropProgress: 1,
      group: new THREE.Group(),
    },
  }

  // Scale child layers to fill canvas without clipping top or bottom
  const initialScale = LAYOUT_SCALES[currentLayout] || 5.75
  for (const id of BUILD_PREVIEW_LAYER_IDS) {
    const layer = layers[id]
    layer.group.name = `Layer_${id}`
    layer.group.scale.set(initialScale, initialScale, initialScale)
    layer.group.position.y = layer.explodedY
    rootGroup.add(layer.group)
  }

  /**
   * Adjusts all 3 layer group scales to fit the active form-factor layout.
   *
   * @param {string} layoutCode - Layout code ('60', '75', '100').
   */
  function applyLayoutScale(layoutCode) {
    const s = LAYOUT_SCALES[layoutCode] || 5.75
    for (const id of BUILD_PREVIEW_LAYER_IDS) {
      layers[id].group.scale.set(s, s, s)
    }
  }

  // Stored normalized Part states
  const currentParts = {
    barebones: normalizePreviewPart('barebones', null),
    switches: normalizePreviewPart('switches', null),
    keycaps: normalizePreviewPart('keycaps', null),
  }

  // 7. Procedural Fallback Mesh Construction (< 40k triangles, <= 8 draw calls)
  const fallbackGeos = buildProceduralFallbackLayers()

  // (a) Layer_Case & Layer_Plate -> barebones (Plate is part of the Barebones kit housing)
  if (fallbackGeos.case) {
    while (fallbackGeos.case.children.length > 0) {
      const child = fallbackGeos.case.children[0]
      if (child.material) {
        child.material = child.material.clone()
      }
      layers.barebones.group.add(child)
    }
  }
  if (fallbackGeos.plate) {
    while (fallbackGeos.plate.children.length > 0) {
      const child = fallbackGeos.plate.children[0]
      if (child.material) {
        child.material = child.material.clone()
      }
      layers.barebones.group.add(child)
    }
  }
  // Dispose omitted internal layers per ADR-0008
  disposeObject(fallbackGeos.pcb)
  disposeObject(fallbackGeos.foam)

  /**
   * Rebuilds procedural instanced switches and stems for a given layout position list.
   *
   * @param {import('three').Group} targetGroup - Target switches group.
   * @param {ReadonlyArray<{ x: number, y: number, z: number }>} positions - 3D switch coordinates.
   */
  function rebuildProceduralSwitches(targetGroup, positions) {
    if (!targetGroup || !positions) return
    while (targetGroup.children.length > 0) {
      const oldChild = targetGroup.children[0]
      targetGroup.remove(oldChild)
      disposeObject(oldChild)
    }
    const dummy = new THREE.Object3D()
    const count = positions.length

    const switchGeo = new THREE.BoxGeometry(0.014, 0.01, 0.014)
    const switchMat = new THREE.MeshStandardMaterial({
      color: 0xd8cfc2,
      roughness: 0.6,
      metalness: 0.1,
      name: 'Mat_Switches_Fallback',
    })
    const switchesInst = new THREE.InstancedMesh(switchGeo, switchMat, count)
    switchesInst.name = 'Switch_Instances_Fallback'
    positions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y - 0.0025, pos.z)
      dummy.rotation.x = -KEYBOARD_DIMENSIONS.slopeRad
      dummy.updateMatrix()
      switchesInst.setMatrixAt(i, dummy.matrix)
    })
    switchesInst.instanceMatrix.needsUpdate = true
    targetGroup.add(switchesInst)

    // Instanced switch stems for distinct stem coloring
    const stemGeo = new THREE.BoxGeometry(0.006, 0.007, 0.006)
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0xd9468f,
      roughness: 0.4,
      metalness: 0.05,
      name: 'Mat_Switch_Stem_Fallback',
    })
    const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, count)
    stemInst.name = 'Switch_Stems_Fallback'
    positions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y + 0.0025, pos.z)
      dummy.rotation.x = -KEYBOARD_DIMENSIONS.slopeRad
      dummy.updateMatrix()
      stemInst.setMatrixAt(i, dummy.matrix)
    })
    stemInst.instanceMatrix.needsUpdate = true
    targetGroup.add(stemInst)
  }

  /**
   * Creates instanced switches from a Switch_Prototype mesh across layout positions.
   *
   * @param {import('three').Object3D} switchProto - Loaded switch prototype.
   * @param {import('three').Group} targetGroup - Target Layer_Switches group.
   * @param {ReadonlyArray<{ x: number, y: number, z: number }>} positions - 3D coordinates.
   * @returns {Array<import('three').InstancedMesh>}
   */
  function createSwitchMatrixInstancesForLayout(switchProto, targetGroup, positions) {
    if (!switchProto || !targetGroup || !positions) return []
    while (targetGroup.children.length > 0) {
      const oldChild = targetGroup.children[0]
      targetGroup.remove(oldChild)
      disposeObject(oldChild)
    }

    const switchPrimitives = []
    if (switchProto.isMesh) {
      switchPrimitives.push(switchProto)
    } else {
      switchProto.traverse((child) => {
        if (child.isMesh) {
          switchPrimitives.push(child)
        }
      })
    }

    const dummyObj = new THREE.Object3D()
    const createdInstances = []
    const count = positions.length

    switchPrimitives.forEach((mesh, pIdx) => {
      const clonedMaterial = Array.isArray(mesh.material)
        ? mesh.material.map((m) => (m && typeof m.clone === 'function' ? m.clone() : m))
        : mesh.material && typeof mesh.material.clone === 'function'
          ? mesh.material.clone()
          : mesh.material

      forEachMaterial(clonedMaterial, (mat) => {
        const isTranslucent =
          mat.transparent === true ||
          Boolean(mat.name && mat.name.toLowerCase().includes('switches transparent'))
        if (isTranslucent) {
          mat.depthWrite = true
          mat.transparent = true
          mat.opacity = 0.78
        }
      })
      const instancedMesh = new THREE.InstancedMesh(mesh.geometry, clonedMaterial, count)
      instancedMesh.name = `Switch_Instances_Hybrid_${pIdx}`
      positions.forEach((pos, idx) => {
        dummyObj.position.set(pos.x, pos.y - 0.0025, pos.z)
        dummyObj.rotation.x = -KEYBOARD_DIMENSIONS.slopeRad
        dummyObj.updateMatrix()
        instancedMesh.setMatrixAt(idx, dummyObj.matrix)
      })
      instancedMesh.instanceMatrix.needsUpdate = true
      targetGroup.add(instancedMesh)
      createdInstances.push(instancedMesh)
    })
    return createdInstances
  }

  // (b) Layer_Switches -> switches
  // Clone switch fallback instance & construct stem instances for independent stemColor updating
  if (fallbackGeos.switches) {
    const initialPositions = SWITCH_LAYOUTS[currentLayout] || SWITCH_LAYOUT_POSITIONS
    rebuildProceduralSwitches(layers.switches.group, initialPositions)
  }

  // (c) Layer_Keycaps -> keycaps
  if (fallbackGeos.keycaps) {
    while (fallbackGeos.keycaps.children.length > 0) {
      const child = fallbackGeos.keycaps.children[0]
      if (child.material) {
        child.material = child.material.clone()
      }
      layers.keycaps.group.add(child)
    }
    ensureTopDownKeycapUVs(layers.keycaps.group)
  }

  /**
   * Updates PBR material properties for the Barebones (Case) layer.
   *
   * @param {object} part - Normalized Part descriptor.
   */
  function applyBarebonesMaterials(part) {
    applyBarebonesGeometryVariant(part, layers.barebones.group)
    layers.barebones.group.traverse((child) => {
      if (!child.isMesh || !child.material) return
      forEachMaterial(child.material, (mat) => {
        const matName = (mat.name || '').toLowerCase()
        if (matName.includes('brass_weight') || child.name === 'Brass_Weight_Accent') {
          return
        }
        if (matName.includes('sandwich_standoff') || child.name.includes('Sandwich_Standoff')) {
          return
        }
        if (
          matName.includes('sandwich_plate') ||
          child.name.includes('Sandwich_Top_Plate') ||
          child.name.includes('Sandwich_Bottom_Plate')
        ) {
          mat.opacity = 0.65
          mat.transparent = true
          return
        }
        if (matName.includes('knob') || matName.includes('accent')) {
          mat.color.set(part.accentColor || '#f0b429')
        } else if (matName.includes('plate') || child.name.toLowerCase().includes('plate')) {
          mat.color.set(part.accentColor ? part.accentColor : 0xd8dbe2)
          mat.metalness = 0.35
          mat.roughness = 0.3
          mat.opacity = 0.92
          mat.transparent = true
          mat.needsUpdate = true
        } else {
          mat.color.set(part.color)
          mat.metalness = part.metalness
          mat.roughness = part.roughness
          mat.opacity = part.opacity
          mat.transparent = part.opacity < 1.0
          mat.needsUpdate = true
        }
      })
    })
  }

  /**
   * Updates PBR material properties for the Switches layer.
   *
   * @param {object} part - Normalized Part descriptor.
   */
  function applySwitchesMaterials(part) {
    layers.switches.group.traverse((child) => {
      if (!child.isMesh || !child.material) return
      forEachMaterial(child.material, (mat) => {
        const matName = (mat.name || '').toLowerCase()
        if (matName.includes('stem') || child.name === 'Switch_Stems_Fallback') {
          mat.color.set(part.stemColor || part.accentColor || part.color)
          mat.roughness = Math.max(0.2, part.roughness * 0.7)
        } else {
          mat.color.set(part.color)
          mat.metalness = part.metalness
          mat.roughness = part.roughness
          mat.opacity = part.opacity
          // Color/roughness/metalness/opacity are uniforms. Only toggling
          // `transparent` changes the program, so `needsUpdate` is reserved for
          // that case — setting it unconditionally recompiles a shader per cloned
          // switch material (81 instances), stalling the main thread for seconds.
          const nextTransparent = part.opacity < 1.0
          if (mat.transparent !== nextTransparent) {
            mat.transparent = nextTransparent
            mat.needsUpdate = true
          }
        }
      })
    })
  }

  /**
   * Updates PBR material properties for the Keycaps layer.
   * Supports both solid PBR materials, 4-Zone colorways, and 5-sided dye-sub top-down planar artwork textures.
   *
   * @param {object} part - Normalized Part descriptor.
   * @param {object} [options] - Repaint options.
   * @param {boolean} [options.textureFailed] - Skip the artwork texture and paint plain colourway
   *   colours; used to repaint after that texture failed to load (avoids a retry loop).
   */
  function applyKeycapsMaterials(part, { textureFailed = false } = {}) {
    const spec = normalizePreviewPart('keycaps', part)
    const isLight = isColorLight(spec.color)
    const opacity = Number.isFinite(spec.opacity) ? spec.opacity : spec.isSelected ? 1.0 : 0.42
    const textureUrl = textureFailed ? null : spec.textureUrl || null
    const artMode = spec.artMode || (textureUrl ? 'full' : null)
    const isBlank = spec.id === 'blank' || spec.legendStyle === 'none'
    const legendStyle = spec.legendStyle || (isBlank ? 'none' : 'top')

    if (layers.keycaps.group) {
      ensureTopDownKeycapUVs(layers.keycaps.group)
      let topOverlay = layers.keycaps.group.getObjectByName('Top_Legends_Overlay')
      if (!topOverlay) {
        createTopLegendsOverlay(layers.keycaps.group)
      }
    }

    let texture = null
    if (textureUrl) {
      texture = loadCachedTexture(
        textureUrl,
        {
          flipY: true,
          cache: textureCache,
          onError: () => {
            if (isDisposed) return
            // Stale failure: the user already picked different keycaps, so this
            // texture no longer owns the materials.
            if (currentParts.keycaps?.textureUrl !== textureUrl) return
            // Repaint without the texture so keycaps fall back to their colourway
            // colours; clearing only `map` would leave them flat white.
            applyKeycapsMaterials(currentParts.keycaps, { textureFailed: true })
            requestSingleFrame()
          },
        },
        () => {
          if (isDisposed) return
          if (currentParts.keycaps?.textureUrl === textureUrl) {
            applyKeycapsMaterials(currentParts.keycaps)
            requestSingleFrame()
          }
        }
      )
    }

    const idLower = (spec.id || '').toLowerCase()
    const nameLower = (spec.name || '').toLowerCase()
    const texLower = (textureUrl || '').toLowerCase()
    const isWave =
      idLower.includes('kanagawa') ||
      texLower.includes('kanagawa') ||
      idLower.includes('wave') ||
      nameLower.includes('kanagawa') ||
      nameLower.includes('wave')

    const legendVariant =
      spec.legendVariant ||
      (isWave
        ? 'dark'
        : (!textureUrl && isLight
            ? 'dark'
            : 'light'))

    const is100 = currentLayout === '100'
    const sidePaths = is100 ? LEGEND_SIDE_100_TEXTURE_PATHS : LEGEND_TEXTURE_PATHS
    const legendTextureUrl =
      (part?.hasCustomLegendUrl ? part.legendTextureUrl : null) ||
      (legendVariant === 'dark' ? sidePaths.dark : sidePaths.light)

    let activeLegendTexture = null
    if (!isBlank && legendStyle === 'side') {
      activeLegendTexture = loadCachedTexture(
        legendTextureUrl,
        {
          flipY: false,
          clamp: true,
          cache: textureCache,
          onError: () => {
            if (isDisposed) return
            layers.keycaps?.group?.traverse((child) => {
              if (child.isMesh && child.material && isSideLegendMesh(child)) {
                forEachMaterial(child.material, (mat) => {
                  mat.map = null
                  mat.needsUpdate = true
                })
              }
            })
            requestSingleFrame()
          },
        },
        () => {
          if (isDisposed) return
          if (currentParts.keycaps?.id === spec.id) {
            applyKeycapsMaterials(currentParts.keycaps)
            requestSingleFrame()
          }
        }
      )
    }

    let activeTopLegendTexture = null
    if (legendStyle === 'top') {
      const topUrl = TOP_LEGEND_TEXTURE_PATHS[currentLayout] || TOP_LEGEND_TEXTURE_PATHS['75']
      activeTopLegendTexture = loadCachedTexture(
        topUrl,
        {
          flipY: true,
          cache: textureCache,
          onError: () => {
            if (isDisposed) return
            layers.keycaps?.group?.traverse((child) => {
              if (
                child.isMesh &&
                child.material &&
                (child.userData?.isTopLegend || child.name === 'Top_Legends_Overlay')
              ) {
                forEachMaterial(child.material, (mat) => {
                  mat.map = null
                  mat.needsUpdate = true
                })
              }
            })
            requestSingleFrame()
          },
        },
        () => {
          if (isDisposed) return
          if (currentParts.keycaps?.id === spec.id) {
            applyKeycapsMaterials(currentParts.keycaps)
            requestSingleFrame()
          }
        }
      )
    }

    const colorway = !texture ? getKeycapColorway(spec) : null

    layers.keycaps.group.traverse((child) => {
      if (!child.isMesh || !child.material) return
      forEachMaterial(child.material, (mat) => {
        const matName = (mat.name || '').toLowerCase()
        const isDecal = isSideLegendMesh(child, mat)

        const isAccentKey =
          matName.includes('knob') ||
          matName.includes('dark') ||
          matName.includes('black') ||
          matName.includes('accent')

        if (child.userData?.isTopLegend || child.name === 'Top_Legends_Overlay') {
          const showTopLegends = legendStyle === 'top'
          mat.visible = showTopLegends
          if (!showTopLegends) {
            mat.needsUpdate = true
            return
          }

          if (activeTopLegendTexture) {
            mat.map = activeTopLegendTexture
          }
          const isLightAlphas = isColorLight(colorway ? colorway.alphas : spec.color)
          const topLegendColor = spec.id === 'dshot' ? '#1e1b4b' : (isLightAlphas ? '#0f172a' : '#f8fafc')
          mat.color.set(topLegendColor)
          mat.opacity = 1.0
          mat.transparent = true
          mat.depthWrite = false
          mat.depthTest = true
          mat.polygonOffset = true
          mat.polygonOffsetFactor = -3
          mat.polygonOffsetUnits = -3
          mat.needsUpdate = true
          return
        }

        if (isDecal) {
          // Reset position.y = 0 so side-printed decals sit flush on front/side skirt
          if (child && child.position) {
            child.position.y = 0
            child.renderOrder = 20
          }

          const showSideDecals = legendStyle === 'side'
          mat.visible = showSideDecals
          if (!showSideDecals) {
            mat.needsUpdate = true
            return
          }

          if (activeLegendTexture) {
            mat.map = activeLegendTexture
            mat.color.set('#ffffff')
          } else {
            // Side-printed mode: high contrast color
            const isLightAlphas = isColorLight(colorway ? colorway.alphas : spec.color)
            const isDarkArt = idLower === 'theme' || idLower.includes('cat')
            const sideColor = (spec.id === 'kanagawa' || (isLightAlphas && !isDarkArt)) ? '#1e293b' : '#ffffff'
            mat.color.set(sideColor)
          }

          if (mat.emissive) {
            mat.emissive.set('#000000')
            mat.emissiveIntensity = 0
            mat.emissiveMap = null
          }
          mat.opacity = 1.0
          mat.transparent = true
          mat.depthWrite = false
          mat.depthTest = true
          mat.polygonOffset = true
          mat.polygonOffsetFactor = -2
          mat.polygonOffsetUnits = -2
          mat.needsUpdate = true
          return
        }

        if (texture) {
          if (artMode === 'framed' && isAccentKey) {
            mat.map = null
            mat.color.set(spec.accentColor || spec.color)
          } else {
            mat.map = texture
            mat.color.set(0xffffff)
          }
          mat.roughness = Number.isFinite(spec.roughness) ? spec.roughness : 0.65
          mat.metalness = Number.isFinite(spec.metalness) ? spec.metalness : 0.05
          mat.opacity = opacity
          mat.transparent = opacity < 1.0
          mat.needsUpdate = true
        } else {
          mat.map = null
          if (colorway) {
            if (isAccentKey) {
              mat.color.set(colorway.accents)
            } else if (matName.includes('middle gray')) {
              mat.color.set(colorway.spacebar || colorway.modifiers)
            } else if (
              matName.includes('dark gray') ||
              matName.includes('black gray') ||
              matName.includes('black')
            ) {
              mat.color.set(colorway.modifiers)
            } else {
              mat.color.set(colorway.alphas)
            }
          } else {
            if (isAccentKey) {
              mat.color.set(spec.accentColor || spec.color)
            } else {
              mat.color.set(spec.color)
            }
          }
          mat.roughness = spec.roughness
          mat.metalness = spec.metalness
          mat.opacity = opacity
          mat.transparent = opacity < 1.0
          mat.needsUpdate = true
        }
      })
    })

    requestSingleFrame()
  }

  // Initial application of default material values
  applyBarebonesMaterials(currentParts.barebones)
  applySwitchesMaterials(currentParts.switches)
  applyKeycapsMaterials(currentParts.keycaps)

  /**
   * Ingests a loaded GLTF scene hierarchy, swapping procedural fallback layers
   * for high-fidelity Blender meshes while disposing unused internal meshes (REV-6).
   *
   * @param {object} gltf - Loaded GLTF scene container.
   */
  function ingestGltfScene(gltf) {
    if (isDisposed) {
      disposeObject(gltf.scene)
      return
    }

    let glbCase = null
    let glbPlate = null
    let glbKeycaps = null
    let glbSwitch = null

    gltf.scene.traverse((child) => {
      if (child.name === 'Layer_Case') glbCase = child
      if (child.name === 'Layer_Plate') glbPlate = child
      if (child.name === 'Layer_Keycaps') glbKeycaps = child
      if (child.name === 'Switch_Prototype') glbSwitch = child
    })

    // Dispose unused internal GLTF meshes (PCB, Foam, etc.) per ADR-0008 & REV-6
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return
      let cur = child
      let retained = false
      while (cur && cur !== gltf.scene) {
        if (
          cur.name === 'Layer_Case' ||
          cur.name === 'Layer_Plate' ||
          cur.name === 'Layer_Keycaps' ||
          cur.name === 'Switch_Prototype'
        ) {
          retained = true
          break
        }
        cur = cur.parent
      }
      if (!retained) {
        if (child.geometry) child.geometry.dispose?.()
        if (child.material) {
          forEachMaterial(child.material, (mat) => {
            mat.map?.dispose?.()
            mat.emissiveMap?.dispose?.()
            mat.normalMap?.dispose?.()
            mat.roughnessMap?.dispose?.()
            mat.metalnessMap?.dispose?.()
            mat.dispose?.()
          })
        }
      }
    })

    // Swap Barebones (Case + Plate housing)
    if ((glbCase || glbPlate) && layers.barebones.group) {
      while (layers.barebones.group.children.length > 0) {
        const old = layers.barebones.group.children[0]
        layers.barebones.group.remove(old)
        disposeObject(old)
      }
      if (glbCase) layers.barebones.group.add(glbCase)
      if (glbPlate) layers.barebones.group.add(glbPlate)
      applyBarebonesMaterials(currentParts.barebones)
    }

    // Swap Keycaps
    if (glbKeycaps && layers.keycaps.group) {
      while (layers.keycaps.group.children.length > 0) {
        const old = layers.keycaps.group.children[0]
        layers.keycaps.group.remove(old)
        disposeObject(old)
      }
      glbKeycaps.traverse((child) => {
        if (child.isMesh && child.material) {
          let isDecal = isSideLegendMesh(child)
          forEachMaterial(child.material, (mat) => {
            if (isSideLegendMesh(child, mat)) {
              mat.transparent = true
              mat.depthWrite = false
              mat.depthTest = true
              mat.polygonOffset = true
              mat.polygonOffsetFactor = -2
              mat.polygonOffsetUnits = -2
              isDecal = true
            }
          })
          if (isDecal && child !== glbKeycaps && child.name !== 'Layer_Keycaps') {
            child.renderOrder = 20
            child.position.y = 0
          }
        }
      })
      layers.keycaps.group.add(glbKeycaps)
      const bounds = ensureTopDownKeycapUVs(layers.keycaps.group)
      createTopLegendsOverlay(layers.keycaps.group, bounds)
      applyKeycapsMaterials(currentParts.keycaps)
    }

    // Swap Switches (dynamic instance matrix distributed across active layout positions)
    if (glbSwitch && layers.switches.group) {
      const positions = SWITCH_LAYOUTS[currentLayout] || SWITCH_LAYOUT_POSITIONS
      createSwitchMatrixInstancesForLayout(glbSwitch, layers.switches.group, positions)
      applySwitchesMaterials(currentParts.switches)
    }

    mode = 'hybrid'
    if (typeof onLoad === 'function') {
      onLoad({ fallback: false })
    }
    requestSingleFrame()
  }

  const handleGltfLoaded = ingestGltfScene

  /**
   * Procedural fallback rebuild when GLTF load fails or is disabled.
   */
  function fallbackToProcedural() {
    mode = 'procedural'
    const positions = SWITCH_LAYOUTS[currentLayout] || SWITCH_LAYOUT_POSITIONS
    rebuildProceduralSwitches(layers.switches.group, positions)
    applyBarebonesMaterials(currentParts.barebones)
    applySwitchesMaterials(currentParts.switches)
    applyKeycapsMaterials(currentParts.keycaps)
    requestSingleFrame()
  }

  /**
   * Loads layout-specific GLB model using caching and parses into scene.
   *
   * @param {string} layoutCode - Layout code ('60', '75', '100').
   * @returns {Promise<object|null>}
   */
  function parseGlbBuffer(buffer, layoutCode) {
    const targetUrl =
      layoutCode === '75' && modelUrl
        ? modelUrl
        : LAYOUT_MODELS[layoutCode] || defaultModelUrl

    return new Promise((resolve) => {
      const handleParseError = (err) => {
        if (isDisposed || layoutCode !== currentLayout) {
          return resolve(null)
        }
        console.warn(`Build preview GLTF parse notice (${targetUrl}):`, err)
        fallbackToProcedural()
        if (typeof onLoad === 'function') {
          onLoad({ fallback: true, error: err })
        }
        resolve(null)
      }

      try {
        const loader = new GLTFLoader()
        loader.parse(
          buffer.slice(0),
          '',
          (gltf) => {
            if (isDisposed || layoutCode !== currentLayout) {
              disposeObject(gltf.scene)
              return resolve(null)
            }
            ingestGltfScene(gltf)
            resolve(gltf)
          },
          handleParseError
        )
      } catch (err) {
        handleParseError(err)
      }
    })
  }

  async function loadLayoutGlb(layoutCode) {
    if (isDisposed) return null
    const targetUrl =
      layoutCode === '75' && modelUrl
        ? modelUrl
        : LAYOUT_MODELS[layoutCode] || defaultModelUrl

    // 1. Check in-memory binary cache
    if (glbCache.has(layoutCode)) {
      const cachedBuffer = glbCache.get(layoutCode)
      return parseGlbBuffer(cachedBuffer, layoutCode)
    }

    // 2. Fetch over network with in-flight deduplication
    let fetchPromise = inFlightGlbPromises.get(layoutCode)
    if (!fetchPromise) {
      fetchPromise = (async () => {
        const res = await fetch(targetUrl)
        if (!res.ok) {
          throw new Error(`Failed to fetch GLB (${targetUrl}): HTTP ${res.status}`)
        }
        const contentType = res.headers?.get?.('content-type') || ''
        if (contentType.includes('text/html')) {
          throw new Error(`Invalid content-type for GLB (${targetUrl}): ${contentType}`)
        }
        return await res.arrayBuffer()
      })()
      inFlightGlbPromises.set(layoutCode, fetchPromise)
      fetchPromise
        .finally(() => {
          inFlightGlbPromises.delete(layoutCode)
        })
        .catch(() => {})
    }

    let buffer
    try {
      buffer = await fetchPromise
    } catch (err) {
      if (isDisposed || layoutCode !== currentLayout) {
        return null
      }
      console.warn(`Build preview GLTF load notice (${targetUrl}):`, err)
      fallbackToProcedural()
      if (typeof onLoad === 'function') {
        onLoad({ fallback: true, error: err })
      }
      return null
    }

    if (isDisposed || layoutCode !== currentLayout) {
      return null
    }
    glbCache.set(layoutCode, buffer)

    return parseGlbBuffer(buffer, layoutCode)
  }

  // 8. Asynchronously Load GLTF Asset if enabled and in browser environment
  if (loadGlb && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    loadLayoutGlb(currentLayout)
  }

  /**
   * Checks whether the preview scene is actively in motion.
   * Motion includes active OrbitControls damping, layer drop animations,
   * or smooth layer explosion/combination interpolation.
   *
   * @returns {boolean} True if animation frame loop must run.
   */
  function isAnimating() {
    if (activeControlFrames > 0) return true
    if (Math.abs(currentExplosionFactor - targetExplosionFactor) > 0.001) return true
    for (const id of BUILD_PREVIEW_LAYER_IDS) {
      if (layers[id].dropProgress < 1) return true
    }
    return false
  }

  /**
   * Advances animations and renders by dt seconds.
   *
   * @param {number} [dt=1/60] - Delta time in seconds.
   */
  function step(dt = 1 / 60) {
    if (isDisposed) return
    const clampedDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 2.0)) : 1 / 60

    // Smoothly interpolate explosion factor toward target (exploded = 1, combined = 0)
    if (reducedMotion) {
      currentExplosionFactor = targetExplosionFactor
    } else {
      const diff = targetExplosionFactor - currentExplosionFactor
      if (Math.abs(diff) <= 0.001) {
        currentExplosionFactor = targetExplosionFactor
      } else {
        const stepAmount = clampedDt / 0.3
        if (Math.abs(diff) <= stepAmount) {
          currentExplosionFactor = targetExplosionFactor
        } else {
          currentExplosionFactor += Math.sign(diff) * stepAmount
        }
      }
    }

    for (const id of BUILD_PREVIEW_LAYER_IDS) {
      const layer = layers[id]
      if (layer.dropProgress < 1) {
        if (reducedMotion) {
          layer.dropProgress = 1
        } else {
          layer.dropProgress = Math.min(1, layer.dropProgress + clampedDt / 0.42)
        }
      }
      const restingY = currentExplosionFactor * layer.explodedY
      const offset = computeDropOffset(layer.dropProgress, { reducedMotion, dropHeight: 1.65 })
      layer.group.position.y = restingY + offset
    }

    if (controls && typeof controls.update === 'function') {
      controls.update()
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  /**
   * Renders a single animation frame on demand without recursive controls updating (REV-1).
   */
  function requestSingleFrame() {
    if (isDisposed || isPausedState) return
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  /**
   * Continuous animation loop that runs only while isAnimating() is true.
   * When static, settles to 0% CPU/GPU and pauses requestAnimationFrame.
   */
  function renderLoop() {
    if (isDisposed || isPausedState || reducedMotion) {
      animId = null
      return
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const rawDt = (now - lastFrameTime) / 1000
    const slowFrame = now - lastFrameTime > 120
    const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(0.1, rawDt)) : 1 / 60
    lastFrameTime = now

    // Software-rendered or very weak GPUs can take hundreds of milliseconds per
    // frame, which stretches a 0.42s drop animation into a multi-second main-thread
    // stall. Snap to the settled state instead of animating when a frame is slow.
    if (slowFrame) {
      currentExplosionFactor = targetExplosionFactor
      for (const id of BUILD_PREVIEW_LAYER_IDS) {
        layers[id].dropProgress = 1
      }
    }

    if (activeControlFrames > 0) {
      activeControlFrames--
    }

    step(dt)

    if (isAnimating()) {
      if (typeof requestAnimationFrame === 'function') {
        animId = requestAnimationFrame(renderLoop)
      }
    } else {
      // Settled to static state: render one clean final frame and sleep (0% CPU/GPU)
      requestSingleFrame()
      animId = null
    }
  }

  /**
   * Starts the continuous requestAnimationFrame loop.
   */
  function startAnimationLoop() {
    if (animId !== null || isDisposed || isPausedState || reducedMotion) return
    lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (typeof requestAnimationFrame === 'function') {
      animId = requestAnimationFrame(renderLoop)
    }
  }

  if (renderer && !reducedMotion) {
    startAnimationLoop()
  } else {
    requestSingleFrame()
  }

  /**
   * Window resize handler updating projection matrix, renderer buffer, and camera aspect.
   */
  const handleResize = () => {
    if (!canvas || !renderer || isDisposed) return
    const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)
    const height = canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600)
    if (height > 0 && width > 0 && camera) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    requestSingleFrame()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize, { passive: true })
  }

  /**
   * WebGL context lost event handler.
   */
  const handleContextLost = (event) => {
    event?.preventDefault?.()
    contextLost = true
    isPausedState = true
    if (animId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animId)
      animId = null
    }
    if (typeof onError === 'function') {
      onError(new Error('WebGL context lost.'))
    }
  }

  const handleContextRestored = () => {
    contextLost = false
    isPausedState = false
    if (typeof onContextRestored === 'function') {
      onContextRestored()
    }
    requestSingleFrame()
  }

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      isPausedState = true
      if (animId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animId)
        animId = null
      }
    } else {
      isPausedState = false
      requestSingleFrame()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  if (canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
  }

  /**
   * Sets the camera preset view.
   *
   * @param {'isometric'|'top'|'side'|'custom'} preset - Target preset name.
   */
  function setCameraPreset(preset) {
    if (preset === 'custom') {
      currentPreset = 'custom'
      if (typeof onCameraPresetChange === 'function') {
        onCameraPresetChange('custom')
      }
      return
    }
    const config = CAMERA_PRESETS[preset] || CAMERA_PRESETS.isometric
    currentPreset = CAMERA_PRESETS[preset] ? preset : 'isometric'

    camera.position.set(config.pos[0], config.pos[1], config.pos[2])
    if (controls) {
      controls.target.set(config.target[0], config.target[1], config.target[2])
      controls.update()
    } else {
      camera.lookAt(config.target[0], config.target[1], config.target[2])
    }
    if (typeof onCameraPresetChange === 'function') {
      onCameraPresetChange(currentPreset)
    }
    requestSingleFrame()
  }

  /**
   * Updates an individual layer Part, comparing against previous state
   * and initiating drop animation only when changes occur.
   *
   * @param {string} layerId - Layer identifier ('barebones', 'case', 'switches', 'keycaps').
   * @param {object|null} partRaw - Incoming Part descriptor.
   * @param {object} [options={}] - Motion options.
   * @param {boolean} [options.animate=true] - Whether to animate the layer drop.
   */
  function updateLayerPart(layerId, partRaw, { animate = true } = {}) {
    if (isDisposed) return
    const normSlot = layerId === 'case' ? 'barebones' : layerId
    if (!BUILD_PREVIEW_LAYER_IDS.includes(normSlot)) return

    const normalized = normalizePreviewPart(normSlot, partRaw)
    const prev = currentParts[normSlot]

    // Check if the visual properties of this layer changed
    const hasChanged =
      !prev ||
      normalized.id !== prev.id ||
      normalized.isSelected !== prev.isSelected ||
      normalized.color !== prev.color ||
      normalized.accentColor !== prev.accentColor ||
      normalized.stemColor !== prev.stemColor ||
      normalized.metalness !== prev.metalness ||
      normalized.roughness !== prev.roughness ||
      normalized.opacity !== prev.opacity ||
      normalized.textureUrl !== prev.textureUrl ||
      normalized.artworkUrl !== prev.artworkUrl ||
      normalized.artMode !== prev.artMode ||
      normalized.legendVariant !== prev.legendVariant ||
      normalized.legendTextureUrl !== prev.legendTextureUrl ||
      normalized.legendStyle !== prev.legendStyle

    if (!hasChanged) return

    currentParts[normSlot] = normalized

    // Update layer materials in-place
    if (normSlot === 'barebones') {
      applyBarebonesMaterials(normalized)
    } else if (normSlot === 'switches') {
      applySwitchesMaterials(normalized)
    } else if (normSlot === 'keycaps') {
      applyKeycapsMaterials(normalized)
    }

    // Trigger vertical drop animation for this changed layer only when selected (REV-9)
    if (normalized.isSelected && animate && !reducedMotion) {
      layers[normSlot].dropProgress = 0
    } else {
      layers[normSlot].dropProgress = 1
      layers[normSlot].group.position.y = currentExplosionFactor * layers[normSlot].explodedY
    }

    if (reducedMotion || isPausedState) {
      requestSingleFrame()
    } else {
      startAnimationLoop()
    }
  }

  /**
   * Synchronizes the full 3-layer Build preview state from reactive store inputs.
   *
   * @param {object} [state={}] - Build state object.
   * @param {object|null} [state.barebones] - Barebones kit Part.
   * @param {object|null} [state.case] - Case Part alias.
   * @param {object|null} [state.switches] - Switches Part.
   * @param {object|null} [state.keycaps] - Keycaps Part.
   * @param {object} [options={}] - Transition options.
   * @param {boolean} [options.animate=true] - Whether to drop-animate changed layers.
   */
  function syncBuildState(
    { barebones, case: casePart, switches, keycaps } = {},
    { animate = true } = {}
  ) {
    if (isDisposed) return
    const effectiveBarebones = barebones !== undefined ? barebones : casePart
    if (effectiveBarebones !== undefined) {
      updateLayerPart('barebones', effectiveBarebones, { animate })
    }
    if (switches !== undefined) {
      updateLayerPart('switches', switches, { animate })
    }
    if (keycaps !== undefined) {
      updateLayerPart('keycaps', keycaps, { animate })
    }
  }

  /**
   * Sets target explosion view (true = constant 3-layer exploded view, false = flush combined view).
   *
   * @param {boolean} exploded - Target explosion state.
   * @param {object} [options={}] - Transition options.
   * @param {boolean} [options.animate=true] - Whether to smoothly animate layer separation.
   */
  function setExploded(exploded, { animate = true } = {}) {
    targetExplosionFactor = exploded ? 1.0 : 0.0
    if (reducedMotion || !animate) {
      currentExplosionFactor = targetExplosionFactor
      for (const id of BUILD_PREVIEW_LAYER_IDS) {
        const layer = layers[id]
        const restingY = currentExplosionFactor * layer.explodedY
        const offset = computeDropOffset(layer.dropProgress, { reducedMotion, dropHeight: 1.65 })
        layer.group.position.y = restingY + offset
      }
      requestSingleFrame()
    } else {
      startAnimationLoop()
    }
  }

  /**
   * Returns current target explosion view state (true if exploded, false if combined).
   *
   * @returns {boolean} True if exploded.
   */
  function isExploded() {
    return targetExplosionFactor > 0.5
  }

  /**
   * Switches the active keyboard layout ('60', '75', '100').
   * Re-scales scene, loads or retrieves cached GLB asset, and updates switch matrix.
   *
   * @param {'60'|'75'|'100'|string} layoutCode - Target layout code.
   * @returns {Promise<boolean>}
   */
  async function setLayout(layoutCode) {
    if (isDisposed) return false
    const targetLayout = normalizeLayoutCode(layoutCode)

    currentLayout = targetLayout
    applyLayoutScale(currentLayout)

    if (loadGlb && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      await loadLayoutGlb(currentLayout)
    } else {
      fallbackToProcedural()
    }
    applyKeycapsMaterials(currentParts.keycaps)
    requestSingleFrame()
    return true
  }

  /**
   * Returns the current active keyboard layout code ('60', '75', '100').
   *
   * @returns {'60'|'75'|'100'} Current layout code.
   */
  function getLayout() {
    return currentLayout
  }

  // Controller Interface
  return {
    /**
     * Checks if a WebGLRenderer instance is active.
     *
     * @returns {boolean} True if renderer exists.
     */
    hasRenderer() {
      return Boolean(renderer)
    },

    /**
     * Renders a single frame immediately.
     */
    renderFrame() {
      requestSingleFrame()
    },

    /**
     * Exposes Three.js scene container for inspection.
     *
     * @returns {THREE.Scene}
     */
    getScene() {
      return scene
    },

    /**
     * Exposes layer objects for inspection.
     *
     * @returns {Record<string, object>}
     */
    getLayers() {
      return layers
    },

    /**
     * Switches the active keyboard layout form-factor ('60', '75', '100').
     */
    setLayout,

    /**
     * Retrieves the current keyboard layout form-factor code.
     */
    getLayout,

    /**
     * Synchronizes full reactive build state across the 3 visual layers.
     */
    syncBuildState,

    /**
     * Updates an individual layer part with material updates and drop animation.
     */
    updateLayerPart,

    /**
     * Sets target exploded (true) or flush combined (false) view.
     */
    setExploded,

    /**
     * Returns whether preview is in exploded view mode.
     */
    isExploded,

    /**
     * Sets the active camera preset view ('isometric', 'top', 'side').
     */
    setCameraPreset,

    /**
     * Resets camera back to default isometric viewpoint.
     */
    resetCamera() {
      setCameraPreset('isometric')
    },

    /**
     * Gets the active camera preset name ('isometric', 'top', 'side', or 'custom').
     *
     * @returns {string} Camera preset name.
     */
    getCameraPreset() {
      return currentPreset
    },

    /**
     * Toggles reduced motion preference.
     * Snaps drop progress immediately to settled resting positions under reduced motion.
     *
     * @param {boolean} isReduced - Whether user prefers reduced motion.
     */
    setReducedMotion(isReduced) {
      if (isDisposed) return
      reducedMotion = Boolean(isReduced)
      if (controls) {
        controls.enableDamping = !reducedMotion
      }
      if (reducedMotion) {
        if (animId !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(animId)
          animId = null
        }
        currentExplosionFactor = targetExplosionFactor
        for (const id of BUILD_PREVIEW_LAYER_IDS) {
          layers[id].dropProgress = 1
          layers[id].group.position.y = currentExplosionFactor * layers[id].explodedY
        }
        requestSingleFrame()
      } else {
        if (!isPausedState && isAnimating()) {
          startAnimationLoop()
        }
      }
    },

    /**
     * Advances drop progress and renders frame.
     */
    step,

    /**
     * Retrieves current visual and animation states for all 3 layers.
     *
     * @returns {object} Layer states keyed by layer ID.
     */
    getLayerStates() {
      return {
        barebones: {
          id: 'barebones',
          slot: 'barebones',
          name: 'Base (Case)',
          status: currentParts.barebones?.isSelected ? 'configured' : 'empty',
          dropProgress: layers.barebones.dropProgress,
          baseY: layers.barebones.baseY,
          explodedY: layers.barebones.explodedY,
          restingY: currentExplosionFactor * layers.barebones.explodedY,
          part: currentParts.barebones,
        },
        switches: {
          id: 'switches',
          slot: 'switches',
          name: 'Switches',
          status: currentParts.switches?.isSelected ? 'configured' : 'empty',
          dropProgress: layers.switches.dropProgress,
          baseY: layers.switches.baseY,
          explodedY: layers.switches.explodedY,
          restingY: currentExplosionFactor * layers.switches.explodedY,
          part: currentParts.switches,
        },
        keycaps: {
          id: 'keycaps',
          slot: 'keycaps',
          name: 'Keycaps',
          status: currentParts.keycaps?.isSelected ? 'configured' : 'empty',
          dropProgress: layers.keycaps.dropProgress,
          baseY: layers.keycaps.baseY,
          explodedY: layers.keycaps.explodedY,
          restingY: currentExplosionFactor * layers.keycaps.explodedY,
          part: currentParts.keycaps,
        },
      }
    },

    /**
     * Pauses the animation loop (e.g. when hidden or off-screen).
     */
    pause() {
      isPausedState = true
      if (animId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animId)
        animId = null
      }
    },

    /**
     * Resumes the animation loop when visible.
     */
    resume() {
      isPausedState = false
      if (!reducedMotion && isAnimating()) {
        startAnimationLoop()
      } else {
        requestSingleFrame()
      }
    },

    /**
     * Checks whether animation loop is currently paused.
     *
     * @returns {boolean} True if paused.
     */
    isPaused() {
      return isPausedState
    },

    /**
     * Returns scene geometry statistics and active draw metrics.
     *
     * @returns {{
     *   triangles: number,
     *   drawCalls: number,
     *   activeLayers: number,
     *   mode: string,
     *   cameraPreset: string,
     *   isPaused: boolean,
     *   reducedMotion: boolean,
     *   isExploded: boolean,
     *   layout: string
     * }}
     */
    /**
     * Checks whether WebGL rendering context is currently lost.
     *
     * @returns {boolean} True if context lost.
     */
    isContextLost() {
      return contextLost
    },

    /**
     * Checks whether high-fidelity GLB geometry is currently loaded.
     *
     * @returns {boolean} True if in hybrid GLB mode.
     */
    isGlbLoaded() {
      return mode === 'hybrid'
    },

    /**
     * Ingests a pre-parsed or synthetic glTF object directly into scene.
     */
    ingestGltfScene,

    getStats() {
      let triangles = 0
      let drawCalls = 0

      rootGroup.traverse((child) => {
        if (child.isMesh) {
          let visible = child.visible
          let p = child.parent
          while (visible && p && p !== scene) {
            if (p.visible === false) visible = false
            p = p.parent
          }
          if (!visible) return

          const tri = countGeometryTriangles(child.geometry)
          if (child.isInstancedMesh && child.count) {
            triangles += tri * child.count
            drawCalls += 1
          } else {
            triangles += tri
            const matCount = Array.isArray(child.material) ? child.material.length : 1
            drawCalls += matCount
          }
        }
      })

      return {
        triangles,
        drawCalls,
        activeLayers: 3,
        mode,
        cameraPreset: currentPreset,
        isPaused: isPausedState,
        reducedMotion,
        isExploded: isExploded(),
        layout: currentLayout,
      }
    },

    /**
     * Completely frees GPU buffers, geometries, materials, textures,
     * event listeners, and animation timers.
     */
    dispose() {
      if (isDisposed) return
      isDisposed = true

      if (animId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animId)
        animId = null
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize)
      }

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }

      if (canvas && typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored)
        delete canvas.__sceneInstance
      }

      rootGroup.traverse((child) => {
        if (child.isInstancedMesh && typeof child.dispose === 'function') {
          child.dispose()
        }
      })

      textureCache.clear()

      if (controls) {
        if (typeof controls.removeEventListener === 'function') {
          controls.removeEventListener('start', handleControlsStart)
          controls.removeEventListener('change', handleControlsChange)
        }
        if (typeof controls.dispose === 'function') {
          controls.dispose()
        }
        controls = null
      }

      disposeObject(scene)

      if (pmremGenerator && typeof pmremGenerator.dispose === 'function') {
        pmremGenerator.dispose()
        pmremGenerator = null
      }

      if (envRenderTarget && typeof envRenderTarget.dispose === 'function') {
        envRenderTarget.dispose()
        envRenderTarget = null
      }

      if (renderer) {
        if (typeof renderer.forceContextLoss === 'function') {
          renderer.forceContextLoss()
        }
        if (typeof renderer.dispose === 'function') {
          renderer.dispose()
        }
        renderer = null
      }
    },

    // Internal references for inspection, testing, and debugging
    _scene: scene,
    _rootGroup: rootGroup,
    _layers: layers,
  }
}
