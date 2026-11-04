<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BuildPreviewCanvas from '../components/BuildPreviewCanvas.vue'
import { toCents } from '../domain/build.js'
import { CATS } from '../data/catalog.js'
import { money, total } from '../logic/builder.js'
import { buildFromIds, openSavedBuild, refreshSaved, state } from '../store.js'

const router = useRouter()
const leftId = ref('')
const rightId = ref('')

const COMPONENT_GROUPS = [
  { id: 'case', label: 'Case', partKeys: ['case'] },
  { id: 'plate', label: 'Plate', partKeys: ['plate'] },
  { id: 'pcb', label: 'PCB', partKeys: ['pcb'] },
  { id: 'switches', label: 'Switches', partKeys: ['switches'] },
  { id: 'keycaps', label: 'Keycaps', partKeys: ['keycaps'] },
  { id: 'addons', label: 'Add-ons', partKeys: ['stabs', 'foam', 'cable'] },
]

/**
 * Determines whether a part descriptor is present and has a valid finite numeric price.
 *
 * @param {object|null|undefined} part - Part object to validate.
 * @returns {boolean} True if part exists and has a finite numeric price.
 */
function isPartValid(part) {
  return Boolean(part && Number.isFinite(part?.price))
}

/**
 * Prepares a saved Build for comparison without silently replacing discontinued Parts.
 *
 * @param {object} saved - Row from the saved-Build library.
 * @returns {object} Build data with safe Parts and a nullable total.
 */
function comparisonBuild(saved) {
  // A saved Build may reference a discontinued Part, so keep the missing selection visible.
  const parts = buildFromIds(saved.layout, saved.part_ids || {})
  const hasUnavailablePart = CATS.some((key) => !isPartValid(parts[key]))
  return { ...saved, parts, total: hasUnavailablePart ? null : total(parts) }
}

const builds = computed(() => state.savedBuilds.map(comparisonBuild))

const leftBuild = computed(() => builds.value.find((build) => build.id === leftId.value) || null)
const rightBuild = computed(() => builds.value.find((build) => build.id === rightId.value) || null)
const canCompare = computed(() => Boolean(leftBuild.value && rightBuild.value && leftId.value !== rightId.value))
const priceDifference = computed(() => (
  canCompare.value && Number.isFinite(leftBuild.value.total) && Number.isFinite(rightBuild.value.total)
    ? leftBuild.value.total - rightBuild.value.total
    : null
))

/**
 * Gives a price comparison its visual and screen-reader state.
 *
 * @param {number|null|undefined} amount - Amount for the current Build or Component Group.
 * @param {number|null|undefined} comparedAmount - Amount on the other compared Build.
 * @returns {'is-higher'|'is-lower'|'is-equal'|'is-unavailable'} Comparison state.
 */
function priceClass(amount, comparedAmount) {
  if (!Number.isFinite(amount) || !Number.isFinite(comparedAmount)) return 'is-unavailable'
  if (amount > comparedAmount) return 'is-higher'
  if (amount < comparedAmount) return 'is-lower'
  return 'is-equal'
}

/**
 * Provides a colour-independent marker for an amount relative to its counterpart.
 *
 * @param {number|null|undefined} amount - Amount for the current Build or Component Group.
 * @param {number|null|undefined} comparedAmount - Amount on the other compared Build.
 * @returns {string} A compact visual marker.
 */
function priceMarker(amount, comparedAmount) {
  return { 'is-higher': '↑', 'is-lower': '↓', 'is-equal': '•', 'is-unavailable': '-' }[priceClass(amount, comparedAmount)]
}

/**
 * Explains a comparison marker to assistive technology.
 *
 * @param {number|null|undefined} amount - Amount for the current Build or Component Group.
 * @param {number|null|undefined} comparedAmount - Amount on the other compared Build.
 * @returns {string} Plain-language comparison status.
 */
function priceDescription(amount, comparedAmount) {
  return { 'is-higher': 'Higher amount. ', 'is-lower': 'Lower amount. ', 'is-equal': 'Same amount. ', 'is-unavailable': 'Amount unavailable. ' }[priceClass(amount, comparedAmount)]
}

/**
 * Combines the legacy saved-part keys into one canonical Component Group.
 *
 * @param {object} build - Saved Build prepared for comparison.
 * @param {{partKeys: string[]}} group - Canonical Component Group definition.
 * @returns {Array<object|undefined>} Parts represented by the Component Group.
 */
function partsForGroup(build, group) {
  return group.partKeys.map((key) => build?.parts?.[key])
}

/**
 * Determines whether any Part in a Component Group is missing or discontinued.
 *
 * @param {object} build - Saved Build prepared for comparison.
 * @param {{partKeys: string[]}} group - Canonical Component Group definition.
 * @returns {boolean} True if any part is null, undefined, or lacks a valid price.
 */
function hasGroupMissingPart(build, group) {
  return partsForGroup(build, group).some((part) => !isPartValid(part))
}

