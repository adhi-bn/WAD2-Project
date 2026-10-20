/**
 * @fileoverview 3D Exploded Keyboard Anatomy Scene engine.
 * Renders a 6-layer physical breakdown (Keycaps, Switches, Plate, PCB, Foam, Case)
 * driven by scroll progress with interactive layer highlighting, WebGL lifecycle
 * management, and resilient procedural fallback per ADR-0003.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SWITCH_LAYOUT_POSITIONS, KEYBOARD_DIMENSIONS } from './keyboardSwitchLayout.js'

/**
 * Module-level reusable Three.js color instances to prevent per-frame allocations during render loop and RGB updates.
 */
const RENDER_HUE_COLOR = new THREE.Color()
const RGB_RESOLVE_COLOR = new THREE.Color()

/**
 * 6 physical layers in strict top-to-bottom order for the 3D exploded keyboard view.
 *
 * @type {ReadonlyArray<{
 *   id: string,
 *   nodeName: string,
 *   label: string,
 *   partCategory: string,
 *   isBarebonesInternals: boolean,
 *   yOffset: number,
 *   color: string,
 *   accentColor?: string,
 *   description: string
 * }>}
 */
export const ANATOMY_LAYERS = Object.freeze([
  {
    id: 'keycaps',
    nodeName: 'Layer_Keycaps',
    label: 'Keycaps',
    partCategory: 'Keycaps',
    isBarebonesInternals: false,
    yOffset: 0.085,
    color: '#2B303C',
    accentColor: '#F0B429',
    description: 'Sculpted PBT keycaps in a 75% layout with accent novelty keys.',
  },
  {
    id: 'switches',
    nodeName: 'Layer_Switches',
    label: '5-pin Switches',
    partCategory: 'Switches',
    isBarebonesInternals: false,
    yOffset: 0.052,
    color: '#D8CFC2',
    accentColor: '#D9468F',
    description: '81 hot-swap 5-pin mechanical switches instanced across the matrix.',
  },
  {
    id: 'plate',
    nodeName: 'Layer_Plate',
    label: 'Plate',
    partCategory: 'Barebones kit',
    isBarebonesInternals: true,
    yOffset: 0.022,
    color: '#E6E9F0',
    description: 'Slotted polycarbonate positioning plate stabilizing every switch.',
  },
  {
    id: 'pcb',
    nodeName: 'Layer_PCB',
    label: 'PCB',
    partCategory: 'Barebones kit',
    isBarebonesInternals: true,
    yOffset: -0.012,
    color: '#115e38',
    accentColor: '#d4af37',
    description: 'Single-key slotted hot-swap PCB with ENIG gold contact pads.',
  },
  {
    id: 'foam',
    nodeName: 'Layer_Foam',
    label: 'Foam',
    partCategory: 'Barebones kit',
    isBarebonesInternals: true,
    yOffset: -0.044,
    color: '#dfd3c3',
    accentColor: '#8b5cf6',
    description: 'Multi-layer gasket acoustic stack: PORON plate cotton, IXPE switch underpad, PET film, and bottom case cotton.',
  },
  {
    id: 'case',
    nodeName: 'Layer_Case',
    label: 'Case',
    partCategory: 'Barebones kit',
    isBarebonesInternals: true,
    yOffset: -0.082,
    color: '#12151C',
    description: 'Gasket-mounted top frame, rotary encoder knob, and weighted bottom enclosure.',
  },
])

/**
 * Layer IDs bundled together inside the Barebones kit.
 *
 * @type {ReadonlyArray<string>}
 */
export const BAREBONES_BUNDLED_LAYER_IDS = Object.freeze(['plate', 'pcb', 'foam', 'case'])

/**
 * Safely checks WebGL/WebGL2 context availability in the current environment.
 * Gracefully returns false in jsdom or headless environments where WebGL is unavailable.
 *
 * @param {Document|null} [doc=document] - Document context to create test canvas from.
 * @returns {boolean} True if WebGL or WebGL2 context can be acquired, false otherwise.
 */
export function isWebGLAvailable(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || typeof doc.createElement !== 'function') return false
  try {
    const canvas = doc.createElement('canvas')
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null)
    if (!win || !win.WebGLRenderingContext) return false
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl)
  } catch {
    return false
  }
}

/**
 * Computes the exploded layer separation factor across the guided part-by-part home journey.
 * 0 at hero top (p <= 0.05), ramps monotonically during the intro card (0.05 to 0.18),
 * HOLDS at ~1 across all 6 layer cards and step cards (0.18 to 0.82), and smoothly reassembles
 * back down to 0.0 at the outro card (0.82 to 0.96).
 *
 * @param {number} scrollProgress - Normalized scroll progress in [0, 1].
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.reducedMotion=false] - Whether reduced motion is active.
 * @param {number} [options.staticFactor=0.72] - Fixed explosion factor under reduced motion.
 * @returns {number} Layer separation factor in [0, 1].
 */
export function computeGuideExplosionFactor(
  scrollProgress,
  { reducedMotion = false, staticFactor = 0.72 } = {}
) {
  if (reducedMotion) {
    return typeof staticFactor === 'number' ? staticFactor : 0.72
  }

  const p = Math.max(0, Math.min(1, Number.isFinite(scrollProgress) ? scrollProgress : 0))

  if (p <= 0.05) {
    return 0.0
  }
  if (p < 0.18) {
    return THREE.MathUtils.smoothstep(p, 0.05, 0.18)
  }
  if (p <= 0.82) {
    return 1.0
  }
  if (p < 0.96) {
    return 1.0 - THREE.MathUtils.smoothstep(p, 0.82, 0.96)
  }
  return 0.0
}

/**
 * Creates a rounded rectangle THREE.Shape with 81 switch hole cutouts and stabilizer cutouts.
 * Transformed into slab-local coordinates centered on plateCenter and corrected for keyboard tilt.
 * Shape coordinates are in the XY plane where X maps to slab local X and Y maps to slab local -Z.
 *
 * @param {number} width - Outer slab width (m).
 * @param {number} depth - Outer slab depth (m).
 * @param {number} [radius=0.003] - Corner fillet radius (m).
 * @returns {import('three').Shape} Shape with 81 switch holes and stabilizer cutouts.
 */
