'use strict';

/**
 * Static HTML builders for /ships/<slug>/ and /ports/<slug>/ (programmatic SEO).
 * 400–800 words per page, unique template expansion, capped internal links (~8–10).
 */

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
  const DEFAULT_RATING = 4.5;
  const DEFAULT_COUNT = 100;
  const bestRating = 5;
  const worstRating = 1;
  let ratingVal = ship.rating;
  let countVal = ship.reviewCount;
  if (ratingVal == null || !Number.isFinite(ratingVal) || ratingVal <= 0) ratingVal = DEFAULT_RATING;
  if (countVal == null || !Number.isFinite(countVal) || countVal <= 0) countVal = DEFAULT_COUNT;
  const rv = clampAggregateRatingValue(ratingVal) ?? DEFAULT_RATING;
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.round(rv * 10) / 10,
    reviewCount: Math.max(1, Math.round(countVal)),
    bestRating,
    worstRating,
  };
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

function indefiniteArticleFor(text) {
  const first = String(text || '').trim().charAt(0).toLowerCase();
  return /^[aeiou]/.test(first) ? 'an' : 'a';
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
  const place = port.country ? `${port.name}, ${port.country}` : port.name;
  const overview =
    overviewSentences.length > 0
      ? overviewSentences.join(' ')
      : `${place} is a cruise port in ${port.region || port.country || 'this region'}.`;
  const whatToDo = uniqueSentences(
    [
      ...(port.highlights || []),
      `For a shore day in ${port.name}, choose one main activity first, then keep time for meals, walking, and the return to the pier.`,
      `SeaDays helps travelers compare ${port.name} with nearby ports so the itinerary feels organized before the ship arrives.`,
    ],
    4
  ).join(' ');
  const cruiseRelevance = uniqueSentences(
    [
      `${port.name} matters to cruise planning because port time, transport distance, and all-aboard timing shape how much of the destination you can realistically enjoy.`,
      fillPortVars(pickAt(PORT_CRUISE_RELEVANCE, seed, 'cru'), port),
    ],
    3
  ).join(' ');
  const tips = uniqueSentences(
    [
      `Before leaving the ship in ${port.name}, save the pier location, ship time, and any shuttle details offline.`,
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
  const place = port.country ? `${port.name}, ${port.country}` : port.name;
  return t
    .replace(/\{name\}/g, port.name)
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
      rating,
      reviewCount,
    });
  }
  return out;
}

function buildSeoPortRecords(rawList) {
  const out = [];
  const usedSlugs = new Set();
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i] || {};
    const name = raw.portName || raw.name || `Port ${i + 1}`;
    const country = raw.country || raw.countryName || '';
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
  'Lines routing through {name} usually align ship size with berth constraints—larger vessels may use alternate piers or tenders.',
  'Embarkation from {name} can simplify flight planning when airports and hotels align; compare total trip cost versus other homeports.',
  'For {region} sailings, {name} frequently appears as a marquee stop—worth researching shore power, walk-off distance, and typical tender odds.',
];

const PORT_TIPS = [
  'Carry ship time, local cash where cards lag, offline maps, and pier-to-town taxi notes before leaving {name}.',
  'Book independent tours with verified reviews and clear meeting points; screenshot confirmations in case connectivity fails.',
  'Respect all-aboard; pier traffic and security lines at {name} can consume more minutes than maps suggest.',
  'Hydrate and pace walking in heat; schedule meals so you are not rushing back from distant districts.',
];

