<script setup>
// A still 3D picture of one FATKEY, made from the same keyboard model as the Know page.
// Only the colours change between FATKEY models. The picture is drawn once, not animated.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const props = defineProps({
  look: { type: Object, required: true },
})

const canvas = ref(null)
let renderer = null
let observer = null

// Load the model file once and share it between all the previews.
let modelPromise = null
function loadModel() {
  if (!modelPromise) {
    modelPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load('/models/exploded-keyboard.glb', resolve, undefined, reject)
    })
  }
  return modelPromise
}

function paint(mesh, look) {
  // The loader adds numbers to repeated part names (Layer_Case_1, Layer_Case_2 ...), so strip them.
  const name = mesh.name.replace(/_\d+$/, '')
  if (name === 'Switch_Prototype') { mesh.visible = false; return }
  const mat = mesh.material
  // The model's materials carry texture maps that would tint the new colour dark, so drop them.
  mat.map = null
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.needsUpdate = true
  if (name === 'Layer_Case') {
    mat.color.set(look.case)
    mat.metalness = look.caseMetal ?? 0
    mat.roughness = look.caseRough ?? 0.6
    if (look.caseOpacity !== undefined) { mat.transparent = true; mat.opacity = look.caseOpacity }
  } else if (name === 'Layer_Keycaps') {
    mat.color.set(look.keycaps)
    mat.metalness = 0
    mat.roughness = 0.5
  } else if (name === 'Layer_Plate') {
    mat.color.set(look.plate)
    mat.transparent = true
    mat.opacity = look.plateOpacity ?? 0.6
  }
}

function draw(scene, camera, model, box, size) {
  if (!renderer || !canvas.value) return
  const w = canvas.value.clientWidth || 300
  const h = canvas.value.clientHeight || 180
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  // Fit the keyboard in the frame from the same angle the Know page uses.
  const radius = Math.max(size.x, size.z) * 0.9
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(camera.aspect, 1) * 0.9
  camera.position.set(0.22, 0.24, 0.31).normalize().multiplyScalar(dist)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}

onMounted(async () => {
  if (!canvas.value) return
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true })
  } catch {
    return // no WebGL: the card keeps its text and the picture area stays empty
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10)
  scene.add(new THREE.AmbientLight(0xffffff, 1.0))
  const light = new THREE.DirectionalLight(0xffffff, 1.4)
  light.position.set(0.3, 0.6, 0.4)
  scene.add(light)

  let gltf
  try {
    gltf = await loadModel()
  } catch {
    return
  }
  const model = gltf.scene.clone(true)
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone()
      paint(o, props.look)
    }
  })
  scene.add(model)

  // Centre the model at the origin so the camera can frame it.
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  model.position.sub(centre)

  const redraw = () => draw(scene, camera, model, box, size)
  redraw()
  observer = new ResizeObserver(redraw)
  observer.observe(canvas.value)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (renderer) renderer.dispose()
  renderer = null
})
</script>

<template>
  <canvas ref="canvas" class="fk-preview" aria-hidden="true"></canvas>
</template>