function createSlabShapeWithCutouts(width, depth, radius = 0.003) {
  const plateCenter = KEYBOARD_DIMENSIONS.plateCenter || { x: 0, y: 0.01972, z: -0.00864 }
  const slope = KEYBOARD_DIMENSIONS.slopeRad || 0.0735
  const cosSlope = Math.cos(slope)

  const shape = new THREE.Shape()
  const x = -width / 2
  const y = -depth / 2
  const w = width
  const h = depth
  const r = Math.min(radius, w / 2, h / 2)

  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - r)
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x + r, y + h)
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + r)
  shape.absarc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2, false)

  // 81 circular switch holes (radius 2.0 mm)
  // Cutout positions transformed to slab-local coordinates:
  // local X = pos.x - plateCenter.x
  // local Z = (pos.z - plateCenter.z) / cosSlope
  // shape y = -local Z ensures alignment after rotateX(-PI/2)
  const holeRadius = 0.002
  for (let i = 0; i < SWITCH_LAYOUT_POSITIONS.length; i++) {
    const pos = SWITCH_LAYOUT_POSITIONS[i]
    const lx = pos.x - plateCenter.x
    const lz = (pos.z - plateCenter.z) / cosSlope
    const hole = new THREE.Path()
    hole.absarc(lx, -lz, holeRadius, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }

  // Stabilizer cutouts for wide keys in slab-local frame:
  // Spacebar 6.25u center: x = -0.02119, z = 0.04018 (stabs at +/- 50 mm)
  // Backspace 2u center: x = 0.11574, z = -0.03456 (stabs at +/- 12 mm)
  // Enter 2.25u center: x = 0.11232, z = 0.00281 (stabs at +/- 12 mm)
  // Left Shift 2.25u center: x = -0.13081, z = 0.02150 (stabs at +/- 12 mm)
  const stabKeys = [
    { x: -0.02119, z: 0.04018, offsets: [-0.05, 0.05] },
    { x: 0.11574, z: -0.03456, offsets: [-0.012, 0.012] },
    { x: 0.11232, z: 0.00281, offsets: [-0.012, 0.012] },
    { x: -0.13081, z: 0.0215, offsets: [-0.012, 0.012] },
  ]
  const stabW = 0.0035
  const stabH = 0.0065
  for (let k = 0; k < stabKeys.length; k++) {
    const key = stabKeys[k]
    const cy = -((key.z - plateCenter.z) / cosSlope)
    for (let o = 0; o < key.offsets.length; o++) {
      const cx = key.x - plateCenter.x + key.offsets[o]
      const stabHole = new THREE.Path()
      stabHole.moveTo(cx - stabW / 2, cy - stabH / 2)
      stabHole.lineTo(cx + stabW / 2, cy - stabH / 2)
      stabHole.lineTo(cx + stabW / 2, cy + stabH / 2)
      stabHole.lineTo(cx - stabW / 2, cy + stabH / 2)
      stabHole.closePath()
      shape.holes.push(stabHole)
    }
  }

  return shape
}

/**
 * Synthesizes procedural PCB and gasket acoustic stack foam layers.
 * PCB: Forest green #115e38 slab with 81 switch holes, stabilizer cutouts,
 * 81 gold ENIG hot-swap pads, and MCU header.
 * Foam: Gasket acoustic stack with warm cream PORON plate/case cotton and violet IXPE underpad.
 * Both layers are mounted in tilted parent groups aligned to plateCenter and plate slope.
 *
 * @returns {{
 *   Layer_PCB: import('three').Group,
 *   Layer_Foam: import('three').Group,
 *   pcb: import('three').Group,
 *   foam: import('three').Group
 * }} Created PCB group and Foam group.
 */
export function buildProceduralGasketLayers() {
  const pcbWidth = KEYBOARD_DIMENSIONS.pcbWidth || 0.304
  const pcbDepth = KEYBOARD_DIMENSIONS.pcbDepth || 0.116
  const plateCenter = KEYBOARD_DIMENSIONS.plateCenter || { x: 0, y: 0.01972, z: -0.00864 }
  const slope = KEYBOARD_DIMENSIONS.slopeRad || 0.0735
  const cosSlope = Math.cos(slope)

  // 1. Layer_PCB: forest green #115e38 slab with 81 holes & stabs
  // PCB top positioned at -0.0072 to ensure clean >=0.3mm clearance below plate cotton and pads
  const pcbThickness = 0.0016
  const plateBottomLocalY = -0.0044
  const pcbTopLocalY = -0.0072
  const pcbBottomLocalY = pcbTopLocalY - pcbThickness

  const pcbShape = createSlabShapeWithCutouts(pcbWidth, pcbDepth)
  const pcbGeo = new THREE.ExtrudeGeometry(pcbShape, {
    depth: pcbThickness,
    bevelEnabled: false,
    curveSegments: 8,
  })
  pcbGeo.rotateX(-Math.PI / 2)
  pcbGeo.translate(0, pcbBottomLocalY, 0)

  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0x115e38,
    roughness: 0.35,
    metalness: 0.15,
    name: 'Mat_PCB_ENIG',
  })
  const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat)
  pcbMesh.name = 'Layer_PCB'
  pcbMesh.position.set(plateCenter.x, plateCenter.y, plateCenter.z)
  pcbMesh.rotation.x = -slope
  pcbMesh.castShadow = true
  pcbMesh.receiveShadow = true

  // Gold ENIG details: #d4af37 (metalness 0.85, roughness 0.2)
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.85,
    name: 'Mat_Gold_ENIG',
  })

  // (a) Gold hotswap socket pads on top surface of PCB aligned to each switch position
  const padGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.0003, 10)
  const padsInst = new THREE.InstancedMesh(padGeo, goldMat, 81)
  padsInst.name = 'PCB_Hotswap_Pads'
  const dummy = new THREE.Object3D()
  SWITCH_LAYOUT_POSITIONS.forEach((pos, i) => {
    const lx = pos.x - plateCenter.x
    const lz = (pos.z - plateCenter.z) / cosSlope
    dummy.position.set(lx, pcbTopLocalY + 0.00015, lz)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    padsInst.setMatrixAt(i, dummy.matrix)
  })
  padsInst.instanceMatrix.needsUpdate = true
  pcbMesh.add(padsInst)

  // (c) Top-edge detail: small gold MCU/USB-C header block along top (back) edge of PCB
  const headerGeo = new THREE.BoxGeometry(0.012, 0.003, 0.008)
  const headerMesh = new THREE.Mesh(headerGeo, goldMat)
  headerMesh.name = 'Mesh_PCB_Header'
  headerMesh.position.set(0, pcbTopLocalY + 0.0015, -pcbDepth / 2 + 0.005)
  pcbMesh.add(headerMesh)

  // 2. Layer_Foam: gasket acoustic stack with PORON cotton and IXPE underpad
  const foamGroup = new THREE.Group()
  foamGroup.name = 'Layer_Foam'
  foamGroup.position.set(plateCenter.x, plateCenter.y, plateCenter.z)
  foamGroup.rotation.x = -slope

  const poronMat = new THREE.MeshStandardMaterial({
    color: 0xdfd3c3,
    roughness: 0.95,
    metalness: 0.05,
    name: 'Mat_Foam_PORON',
  })
  const ixpeMat = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    roughness: 0.85,
    metalness: 0.05,
    name: 'Mat_Foam_IXPE',
  })

  // Plate cotton (thickness 0.0018) directly under plate / over PCB (local Y: [-0.0066, -0.0048], clearance >=0.3mm)
  const plateCottonShape = createSlabShapeWithCutouts(pcbWidth * 0.99, pcbDepth * 0.99)
  const plateCottonGeo = new THREE.ExtrudeGeometry(plateCottonShape, {
    depth: 0.0018,
    bevelEnabled: false,
    curveSegments: 8,
  })
  plateCottonGeo.rotateX(-Math.PI / 2)
  plateCottonGeo.translate(0, -0.0066, 0)

  // Bottom case cotton (thickness 0.0022) above case floor (local Y: [-0.0127, -0.0105], clearance >=0.4mm)
  const caseCottonShape = createSlabShapeWithCutouts(pcbWidth * 1.01, pcbDepth * 1.01)
  const caseCottonGeo = new THREE.ExtrudeGeometry(caseCottonShape, {
    depth: 0.0022,
    bevelEnabled: false,
    curveSegments: 8,
  })
  caseCottonGeo.rotateX(-Math.PI / 2)
  caseCottonGeo.translate(0, -0.0127, 0)

  // Merged PORON sheets (plate cotton + case cotton)
  const mergedPoronGeo = BufferGeometryUtils.mergeGeometries([plateCottonGeo, caseCottonGeo]) || plateCottonGeo
  plateCottonGeo.dispose()
  caseCottonGeo.dispose()

  const poronMesh = new THREE.Mesh(mergedPoronGeo, poronMat)
  poronMesh.name = 'Mesh_Plate_Cotton'
  foamGroup.add(poronMesh)

  // IXPE switch underpad (thickness 0.001) under PCB (local Y: [-0.0101, -0.0091], clearance >=0.3mm)
  // REV-11, REV-12: Reuses pcbShape directly to eliminate duplicate path creation
  const ixpeGeo = new THREE.ExtrudeGeometry(pcbShape, {
    depth: 0.001,
    bevelEnabled: false,
    curveSegments: 8,
  })
  ixpeGeo.rotateX(-Math.PI / 2)
  ixpeGeo.translate(0, -0.0101, 0)

  const ixpeMesh = new THREE.Mesh(ixpeGeo, ixpeMat)
  ixpeMesh.name = 'Mesh_IXPE_Underpad'
  foamGroup.add(ixpeMesh)

  return {
    Layer_PCB: pcbMesh,
    Layer_Foam: foamGroup,
    pcb: pcbMesh,
    foam: foamGroup,
  }
}

