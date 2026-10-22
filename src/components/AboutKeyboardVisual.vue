<template>
  <div class="about-keyboard-visual" aria-hidden="true">
    <div class="about-keyboard-visual__badge">75%</div>
    <div class="about-keyboard-visual__case">
      <div v-for="key in keys" :key="key" class="about-keyboard-visual__key"></div>
    </div>
    <span class="about-keyboard-visual__shadow"></span>
  </div>
</template>

<script setup>
const keys = Array.from({ length: 52 }, (_, index) => index)
</script>
