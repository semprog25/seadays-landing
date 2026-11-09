'use strict';

const fs = require('fs');
const path = require('path');
const { getPortMergePolicy, shouldRejectTerminalSlug } = require('./mergePolicy');
const { verifyResearchPortSha } = require('./verifyResearchSha');
const { deepEqual, collectChangedPaths, stableStringify } = require('./jsonDiff');
const {
  readResearchMarkdown,
  researchToGuidePatch,
  researchToTerminals,
} = require('./transformResearchToPublic');
const { parseFrontmatter } = require('./resolveYaml');
const { mergeGuide, preferText } = require('./mergePublicGuide');

const PRESERVE_TOP_LEVEL = ['hero', 'shorePlansFirst', 'sourcesUsed', 'lastEnrichment'];

const AALBORG_CONTENT_ONLY_SLUG = 'aalborg-denmark';

/** Paths allowed when applying content-only with editorial needs_review acknowledgement. */
const AALBORG_APPROVED_GUIDE_DIFF_PREFIXES = [
  'thingsToDo',
  'gettingThere.fromTerminal',
  'gettingThere.publicTransport',
  'researchImport',
];

function isApprovedGuideDiffPath(pathKey) {
  return AALBORG_APPROVED_GUIDE_DIFF_PREFIXES.some(
    (p) => pathKey === p || pathKey.startsWith(`${p}.`)
  );
}

function buildAalborgContentOnlyGuide(existingGuide, mergedGuide, { ackedAtIso }) {
  const out = JSON.parse(JSON.stringify(existingGuide || {}));
  if (mergedGuide?.thingsToDo) {
    out.thingsToDo = JSON.parse(JSON.stringify(mergedGuide.thingsToDo));
  }
  out.gettingThere = { ...(out.gettingThere || {}) };
  const gt = mergedGuide?.gettingThere || {};
  if (gt.fromTerminal) out.gettingThere.fromTerminal = gt.fromTerminal;
  if (gt.publicTransport) out.gettingThere.publicTransport = gt.publicTransport;
  if (mergedGuide?.researchImport) {
    out.researchImport = {
      ...JSON.parse(JSON.stringify(mergedGuide.researchImport)),
      content_only_apply: true,
      editorial_needs_review_acked_at: ackedAtIso,
      approved_field_set: [
        'thingsToDo',
        'gettingThere.fromTerminal',
        'gettingThere.publicTransport',
        'researchImport.travelerQuestions',
      ],
    };
  }
  return out;
}

function assertAalborgContentOnlyDiff(existingGuide, nextGuide) {
  const paths = collectChangedPaths(existingGuide, nextGuide);
  const rejected = paths.filter((p) => !isApprovedGuideDiffPath(p));
  return { ok: rejected.length === 0, changed_paths: paths, rejected_paths: rejected };
}

function gateManifestForApply(manifestRow) {
  const blockers = [];
  if (!manifestRow) blockers.push('missing_manifest_row');
  if (manifestRow?.qa_verdict === 'BLOCKED') blockers.push('qa_blocked');
  if (manifestRow?.qa_verdict !== 'PASS') blockers.push('qa_not_pass');
  if (!manifestRow?.app_port_id) blockers.push('missing_app_port_id');
  if (manifestRow?.identifier_status === 'unresolved') blockers.push('identifier_unresolved');
  if (manifestRow?.identifier_status === 'inferred') blockers.push('identifier_inferred');
  if (!manifestRow?.has_public_port_guide) blockers.push('missing_public_guide_entry');
  return blockers;
}

function buildResearchImportBlock(patch, prevImport, { researchSha, landingSlug, policyTag }) {
  return {
    schema_version: patch.researchImport?.schema_version || prevImport.schema_version || 1,
    researched_at_utc: patch.researchImport?.researched_at_utc || prevImport.researched_at_utc || null,
    qa_verdict: patch.researchImport?.qa_verdict || prevImport.qa_verdict || 'PASS',
    import_tier: 'policy_applied',
    research_sha256: researchSha,
    landing_slug: landingSlug,
    applied_policy: policyTag,
    travelerQuestions: patch.researchImport?.travelerQuestions || prevImport.travelerQuestions,
  };
}

