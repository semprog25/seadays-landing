#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage70-yaml-repair-31')
const COMPOSITE = path.join(OUT, 'COMPOSITE_SHA_PATCH.json')
const STAGE69_OUT = path.join(REPO, 'qa-evidence/stage69-remaining-87')

function main() {
  if (!fs.existsSync(COMPOSITE)) throw new Error('run stage70-build-composite-sha-patch.js first')
  process.env.PORT_RESEARCH_SHA_PATCH = COMPOSITE
  const patch = JSON.parse(fs.readFileSync(COMPOSITE, 'utf8'))
  process.env.PORT_RESEARCH_BY_PORT_ROOT = patch.by_port_root
  process.env.PORT_RESEARCH_INDEX_SOURCE = patch.index_source_path

  execSync('node scripts/stage69-reconcile-remaining-87.js', {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env },
  })
  execSync('node scripts/stage69-select-next-cohort.js', {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env },
  })

  for (const name of [
    'RECONCILE_SUMMARY.json',
    'REMAINING_87_INVENTORY.json',
    'COHORT_MANIFEST.json',
    'IDENTITY_REPORT.json',
    'SELECTED_CANDIDATES.json',
    'UNPUBLISHED_SLUGS.json',
  ]) {
    const src = path.join(STAGE69_OUT, name)
    const dest = path.join(OUT, `post_repair_${name}`)
    if (fs.existsSync(src)) fs.copyFileSync(src, dest)
  }

  const inventory = JSON.parse(fs.readFileSync(path.join(STAGE69_OUT, 'REMAINING_87_INVENTORY.json'), 'utf8'))
  const baseline = JSON.parse(
    fs.readFileSync(
      path.join(REPO, 'qa-evidence/stage69-remaining-87-baseline/REMAINING_87_INVENTORY.json'),
      'utf8'
    )
  )
  const baseB = new Set(baseline.filter((r) => r.category === 'B').map((r) => r.landing_slug))
  const stillB = inventory.filter((r) => r.category === 'B' && baseB.has(r.landing_slug))
  const movedFromB = inventory.filter((r) => r.category !== 'B' && baseB.has(r.landing_slug))
  const gates = fs.existsSync(path.join(OUT, 'GATE_REPORT.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'GATE_REPORT.json'), 'utf8'))
    : [];
  const gateBySlug = new Map(gates.map((g) => [g.landing_slug, g]));

  const report = {
    generated_at_utc: new Date().toISOString(),
    original_category_b_count: baseB.size,
    still_category_b_among_original_31: stillB.length,
    moved_from_b: movedFromB.map((r) => ({
      landing_slug: r.landing_slug,
      new_category: r.category,
      blocker: r.blocker,
      policy_dry_run_ok: gateBySlug.get(r.landing_slug)?.policy_ok ?? null,
      bootstrap_policy_ok: r.bootstrap_policy_ok,
      preparation_candidate: r.preparation_candidate,
      publication_bucket: r.publication_bucket,
    })),
    still_blocked_category_b: stillB.map((r) => ({
      landing_slug: r.landing_slug,
      blocker: r.blocker,
      evidence: r.evidence,
    })),
    category_counts_after: inventory.reduce((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1
      return acc
    }, {}),
    cohort_selected: JSON.parse(fs.readFileSync(path.join(STAGE69_OUT, 'COHORT_MANIFEST.json'), 'utf8')).selected_count,
  }

  fs.writeFileSync(path.join(OUT, 'POST_REPAIR_CATEGORY_B_DELTA.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

main()
