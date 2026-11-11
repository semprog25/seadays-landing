#!/usr/bin/env node
'use strict'

/**
 * Regression: internal photo-review / licensing QA strings must not appear in public port HTML.
 */
const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const portsDir = path.join(repoRoot, 'ports')

const FORBIDDEN_PATTERNS = [
  /owner-provided download/i,
  /confirm licen[sc]e and geography before production/i,
  /geography before production use/i,
  /owner download\s*[—–-]\s*confirm geography/i,
  /\(owner download\)/i,
  /\(confirm before production\)/i,
  /\bNEEDS_REVIEW\b/,
  /^__virt_/i,
]

const { buildHumanApprovedHeroCaption } = require('./lib/seoShipPortPages')
const { sanitizePublicRegionCardImageAlt } = require('./lib/portsDirectoryIndex')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function listPortGuideHtmlFiles() {
  const out = []
  for (const ent of fs.readdirSync(portsDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    if (ent.name === 'goa-india') continue
    const htmlPath = path.join(portsDir, ent.name, 'index.html')
    if (fs.existsSync(htmlPath)) out.push(htmlPath)
  }
  const indexPath = path.join(portsDir, 'index.html')
  if (fs.existsSync(indexPath)) out.push(indexPath)
  return out
}

function scanPublicHtml() {
  const violations = []
  for (const filePath of listPortGuideHtmlFiles()) {
    const html = fs.readFileSync(filePath, 'utf8')
    const heroFigcaptions = [...html.matchAll(/class=["'][^"']*seo-hero[^"']*["'][\s\S]*?<figcaption>([^<]*)<\/figcaption>/gi)]
    for (const m of heroFigcaptions) {
      const caption = m[1] || ''
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(caption)) {
          violations.push({ file: path.relative(repoRoot, filePath), caption: caption.slice(0, 120) })
          break
        }
      }
    }
    if (/<figcaption>[^<]*owner-provided download[^<]*<\/figcaption>/i.test(html)) {
      violations.push({
        file: path.relative(repoRoot, filePath),
        caption: 'owner-provided download (any figcaption)',
      })
    }
    const regionAlts = [
      ...html.matchAll(/class=["']region-card-image["'][^>]*\salt=["']([^"']*)["']/gi),
    ]
    for (const m of regionAlts) {
      const alt = m[1] || ''
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(alt)) {
          violations.push({ file: path.relative(repoRoot, filePath), caption: `region alt: ${alt.slice(0, 120)}` })
          break
        }
      }
    }
  }
  return violations
}

function testRegionAltSanitizer() {
  const legacy =
    'Snow-covered Alaska mountains and wilderness coastline (owner download — confirm geography)'
  const out = sanitizePublicRegionCardImageAlt('Alaska', legacy, 'Alaska')
  assert(out === 'Alaska cruise region', `Alaska sanitizer expected neutral alt, got: ${out}`)
  const other = sanitizePublicRegionCardImageAlt('Asia', 'Asia cruise region (owner download)', 'Asia')
  assert(other === 'Asia cruise region', `Asia sanitizer expected public alt, got: ${other}`)
  const virt = sanitizePublicRegionCardImageAlt(
    '__virt_anz__',
    '__virt_anz__ cruise region (owner download)',
    'Australia & New Zealand'
  )
  assert(
    virt === 'Australia & New Zealand cruise region',
    `virtual region sanitizer expected display label, got: ${virt}`
  )
  const baltic = sanitizePublicRegionCardImageAlt('Baltic', 'Baltic cruise region (owner download)', 'Baltic Sea')
  assert(baltic === 'Baltic Sea cruise region', `Baltic sanitizer expected label-based alt, got: ${baltic}`)
}

function testGeneratorNeverEmitsQaWarning() {
  const cases = [
    { slug: 'owner-download-no-meta', input: { url: '/x.webp', provider: 'owner' } },
    {
      slug: 'pexels-full',
      input: {
        photographer: 'Test Photographer',
        licenseTerms: 'Pexels License (free for commercial use; no attribution required — credit appreciated)',
        licenseUrl: 'https://www.pexels.com/license/',
        sourcePageUrl: 'https://www.pexels.com/photo/1/',
        provider: 'pexels',
      },
    },
    {
      slug: 'unsplash-full',
      input: {
        photographer: 'Gaurav Kumar',
        licenseTerms: 'Unsplash License (free for commercial and non-commercial use)',
        licenseUrl: 'https://unsplash.com/license',
        sourcePageUrl: 'https://unsplash.com/photos/33Z4FsBTiAY',
        provider: 'unsplash',
      },
    },
  ]
  for (const { slug, input } of cases) {
    const caption = buildHumanApprovedHeroCaption(input)
    for (const re of FORBIDDEN_PATTERNS) {
      assert(!re.test(caption), `${slug} caption must not match ${re}: ${caption}`)
    }
  }
}

function main() {
  testGeneratorNeverEmitsQaWarning()
  testRegionAltSanitizer()
  const violations = scanPublicHtml()
  if (violations.length) {
    const detail = violations.map((v) => `${v.file}: ${v.caption}`).join('\n')
    throw new Error(`internal photo QA text in public HTML:\n${detail}`)
  }
  console.log(
    `OK test-public-photo-caption-internal-warnings (${listPortGuideHtmlFiles().length} public HTML files)`
  )
}

main()