function applyGuideWithPolicy(existingGuide, patch, policy, { researchSha, landingSlug }) {
  const prevImport = existingGuide?.researchImport || {};
  const policyTag = policy.enrichment_mode ? 'enrichment_pilot' : 'preserve_live_defaults';

  if (policy.enrichment_mode) {
    const out = mergeGuide(existingGuide, patch);
    for (const key of PRESERVE_TOP_LEVEL) {
      if (existingGuide?.[key] != null) out[key] = existingGuide[key];
    }
    if (!policy.allow_portInfo_description_replace && existingGuide?.portInfo?.description) {
      out.portInfo.description = existingGuide.portInfo.description;
    }
    if (existingGuide?.thingsToDo && !policy.allow_thingsToDo_replace) {
      out.thingsToDo = JSON.parse(JSON.stringify(existingGuide.thingsToDo));
    }
    const emptyFrom = !String(existingGuide?.gettingThere?.fromTerminal || '').trim();
    if (emptyFrom && patch.gettingThere?.fromTerminal) {
      out.gettingThere = out.gettingThere || {};
      out.gettingThere.fromTerminal = preferText('', patch.gettingThere.fromTerminal);
    }
    const emptyPt = !String(existingGuide?.gettingThere?.publicTransport || '').trim();
    if (emptyPt && policy.allow_gettingThere_publicTransport_replace && patch.gettingThere?.publicTransport) {
      out.gettingThere = out.gettingThere || {};
      out.gettingThere.publicTransport = preferText('', patch.gettingThere.publicTransport);
    }
    if (!existingGuide?.thingsToDo && policy.allow_thingsToDo_replace && patch.thingsToDo) {
      out.thingsToDo = JSON.parse(JSON.stringify(patch.thingsToDo));
    }
    out.researchImport = buildResearchImportBlock(patch, prevImport, { researchSha, landingSlug, policyTag });
    return out;
  }

  const out = JSON.parse(JSON.stringify(existingGuide || {}));
  for (const key of PRESERVE_TOP_LEVEL) {
    if (existingGuide && existingGuide[key] != null) out[key] = existingGuide[key];
  }

  if (patch.portInfo && out.portInfo) {
    if (policy.allow_portInfo_description_replace) {
      out.portInfo.description = patch.portInfo.description || out.portInfo.description;
    } else if (existingGuide?.portInfo?.description != null) {
      out.portInfo.description = existingGuide.portInfo.description;
    }
    for (const k of ['timezone', 'language', 'currency']) {
      if (existingGuide?.portInfo?.[k]) out.portInfo[k] = existingGuide.portInfo[k];
    }
  }

  if (patch.gettingThere && out.gettingThere) {
    out.gettingThere.fromTerminal = existingGuide?.gettingThere?.fromTerminal ?? out.gettingThere.fromTerminal;
    out.gettingThere.distanceToCity = existingGuide?.gettingThere?.distanceToCity ?? out.gettingThere.distanceToCity;
    if (policy.allow_gettingThere_publicTransport_replace) {
      out.gettingThere.publicTransport =
        patch.gettingThere.publicTransport || out.gettingThere.publicTransport;
    } else if (existingGuide?.gettingThere?.publicTransport != null) {
      out.gettingThere.publicTransport = existingGuide.gettingThere.publicTransport;
    }
    if (existingGuide?.gettingThere?.transportation) {
      out.gettingThere.transportation = existingGuide.gettingThere.transportation;
    }
  }

  if (existingGuide?.thingsToDo) {
    out.thingsToDo = JSON.parse(JSON.stringify(existingGuide.thingsToDo));
  } else if (policy.allow_thingsToDo_replace && patch.thingsToDo) {
    out.thingsToDo = JSON.parse(JSON.stringify(patch.thingsToDo));
  }

  out.researchImport = buildResearchImportBlock(patch, prevImport, { researchSha, landingSlug, policyTag });
  return out;
}

function manifestQa(patch) {
  return patch?.researchImport?.qa_verdict || null;
}

