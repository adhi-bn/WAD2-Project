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
const audioError = ref('')
const volume = ref(0.7)
const muted = ref(false)
const audioStatus = ref('')
const volumePercent = computed(() => `${Math.round(volume.value * 100)}%`)
const switchName = computed(() => props.switchPart?.name || 'Selected switch')

let audioContext
const decodedSamples = new Map()
const activeSources = new Set()
const activeGainNodes = new Set()

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

async function playSwitchSound() {
  const source = props.switchPart?.onePressSample
  if (!source) {
    audioError.value = `Switch sound is unavailable for ${switchName.value}.`
    audioStatus.value = `No recording for ${switchName.value}.`
    return
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) throw new Error('Web Audio is unavailable')
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass()
    if (audioContext.state !== 'running') await audioContext.resume()
    if (audioContext.state !== 'running') throw new Error('Web Audio context did not resume')
  } catch {
    audioError.value = 'Switch sound playback was blocked. Try pressing a key again.'
    audioStatus.value = `Playback of the ${switchName.value} recording was blocked.`
    return
  }

  try {
    let buffer = decodedSamples.get(source)
    if (!buffer) {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`Sample request failed (${response.status})`)
      const data = await response.arrayBuffer()
      buffer = await audioContext.decodeAudioData(data)
      decodedSamples.set(source, buffer)
    }

    const audioSource = audioContext.createBufferSource()
    audioSource.buffer = buffer
    if (typeof audioContext.createGain === 'function') {
      const gainNode = audioContext.createGain()
      gainNode.gain.value = muted.value ? 0 : volume.value
      audioSource.connect(gainNode)
      gainNode.connect(audioContext.destination)
      activeGainNodes.add(gainNode)
      audioSource.onended = () => {
        activeSources.delete(audioSource)
        activeGainNodes.delete(gainNode)
      }
    } else {
      audioSource.connect(audioContext.destination)
      audioSource.onended = () => activeSources.delete(audioSource)
    }
    activeSources.add(audioSource)
    audioSource.start(0)
    audioStatus.value = muted.value
      ? `Muted ${switchName.value} key press sound.`
      : `Playing ${switchName.value} key press sound.`
  } catch {
    audioError.value = 'Switch sound could not be loaded.'
    audioStatus.value = `Could not load the recording for ${switchName.value}.`
  }
}

/** Toggles mute for subsequent and currently active key press sounds. */
function toggleMute() {
  muted.value = !muted.value
  activeGainNodes.forEach((gainNode) => {
    gainNode.gain.value = muted.value ? 0 : volume.value
  })
  audioStatus.value = muted.value
    ? 'Muted switch sounds.'
    : `Unmuted switch sounds at ${volumePercent.value}.`
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
  // Typing inside text-editing controls belongs to that control, not to the keyboard tester.
  // A range input is a volume control, so letters and other typing keys should still test the keyboard.
  if (!(target instanceof HTMLElement)) return false
  const rangeInput = target.tagName === 'INPUT' && target.type === 'range'
  return !rangeInput && (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) ||
    Boolean(target.closest('[role="button"], [contenteditable="true"]'))
  )
}

function onKeyDown(event) {
  if (isTextControl(event.target)) return
  const isRangeInput = event.target instanceof HTMLElement && event.target.tagName === 'INPUT' && event.target.type === 'range'
  if (isRangeInput && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(physicalKeyId(event))) return
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
  audioStatus.value = props.switchPart?.onePressSample
    ? `${switchName.value} recording linked.`
    : `No recording available for ${switchName.value}.`
})
watch(volume, (value) => {
  activeGainNodes.forEach((gainNode) => {
    gainNode.gain.value = muted.value ? 0 : value
  })
})
onMounted(() => {
  annotateKeys()
  audioStatus.value = props.switchPart?.onePressSample
    ? `${switchName.value} recording linked.`
    : `No recording available for ${switchName.value}.`
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
  activeSources.forEach((source) => source.stop())
  activeSources.clear()
  activeGainNodes.clear()
  if (audioContext && audioContext.state !== 'closed') audioContext.close().catch?.(() => {})
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
    <div class="virtual-keyboard-tester__audio-controls">
      <button
        type="button"
        class="ui-btn switch-audio__mute"
        aria-label="Mute switch sample"
        :aria-pressed="muted"
        @click="toggleMute"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          <path v-if="muted" d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <template v-else>
            <path d="M15 9a5 5 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <path d="M18 6a9 9 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </template>
        </svg>
      </button>
      <label class="virtual-keyboard-tester__volume switch-audio__volume" :class="{ 'is-muted': muted }">
        <span>Volume</span>
        <input
          v-model.number="volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Volume for key press sounds"
          :aria-valuetext="volumePercent"
          @input="muted = false"
        >
        <output>{{ volumePercent }}</output>
      </label>
    </div>
    <p class="virtual-keyboard-tester__audio-status" role="status" aria-live="polite">{{ audioStatus }}</p>
  </div>
</template>
