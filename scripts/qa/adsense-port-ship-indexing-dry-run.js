#!/usr/bin/env node
'use strict';

/**
 * Dry-run port/ship indexing recommendations for AdSense low-value remediation.
 * Does not modify HTML, sitemap, or deploy. Writes under qa-evidence/adsense-indexing-dry-run-YYYY-MM-DD/.
 *
 * Usage:
 *   node scripts/qa/adsense-port-ship-indexing-dry-run.js [--sweep /path/sd_sweep.json] [--out-dir /path/evidence]
 */

const fs = require('fs');
const path = require('path');
const { evaluatePublishGate } = require('../lib/publishGate');
const { isPortDetailIndexable, isShipDetailIndexable } = require('../lib/adsenseIndexability');

const repoRoot = path.join(__dirname, '..', '..');

const sweepArg = process.argv.indexOf('--sweep');
const sweepPath =
  sweepArg >= 0 && process.argv[sweepArg + 1]
    ? process.argv[sweepArg + 1]
    : path.join('/tmp', 'sd_sweep.json');

const outDirArg = process.argv.indexOf('--out-dir');
const allowRerunArg = process.argv.includes('--allow-evidence-rerun');
const defaultOutName = `adsense-indexing-dry-run-${new Date().toISOString().slice(0, 10)}`;
const outDir =
  outDirArg >= 0 && process.argv[outDirArg + 1]
    ? path.resolve(process.argv[outDirArg + 1])
    : path.join(repoRoot, 'qa-evidence', defaultOutName);

/** Bundled audit package (safe to regenerate outputs at package root, never under inputs/). */
const ALLOWED_RERUN_EVIDENCE_REL = 'qa-evidence/adsense-indexing-dry-run-2026-10-28-marigot-corrected';
const BASELINE_INPUT_REL = `${ALLOWED_RERUN_EVIDENCE_REL}/inputs/oct28-uncorrected-baseline.csv`;
const OUTPUT_ARTIFACTS = ['port-ship-classification.csv', 'classification-summary.json'];
const FROZEN_EVIDENCE_DIR_RELS = [
  'qa-evidence/adsense-indexing-dry-run-2026-10-27',
  'qa-evidence/adsense-indexing-dry-run-2026-10-28',
];

function loadSweepFromFile(filePath, options = {}) {
  const requireFile = Boolean(options.requireFile);
  if (!filePath || !fs.existsSync(filePath)) {
    if (requireFile) {
      console.error('[dry-run] Missing sweep file:', filePath);
      process.exit(1);
    }
    if (filePath) console.warn('[dry-run] No sweep file at', filePath, '— word/boilerplate columns empty');
    return new Map();
  }
  const sweep = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return new Map(sweep.map((r) => [r.u.replace(/\/$/, ''), r]));
}

const BOILER_PREFIXES = [
  'checkout, payment',
  'read cruiser reviews',
  'seadays can hold the itinerary',
  'open the app',
  'adapted from  wikipedia',
  'for a shore day in',
  'on a call at',
  'cruisers ask about walking',
];
const CURATED_KEEP = new Set([
  'hamburg-germany',
  'barcelona-spain',
  'rome-civitavecchia-italy',
  'miami-fl-united-states',
  'cozumel-mexico',
  'kiel-germany',
  'southampton-united-kingdom',
  'venice-italy',
  'warnemunde-berlin-germany',
  'civitavecchia-italy',
]);
/** Legacy manual pins only — do not add ports with shipped Sprint content here. */
const CURATED_IMPROVE = new Set([]);
const GSC_SAMPLE = new Set([
  'https://seadays.app/ships/havila-capella',
  'https://seadays.app/ports/cochin-india',
  'https://seadays.app/ports/bergen-norway',
]);