function filterIncomingTerminals(importable, policy, existingList) {
  const existingSlugs = new Set((existingList || []).map((t) => String(t.slug).toLowerCase()));
  const filtered = [];
  const rejected = [];
  for (const t of importable || []) {
    const slug = String(t.slug || '').toLowerCase();
    const rejectCheck = shouldRejectTerminalSlug(slug, policy);
    if (rejectCheck.reject) {
      rejected.push({ slug, reason: rejectCheck.reason });
      continue;
    }
    if (!policy.allow_new_terminal_cards && !existingSlugs.has(slug)) {
      rejected.push({ slug, reason: 'new_terminal_card_not_allowed' });
      continue;
    }
    filtered.push(t);
  }
  return { filtered, rejected };
}

function applyTerminalsWithPolicy(existingList, importable, policy) {
  const existing = Array.isArray(existingList) ? existingList.map((t) => ({ ...t })) : [];
  const bySlug = new Map(existing.map((t) => [String(t.slug).toLowerCase(), t]));
  const reportPre = { rejected: [] };
  let incomingList = importable || [];
  if (policy.allow_terminal_map_pin === false) {
    for (const t of incomingList) {
      reportPre.rejected.push({
        slug: t.slug,
        reason: 'terminal_map_pin_disabled_by_policy',
      });
    }
    incomingList = [];
  }
  const { filtered, rejected } = filterIncomingTerminals(incomingList, policy, existing);
  const allRejected = [...reportPre.rejected, ...rejected];

  const report = { metadata_only: [], preserved: [], rejected: allRejected, added: [] };

  for (const incoming of filtered) {
    const slug = String(incoming.slug).toLowerCase();
    let prev = bySlug.get(slug);
    if (!prev && policy.allow_new_terminal_cards) {
      const created = {
        name: incoming.name,
        slug: incoming.slug,
        description: incoming.description,
        address: incoming.address || '',
        latitude: incoming.latitude,
        longitude: incoming.longitude,
        terminal_type: 'both',
        terminal_status: 'active',
        is_primary: incoming.is_primary ?? true,
        sort_order: incoming.sort_order ?? 10,
        country_id: incoming.country_id,
        map_precision_tier: incoming.map_precision_tier,
        map_precision_label: incoming.map_precision_label,
      };
      bySlug.set(slug, created);
      report.added = report.added || [];
      report.added.push(slug);
      prev = created;
      continue;
    }
    if (!prev) continue;
    const next = { ...prev };
    let touched = false;

    if (!policy.preserve_terminal_descriptions && incoming.description) {
      next.description = incoming.description;
      touched = true;
    }
    if (!policy.preserve_terminal_coordinates) {
      if (incoming.latitude != null) {
        next.latitude = incoming.latitude;
        touched = true;
      }
      if (incoming.longitude != null) {
        next.longitude = incoming.longitude;
        touched = true;
      }
    }
    if (incoming.map_precision_tier && next.map_precision_tier !== incoming.map_precision_tier) {
      next.map_precision_tier = incoming.map_precision_tier;
      touched = true;
    }
    if (incoming.map_precision_label && next.map_precision_label !== incoming.map_precision_label) {
      next.map_precision_label = incoming.map_precision_label;
      touched = true;
    }
    bySlug.set(slug, next);
    if (touched) report.metadata_only.push(slug);
    else report.preserved.push(slug);
  }

  let terminals = Array.from(bySlug.values());
  if (policy.max_terminal_cards != null && terminals.length > policy.max_terminal_cards) {
    terminals = terminals.slice(0, policy.max_terminal_cards);
  }
  terminals.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.slug).localeCompare(String(b.slug)));

  return { terminals, report };
}

/**
 * @returns {import('./applyPortResearch').ApplyResult}
 */
