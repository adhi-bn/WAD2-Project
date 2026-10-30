<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { kbSVG } from '../logic/builder.js'

const props = defineProps({
  layout: { type: String, required: true },
  switchPart: { type: Object, default: null },
})

const host = ref(null)
const svgMarkup = computed(() => kbSVG(props.layout))
// Keep interaction state outside Vue because the generated SVG is inserted as raw HTML.
const pressedCodes = new Set()
const pointerCodes = new Map()
const pressedAudio = new Set()
const audioError = ref('')

// Printable characters may change position on different keyboard layouts, so resolve them
// by the reported key value before falling back to physical browser codes for special keys.
const CHARACTER_CODES = {
  a: 'KeyA', b: 'KeyB', c: 'KeyC', d: 'KeyD', e: 'KeyE', f: 'KeyF', g: 'KeyG', h: 'KeyH', i: 'KeyI', j: 'KeyJ', k: 'KeyK', l: 'KeyL', m: 'KeyM', n: 'KeyN', o: 'KeyO', p: 'KeyP', q: 'KeyQ', r: 'KeyR', s: 'KeyS', t: 'KeyT', u: 'KeyU', v: 'KeyV', w: 'KeyW', x: 'KeyX', y: 'KeyY', z: 'KeyZ',
}
const SYMBOL_CODES = { '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash', '`': 'Backquote' }
const SHIFTED_SYMBOL_CODES = { '!': 'Digit1', '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5', '^': 'Digit6', '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0', '_': 'Minus', '+': 'Equal', '{': 'BracketLeft', '}': 'BracketRight', '|': 'Backslash', ':': 'Semicolon', '"': 'Quote', '<': 'Comma', '>': 'Period', '?': 'Slash', '~': 'Backquote' }

/** Resolves layout-dependent characters by value and unambiguous special keys by position. */
function physicalKeyId(event) {
  const character = event.key?.toLowerCase()
  if (character && CHARACTER_CODES[character]) return CHARACTER_CODES[character]
  if (/^[0-9]$/.test(character || '') ) return `Digit${character}`
  if (SYMBOL_CODES[character]) return SYMBOL_CODES[character]
  if (SHIFTED_SYMBOL_CODES[character]) return SHIFTED_SYMBOL_CODES[character]
  if (!character && /^Key[A-Z]$/.test(event.code || '')) return event.code
  if (!character && /^Digit[0-9]$/.test(event.code || '')) return event.code
  if (event.code === 'Space') return 'Space'
  const specialKeys = new Set(['Enter', 'Tab', 'Backspace', 'Escape', 'CapsLock', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'PrintScreen', 'ScrollLock', 'Pause', 'NumLock'])
  if (/^F(?:[1-9]|1[0-2])$/.test(event.code)) return event.code
  if (/^Numpad/.test(event.code)) return event.code
  return specialKeys.has(event.code) ? event.code : ''
}

function keys() {
  return host.value ? [...host.value.querySelectorAll('[data-key-id]')] : []
}

function setPressed(code, pressed) {
  // The SVG can contain empty key slots, so ignore codes that do not have a rendered key.
  if (!code || !keys().some((key) => key.dataset.keyId === code)) return
  if (pressed) pressedCodes.add(code)
  else pressedCodes.delete(code)
  keys().forEach((key) => {
    if (key.dataset.keyId === code) key.classList.toggle('pressed', pressedCodes.has(code))
  })
}

function clearPressed() {
  [...pressedCodes].forEach((code) => setPressed(code, false))
  pointerCodes.clear()
}

function releaseAudio(audio) {
  pressedAudio.delete(audio)
}

