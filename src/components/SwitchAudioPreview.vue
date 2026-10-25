<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  part: {
    type: Object,
    default: null,
  },
})

const volume = ref(0.7)
const muted = ref(false)
const playing = ref(false)
const loading = ref(false)
const seeking = ref(false)
const status = ref('')
const playbackError = ref('')
const sample = computed(() => props.part?.sample || '')
const volumePercent = computed(() => `${Math.round(volume.value * 100)}%`)
const profile = computed(() => props.part?.type || 'switch')
const profileLabel = computed(() => `${profile.value.charAt(0).toUpperCase()}${profile.value.slice(1)}`)
const partName = computed(() => props.part?.name || 'Selected switch')
const seekId = computed(() => `switch-audio-seek-${props.part?.id ?? 'selected-switch'}`)
const duration = ref(0)
const currentTime = ref(0)

let audioContext
let gainNode
let sourceNode
let decodedSample
let requestId = 0
let loadController
let progressTimer
let playbackOffset = 0
let sourceStartedAt = 0

/**
 * Stops the active source and disconnects it from the persistent gain node.
 * @param {boolean} [stopSource=true] Whether to stop the source before disconnecting it.
 * @returns {void}
 */
function releaseSource(stopSource = true) {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = undefined
  }
  if (sourceNode) {
    sourceNode.onended = null
    if (stopSource) sourceNode.stop()
    sourceNode.disconnect()
  }
  sourceNode = null
  playing.value = false
}

/**
 * Invalidates pending loads and releases current playback resources.
 * @returns {void}
 */
function cancelPlayback() {
  requestId += 1
  loadController?.abort()
  loadController = undefined
  releaseSource()
  loading.value = false
  seeking.value = false
}

/**
 * Applies the current mute and volume settings to the active gain node.
 * @returns {void}
 */
function updateGain() {
  if (gainNode) gainNode.gain.value = muted.value ? 0 : volume.value
}

/**
 * Calculates playback time from the saved offset and AudioContext clock.
 * @returns {number} Current playback time in seconds.
 */
function elapsedTime() {
  if (!audioContext || !playing.value) return playbackOffset
  // The context clock is monotonic, so elapsed time stays stable between timer ticks.
  return Math.min(duration.value, playbackOffset + audioContext.currentTime - sourceStartedAt)
}

/**
 * Starts the timer that keeps the visible seek position current.
 * @returns {void}
 */
function startProgressUpdates() {
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    // Avoid having the playback clock fight the value currently being dragged.
    if (!seeking.value) currentTime.value = elapsedTime()
  }, 50)
}

/**
 * Creates and starts a source at a specific offset in the decoded sample.
 * @param {number} offset Playback offset in seconds.
 * @returns {void}
 */
function startSource(offset) {
  const source = audioContext.createBufferSource()
  // Reuse one gain node across pause and seek restarts instead of rebuilding the output graph.
  if (!gainNode) {
    gainNode = audioContext.createGain()
    gainNode.connect(audioContext.destination)
  }
  source.buffer = decodedSample
  gainNode.gain.value = muted.value ? 0 : volume.value
  source.connect(gainNode)
  source.onended = () => {
    if (sourceNode !== source) return
    releaseSource(false)
    playbackOffset = duration.value
    currentTime.value = duration.value
    status.value = `Playback finished for ${partName.value}.`
  }
  sourceNode = source
  playbackOffset = offset
  sourceStartedAt = audioContext.currentTime
  currentTime.value = offset
  source.start(0, offset)
  playing.value = true
  startProgressUpdates()
}

/**
 * Loads, decodes, or resumes the selected sample after an explicit user action.
 * @returns {Promise<void>}
 */
async function playSample() {
  if (!sample.value) {
    status.value = `No recorded sample is available for ${partName.value}.`
    return
  }
  if (loading.value) return
  if (playing.value) {
    playbackOffset = elapsedTime()
    currentTime.value = playbackOffset
    releaseSource()
    status.value = `Paused playback for ${partName.value}.`
    return
  }

  const currentRequest = ++requestId
  const targetUrl = sample.value
  releaseSource()
  loading.value = true
  playbackError.value = ''
  status.value = `Loading recorded sample for ${partName.value}.`

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) throw new Error('Web Audio is unavailable')

    audioContext ||= new AudioContextClass()
    if (audioContext.state === 'suspended') await audioContext.resume()
    if (currentRequest !== requestId) return

    if (!decodedSample) {
      loadController = new AbortController()
      const response = await fetch(targetUrl, { signal: loadController.signal })
      if (!response.ok) throw new Error(`Sample request failed (${response.status})`)
      const audioData = await response.arrayBuffer()
      if (currentRequest !== requestId) return
      const decoded = await audioContext.decodeAudioData(audioData)
      if (currentRequest !== requestId) return
      if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
        throw new Error('Recorded sample has no usable duration')
      }
      // Decode is not abortable; only publish the buffer if this Part is still selected.
      decodedSample = decoded
    }
    if (currentRequest !== requestId) return

    duration.value = decodedSample.duration
    playbackOffset = playbackOffset >= duration.value ? 0 : playbackOffset
    startSource(playbackOffset)
    status.value = `Playing ${profile.value} typing sample for ${partName.value}${muted.value ? ' (muted)' : ''}.`
  } catch {
    if (currentRequest === requestId) {
      releaseSource()
      playing.value = false
      duration.value = 0
      currentTime.value = 0
      playbackOffset = 0
      playbackError.value = `Could not play the recorded sample for ${partName.value}. Try again later.`
      status.value = ''
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false
      loadController = undefined
    }
  }
}

