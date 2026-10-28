'use strict';

/**
 * Static HTML builders for /ships/<slug>/ and /ports/<slug>/ (programmatic SEO).
 * 400–800 words per page, unique template expansion, capped internal links (~8–10).
 * Port pages also merge PublicPortGuide + public terminals + Viator CTA when available.
 */

const { getAnalyticsHeadHtml } = require('./analyticsSnippet');
const { getFaviconHeadHtml } = require('./faviconHead');
const {
  getSiteHeaderHtml,
  getSiteFooterHtml,
  getSiteShellCssLinkHtml,
} = require('./siteShell');
const {
  isShipDetailIndexable,
  isPortDetailIndexable,
} = require('./adsenseIndexability');
const { shipOverviewHiddenByAudit } = require('./auditHoldback');
const {
  PORT_GUIDE_STYLES,
  buildPhase1GuideHtml,
  buildBreadcrumbsHtml,
  buildBreadcrumbJsonLd,
  collectPortFaqItems,
  portCallsAsHomeport,
} = require('./portGuideSections');
const {
  isBoilerplateDescription,
  cleanPortCopy,
  rewriteCdnThumbnailUrl,
  filterHighlightList,
  dedupeRepeatedCommaPhrase,
  isDanglingSentence,
} = require('./portCopyHygiene');
const { resolvePortAffiliateCta } = require('./viatorAffiliate');
const { applyPortPageOverrides } = require('./portPageOverrides');
const {
  pickRelatedShips,
  pickRelatedPorts,
  pickPortsForShipPage,
  pickShipsForPortPage,
} = require('./shipPortRelevance');
const { buildGuestReviewsSectionHtml, GUEST_REVIEWS_SECTION_CSS } = require('./guestReviewsSection');
const fs = require('fs');
const path = require('path');
const {
  applyTypoFixes,
  resolveRelatedReadingCardTitle,
} = require('./blogProductionHygiene');

let cachedBlogTitleBySourceSlug = null;

function getBlogTitleBySourceSlug() {
  if (cachedBlogTitleBySourceSlug) return cachedBlogTitleBySourceSlug;
  const file = path.join(__dirname, '../../data/blog-article-corrections.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    cachedBlogTitleBySourceSlug =
      parsed.titleBySourceSlug && typeof parsed.titleBySourceSlug === 'object' ? parsed.titleBySourceSlug : {};
  } catch {
    cachedBlogTitleBySourceSlug = {};
  }
  return cachedBlogTitleBySourceSlug;
}

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(title) {
  if (!title || typeof title !== 'string') return 'item';
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function normalizeHighlights(h) {
  if (Array.isArray(h)) return h.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12);
  if (h && typeof h === 'string' && h.trim()) return [h.trim()];
  return [];
}

function parseOptionalNumber(value) {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseOptionalInt(value) {
  const n = parseOptionalNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.round(n));
}

/** Avoid "Kiel, Germany, Germany" when dataset names already include the country. */
function stripCountrySuffixFromPortLabel(label, country) {
  const l = String(label || '').trim();
  const c = String(country || '').trim();
  if (!c || !l) return l;
  const suffix = ', ' + c;
  if (l.toLowerCase().endsWith(suffix.toLowerCase())) return l.slice(0, -suffix.length).trim();
  return l;
}

function formatPortPlaceLabel(port) {
  const country = String(port?.country || '').trim();
  const name = stripCountrySuffixFromPortLabel(port?.name, country);
  if (country && name) return `${name}, ${country}`;
  return name || country || '';
}

function formatPortCoreName(port) {
  return stripCountrySuffixFromPortLabel(port?.name, port?.country) || String(port?.name || '').trim();
}

function pickFirstFiniteNumber(...values) {
  for (const v of values) {
    const n = parseOptionalNumber(v);
    if (n == null) continue;
    return n;
  }
  return null;
}

/**
 * Merges latitude/longitude from Supabase `/reviews/ports` rows onto generated port records
 * (matched by app review id via slugToReviewKey, then slug, then record id).
 */
function applyPortGeoFromApiRows(seoPorts, rawPorts, slugToReviewKey) {
  const geoById = new Map();
  for (const row of Array.isArray(rawPorts) ? rawPorts : []) {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    const lat = pickFirstFiniteNumber(
      row.latitude,
      row.lat,
      row?.geo?.latitude,
      row?.location?.latitude
    );
    const lng = pickFirstFiniteNumber(
      row.longitude,
      row.lng,
      row.lon,
      row?.geo?.longitude,
      row?.location?.longitude
    );
    if (id && lat != null && lng != null) geoById.set(id, { latitude: lat, longitude: lng });
  }
  if (!geoById.size) return seoPorts;
  for (const p of seoPorts) {
    const rk = slugToReviewKey && typeof slugToReviewKey.get === 'function' ? slugToReviewKey.get(p.slug) : '';
    const g = (rk && geoById.get(rk)) || geoById.get(p.slug) || geoById.get(p.id);
    if (g) {
      p.latitude = g.latitude;
      p.longitude = g.longitude;
    }
  }
  return seoPorts;
}

function clampAggregateRatingValue(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, n));
}

/**
 * Product + AggregateRating for Google Rich Results: use numeric fields and a clear scale
 * (see Google Product snippet / aggregateRating guidelines).
 */
function buildShipAggregateRatingJsonLd(ship) {
  const ratingVal = ship.rating;
  const countVal = ship.reviewCount;
  if (ratingVal == null || !Number.isFinite(ratingVal) || ratingVal <= 0) return null;
  if (countVal == null || !Number.isFinite(countVal) || countVal < 1) return null;
  const rv = clampAggregateRatingValue(ratingVal);
  if (rv == null) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.round(rv * 10) / 10,
    reviewCount: Math.max(1, Math.round(countVal)),
    bestRating: 5,
    worstRating: 1,
  };
}

function buildShipBreadcrumbJsonLd(ship, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://seadays.app/' },
      { '@type': 'ListItem', position: 2, name: 'Ships', item: 'https://seadays.app/ships/' },
      { '@type': 'ListItem', position: 3, name: ship.name, item: canonical },
    ],
  };
}

function buildShipBreadcrumbsHtml(ship) {
  return (
    `<nav class="seo-breadcrumbs" aria-label="Breadcrumb">` +
    `<a href="/">Home</a> / <a href="/ships/">Ships</a> / <span>${escapeHtml(ship.name)}</span>` +
    `</nav>`
  );
}

function wordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic pick from array; varies per entity without repeating the same index pattern. */
function pickAt(arr, seed, salt) {
  if (!arr.length) return '';
  const i = Math.abs(hashCode(String(seed) + String(salt))) % arr.length;
  return arr[i];
}

function pickManyUnique(arr, seed, count, saltPrefix) {
  const out = [];
  const used = new Set();
  for (let tries = 0; tries < arr.length * 6 && out.length < count; tries++) {
    const idx = Math.abs(hashCode(String(seed) + saltPrefix + tries)) % arr.length;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(arr[idx]);
    }
  }
  return out;
}

function normalizeSentenceKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueSentences(parts, max = 8) {
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    for (const sentence of splitSentences(part)) {
      const key = normalizeSentenceKey(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(sentence);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function trimWords(text, maxWords) {
  const w = text.split(/\s+/).filter(Boolean);
  if (w.length <= maxWords) return text.trim();
  return w.slice(0, maxWords).join(' ').replace(/\s+[.,;:!?]?$/, '') + (text.match(/[.!?]$/) ? '' : '.');
}

function isBrokenRelatedReadingExcerpt(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (/^\s*if\s+.+\s+is\s+what\.?\s*$/i.test(t)) return true;
  if (/\bis what\.\s*$/i.test(t) && wordCount(t) <= 10) return true;
  return false;
}

const INCOMPLETE_EXCERPT_TAIL_RE =
  /\b(of|and|or|the|a|an|to|for|with|as|when you are|are trying|entertainment|rapidly|scale|they|you|are)\s*[,;]?\s*$/i;

function isCompleteRelatedReadingExcerpt(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || isBrokenRelatedReadingExcerpt(t)) return false;
  if (/^[a-z(]/.test(t)) return false;
  if (!/[.!?…]["']?\s*$/.test(t)) return false;
  if (INCOMPLETE_EXCERPT_TAIL_RE.test(t)) return false;
  if (/,\s*$/.test(t)) return false;
  return true;
}

function relatedReadingTitleFallback(article) {
  const title = resolveRelatedReadingCardTitle(article, getBlogTitleBySourceSlug());
  if (title && title !== 'SeaDays guide') return `${title} — SeaDays cruise planning guide.`;
  return 'Cruise planning guide from SeaDays.';
}

/** Prefer card copy that reads as a standalone blurb, not a subordinate tail clause. */
function relatedReadingStandaloneScore(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return -100;
  let score = 0;
  if (/^rather than\b/i.test(t)) score -= 40;
  if (/^cabin, route timing/i.test(t)) score -= 35;
  if (/^if\s+.+\s+is what you are trying/i.test(t)) score -= 15;
  if (/ — SeaDays cruise planning guide\.\s*$/.test(t)) score += 25;
  if (/^treat it as a bundle of decisions/i.test(t)) score += 20;
  if (/^[A-Z]/.test(t) && !/^If cruise tips vs cruise hacks is what/i.test(t)) score += 8;
  if (wordCount(t) >= 10) score += 4;
  return score;
}

function compareRelatedReadingCandidates(a, b) {
  const scoreDiff = relatedReadingStandaloneScore(b) - relatedReadingStandaloneScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  return wordCount(b) - wordCount(a);
}

function relatedReadingExcerptCandidates(sourceText) {
  const normalized = String(sourceText || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const t = String(value || '').replace(/\s+/g, ' ').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  push(normalized);
  for (const sentence of splitSentences(normalized)) {
    push(sentence);
    const dashParts = sentence.split(/\s*—\s*/);
    if (dashParts.length > 1) {
      let acc = '';
      for (const part of dashParts) {
        acc = acc ? `${acc} — ${part}` : part;
        push(acc);
      }
      for (const part of dashParts) push(part);
    }
  }
  return out;
}

function pickRelatedReadingCardExcerptFromSources(article, maxWords) {
  const fieldValues = [article.metaDescription, article.seoDescription, article.excerpt];
  for (const field of fieldValues) {
    const candidates = relatedReadingExcerptCandidates(field);
    const complete = candidates.filter((c) => isCompleteRelatedReadingExcerpt(c));
    const withinBudget = complete.filter((c) => wordCount(c) <= maxWords);
    if (withinBudget.length) {
      withinBudget.sort(compareRelatedReadingCandidates);
      const best = withinBudget[0];
      if (relatedReadingStandaloneScore(best) < 0) {
        const fallback = relatedReadingTitleFallback(article);
        if (isCompleteRelatedReadingExcerpt(fallback) && wordCount(fallback) <= maxWords) {
          return fallback;
        }
      }
      return best;
    }
    if (complete.length) {
      complete.sort((a, b) => wordCount(a) - wordCount(b));
      return complete[0];
    }
  }
  return relatedReadingTitleFallback(article);
}

function relatedReadingCardExcerpt(article, maxWords = 20) {
  return pickRelatedReadingCardExcerptFromSources(article, maxWords).replace(/\s+/g, ' ').trim();
}

function indefiniteArticleFor(text) {
  const first = String(text || '').trim().charAt(0).toLowerCase();
  return /^[aeiou]/.test(first) ? 'an' : 'a';
}

function finishPublicCopyHtml(html) {
  return String(html || '')
    .replace(/\bAIDACosma\b/g, 'AIDAcosma')
    .replace(/\ba AIDA\b/g, 'an AIDA')
    .replace(/\ba Oceania\b/g, 'an Oceania');
}

function firstSentence(text, fallback) {
  const sentence = splitSentences(text)[0];
  return sentence || fallback;
}

function buildOverrideShipTriple(ship, seed) {
  const overviewSentences = uniqueSentences([ship.description], 5);
  const overview =
    overviewSentences.length > 0
      ? overviewSentences.join(' ')
      : `${ship.name} is a ${ship.shipClass || 'cruise ship'} operated by ${ship.cruise_line}.`;
  const experienceSource = ship.experience || '';
  const experienceSentences = uniqueSentences(
    [
      experienceSource,
      `${ship.name} is best planned by matching the itinerary with the ship's dining rhythm, cabin choices, and sea-day pace.`,
      `Before booking ${ship.name}, compare what ${ship.cruise_line} includes in the fare with the extras you actually expect to use on board.`,
      `SeaDays helps travelers organize notes for ${ship.name}, from cabin preferences and port plans to reminders for embarkation day.`,
    ],
    3
  );
  const audienceSentences = uniqueSentences(
    [
      `${ship.name} suits travelers who want ${indefiniteArticleFor(ship.cruise_line)} ${ship.cruise_line} sailing with enough structure to compare cabins, onboard rhythm, and itinerary fit before booking.`,
      `It is also useful for cruisers who prefer to plan port days and ship days together instead of treating the vessel as only transportation.`,
      ...pickManyUnique(SHIP_AUDIENCE, seed, 2, 'aud').map((x) => fillShipVars(x, ship)),
    ],
    3
  );
  return {
    overview: trimWords(overview, 140),
    experience: trimWords(experienceSentences.join(' '), 120),
    audience: trimWords(audienceSentences.join(' '), 110),
  };
}

function budgetShipTriple(ship) {
  const seed = ship.id + '|' + ship.slug;
  if (ship.hasContentOverride && ship.description) return buildOverrideShipTriple(ship, seed);
  const base = ship.description ? `${ship.description.trim()} ` : '';
  let overview =
    base +
    pickManyUnique(SHIP_OVERVIEW_EXTRA, seed, 4, 'ov')
      .map((x) => fillShipVars(x, ship))
      .join(' ');
  let experience = pickManyUnique(SHIP_EXPERIENCE, seed, 4, 'ex')
    .map((x) => fillShipVars(x, ship))
    .join(' ');
  let audience = pickManyUnique(SHIP_AUDIENCE, seed, 3, 'aud')
    .map((x) => fillShipVars(x, ship))
    .join(' ');
  let total = wordCount(overview) + wordCount(experience) + wordCount(audience);
  let safety = 0;
  while (total > 800 && safety++ < 80) {
    if (wordCount(overview) > 120) overview = trimWords(overview, Math.floor(wordCount(overview) * 0.92));
    else if (wordCount(experience) > 80) experience = trimWords(experience, Math.floor(wordCount(experience) * 0.9));
    else if (wordCount(audience) > 60) audience = trimWords(audience, Math.floor(wordCount(audience) * 0.88));
    else break;
    total = wordCount(overview) + wordCount(experience) + wordCount(audience);
  }
  return { overview: overview.trim(), experience: experience.trim(), audience: audience.trim() };
}

function buildOverridePortProse(port, seed) {
  const overviewSentences = uniqueSentences([port.description], 5);
  const coreName = formatPortCoreName(port);
  const place = formatPortPlaceLabel(port) || coreName;
  const overview =
    overviewSentences.length > 0
      ? overviewSentences.join(' ')
      : `${place} is a cruise port in ${port.region || port.country || 'this region'}.`;
  const whatToDo = uniqueSentences(
    [
      ...(port.highlights || []),
      `For a shore day in ${coreName}, choose one main activity first, then keep time for meals, walking, and the return to the pier.`,
      `SeaDays helps travelers compare ${coreName} with nearby ports so the itinerary feels organized before the ship arrives.`,
    ],
    4
  ).join(' ');
  const cruiseRelevance = uniqueSentences(
    [
      `${coreName} matters to cruise planning because port time, transport distance, and all-aboard timing shape how much of the destination you can realistically enjoy.`,
      fillPortVars(pickAt(PORT_CRUISE_RELEVANCE, seed, 'cru'), port),
    ],
    3
  ).join(' ');
  const tips = uniqueSentences(
    [
      `Before leaving the ship in ${coreName}, save the pier location, ship time, and any shuttle details offline.`,
      fillPortVars(pickAt(PORT_TIPS, seed, 'tip'), port),
    ],
    3
  ).join(' ');
  return {
    overview: trimWords(overview, 140),
    whatToDo: trimWords(whatToDo, 110),
    cruiseRelevance: trimWords(cruiseRelevance, 100),
    tips: trimWords(tips, 90),
  };
}

function budgetPortProse(port) {
  const seed = port.id + '|' + port.slug;
  if (port.hasContentOverride && port.description) return buildOverridePortProse(port, seed);
  const base = port.description ? `${port.description.trim()} ` : '';
  let overview =
    base +
    pickManyUnique(PORT_OVERVIEW_EXTRA, seed, 4, 'pov')
      .map((x) => fillPortVars(x, port))
      .join(' ');
  let whatToDo = pickManyUnique(PORT_WHAT_TO_DO, seed, 4, 'wtd').map((x) => fillPortVars(x, port)).join(' ');
  let cruiseRel = pickManyUnique(PORT_CRUISE_RELEVANCE, seed, 3, 'cru').map((x) => fillPortVars(x, port)).join(' ');
  let tips = pickManyUnique(PORT_TIPS, seed, 4, 'tip').map((x) => fillPortVars(x, port)).join(' ');
  let total = wordCount(overview) + wordCount(whatToDo) + wordCount(cruiseRel) + wordCount(tips);
  let safety = 0;
  while (total > 800 && safety++ < 80) {
    if (wordCount(overview) > 100) overview = trimWords(overview, Math.floor(wordCount(overview) * 0.9));
    else if (wordCount(whatToDo) > 80) whatToDo = trimWords(whatToDo, Math.floor(wordCount(whatToDo) * 0.9));
    else if (wordCount(cruiseRel) > 60) cruiseRel = trimWords(cruiseRel, Math.floor(wordCount(cruiseRel) * 0.88));
    else if (wordCount(tips) > 50) tips = trimWords(tips, Math.floor(wordCount(tips) * 0.85));
    else break;
    total = wordCount(overview) + wordCount(whatToDo) + wordCount(cruiseRel) + wordCount(tips);
  }
  return {
    overview: overview.trim(),
    whatToDo: whatToDo.trim(),
    cruiseRelevance: cruiseRel.trim(),
    tips: tips.trim(),
  };
}

function fillShipVars(t, ship) {
  return t
    .replace(/\{name\}/g, ship.name)
    .replace(/\{line\}/g, ship.cruise_line)
    .replace(/\{class\}/g, ship.shipClass || 'contemporary cruise ship');
}

function fillPortVars(t, port) {
  const coreName = formatPortCoreName(port);
  const place = formatPortPlaceLabel(port) || coreName;
  return t
    .replace(/\{name\}/g, coreName)
    .replace(/\{country\}/g, port.country || 'this region')
    .replace(/\{place\}/g, place)
    .replace(/\{region\}/g, port.region || 'this cruising region');
}

function buildSeoShipRecords(rawList) {
  const out = [];
  const usedSlugs = new Set();
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i] || {};
    const name = raw.name || raw.shipName || raw.itemName || `Cruise ship ${i + 1}`;
    const id = String(raw.id ?? raw.shipId ?? slugify(name)).replace(/[^a-zA-Z0-9_-]/g, '-');
    let slug = raw.slug ? String(raw.slug).trim() : slugify(name);
    if (!slug) slug = slugify(name);
    if (usedSlugs.has(slug)) slug = slugify(`${name}-${id}`);
    if (usedSlugs.has(slug)) slug = slugify(id);
    usedSlugs.add(slug);
    const cruise_line = raw.cruiseLine || raw.cruise_line || raw.line || 'Major cruise line';
    const description = raw.description || raw.about || raw.summary || '';
    const highlights = normalizeHighlights(raw.highlights || raw.categories);
    const image_url = raw.image_url || raw.imageUrl || raw.thumbnailUrl || raw.photoUrl || '';
    const rating = pickFirstFiniteNumber(raw.rating, raw.avgRating, raw.averageRating, raw.stars);
    const reviewCount = parseOptionalInt(raw.reviewCount ?? raw.reviewsCount ?? raw.totalReviews ?? raw.count);
    const metaDescription = raw.metaDescription || raw.meta_description || '';
    const confidenceScore = pickFirstFiniteNumber(raw.confidenceScore, raw.confidence);
    out.push({
      id,
      slug,
      name,
      cruise_line,
      description: String(description).trim(),
      highlights,
      image_url: String(image_url).trim(),
      shipClass: raw.shipClass || raw.class || raw.type || '',
      experience: raw.experience || raw.vibe || '',
      metaDescription: String(metaDescription).trim(),
      hasContentOverride: Boolean(raw.hasContentOverride),
      confidenceScore: Number.isFinite(confidenceScore) ? confidenceScore : undefined,
      rating,
      reviewCount,
      // Pass-2 verified catalog specs (optional; Key facts / JSON-LD)
      capacity: pickFirstFiniteNumber(raw.capacity, raw.passengers),
      capacityMax: pickFirstFiniteNumber(raw.capacityMax),
      capacityBasis: raw.capacityBasis || raw.capacity_basis || '',
      crew: pickFirstFiniteNumber(raw.crew),
      yearBuilt: pickFirstFiniteNumber(raw.yearBuilt, raw.year_built, raw.enteredService),
      tonnage: pickFirstFiniteNumber(raw.tonnage, raw.grossTonnage, raw.gt),
      length: pickFirstFiniteNumber(raw.length, raw.lengthMeters),
      beam: pickFirstFiniteNumber(raw.beam),
      status: raw.status || '',
      appId: raw.appId || raw.app_id || '',
      lineId: raw.lineId || raw.line_id || '',
    });
  }
  return out;
}

function shipClassNounPhrase(ship) {
  const raw = String(ship.shipClass || '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'cruise ship';
  let s = raw;
  if (!/\bclass\b/i.test(s)) s = `${s}-class`;
  if (!/cruise ship/i.test(s)) s = `${s} cruise ship`;
  return s;
}

function formatCapacityLabel(ship) {
  if (!Number.isFinite(ship.capacity)) return '';
  const n = Math.round(ship.capacity).toLocaleString('en-US');
  if (ship.capacityBasis === 'maximum') return `${n} (maximum)`;
  return `${n} (lower berth / double occupancy)`;
}

function formatMeters(n) {
  const rounded = Math.round(Number(n) * 10) / 10;
  if (!Number.isFinite(rounded)) return '';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function buildShipKeyFactsHtml(ship) {
  const rows = [];
  rows.push(`<dt>Cruise line</dt><dd>${escapeHtml(ship.cruise_line)}</dd>`);
  if (ship.shipClass) rows.push(`<dt>Ship class</dt><dd>${escapeHtml(ship.shipClass)}</dd>`);
  if (Number.isFinite(ship.yearBuilt)) {
    rows.push(`<dt>Entered service</dt><dd>${escapeHtml(String(Math.round(ship.yearBuilt)))}</dd>`);
  }
  if (Number.isFinite(ship.tonnage)) {
    rows.push(
      `<dt>Gross tonnage</dt><dd>${escapeHtml(Math.round(ship.tonnage).toLocaleString('en-US'))} GT</dd>`
    );
  }
  if (Number.isFinite(ship.capacity)) {
    rows.push(`<dt>Passenger capacity</dt><dd>${escapeHtml(formatCapacityLabel(ship))}</dd>`);
  }
  if (Number.isFinite(ship.capacityMax) && ship.capacityMax !== ship.capacity) {
    rows.push(
      `<dt>Maximum capacity</dt><dd>${escapeHtml(Math.round(ship.capacityMax).toLocaleString('en-US'))}</dd>`
    );
  }
  if (Number.isFinite(ship.crew)) {
    rows.push(`<dt>Crew</dt><dd>${escapeHtml(Math.round(ship.crew).toLocaleString('en-US'))}</dd>`);
  }
    if (Number.isFinite(ship.length)) {
    rows.push(`<dt>Length</dt><dd>${escapeHtml(formatMeters(ship.length))} m</dd>`);
  }
  if (Number.isFinite(ship.beam)) {
    rows.push(`<dt>Beam</dt><dd>${escapeHtml(String(Math.round(ship.beam)))} m</dd>`);
  }
  if (ship.status && ship.status !== 'active') {
    rows.push(`<dt>Status</dt><dd>${escapeHtml(ship.status)}</dd>`);
  }
  return rows.join('\n        ');
}

function buildSeoPortRecords(rawList) {
  const out = [];
  const usedSlugs = new Set();
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i] || {};
    const country = raw.country || raw.countryName || '';
    const rawName = raw.portName || raw.name || `Port ${i + 1}`;
    const name = stripCountrySuffixFromPortLabel(rawName, country) || rawName;
    const id = String(raw.id ?? raw.portId ?? slugify(name)).replace(/[^a-zA-Z0-9_-]/g, '-');
    const baseLabel = country ? `${name} ${country}` : name;
    let slug = raw.slug ? String(raw.slug).trim() : slugify(baseLabel);
    if (!slug) slug = slugify(baseLabel);
    if (usedSlugs.has(slug)) slug = slugify(`${name}-${id}`);
    if (usedSlugs.has(slug)) slug = slugify(id);
    usedSlugs.add(slug);
    const description = raw.description || raw.about || '';
    const highlights = normalizeHighlights(raw.highlights || raw.attractions);
    const image_url = raw.image_url || raw.imageUrl || raw.thumbnailUrl || '';
    const region = raw.region || '';
    const popularMonths = Array.isArray(raw.popularMonths) ? raw.popularMonths : [];
    const rating = pickFirstFiniteNumber(raw.rating, raw.avgRating, raw.averageRating, raw.stars);
    const reviewCount = parseOptionalInt(raw.reviewCount ?? raw.reviewsCount ?? raw.totalReviews ?? raw.count);
    const latitude = pickFirstFiniteNumber(raw.latitude, raw.lat, raw?.geo?.latitude);
    const longitude = pickFirstFiniteNumber(raw.longitude, raw.lng, raw.lon, raw?.geo?.longitude);
    const metaDescription = raw.metaDescription || raw.meta_description || '';
    out.push({
      id,
      slug,
      name,
      country,
      description: String(description).trim(),
      highlights,
      image_url: String(image_url).trim(),
      region,
      popularMonths,
      metaDescription: String(metaDescription).trim(),
      hasContentOverride: Boolean(raw.hasContentOverride),
      rating,
      reviewCount,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
    });
  }
  return out;
}

const SHIP_OVERVIEW_EXTRA = [
  'Planning a {line} sailing on {name} is easier when you know how dining reservations, show times, and port-day rhythm fit together.',
  '{name} represents {line}’s take on modern cruising: multiple dining concepts, varied cabin categories, and programming that changes by itinerary length.',
  'Passengers often compare {name} with sister ships in the fleet—use highlights below to see what distinguishes this hull for your dates.',
  'From embarkation flow to final morning disembarkation, {name} rewards guests who map must-do venues against realistic walking and queue times.',
  'If you are price-shopping, weigh fare inclusions for {line} against what you will use on {name}: specialty dining, beverage bundles, and Wi-Fi packages vary.',
  'SeaDays helps you pair {name} with realistic port expectations so sea days feel restorative instead of repetitive.',
];

const SHIP_EXPERIENCE = [
  'On board {name}, daily life centers on main dining, specialty venues, buffet or casual outlets, and the line’s typical pool-deck rhythm.',
  '{line} positions {name} with entertainment that may include production shows, live music, comedy, and family-friendly activities on select sailings.',
  'Fitness and spa facilities on {name} suit guests who want structured workouts between port days; check class schedules early on busy itineraries.',
  'Cabin location on {name} affects noise and walking distance—midship lowers motion for sensitive guests; aft balconies appeal for wake views on sea days.',
  'Pools and outdoor spaces on {name} peak on warm sea days; plan shade and hydration when the itinerary stacks multiple days at sea.',
  'Kids and teen programming on {name} (when offered) can free adults for specialty dining—confirm age bands and signup windows on embarkation day.',
];

const SHIP_AUDIENCE = [
  '{name} suits travelers who want a recognizable {line} experience with clear dining and entertainment options across a typical week.',
  'Couples prioritizing dining variety and evening shows often mesh well with {name}, especially on port-light itineraries.',
  'Families evaluate {name} for cabin interconnect options, splash areas, and whether daily schedules match younger travelers’ energy.',
  'First-time cruisers on {name} benefit from learning one deck plan corridor and one stair tower to reduce day-one confusion.',
  'Repeat {line} guests compare {name} to other fleet mates—loyalty perks and cabin upgrades may influence the final choice.',
];

const PORT_OVERVIEW_EXTRA = [
  '{place} sits in itineraries where pier logistics, immigration timing, and traffic patterns can shape a shore day more than headline attractions.',
  'Cruise visitors to {name} usually optimize for one signature experience plus flexible time for meals, shopping, or waterfront walks.',
  'Understanding whether {name} is an embarkation port, transit call, or overnight changes how aggressively you schedule excursions.',
  'Regional context for {region} helps you pack layers, plan cash needs, and set walking expectations away from the pier.',
  'When multiple ships call {name} the same day, queues and taxi availability can spike—build buffer before all-aboard.',
];

const PORT_WHAT_TO_DO = [
  'Popular approaches at {name} mix cultural sights, local food, and waterfront time—pick one anchor activity and keep slack for delays.',
  'Guided excursions from {name} can cover distance and language barriers; independent travelers should confirm return paths and ship time.',
  'Photography, markets, and neighborhood walks near {name} often deliver strong value without all-day bus rides.',
  'Water-based activities depend on season and conditions—verify operator credentials and cancellation policies before booking.',
];

const PORT_CRUISE_RELEVANCE = [
  '{name} matters to cruisers because it often sets tone for the itinerary: first impressions, jet-lag recovery, or a final day before flying home.',
  'Lines routing through {name} usually align ship size with berth constraints—larger vessels may use alternate piers depending on the call.',
  'Embarkation from {name} can simplify flight planning when airports and hotels align; compare total trip cost versus other homeports.',
  'For {region} sailings, {name} frequently appears as a marquee stop—worth researching shore power, walk-off distance, and pier logistics for your sailing.',
];

const PORT_TIPS = [
  'Carry ship time, local cash where cards lag, offline maps, and pier-to-town taxi notes before leaving {name}.',
  'Book independent tours with verified reviews and clear meeting points; screenshot confirmations in case connectivity fails.',
  'Respect all-aboard; pier traffic and security lines at {name} can consume more minutes than maps suggest.',
  'Check the forecast for this port before you pack a shore layer; heat, rain, and wind are not the same from one region to the next.',
];

const PORT_LIST_ONLY_ACTIONS = [
  'Start with one anchor sight, then leave room for spontaneity around {name}.',
  'Screenshot ship departure time and pier map before you lose signal.',
  'Pair a light breakfast on the ship with a local lunch ashore to maximize exploration time.',
  'Check whether your line offers shuttle pricing before you commit to taxis at {name}.',
  'Confirm your assigned pier and all-aboard time before leaving the ship at {name}.',
];

function splitIntoParagraphs(longText) {
  const sentences = longText.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  const paras = [];
  let buf = [];
  let words = 0;
  for (const s of sentences) {
    if (!s) continue;
    buf.push(s);
    words += wordCount(s);
    if (words >= 85) {
      paras.push(buf.join(' '));
      buf = [];
      words = 0;
    }
  }
  if (buf.length) paras.push(buf.join(' '));
  return paras.length ? paras : [longText];
}

function pickBlogArticlesForEntity(articles, entityTokens, max = 2) {
  const rawTokens = entityTokens
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const priorityTokens = rawTokens.slice(0, 4)
    .map((t) => t.toLowerCase().replace(/[^\w\s-]/g, '').trim())
    .filter((t) => t && t.length > 2);
  const genericTokens = new Set(['cruise', 'cruises', 'ship', 'ships', 'port', 'ports', 'shore', 'day', 'days', 'guide']);
  const tokens = rawTokens
    .flatMap((t) => [t, ...t.split(/\s+/)])
    .map((t) => String(t || '').toLowerCase().replace(/[^\w\s-]/g, '').trim())
    .filter((t) => t && t.length > 2)
    .slice(0, 18);
  const scored = articles
    .map((a) => {
      const tags = (a.tags || [])
        .map((t) => (typeof t === 'string' ? t : String(t?.name || '')))
        .join(' ');
      const keywords = Array.isArray(a.keywords) ? a.keywords.join(' ') : '';
      const blob = [
        a.title,
        a.slug,
        a.excerpt,
        a.seoTitle,
        a.seoDescription,
        a.metaDescription,
        tags,
        keywords,
      ].join(' ').toLowerCase();
      let score = 0;
      for (const token of priorityTokens) {
        if (!token || genericTokens.has(token)) continue;
        if (blob.includes(token)) score += token.includes(' ') || token.includes('-') ? 60 : 45;
        if ((a.slug || '').toLowerCase().includes(token.replace(/\s+/g, '-'))) score += 35;
      }
      for (const t of tokens) {
        if (!t) continue;
        const token = t.toLowerCase();
        if (genericTokens.has(token)) {
          if (blob.includes(token)) score += 1;
          continue;
        }
        if (blob.includes(token)) score += token.includes(' ') ? 8 : 3;
        if ((a.slug || '').toLowerCase().includes(token.replace(/\s+/g, '-'))) score += 5;
      }
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  const out = [];
  const seen = new Set();
  for (const { a } of scored) {
    if (out.length >= max) break;
    if (!a.slug || seen.has(a.slug)) continue;
    seen.add(a.slug);
    out.push(a);
  }
  if (out.length < max) {
    for (const a of articles) {
      if (out.length >= max) break;
      if (!a.slug || seen.has(a.slug)) continue;
      seen.add(a.slug);
      out.push(a);
    }
  }
  return out.slice(0, max);
}

function isUsableArticleImage(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  if (/data:image\/svg/i.test(s)) return false;
  if (/\.svg(?:[?#]|$)/i.test(s)) return false;
  if (/\/storage\/v1\/object\/sign\//i.test(s)) return false;
  if (/[?&]token=/i.test(s) && /supabase\.(co|in)\//i.test(s)) return false;
  return /^https?:\/\//i.test(s);
}

/** Marketing / favicon placeholders — never treat these as real article thumbs. */
function isGenericMarketingImage(url) {
  const s = String(url || '');
  return /Websitehomebucket\/Cruise%20planner\.jpg|Websitehomebucket\/Discover%20Ships|SeadaysPublic\/seadaysfav\.png/i.test(
    s
  );
}

/**
 * Pull a card thumbnail from an already-generated blog HTML page.
 * Prefer og:image, then twitter:image, then the first usable article <img>.
 * Does not invent placeholders; skips generic marketing fallbacks.
 */
function extractArticleCardImageFromHtml(html) {
  const raw = String(html || '');
  if (!raw) return '';
  const candidates = [];
  const og = raw.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
    || raw.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (og && og[1]) candidates.push(og[1]);
  const tw = raw.match(/name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
    || raw.match(/content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
  if (tw && tw[1]) candidates.push(tw[1]);
  for (const m of raw.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    if (m[1]) candidates.push(m[1]);
  }
  for (const c of candidates) {
    const url = rewriteCdnThumbnailUrl(String(c || '').trim());
    if (!isUsableArticleImage(url)) continue;
    if (isGenericMarketingImage(url)) continue;
    if (/cdn\.seadays\.app/i.test(url)) continue;
    return url;
  }
  return '';
}

function pickArticleImage(article) {
  if (!article) return '';
  const candidates = [article.thumbnailUrl, article.heroImageUrl, article.ogImage];
  for (const candidate of candidates) {
    const url = rewriteCdnThumbnailUrl(candidate);
    if (isUsableArticleImage(url) && !isGenericMarketingImage(url) && !/cdn\.seadays\.app/i.test(url)) {
      return url;
    }
  }
  return '';
}

const PORT_JUMP_LABELS = {
  'quick-facts': 'Quick facts',
  'guest-reviews': 'Guest reviews',
  'bookable-experiences': 'Experiences',
  'getting-there': 'Terminals',
  'things-to-do': 'Things to do',
  'weather-best-time': 'Weather',
  'entry-requirements': 'Entry',
  'traveler-questions': 'Questions',
  'plan-port-day': 'App',
  'related-ports': 'Related ports',
  'ships-calling': 'Ships',
  'more-reading': 'Reading',
};

function buildPortJumpNav(html) {
  const src = String(html || '');
  const links = [];
  const seen = new Set();
  const re = /id="([a-z0-9-]+)"/g;
  let match;
  while ((match = re.exec(src))) {
    const id = match[1];
    if (!PORT_JUMP_LABELS[id] || seen.has(id)) continue;
    seen.add(id);
    links.push([id, PORT_JUMP_LABELS[id]]);
  }
  if (!links.length) return '';
  return `<nav class="port-jump" aria-label="On this page">${links
    .map(([id, label]) => `<a href="#${id}">${escapeHtml(label)}</a>`)
    .join('')}</nav>`;
}

function buildArticleCards(articles, label = 'Read more') {
  const cards = articles
    .filter((a) => a && a.slug)
    .slice(0, 6)
    .map((a) => {
      const displayTitle = resolveRelatedReadingCardTitle(a, getBlogTitleBySourceSlug());
      const img = pickArticleImage(a);
      const visual = img
        ? `<img class="seo-article-img" src="${escapeHtml(img)}" alt="${escapeHtml(displayTitle)}" width="640" height="150" loading="eager" decoding="async" onerror="this.onerror=null;this.remove()">`
        : '';
      const excerpt = relatedReadingCardExcerpt(a, 20);
      return `<a class="seo-article-card" href="/blog/${escapeHtml(a.slug)}/">${visual}<span class="seo-article-kicker">${escapeHtml(label)}</span><strong>${escapeHtml(displayTitle)}</strong><small>${escapeHtml(excerpt)}</small></a>`;
    })
    .join('');
  return cards ? `<div class="seo-article-grid">${cards}</div>` : '';
}

function buildFunVisualPanel(kind, entity, relatedArticles) {
  const firstArticle = relatedArticles.find((a) => pickArticleImage(a));
  const articleImg = firstArticle ? pickArticleImage(firstArticle) : '';
  const label = kind === 'ship' ? 'Ship planning snapshot' : 'Port day snapshot';
  const title = kind === 'ship'
    ? `${entity.name} at a glance`
    : `${entity.name} shore-day mood`;
  const statOne = kind === 'ship' ? entity.cruise_line : (entity.country || entity.region || 'Cruise port');
  const statTwo = kind === 'ship' ? (entity.shipClass || 'Cruise ship') : (entity.region || 'Shore day');
  const visual = articleImg
    ? `<img class="seo-visual-img" src="${escapeHtml(articleImg)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Cruise%20planner.jpg'">`
    : `<div class="seo-visual-art"><span></span><span></span><span></span></div>`;
  return `<section class="seo-visual-panel" aria-label="${escapeHtml(label)}">
    ${visual}
    <div class="seo-visual-copy">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(title)}</strong>
      <div class="seo-visual-pills"><span>${escapeHtml(statOne)}</span><span>${escapeHtml(statTwo)}</span><span>SeaDays guide</span></div>
    </div>
  </section>`;
}

function isGenericShipMetaDescription(text) {
  return /planning overview, highlights, and tips for passengers/i.test(String(text || ''));
}

function buildShipMetaDescription(ship) {
  const custom = ship.metaDescription && String(ship.metaDescription).trim();
  if (custom && !isGenericShipMetaDescription(custom)) {
    return custom.length <= 160 ? custom : custom.slice(0, 157) + '…';
  }
  const line = ship.cruise_line;
  const cls = ship.shipClass ? `${shipClassNounPhrase(ship)} ` : '';
  const year = Number.isFinite(ship.yearBuilt) ? ` (${Math.round(ship.yearBuilt)})` : '';
  const raw = `${ship.name} cruise ship guide: ${cls}${line} catalog facts${year}, capacity, and planning notes from SeaDays.`;
  return raw.length <= 160 ? raw : raw.slice(0, 157) + '…';
}

function buildPortMetaDescription(port, h1) {
  const custom = port.metaDescription && String(port.metaDescription).trim();
  if (custom) {
    const deduped = dedupeRepeatedCommaPhrase(custom);
    return deduped.length <= 160 ? deduped : deduped.slice(0, 157) + '…';
  }
  const c = h1 || formatPortPlaceLabel(port) || formatPortCoreName(port);
  const raw = `${c} cruise port: shore tips, best time to visit, cruise relevance & things to do—SeaDays guide.`;
  return raw.length <= 160 ? raw : raw.slice(0, 157) + '…';
}

function isLowValueShipHighlight(text, ship) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return true;
  if (/ship profile in the SeaDays cruise directory/i.test(t)) return true;
  const name = String(ship && ship.name ? ship.name : '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (name && new RegExp(`^${name} is operated by `, 'i').test(t) && t.split(/\s+/).length <= 12) {
    return true;
  }
  return false;
}

function buildShipWhyBullets(ship, overviewText) {
  const overview = String(overviewText || '');
  const highlights = (Array.isArray(ship.highlights) ? ship.highlights : [])
    .map((t) => cleanPortCopy(t))
    .filter((t) => t && !isLowValueShipHighlight(t, ship) && !isDanglingSentence(t))
    .filter((t) => !isCruiseLineSalesCopy(t) && shipOverviewMatchesSubject(ship, t))
    .filter((t) => !overview || !overview.includes(t));
  if (highlights.length < 2) return '';
  return highlights.slice(0, 8).map((t) => `<li>${escapeHtml(t)}</li>`).join('');
}

function buildShipFaqItems(ship) {
  const items = [];
  items.push({
    q: `What cruise line operates ${ship.name}?`,
    a: `${ship.name} is operated by ${ship.cruise_line}.`,
  });
  if (Number.isFinite(ship.yearBuilt)) {
    items.push({
      q: `When did ${ship.name} enter service?`,
      a: `${ship.name} entered service in ${Math.round(ship.yearBuilt)}.`,
    });
  }
  if (ship.shipClass) {
    items.push({
      q: `What class is ${ship.name}?`,
      a: `${ship.name} is ${indefiniteArticleFor(shipClassNounPhrase(ship))} ${shipClassNounPhrase(ship)}.`,
    });
  }
  if (Number.isFinite(ship.capacity)) {
    items.push({
      q: `How many passengers does ${ship.name} carry?`,
      a: `Catalog capacity for ${ship.name} is ${formatCapacityLabel(ship)}${
        Number.isFinite(ship.capacityMax) && ship.capacityMax !== ship.capacity
          ? `, with a listed maximum of ${Math.round(ship.capacityMax).toLocaleString('en-US')}`
          : ''
      }, and cabin configuration can change that figure.`,
    });
  }
  if (Number.isFinite(ship.tonnage) || Number.isFinite(ship.length)) {
    const bits = [];
    if (Number.isFinite(ship.tonnage)) bits.push(`${Math.round(ship.tonnage).toLocaleString('en-US')} GT`);
    if (Number.isFinite(ship.length)) bits.push(`${Math.round(ship.length)} m long`);
    if (Number.isFinite(ship.beam)) bits.push(`${Math.round(ship.beam)} m beam`);
    items.push({
      q: `How large is ${ship.name}?`,
      a: `Verified catalog specs list ${ship.name} at ${bits.join(', ')}.`,
    });
  }
  items.push({
    q: `Does SeaDays publish passenger reviews for ${ship.name}?`,
    a: `This catalog page for ${ship.name} is not a passenger review, and community reviews stay in the SeaDays app when guests have submitted them.`,
  });
  return items.filter((item) => item.q && item.a).slice(0, 6);
}

function buildShipFaqHtml(items) {
  if (!items.length) return '';
  const rows = items
    .map(
      (item) =>
        `<details class="seo-faq-item"><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
    )
    .join('');
  return `<h2>Frequently asked questions</h2><div class="seo-faq">${rows}</div>`;
}

function buildShipFaqJsonLd(items, canonical) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
    url: canonical,
  };
}

function buildShipIntroParagraphs(ship) {
  const sentences = uniqueSentences(
    [
      ship.description,
      Number.isFinite(ship.yearBuilt)
        ? `${ship.name} entered service in ${Math.round(ship.yearBuilt)}.`
        : '',
      ship.shipClass
        ? `${ship.name} is ${indefiniteArticleFor(shipClassNounPhrase(ship))} ${shipClassNounPhrase(ship)} operated by ${ship.cruise_line}.`
        : `${ship.name} is operated by ${ship.cruise_line}.`,
      `This SeaDays guide lists verified catalog facts so you can compare ${ship.name} with other ${ship.cruise_line} ships before booking.`,
    ],
    6
  );
  return splitIntoParagraphs(sentences.join(' '));
}

function buildShipPlanningParagraphs(ship) {
  const sentences = uniqueSentences(
    [
      `Use ${ship.name}’s catalog specs—capacity, year, and class—to judge whether the ship matches your itinerary length and travel party.`,
      `Cabin location, dining reservations, and show times are published by ${ship.cruise_line} for each sailing; confirm those on your booking rather than assuming sister ships are identical.`,
      `SeaDays helps you keep port days, sea days, and notes for ${ship.name} in one place so planning stays with the voyage instead of scattered screenshots.`,
    ],
    3
  );
  return splitIntoParagraphs(sentences.join(' '));
}

function buildPortThingsBullets(port) {
  if (port.highlights.length >= 4) {
    return port.highlights.slice(0, 8).map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  }
  return pickManyUnique(
    PORT_LIST_ONLY_ACTIONS.map((x) => fillPortVars(x, port)),
    port.id + port.slug,
    5,
    'ptb'
  )
    .map((t) => `<li>${escapeHtml(t)}</li>`)
    .join('');
}

function moreOnSeaDaysInline(kind) {
  if (kind === 'port') {
    return (
      '<p class="seo-body seo-inline-more">' +
      '<a href="/blog/what-happens-if-you-miss-your-cruise-ship/">What if you miss the ship?</a> · ' +
      '<a href="/blog/cruise-packing-list-what-to-bring-and-what-to-leave-home/">Cruise packing list</a> · ' +
      '<a href="/ships/">Ships directory</a>' +
      '</p>'
    );
  }
  return (
    '<p class="seo-body seo-inline-more">' +
    '<a href="/blog/what-is-a-sea-day-on-a-cruise/">What is a sea day?</a> · ' +
    '<a href="/blog/first-time-cruise-tips-what-to-know-before-you-go/">First-time cruise tips</a> · ' +
    '<a href="/ports/">Ports directory</a>' +
    '</p>'
  );
}

const PAGE_STYLES = `
.seo-detail { max-width: 800px; margin: 0 auto; padding: 40px 20px 80px; }
.seo-detail-wide { max-width: 1120px; }
.seo-hero { margin: 0 0 22px; }
.seo-hero .seo-hero-img { display: block; margin: 0; }
.seo-hero figcaption { margin-top: 8px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.62); }
.seo-hero figcaption a { color: rgba(255,255,255,0.82); }
@media (min-width: 1100px) {
  .seo-detail-wide .pg-facts,
  .seo-detail-wide .pg-quick,
  .seo-detail-wide .pg-terminal-grid,
  .seo-detail-wide .pg-qa-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .seo-detail-wide .seo-article-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.seo-detail h1 { font-size: 40px; font-weight: 900; margin-bottom: 16px; line-height: 1.15; }
.seo-detail .lead { font-size: 18px; color: rgba(255,255,255,0.75); margin-bottom: 28px; }
.seo-detail .seo-body p { font-size: 17px; line-height: 1.8; color: rgba(255,255,255,0.88); margin-bottom: 18px; }
.seo-detail h2 { font-size: 24px; font-weight: 800; margin: 36px 0 14px; color: #fff; }
.seo-detail ul { margin: 12px 0 20px 22px; color: rgba(255,255,255,0.88); }
.seo-detail li { margin-bottom: 10px; }
.seo-keyfacts { display: grid; gap: 12px; margin: 24px 0; padding: 20px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.seo-keyfacts dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.45); }
.seo-keyfacts dd { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; }
.seo-cross-block { margin-top: 28px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); }
.seo-cross-list { list-style: none; margin: 0; padding: 0; }
.seo-cross-list li { margin: 10px 0; }
.seo-cross-list a { color: var(--neon-red); font-weight: 600; text-decoration: none; }
.seo-cross-list a:hover { text-decoration: underline; }
.seo-hero-img { width: 100%; max-height: 420px; object-fit: cover; border-radius: 16px; margin: 0 0 28px; background: rgba(255,255,255,0.06); }
.seo-visual-panel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 0.8fr); gap: 18px; align-items: stretch; margin: 22px 0 32px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); border-radius: 22px; background: radial-gradient(circle at top left, rgba(255,0,51,0.22), transparent 42%), linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)); box-shadow: 0 20px 60px rgba(0,0,0,0.28); }
.seo-visual-img { width: 100%; height: 230px; object-fit: cover; min-height: 100%; }
.seo-visual-art { position: relative; min-height: 230px; background: linear-gradient(135deg, rgba(255,0,51,0.35), rgba(0,194,255,0.2)), radial-gradient(circle at 72% 30%, rgba(255,255,255,0.45), transparent 9%), radial-gradient(circle at 18% 76%, rgba(255,255,255,0.22), transparent 12%); overflow: hidden; }
.seo-visual-art span { position: absolute; display: block; border-radius: 999px; border: 1px solid rgba(255,255,255,0.28); }
.seo-visual-art span:nth-child(1) { width: 170px; height: 170px; left: -42px; bottom: -60px; }
.seo-visual-art span:nth-child(2) { width: 110px; height: 110px; right: 24px; top: 28px; }
.seo-visual-art span:nth-child(3) { width: 260px; height: 70px; right: -70px; bottom: 34px; transform: rotate(-12deg); }
.seo-visual-copy { padding: 24px 24px 24px 0; display: flex; flex-direction: column; justify-content: center; gap: 10px; }
.seo-visual-copy p { margin: 0; color: var(--neon-red); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
.seo-visual-copy strong { color: #fff; font-size: 26px; line-height: 1.12; }
.seo-visual-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.seo-visual-pills span { display: inline-flex; border-radius: 999px; padding: 7px 10px; color: rgba(255,255,255,0.82); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); font-size: 12px; }
.seo-article-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 14px 0 30px; }
.seo-article-card { display: grid; gap: 9px; min-height: 100%; overflow: hidden; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.055); text-decoration: none; color: #fff; box-shadow: 0 14px 35px rgba(0,0,0,0.2); transition: transform 0.18s ease, border-color 0.18s ease; }
.seo-article-card:hover { transform: translateY(-2px); border-color: rgba(255,0,51,0.48); }
.seo-article-img { width: 100%; height: 150px; object-fit: cover; display: block; background: transparent; }
.seo-article-fallback { width: 100%; height: 150px; object-fit: cover; background: rgba(255,255,255,0.08); }
.seo-article-fallback { display: flex; align-items: end; padding: 14px; background: linear-gradient(135deg, rgba(255,0,51,0.42), rgba(0,194,255,0.24)); }
.seo-article-fallback-2 { background: linear-gradient(135deg, rgba(0,194,255,0.34), rgba(255,184,0,0.26)); }
.seo-article-fallback-3 { background: linear-gradient(135deg, rgba(126,87,194,0.42), rgba(255,0,51,0.28)); }
.seo-article-fallback-4 { background: linear-gradient(135deg, rgba(0,184,148,0.34), rgba(255,0,51,0.3)); }
.seo-article-fallback span, .seo-article-kicker { color: var(--neon-red); font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.seo-article-kicker, .seo-article-card strong, .seo-article-card small { margin-left: 14px; margin-right: 14px; }
.seo-article-card strong { font-size: 15px; line-height: 1.25; }
.seo-article-card small { color: rgba(255,255,255,0.66); line-height: 1.45; padding-bottom: 16px; }
.seo-inline-more a { color: var(--neon-red); font-weight: 600; text-decoration: none; }
.seo-inline-more a:hover { text-decoration: underline; }
.seo-breadcrumbs { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 18px; }
.seo-breadcrumbs a { color: rgba(255,255,255,0.7); text-decoration: none; }
.seo-breadcrumbs a:hover { color: #fff; text-decoration: underline; }
.seo-faq { display: grid; gap: 10px; margin: 12px 0 28px; }
.seo-faq-item { border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; background: rgba(255,255,255,0.04); padding: 14px 16px; }
.seo-faq-item summary { cursor: pointer; font-weight: 700; color: #fff; }
.seo-faq-item p { margin: 10px 0 0; color: rgba(255,255,255,0.86); line-height: 1.65; }
/* Site chrome header/footer styles come from /assets/css/site-shell.css */
@media (max-width: 720px) { .seo-visual-panel, .seo-article-grid { grid-template-columns: 1fr; } .seo-visual-copy { padding: 0 20px 22px; } .seo-visual-img, .seo-visual-art { min-height: 190px; height: 190px; } }
` + GUEST_REVIEWS_SECTION_CSS + PORT_GUIDE_STYLES;

function buildDirectoryHeaderNav() {
  return getSiteHeaderHtml({ page: 'default' });
}

function shipOverviewMatchesSubject(ship, text) {
  const name = String(ship && ship.name ? ship.name : '').trim();
  const line = String(ship && ship.cruise_line ? ship.cruise_line : '').trim();
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  if (!name || !line || !body) return false;
  const first = body.split(/(?<=[.!?])\s+/)[0] || body;
  const probe = first.toLowerCase();
  if (
    /may refer to|disambiguation|\bis an? (?:[\w'-]+\s+){0,4}(town|city|village|municipality|district|commune)\b/.test(
      probe
    )
  ) {
    return false;
  }
  const nameOk = probe.includes(name.toLowerCase());
  const lineOk = probe.includes(line.toLowerCase());
  return nameOk && lineOk;
}

function isCruiseLineSalesCopy(text) {
  return /\b(book your|cruise today|don['’]t miss|unforgettable|award-winning|sail away)\b/i.test(String(text || ''));
}

function publishableShipOverview(ship) {
  if (shipOverviewHiddenByAudit(ship && ship.slug)) return '';
  const text = cleanPortCopy(ship && ship.description);
  if (!text || isCruiseLineSalesCopy(text) || !shipOverviewMatchesSubject(ship, text)) return '';
  return text;
}

function buildShipDetailHtml(ship, relatedShips, relatedPorts, blogArticles, opts) {
  const BASE_URL = opts.baseUrl;
  const canonical = `${BASE_URL}/ships/${ship.slug}/`;
  const overviewText = publishableShipOverview(ship);
  const introParas = overviewText ? splitIntoParagraphs(overviewText) : [];
  const shipClass = shipClassNounPhrase(ship);
  const title = `${ship.name} Cruise Ship Guide | ${ship.cruise_line}`;
  const h1 = `${ship.name} Cruise Ship Guide`;
  const metaDesc = buildShipMetaDescription(ship);
  const ogImage = ship.image_url || opts.defaultImage;
  const whyBullets = buildShipWhyBullets(ship, overviewText);
  const faqItems = buildShipFaqItems(ship);

  const shipPick = relatedShips.slice(0, 6);
  const portPick = relatedPorts.slice(0, 5);
  const blogPick = blogArticles.slice(0, 6);
  const visualPanel = buildFunVisualPanel('ship', ship, blogPick);

  const relatedShipLinks = shipPick
    .map((s) => `<li><a href="/ships/${escapeHtml(s.slug)}/">${escapeHtml(s.name)} cruise ship guide</a></li>`)
    .join('');
  const relatedPortLinks = portPick
    .map((p) => {
      const label = formatPortPlaceLabel(p) || p.name;
      return `<li><a href="/ports/${escapeHtml(p.slug)}/">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  const blogCards = buildArticleCards(blogPick, 'Cruise guide');

  const vehicle = {
    '@type': 'Vehicle',
    name: ship.name,
    brand: { '@type': 'Brand', name: ship.cruise_line },
    url: canonical,
  };
  if (Number.isFinite(ship.yearBuilt)) vehicle.modelDate = String(Math.round(ship.yearBuilt));
  if (ship.shipClass) vehicle.model = shipClassNounPhrase(ship);
  const additionalProperty = [];
  if (Number.isFinite(ship.tonnage)) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Gross tonnage',
      value: Math.round(ship.tonnage),
      unitText: 'GT',
    });
  }
  if (Number.isFinite(ship.capacity)) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Passenger capacity',
      value: Math.round(ship.capacity),
      description: formatCapacityLabel(ship),
    });
  }
  if (Number.isFinite(ship.crew)) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Crew',
      value: Math.round(ship.crew),
    });
  }
  if (Number.isFinite(ship.length)) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Length',
      value: Math.round(ship.length),
      unitText: 'm',
    });
  }
  if (Number.isFinite(ship.beam)) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Beam',
      value: Math.round(ship.beam),
      unitText: 'm',
    });
  }
  if (additionalProperty.length) vehicle.additionalProperty = additionalProperty;

  const jsonLdDesc = (introParas.join(' ') || metaDesc).slice(0, 500);
  const aggregateRating = buildShipAggregateRatingJsonLd(ship);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: jsonLdDesc || metaDesc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'SeaDays', url: `${BASE_URL}/` },
    about: vehicle,
  };
  if (aggregateRating) jsonLd.about.aggregateRating = aggregateRating;

  const faqLd = buildShipFaqJsonLd(faqItems, canonical);
  const heroImg = ship.image_url
    ? `<img class="seo-hero-img" src="${escapeHtml(ship.image_url)}" alt="${escapeHtml(ship.name)} cruise ship" width="800" height="420" loading="eager" decoding="async">`
    : '';
  const overviewHtml = introParas.length
    ? `<h2>Overview</h2><article class="seo-body">${introParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>`
    : '';
  const highlightsHtml = whyBullets
    ? `<h2>Highlights</h2><ul>${whyBullets}</ul>`
    : '';
  const robots = isShipDetailIndexable(ship) ? 'index, follow' : 'noindex, follow';

  return finishPublicCopyHtml(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
${getAnalyticsHeadHtml()}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${robots}">
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
${getFaviconHeadHtml()}
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonical}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(metaDesc)}">
  <meta property="twitter:image" content="${escapeHtml(ogImage)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(buildShipBreadcrumbJsonLd(ship, canonical))}</script>
  ${faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ''}
  ${getSiteShellCssLinkHtml()}
  <style>${opts.indexStyles}${PAGE_STYLES}</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    ${buildDirectoryHeaderNav()}
    <main class="seo-detail container">
      ${buildShipBreadcrumbsHtml(ship)}
      ${heroImg}
      <h1>${escapeHtml(h1)}</h1>
      <p class="lead">${escapeHtml(ship.cruise_line)} · ${escapeHtml(shipClass)}</p>
      ${visualPanel}
      ${overviewHtml}
      <h2>Key facts</h2>
      <dl class="seo-keyfacts">
        ${buildShipKeyFactsHtml(ship)}
      </dl>
      ${buildGuestReviewsSectionHtml(ship)}
      ${highlightsHtml}
      ${buildShipFaqHtml(faqItems)}
      ${moreOnSeaDaysInline('ship')}
      <h2>More reading</h2>
      ${blogCards || '<ul class="seo-cross-list"><li><a href="/blog/">SeaDays blog</a></li></ul>'}
    </main>
    ${getSiteFooterHtml()}
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<40;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  ${opts.runtimeGuardScript}
</body>
</html>`);
}

function buildLicensedHero(guide, fallbackAlt) {
  const hero = guide && guide.hero;
  if (!hero || typeof hero !== 'object') return { html: '', url: '' };
  const url = String(hero.url || '').trim();
  const author = String(hero.author || '').trim();
  const license = String(hero.license || '').trim();
  const licenseUrl = String(hero.licenseUrl || '').trim();
  if (!url || !author || !license || !licenseUrl) return { html: '', url: '' };
  const alt = String(hero.alt || fallbackAlt || 'Cruise port').trim();
  const authorHtml = hero.authorUrl
    ? `<a href="${escapeHtml(hero.authorUrl)}">${escapeHtml(author)}</a>`
    : escapeHtml(author);
  const sourceHtml = hero.sourceName
    ? (hero.sourceUrl
      ? `<a href="${escapeHtml(hero.sourceUrl)}">${escapeHtml(hero.sourceName)}</a>`
      : escapeHtml(hero.sourceName))
    : '';
  const titleHtml = hero.title ? `“${escapeHtml(hero.title)}”` : '';
  const licenseHtml = `<a href="${escapeHtml(licenseUrl)}">${escapeHtml(license)}</a>`;
  const caption = ['Photo:', authorHtml, sourceHtml, titleHtml, licenseHtml].filter(Boolean).join(' / ').replace(/^Photo: \/ /, 'Photo: ');
  return {
    url,
    html:
      `<figure class="seo-hero">` +
      `<img class="seo-hero-img" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="1280" loading="eager" decoding="async">` +
      `<figcaption>${caption}</figcaption>` +
      `</figure>`,
  };
}

function buildPortDetailHtml(port, relatedPorts, relatedShips, blogArticles, opts) {
  const BASE_URL = opts.baseUrl;
  const canonical = `${BASE_URL}/ports/${port.slug}/`;
  const coreName = formatPortCoreName(port);
  const h1 = formatPortPlaceLabel(port) || coreName;
  const titleBase = formatPortPlaceLabel(port) || coreName;
  const title = `${titleBase} Cruise Port Guide: Terminals, Tips & Things to Do`;
  const guide = opts.portGuide || null;
  const terminals = Array.isArray(opts.portTerminals) ? opts.portTerminals : [];
  const affiliate =
    opts.affiliate ||
    resolvePortAffiliateCta(port, {
      appRoot: opts.appRoot,
      slugToAppPortId: opts.slugToAppPortId,
      knownPortIds: opts.knownAffiliatePortIds,
      destinationLabel: coreName,
    });
  const cleanedDescription = cleanPortCopy(port.description);
  const overviewText =
    cleanedDescription && !isBoilerplateDescription(cleanedDescription)
      ? trimWords(cleanedDescription, 70)
      : '';

  let metaDesc = dedupeRepeatedCommaPhrase(buildPortMetaDescription(port, h1));
  if (guide?.portInfo?.description) {
    const enriched = `${coreName} cruise port guide: terminals, getting there, weather, and shore-day ideas.`;
    metaDesc = enriched.length <= 160 ? enriched : enriched.slice(0, 157) + '…';
  }

  const relations = applyPortPageOverrides(port, relatedPorts, relatedShips);
  const portPick = relations.relatedPorts.slice(0, 4);
  const shipPick = relations.hideCallingShips ? [] : relations.relatedShips.slice(0, 4);
  const blogPick = blogArticles.slice(0, 3);
  const articleImages = new Set(blogPick.map((a) => pickArticleImage(a)).filter(Boolean));
  const licensedHero = buildLicensedHero(guide, h1);
  const ownImage =
    licensedHero.url || (port.image_url && !articleImages.has(port.image_url) ? port.image_url : '');
  const ogImage = ownImage || opts.defaultImage;

  const relatedPortLinks = portPick
    .map((p) => {
      const label = formatPortPlaceLabel(p) || p.name;
      return `<li><a href="/ports/${escapeHtml(p.slug)}/">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  const relatedShipLinks = shipPick
    .map((s) => `<li><a href="/ships/${escapeHtml(s.slug)}/">${escapeHtml(s.name)}</a> <span style="color:rgba(255,255,255,0.45)">(${escapeHtml(s.cruise_line)})</span></li>`)
    .join('');
  const blogCards = buildArticleCards(blogPick, 'Port guide');
  const guideHtml = buildPhase1GuideHtml({
    port: {
      ...port,
      overviewText,
      highlights: filterHighlightList(port.highlights, port.description),
    },
    guide,
    terminals,
    affiliate,
  });
  const relatedHtml = [
    relations.hideRelatedPorts
      ? ''
      : `<section class="seo-cross-block" id="related-ports" data-related="curated"><h2>Related ports</h2><ul class="seo-cross-list">${relatedPortLinks}</ul></section>`,
    relations.hideCallingShips
      ? ''
      : `<section class="seo-cross-block" id="ships-calling" data-related="itinerary"><h2>Ships calling here</h2><ul class="seo-cross-list">${relatedShipLinks}</ul></section>`,
    `<section class="seo-cross-block" id="more-reading"><h2>More reading</h2>${blogCards || '<ul class="seo-cross-list"><li><a href="/blog/">SeaDays blog</a></li></ul>'}</section>`,
  ].filter(Boolean).join('\n');
  const jumpNav = buildPortJumpNav(`${guideHtml}\n${relatedHtml}`);

  const bodyForLd = [guide?.portInfo?.description || '', overviewText].filter(Boolean).join(' ');
  const jsonLdDesc = bodyForLd.slice(0, 500) + (bodyForLd.length > 500 ? '…' : '');
  const lat = pickFirstFiniteNumber(port.latitude, port.lat);
  const lng = pickFirstFiniteNumber(port.longitude, port.lng);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: h1,
    description: jsonLdDesc,
    image: ogImage || undefined,
    url: canonical,
  };
  if (lat != null && lng != null) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    };
  }
  Object.keys(jsonLd).forEach((k) => {
    if (jsonLd[k] === undefined) delete jsonLd[k];
  });
  const breadcrumbLd = buildBreadcrumbJsonLd(port, canonical);
  const faqItems = collectPortFaqItems(guide, coreName).filter((item) =>
    guideHtml.includes(escapeHtml(item.q))
  );
  const faqLd = faqItems.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }
    : null;

  const heroImg = licensedHero.html
    ? licensedHero.html
    : ownImage
      ? `<img class="seo-hero-img" src="${escapeHtml(ownImage)}" alt="${escapeHtml(h1)}" width="800" height="420" loading="eager" decoding="async">`
      : '';
  const callSummary = portCallsAsHomeport(port, terminals) ? 'Home port' : 'Port call';
  const robots = isPortDetailIndexable(port, guide) ? 'index, follow' : 'noindex, follow';

  return finishPublicCopyHtml(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
${getAnalyticsHeadHtml()}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${robots}">
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
${getFaviconHeadHtml()}
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonical}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(metaDesc)}">
  <meta property="twitter:image" content="${escapeHtml(ogImage)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  ${faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ''}
  ${getSiteShellCssLinkHtml()}
  <style>${opts.indexStyles}${PAGE_STYLES}</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    ${buildDirectoryHeaderNav()}
    <main class="seo-detail seo-detail-wide container">
      ${buildBreadcrumbsHtml(port)}
      <h1>${escapeHtml(h1)} Cruise Port Guide</h1>
      <p class="lead">${escapeHtml(callSummary)}${port.country ? ` in ${escapeHtml(port.country)}` : ''}</p>
      ${heroImg}
      ${jumpNav}
      ${guideHtml}
      ${relatedHtml}
    </main>
    ${getSiteFooterHtml()}
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<40;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  ${opts.runtimeGuardScript}
</body>
</html>`);
}

module.exports = {
  buildSeoShipRecords,
  buildSeoPortRecords,
  buildShipDetailHtml,
  buildPortDetailHtml,
  pickRelatedShips,
  pickRelatedPorts,
  pickPortsForShipPage,
  pickShipsForPortPage,
  pickBlogArticlesForEntity,
  slugify,
  applyPortGeoFromApiRows,
  isUsableArticleImage,
  isGenericMarketingImage,
  extractArticleCardImageFromHtml,
  pickArticleImage,
  buildArticleCards,
  getBlogTitleBySourceSlug,
  resolveRelatedReadingCardTitle,
  relatedReadingCardExcerpt,
  isBrokenRelatedReadingExcerpt,
  isCompleteRelatedReadingExcerpt,
  buildShipBreadcrumbJsonLd,
  buildShipBreadcrumbsHtml,
  buildShipAggregateRatingJsonLd,
};