/**
 * Builds procedural fallback meshes for all 6 keyboard anatomy layers.
 * Guarantees <= 8 draw calls and < 40,000 triangles even if /models/exploded-keyboard.glb is absent.
 *
 * @returns {Record<string, import('three').Group>} Dictionary of 6 layer groups keyed by layer id.
 */
export function buildProceduralFallbackLayers() {
  const dummy = new THREE.Object3D()
  const pcbWidth = KEYBOARD_DIMENSIONS.pcbWidth || 0.304
  const pcbDepth = KEYBOARD_DIMENSIONS.pcbDepth || 0.116
  const caseWidth = KEYBOARD_DIMENSIONS.width || 0.3225
  const caseDepth = KEYBOARD_DIMENSIONS.depth || 0.1383

  // 1. Layer_Keycaps: Instanced keycap blocks (81 instances) + rotary knob cylinder (2 draw calls, ~1,000 triangles)
  const keycapsGroup = new THREE.Group()
  keycapsGroup.name = 'Layer_Keycaps'

  const keycapGeo = new THREE.BoxGeometry(0.017, 0.009, 0.017)
  const keycapMat = new THREE.MeshStandardMaterial({
    color: 0x2b303c,
    roughness: 0.5,
    metalness: 0.1,
    name: 'Mat_Keycaps_Fallback',
  })
  const keycapsInst = new THREE.InstancedMesh(keycapGeo, keycapMat, 81)
  keycapsInst.name = 'Keycaps_Instanced'
  SWITCH_LAYOUT_POSITIONS.forEach((pos, i) => {
    dummy.position.set(pos.x, pos.y + 0.007, pos.z)
    dummy.rotation.x = -KEYBOARD_DIMENSIONS.slopeRad
    dummy.updateMatrix()
    keycapsInst.setMatrixAt(i, dummy.matrix)
  })
  keycapsInst.instanceMatrix.needsUpdate = true
  keycapsGroup.add(keycapsInst)

  // Rotary encoder knob in top-right corner
  const knobGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.012, 16)
  const knobMat = new THREE.MeshStandardMaterial({
    color: 0xf0b429,
    roughness: 0.3,
    metalness: 0.6,
    name: 'Mat_Knob_Fallback',
  })
  const knobMesh = new THREE.Mesh(knobGeo, knobMat)
  knobMesh.name = 'Rotary_Knob'
  knobMesh.position.set(0.143, 0.022, -0.058)
  keycapsGroup.add(knobMesh)

  // 2. Layer_Switches: Instanced switches across 81 matrix positions (1 draw call, ~972 triangles)
  const switchesGroup = new THREE.Group()
  switchesGroup.name = 'Layer_Switches'

  const switchGeo = new THREE.BoxGeometry(0.014, 0.01, 0.014)
  const switchMat = new THREE.MeshStandardMaterial({
    color: 0xd8cfc2,
    roughness: 0.6,
    metalness: 0.1,
    name: 'Mat_Switches_Fallback',
  })
  const switchesInst = new THREE.InstancedMesh(switchGeo, switchMat, 81)
  switchesInst.name = 'Switch_Instances_Fallback'
  SWITCH_LAYOUT_POSITIONS.forEach((pos, i) => {
    dummy.position.set(pos.x, pos.y, pos.z)
    dummy.rotation.x = -KEYBOARD_DIMENSIONS.slopeRad
    dummy.updateMatrix()
    switchesInst.setMatrixAt(i, dummy.matrix)
  })
  switchesInst.instanceMatrix.needsUpdate = true
  switchesGroup.add(switchesInst)

  // 3. Layer_Plate: Translucent slotted polycarbonate plate (1 draw call, 12 triangles)
  const plateGroup = new THREE.Group()
  plateGroup.name = 'Layer_Plate'

  const plateGeo = new THREE.BoxGeometry(
    KEYBOARD_DIMENSIONS.plateWidth || 0.3061,
    0.0016,
    KEYBOARD_DIMENSIONS.plateDepth || 0.1188
  )
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xe6e9f0,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
    emissive: new THREE.Color(0x3b8cff),
    emissiveIntensity: 0.35,
    name: 'Mat_Plate_Fallback',
  })
  const plateMesh = new THREE.Mesh(plateGeo, plateMat)
  plateMesh.name = 'Mesh_Plate'
  plateMesh.position.set(
    KEYBOARD_DIMENSIONS.plateCenter?.x || 0,
    KEYBOARD_DIMENSIONS.plateCenter?.y || 0.01972,
    KEYBOARD_DIMENSIONS.plateCenter?.z || -0.00864
  )
  plateMesh.rotation.x = -KEYBOARD_DIMENSIONS.slopeRad
  plateGroup.add(plateMesh)

  // 4 & 5. Layer_PCB and Layer_Foam from gasket synthesis (3 draw calls, ~60 triangles)
  const gasketLayers = buildProceduralGasketLayers()

  const pcbGroup = new THREE.Group()
  pcbGroup.name = 'Layer_PCB'
  pcbGroup.add(gasketLayers.pcb)

  const foamGroup = new THREE.Group()
  foamGroup.name = 'Layer_Foam'
  foamGroup.add(gasketLayers.foam)

  // 6. Layer_Case: Bottom enclosure tray with perimeter bezel (1 draw call, 12 triangles)
  const caseGroup = new THREE.Group()
  caseGroup.name = 'Layer_Case'

  const caseGeo = new THREE.BoxGeometry(caseWidth, 0.016, caseDepth)
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    roughness: 0.75,
    metalness: 0.25,
    name: 'Mat_Case_Fallback',
  })
  const caseMesh = new THREE.Mesh(caseGeo, caseMat)
  caseMesh.name = 'Mesh_Case'
  caseMesh.position.set(0, 0.006, KEYBOARD_DIMENSIONS.plateCenter?.z || -0.00864)
  caseGroup.add(caseMesh)

  return {
    keycaps: keycapsGroup,
    switches: switchesGroup,
    plate: plateGroup,
    pcb: pcbGroup,
    foam: foamGroup,
    case: caseGroup,
  }
}

