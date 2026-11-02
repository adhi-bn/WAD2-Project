<script setup>
// Placeholder for the 3D view of the build. Replace this file with the 3D view component when it's ready.
defineProps({
  build: { type: Object, default: null },
})
</script>

<template>
  <div class="view-placeholder">
    <div class="eyebrow">3D view</div>
    <p>Coming soon: a 3D view of this build.</p>
  </div>
</template>

<style scoped>
.view-placeholder {
  min-height: 260px;
  display: grid;
  place-content: center;
  text-align: center;
  border: 1px dashed var(--lct-line-grey);
  border-radius: 16px;
  background: #f3f4f8;
  padding: 24px;
}
.view-placeholder p {
  margin: 8px 0 0;
  color: var(--lct-muted-ink);
}
</style>
