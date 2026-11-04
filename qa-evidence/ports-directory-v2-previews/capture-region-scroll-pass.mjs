import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'region-scroll-pass')
await mkdir(outDir, { recursive: true })

const { chromium } = await import('playwright-core')
const base = 'http://127.0.0.1:8766/ports/'

const browser = await chromium.launch()
for (const vp of [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  await page.goto(base, { waitUntil: 'networkidle' })
  const decline = page.getByRole('button', { name: /decline/i })
  if (await decline.isVisible().catch(() => false)) await decline.click()
  await page.getByRole('button', { name: /Baltic Sea/i }).click()
  await page.waitForURL(/\?region=Baltic/)
  await page.waitForTimeout(600)
  await page.screenshot({
    path: join(outDir, `ports-baltic-selected-${vp.name}.png`),
    fullPage: false,
  })
  await page.close()
}
await browser.close()
console.log('wrote', outDir)