function playSwitchSound() {
  const source = props.switchPart?.onePressSample
  if (!source) return
  let audio
  try {
    audio = new Audio(source)
  } catch (error) {
    audioError.value = 'Switch sound could not be loaded.'
    return
  }

  pressedAudio.add(audio)
  // Release each one-shot audio element after it finishes or fails so playback resources do
  // not accumulate across repeated key presses.
  audio.addEventListener('ended', () => releaseAudio(audio), { once: true })
  audio.addEventListener('error', () => {
    releaseAudio(audio)
    audioError.value = 'Switch sound could not be loaded.'
  }, { once: true })
  let playback
  try {
    playback = audio.play()
  } catch (error) {
    releaseAudio(audio)
    audioError.value = 'Switch sound playback was blocked. Try pressing a key again.'
    return
  }

  Promise.resolve(playback).catch(() => {
    releaseAudio(audio)
    audioError.value = 'Switch sound playback was blocked. Try pressing a key again.'
  })
}

function activate(code) {
  // Key repeats and overlapping pointer/keyboard events must not retrigger the same key.
  if (!code || pressedCodes.has(code)) return
  setPressed(code, true)
  playSwitchSound()
}

function deactivate(code) {
  if (!code) return
  setPressed(code, false)
}

function isTextControl(target) {
  // Typing inside a form control belongs to that control, not to the keyboard tester.
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) ||
    Boolean(target.closest('[role="button"], [contenteditable="true"]'))
  )
}

function onKeyDown(event) {
  if (isTextControl(event.target)) return
  // Modifier shortcuts should stay available to the browser unless their target key is a
  // physical modifier, such as Control or Alt itself.
  const modifier = ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight']
  const code = physicalKeyId(event)
  if ((event.ctrlKey || event.metaKey || event.altKey) && !modifier.includes(code)) return
  if (!code || !keys().some((key) => key.dataset.keyId === code)) return
  if (code === 'Space') event.preventDefault()
  if (event.repeat) return
  activate(code)
}

function onKeyUp(event) {
  if (isTextControl(event.target)) return
  deactivate(physicalKeyId(event))
}

function onPointerDown(event) {
  const key = event.target.closest('[data-key-id]')
  if (!key) return
  event.preventDefault()
  const code = key.dataset.keyId
  if (!code) return
  key.setPointerCapture?.(event.pointerId)
  // Pointer IDs let multi-touch presses release only their own key, including later pointer cancel.
  pointerCodes.set(event.pointerId, code)
  activate(code)
}

function onPointerUp(event) {
  const code = pointerCodes.get(event.pointerId)
  pointerCodes.delete(event.pointerId)
  deactivate(code)
}

function annotateKeys() {
  nextTick(() => {
    // SVG rendering is asynchronous relative to computed markup, so wait until Vue has
    // inserted it before adding the button semantics used by assistive technology.
    keys().forEach((key) => {
      key.setAttribute('role', key.dataset.keyId ? 'button' : '')
      key.setAttribute('aria-label', key.dataset.keyId ? `Test ${key.dataset.keyId}` : '')
    })
  })
}

watch(() => props.layout, annotateKeys)
watch(() => props.switchPart?.onePressSample, () => {
  audioError.value = ''
})
onMounted(() => {
  annotateKeys()
  // Window listeners cover physical key presses even when focus remains outside the component.
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearPressed)
  host.value?.addEventListener('pointerdown', onPointerDown)
  host.value?.addEventListener('pointerup', onPointerUp)
  host.value?.addEventListener('pointercancel', onPointerUp)
})

onBeforeUnmount(() => {
  clearPressed()
  // Stop and detach every in-flight sample before removing the component.
  pressedAudio.forEach((audio) => {
    audio.pause()
    audio.src = ''
  })
  pressedAudio.clear()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearPressed)
  host.value?.removeEventListener('pointerdown', onPointerDown)
  host.value?.removeEventListener('pointerup', onPointerUp)
  host.value?.removeEventListener('pointercancel', onPointerUp)
})
</script>

<template>
  <div ref="host" class="virtual-keyboard-tester">
    <div class="virtual-keyboard-tester__instruction">
      Click a key or use your keyboard to test the keys below.
    </div>
    <p v-if="audioError" class="virtual-keyboard-tester__audio-error" role="alert">
      {{ audioError }}
    </p>
    <div class="virtual-keyboard-tester__keyboard" v-html="svgMarkup"></div>
  </div>
</template>
