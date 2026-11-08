'use strict';

const { stripCitationMarkers } = require('./extractMarkdownSections');

const BOILERPLATE_RES = [
  /^Handles cruise passengers/i,
  /^Located in /i,
  /^Varies by location$/i,
];

function isBoilerplate(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  return BOILERPLATE_RES.some((re) => re.test(s));
}

function preferText(existing, next) {
  const a = typeof existing === 'string' ? existing.trim() : '';
  const b = stripCitationMarkers(next);
  if (!b) return a;
  if (!a || isBoilerplate(a)) return b;
  if (isBoilerplate(b) && !isBoilerplate(a)) return a;
  if (b.length > a.length + 40) return b;
  return a;
}

function preferList(existing, next, min = 3) {
  const a = Array.isArray(existing) ? existing.filter(Boolean) : [];
  const b = Array.isArray(next) ? next.filter(Boolean) : [];
  if (b.length >= Math.max(min, a.length)) return b;
  if (!a.length && b.length) return b;
  return a;
}

const PRESERVE_TOP_LEVEL_KEYS = ['hero', 'shorePlansFirst', 'sourcesUsed', 'lastEnrichment', 'researchImport'];

function mergeGuide(existing, patch) {
  const out = JSON.parse(JSON.stringify(existing || {}));
  for (const key of PRESERVE_TOP_LEVEL_KEYS) {
    if (existing && existing[key] != null) out[key] = existing[key];
  }
  if (patch.portInfo) {
    out.portInfo = out.portInfo || {};
    out.portInfo.description = preferText(out.portInfo.description, patch.portInfo.description);
    out.portInfo.timezone = preferText(out.portInfo.timezone, patch.portInfo.timezone);
    out.portInfo.language = preferText(out.portInfo.language, patch.portInfo.language);
    out.portInfo.currency = preferText(out.portInfo.currency, patch.portInfo.currency);
  }
  if (patch.gettingThere) {
    out.gettingThere = out.gettingThere || {};
    out.gettingThere.fromTerminal = preferText(out.gettingThere.fromTerminal, patch.gettingThere.fromTerminal);
    out.gettingThere.publicTransport = preferText(
      out.gettingThere.publicTransport,
      patch.gettingThere.publicTransport
    );
    out.gettingThere.distanceToCity = preferText(out.gettingThere.distanceToCity, patch.gettingThere.distanceToCity);
    if (Array.isArray(patch.gettingThere.transportation) && patch.gettingThere.transportation.length) {
      out.gettingThere.transportation = preferList(
        out.gettingThere.transportation,
        patch.gettingThere.transportation
      );
    }
  }
  if (patch.thingsToDo) {
    out.thingsToDo = out.thingsToDo || {};
    const t = patch.thingsToDo;
    out.thingsToDo.intro = preferText(out.thingsToDo.intro, t.intro);
    out.thingsToDo.topThings = preferList(out.thingsToDo.topThings, t.topThings, 3);
    out.thingsToDo.shortCall = preferText(out.thingsToDo.shortCall, t.shortCall);
    out.thingsToDo.standardCall = preferText(out.thingsToDo.standardCall, t.standardCall);
    out.thingsToDo.longerCall = preferText(out.thingsToDo.longerCall, t.longerCall);
    out.thingsToDo.practicalTip = preferText(out.thingsToDo.practicalTip, t.practicalTip);
  }
  if (!out.researchImport) {
    out.researchImport = {
      schema_version: patch.researchImport?.schema_version || 1,
      researched_at_utc: patch.researchImport?.researched_at_utc || null,
      qa_verdict: patch.researchImport?.qa_verdict || null,
      import_tier: 'dry_run_only',
    };
  }
  return out;
}

function terminalSlugFromId(terminalId, landingSlug) {
  const prefix = `${landingSlug}--`;
  let s = String(terminalId || '').trim();
  if (s.startsWith(prefix)) s = s.slice(prefix.length);
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'terminal';
}

function mergeTerminalLists(existing, incoming, { landingSlug, preserveExistingPrimary = true }) {
  const existingList = Array.isArray(existing) ? existing.slice() : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const bySlug = new Map();
  for (const t of existingList) {
    if (t && t.slug) bySlug.set(String(t.slug).toLowerCase(), { ...t, _source: 'existing' });
  }

  const report = { added: [], updated: [], skipped: [], preserved: [] };

  for (const t of incomingList) {
    const slug = String(t.slug || '').trim() || terminalSlugFromId(t.terminal_id, landingSlug);
    const prev = bySlug.get(slug);
    if (prev && preserveExistingPrimary && prev.is_primary && !t.is_primary) {
      report.preserved.push({ slug, reason: 'existing_primary_terminal' });
      continue;
    }
    const merged = {
      ...(prev || {}),
      name: t.name || prev?.name,
      slug,
      description: t.description || prev?.description,
      address: t.address || prev?.address,
      latitude: t.latitude ?? prev?.latitude,
      longitude: t.longitude ?? prev?.longitude,
      terminal_type: prev?.terminal_type || 'both',
      terminal_status: prev?.terminal_status || 'active',
      is_primary: prev?.is_primary ?? Boolean(t.is_primary),
      sort_order: prev?.sort_order ?? t.sort_order ?? 50,
      country_id: t.country_id || prev?.country_id,
      map_precision_tier: t.map_precision_tier,
      map_precision_label: t.map_precision_label,
    };
    if (prev) {
      report.updated.push(slug);
    } else {
      report.added.push(slug);
    }
    bySlug.set(slug, merged);
  }

  return {
    terminals: Array.from(bySlug.values()).map(({ _source, ...rest }) => rest),
    report,
  };
}

module.exports = {
  mergeGuide,
  mergeTerminalLists,
  preferText,
  terminalSlugFromId,
};
