// Captures the app's own 3D Build Preview for the ABS plastic case only, to replace public/parts/abs.png.
// Only the case step is selected, so keycaps and switches are not in the picture. Run from the project root
// while the dev server is up:
//   npm run dev                              (in one terminal)
//   node scripts/capture-abs-preview.mjs     (in another)
// Writes public/parts/abs.png. Keep a copy of the old file first if you want to compare.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = path.resolve('public/parts')
const ID = 'abs'
const NAME = 'ABS plastic case' // exact name shown on the card (from src/data/catalog.js)

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.goto(`${BASE}/parts`)
await page.waitForSelector('aside.sheet .lct-build-preview-panel', { timeout: 30000 })

// The case is the first step, so no navigation is needed.
const sheet = page.locator('aside.sheet')
const card = page.locator('.row .opt', { hasText: NAME }).first()
await card.waitFor({ state: 'visible', timeout: 15000 })
if (await card.isDisabled()) {
  throw new Error(`The ${NAME} card is disabled with the current build. Reset the build and try again.`)
}
await card.click()
// Wait until this option is the selected one, so the picture is of this option.
await page.waitForFunction(
  (n) => [...document.querySelectorAll('.row .opt.sel')].some((el) => el.textContent.includes(n)),
  NAME,
  { timeout: 10000 },
)
await page.waitForTimeout(1800) // let the camera settle

// Hide everything except the case body. In the app's scene the switches and keycaps are their own layers
// (Layer_switches, Layer_keycaps). The case and plate share Layer_barebones, so plate parts are hidden by name.
// The names hidden are printed so you can check them.
const hidden = await page.evaluate(() => {
  const scene = document.querySelector('canvas.lct-build-preview-canvas')?.__sceneInstance?.getScene?.()
  if (!scene) return null
  const layers = new Set(['Layer_switches', 'Layer_keycaps', 'Layer_Keycaps', 'Switch_Prototype'])
  const parts = /plate|switch|keycap|stem|legend/i
  const names = []
  scene.traverse((o) => {
    if (!o.visible) return
    if (layers.has(o.name) || (o.name && parts.test(o.name) && !/^Layer_barebones$|^BuildPreview_Root$/.test(o.name))) {
      o.visible = false
      names.push(o.name)
    }
  })
  // The app only redraws when asked, so draw the frame with the parts hidden before the screenshot.
  document.querySelector('canvas.lct-build-preview-canvas')?.__sceneInstance?.renderFrame?.()
  return names
})
if (hidden === null) throw new Error('The 3D scene was not found, so the picture would include every part.')
console.log(`hidden: ${hidden.length ? hidden.join(', ') : '(nothing)'}`)
await page.waitForTimeout(300)

const stage = sheet.locator('.lct-build-preview__stage')
const png = await stage.screenshot({ omitBackground: true })
const file = path.join(OUT, `${ID}.png`)
fs.writeFileSync(file, png)
console.log(`saved ${file} (${png.length} bytes)`)

await browser.close()