/**
 * Executes a callback for each material in a material or material array.
 *
 * @param {import('three').Material|import('three').Material[]} materialOrArray - Material or array of materials.
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
 * Disposes all GPU resources (geometries, materials, textures) on an object and its descendants.
 *
 * @param {import('three').Object3D} obj - Object to dispose.
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
 * Calculates the number of triangles in a geometry.
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
 * Creates 81-instance InstancedMesh objects for each mesh primitive in a switch prototype
 * and attaches them to the target switch group.
 *
 * @param {import('three').Object3D} switchProto - Switch prototype (Group or Mesh).
 * @param {import('three').Group} targetGroup - Target Layer_Switches group.
 * @returns {Array<import('three').InstancedMesh>} Created instanced meshes.
 */
export function createSwitchMatrixInstances(switchProto, targetGroup) {
  if (!switchProto || !targetGroup) return []
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
  switchPrimitives.forEach((mesh, pIdx) => {
    // Clone prototype material so the shared switch prototype is never mutated in-place (Adversarial #1)
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
    const instancedMesh = new THREE.InstancedMesh(mesh.geometry, clonedMaterial, 81)
    instancedMesh.name = `Switch_Instances_Hybrid_${pIdx}`
    SWITCH_LAYOUT_POSITIONS.forEach((pos, idx) => {
      dummyObj.position.set(pos.x, pos.y, pos.z)
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

/**
 * Creates and initializes the 3D exploded keyboard anatomy scene.
 *
 * @param {object} [options={}] - Configuration options.
 * @param {HTMLCanvasElement} [options.canvas] - Target WebGL canvas element.
 * @param {string} [options.glbUrl='/models/exploded-keyboard.glb'] - URL to hybrid GLTF asset.
 * @param {boolean} [options.reducedMotion=false] - Whether reduced motion is active.
 * @param {Function} [options.rendererFactory] - Custom renderer factory for testing.
 * @param {boolean} [options.loadGlb=true] - Whether to attempt loading the GLTF asset.
 * @param {Function} [options.onContextLost] - Callback invoked if WebGL context is lost.
 * @returns {object} Scene controller exposing setExplosionProgress, setHighlightedLayer, pause, resume, isPaused, hasRenderer, setReducedMotion, getStats, and dispose.
 */
export function createExplodedAnatomyScene({
  canvas,
  glbUrl = '/models/exploded-keyboard.glb',
  reducedMotion = false,
  rendererFactory,
  loadGlb = true,
  onContextLost,
} = {}) {
  let isDisposed = false
  let isPausedState = false
  let animId = null
  let targetProgress = reducedMotion ? 0.72 : 0.0
  let currentProgress = reducedMotion ? 0.72 : 0.0
  let currentExplosionFactor = computeGuideExplosionFactor(currentProgress, { reducedMotion })
  let currentHighlightedLayerId = ''
  let mode = 'procedural'

  let targetMx = 0
  let targetMy = 0
  let currentMx = 0
  let currentMy = 0

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  let lastFrameTime = startTime
  const currentRgbBacklightColor = new THREE.Color(0x3b8cff)
  let currentRgbBacklightIntensity = 0.35
  let isCustomRgbActive = false
  let rgbMaterials = []

  // 1. Scene, Camera, and Root hierarchy
  const scene = new THREE.Scene()
  const rootGroup = new THREE.Group()
  rootGroup.name = 'Keyboard_Root'
  scene.add(rootGroup)

  const clientW = canvas && canvas.clientWidth > 0 ? canvas.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 800)
  const clientH = canvas && canvas.clientHeight > 0 ? canvas.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 600)
  const aspect = clientH > 0 && clientW > 0 ? clientW / clientH : 1.33
  const camera = new THREE.PerspectiveCamera(34, aspect, 0.01, 10)
  camera.position.set(0.22, 0.24, 0.31)
  camera.lookAt(0, 0.01, 0)
  const defaultBaseRadius = Math.sqrt(0.22 * 0.22 + (0.24 - 0.01) * (0.24 - 0.01) + 0.31 * 0.31)
  let baseRadius = defaultBaseRadius

  /**
   * Scales camera distance to prevent clipping on mobile portrait viewports (REV-4).
   *
   * @param {number} currentAspect - Canvas aspect ratio.
   */
  function updateCameraFraming(currentAspect) {
    const validAspect =
      Number.isFinite(currentAspect) && currentAspect > 0 ? currentAspect : 1.33
    if (validAspect < 1.0) {
      const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * validAspect)
      const minDistance = ((KEYBOARD_DIMENSIONS.width || 0.3225) * 0.65) / Math.tan(hFov / 2)
      baseRadius = Math.max(defaultBaseRadius, minDistance)
    } else {
      baseRadius = defaultBaseRadius
    }
  }
  updateCameraFraming(aspect)

  // 2. Lighting setup: balanced ambient and directional lights (B-1: keycaps not washed out)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6)
  dirLight.position.set(0.3, 0.5, 0.4)
  const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.5)
  fillLight.position.set(-0.3, 0.2, -0.3)
  scene.add(ambientLight, dirLight, fillLight)

  // 3. Create layer container groups for the 6 physical layers
  const layerGroups = {}
  for (const layer of ANATOMY_LAYERS) {
    const group = new THREE.Group()
    group.name = layer.nodeName
    group.userData = { id: layer.id, yOffset: layer.yOffset }
    rootGroup.add(group)
    layerGroups[layer.id] = group
  }

  // 4. Immediately populate with procedural fallback layers
  const fallbackLayers = buildProceduralFallbackLayers()
  for (const layer of ANATOMY_LAYERS) {
    const fallbackGroup = fallbackLayers[layer.id]
    if (fallbackGroup) {
      while (fallbackGroup.children.length > 0) {
        layerGroups[layer.id].add(fallbackGroup.children[0])
      }
    }
  }

  /**
   * Rebuilds the cached list of emissive RGB materials for plate and keycap engravings.
   * Caches { mat, child, idx, layerId } entries so updatePlateAndLegendRgb does not
   * perform scene traversals or string comparisons inside the animation render loop (F-04).
   */
  function rebuildRgbMaterialsCache() {
    rgbMaterials = []
    for (const layerId of ['plate', 'keycaps']) {
      const group = layerGroups[layerId]
      if (!group) continue
      group.traverse((child) => {
        if (!child.isMesh || !child.material) return
        forEachMaterial(child.material, (mat, idx) => {
          const isPlate = layerId === 'plate'
          const isEngraving = Boolean(mat.name && mat.name.toLowerCase().includes('engraving'))
          if (isPlate || isEngraving) {
            rgbMaterials.push({
              mat,
              child,
              idx,
              layerId,
            })
          }
        })
      })
    }
  }
  rebuildRgbMaterialsCache()

  /**
   * Updates emissive color and intensity on Layer_Plate and keycap engraving materials
   * using the pre-cached rgbMaterials array without scene traversal or string checks (F-04).
   * Keycap legend decals maintain an emissive intensity of ~1.2 while plate uses the requested intensity.
   *
   * @param {import('three').Color|number|string} color - Emissive color to apply.
   * @param {number} [intensity=0.35] - Plate emissive intensity.
   */
  function updatePlateAndLegendRgb(color, intensity = 0.35) {
    const c = color instanceof THREE.Color ? color : RGB_RESOLVE_COLOR.set(color)
    const hex = c.getHex()
    for (let i = 0; i < rgbMaterials.length; i++) {
      const entry = rgbMaterials[i]
      const { mat, child, idx, layerId } = entry
      const effectiveIntensity = layerId === 'plate' ? intensity : 1.2
      // Apply live emissive if this layer is not currently dimmed by another highlighted layer
      if (!currentHighlightedLayerId || currentHighlightedLayerId === layerId) {
        if (mat.emissive) {
          mat.emissive.copy(c)
          mat.emissiveIntensity = effectiveIntensity
        }
      }
      // Update cached origMaterials so unhighlighting restores the RGB color
      if (child.userData?.origMaterials?.[idx]) {
        child.userData.origMaterials[idx].emissiveHex = hex
        child.userData.origMaterials[idx].emissiveIntensity = effectiveIntensity
      }
    }
  }

  /**
   * Updates Y positions of all 6 layer groups according to explosion factor.
   *
   * @param {number} factor - Explosion factor in [0, 1].
   */
  function applyExplosionPositions(factor) {
    for (const layer of ANATOMY_LAYERS) {
      const group = layerGroups[layer.id]
      if (group) {
        group.position.y = factor * layer.yOffset
      }
    }
  }

  let targetFocusLayerId = ''
  let currentFocusLookY = 0.01
  let currentFocusPolarBias = 0
  let currentFocusAzimuthBias = 0

  const LAYER_RESTING_CENTERS = {
    keycaps: 0.024,
    switches: 0.018,
    plate: 0.020,
    pcb: 0.011,
    foam: 0.007,
    case: 0.006,
  }

  const LAYER_POLAR_BIAS_DEG = {
    keycaps: 12,
    switches: 10,
    plate: 6,
    pcb: 4,
    foam: -6,
    case: -12,
  }

  const LAYER_AZIMUTH_BIAS_DEG = {
    pcb: 6,
    foam: 6,
  }

  /**
   * Updates horizontal and vertical layout offsets of the root model group
   * based on viewport width to preserve copy legibility (C-3, V-3).
   *
   * @param {number} width - Viewport or canvas width in pixels.
   */
  function updateLayoutOffset(width) {
    const isDesktop = (width || (typeof window !== 'undefined' ? window.innerWidth : 800)) >= 992
    if (isDesktop) {
      // Shift model to right side of viewport so left column cards never obscure it
      rootGroup.position.x = 0.075
      rootGroup.position.y = -0.008
    } else {
      rootGroup.position.x = 0
      rootGroup.position.y = 0.012
    }
  }

  /**
   * Updates camera position and target based on explosion factor, orbital sweep, pointer parallax,
   * and active layer focus tracking.
   *
   * @param {number} e - Explosion factor in [0, 1].
   * @param {number} time - Elapsed time in seconds.
   */
  function updateCamera(e, time) {
    if (!camera) return
    const deg2rad = Math.PI / 180

    if (reducedMotion) {
      const focusYOffset = targetFocusLayerId ? (currentFocusLookY - 0.01) : 0
      const distScale = baseRadius / defaultBaseRadius
      camera.position.set(0.22 * distScale, (0.24 + focusYOffset) * distScale, 0.31 * distScale)
      camera.lookAt(0, 0.01 + focusYOffset, 0)
      return
    }

    const az = (22 + 14 * e + currentFocusAzimuthBias + currentMx * 10 + Math.sin(time * 0.25) * 3) * deg2rad
    const pol = (52 + 14 * e + currentFocusPolarBias + currentMy * 6) * deg2rad
    const R = baseRadius * (1 + 0.12 * e)
    const ty = currentFocusLookY + 0.045 * e

    camera.position.set(
      R * Math.sin(pol) * Math.sin(az),
      ty + R * Math.cos(pol),
      R * Math.sin(pol) * Math.cos(az)
    )
    camera.lookAt(0, ty, 0)
  }

  updateLayoutOffset(canvas?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800))
  applyExplosionPositions(currentExplosionFactor)
  updateCamera(currentExplosionFactor, 0)

  /**
   * Applies highlight emissive tint and dimming across layers.
   *
   * @param {string} layerId - ID of active layer, or empty string to reset.
   */
  function applyHighlight(layerId) {
    for (const layer of ANATOMY_LAYERS) {
      const group = layerGroups[layer.id]
      if (!group) continue
      const isTarget = Boolean(layerId && layer.id === layerId)

      group.traverse((child) => {
        if (!child.isMesh) return

        // Clone each material in child.material on first highlight to avoid shared mutation
        if (!child.userData.clonedForHighlight) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => (m && m.clone ? m.clone() : m))
          } else if (child.material && child.material.clone) {
            child.material = child.material.clone()
          }
          child.userData.clonedForHighlight = true

          // Keep rgbMaterials references in sync if this mesh's material was cloned
          for (let i = 0; i < rgbMaterials.length; i++) {
            if (rgbMaterials[i].child === child) {
              const activeMat = Array.isArray(child.material)
                ? child.material[rgbMaterials[i].idx]
                : child.material
              if (activeMat) {
                rgbMaterials[i].mat = activeMat
              }
            }
          }
        }

        // Cache original material values if not already stored
        if (!child.userData.origMaterials) {
          const origs = []
          forEachMaterial(child.material, (mat) => {
            origs.push({
              opacity: mat.opacity ?? 1,
              transparent: Boolean(mat.transparent),
              depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
              emissiveHex: mat.emissive ? mat.emissive.getHex() : 0,
              emissiveIntensity: mat.emissiveIntensity ?? 1,
            })
          })
          child.userData.origMaterials = origs
        }

        const origs = child.userData.origMaterials
        if (!layerId) {
          // Reset to normal state
          forEachMaterial(child.material, (mat, idx) => {
            const orig = origs[idx] || origs[0]
            mat.opacity = orig.opacity
            mat.transparent = orig.transparent
            if (orig.depthWrite !== undefined) {
              mat.depthWrite = orig.depthWrite
            }
            if (mat.emissive) {
              mat.emissive.setHex(orig.emissiveHex)
              mat.emissiveIntensity = orig.emissiveIntensity
            }
          })
        } else if (isTarget) {
          // Highlight target layer: restore designed base opacity (F-03)
          forEachMaterial(child.material, (mat, idx) => {
            const orig = origs[idx] || origs[0]
            mat.opacity = orig.opacity
            mat.transparent = orig.transparent
            if (orig.depthWrite !== undefined) {
              mat.depthWrite = orig.depthWrite
            }
            if (mat.emissive) {
              mat.emissive.set(layer.accentColor || 0x3346ff)
              mat.emissiveIntensity = 0.45
            }
          })
        } else {
          // Dim non-highlighted layers (F-02, F-03)
          forEachMaterial(child.material, (mat, idx) => {
            const orig = origs[idx] || origs[0]
            const isEngraving = Boolean(mat.name && mat.name.toLowerCase().includes('engraving'))
            mat.transparent = true
            mat.depthWrite = false
            if (isEngraving) {
              // Ensure decals remain visible when dimmed and never set depthWrite to true (F-02, REV-7)
              mat.opacity = Math.min(orig.opacity, 0.35)
            } else {
              mat.opacity = orig.opacity * 0.35
            }
            if (mat.emissive) {
              mat.emissive.set(0x000000)
            }
          })
        }
      })
    }
    if (!layerId) {
      // Re-apply active RGB backlight color after clearing highlights (Adversarial #4)
      updatePlateAndLegendRgb(currentRgbBacklightColor, currentRgbBacklightIntensity)
    }
  }

  /**
   * Ingests a loaded GLTF scene, swapping procedural fallback layers for high-fidelity Blender meshes.
   *
   * @param {object} gltf - Loaded GLTF container with scene hierarchy.
   */
  function handleGltfLoaded(gltf) {
    if (isDisposed) {
      disposeObject(gltf.scene)
      return
    }

    let glbCase = null
    let glbKeycaps = null
    let glbPlate = null
    let glbSwitch = null

    gltf.scene.traverse((child) => {
      if (child.name === 'Layer_Case') glbCase = child
      if (child.name === 'Layer_Keycaps') glbKeycaps = child
      if (child.name === 'Layer_Plate') glbPlate = child
      if (child.name === 'Switch_Prototype') glbSwitch = child
    })

    // Replace Layer_Keycaps with sculpted Blender mesh
    if (glbKeycaps && layerGroups.keycaps) {
      while (layerGroups.keycaps.children.length > 0) {
        const oldChild = layerGroups.keycaps.children[0]
        layerGroups.keycaps.remove(oldChild)
        disposeObject(oldChild)
      }
      glbKeycaps.traverse((child) => {
        if (child.isMesh && child.material) {
          let isDecal = false
          forEachMaterial(child.material, (mat) => {
            const matName = (mat.name || '').toLowerCase()
            const keycapPbtNames = [
              'white keycaps',
              'light gray keycap 1',
              'light gray keycap 2',
              'middle gray keycap',
              'dark gray kecaps',
              'dark gray keycaps',
              'black gray keycaps',
            ]
            if (keycapPbtNames.some((n) => matName.includes(n))) {
              mat.roughness = Math.max(typeof mat.roughness === 'number' ? mat.roughness : 0, 0.65)
              mat.metalness = 0
            }
            if (matName.includes('engraving')) {
              mat.transparent = true
              mat.depthWrite = false
              mat.polygonOffset = true
              mat.polygonOffsetFactor = -1
              mat.polygonOffsetUnits = -1
              isDecal = true
            }
          })
          if (isDecal && child !== glbKeycaps && child.name !== 'Layer_Keycaps') {
            child.renderOrder = 2
          }
        }
      })
      layerGroups.keycaps.add(glbKeycaps)
    }

    // Replace Layer_Plate with sculpted Blender mesh
    if (glbPlate && layerGroups.plate) {
      while (layerGroups.plate.children.length > 0) {
        const oldChild = layerGroups.plate.children[0]
        layerGroups.plate.remove(oldChild)
        disposeObject(oldChild)
      }
      glbPlate.traverse((child) => {
        if (child.isMesh && child.material) {
          forEachMaterial(child.material, (mat) => {
            if (!mat.emissive || mat.emissive.getHex() === 0) {
              mat.emissive = new THREE.Color(0x3b8cff)
              mat.emissiveIntensity = 0.35
            }
          })
        }
      })
      layerGroups.plate.add(glbPlate)
    }

    // Replace Layer_Case with sculpted Blender mesh
    if (glbCase && layerGroups.case) {
      while (layerGroups.case.children.length > 0) {
        const oldChild = layerGroups.case.children[0]
        layerGroups.case.remove(oldChild)
        disposeObject(oldChild)
      }
      layerGroups.case.add(glbCase)
    }

    // Replace Layer_Switches with 81-instance InstancedMesh for each primitive in Switch_Prototype (AC-3)
    if (glbSwitch && layerGroups.switches) {
      createSwitchMatrixInstances(glbSwitch, layerGroups.switches)
    }

    mode = 'hybrid'
    rebuildRgbMaterialsCache()
    applyExplosionPositions(currentExplosionFactor)
    applyHighlight(currentHighlightedLayerId)
    if (reducedMotion) {
      requestSingleFrame()
    }
  }

  // 5. Asynchronously load hybrid GLTF asset if permitted and in browser (AC-5, F-06)
  if (loadGlb && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    const loadGlbAsset = async () => {
      try {
        const res = await fetch(glbUrl)
        if (!res.ok) {
          throw new Error(`Failed to fetch GLB (${glbUrl}): HTTP ${res.status}`)
        }
        const contentType = res.headers?.get?.('content-type') || ''
        if (contentType.includes('text/html')) {
          throw new Error(`Invalid content-type for GLB (${glbUrl}): ${contentType}`)
        }
        const buffer = await res.arrayBuffer()
        if (isDisposed) return

        const loader = new GLTFLoader()
        loader.parse(
          buffer,
          '',
          (gltf) => {
            handleGltfLoaded(gltf)
          },
          (err) => {
            console.warn('Exploded anatomy GLTF parse error (procedural fallback active):', err)
          }
        )
      } catch (err) {
        // Cleanly retain procedural fallback on network/file error
        console.warn('Exploded anatomy GLTF load notice (procedural fallback active):', err)
      }
    }
    loadGlbAsset()
  }

  // 6. Renderer initialization
  let renderer = null
  let pmremGenerator = null
  let envRenderTarget = null

  if (rendererFactory) {
    try {
      renderer = rendererFactory({ canvas, scene, camera })
    } catch {
      renderer = null
    }
  } else if (canvas && isWebGLAvailable()) {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
      renderer.setPixelRatio(dpr)
      renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false)
      renderer.outputColorSpace = THREE.SRGBColorSpace
    } catch {
      renderer = null
    }
  }

  // Setup ACES Filmic tone mapping & exposure (B-1: guarded for mock renderers)
  if (renderer) {
    try {
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 0.95
    } catch {
      // Guard against non-configurable renderer mocks
    }
  }

  // Setup studio RoomEnvironment (AC-4, B-1: environmentIntensity = 0.35)
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
      // Graceful fallback in test/mock environments without full WebGL context
    }
  }

  /**
   * Advances physics and continuous animation states by dt seconds.
   * Damps scroll progress toward targetProgress, pointer parallax toward targetMx/targetMy,
   * and camera target toward focused layer coordinates.
   *
   * @param {number} [dt=1/60] - Delta time in seconds.
   */
  function step(dt = 1 / 60) {
    if (isDisposed) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const time = (now - startTime) / 1000
    const clampedDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 1 / 60

    let targetLookY = 0.01
    let targetPolarBias = 0
    let targetAzimuthBias = 0
    if (targetFocusLayerId) {
      const layer = ANATOMY_LAYERS.find((l) => l.id === targetFocusLayerId)
      if (layer) {
        const restingY = LAYER_RESTING_CENTERS[layer.id] || 0.01
        targetLookY = restingY + layer.yOffset * currentExplosionFactor
        targetPolarBias = LAYER_POLAR_BIAS_DEG[layer.id] || 0
        targetAzimuthBias = LAYER_AZIMUTH_BIAS_DEG[layer.id] || 0
      }
    }

    if (reducedMotion) {
      currentProgress = targetProgress
      currentExplosionFactor = computeGuideExplosionFactor(currentProgress, { reducedMotion })
      currentFocusLookY = targetLookY
      currentFocusPolarBias = targetPolarBias
      currentFocusAzimuthBias = targetAzimuthBias
      applyExplosionPositions(currentExplosionFactor)
      updateCamera(currentExplosionFactor, time)
      return
    }

    // Continuous scroll damping: frame-rate independent
    const scrollDamp = 1 - Math.pow(1 - 0.08, clampedDt * 60)
    if (Math.abs(targetProgress - currentProgress) < 1e-5) {
      currentProgress = targetProgress
    } else {
      currentProgress += (targetProgress - currentProgress) * scrollDamp
    }

    // Pointer parallax damping: lerp 0.06
    const pointerDamp = 1 - Math.pow(1 - 0.06, clampedDt * 60)
    currentMx += (targetMx - currentMx) * pointerDamp
    currentMy += (targetMy - currentMy) * pointerDamp

    // Layer focus camera damping: lerp ~0.08 / frame (C-3)
    const focusDamp = 1 - Math.pow(1 - 0.08, clampedDt * 60)
    currentFocusLookY += (targetLookY - currentFocusLookY) * focusDamp
    currentFocusPolarBias += (targetPolarBias - currentFocusPolarBias) * focusDamp
    currentFocusAzimuthBias += (targetAzimuthBias - currentFocusAzimuthBias) * focusDamp

    currentExplosionFactor = computeGuideExplosionFactor(currentProgress, { reducedMotion })
    applyExplosionPositions(currentExplosionFactor)
    updateCamera(currentExplosionFactor, time)
  }

  /**
   * Window pointermove listener for passive orbital parallax with finite number guards (REV-4).
   *
   * @param {PointerEvent} event - Pointer move event.
   */
  const handlePointerMove = (event) => {
    if (typeof window === 'undefined' || isDisposed || reducedMotion) return
    if (!event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    const mx = (event.clientX / w) * 2 - 1
    const my = -(event.clientY / h) * 2 + 1
    if (Number.isFinite(mx)) targetMx = Math.max(-1, Math.min(1, mx))
    if (Number.isFinite(my)) targetMy = Math.max(-1, Math.min(1, my))
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
  }

  /**
   * WebGL context lost event handler.
   *
   * @param {WebGLContextEvent} event - WebGL context event.
   */
  const handleContextLost = (event) => {
    event?.preventDefault?.()
    if (!isPausedState) {
      isPausedState = true
      if (animId !== null) {
        cancelAnimationFrame(animId)
        animId = null
      }
    }
    if (typeof onContextLost === 'function') {
      onContextLost(event)
    }
  }

  if (canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('webglcontextlost', handleContextLost)
  }

  /**
   * Window resize handler updating projection matrix, renderer buffer, and desktop offset.
   */
  const handleResize = () => {
    if (!canvas || !renderer || isDisposed) return
    const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)
    const height = canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600)
    updateLayoutOffset(width)
    if (height > 0 && width > 0 && camera) {
      const newAspect = width / height
      camera.aspect = newAspect
      camera.updateProjectionMatrix()
      updateCameraFraming(newAspect)
      renderer.setSize(width, height, false)
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    updateCamera(currentExplosionFactor, (now - startTime) / 1000)
    if (reducedMotion) {
      requestSingleFrame()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize, { passive: true })
  }

  /**
   * Renders a single animation frame on demand (REV-2).
   */
  function requestSingleFrame() {
    if (isDisposed) return
    step(0)
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  /**
   * Main animation loop.
   */
  function renderLoop() {
    if (isDisposed || isPausedState || reducedMotion) {
      animId = null
      return
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const rawDt = (now - lastFrameTime) / 1000
    const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(0.1, rawDt)) : 1 / 60
    lastFrameTime = now

    step(dt)

    // Smoothly cycle RGB backlight hue across cyan/blue/violet (AC-4, F-04, B-2: intensity 0.35)
    if (!reducedMotion && !currentHighlightedLayerId && !isCustomRgbActive) {
      const time = (now - startTime) / 1000
      const hue = 0.55 + Math.sin(time * 0.8) * 0.12
      RENDER_HUE_COLOR.setHSL(hue, 0.9, 0.58)
      updatePlateAndLegendRgb(RENDER_HUE_COLOR, currentRgbBacklightIntensity)
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
    animId = requestAnimationFrame(renderLoop)
  }

  function startAnimationLoop() {
    if (animId !== null || isDisposed || isPausedState || reducedMotion) return
    lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
    animId = requestAnimationFrame(renderLoop)
  }

  if (renderer && !reducedMotion) {
    startAnimationLoop()
  } else if (renderer && reducedMotion) {
    requestSingleFrame()
  }

  const controller = {
    /**
     * Checks if a WebGLRenderer instance is active.
     *
     * @returns {boolean} True if renderer exists, false otherwise.
     */
    hasRenderer() {
      return Boolean(renderer)
    },

    /**
     * Updates reduced motion preference dynamically.
     * Under reduced motion, cancels continuous RAF loops and re-renders on demand (REV-2).
     *
     * @param {boolean} isReduced - Whether user prefers reduced motion.
     */
    setReducedMotion(isReduced) {
      if (isDisposed) return
      reducedMotion = Boolean(isReduced)
      if (reducedMotion) {
        if (animId !== null) {
          cancelAnimationFrame(animId)
          animId = null
        }
        currentExplosionFactor = computeGuideExplosionFactor(currentProgress, { reducedMotion })
        applyExplosionPositions(currentExplosionFactor)
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        updateCamera(currentExplosionFactor, (now - startTime) / 1000)
        requestSingleFrame()
      } else {
        targetProgress = currentProgress
        currentExplosionFactor = computeGuideExplosionFactor(currentProgress, { reducedMotion: false })
        applyExplosionPositions(currentExplosionFactor)
        startAnimationLoop()
      }
    },

    /**
     * Updates layer explosion separation based on normalized scroll progress.
     * Snaps immediately when smooth is false; damps continuously toward target when smooth is true.
     * Under reduced motion, updates instantly and renders a single frame on demand (REV-2).
     *
     * @param {number} scrollProgress - Scroll progress in [0, 1].
     * @param {object} [options={}] - Motion options.
     * @param {boolean} [options.smooth=false] - Whether to converge smoothly over time.
     */
    setExplosionProgress(scrollProgress, { smooth = false } = {}) {
      if (isDisposed) return
      const p = Math.max(0, Math.min(1, Number.isFinite(scrollProgress) ? scrollProgress : 0))
      targetProgress = p
      if (!smooth || reducedMotion) {
        currentProgress = p
        currentExplosionFactor = computeGuideExplosionFactor(p, { reducedMotion })
        applyExplosionPositions(currentExplosionFactor)
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        updateCamera(currentExplosionFactor, (now - startTime) / 1000)
        if (reducedMotion) {
          requestSingleFrame()
        }
      }
    },

    /**
     * Focuses camera lookAt height and viewing angle on a specific layer (C-3).
     * Empty string returns to default resting orbit.
     * Under reduced motion, applies instantly with no orbit sweep.
     *
     * @param {string} layerId - ID of active anatomy layer, or empty string to reset.
     */
    setFocusLayer(layerId) {
      if (isDisposed) return
      targetFocusLayerId = layerId || ''
      if (reducedMotion) {
        const layer = ANATOMY_LAYERS.find((l) => l.id === targetFocusLayerId)
        if (layer) {
          const restingY = LAYER_RESTING_CENTERS[layer.id] || 0.01
          currentFocusLookY = restingY + layer.yOffset * currentExplosionFactor
          currentFocusPolarBias = LAYER_POLAR_BIAS_DEG[layer.id] || 0
          currentFocusAzimuthBias = LAYER_AZIMUTH_BIAS_DEG[layer.id] || 0
        } else {
          currentFocusLookY = 0.01
          currentFocusPolarBias = 0
          currentFocusAzimuthBias = 0
        }
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        updateCamera(currentExplosionFactor, (now - startTime) / 1000)
        requestSingleFrame()
      }
    },

    /**
     * Advances physics and continuous damping simulation by dt seconds.
     *
     * @param {number} [dt=1/60] - Delta time in seconds.
     */
    step(dt = 1 / 60) {
      step(dt)
    },

    /**
     * Gets the current interpolated scroll progress.
     *
     * @returns {number} Current progress in [0, 1].
     */
    getCurrentProgress() {
      return currentProgress
    },

    /**
     * Gets the target scroll progress.
     *
     * @returns {number} Target progress in [0, 1].
     */
    getTargetProgress() {
      return targetProgress
    },

    /**
     * Manually overrides normalized pointer offsets for testing or custom interaction.
     *
     * @param {number} mx - Horizontal pointer coordinate in [-1, 1].
     * @param {number} my - Vertical pointer coordinate in [-1, 1].
     */
    setPointer(mx, my) {
      if (Number.isFinite(mx)) {
        targetMx = Math.max(-1, Math.min(1, mx))
        currentMx = targetMx
      }
      if (Number.isFinite(my)) {
        targetMy = Math.max(-1, Math.min(1, my))
        currentMy = targetMy
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      updateCamera(currentExplosionFactor, (now - startTime) / 1000)
      if (reducedMotion) {
        requestSingleFrame()
      }
    },

    /**
     * Highlights an active layer or clears highlighting.
     *
     * @param {string} layerId - Target layer id.
     */
    setHighlightedLayer(layerId) {
      if (isDisposed) return
      currentHighlightedLayerId = layerId || ''
      applyHighlight(currentHighlightedLayerId)
      if (reducedMotion) {
        requestSingleFrame()
      }
    },

    /**
     * Dynamically sets the RGB backlight emissive color and intensity on Layer_Plate
     * and shine-through keycap legends.
     *
     * @param {import('three').Color|number|string} color - RGB backlight color.
     * @param {number} [intensity=0.35] - Emissive intensity (B-2: default 0.35).
     */
    setRgbBacklightColor(color, intensity = 0.35) {
      if (isDisposed) return
      if (!color) {
        isCustomRgbActive = false
        return
      }
      isCustomRgbActive = true
      const c = color instanceof THREE.Color ? color.clone() : new THREE.Color(color)
      currentRgbBacklightColor.copy(c)
      currentRgbBacklightIntensity = intensity
      // Only illuminate plate and legends immediately if no layer is highlighted or if the plate itself is highlighted (Adversarial #4)
      if (!currentHighlightedLayerId || currentHighlightedLayerId === 'plate') {
        updatePlateAndLegendRgb(currentRgbBacklightColor, currentRgbBacklightIntensity)
      }
      if (reducedMotion) {
        requestSingleFrame()
      }
    },

    /**
     * Gets the active RGB backlight color.
     *
     * @returns {import('three').Color} Active RGB color clone.
     */
    getRgbBacklightColor() {
      return currentRgbBacklightColor.clone()
    },

    /**
     * Ingests a switch prototype (Mesh or Group with multiple primitives)
     * and instantiates an 81-matrix layout for each primitive.
     *
     * @param {import('three').Object3D} switchProto - Switch prototype to ingest.
     * @returns {Array<import('three').InstancedMesh>} Created instanced meshes.
     */
    ingestSwitchPrototype(switchProto) {
      if (isDisposed || !layerGroups.switches) return []
      return createSwitchMatrixInstances(switchProto, layerGroups.switches)
    },

    /**
     * Ingests a pre-loaded GLTF container directly into the scene.
     *
     * @param {object} gltf - GLTF container with scene hierarchy.
     */
    ingestGltfScene(gltf) {
      if (isDisposed || !gltf) return
      handleGltfLoaded(gltf)
    },

    /**
     * Pauses the animation rendering loop.
     */
    pause() {
      if (isPausedState) return
      isPausedState = true
      if (animId !== null) {
        cancelAnimationFrame(animId)
        animId = null
      }
    },

    /**
     * Resumes the animation rendering loop.
     */
    resume() {
      if (!isPausedState || isDisposed) return
      isPausedState = false
      if (renderer && !reducedMotion) {
        startAnimationLoop()
      } else if (renderer && reducedMotion) {
        requestSingleFrame()
      }
    },

    /**
     * Checks if the animation loop is currently paused.
     *
     * @returns {boolean} True if paused, false otherwise.
     */
    isPaused() {
      return isPausedState
    },

    /**
     * Calculates scene performance and geometry statistics.
     *
     * @returns {{
     *   drawCalls: number,
     *   triangles: number,
     *   layerCount: number,
     *   switchInstanceCount: number,
     *   mode: 'hybrid'|'procedural',
     *   explosionFactor: number
     * }} Scene statistics.
     */
    getStats() {
      let drawCalls = 0
      let triangles = 0
      let switchInstanceCount = 0

      scene.traverse((obj) => {
        if (obj.isInstancedMesh) {
          drawCalls += 1
          const count = obj.count || 0
          if (obj.name && obj.name.startsWith('Switch_Instances_')) {
            switchInstanceCount = count
          }
          triangles += countGeometryTriangles(obj.geometry) * count
        } else if (obj.isMesh) {
          drawCalls += 1
          triangles += countGeometryTriangles(obj.geometry)
        }
      })

      return {
        drawCalls,
        triangles: Math.round(triangles),
        layerCount: 6,
        switchInstanceCount: switchInstanceCount || 81,
        mode,
        explosionFactor: Number(currentExplosionFactor.toFixed(3)),
      }
    },

    /**
     * Cleans up all GPU memory, geometries, materials, event listeners, and WebGL contexts.
     */
    dispose() {
      if (isDisposed) return
      isDisposed = true
      if (animId !== null) {
        cancelAnimationFrame(animId)
        animId = null
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('pointermove', handlePointerMove)
        if (window.__EXPLODED_ANATOMY__ === controller) {
          delete window.__EXPLODED_ANATOMY__
        }
      }
      if (canvas && typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
      }
      if (scene) {
        scene.environment = null
      }
      if (envRenderTarget) {
        envRenderTarget.dispose?.()
        envRenderTarget = null
      }
      if (pmremGenerator) {
        pmremGenerator.dispose?.()
        pmremGenerator = null
      }
      disposeObject(scene)
      if (renderer) {
        renderer.dispose?.()
        renderer.forceContextLoss?.()
        renderer = null
      }
    },
  }

  if (typeof window !== 'undefined' && import.meta?.env?.DEV) {
    window.__EXPLODED_ANATOMY__ = controller
  }

  return controller
}
