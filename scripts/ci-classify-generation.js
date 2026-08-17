#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');
const { resolveGenerationPlan } = require('./lib/ciClassifyGeneration');
const { generateArgsForChannel } = require('./lib/generateMode');

function changedFilesFromGit() {
  let before = String(process.env.GITHUB_EVENT_BEFORE || '').trim();
  const sha = String(process.env.GITHUB_SHA || 'HEAD').trim();
  if (!before && process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    try {
      const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      before = String(event.before || '').trim();
    } catch {
      before = '';
    }
  }
  if (!before || /^0+$/.test(before)) return [];
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${before}...${sha}`], {
      encoding: 'utf8',
    });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (err) {
    console.warn('[ci-classify] git diff failed; skipping generation rather than running a full rebuild.');
    console.warn(String(err && err.message ? err.message : err));
    return [];
  }
}

function writeGithubOutput(plan) {
  const args = plan.skip ? [] : generateArgsForChannel(plan.channel, {
    allowOrphanCleanup: plan.allowOrphanCleanup,
  });
  const lines = [
    `skip=${plan.skip ? 'true' : 'false'}`,
    `channel=${plan.channel}`,
    `needs_viator=${plan.needsViator ? 'true' : 'false'}`,
    `needs_featured_thumbs=${plan.needsFeaturedThumbs ? 'true' : 'false'}`,
    `allow_orphan_cleanup=${plan.allowOrphanCleanup ? 'true' : 'false'}`,
    `commit_message=${plan.commitMessage || ''}`,
    `generate_args=${args.join(' ')}`,
  ];
  const target = process.env.GITHUB_OUTPUT;
  if (target) fs.appendFileSync(target, `${lines.join('\n')}\n`);
  for (const line of lines) console.log(line);
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME || 'push';
  const dispatchChannel = process.env.GENERATION_CHANNEL || '';
  const allowOrphanCleanup =
    process.env.ALLOW_ORPHAN_CLEANUP === 'true' || process.env.ALLOW_ORPHAN_CLEANUP === '1';
  const changedFiles = changedFilesFromGit();
  const plan = resolveGenerationPlan({
    eventName,
    changedFiles,
    dispatchChannel,
    allowOrphanCleanup,
  });
  console.log(`[ci-classify] event=${eventName} files=${changedFiles.length} channel=${plan.channel}`);
  if (changedFiles.length) console.log(`[ci-classify] changed:\n${changedFiles.join('\n')}`);
  writeGithubOutput(plan);
}

if (require.main === module) main();
