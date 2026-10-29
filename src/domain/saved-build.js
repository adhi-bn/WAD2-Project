import { CATS, META } from '../data/catalog.js'
import { reason } from '../logic/builder.js'

/**
 * Creates the browser-side snapshot stored with a named Saved build.
 *
 * Prices are retained as a historical reference only. The current catalogue is
 * always used when a Saved build is reopened.
 *
 * @param {object} build - The currently selected eight-part Build.
 * @param {object} answers - The user's quiz preferences and target Budget.
 * @returns {{partIds: object, answers: object, partPrices: object}} A serialisable saved-build snapshot.
 */
export function snapshotBuild(build, answers) {
  const partIds = {}
  const partPrices = {}
  for (const group of CATS) {
    partIds[group] = build?.[group]?.id ?? null
    partPrices[group] = Number.isFinite(build?.[group]?.price) ? build[group].price : null
  }
  return { partIds, answers: { ...answers }, partPrices }
}

/**
 * Represents a selection removed from the catalogue without replacing it.
 * The placeholder keeps the original ID visible while the customer chooses a
 * real alternative in the builder.
 *
 * @param {string} group - The eight-part catalogue group.
 * @param {string|null} id - The historical selected part ID.
 * @returns {object} A safe placeholder for the legacy builder views.
 */
function unavailablePart(group, id) {
  const base = {
    id: id ?? `missing-${group}`,
    name: `Unavailable ${META[group].label.toLowerCase()}`,
    price: null,
    grams: 0,
    unavailable: true,
  }
  if (group === 'case') return { ...base, frame: 'unknown', nobatt: false }
  if (group === 'plate') return { ...base, feel: 'unknown' }
  if (group === 'pcb') return { ...base, hot: false, wl: false }
  if (group === 'switches') return { ...base, type: 'unknown', force: 'unknown', buy: 0 }
  if (group === 'keycaps') return { ...base, style: 'unknown', prof: 'unknown' }
  if (group === 'stabs') return { ...base, n: 0 }
  if (group === 'foam') return { ...base, p: 0 }
  return { ...base, p: 0 }
}

/**
 * Rechecks a Saved build against the catalogue currently visible to customers.
 * It deliberately preserves historical selections and reports drift rather than
 * silently choosing replacement Parts.
 *
 * @param {{part_ids: object, answers?: object, part_prices?: object}} saved - Stored Saved build row.
 * @param {object} currentCatalogue - Current options grouped by catalogue key.
 * @returns {{build: object, issues: Array<object>, alternatives: object, total: number|null, budget: number|null, purchaseReady: boolean, answers: object}} Revalidation result.
 */
export function revalidateSavedBuild(saved, currentCatalogue) {
  const ids = saved?.part_ids || {}
  const historicalPrices = saved?.part_prices || {}
  const build = {}
  const issues = []

  for (const group of CATS) {
    const id = ids[group]
    const current = currentCatalogue?.[group]?.find((part) => part.id === id)
    if (!id || !current) {
      build[group] = unavailablePart(group, id)
      issues.push({ group, type: 'unavailable', message: `${META[group].label} is no longer available.` })
      continue
    }
    build[group] = current
    if (Number.isFinite(historicalPrices[group]) && historicalPrices[group] !== current.price) {
      issues.push({ group, type: 'price-changed', message: `${META[group].label} now has a different price.` })
    }
  }

  for (const group of CATS) {
    const conflict = !build[group]?.unavailable && reason(group, build[group], build)
    if (conflict) issues.push({ group, type: 'incompatible', message: conflict })
  }

  const alternatives = Object.fromEntries(CATS.map((group) => [group,
    (currentCatalogue?.[group] || [])
      .filter((part) => !reason(group, part, build))
      .slice(0, 3)
      .map((part) => ({ id: part.id, name: part.name })),
  ]))
  const hasUnknownPrice = CATS.some((group) => !Number.isFinite(build[group]?.price))
  const total = hasUnknownPrice ? null : CATS.reduce((sum, group) => sum + build[group].price, 0)
  const budget = Number.isFinite(saved?.answers?.budget) ? saved.answers.budget : null

  return {
    build,
    issues,
    alternatives,
    total,
    budget,
    purchaseReady: issues.length === 0 && total !== null,
    answers: { ...(saved?.answers || {}) },
  }
}