function computePolicyApply({
  researchRoot,
  landingSlug,
  manifestRow,
  existingGuide,
  existingTerminals,
}) {
  const policy = getPortMergePolicy(landingSlug);
  const hardBlockers = gateManifestForApply(manifestRow);
  const shaCheck = verifyResearchPortSha({ researchRoot, landingSlug, manifestRow });
  if (!shaCheck.ok) hardBlockers.push(shaCheck.reason || 'sha_failed');

  const warnings = [];
  if ((manifestRow?.import_blockers || []).length > 0) {
    warnings.push({ type: 'manifest_import_blockers', items: manifestRow.import_blockers });
  }

  if (hardBlockers.length > 0) {
    return {
      ok: false,
      hardBlockers,
      warnings,
      shaCheck,
      policy,
      mergedGuide: null,
      mergedTerminals: null,
      changed_fields: { guide: [], terminals: [] },
      content_changed: false,
    };
  }

  const raw = readResearchMarkdown(researchRoot, landingSlug);
  const { meta, body } = parseFrontmatter(raw);
  const guidePatch = researchToGuidePatch(meta, body);
  guidePatch.appPortId = manifestRow.app_port_id;

  const { importable, gateReport } = researchToTerminals(meta, manifestRow.country_id, landingSlug);

  const mergedGuide = applyGuideWithPolicy(existingGuide, guidePatch, policy, {
    researchSha: shaCheck.expected,
    landingSlug,
  });

  const terminalApply = applyTerminalsWithPolicy(existingTerminals, importable, policy);

  const guideChanged = !deepEqual(existingGuide, mergedGuide);
  const terminalsChanged = !deepEqual(existingTerminals, terminalApply.terminals);

  return {
    ok: true,
    hardBlockers: [],
    warnings,
    shaCheck,
    policy,
    mergedGuide,
    mergedTerminals: terminalApply.terminals,
    terminalGate: { gateReport, terminal_apply_report: terminalApply.report },
    changed_fields: {
      guide: guideChanged ? collectChangedPaths(existingGuide, mergedGuide) : [],
      terminals: terminalsChanged ? collectChangedPaths({ list: existingTerminals }, { list: terminalApply.terminals }) : [],
    },
    content_changed: guideChanged || terminalsChanged,
    importable_count: importable.length,
  };
}

const { writePublicPortGuidesFileAtomic } = require('../publicPortGuideAdapter');

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const content = `${JSON.stringify(data, null, 2)}\n`;
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (_e) {
      /* ignore */
    }
    throw err;
  }
  return filePath;
}

/**
 * Apply merged guides/terminals JSON atomically (guides first to staging keys in report only).
 */
function writeApplyBatch({ landingRepoRoot, appPortId, guidesPayload, terminalsPayload, mergedGuide, mergedTerminals }) {
  const guidesPath = path.join(landingRepoRoot, 'data', 'public-port-guides.json');
  const terminalsPath = path.join(landingRepoRoot, 'data', 'public-port-terminals.json');

  const nextGuides = JSON.parse(JSON.stringify(guidesPayload));
  const nextTerminals = JSON.parse(JSON.stringify(terminalsPayload));

  const { assignPublicPortGuideByAppPortId, assertPublicPortGuidesPayloadSafe } = require('../bulkPortPublication/crossCountryHomonymPublicationGuards');
  assignPublicPortGuideByAppPortId(nextGuides, {
    landingSlug: mergedGuide?.researchImport?.landing_slug,
    appPortId,
    guide: mergedGuide,
    priorGuideAtSlot: guidesPayload?.byAppPortId?.[appPortId],
  });
  assertPublicPortGuidesPayloadSafe(nextGuides);

  if (!nextTerminals.byPortId) nextTerminals.byPortId = {};
  nextTerminals.byPortId[appPortId] = mergedTerminals;

  const guidesBackup = `${guidesPath}.bak-${process.pid}`;
  const terminalsBackup = `${terminalsPath}.bak-${process.pid}`;
  if (fs.existsSync(guidesPath)) fs.copyFileSync(guidesPath, guidesBackup);
  if (fs.existsSync(terminalsPath)) fs.copyFileSync(terminalsPath, terminalsBackup);
  try {
    writePublicPortGuidesFileAtomic(landingRepoRoot, nextGuides);
    atomicWriteJson(terminalsPath, nextTerminals);
    fs.unlinkSync(guidesBackup);
    fs.unlinkSync(terminalsBackup);
  } catch (err) {
    if (fs.existsSync(guidesBackup)) fs.copyFileSync(guidesBackup, guidesPath);
    if (fs.existsSync(terminalsBackup)) fs.copyFileSync(terminalsBackup, terminalsPath);
    try {
      fs.unlinkSync(guidesBackup);
      fs.unlinkSync(terminalsBackup);
    } catch (_e) {
      /* ignore */
    }
    throw err;
  }
  return { guidesPath, terminalsPath };
}

