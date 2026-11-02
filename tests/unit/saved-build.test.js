import { describe, expect, it } from 'vitest'
import { CATS, catalog } from '../../src/data/catalog.js'
import { revalidateSavedBuild, snapshotBuild } from '../../src/domain/saved-build.js'

function buildFor(layout = '75') {
  const options = catalog(layout)
  return Object.fromEntries(CATS.map((group) => [group, options[group][0]]))
}

describe('Saved build revalidation', () => {
  it('retains every selection and reports a changed current price', () => {
    const build = buildFor()
    const snapshot = snapshotBuild(build, { layout: '75', budget: 400, switch: 'linear' })
    const current = catalog('75')
    current.case = current.case.map((part) => part.id === build.case.id ? { ...part, price: part.price + 20 } : part)

    const result = revalidateSavedBuild({ part_ids: snapshot.partIds, part_prices: snapshot.partPrices, answers: snapshot.answers }, current)

    expect(result.build.case.id).toBe(build.case.id)
    expect(result.total).toBeGreaterThan(0)
    expect(result.issues).toContainEqual(expect.objectContaining({ group: 'case', type: 'price-changed' }))
  })

  it('keeps a removed Part visible, marks the Budget unavailable, and offers alternatives', () => {
    const build = buildFor()
    const snapshot = snapshotBuild(build, { layout: '75', budget: 400 })
    const current = catalog('75')
    current.keycaps = current.keycaps.filter((part) => part.id !== build.keycaps.id)

    const result = revalidateSavedBuild({ part_ids: snapshot.partIds, part_prices: snapshot.partPrices, answers: snapshot.answers }, current)

    expect(result.build.keycaps.id).toBe(build.keycaps.id)
    expect(result.build.keycaps.unavailable).toBe(true)
    expect(result.total).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({ group: 'keycaps', type: 'unavailable' }))
    expect(result.alternatives.keycaps.length).toBeGreaterThan(0)
  })
})
