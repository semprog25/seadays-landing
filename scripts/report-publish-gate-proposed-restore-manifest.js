#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluatePublishGate } = require('./lib/publishGate');
const { isPortSeoRedirectSlug } = require('./lib/portSeoRedirects');
const {
  buildRestoreContext,
  mayRestorePageToIndex,
  portPassesIndexabilityGate,
  shipPassesIndexabilityGate,
} = require('./lib/publishGateRestoreEligibility');
const {
  classifySlugForRestoreProposal,
  isExplicitlyApprovedForIndexRestore,
  isRestoreApplyEnabled,
  loadOct27AuditClassMap,
  RESTORE_ALLOWED_AUDIT_CLASSES,
} = require('./lib/publishGateIndexRestoreManifest');

const repoRoot = path.join(__dirname, '..');

function isNoindex(html) {
  return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(String(html || '').slice(0, 4000));
}

function listPages(kind) {
  const dir = path.join(repoRoot, kind === 'ship' ? 'ships' : 'ports');
  const pages = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(dir, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    pages.push({
      file,
      slug: ent.name,
      kind,
      html: fs.readFileSync(file, 'utf8'),
    });
  }
  return pages;
}

function wouldPassTechnicalRestore(page, ctx, gateIssues) {
  if (gateIssues.length > 0) return false;
  if (/http-equiv=["']refresh/i.test(page.html.slice(0, 2500))) return false;
  if (page.kind === 'port' && isPortSeoRedirectSlug(page.slug)) return false;
  if (page.kind === 'ship') {
    return shipPassesIndexabilityGate(page.slug, ctx.shipOverrides);
  }
  return portPassesIndexabilityGate(
    page.slug,
    page.html,
    ctx.repoRoot,
    ctx.guidesById,
    ctx.portOverrides
  );
}

function main() {
  const auditMap = loadOct27AuditClassMap(repoRoot);
  const ctx = buildRestoreContext(repoRoot);
  const pages = [...listPages('port'), ...listPages('ship')];
  const results = evaluatePublishGate(pages);
  const byFile = new Map(results.map((row) => [row.file, row]));

  const proposed = [];
  const approvedNow = [];
  const counts = {
    KEEP_INDEX: 0,
    IMPROVE: 0,
    NOINDEX_CANDIDATE: 0,
    UNCLASSIFIED: 0,
  };

  for (const page of pages) {
    if (!isNoindex(page.html)) continue;
    const row = byFile.get(page.file);
    const gateIssues = row ? row.issues : ['missing'];
    const auditClass = classifySlugForRestoreProposal(page.kind, page.slug, auditMap);
    counts[auditClass] = (counts[auditClass] || 0) + 1;
    const technicalOk = wouldPassTechnicalRestore(page, ctx, gateIssues);
    const legacyPr55WouldRestore = technicalOk && !gateIssues.length;
    const safeApproved = mayRestorePageToIndex(page, {
      ...ctx,
      gateIssues,
      html: page.html,
    });
    const entry = {
      kind: page.kind,
      slug: page.slug,
      url: `https://seadays.app/${page.kind === 'ship' ? 'ships' : 'ports'}/${page.slug}/`,
      auditClass,
      gateIssues,
      technicalIndexabilityOk: technicalOk,
      legacyUnapprovedWouldRestore: legacyPr55WouldRestore,
      safeApprovedRestoreNow: safeApproved,
    };
    if (legacyPr55WouldRestore) proposed.push(entry);
    if (safeApproved) approvedNow.push(entry);
  }

  const byClass = { KEEP_INDEX: [], IMPROVE: [], NOINDEX_CANDIDATE: [], UNCLASSIFIED: [] };
  for (const e of proposed) {
    byClass[e.auditClass] = byClass[e.auditClass] || [];
    byClass[e.auditClass].push(e.slug);
  }

  const catalogPages = pages.length;
  const auditCsvRows = auditMap.size;

  console.log(
    JSON.stringify(
      {
        restoreApplyEnabled: isRestoreApplyEnabled(),
        approvedManifestPresent: Boolean(ctx.manifest),
        catalogPortShipPages: catalogPages,
        oct27AuditMapEntries: auditCsvRows,
        whyProposedExceeds252:
          catalogPages > auditCsvRows
            ? `${catalogPages - auditCsvRows} on-disk port/ship dirs not in Oct27 CSV (catalogue growth or sitemap drift)`
            : 'counts align',
        legacyUnapprovedWouldRestoreCount: proposed.length,
        safeApprovedRestoreCountNow: approvedNow.length,
        proposedByAuditClass: {
          KEEP_INDEX: byClass.KEEP_INDEX.length,
          IMPROVE: byClass.IMPROVE.length,
          NOINDEX_CANDIDATE: byClass.NOINDEX_CANDIDATE.length,
          UNCLASSIFIED: byClass.UNCLASSIFIED.length,
        },
        sampleSlugs: {
          KEEP_INDEX: byClass.KEEP_INDEX.slice(0, 8),
          IMPROVE: byClass.IMPROVE.slice(0, 8),
          NOINDEX_CANDIDATE: byClass.NOINDEX_CANDIDATE.slice(0, 8),
          UNCLASSIFIED: byClass.UNCLASSIFIED.slice(0, 8),
        },
        representativeChecks: {
          barcelona: proposed.find((e) => e.slug === 'barcelona-spain'),
          miami: proposed.find((e) => e.slug === 'miami-fl-united-states'),
          marigot: proposed.find((e) => e.slug === 'marigot-st-maarten'),
          carnivalBreeze: proposed.find((e) => e.slug === 'carnival-breeze'),
          acapulco: pages.find((p) => p.slug === 'acapulco-mexico')
            ? {
                gateIssues: byFile.get(
                  pages.find((p) => p.slug === 'acapulco-mexico').file
                )?.issues,
              }
            : null,
        },
        allowedManifestAuditClasses: [...RESTORE_ALLOWED_AUDIT_CLASSES],
        entries: proposed,
      },
      null,
      2
    )
  );
}

main();