/** Write a single app guide entry without touching terminals JSON. */
function writeContentOnlyGuide({ landingRepoRoot, appPortId, guidesPayload, nextGuide }) {
  const guidesPath = path.join(landingRepoRoot, 'data', 'public-port-guides.json');
  const nextGuides = JSON.parse(JSON.stringify(guidesPayload));
  const { assignPublicPortGuideByAppPortId, assertPublicPortGuidesPayloadSafe } = require('../bulkPortPublication/crossCountryHomonymPublicationGuards');
  assignPublicPortGuideByAppPortId(nextGuides, {
    landingSlug: nextGuide?.researchImport?.landing_slug,
    appPortId,
    guide: nextGuide,
    priorGuideAtSlot: guidesPayload?.byAppPortId?.[appPortId],
  });
  assertPublicPortGuidesPayloadSafe(nextGuides);
  const guidesBackup = `${guidesPath}.bak-content-only-${process.pid}`;
  if (fs.existsSync(guidesPath)) fs.copyFileSync(guidesPath, guidesBackup);
  try {
    writePublicPortGuidesFileAtomic(landingRepoRoot, nextGuides);
    if (fs.existsSync(guidesBackup)) fs.unlinkSync(guidesBackup);
  } catch (err) {
    if (fs.existsSync(guidesBackup)) fs.copyFileSync(guidesBackup, guidesPath);
    try {
      fs.unlinkSync(guidesBackup);
    } catch (_e) {
      /* ignore */
    }
    throw err;
  }
  return { guidesPath };
}

const BOILERPLATE_RE = /^Handles cruise passengers/i;

function scoreGuideThinness(guide) {
  if (!guide) return 100;
  let score = 0;
  const desc = String(guide.portInfo?.description || '').trim();
  if (!desc || desc.length < 50) score += 4;
  if (BOILERPLATE_RE.test(desc)) score += 6;
  const std = String(guide.thingsToDo?.standardCall || '').trim();
  if (!std) score += 8;
  else if (std.length < 100) score += 4;
  const short = String(guide.thingsToDo?.shortCall || '').trim();
  if (!short) score += 3;
  const top = guide.thingsToDo?.topThings;
  if (!Array.isArray(top) || top.length < 3) score += 3;
  if (!guide.thingsToDo?.longerCall) score += 2;
  return score;
}

function recommendStage4ContentPilot({ manifest, guidesById, excludeSlugs = [] }) {
  const exclude = new Set(excludeSlugs);
  const candidates = [];
  for (const row of manifest.ports || []) {
    if (exclude.has(row.landing_slug)) continue;
    if (row.qa_verdict !== 'PASS') continue;
    if (row.identifier_status !== 'resolved') continue;
    if (!row.has_public_port_guide) continue;
    const guide = guidesById[row.app_port_id];
    if (!guide) continue;
    const thinScore = scoreGuideThinness(guide);
    if (thinScore < 4) continue;
    candidates.push({
      landing_slug: row.landing_slug,
      app_port_id: row.app_port_id,
      thin_score: thinScore,
      publishable_research_import: row.publishable_research_import,
      import_blockers: row.import_blockers,
    });
  }
  candidates.sort((a, b) => b.thin_score - a.thin_score || a.landing_slug.localeCompare(b.landing_slug));
  return candidates[0] || null;
}

module.exports = {
  AALBORG_CONTENT_ONLY_SLUG,
  AALBORG_APPROVED_GUIDE_DIFF_PREFIXES,
  gateManifestForApply,
  applyGuideWithPolicy,
  applyTerminalsWithPolicy,
  computePolicyApply,
  buildAalborgContentOnlyGuide,
  assertAalborgContentOnlyDiff,
  atomicWriteJson,
  writeApplyBatch,
  writeContentOnlyGuide,
  recommendStage4ContentPilot,
  scoreGuideThinness,
  stableStringify,
};
