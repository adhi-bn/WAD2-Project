<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  part: {
    type: Object,
    required: true,
  },
})

const volume = ref(0.7)
const muted = ref(false)
const playing = ref(false)
const loading = ref(false)
const status = ref('')
const sample = computed(() => props.part?.sample || '')
const volumePercent = computed(() => `${Math.round(volume.value * 100)}%`)
const profile = computed(() => props.part?.type || 'switch')
const profileLabel = computed(() => profile.value[0].toUpperCase() + profile.value.slice(1))
const duration = ref(0)
const currentTime = ref(0)

let audioContext
let gainNode
let sourceNode
let decodedSample
let decodedUrl
let requestId = 0
let loadController
let progressTimer
let playbackOffset = 0
let sourceStartedAt = 0

function releaseSource() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = undefined
  }
  if (sourceNode) {
    sourceNode.onended = null
    sourceNode.stop()
    sourceNode.disconnect()
  }
  if (gainNode) {
    gainNode.disconnect()
  }
  sourceNode = null
  gainNode = null
  playing.value = false
}

function cancelPlayback() {
  requestId += 1
  loadController?.abort()
  loadController = undefined
  releaseSource()
  loading.value = false
}

function updateGain() {
  if (gainNode) gainNode.gain.value = muted.value ? 0 : volume.value
}

function elapsedTime() {
  if (!audioContext || !playing.value) return playbackOffset
  return Math.min(duration.value, playbackOffset + audioContext.currentTime - sourceStartedAt)
}

function startProgressUpdates() {
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    currentTime.value = elapsedTime()
  }, 50)
}

function startSource(offset) {
  const source = audioContext.createBufferSource()
  const gain = audioContext.createGain()
  source.buffer = decodedSample
  gain.gain.value = muted.value ? 0 : volume.value
  source.connect(gain)
  gain.connect(audioContext.destination)
  source.onended = () => {
    if (sourceNode !== source) return
    source.disconnect()
    gain.disconnect()
    sourceNode = null
    gainNode = null
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = undefined
    }
    playbackOffset = duration.value
    currentTime.value = duration.value
    playing.value = false
    status.value = `Playback finished for ${props.part.name}.`
  }
  sourceNode = source
  gainNode = gain
  playbackOffset = offset
  sourceStartedAt = audioContext.currentTime
  currentTime.value = offset
  source.start(0, offset)
  playing.value = true
  startProgressUpdates()
}

async function playSample() {
  if (!sample.value) {
    status.value = `No recorded sample is available for ${props.part.name}.`
    return
  }
  if (loading.value) return
  if (playing.value) {
    playbackOffset = elapsedTime()
    currentTime.value = playbackOffset
    releaseSource()
    status.value = `Paused playback for ${props.part.name}.`
    return
  }

  const currentRequest = ++requestId
  releaseSource()
  loading.value = true
  status.value = `Loading recorded sample for ${props.part.name}.`

  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) throw new Error('Web Audio is unavailable')

    audioContext ||= new AudioContextClass()
    if (audioContext.state === 'suspended') await audioContext.resume()
    if (currentRequest !== requestId) return

    if (decodedUrl !== sample.value) {
      loadController = new AbortController()
      const response = await fetch(sample.value, { signal: loadController.signal })
      if (!response.ok) throw new Error(`Sample request failed (${response.status})`)
      const audioData = await response.arrayBuffer()
      if (currentRequest !== requestId) return
      decodedSample = await audioContext.decodeAudioData(audioData)
      if (!Number.isFinite(decodedSample.duration) || decodedSample.duration <= 0) {
        throw new Error('Recorded sample has no usable duration')
      }
      decodedUrl = sample.value
    }
    if (currentRequest !== requestId) return

    duration.value = decodedSample.duration
    playbackOffset = playbackOffset >= duration.value ? 0 : playbackOffset
    startSource(playbackOffset)
    status.value = `Playing ${profile.value} typing sample for ${props.part.name}${muted.value ? ' (muted)' : ''}.`
  } catch {
    if (currentRequest === requestId) {
      releaseSource()
      playing.value = false
      duration.value = 0
      currentTime.value = 0
      playbackOffset = 0
      status.value = `Could not play the recorded sample for ${props.part.name}. Try again later.`
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false
      loadController = undefined
    }
  }
}

function seekSample(event) {
  const target = Math.min(duration.value, Math.max(0, Number(event.target.value)))
  playbackOffset = target
  currentTime.value = target
  if (!playing.value) return

  releaseSource()
  startSource(target)
  status.value = `Playing ${profile.value} typing sample for ${props.part.name}${muted.value ? ' (muted)' : ''}.`
}

function toggleMute() {
  muted.value = !muted.value
  updateGain()
  status.value = muted.value
    ? `Muted${playing.value ? ` · playing ${props.part.name}` : ''}.`
    : `Sound on${playing.value ? ` · playing ${props.part.name}` : ''}.`
}

function formatTime(seconds) {
  const tenths = Math.round((Number.isFinite(seconds) ? seconds : 0) * 10)
  const minutes = Math.floor(tenths / 600)
  const secondsWithinMinute = Math.floor(tenths / 10) % 60
  return `${minutes}:${String(secondsWithinMinute).padStart(2, '0')}.${tenths % 10}`
}

watch([() => props.part?.id, sample], () => {
  cancelPlayback()
  decodedSample = undefined
  decodedUrl = undefined
  duration.value = 0
  currentTime.value = 0
  playbackOffset = 0
  status.value = sample.value
    ? `Recorded ${profile.value} typing sample linked to ${props.part.name}.`
    : `No recorded sample is available for ${props.part.name}.`
}, { immediate: true })

onBeforeUnmount(() => {
  cancelPlayback()
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
        <p v-if="sample">Recorded {{ profileLabel }} typing sample · {{ part.name }}</p>
        <p v-else>No recorded sample available · {{ part.name }}</p>
      </div>
      <span class="switch-audio__badge">{{ sample ? 'Recorded sample' : 'Sample unavailable' }}</span>
    </div>

    <div class="switch-audio__player">
      <div class="switch-audio__controls">
        <button
          type="button"
          class="ui-btn primary"
          :disabled="!sample || loading"
          :aria-label="loading ? `Loading sample for ${part.name}` : `${playing ? 'Pause' : 'Play'} sample for ${part.name}`"
          :aria-pressed="playing"
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
            :aria-label="`Volume for ${part.name} sample`"
            @input="updateGain"
          />
          <output>{{ volumePercent }}</output>
        </label>
      </div>

      <div class="switch-audio__timeline">
        <label class="visually-hidden" :for="`switch-audio-seek-${part.id}`">Seek in {{ part.name }} sample</label>
        <input
          :id="`switch-audio-seek-${part.id}`"
          class="switch-audio__seek"
          type="range"
          min="0"
          :max="duration"
          step="0.01"
          :value="currentTime"
          :disabled="!sample || !duration"
          :aria-valuetext="`${formatTime(currentTime)} of ${duration ? formatTime(duration) : 'unknown duration'}`"
          @input="seekSample"
        />
        <div class="switch-audio__time" aria-hidden="true">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ duration ? formatTime(duration) : '--.-' }}</span>
        </div>
      </div>
    </div>

    <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {{ status }}
    </p>
  </section>
</template>
