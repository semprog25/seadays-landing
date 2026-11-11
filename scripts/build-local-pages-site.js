#!/usr/bin/env node
'use strict'

/**
 * Local parity builder: copies non-excluded repo files into ./_site (same scope as _config.yml exclude).
 * Not used in CI — jekyll-build-pages is authoritative there.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const configPath = path.join(root, '_config.yml')
const outRoot = path.join(root, '_site')

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

/** Matches github-pages / jekyll-build-pages defaults (subset). */
const JEKYLL_PLATFORM_EXCLUDES = [
  '.git',
  '.github',
  'node_modules',
  '_site',
  'Gemfile',
  'Gemfile.lock',
]

function isExcluded(relPath, excludes) {
  for (const ex of [...excludes, ...JEKYLL_PLATFORM_EXCLUDES]) {
    if (relPath === ex || relPath.startsWith(`${ex}/`)) return true
  }
  return false
}

function copyTree(srcDir, destDir, excludes, base = srcDir) {
  for (const name of fs.readdirSync(srcDir)) {
    const abs = path.join(srcDir, name)
    const rel = path.relative(base, abs).split(path.sep).join('/')
    if (isExcluded(rel, excludes)) continue
    if (rel === '_site' || rel.startsWith('_site/')) continue
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) continue
    if (rel === '.git' || rel.startsWith('.git/')) continue
    const st = fs.statSync(abs)
    const dest = path.join(destDir, rel)
    if (st.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true })
      copyTree(abs, destDir, excludes, base)
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(abs, dest)
    }
  }
}

function main() {
  const excludes = parseExcludeList(fs.readFileSync(configPath, 'utf8'))
  fs.rmSync(outRoot, { recursive: true, force: true })
  fs.mkdirSync(outRoot, { recursive: true })
  copyTree(root, outRoot, excludes, root)
  console.log('build-local-pages-site wrote', outRoot)
}

main()
