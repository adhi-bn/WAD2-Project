<template>
  <div class="about-keyboard-visual" aria-hidden="true">
    <div class="about-keyboard-visual__badge">40% Compact</div>
    <div class="about-keyboard-visual__case">
      <div v-for="key in 52" :key="key" class="about-keyboard-visual__key"></div>
    </div>
    <span class="about-keyboard-visual__shadow"></span>
  </div>
</template>
