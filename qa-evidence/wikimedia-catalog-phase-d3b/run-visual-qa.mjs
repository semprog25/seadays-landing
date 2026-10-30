/**
 * D3B local visual QA — static preview HTML only (no live catalogue).
 * Usage: node qa-evidence/wikimedia-catalog-phase-d3b/run-visual-qa.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PREVIEW = path.join(ROOT, 'qa-evidence/wikimedia-catalog-phase-d3b/preview-on')
const OUT = path.dirname(fileURLToPath(import.meta.url))
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const PAGES = [
  { label: 'wonder-of-the-seas', rel: 'ships/wonder-of-the-seas/index.html' },
  { label: 'aidacosma', rel: 'ships/aidacosma/index.html' },
  { label: 'symphony-of-the-seas', rel: 'ships/symphony-of-the-seas/index.html' },
  { label: 'hamburg-germany', rel: 'ports/hamburg-germany/index.html' },
  { label: 'barcelona-spain', rel: 'ports/barcelona-spain/index.html' },
  { label: 'miami-fl-united-states', rel: 'ports/miami-fl-united-states/index.html' },
]

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.webp')) return 'image/webp'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const rel = urlPath === '/' ? 'ships/wonder-of-the-seas/index.html' : urlPath.replace(/^\//, '')
    const filePath = path.join(PREVIEW, rel)
    if (!filePath.startsWith(PREVIEW) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    res.setHeader('Content-Type', contentType(filePath))
    fs.createReadStream(filePath).pipe(res)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` })
    })
  })
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    return await import('playwright-core')
  }
}

async function captureAndAssert(browser, baseUrl, pageDef, viewport, tag) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const url = `${baseUrl}/${pageDef.rel}`
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })

  const metrics = await page.evaluate(() => {
    const banner = document.querySelector('.catalog-verified-preview-banner')
    const frame = document.querySelector('.catalog-preview-frame')
    const img = document.querySelector('.catalog-preview-img')
    const attr = document.querySelector('.catalog-attribution')
    const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2
    const imgBox = img?.getBoundingClientRect()
    const frameBox = frame?.getBoundingClientRect()
    const letterbox =
      img && frameBox && imgBox
        ? imgBox.height + 4 < frameBox.height && imgBox.width + 4 < frameBox.width
        : false
    return {
      hasBanner: Boolean(banner),
      hasAttribution: Boolean(attr),
      hasFrame: Boolean(frame),
      overflowX,
      letterbox,
    }
  })

  const shot = path.join(OUT, 'visual-qa', `${pageDef.label}-${tag}.png`)
  fs.mkdirSync(path.dirname(shot), { recursive: true })
  await page.screenshot({ path: shot, fullPage: false })
  await context.close()

  return { page: pageDef.label, viewport: tag, url, metrics, screenshot: shot }
}

async function main() {
  if (!fs.existsSync(PREVIEW)) {
    throw new Error(`Missing preview output at ${PREVIEW}. Run SEADAYS_VERIFIED_CATALOG_PREVIEW=true npm run build:catalog-verified-preview`)
  }

  const { server, baseUrl } = await startStaticServer()
  const pw = await loadPlaywright()
  const browser = await pw.chromium.launch({ headless: true })
  const results = []

  for (const pageDef of PAGES) {
    results.push(await captureAndAssert(browser, baseUrl, pageDef, MOBILE, '390x844'))
    results.push(await captureAndAssert(browser, baseUrl, pageDef, DESKTOP, '1280x800'))
  }

  await browser.close()
  server.close()

  const failures = results.filter(
    (row) =>
      !row.metrics.hasBanner ||
      !row.metrics.hasAttribution ||
      !row.metrics.hasFrame ||
      row.metrics.overflowX ||
      row.metrics.letterbox,
  )

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    results,
    pass: failures.length === 0,
  }
  fs.writeFileSync(path.join(OUT, 'visual-qa', 'D3B_VISUAL_QA.json'), JSON.stringify(report, null, 2))

  if (failures.length) {
    console.error('D3B visual QA FAIL', failures)
    process.exit(1)
  }
  console.log('D3B visual QA PASS', results.length, 'captures')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
