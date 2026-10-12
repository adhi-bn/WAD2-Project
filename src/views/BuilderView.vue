<script setup>
import { budget, compatibility } from '../stores/build.js'
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Builder</h1>
    <p class="text-neutral-400">Part pickers land here. Compatibility and budget update as you choose.</p>
    <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded border border-neutral-800 p-4">
        <dt class="text-xs uppercase tracking-wide text-neutral-500">Compatibility</dt>
        <dd>{{ compatibility.compatible ? 'Compatible' : 'Incomplete' }}</dd>
      </div>
      <div class="rounded border border-neutral-800 p-4">
        <dt class="text-xs uppercase tracking-wide text-neutral-500">Budget</dt>
        <dd>
          Total {{ budget.total }} &middot;
          {{ budget.withinBudget ? 'within budget' : 'over budget' }}
        </dd>
      </div>
    </dl>
  </section>
</template>
