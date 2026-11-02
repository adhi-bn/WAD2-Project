<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CATS } from '../data/catalog.js'
import { money, total } from '../logic/builder.js'
import { buildFromIds, openSavedBuild, refreshSaved, state } from '../store.js'

const router = useRouter()
const leftId = ref('')
const rightId = ref('')
const failedImageIds = ref(new Set())

const COMPONENT_GROUPS = [
  { id: 'case', label: 'Case', partKeys: ['case'] },
  { id: 'plate', label: 'Plate', partKeys: ['plate'] },
  { id: 'pcb', label: 'PCB', partKeys: ['pcb'] },
  { id: 'switches', label: 'Switches', partKeys: ['switches'] },
  { id: 'keycaps', label: 'Keycaps', partKeys: ['keycaps'] },
  { id: 'addons', label: 'Add-ons', partKeys: ['stabs', 'foam', 'cable'] },
]

/**
 * Prepares a saved Build for comparison without silently replacing discontinued Parts.
 *
 * @param {object} saved - Row from the saved-Build library.
 * @returns {object} Build data with safe Parts and a nullable total.
 */
function comparisonBuild(saved) {
  // A saved Build may reference a discontinued Part, so keep the missing selection visible.
  const parts = buildFromIds(saved.layout, saved.part_ids || {})
  const hasUnavailablePart = CATS.some((key) => !Number.isFinite(parts[key]?.price))
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
  return { 'is-higher': '↑', 'is-lower': '↓', 'is-equal': '•', 'is-unavailable': '—' }[priceClass(amount, comparedAmount)]
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
 * Formats a Component Group without crashing when a historical Part disappeared.
 *
 * @param {object} build - Saved Build prepared for comparison.
 * @param {{partKeys: string[]}} group - Canonical Component Group definition.
 * @returns {string} Joined Part names or an unavailable fallback.
 */
function groupPartNames(build, group) {
  const names = partsForGroup(build, group).map((part) => part?.name).filter(Boolean)
  return names.length === group.partKeys.length ? names.join(' · ') : 'Unavailable'
}

/**
 * Calculates a Component Group amount only when all of its Parts are available.
 *
 * @param {object} build - Saved Build prepared for comparison.
 * @param {{partKeys: string[]}} group - Canonical Component Group definition.
 * @returns {number|null} Current amount or null for an unavailable Part.
 */
function groupAmount(build, group) {
  const parts = partsForGroup(build, group)
  return parts.every((part) => Number.isFinite(part?.price))
    ? parts.reduce((sum, part) => sum + part.price, 0)
    : null
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

/**
 * Checks whether a saved Build image should be rendered instead of its placeholder.
 *
 * @param {object} build - Saved Build to inspect.
 * @returns {boolean} Whether its image URL is usable in this render.
 */
function hasBuildImage(build) {
  return Boolean(build.image_url) && !failedImageIds.value.has(build.id)
}

/**
 * Falls back to the keyboard placeholder if a future saved Build image cannot load.
 *
 * @param {string} buildId - Saved Build identifier whose image failed.
 * @returns {void}
 */
function useImagePlaceholder(buildId) {
  failedImageIds.value = new Set([...failedImageIds.value, buildId])
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
          <article v-for="(build, index) in [leftBuild, rightBuild]" :key="build.id" class="compare-card">
            <div class="compare-card-top">
              <span class="compare-side">{{ index === 0 ? 'Build A' : 'Build B' }}</span>
              <span class="chip">{{ build.layout }}% layout</span>
            </div>
            <div class="compare-card-title">
              <h2 :title="build.name">{{ build.name }}</h2>
              <p class="compare-saved">Saved {{ new Date(build.created_at).toLocaleDateString('en-SG') }}</p>
            </div>
            <!-- A saved Build can provide image_url later; this keeps the card polished until then. -->
            <img v-if="hasBuildImage(build)" class="compare-preview" :src="build.image_url" :alt="`${build.name} keyboard Build`" width="480" height="210" loading="lazy" @error="useImagePlaceholder(build.id)" />
            <div v-else class="compare-preview compare-preview--placeholder" role="img" :aria-label="`${build.name} keyboard image placeholder`">
              <div class="compare-preview__keys" aria-hidden="true"><i v-for="key in 24" :key="key"></i></div>
              <span>Build image</span>
              <small>Image coming soon</small>
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
              <span>{{ build.parts?.case?.name ?? 'Unavailable Case' }}</span>
              <span>{{ build.parts?.switches?.name ?? 'Unavailable Switches' }}</span>
              <span>{{ build.parts?.keycaps?.name ?? 'Unavailable Keycaps' }}</span>
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
                  <td>
                    <span class="compare-part-name">{{ groupPartNames(leftBuild, group) }}</span>
                    <b :class="priceClass(groupAmount(leftBuild, group), groupAmount(rightBuild, group))">
                      <span class="compare-price-marker" aria-hidden="true">{{ priceMarker(groupAmount(leftBuild, group), groupAmount(rightBuild, group)) }}</span>
                      <span class="visually-hidden">{{ priceDescription(groupAmount(leftBuild, group), groupAmount(rightBuild, group)) }}</span>
                      {{ displayAmount(groupAmount(leftBuild, group)) }}
                    </b>
                  </td>
                  <td>
                    <span class="compare-part-name">{{ groupPartNames(rightBuild, group) }}</span>
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