/**
 * Formats a Component Group without crashing when a historical Part disappeared.
 *
 * @param {object} build - Saved Build prepared for comparison.
 * @param {{partKeys: string[]}} group - Canonical Component Group definition.
 * @returns {string} Joined Part names or an unavailable fallback.
 */
function groupPartNames(build, group) {
  const parts = partsForGroup(build, group)
  // If any part in the group is missing or has no finite price, report Unavailable
  if (parts.some((part) => !isPartValid(part))) {
    return 'Unavailable'
  }
  const names = parts.map((part) => part?.name).filter(Boolean)
  return names.length === group.partKeys.length ? names.join(' · ') : 'Unavailable'
}

/**
 * Calculates a Component Group amount only when all of its Parts are available.
 * Accumulates integer cents via toCents to avoid floating-point drift (REV-5).
 *
 * @param {object} build - Saved Build prepared for comparison.
 * @param {{partKeys: string[]}} group - Canonical Component Group definition.
 * @returns {number|null} Current amount or null for an unavailable Part.
 */
function groupAmount(build, group) {
  const parts = partsForGroup(build, group)
  if (!parts.every(isPartValid)) return null
  let totalCents = 0
  for (const part of parts) {
    const cents = toCents(part?.price)
    if (cents === null) return null
    totalCents += cents
  }
  return totalCents / 100
}

/**
 * Formats an amount while making missing historical Part prices explicit.
 *
 * @param {number|null|undefined} amount - Amount to display.
 * @returns {string} Formatted money or an unavailable label.
 */
function displayAmount(amount) {
  return Number.isFinite(amount) ? money(amount) : 'Unavailable'
}

function selectDefaults() {
  const ids = builds.value.map((build) => build.id)
  if (!ids.includes(leftId.value)) leftId.value = ids[0] || ''
  if (!ids.includes(rightId.value) || rightId.value === leftId.value) rightId.value = ids.find((id) => id !== leftId.value) || ''
}

function chooseLeft(event) {
  leftId.value = event.target.value
  if (leftId.value === rightId.value) rightId.value = builds.value.find((build) => build.id !== leftId.value)?.id || ''
}

function chooseRight(event) {
  rightId.value = event.target.value
  if (rightId.value === leftId.value) leftId.value = builds.value.find((build) => build.id !== rightId.value)?.id || ''
}

function editBuild(build) {
  openSavedBuild(build)
  router.push('/parts')
}

onMounted(() => {
  if (state.user) refreshSaved()
  selectDefaults()
})

watch(() => state.savedBuilds.map((build) => build.id).join(','), selectDefaults)
</script>

