#!/usr/bin/env node
'use strict'

/**
 * Contract test for Actions Pages migration workflow (local prep; no GitHub deploy).
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const PAGES_YML = path.join(REPO, '.github/workflows/pages.yml')
const DEPLOY_YML = path.join(REPO, '.github/workflows/deploy.yml')

function assertWorkflowStepOrder(yml, stepNeedle, beforeNeedle, label) {
  const a = yml.indexOf(stepNeedle)
  const b = yml.indexOf(beforeNeedle)
  assert.ok(a >= 0, `${label}: missing ${stepNeedle}`)
  assert.ok(b >= 0, `${label}: missing ${beforeNeedle}`)
  assert.ok(a < b, `${label}: ${stepNeedle} must run before ${beforeNeedle}`)
}

function main() {
  assert.ok(fs.existsSync(PAGES_YML), 'pages.yml must exist for migration PR')
  const pagesYml = fs.readFileSync(PAGES_YML, 'utf8')

  assert.ok(/assert-pages-deploy-publication-gate\.js/.test(pagesYml), 'pages workflow runs historical gate')
  assert.ok(/test-jekyll-qa-evidence-exclude\.js/.test(pagesYml), 'pages workflow runs jekyll scope test')
  assertWorkflowStepOrder(
    pagesYml,
    'assert-pages-deploy-publication-gate.js',
    'upload-pages-artifact',
    'gate before artifact',
  )
  assertWorkflowStepOrder(
    pagesYml,
    'validate-pages-jekyll-output.js',
    'upload-pages-artifact',
    'output validation before artifact',
  )
  assertWorkflowStepOrder(pagesYml, 'jekyll-build-pages', 'upload-pages-artifact', 'jekyll before artifact')
  assert.ok(/^permissions:\s*\n\s*contents: read\s*$/m.test(pagesYml), 'workflow default contents: read only')
  const deployBlock = pagesYml.slice(pagesYml.indexOf('  deploy:'))
  assert.ok(/pages: write/.test(deployBlock), 'pages write only on deploy job')
  assert.ok(/id-token: write/.test(deployBlock), 'OIDC only on deploy job')
  assert.ok(!/upload-pages-artifact/.test(pagesYml.split('upload-pages-artifact')[0] + '') || /github\.event_name != 'pull_request'/.test(pagesYml), 'artifact upload guarded off PRs')
  assert.ok(/pull_request:/.test(pagesYml), 'pull_request trigger for required build check')
  assert.ok(/github\.event_name != 'pull_request'/.test(deployBlock), 'deploy never runs on pull_request')
  assert.ok(/SEADAYS_PAGES_ACTIONS_LIVE/.test(pagesYml), 'repo variable cutover guard')
  assert.ok(/dry_run_build_only/.test(pagesYml), 'workflow_dispatch dry-run rehearsal')
  assert.ok(/pages-actions-production-deploy/.test(pagesYml), 'deploy concurrency group')

  const deployYml = fs.readFileSync(DEPLOY_YML, 'utf8')
  assert.ok(deployYml.includes('paths-ignore'), 'legacy landing deploy still path-filtered until retired')
  assert.ok(deployYml.includes('data/**'), 'data-only pushes still skip Channel A landing deploy today')
  assert.ok(!pagesYml.includes('paths-ignore'), 'Actions Pages workflow must not path-filter publication gate')

  execSync('node scripts/build-local-pages-site.js', { cwd: REPO, stdio: 'pipe' })
  execSync('node scripts/validate-pages-jekyll-output.js', {
    cwd: REPO,
    stdio: 'pipe',
    env: { ...process.env, SEADAYS_PAGES_SITE_DIR: path.join(REPO, '_site') },
  })

  console.log('test-pages-actions-migration PASS')
}

main()