/**
 * Reads and bounds the requested seek position to the decoded sample.
 * @param {Event} event Input or change event from the seek slider.
 * @returns {number} A valid playback position in seconds.
 */
function getSeekTarget(event) {
  const requestedTime = Number(event.target.value)
  // Range events should be numeric; prevent invalid input from poisoning playback math.
  return Number.isFinite(requestedTime)
    ? Math.min(duration.value, Math.max(0, requestedTime))
    : 0
}

/**
 * Updates the seek preview without restarting playback while the slider is dragged.
 * @param {Event} event Input event from the seek slider.
 * @returns {void}
 */
function previewSeek(event) {
  seeking.value = true
  currentTime.value = getSeekTarget(event)
}

/**
 * Commits a seek and restarts the source only when the user finishes adjusting it.
 * @param {Event} event Change event from the seek slider.
 * @returns {void}
 */
function seekSample(event) {
  const target = getSeekTarget(event)
  seeking.value = false
  playbackOffset = target
  currentTime.value = target
  if (!playing.value) return

  releaseSource()
  startSource(target)
  status.value = `Playing ${profile.value} typing sample for ${partName.value}${muted.value ? ' (muted)' : ''}.`
}

/**
 * Toggles mute and synchronizes the active gain node.
 * @returns {void}
 */
function toggleMute() {
  muted.value = !muted.value
  updateGain()
  status.value = muted.value
    ? `Muted${playing.value ? ` · playing ${partName.value}` : ''}.`
    : `Sound on${playing.value ? ` · playing ${partName.value}` : ''}.`
}

/**
 * Unmutes playback when the user changes the volume slider.
 * @returns {void}
 */
function changeVolume() {
  muted.value = false
  updateGain()
}

/**
 * Formats a playback time with tenths of a second.
 * @param {number} seconds Time in seconds.
 * @returns {string} A minutes, seconds, and tenths display value.
 */
function formatTime(seconds) {
  const tenths = Math.round((Number.isFinite(seconds) ? seconds : 0) * 10)
  const minutes = Math.floor(tenths / 600)
  const secondsWithinMinute = Math.floor(tenths / 10) % 60
  return `${minutes}:${String(secondsWithinMinute).padStart(2, '0')}.${tenths % 10}`
}

watch([() => props.part?.id, sample], () => {
  cancelPlayback()
  decodedSample = undefined
  duration.value = 0
  currentTime.value = 0
  playbackOffset = 0
  playbackError.value = ''
  status.value = sample.value
    ? `Recorded ${profile.value} typing sample linked to ${partName.value}.`
    : `No recorded sample is available for ${partName.value}.`
}, { immediate: true })

onBeforeUnmount(() => {
  cancelPlayback()
  gainNode?.disconnect()
  gainNode = null
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch((error) => console.error('Failed to close switch audio context', error))
  }
})
</script>

<template>
  <section class="switch-audio" aria-labelledby="switch-audio-title">
    <div class="switch-audio__heading">
      <div>
        <h3 id="switch-audio-title">Hear your selected switch</h3>
        <p v-if="sample">Recorded {{ profileLabel }} typing sample · {{ partName }}</p>
        <p v-else>No recorded sample available · {{ partName }}</p>
      </div>
      <span class="switch-audio__badge">{{ sample ? 'Recorded sample' : 'Sample unavailable' }}</span>
    </div>

    <div class="switch-audio__player">
      <div class="switch-audio__controls">
        <button
          type="button"
          class="ui-btn primary"
          :disabled="!sample || loading"
          :aria-label="loading ? `Loading sample for ${partName}` : `${playing ? 'Pause' : 'Play'} sample for ${partName}`"
          @click="playSample"
        >
          {{ loading ? 'Loading…' : playing ? 'Pause' : 'Play' }}
        </button>
        <button
          type="button"
          class="ui-btn switch-audio__mute"
          :disabled="!sample"
          :aria-pressed="muted"
          :aria-label="muted ? 'Unmute switch sample' : 'Mute switch sample'"
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
        <label class="switch-audio__volume" :class="{ 'is-muted': muted }">
          <span>Volume</span>
          <input
            v-model.number="volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :disabled="!sample"
            :aria-label="`Volume for ${partName} sample`"
            @input="changeVolume"
          />
          <output>{{ volumePercent }}</output>
        </label>
      </div>

      <div class="switch-audio__timeline">
        <label class="visually-hidden" :for="seekId">Seek in {{ partName }} sample</label>
        <input
          :id="seekId"
          class="switch-audio__seek"
          type="range"
          min="0"
          :max="duration"
          step="0.01"
          :value="currentTime"
          :disabled="!sample || !duration"
          :aria-valuetext="`${formatTime(currentTime)} of ${duration ? formatTime(duration) : 'unknown duration'}`"
          @input="previewSeek"
          @change="seekSample"
        />
        <div class="switch-audio__time" aria-hidden="true">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ duration ? formatTime(duration) : '--.-' }}</span>
        </div>
      </div>
    </div>

    <p v-if="playbackError" class="switch-audio__error" role="alert">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 7.5v5m0 3h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      {{ playbackError }}
    </p>
    <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {{ status }}
    </p>
  </section>
</template>
