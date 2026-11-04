<script setup>
import VirtualKeyboardTester from './VirtualKeyboardTester.vue'

const props = defineProps({
  build: { type: Object, default: null },
  layout: { type: String, required: true },
  switchPart: { type: Object, default: null },
})
</script>

<template>
  <div class="view-placeholder">
    <div class="eyebrow">Type tester</div>
    <VirtualKeyboardTester :layout="props.layout" :switch-part="props.switchPart" />
  </div>
</template>

<style scoped>
.view-placeholder {
  min-height: 520px;
  text-align: center;
  border: 1px dashed var(--lct-line-grey);
  border-radius: 16px;
  background: #f3f4f8;
  padding: 24px;
}
.eyebrow {
  margin-bottom: 18px;
}

@media (max-width: 760px) {
  .view-placeholder {
    min-height: 380px;
    padding: 16px 12px;
  }
}
</style>
