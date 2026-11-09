#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { researchToGuidePatch, readResearchMarkdown } = require('./lib/portResearchImport/transformResearchToPublic')
const { sha256File } = require('./lib/portResearchImport/verifyResearchSha')

const REPO = path.join(__dirname, '..')
const SLUGS = ['cape-liberty-bayonne-nj-united-states', 'vancouver-bc-canada']
const RESEARCH_ROOT = process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Semprog/seadays-ports-deliverables'

function extractMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  return m ? m[1] : html
}

for (const slug of SLUGS) {
  const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
  assert.ok(fs.existsSync(htmlPath), `${slug} HTML must exist`)
  const html = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(!containsInternalResearchLeak(extractMain(html)), `${slug}: main HTML leak scan`)

  const guides = loadPublicPortGuidesFile(REPO)
  const guide = Object.values(guides.byAppPortId || {}).find(
    (g) => g?.researchImport?.landing_slug === slug
  )
  assert.ok(guide, `${slug} guide in JSON`)
  assert.ok(!containsInternalResearchLeak(collectGuidePassengerLeakBlob(guide)), `${slug}: JSON passenger blob leak scan`)
  const mdPath = path.join(RESEARCH_ROOT, 'by-port', `${slug}.md`)
  const pinned = guide.researchImport?.research_sha256
  if (pinned && fs.existsSync(mdPath)) {
    assert.strictEqual(
      sha256File(mdPath),
      pinned,
      `${slug}: research_sha256 must match on-disk research markdown`
    )
  }

  if (fs.existsSync(path.join(RESEARCH_ROOT, 'by-port', `${slug}.md`))) {
    const raw = readResearchMarkdown(RESEARCH_ROOT, slug)
    const { parseFrontmatter } = require('./lib/portResearchImport/resolveYaml')
    const { meta, body } = parseFrontmatter(raw)
    const patch = researchToGuidePatch(meta, body)
    const transport = patch.gettingThere?.publicTransport || ''
    assert.ok(
      !containsInternalResearchLeak(transport),
      `${slug}: research import patch must not reintroduce leak wording`
    )
  }
}

const peCount = Object.values(loadPublicPortGuidesFile(REPO).byAppPortId || {}).filter(
  (g) => g?.researchImport?.publication_tier === 'passenger_editorial'
).length
assert.strictEqual(peCount, 344, 'passenger editorial count unchanged')

console.log('test-stage74-legacy-copy-cleanup PASS', { slugs: SLUGS.length, passenger_editorial: peCount })
