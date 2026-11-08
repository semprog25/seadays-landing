#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');

const REPO = path.join(__dirname, '..');
const STAGE29 = path.join(REPO, 'qa-evidence', 'stage29-25-port-release');
const EILAT_SLUG = 'eilat-israel';
const CHAN_SLUG = 'da-nang-hue-chan-may-vietnam';
const STAGE28_BUNDLE = '50f0af8831cb3a709bc325d896e7e54fdb34efa7afc4820ff76ebefaa6b759ad';
const PREV_BUNDLE = 'a2b8efa26a281ec9fc3315136e1b75fb41651e87d80ce4f0826e78377450e35e';

function hashGuide(guide) {
  return crypto.createHash('sha256').update(stableStringify(guide)).digest('hex');
}

function main() {
  const mainGuides = JSON.parse(
    execSync('git show origin/main:data/public-port-guides.json', { cwd: REPO, encoding: 'utf8' })
  );
  const guides = loadPublicPortGuidesFile(REPO);
  const rollbackEilat = path.join(STAGE29, 'rollback-pre-apply/public-port-guides.json');
  const beforeEilat = JSON.parse(fs.readFileSync(rollbackEilat, 'utf8')).byAppPortId.eilat;

  guides.byAppPortId.eilat = JSON.parse(JSON.stringify(mainGuides.byAppPortId.eilat));
  const da = guides.byAppPortId['da-nang'];
  if (!da?.thingsToDo) throw new Error('missing da-nang guide');
  da.gettingThere = {
    ...da.gettingThere,
    transportation: ['Coach excursion', 'Taxi'],
    distanceToCity:
      'Chan May is a remote berth — Hue and Da Nang need confirmed coach or taxi transfers (typically 45–90+ minutes each way depending on traffic; not timed on port pages).',
    distanceAnswer:
      'Chan May is a remote berth — Hue and Da Nang need confirmed coach or taxi transfers (typically 45–90+ minutes each way depending on traffic; not timed on port pages).',
  };
  da.thingsToDo = {
    ...da.thingsToDo,
    intro:
      'Chan May is an industrial cruise berth between Hue and Da Nang. Plan confirmed transfers — you cannot walk into either city centre from the port.',
    shortCall:
      'Ship or port-area excursions only if offered; do not plan a self-directed walk into Hue or Da Nang without confirmed transfer time.',
    standardCall:
      'Pick one coach direction: Hue Imperial City (full day) or Da Nang / Marble Mountains — confirm ship, line, or licensed transfer and allow transfer time before sightseeing.',
    longerCall:
      'A second confirmed coach outing needs a long window and separate timing; Hue and Da Nang are distinct destinations, not a same-day pair from Chan May.',
  };
  if (da.researchImport) {
    da.researchImport.stage31_chan_may_call_plan_fix = true;
    da.researchImport.stage31_applied_at_utc = new Date().toISOString();
  }

  writePublicPortGuidesFile(REPO, guides);

  const eilatHtmlMain = execSync(`git show origin/main:ports/${EILAT_SLUG}/index.html`, {
    cwd: REPO,
    encoding: 'utf8',
  });
  fs.writeFileSync(path.join(REPO, 'ports', EILAT_SLUG, 'index.html'), eilatHtmlMain, 'utf8');

  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE29, 'STAGE29_RELEASE_MANIFEST.json'), 'utf8'));
  const kept = manifest.ports.filter((p) => p.landing_slug !== EILAT_SLUG);
  if (kept.length !== 24) throw new Error(`expected 24 manifest ports after eilat drop, got ${kept.length}`);

  const chanRow = kept.find((p) => p.landing_slug === CHAN_SLUG);
  if (!chanRow) throw new Error('missing chan may row');
  const chanGuide = guides.byAppPortId['da-nang'];
  chanRow.proposed_content_hash = hashGuide(chanGuide);
  chanRow.candidate_content_hash = chanRow.proposed_content_hash;
  chanRow.stage28_candidate_content_hash = chanRow.proposed_content_hash;
  chanRow.stage31_content_revision = 'chan_may_remote_port_call_plans';

  const slugs = kept.map((p) => p.landing_slug).sort();
  const bundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        kept.map((p) => ({
          landing_slug: p.landing_slug,
          candidate_content_hash: p.candidate_content_hash,
          draft_file_sha256: p.draft_file_sha256,
        }))
      )
    )
    .digest('hex');

  const lockedAt = new Date().toISOString();
  const nextManifest = {
    ...manifest,
    lock_version: 'stage31-24-port-release-v1',
    previous_bundle_idempotency_hash: PREV_BUNDLE,
    stage28_source_bundle_hash: STAGE28_BUNDLE,
    bundle_idempotency_hash: bundleHash,
    candidate_count: 24,
    passing_all_gates: kept.filter((p) => p.publication_gates_pass).length,
    slugs_locked: slugs,
    ports: kept,
    stage31_eilat_excluded_at_utc: lockedAt,
    stage31_eilat_exclusion: {
      landing_slug: EILAT_SLUG,
      rationale:
        'Owner gate: independent verification required for current cruise passenger arrival and Red Sea call patterns before passenger editorial release. Not asserting permanent port closure.',
      restored_from: 'origin/main',
      guide_restored_hash: hashGuide(guides.byAppPortId.eilat),
      branch_guide_before_restore_hash: hashGuide(beforeEilat),
    },
    stage31_chan_may_correction: {
      landing_slug: CHAN_SLUG,
      summary: 'Remote-port call plans; removed city-centre walk framing; Hue vs Da Nang transfers explicit',
    },
  };

  fs.writeFileSync(path.join(STAGE29, 'STAGE29_RELEASE_MANIFEST.json'), `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

  const locked = JSON.parse(fs.readFileSync(path.join(STAGE29, 'STAGE29_LOCKED_COHORT.json'), 'utf8'));
  locked.picked = locked.picked.filter((p) => p.landing_slug !== EILAT_SLUG);
  locked.limit = 24;
  locked.stage31_note = 'Eilat excluded; final cohort matches manifest slugs_locked';
  fs.writeFileSync(path.join(STAGE29, 'STAGE29_LOCKED_COHORT.json'), `${JSON.stringify(locked, null, 2)}\n`, 'utf8');

  const apply = JSON.parse(fs.readFileSync(path.join(STAGE29, 'STAGE29_APPLY_REPORT.json'), 'utf8'));
  apply.slugs = slugs;
  apply.app_port_ids = kept.map((p) => p.app_port_id).sort();
  apply.integrity = apply.integrity.filter((i) => i.landing_slug !== EILAT_SLUG);
  apply.stage29_release_bundle_hash = bundleHash;
  apply.stage31_eilat_excluded = true;
  apply.stage31_previous_bundle = PREV_BUNDLE;
  apply.applied_at = lockedAt;
  apply.rollback_dir = path.join(STAGE29, 'rollback-pre-apply');
  fs.writeFileSync(path.join(STAGE29, 'STAGE29_APPLY_REPORT.json'), `${JSON.stringify(apply, null, 2)}\n`, 'utf8');

  fs.writeFileSync(
    path.join(STAGE29, 'STAGE31_EILAT_EXCLUSION.json'),
    `${JSON.stringify(
      {
        excluded_at_utc: lockedAt,
        landing_slug: EILAT_SLUG,
        retained_live_url: 'https://seadays.app/ports/eilat-israel/',
        restored_guide_hash: hashGuide(guides.byAppPortId.eilat),
        exception_queue:
          'Re-enrichment blocked until owner-verified current cruise calls and passenger arrival procedures (no permanent-closure claim).',
        research_preserved: 'qa-evidence/stage28-bulk-candidates/drafts/eilat-israel.json',
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const md = fs.readFileSync(path.join(STAGE29, 'STAGE29_25_PORT_RELEASE_CANDIDATE.md'), 'utf8');
  const md24 = md
    .replace('25-port', '24-port')
    .replace('**25**', '**24**')
    .replace(/\| `bod-norway`[\s\S]*?\n/, '')
    .concat(
      '\n## Stage 31\n\n- **`eilat-israel` excluded** from publication cohort; guide + HTML restored from `origin/main`.\n- **Chan May** call-plan copy corrected for remote-port transfers.\n- **Supersedes** 25-port bundle `a2b8efa2…`.\n- **New release bundle:** `' +
        bundleHash +
        '`.\n'
    );
  fs.writeFileSync(path.join(STAGE29, 'STAGE29_25_PORT_RELEASE_CANDIDATE.md'), md24, 'utf8');

  execSync(`SEADAYS_REGEN_PORT_SLUGS=${CHAN_SLUG} node scripts/regenerate-port-pages.js`, {
    cwd: REPO,
    stdio: 'inherit',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        slugs,
        bundleHash,
        eilat_restored: true,
        chan_regen: CHAN_SLUG,
      },
      null,
      2
    )
  );
}

main();
