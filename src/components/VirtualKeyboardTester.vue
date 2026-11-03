<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { kbSVG } from '../logic/builder.js'
import { createSwitchAudioContext, decodeSwitchSample, resumeSwitchAudioContext } from '../lib/switchAudio.js'
import SwitchAudioControls from './SwitchAudioControls.vue'

const props = defineProps({
  layout: { type: String, required: true },
  switchPart: { type: Object, default: null },
})

const host = ref(null)
const svgMarkup = computed(() => kbSVG(props.layout))
// Keep interaction state outside Vue because the generated SVG is inserted as raw HTML.
const pressedCodes = new Set()
const keyboardCodes = new Set()
const pointerCodes = new Map()
let renderedKeys = []
const audioError = ref('')
const volume = ref(0.7)
const muted = ref(false)
const audioStatus = ref('')
const volumePercent = computed(() => `${Math.round(volume.value * 100)}%`)
const switchName = computed(() => props.switchPart?.name || 'this switch')

let audioContext
const decodedSamples = new Map()
let masterGain
const pendingSamples = new Map()

// Printable characters may change position on different keyboard layouts, so resolve them
// by the reported key value before falling back to physical browser codes for special keys.
const SYMBOL_CODES = { '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash', '`': 'Backquote' }
const SHIFTED_SYMBOL_CODES = { '!': 'Digit1', '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5', '^': 'Digit6', '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0', '_': 'Minus', '+': 'Equal', '{': 'BracketLeft', '}': 'BracketRight', '|': 'Backslash', ':': 'Semicolon', '"': 'Quote', '<': 'Comma', '>': 'Period', '?': 'Slash', '~': 'Backquote' }

/** Resolves layout-dependent characters by value and unambiguous special keys by position. */
function physicalKeyId(event) {
  const character = event.key?.toLowerCase()
  // Numpad key values can look like printable keys (or arrows), so trust their physical code first.
  if (/^Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)$/.test(event.code || '')) return event.code
  // Letters are layout-sensitive, so prefer event.key over the physical code when available.
  if (character && /^[a-z]$/.test(character)) return `Key${character.toUpperCase()}`
  if (/^[0-9]$/.test(character || '') ) return `Digit${character}`
  if (SYMBOL_CODES[character]) return SYMBOL_CODES[character]
  if (SHIFTED_SYMBOL_CODES[character]) return SHIFTED_SYMBOL_CODES[character]
  // Some browser and assistive-technology key events omit event.key; retain the code in that case.
  if (!character && /^Key[A-Z]$/.test(event.code || '')) return event.code
  if (!character && /^Digit[0-9]$/.test(event.code || '')) return event.code
  if (event.code === 'Space') return 'Space'
  const specialKeys = new Set(['Enter', 'Tab', 'Backspace', 'Escape', 'CapsLock', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'PrintScreen', 'ScrollLock', 'Pause', 'NumLock'])
  if (/^F(?:[1-9]|1[0-2])$/.test(event.code)) return event.code
  if (/^Numpad/.test(event.code)) return event.code
  return specialKeys.has(event.code) ? event.code : ''
}

function setPressed(code, pressed) {
  // The SVG can contain empty key slots, so ignore codes that do not have a rendered key.
  if (!code || !renderedKeys.some((key) => key.dataset.keyId === code)) return
  if (pressed) pressedCodes.add(code)
  else pressedCodes.delete(code)
  renderedKeys.forEach((key) => {
    if (key.dataset.keyId === code) key.classList.toggle('pressed', pressedCodes.has(code))
  })
}

