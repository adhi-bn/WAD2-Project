// Schematic keyboard drawing for the home hero. Pure string builder, no deps.
export function kbSVG(L) {
  const main = [[...Array(13).fill(1), 2], [1.5, ...Array(12).fill(1), 1.5], [1.75, ...Array(11).fill(1), 2.25], [2.25, ...Array(10).fill(1), 2.75], [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25]]
  const top = L === '60' ? 0 : 1.25, R = []
  main.forEach((r, ri) => { let x = 0; r.forEach((w) => { R.push([x, top + ri, w]); x += w }) })
  let W = 15
  if (L === '75') { for (let i = 0; i < 16; i++) R.push([i, 0, 1]); for (let r = 0; r < 5; r++) R.push([15, top + r, 1]); W = 16 }
  if (L === '100') {
    for (let i = 0; i < 15; i++) R.push([i, 0, 1])
    const nx = 15.5
    for (let i = 0; i < 3; i++) { R.push([nx + i, 0, 1]); R.push([nx + i, top, 1]); R.push([nx + i, top + 1, 1]); R.push([nx + i, top + 4, 1]) }
    R.push([nx + 1, top + 3, 1])
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) R.push([19.5 + c, top + r, 1])
    W = 23.5
  }
  const u = 10, H = top + 5, accent = L === '60' ? 0 : main.flat().length
  return `<svg class="kb" viewBox="-6 -6 ${W * u + 12} ${H * u + 12}" aria-hidden="true"><rect class="f" x="-5" y="-5" width="${W * u + 10}" height="${H * u + 10}" rx="6"/>${R.map(([x, y, w], i) => `<rect class="k ${i === accent ? 'a' : ''}" x="${x * u + 0.8}" y="${y * u + 0.8}" width="${w * u - 1.6}" height="${u - 1.6}" rx="1.6"/>`).join('')}</svg>`
}
