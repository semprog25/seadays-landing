#!/usr/bin/env node
'use strict'

/**
 * Mirrors Jekyll _config.yml exclude for GitHub Pages legacy builds.
 * Not a full Jekyll run — validates publication scope when Docker/gem unavailable.
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const configPath = path.join(root, '_config.yml')

function parseExcludeList(yamlText) {
  const lines = yamlText.split('\n')
  const excludes = []
  let inExclude = false
  for (const line of lines) {
    if (/^exclude:\s*$/.test(line)) {
      inExclude = true
      continue
    }
    if (inExclude) {
      const m = line.match(/^\s+-\s+(.+)\s*$/)
      if (m) {
        excludes.push(m[1].trim())
        continue
      }
      if (line.trim() && !line.startsWith('#')) inExclude = false
    }
  }
  return excludes
}

function walkRelativeFiles(dir, base = dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name)
    const rel = path.relative(base, abs).split(path.sep).join('/')
    const st = fs.statSync(abs)
    if (st.isDirectory()) out.push(...walkRelativeFiles(abs, base))
    else out.push(rel)
  }
  return out
}

function isExcluded(relPath, excludes) {
  for (const ex of excludes) {
    if (relPath === ex || relPath.startsWith(`${ex}/`)) return true
  }
  return false
}

const yaml = fs.readFileSync(configPath, 'utf8')
const excludes = parseExcludeList(yaml)
assert.ok(excludes.includes('qa-evidence'), 'qa-evidence must be in exclude list')

const allFiles = walkRelativeFiles(root)
const published = allFiles.filter((rel) => !isExcluded(rel, excludes))

const mustPublish = [
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'CNAME',
  'ships/index.html',
  'ports/index.html',
  'blog/index.html',
]

for (const rel of mustPublish) {
  assert.ok(published.includes(rel), `expected published: ${rel}`)
}

const qaEvidencePublished = published.filter((rel) => rel.startsWith('qa-evidence/'))
assert.strictEqual(qaEvidencePublished.length, 0, `qa-evidence must not publish: ${qaEvidencePublished.slice(0, 3).join(', ')}`)

const sampleQa = allFiles.find((rel) => rel.startsWith('qa-evidence/'))
assert.ok(sampleQa, 'repo must contain qa-evidence files to validate exclusion')
const withoutExclude = allFiles.filter((rel) => !isExcluded(rel, []))
assert.ok(
  withoutExclude.some((rel) => rel.startsWith('qa-evidence/')),
  'regression: empty exclude must publish qa-evidence (test would be meaningless otherwise)',
)
const misconfigured = allFiles.filter((rel) => !isExcluded(rel, ['qa-evidence-wrong']))
assert.ok(
  misconfigured.some((rel) => rel.startsWith('qa-evidence/')),
  'regression: wrong exclude entry must not hide qa-evidence',
)

console.log('test-jekyll-qa-evidence-exclude: PASS')
console.log(`  exclude: ${excludes.join(', ')}`)
console.log(`  published file count (approx): ${published.length}`)