<template>
  <section class="screen compare-screen" id="compare-builds">
    <div class="wrap">
      <div class="phead compare-head">
        <div>
          <div class="eyebrow">Saved Build library</div>
          <h1>Compare Builds</h1>
          <p>Put two saved Builds side by side to compare their total and every Part before you edit.</p>
        </div>
        <router-link to="/account" class="ui-btn">Manage saved Builds</router-link>
      </div>

      <div v-if="builds.length < 2" class="compare-empty panel">
        <div class="eyebrow">Two Builds needed</div>
        <h2>Save one more Build to compare.</h2>
        <p>Comparisons use the Builds in your profile. Finish a Build, save it, then return here to see the differences side by side.</p>
        <router-link to="/swipe" class="ui-btn primary">Start a Build →</router-link>
      </div>

      <template v-else>
        <div class="compare-picker" aria-label="Choose Builds to compare">
          <label class="compare-select">
            <span class="eyebrow">Left Build</span>
            <select :value="leftId" @change="chooseLeft">
              <option v-for="build in builds" :key="build.id" :value="build.id">
                {{ build.name }} · {{ build.layout }}%
              </option>
            </select>
          </label>
          <span class="compare-versus" aria-hidden="true">vs</span>
          <label class="compare-select">
            <span class="eyebrow">Right Build</span>
            <select :value="rightId" @change="chooseRight">
              <option v-for="build in builds" :key="build.id" :value="build.id">
                {{ build.name }} · {{ build.layout }}%
              </option>
            </select>
          </label>
        </div>

        <div v-if="canCompare" class="compare-cards">
          <article v-for="(build, index) in [leftBuild, rightBuild]" :key="index === 0 ? 'left' : 'right'" class="compare-card">
            <div class="compare-card-top">
              <span class="compare-side">{{ index === 0 ? 'Build A' : 'Build B' }}</span>
              <span class="chip">{{ build.layout }}% layout</span>
            </div>
            <div class="compare-card-title">
              <h2 :title="build.name">{{ build.name }}</h2>
              <p class="compare-saved">Saved {{ new Date(build.created_at).toLocaleDateString('en-SG') }}</p>
            </div>
            <div class="compare-preview compare-preview--3d" :data-testid="`compare-preview-${index === 0 ? 'left' : 'right'}`">
              <BuildPreviewCanvas
                :barebones="build.parts?.case ?? null"
                :switches="build.parts?.switches ?? null"
                :keycaps="build.parts?.keycaps ?? null"
                :layout="String(build.layout || '75')"
                :compact="true"
                :canvas-only="true"
                :initial-exploded="false"
                :interactive="false"
              />
            </div>
            <div class="compare-total">
              <span>Total</span>
              <strong :class="priceClass(build.total, index === 0 ? rightBuild.total : leftBuild.total)">
                <span class="compare-price-marker" aria-hidden="true">{{ priceMarker(build.total, index === 0 ? rightBuild.total : leftBuild.total) }}</span>
                <span class="visually-hidden">{{ priceDescription(build.total, index === 0 ? rightBuild.total : leftBuild.total) }}</span>
                {{ displayAmount(build.total) }}
              </strong>
            </div>
            <div class="compare-card-parts">
              <span :class="{ 'is-missing-part': !isPartValid(build.parts?.case) }">{{ isPartValid(build.parts?.case) ? build.parts.case.name : 'Unavailable Case' }}</span>
              <span :class="{ 'is-missing-part': !isPartValid(build.parts?.switches) }">{{ isPartValid(build.parts?.switches) ? build.parts.switches.name : 'Unavailable Switches' }}</span>
              <span :class="{ 'is-missing-part': !isPartValid(build.parts?.keycaps) }">{{ isPartValid(build.parts?.keycaps) ? build.parts.keycaps.name : 'Unavailable Keycaps' }}</span>
            </div>
            <button type="button" class="ui-btn primary" :aria-label="`Edit ${build.name}`" @click="editBuild(build)">Edit this Build</button>
          </article>
        </div>

        <div v-if="canCompare" class="compare-insight" role="status">
          <template v-if="priceDifference === null">An unavailable Part prevents a total comparison until you edit the Build.</template>
          <template v-else-if="priceDifference === 0">These Builds have the same total.</template>
          <template v-else-if="priceDifference > 0">Build A is {{ money(priceDifference) }} higher than Build B.</template>
          <template v-else>Build B is {{ money(Math.abs(priceDifference)) }} higher than Build A.</template>
        </div>

        <details v-if="canCompare" class="compare-details">
          <summary>
            <span><span class="eyebrow">Side-by-side details</span> Compare all Parts</span>
            <span class="compare-summary-total">{{ COMPONENT_GROUPS.length }} groups</span>
          </summary>
          <div class="compare-table-wrap">
            <table class="compare-table">
              <thead>
                <tr>
                  <th scope="col">Part</th>
                  <th scope="col">{{ leftBuild.name }}</th>
                  <th scope="col">{{ rightBuild.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="group in COMPONENT_GROUPS" :key="group.id" :class="{ 'is-different': groupPartNames(leftBuild, group) !== groupPartNames(rightBuild, group) }">
                  <th scope="row">{{ group.label }}</th>
                  <td :class="{ 'is-missing-cell': hasGroupMissingPart(leftBuild, group) }">
                    <span class="compare-part-name">{{ groupPartNames(leftBuild, group) }}</span>
                    <span v-if="hasGroupMissingPart(leftBuild, group)" class="compare-missing-badge" data-testid="compare-missing-badge">Missing part</span>
                    <b :class="priceClass(groupAmount(leftBuild, group), groupAmount(rightBuild, group))">
                      <span class="compare-price-marker" aria-hidden="true">{{ priceMarker(groupAmount(leftBuild, group), groupAmount(rightBuild, group)) }}</span>
                      <span class="visually-hidden">{{ priceDescription(groupAmount(leftBuild, group), groupAmount(rightBuild, group)) }}</span>
                      {{ displayAmount(groupAmount(leftBuild, group)) }}
                    </b>
                  </td>
                  <td :class="{ 'is-missing-cell': hasGroupMissingPart(rightBuild, group) }">
                    <span class="compare-part-name">{{ groupPartNames(rightBuild, group) }}</span>
                    <span v-if="hasGroupMissingPart(rightBuild, group)" class="compare-missing-badge" data-testid="compare-missing-badge">Missing part</span>
                    <b :class="priceClass(groupAmount(rightBuild, group), groupAmount(leftBuild, group))">
                      <span class="compare-price-marker" aria-hidden="true">{{ priceMarker(groupAmount(rightBuild, group), groupAmount(leftBuild, group)) }}</span>
                      <span class="visually-hidden">{{ priceDescription(groupAmount(rightBuild, group), groupAmount(leftBuild, group)) }}</span>
                      {{ displayAmount(groupAmount(rightBuild, group)) }}
                    </b>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Build total</th>
                  <td :class="priceClass(leftBuild.total, rightBuild.total)"><span class="compare-price-marker" aria-hidden="true">{{ priceMarker(leftBuild.total, rightBuild.total) }}</span><span class="visually-hidden">{{ priceDescription(leftBuild.total, rightBuild.total) }}</span>{{ displayAmount(leftBuild.total) }}</td>
                  <td :class="priceClass(rightBuild.total, leftBuild.total)"><span class="compare-price-marker" aria-hidden="true">{{ priceMarker(rightBuild.total, leftBuild.total) }}</span><span class="visually-hidden">{{ priceDescription(rightBuild.total, leftBuild.total) }}</span>{{ displayAmount(rightBuild.total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      </template>
    </div>
  </section>
</template>
