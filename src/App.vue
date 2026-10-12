<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-100">
    <header class="border-b border-neutral-800">
      <nav class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <RouterLink to="/" class="text-lg font-semibold tracking-tight">Lechaton Typers</RouterLink>
        <div class="flex items-center gap-1 text-sm">
          <RouterLink to="/" class="rounded px-3 py-1.5 hover:bg-neutral-800">Home</RouterLink>
          <RouterLink to="/builder" class="rounded px-3 py-1.5 hover:bg-neutral-800">Builder</RouterLink>
        </div>
      </nav>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-10">
      <RouterView />
    </main>
  </div>
</template>
