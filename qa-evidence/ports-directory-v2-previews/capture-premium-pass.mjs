import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'premium-pass')
await mkdir(outDir, { recursive: true })

const { chromium } = await import('playwright-core')
const base = 'http://127.0.0.1:8766/ports/'
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
]

const browser = await chromium.launch()
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  await page.goto(base, { waitUntil: 'networkidle' })
  const decline = page.getByRole('button', { name: /decline/i })
  if (await decline.isVisible().catch(() => false)) {
    await decline.click()
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: join(outDir, `ports-index-${vp.name}.png`), fullPage: false })
  await page.close()
}
await browser.close()
console.log('wrote', outDir)
