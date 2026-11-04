<script setup>
defineProps({
  volume: { type: Number, required: true },
  volumePercent: { type: String, required: true },
  muted: { type: Boolean, required: true },
  volumeLabel: { type: String, default: 'Volume for key press sounds' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:volume', 'toggle-mute', 'volume-change'])
</script>

<template>
  <button
    type="button"
    class="ui-btn switch-audio__mute"
    :disabled="disabled"
    aria-label="Mute switch sample"
    :aria-pressed="muted"
    @click="emit('toggle-mute')"
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
      :value="volume"
      type="range"
      min="0"
      max="1"
      step="0.05"
      :disabled="disabled"
      :aria-label="volumeLabel"
      :aria-valuetext="volumePercent"
      @input="emit('update:volume', Number($event.target.value)); emit('volume-change')"
    >
    <output>{{ volumePercent }}</output>
  </label>
</template>
