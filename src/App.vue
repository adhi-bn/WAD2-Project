<script setup>
import { RouterLink, RouterView } from 'vue-router'
import FatCat from './components/FatCat.vue'
</script>

<template>
  <div class="lct-shell">
    <header class="border-bottom border-2">
      <nav class="container d-flex align-items-center justify-content-between gap-4 px-0 py-3">
        <RouterLink to="/" class="brand">Le Chaton Typers</RouterLink>
        <div class="d-flex gap-2">
          <RouterLink to="/" class="navlink">Home</RouterLink>
          <RouterLink to="/builder" class="navlink">Builder</RouterLink>
        </div>
      </nav>
    </header>
    <main class="flex-fill">
      <div class="lct-container py-4">
        <RouterView />
      </div>
    </main>
    <FatCat />
  </div>
</template>