const PORT_LIST_ONLY_ACTIONS = [
  'Start with one anchor sight, then leave room for spontaneity around {name}.',
  'Screenshot ship departure time and pier map before you lose signal.',
  'Ask crew about tender priority if {name} is a tender port on your sailing.',
  'Pair a light breakfast on the ship with a local lunch ashore to maximize exploration time.',
  'Check whether your line offers shuttle pricing before you commit to taxis at {name}.',
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

function pickRelatedShips(all, current, max = 5) {
  const line = (current.cruise_line || '').toLowerCase();
  const sameLine = all.filter((s) => s.slug !== current.slug && (s.cruise_line || '').toLowerCase() === line);
  const rest = all.filter((s) => s.slug !== current.slug && !sameLine.includes(s));
  const merged = [...sameLine, ...rest];
  return merged.slice(0, max);
}

function pickRelatedPorts(all, current, max = 5) {
  const reg = (current.region || '').toLowerCase();
  const sameReg = all.filter((p) => p.slug !== current.slug && (p.region || '').toLowerCase() === reg && reg);
  const sameCountry = all.filter(
    (p) => p.slug !== current.slug && !sameReg.includes(p) && (p.country || '') === current.country && current.country
  );
  const rest = all.filter((p) => p.slug !== current.slug && !sameReg.includes(p) && !sameCountry.includes(p));
  const merged = [...sameReg, ...sameCountry, ...rest];
  return merged.slice(0, max);
}

function pickPortsForShipPage(allPorts, ship, max = 2) {
  if (!allPorts.length) return [];
  if (allPorts.length <= max) return allPorts.slice(0, max);
  const start = Math.abs(hashCode(ship.slug + 'p')) % Math.max(1, allPorts.length - max + 1);
  return allPorts.slice(start, start + max);
}

function pickShipsForPortPage(allShips, port, max = 4) {
  if (!allShips.length) return [];
  const others = allShips.filter((s) => s.slug);
  const scored = others.map((s, i) => ({
    s,
    score: Math.abs(hashCode(port.slug + '|' + s.slug + '|' + i)),
  }));
  scored.sort((a, b) => a.score - b.score);
  const out = [];
  const seen = new Set();
  for (const { s } of scored) {
    if (out.length >= max) break;
    if (seen.has(s.slug)) continue;
    seen.add(s.slug);
    out.push(s);
  }
  return out.slice(0, max);
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
  return /^https?:\/\//i.test(s);
}

function pickArticleImage(article) {
  if (isUsableArticleImage(article.thumbnailUrl)) return article.thumbnailUrl;
  if (isUsableArticleImage(article.heroImageUrl)) return article.heroImageUrl;
  return '';
}

function buildArticleCards(articles, label = 'Read more') {
  const cards = articles
    .filter((a) => a && a.slug)
    .slice(0, 6)
    .map((a, i) => {
      const img = pickArticleImage(a);
      const visual = img
        ? `<img class="seo-article-img" src="${escapeHtml(img)}" alt="${escapeHtml(a.title || 'SeaDays guide')}" loading="lazy" decoding="async">`
        : `<div class="seo-article-fallback seo-article-fallback-${(i % 4) + 1}"><span>${escapeHtml(label)}</span></div>`;
      const excerpt = trimWords(String(a.excerpt || a.seoDescription || a.metaDescription || 'Cruise planning guide from SeaDays.').replace(/\s+/g, ' ').trim(), 20);
      return `<a class="seo-article-card" href="/blog/${escapeHtml(a.slug)}/">${visual}<span class="seo-article-kicker">${escapeHtml(label)}</span><strong>${escapeHtml(a.title || 'SeaDays guide')}</strong><small>${escapeHtml(excerpt)}</small></a>`;
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
    ? `<img class="seo-visual-img" src="${escapeHtml(articleImg)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
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

function buildShipMetaDescription(ship) {
  const custom = ship.metaDescription && String(ship.metaDescription).trim();
  if (custom) return custom.length <= 160 ? custom : custom.slice(0, 157) + '…';
  const line = ship.cruise_line;
  const cls = ship.shipClass || 'cruise ship';
  const raw = `${ship.name} (${line}): ${cls} review for 2026—onboard experience, who it fits, highlights & SeaDays planning links.`;
  return raw.length <= 160 ? raw : raw.slice(0, 157) + '…';
}

function buildPortMetaDescription(port, h1) {
  const custom = port.metaDescription && String(port.metaDescription).trim();
  if (custom) return custom.length <= 160 ? custom : custom.slice(0, 157) + '…';
  const c = port.country ? `${port.name} (${port.country})` : port.name;
  const raw = `${c} cruise port: shore tips, best time to visit, cruise relevance & things to do—SeaDays guide.`;
  return raw.length <= 160 ? raw : raw.slice(0, 157) + '…';
}

function buildShipWhyBullets(ship) {
  if (ship.highlights.length >= 4) {
    return ship.highlights.slice(0, 8).map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  }
  const defaults = [
    fillShipVars('Balances {line} dining and entertainment signatures on {name}.', ship),
    fillShipVars('Compare {name} with other {line} ships in our directory before you lock a fare.', ship),
    fillShipVars('Use SeaDays to align cabin choice with venues you will visit morning and night on {name}.', ship),
    fillShipVars('Pair {name} with port-heavy itineraries when you want more culture ashore than sea-day lounging.', ship),
    fillShipVars('Check muster, dining, and show bookings early on embarkation day to avoid peak queues on {name}.', ship),
  ];
  const v = Math.abs(hashCode(ship.slug)) % 2;
  return defaults.slice(v, v + 5).map((t) => `<li>${escapeHtml(t)}</li>`).join('');
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

function moreOnSeaDaysInline() {
  return (
    '<p class="seo-body seo-inline-more">' +
    '<a href="/blog/">Cruise guides on the blog</a> · ' +
    '<a href="/ports/">Ports directory</a>' +
    '</p>'
  );
}

const PAGE_STYLES = `
.seo-detail { max-width: 800px; margin: 0 auto; padding: 40px 20px 80px; }
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
.seo-article-img, .seo-article-fallback { width: 100%; height: 150px; object-fit: cover; background: rgba(255,255,255,0.08); }
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
.header { position: sticky; top: 0; background: rgba(10,10,10,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); }
@media (max-width: 720px) { .seo-visual-panel, .seo-article-grid { grid-template-columns: 1fr; } .seo-visual-copy { padding: 0 20px 22px; } .seo-visual-img, .seo-visual-art { min-height: 190px; height: 190px; } }
`;

function buildDirectoryHeaderNav() {
  return `<nav class="header-nav">
        <a href="/">Home</a>
        <a href="/blog/">Blog</a>
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="https://seadays.app/privacy.html">Privacy</a>
        <a href="https://seadays.app/terms.html">Terms</a>
      </nav>`;
}

function buildShipDetailHtml(ship, relatedShips, relatedPorts, blogArticles, opts) {
  const BASE_URL = opts.baseUrl;
  const canonical = `${BASE_URL}/ships/${ship.slug}/`;
  const triple = budgetShipTriple(ship);
  const overviewParas = splitIntoParagraphs(triple.overview);
  const experienceParas = splitIntoParagraphs(triple.experience);
  const audienceParas = splitIntoParagraphs(triple.audience);
  const experienceShort = ship.hasContentOverride
    ? `${ship.cruise_line} ship profile for itinerary, cabin, and shore-day planning.`
    : firstSentence(ship.experience || triple.experience, `${ship.cruise_line} cruise ship profile.`);
  const shipClass = ship.shipClass || 'Contemporary cruise ship';
  const title = `${ship.name} Review, Features & Cruise Experience (2026)`;
  const metaDesc = buildShipMetaDescription(ship);
  const ogImage = ship.image_url || opts.defaultImage;
  const whyBullets = buildShipWhyBullets(ship);

  const shipPick = relatedShips.slice(0, 4);
  const portPick = relatedPorts.slice(0, 2);
  const blogPick = blogArticles.slice(0, 6);
  const visualPanel = buildFunVisualPanel('ship', ship, blogPick);

  const relatedShipLinks = shipPick
    .map((s) => `<li><a href="/ships/${escapeHtml(s.slug)}/">${escapeHtml(s.name)}</a></li>`)
    .join('');
  const relatedPortLinks = portPick
    .map((p) => `<li><a href="/ports/${escapeHtml(p.slug)}/">${escapeHtml(p.name)}${p.country ? `, ${escapeHtml(p.country)}` : ''}</a></li>`)
    .join('');
  const blogCards = buildArticleCards(blogPick, 'Ship guide');

  const bodyForLd = `${triple.overview} ${triple.experience} ${triple.audience}`;
  const jsonLdDesc = bodyForLd.slice(0, 500) + (bodyForLd.length > 500 ? '…' : '');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: ship.name,
    description: jsonLdDesc,
    image: ogImage ? [ogImage] : undefined,
    url: canonical,
    brand: { '@type': 'Brand', name: ship.cruise_line },
    category: 'Cruise ship',
    aggregateRating: buildShipAggregateRatingJsonLd(ship),
  };
  Object.keys(jsonLd).forEach((k) => {
    if (jsonLd[k] === undefined) delete jsonLd[k];
  });

  const heroImg = ship.image_url
    ? `<img class="seo-hero-img" src="${escapeHtml(ship.image_url)}" alt="${escapeHtml(ship.name)}" width="800" height="420" loading="eager" decoding="async">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="${opts.defaultImage}">
  <meta property="og:type" content="article">
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
  <style>${opts.indexStyles}${PAGE_STYLES}</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">${buildDirectoryHeaderNav()}</header>
    <main class="seo-detail container">
      ${heroImg}
      <h1>${escapeHtml(ship.name)}</h1>
      <p class="lead">${escapeHtml(ship.cruise_line)} · ${escapeHtml(shipClass)}</p>
      ${visualPanel}
      <h2>Overview</h2>
      <article class="seo-body">
        ${overviewParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
      </article>
      <h2>Experience on board</h2>
      <article class="seo-body">${experienceParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>
      <h2>Who this ship is best for</h2>
      <article class="seo-body">${audienceParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>
      <h2>Key facts</h2>
      <dl class="seo-keyfacts">
        <dt>Cruise line</dt><dd>${escapeHtml(ship.cruise_line)}</dd>
        <dt>Experience</dt><dd>${escapeHtml(experienceShort)}</dd>
        <dt>Ship focus</dt><dd>${escapeHtml(shipClass)}</dd>
      </dl>
      <h2>Highlights</h2>
      <ul>${whyBullets}</ul>
      <h2>Related ships</h2>
      <ul class="seo-cross-list">${relatedShipLinks || '<li><a href="/ships/">Browse ships</a></li>'}</ul>
      <h2>Destinations to explore</h2>
      <ul class="seo-cross-list">
        ${relatedPortLinks || ''}
      </ul>
      ${moreOnSeaDaysInline()}
      <h2>More reading</h2>
      ${blogCards || '<ul class="seo-cross-list"><li><a href="/blog/">SeaDays blog</a></li></ul>'}
    </main>
    <footer class="footer">
      <div class="container">
        <div class="footer-bottom"><p>&copy; 2026 SeaDays</p></div>
      </div>
    </footer>
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<100;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  ${opts.runtimeGuardScript}
</body>
</html>`;
}

function buildPortDetailHtml(port, relatedPorts, relatedShips, blogArticles, opts) {
  const BASE_URL = opts.baseUrl;
  const canonical = `${BASE_URL}/ports/${port.slug}/`;
  const h1 = port.country ? `${port.name}, ${port.country}` : port.name;
  const title = `${port.name} Cruise Port Guide: Tips, Things to Do & Info`;
  const prose = budgetPortProse(port);
  const overviewParas = splitIntoParagraphs(prose.overview);
  const whatParas = splitIntoParagraphs(prose.whatToDo);
  const cruiseParas = splitIntoParagraphs(prose.cruiseRelevance);
  const tipsParas = splitIntoParagraphs(prose.tips);
  const metaDesc = buildPortMetaDescription(port, h1);
  const ogImage = port.image_url || opts.defaultImage;
  const things = buildPortThingsBullets(port);
  const bestTime =
    port.popularMonths && port.popularMonths.length
      ? port.popularMonths.join(', ')
      : fillPortVars(
          pickAt(
            [
              'Late spring through early fall suits many {region} itineraries touching {name}; verify local holidays and heat.',
              'Shoulder seasons often balance crowds and pricing for cruises calling {name}.',
              'Year-round sailings exist for some regions—check storm seasons and school breaks before booking {name}.',
            ],
            port.id,
            'bt'
          ),
          port
        );

  const portPick = relatedPorts.slice(0, 2);
  const shipPick = relatedShips.slice(0, 4);
  const blogPick = blogArticles.slice(0, 6);
  const visualPanel = buildFunVisualPanel('port', port, blogPick);

  const relatedPortLinks = portPick
    .map((p) => `<li><a href="/ports/${escapeHtml(p.slug)}/">${escapeHtml(p.name)}${p.country ? `, ${escapeHtml(p.country)}` : ''}</a></li>`)
    .join('');
  const relatedShipLinks = shipPick
    .map((s) => `<li><a href="/ships/${escapeHtml(s.slug)}/">${escapeHtml(s.name)}</a> <span style="color:rgba(255,255,255,0.45)">(${escapeHtml(s.cruise_line)})</span></li>`)
    .join('');
  const blogCards = buildArticleCards(blogPick, 'Port guide');

  const bodyForLd = `${prose.overview} ${prose.whatToDo} ${prose.cruiseRelevance}`;
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

  const heroImg = port.image_url
    ? `<img class="seo-hero-img" src="${escapeHtml(port.image_url)}" alt="${escapeHtml(h1)}" width="800" height="420" loading="eager" decoding="async">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="${opts.defaultImage}">
  <meta property="og:type" content="article">
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
  <style>${opts.indexStyles}${PAGE_STYLES}</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">${buildDirectoryHeaderNav()}</header>
    <main class="seo-detail container">
      ${heroImg}
      <h1>${escapeHtml(h1)}</h1>
      <p class="lead">${escapeHtml(port.region || 'Cruise destination')}</p>
      ${visualPanel}
      <h2>Overview</h2>
      <article class="seo-body">
        ${overviewParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
      </article>
      <h2>What to do</h2>
      <article class="seo-body">${whatParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>
      <ul>${things}</ul>
      <h2>Cruise relevance</h2>
      <article class="seo-body">${cruiseParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>
      <h2>Best time to visit</h2>
      <p class="seo-body">${escapeHtml(bestTime)}</p>
      <h2>Tips for travelers</h2>
      <article class="seo-body">${tipsParas.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}</article>
      <h2>Related ports</h2>
      <ul class="seo-cross-list">${relatedPortLinks || '<li><a href="/ports/">Browse ports</a></li>'}</ul>
      <h2>Ships to explore</h2>
      <ul class="seo-cross-list">${relatedShipLinks || '<li><a href="/ships/">Browse ships</a></li>'}</ul>
      ${moreOnSeaDaysInline()}
      <h2>More reading</h2>
      ${blogCards || '<ul class="seo-cross-list"><li><a href="/blog/">SeaDays blog</a></li></ul>'}
    </main>
    <footer class="footer">
      <div class="container">
        <div class="footer-bottom"><p>&copy; 2026 SeaDays</p></div>
      </div>
    </footer>
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<100;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  ${opts.runtimeGuardScript}
</body>
</html>`;
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
};