function robots(html) {
  const m = String(html).slice(0, 5000).match(/name=["']robots["']\s+content=["']([^"']+)/i);
  return m ? m[1].toLowerCase() : '';
}

function readHtml(kind, slug) {
  const p = path.join(repoRoot, kind === 'ship' ? 'ships' : 'ports', slug, 'index.html');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function boilerShare(sents) {
  if (!sents || !sents.length) return 0;
  const u = [...new Set(sents)];
  let b = 0;
  for (const s of u) {
    const k = s.toLowerCase().trim();
    if (BOILER_PREFIXES.some((p) => k.includes(p))) b += 1;
  }
  return b / u.length;
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function validateEvidenceOutputPath(evidenceOut, resolvedSweepPath, options = {}) {
  const allowRerun = Boolean(options.allowEvidenceRerun ?? allowRerunArg);
  const outResolved = path.resolve(evidenceOut);
  const sweepResolved = path.resolve(resolvedSweepPath);
  const outRel = path.relative(repoRoot, outResolved);
  const inputsResolved = path.join(repoRoot, `${ALLOWED_RERUN_EVIDENCE_REL}/inputs`);
  const baselineResolved = path.join(repoRoot, BASELINE_INPUT_REL);
  const allowedRerunAbs = path.join(repoRoot, ALLOWED_RERUN_EVIDENCE_REL);
  const isRecognizedRerunDest = outResolved === allowedRerunAbs;

  if (outResolved === sweepResolved) {
    return { ok: false, error: 'out-dir cannot be the sweep file path' };
  }

  const outCsv = path.join(outResolved, OUTPUT_ARTIFACTS[0]);
  const outSummary = path.join(outResolved, OUTPUT_ARTIFACTS[1]);
  for (const protectedPath of [sweepResolved, baselineResolved]) {
    if (outCsv === protectedPath) {
      return { ok: false, error: 'output CSV path would overwrite a protected bundled input file' };
    }
    if (outSummary === protectedPath) {
      return { ok: false, error: 'output JSON path would overwrite a protected bundled input file' };
    }
  }

  if (outResolved === inputsResolved || outResolved.startsWith(`${inputsResolved}${path.sep}`)) {
    return { ok: false, error: 'out-dir must not be the bundled inputs directory (would clobber sweep/baseline inputs)' };
  }

  for (const frozenRel of FROZEN_EVIDENCE_DIR_RELS) {
    if (outRel === frozenRel) {
      return { ok: false, error: `out-dir must not target frozen audit evidence: ${frozenRel}` };
    }
    if (outRel.startsWith(`${frozenRel}/`)) {
      return { ok: false, error: `out-dir must not write under frozen audit evidence: ${frozenRel}` };
    }
  }

  const hasOutputs = OUTPUT_ARTIFACTS.some((name) => fs.existsSync(path.join(outResolved, name)));
  if (hasOutputs && !isRecognizedRerunDest && !allowRerun) {
    return {
      ok: false,
      error:
        'out-dir already contains classification outputs; use the marigot-corrected evidence folder or pass --allow-evidence-rerun with strict path validation',
    };
  }

  if (allowRerun && !isRecognizedRerunDest) {
    return {
      ok: false,
      error: '--allow-evidence-rerun is only permitted for the marigot-corrected evidence package out-dir',
    };
  }

  return { ok: true };
}

function assertSafeEvidenceOut(evidenceOut, resolvedSweepPath, options = {}) {
  const result = validateEvidenceOutputPath(evidenceOut, resolvedSweepPath, options);
  if (!result.ok) {
    console.error('[dry-run]', result.error);
    process.exit(1);
  }
}

function buildClassifierContext(options = {}) {
  const resolvedSweepPath = options.sweepPath || sweepPath;
  const sweepBy =
    options.sweepBy ||
    loadSweepFromFile(resolvedSweepPath, { requireFile: Boolean(options.requireSweepFile) });
  const guides = JSON.parse(
    fs.readFileSync(options.guidesPath || path.join(repoRoot, 'data/public-port-guides.json'), 'utf8')
  );
  const overrides = JSON.parse(
    fs.readFileSync(
      options.overridesPath || path.join(repoRoot, 'data/landing-cruise-content-overrides.json'),
      'utf8'
    )
  );
  const sitemapPath = options.sitemapPath || path.join(repoRoot, 'sitemap.xml');
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const detail = locs.filter((u) => /\/(ports|ships)\/[^/]+\/$/.test(u));
  const pages = [];
  for (const u of detail) {
    const m = u.match(/\/(ports|ships)\/([^/]+)\//);
    if (!m) continue;
    const kind = m[1] === 'ships' ? 'ship' : 'port';
    pages.push({ url: u, slug: m[2], kind, html: readHtml(kind, m[2]) });
  }
  const gateBy = new Map(
    evaluatePublishGate(pages.map((p) => ({ ...p, file: p.slug }))).map((g) => [`${g.kind}:${g.slug}`, g])
  );
  return { sweepBy, guides, overrides, pages, gateBy };
}

function classify(p, ctx) {
  const { sweepBy, guides, overrides, gateBy } = ctx;
  const sw = sweepBy.get(p.url.replace(/\/$/, '')) || {};
  const html = p.html;
  const w = sw.w || 0;
  const bs = boilerShare(sw.sents);
  const phase1 = /<details class="pg-terminal-card"/.test(html);
  const guide = guides[p.slug];
  const enriched = Boolean(guide && (guide.thingsToDo?.length || guide.portInfo?.description));
  const hasWiki = /wiki-attribution|adapted from\s+wikipedia/i.test(html);
  const affiliate = /pg-affiliate|Bookable Experiences/i.test(html);
  const ov = ((p.kind === 'port' ? overrides.ports : overrides.ships) || {})[p.slug] || {};
  const indexableGate =
    p.kind === 'port'
      ? isPortDetailIndexable(
          {
            slug: p.slug,
            description: ov.description || '',
            country: ov.country || '',
            hasContentOverride: Boolean(ov.description),
          },
          guide
        )
      : isShipDetailIndexable({
          slug: p.slug,
          description: ov.description || '',
          confidenceScore: ov.confidenceScore,
          hasContentOverride: Boolean(ov.description),
        });
  const issues = (gateBy.get(`${p.kind}:${p.slug}`) || { issues: [] }).issues.filter((i) => i !== 'audit noindex');
  let recommendation = 'IMPROVE';
  const rationale = [];
  if (p.kind === 'port') {
    if (CURATED_IMPROVE.has(p.slug)) {
      recommendation = 'IMPROVE';
      rationale.push('curated legacy template; needs Phase-1/terminal data');
    } else if (CURATED_KEEP.has(p.slug) || enriched) {
      recommendation = 'KEEP_INDEX';
      rationale.push('major hub or enriched guide dataset');
    } else if (!phase1) {
      recommendation = 'NOINDEX_CANDIDATE';
      rationale.push('no Phase-1 terminal markup');
    } else if (w < 380 && bs > 0.15) {
      recommendation = 'NOINDEX_CANDIDATE';
      rationale.push('thin live body with heavy template blocks');
    } else if (bs >= 0.4) {
      recommendation = 'NOINDEX_CANDIDATE';
      rationale.push('boilerplate dominates unique port prose');
    } else if (hasWiki || issues.length || w < 500) {
      recommendation = 'IMPROVE';
      rationale.push('Phase-1 shell OK; add sourced terminals/tips' + (hasWiki ? '; de-emphasize wiki' : ''));
      if (issues.length) rationale.push('gate: ' + issues.join('; '));
    } else {
      recommendation = 'KEEP_INDEX';
      rationale.push('Phase-1 port with sufficient distinct prose');
    }
  } else if (!indexableGate) {
    recommendation = 'NOINDEX_CANDIDATE';
    rationale.push('fails ship indexability gate');
  } else if (issues.includes('spec gt/pax') || issues.includes('spec length')) {
    recommendation = 'NOINDEX_CANDIDATE';
    rationale.push('spec heuristic');
  } else if (ov.description && issues.length === 0) {
    recommendation = 'KEEP_INDEX';
    rationale.push('override description + clean gate');
  } else {
    recommendation = 'IMPROVE';
    rationale.push('catalog page; enrich overview before relying on index');
  }
  return {
    recommendation,
    rationale: rationale.join('; '),
    current_robots: robots(html),
    words_live: w,
    boilerplate_share: bs ? bs.toFixed(2) : '',
    phase1_port: p.kind === 'port' ? phase1 : '',
    enriched_guide: enriched,
    has_wiki: hasWiki,
    affiliate_block: affiliate,
    indexable_gate: indexableGate,
    gate_issues: issues.join('; '),
    gsc_crawled_not_indexed_sample: GSC_SAMPLE.has(p.url.replace(/\/$/, '')) ? 'yes' : '',
  };
}

function runDryRun(options = {}) {
  const evidenceOut = options.outDir || outDir;
  const resolvedSweepPath = options.sweepPath || sweepPath;
  const requireSweepFile = options.requireSweepFile ?? sweepArg >= 0;
  assertSafeEvidenceOut(evidenceOut, resolvedSweepPath);
  const ctx = buildClassifierContext({ ...options, sweepPath: resolvedSweepPath, requireSweepFile });
  const results = ctx.pages.map((p) => {
    const c = classify(p, ctx);
    return { kind: p.kind, slug: p.slug, url: p.url, ...c };
  });
  for (const hub of [
    { url: 'https://seadays.app/ports/', kind: 'port', slug: '(directory)' },
    { url: 'https://seadays.app/ships/', kind: 'ship', slug: '(directory)' },
  ]) {
    results.push({
      ...hub,
      recommendation: 'KEEP_INDEX',
      rationale: 'directory navigation hub; not a thin clone',
      current_robots: 'index, follow',
      words_live: '',
      boilerplate_share: '',
      phase1_port: '',
      enriched_guide: '',
      has_wiki: '',
      affiliate_block: '',
      indexable_gate: '',
      gate_issues: '',
      gsc_crawled_not_indexed_sample: '',
    });
  }
  const counts = { KEEP_INDEX: 0, IMPROVE: 0, NOINDEX_CANDIDATE: 0 };
  for (const r of results) counts[r.recommendation] += 1;
  function countsBy(kind) {
    const c = { KEEP_INDEX: 0, IMPROVE: 0, NOINDEX_CANDIDATE: 0 };
    results.filter((r) => r.kind === kind).forEach((r) => {
      c[r.recommendation] += 1;
    });
    return c;
  }
  fs.mkdirSync(evidenceOut, { recursive: true });
  const header = [
    'kind',
    'slug',
    'url',
    'recommendation',
    'current_robots',
    'words_live',
    'boilerplate_share',
    'phase1_port',
    'enriched_guide',
    'has_wiki',
    'affiliate_block',
    'indexable_gate',
    'gate_issues',
    'gsc_crawled_not_indexed_sample',
    'rationale',
  ];
  const csv = [header.join(',')]
    .concat(results.map((r) => header.map((h) => esc(r[h])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(evidenceOut, 'port-ship-classification.csv'), csv);
  fs.writeFileSync(
    path.join(evidenceOut, 'classification-summary.json'),
    JSON.stringify(
      {
        generated: new Date().toISOString().slice(0, 10),
        production_base: options.productionBase || null,
        counts_uncorrected_oct28: {
          KEEP_INDEX: 53,
          IMPROVE: 79,
          NOINDEX_CANDIDATE: 120,
        },
        baseline_csv_readonly: BASELINE_INPUT_REL,
        sweep_file: fs.existsSync(resolvedSweepPath)
          ? path.relative(repoRoot, path.resolve(resolvedSweepPath))
          : null,
        classifier_script: 'scripts/qa/adsense-port-ship-indexing-dry-run.js',
        classifier_command:
          'node scripts/qa/adsense-port-ship-indexing-dry-run.js --sweep <sweep.json> --out-dir qa-evidence/adsense-indexing-dry-run-2026-10-28-marigot-corrected',
        sitemap_url_count: ctx.pages.length,
        sweep_limitations:
          '389 live URLs; 7 blog fetch errors in original capture; 250/250 port/ship detail rows present after klaipeda-lithuania retry (see inputs/sweep-provenance.json)',
        evidence: [
          'data/public-port-guides.json',
          'data/landing-cruise-content-overrides.json',
          'scripts/lib/publishGate.js',
          'scripts/lib/adsenseIndexability.js',
          'docs/port-ship-content-recovery-progress.md',
          'docs/adsense-content-recovery-progress.md',
        ],
        repo_root: repoRoot,
        total_urls: results.length,
        counts,
        ports: countsBy('port'),
        ships: countsBy('ship'),
      },
      null,
      2
    )
  );
  return { results, counts, ports: countsBy('port'), ships: countsBy('ship'), outDir: evidenceOut };
}

if (require.main === module) {
  const summary = runDryRun({ productionBase: process.env.SEADAYS_PRODUCTION_BASE || null });
  console.log('[dry-run] wrote', summary.outDir);
  console.log(JSON.stringify({ total: summary.results.length, counts: summary.counts, ports: summary.ports, ships: summary.ships }, null, 2));
}

module.exports = {
  BOILER_PREFIXES,
  CURATED_IMPROVE,
  CURATED_KEEP,
  boilerShare,
  buildClassifierContext,
  classify,
  runDryRun,
  validateEvidenceOutputPath,
  ALLOWED_RERUN_EVIDENCE_REL,
  BASELINE_INPUT_REL,
};
