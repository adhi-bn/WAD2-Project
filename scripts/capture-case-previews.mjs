// Captures the app's own 3D Build Preview for each case option, so the case pictures
// match what the builder shows. Only the case step is selected, so keycaps and switches
// are not in the picture. Run from the project root while the dev server is up:
//   npm run dev                              (in one terminal)
//   node scripts/capture-case-previews.mjs   (in another)
// Writes public/parts/<option id>.png.
import { chromium } from '@playwright/test'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = path.resolve('public/parts')

// Option id -> exact name shown on the card (from src/data/catalog.js).
const CASES = [
  ['abs', 'ABS plastic case'],
  ['fr4', 'Open-frame FR4 case'],
  ['sandwich', 'Acrylic sandwich case'],
  ['pc', 'Frosted polycarbonate case'],
  ['alu', 'CNC aluminium case'],
  ['alubrass', 'CNC aluminium case with brass weight'],
]

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.goto(`${BASE}/parts`)
await page.waitForSelector('aside.sheet .lct-build-preview-panel', { timeout: 30000 })

// The case is the first step, so no navigation is needed.
const sheet = page.locator('aside.sheet')
const seen = new Map() // picture hash -> option id, to catch identical pictures
for (const [id, name] of CASES) {
  const card = page.locator('.row .opt', { hasText: name }).first()
  await card.waitFor({ state: 'visible', timeout: 15000 })
  if (await card.isDisabled()) {
    console.warn(`skipped ${id}: the card is disabled with the current build`)
    continue
  }
  await card.click()
  // Wait until this option is the selected one, so the picture is of this option.
  await page.waitForFunction(
    (n) => [...document.querySelectorAll('.row .opt.sel')].some((el) => el.textContent.includes(n)),
    name,
    { timeout: 10000 },
  )
  await page.waitForTimeout(1800) // let the camera settle
  // Hide everything except the case body (keycaps, switches, plate).
  await page.evaluate(() => {
    const scene = document.querySelector('canvas.lct-build-preview-canvas')?.__sceneInstance?.getScene?.()
    if (!scene) return
    const hide = new Set(['Layer_switches', 'Layer_keycaps', 'Layer_Keycaps', 'Layer_Plate', 'Switch_Prototype'])
    scene.traverse((o) => { if (hide.has(o.name)) o.visible = false })
  })
  await page.waitForTimeout(300)
  const stage = sheet.locator('.lct-build-preview__stage')
  const png = await stage.screenshot({ omitBackground: true })
  const hash = crypto.createHash('md5').update(png).digest('hex')
  if (seen.has(hash)) console.warn(`WARNING: ${id}.png is identical to ${seen.get(hash)}.png. Check the selection.`)
  seen.set(hash, id)
  fs.writeFileSync(path.join(OUT, `${id}.png`), png)
  console.log(`saved ${id}.png`)
}

await browser.close()
