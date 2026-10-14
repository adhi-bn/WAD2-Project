<script setup>
import { computed } from 'vue'
import { build, budget, compatibility } from '../stores/build.js'

// SGD at cent precision via the platform formatter; no new util or dependency.
// currencyDisplay 'code' renders an unambiguous "SGD" label, not a bare "$".
const money = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'code',
})

// Domain contract: { compatible, reasons, incomplete, incompatible }.
// incomplete = a slot is missing; incompatible = a clash among chosen Parts.
// Both can be true at once, and a false `compatible` always carries at least
// one flag, so show every flag that applies.
const flags = computed(() => {
  const result = compatibility.value
  if (result.compatible) return ['Compatible']
  const labels = []
  if (result.incomplete) labels.push('Incomplete')
  if (result.incompatible) labels.push('Incompatible')
  return labels
})

const totalText = computed(() =>
  budget.value.total == null ? null : money.format(budget.value.total),
)
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Builder</h1>
    <p class="text-neutral-400">Part pickers land here. Compatibility and budget update as you choose.</p>
    <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded border border-neutral-800 p-4">
        <dt class="text-xs uppercase tracking-wide text-neutral-500">Compatibility</dt>
        <dd>{{ flags.join(' + ') }}</dd>
        <dd v-if="compatibility.reasons.length">
          <ul>
            <li v-for="reason in compatibility.reasons" :key="reason">{{ reason }}</li>
          </ul>
        </dd>
      </div>
      <div class="rounded border border-neutral-800 p-4">
        <dt class="text-xs uppercase tracking-wide text-neutral-500">Budget</dt>
        <dd v-if="budget.error">Budget unavailable: {{ budget.error }}</dd>
        <dd v-else-if="totalText == null">Budget unavailable</dd>
        <dd v-else>
          Total {{ totalText }} &middot;
          <template v-if="build.limit == null">no target set</template>
          <template v-else>{{ budget.withinBudget ? 'within budget' : 'over budget' }}</template>
        </dd>
      </div>
    </dl>
  </section>
</template>