function clearPressed() {
  [...pressedCodes].forEach((code) => setPressed(code, false))
  keyboardCodes.clear()
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
    if (!audioContext || audioContext.state === 'closed') audioContext = createSwitchAudioContext()
    await resumeSwitchAudioContext(audioContext)
  } catch {
    audioError.value = 'Switch sound playback was blocked. Try pressing a key again.'
    audioStatus.value = `Playback of the ${switchName.value} recording was blocked.`
    return
  }

  try {
    if (!decodedSamples.has(source)) {
      // Share in-flight fetch/decode work when keys are pressed before the first load completes.
      pendingSamples.set(source, pendingSamples.get(source) || (async () => {
        const decoded = await decodeSwitchSample(audioContext, source)
        decodedSamples.set(source, decoded)
        return decoded
      })())
    }
    let buffer
    try { buffer = decodedSamples.get(source) || await pendingSamples.get(source) }
    finally { pendingSamples.delete(source) }

    const audioSource = audioContext.createBufferSource()
    audioSource.buffer = buffer
    if (!masterGain) {
      masterGain = audioContext.createGain()
      masterGain.connect(audioContext.destination)
    }
    masterGain.gain.value = muted.value ? 0 : volume.value
    audioSource.connect(masterGain)
    audioSource.start(0)
    audioError.value = ''
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
  if (masterGain) masterGain.gain.value = muted.value ? 0 : volume.value
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

/** Unmutes audio when the user adjusts the volume slider and synchronizes status text.
 * @returns {void}
 */
function changeVolume() {
  muted.value = false
  if (masterGain) masterGain.gain.value = volume.value
  audioStatus.value = `Switch sounds on at ${volumePercent.value}.`
}

function isTextControl(target) {
  // Typing inside text-editing controls belongs to that control, not to the keyboard tester.
  // A range input is a volume control, so letters and other typing keys should still test the keyboard.
  if (!(target instanceof HTMLElement)) return false
  const rangeInput = target.tagName === 'INPUT' && target.type === 'range'
  return !rangeInput && (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

function onKeyDown(event) {
  if (isTextControl(event.target)) return
  const target = event.target instanceof HTMLElement ? event.target : null
  const interactiveControl = target && (['BUTTON', 'A'].includes(target.tagName) || target.closest('[role="button"]'))
  if (interactiveControl && [' ', 'Enter'].includes(event.key)) return
  const isRangeInput = event.target instanceof HTMLElement && event.target.tagName === 'INPUT' && event.target.type === 'range'
  if (isRangeInput && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(physicalKeyId(event))) return
  // Modifier shortcuts should stay available to the browser unless their target key is a
  // physical modifier, such as Control or Alt itself.
  const modifier = ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight']
  const code = physicalKeyId(event)
  if ((event.ctrlKey || event.metaKey || event.altKey) && !modifier.includes(code)) return
  if (!code || !renderedKeys.some((key) => key.dataset.keyId === code)) return
  if (code === 'Space') event.preventDefault()
  if (event.repeat) return
  activate(code)
  keyboardCodes.add(code)
}

function onKeyUp(event) {
  if (isTextControl(event.target)) return
  const code = physicalKeyId(event)
  keyboardCodes.delete(code)
  if (![...pointerCodes.values()].includes(code)) deactivate(code)
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
  if (!keyboardCodes.has(code) && ![...pointerCodes.values()].includes(code)) deactivate(code)
}

watch(() => props.switchPart?.onePressSample, () => {
  audioError.value = ''
  audioStatus.value = props.switchPart?.onePressSample
    ? `${switchName.value} recording linked.`
    : `No recording available for ${switchName.value}.`
})
watch(() => props.layout, async () => {
  clearPressed()
  await nextTick()
  renderedKeys = [...(host.value?.querySelectorAll('[data-key-id]') || [])]
})
watch(volume, (value) => {
  if (masterGain) masterGain.gain.value = muted.value ? 0 : value
})
onMounted(() => {
  renderedKeys = [...(host.value?.querySelectorAll('[data-key-id]') || [])]
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
  host.value?.addEventListener('lostpointercapture', onPointerUp)
})

onBeforeUnmount(() => {
  // Release browser listeners even if a one-shot sound has already ended or context teardown fails.
  clearPressed()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearPressed)
  host.value?.removeEventListener('pointerdown', onPointerDown)
  host.value?.removeEventListener('pointerup', onPointerUp)
  host.value?.removeEventListener('pointercancel', onPointerUp)
  host.value?.removeEventListener('lostpointercapture', onPointerUp)
  renderedKeys = []
  try { masterGain?.disconnect() } catch { /* the browser may have already closed the audio graph */ }
  masterGain = null
  if (audioContext && audioContext.state !== 'closed') {
    try { Promise.resolve(audioContext.close()).catch(() => {}) } catch { /* prefixed contexts may close synchronously */ }
  }
})
</script>

<template>
  <div ref="host" class="virtual-keyboard-tester" role="group" :aria-label="`Keyboard tester controls for ${switchName}`" tabindex="0">
    <div class="virtual-keyboard-tester__instruction">
      Click a key or use your keyboard to test the keys below.
    </div>
    <!-- Errors are announced immediately, while successful audio state uses a polite status region below. -->
    <p v-if="audioError" class="virtual-keyboard-tester__audio-error" role="alert">
      {{ audioError }}
    </p>
    <div class="virtual-keyboard-tester__keyboard" v-html="svgMarkup"></div>
    <div class="virtual-keyboard-tester__audio-controls">
      <SwitchAudioControls
        v-model:volume="volume"
        :volume-percent="volumePercent"
        :muted="muted"
        @toggle-mute="toggleMute"
        @volume-change="changeVolume"
      />
    </div>
    <p class="virtual-keyboard-tester__audio-status" role="status" aria-live="polite">{{ audioStatus }}</p>
  </div>
</template>
