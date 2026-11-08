'use strict';

/**
 * HTML section builders for the public SeaDays Port Guide (website only).
 * Information depth mirrors the app PortDetail guide; UI is web-editorial.
 */

const { PLAY_STORE_URL, APP_STORE_URL, downloadPagePath, playStoreUrl, appStoreUrl } = require('./storeLinks');
const { LEAFLET_EDITORIAL_LINK_CSS } = require('./editorialLinkCss');
const {
  cleanPortCopy,
  createSentenceGate,
  filterHighlightList,
  splitSentences,
  loadWikipediaAttribution,
  wikipediaAttributionHtml,
} = require('./portCopyHygiene');
const { buildGuestReviewsSectionHtml } = require('./guestReviewsSection');
const { resolveTerminalVerifiedImage, buildTerminalCardPhotoHtml } = require('./terminalVerifiedImages');
const {
  filterActiveTerminalsForDisplay,
  collectTransitioningVisitorNotices,
} = require('./terminalOperationalStatus');
const {
  preparePassengerGuideText,
  quickFactGettingSummary,
  usesPassengerEditorialLead,
} = require('./publicGuideCopySanitize');

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Generic filler that must never render as if it were destination-specific fact. */
const PORT_GUIDE_BOILERPLATE_RE = [
  /^Established as a port in historical times$/i,
  /^An important maritime destination$/i,
  /^Handles cruise passengers and cargo vessels$/i,
  /^Handles cruise passengers and yachts$/i,
  /^Handles cruise passengers$/i,
  /^Welcomes cruise passengers throughout the year$/i,
  /^Welcomes cruise passengers during summer months$/i,
  /^Growing cruise destination$/i,
  /^Varies by location$/i,
  /^Major metropolitan city$/i,
  /^Major city$/i,
  /^Medium-sized (city|town)$/i,
  /^Small town$/i,
  /^Capital city$/i,
  /^Located in /i,
  /^Cruise terminal provides access to the local area$/i,
  /^Varies by terminal location$/i,
  /^10-30 minutes depending on terminal$/i,
  /^Taxis available at terminal$/i,
  /^Local transport options available$/i,
  /^Historic port area$/i,
  /^Local cultural attractions$/i,
  /^Scenic waterfront$/i,
  /^Rich local heritage$/i,
  /^Traditional architecture$/i,
  /^Cultural landmarks$/i,
];

function isPortGuideBoilerplate(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  return PORT_GUIDE_BOILERPLATE_RE.some((re) => re.test(s));
}

function honestFactValue(value) {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const s = preparePassengerGuideText(String(value).trim());
  if (!s || isPortGuideBoilerplate(s)) return '';
  return s;
}

function listItems(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr
    .map((x) => preparePassengerGuideText(x))
    .filter((x) => hasText(x) && !isPortGuideBoilerplate(x))
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join('');
}

function dlRow(label, value) {
  const shown = honestFactValue(value);
  if (!shown && value !== 0) return '';
  if (value === 0) return `<div class="pg-fact"><dt>${escapeHtml(label)}</dt><dd>0</dd></div>`;
  return `<div class="pg-fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(shown)}</dd></div>`;
}

function section(title, inner, id) {
  if (!inner || !String(inner).trim()) return '';
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  return `<section class="pg-section"${idAttr}><h2>${escapeHtml(title)}</h2>${inner}</section>`;
}

function buildAppCommunityCta(opts = {}) {
  const title = opts.title || 'Get more from your port guide';
  const body =
    opts.body ||
    'Planning this port day? Save itinerary notes, reviews, and shore-day details in SeaDays.';
  const play = PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.seadays.app';
  const apple = APP_STORE_URL || 'https://apps.apple.com/app/id6759758357';
  return (
    `<aside class="pg-app-cta" aria-label="Continue in SeaDays">` +
    `<div class="pg-app-cta-copy"><strong>${escapeHtml(title)}</strong>` +
    `<p>${escapeHtml(body)}</p></div>` +
    `<div class="pg-app-cta-actions">` +
    `<a class="pg-btn pg-btn-primary" href="${escapeHtml(downloadPagePath({ source: 'seadays_web', medium: 'port_guide', campaign: 'port_guide' }))}">Get SeaDays</a>` +
    `<a class="pg-btn" href="${escapeHtml(apple)}" target="_blank" rel="noopener noreferrer">App Store</a>` +
    `<a class="pg-btn pg-btn-ghost" href="${escapeHtml(play)}" target="_blank" rel="noopener noreferrer">Google Play</a>` +
    `</div></aside>`
  );
}

function buildBookableExperiencesBanner(affiliate, portName) {
  if (!affiliate || !affiliate.show) return '';
  const name = portName || affiliate.destinationLabel || 'this port';
  const hasUrl = hasText(affiliate.url);
  const href = hasUrl
    ? affiliate.url
    : downloadPagePath({ source: 'seadays_web', medium: 'port_guide', campaign: 'port_guide' });
  const ctaLabel = hasUrl ? 'Browse Experiences →' : 'Continue in SeaDays →';
  const rel = hasUrl ? 'noopener noreferrer sponsored' : 'noopener noreferrer';
  const target = hasUrl ? '_blank' : '_self';
  const note = hasUrl
    ? 'Secure checkout · Partner handled'
    : 'Book shore excursions in the SeaDays app with our partner';
  return (
    `<section class="pg-section pg-booking" id="bookable-experiences" aria-label="Bookable experiences">` +
    `<p class="pg-eyebrow">Bookable Experiences</p>` +
    `<div class="pg-booking-banner">` +
    `<div class="pg-booking-copy">` +
    `<span class="pg-booking-badge">Top Rated Experiences</span>` +
    `<h2>Explore experiences in ${escapeHtml(name)}</h2>` +
    `<p>Book shore excursions, tours &amp; activities with our partner</p>` +
    `<p class="pg-booking-trust">${escapeHtml(note)}</p>` +
    `</div>` +
    `<a class="pg-booking-cta" href="${escapeHtml(href)}" target="${target}" rel="${rel}">${escapeHtml(ctaLabel)}</a>` +
    `</div>` +
    `<p class="pg-affiliate-note">SeaDays may earn a commission from qualifying bookings made through partner links. Checkout, payment, and support are handled by the partner.</p>` +
    `</section>`
  );
}

function buildPortInfoSection(guide) {
  if (!guide) return '';
  const i = guide.portInfo || {};
  const rows =
    dlRow('Location', i.location) +
    dlRow('Timezone', i.timezone) +
    dlRow('Language', i.language) +
    dlRow('Currency', i.currency) +
    dlRow('Population', i.population);
  return section('Port information', rows ? `<dl class="pg-facts">${rows}</dl>` : '', 'port-information');
}

function buildClimateSection(guide) {
  if (!guide || !guide.climate) return '';
  const c = guide.climate;
  const rows =
    dlRow('Climate type', c.type) +
    dlRow('Average temperature', c.averageTemp) +
    dlRow('Humidity', c.humidity) +
    dlRow('Best months', Array.isArray(c.bestMonths) && c.bestMonths.length ? c.bestMonths.join(', ') : '') +
    dlRow('Rainy season', c.rainySeason);
  const desc = hasText(c.description) ? `<p class="pg-prose">${escapeHtml(c.description)}</p>` : '';
  if (!rows && !desc) return '';
  return section('Climate', `${desc}<dl class="pg-facts">${rows}</dl>`, 'climate');
}

function buildWeatherBestSeasonBlock(guide) {
  if (!guide || !guide.climate) return '';
  const c = guide.climate;
  if (!hasText(c.description) && !(c.bestMonths && c.bestMonths.length)) return '';
  const months =
    Array.isArray(c.bestMonths) && c.bestMonths.length
      ? `<p class="pg-prose"><strong>Best season:</strong> ${escapeHtml(c.bestMonths.join(', '))}</p>`
      : '';
  const summary = hasText(c.description)
    ? `<p class="pg-prose">${escapeHtml(c.description)}${hasText(c.averageTemp) ? ` Average temperature: ${escapeHtml(c.averageTemp)}.` : ''}</p>`
    : '';
  return section('Weather & best season', summary + months, 'weather-best-season');
}

function hasGuideArrivalCopy(guide) {
  const g = guide && guide.gettingThere;
  if (!g) return false;
  if (hasText(g.fromTerminal)) return true;
  if (hasText(g.publicTransport)) return true;
  if (hasText(g.distanceToCity)) return true;
  if (hasText(g.walkingTime)) return true;
  if (hasText(g.taxiInfo)) return true;
  return Array.isArray(g.transportation) && g.transportation.some((x) => hasText(x));
}

function buildGettingThereBodyHtml(guide) {
  if (!guide || !guide.gettingThere) return '';
  const scrub = (text) => preparePassengerGuideText(cleanPortCopy(text));
  const g = guide.gettingThere;
  const transport = listItems((g.transportation || []).map((x) => scrub(x)));
  const rows =
    dlRow('From the terminal', scrub(g.fromTerminal)) +
    dlRow('Distance to city', scrub(g.distanceToCity)) +
    dlRow('Walking', scrub(g.walkingTime)) +
    dlRow('Taxi', scrub(g.taxiInfo)) +
    dlRow('Public transport', scrub(g.publicTransport));
  const list = transport ? `<p class="pg-label">Transportation options</p><ul>${transport}</ul>` : '';
  if (!rows && !list) return '';
  return `<dl class="pg-facts">${rows}</dl>${list}`;
}

function buildGettingThereSection(guide) {
  const body = buildGettingThereBodyHtml(guide);
  if (!body) return '';
  return section('Getting there', body, 'getting-there');
}

function buildPoliticsSection(guide) {
  if (!guide || !guide.politics) return '';
  const p = guide.politics;
  const rows =
    dlRow('Government', p.governmentType) +
    dlRow('Stability', p.stability) +
    dlRow('Visa requirements', p.visaRequirements) +
    dlRow('Entry requirements', p.entryRequirements);
  return section('Politics & entry requirements', rows ? `<dl class="pg-facts">${rows}</dl>` : '', 'entry-requirements');
}

function buildFactsSection(guide) {
  if (!guide || !guide.facts) return '';
  const f = guide.facts;
  const rows = dlRow('Established', f.established) + dlRow('Significance', f.significance);
  const notable = listItems(f.notableFeatures);
  const cultural = listItems(f.culturalHighlights);
  const lists =
    (notable ? `<p class="pg-label">Notable features</p><ul>${notable}</ul>` : '') +
    (cultural ? `<p class="pg-label">Cultural context</p><ul>${cultural}</ul>` : '');
  if (!rows && !lists) return '';
  const dl = rows ? `<dl class="pg-facts">${rows}</dl>` : '';
  return section('Facts', `${dl}${lists}`, 'facts');
}

function buildCallPlanCard(kind, duration, title, body) {
  return (
    `<article class="pg-call-plan-card pg-call-plan-card--${kind}">` +
    `<header class="pg-call-plan-head">` +
    `<span class="pg-call-plan-icon" aria-hidden="true"></span>` +
    `<div class="pg-call-plan-titles">` +
    `<p class="pg-call-plan-duration">${escapeHtml(duration)}</p>` +
    `<h3 class="pg-call-plan-title">${escapeHtml(title)}</h3>` +
    `</div></header>` +
    `<p class="pg-call-plan-body">${escapeHtml(preparePassengerGuideText(body))}</p>` +
    `</article>`
  );
}

/**
 * Destination-specific shore-day guidance (replaces SEO template "Things to do" when present).
 * Expected guide.thingsToDo shape:
 *   { intro?, topThings[], shortCall?, standardCall?, longerCall?, practicalTip? }
 */
function buildThingsToDoSection(guide) {
  const t = guide && guide.thingsToDo;
  if (!t || typeof t !== 'object') return '';
  const top = listItems(t.topThings);
  const blocks = [];
  if (hasText(t.intro)) {
    blocks.push(`<p class="pg-prose pg-things-intro">${escapeHtml(preparePassengerGuideText(t.intro))}</p>`);
  }
  const callPlans = [];
  if (hasText(t.shortCall)) {
    callPlans.push(
      buildCallPlanCard('short', 'About 4–5 hours ashore', 'Short call', t.shortCall)
    );
  }
  if (hasText(t.standardCall)) {
    callPlans.push(
      buildCallPlanCard('standard', 'About 6–8 hours ashore', 'Standard call', t.standardCall)
    );
  }
  if (hasText(t.longerCall)) {
    callPlans.push(
      buildCallPlanCard('longer', '8+ hours or overnight', 'Longer call', t.longerCall)
    );
  }
  if (callPlans.length) {
    blocks.push(`<div class="pg-call-plans">${callPlans.join('\n')}</div>`);
  }
  if (top) {
    blocks.push(
      `<div class="pg-top-things">` +
        `<h3 class="pg-top-things-heading">Top things to do</h3>` +
        `<ul class="pg-top-things-list">${top}</ul>` +
        `</div>`
    );
  }
  if (hasText(t.practicalTip)) {
    blocks.push(
      `<aside class="pg-cruise-tip" aria-label="Practical cruise tip">` +
        `<p class="pg-cruise-tip-label">Practical cruise tip</p>` +
        `<p class="pg-cruise-tip-body">${escapeHtml(preparePassengerGuideText(t.practicalTip))}</p>` +
        `</aside>`
    );
  }
  if (!blocks.length) return '';
  return section('Things to do', `<div class="pg-things-layout">${blocks.join('\n')}</div>`, 'things-to-do');
}

function hasRichThingsToDo(guide) {
  const t = guide && guide.thingsToDo;
  if (!t || typeof t !== 'object') return false;
  return (
    (Array.isArray(t.topThings) && t.topThings.filter((x) => hasText(x)).length >= 3) ||
    hasText(t.standardCall) ||
    hasText(t.shortCall) ||
    hasText(t.longerCall)
  );
}

function buildSizeSection(guide) {
  if (!guide || !guide.size) return '';
  const s = guide.size;
  const rows =
    dlRow('Port capacity', s.portCapacity) +
    dlRow('Terminals', s.terminalCount != null ? String(s.terminalCount) : '') +
    dlRow('Berths', s.berthCount != null ? String(s.berthCount) : '') +
    dlRow('Annual visitors', s.annualVisitors) +
    dlRow('City size', s.citySize);
  return section('Size & capacity', rows ? `<dl class="pg-facts">${rows}</dl>` : '', 'size-capacity');
}

function formatTerminalType(t) {
  if (t === 'homeport') return 'Home port';
  if (t === 'transit') return 'Transit';
  if (t === 'both') return 'Home port & transit';
  return t || '';
}

function terminalDistanceLabel(km) {
  const n = Number(km);
  if (!Number.isFinite(n)) return '';
  return `${n} km from city center`;
}

/**
 * A distance shared by two or more terminals is unverified as a per-terminal fact.
 * Omit it. A distance that appears once can stay on that card.
 */
function distanceFrequency(terminals) {
  const counts = new Map();
  for (const t of terminals) {
    const label = terminalDistanceLabel(t && t.distance_to_city_center_km);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

function terminalPin(t) {
  const lat = Number(t && (t.latitude != null ? t.latitude : t.lat));
  const lon = Number(t && (t.longitude != null ? t.longitude : t.lon));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const label =
    `<strong>${escapeHtml(t.name || 'Cruise terminal')}</strong>` +
    (hasText(t.address) ? `<br>${escapeHtml(t.address)}` : '');
  const slug = hasText(t.slug) ? String(t.slug).trim() : '';
  return slug ? { lat, lon, label, slug } : { lat, lon, label };
}

function buildTerminalMapFocusHtml(t) {
  const lat = Number(t && (t.latitude != null ? t.latitude : t.lat));
  const lon = Number(t && (t.longitude != null ? t.longitude : t.lon));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !hasText(t && t.slug)) return '';
  return (
    `<p class="pg-meta"><button type="button" class="pg-terminal-map-focus" data-terminal-map-slug="${escapeHtml(String(t.slug))}">Show on map</button></p>`
  );
}

function buildOsmTerminalMap(terminals) {
  const active = filterActiveTerminalsForDisplay(terminals);
  const pins = active.map(terminalPin).filter(Boolean);
  if (!pins.length) return '';
  const payload = JSON.stringify(pins).replace(/</g, '\\u003c');
  return (
    `<div id="port-terminal-map" class="port-terminal-map" role="region" aria-label="Map of cruise terminals"></div>` +
    `<p class="pg-map-credit">Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">OpenStreetMap</a> contributors</p>` +
    `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin="anonymous">` +
    `<style>${LEAFLET_EDITORIAL_LINK_CSS}</style>` +
    `<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" crossorigin="anonymous"></script>` +
    `<script>(function(){` +
    `var el=document.getElementById('port-terminal-map');` +
    `if(!window.L||!el||el.dataset.ready)return;` +
    `el.dataset.ready='1';` +
    `var pins=${payload};` +
    `var icon=L.icon({iconUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',iconRetinaUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});` +
    `var map=L.map(el,{scrollWheelZoom:false});` +
    `L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);` +
    `var bounds=[];` +
    `var markersBySlug={};` +
    `pins.forEach(function(p){var m=L.marker([p.lat,p.lon],{icon:icon}).addTo(map).bindPopup(p.label);if(p.slug)markersBySlug[p.slug]=m;bounds.push([p.lat,p.lon]);});` +
    `if(bounds.length===1){map.setView(bounds[0],14);}else{var pad=window.innerWidth<480?[52,16]:[28,28];map.fitBounds(bounds,{padding:pad});}` +
    `var section=el.closest('section');` +
    `if(section){section.addEventListener('click',function(ev){var btn=ev.target.closest('[data-terminal-map-slug]');if(!btn)return;var mk=markersBySlug[btn.getAttribute('data-terminal-map-slug')];if(!mk)return;ev.preventDefault();map.setView(mk.getLatLng(),Math.max(map.getZoom(),16));mk.openPopup();el.scrollIntoView({block:'nearest'});});}` +
    `})();</script>`
  );
}

function berthLabel(t) {
  const n = Number(t && t.berth_count);
  if (!Number.isInteger(n) || n < 1) return '';
  return `${n} berth${n === 1 ? '' : 's'}`;
}

function transportOptions(t) {
  return (Array.isArray(t && t.transport_options) ? t.transport_options : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function terminalCardIsFilled(t, descText) {
  return hasText(t && t.address) || Boolean(berthLabel(t)) || transportOptions(t).length > 0 || hasText(descText);
}

function buildTerminalCardPrimaryBadge(isPrimary) {
  const pill = isPrimary ? '<span class="pg-pill">Primary</span>' : '';
  return `<div class="pg-terminal-card-badge-row">${pill}</div>`;
}

function buildTerminalCardBody(meta, address, transportHtml, desc) {
  return (
    (meta ? `<p class="pg-meta">${escapeHtml(meta)}</p>` : '') +
    address +
    transportHtml +
    desc
  );
}

function buildTerminalCardHtml(t, opts, gate) {
  const distLabel = terminalDistanceLabel(t.distance_to_city_center_km);
  const freq = opts.distanceFreq || new Map();
  const showDist = distLabel && freq.get(distLabel) === 1;
  const descText = gate(cleanPortCopy(t.description || ''));
  if (!terminalCardIsFilled(t, descText)) return '';
  const desc = hasText(descText) ? `<p class="pg-terminal-card-desc">${escapeHtml(descText)}</p>` : '';
  const meta = [formatTerminalType(t.terminal_type), berthLabel(t), showDist ? distLabel : ''].filter(Boolean).join(' · ');
  const address = hasText(t.address) ? `<p class="pg-meta">${escapeHtml(t.address)}</p>` : '';
  const transport = transportOptions(t);
  const transportHtml = transport.length
    ? `<p class="pg-meta">Transport: ${escapeHtml(transport.join(', '))}</p>`
    : '';
  const mapFocusHtml = buildTerminalMapFocusHtml(t);
  const portAppId = opts.portAppId || '';
  const verifiedImage = resolveTerminalVerifiedImage(t, portAppId);
  const photoHtml = verifiedImage ? buildTerminalCardPhotoHtml(verifiedImage) : '';
  const name = escapeHtml(t.name || 'Cruise terminal');
  const body = buildTerminalCardBody(meta, address, transportHtml + mapFocusHtml, desc);
  const badge = buildTerminalCardPrimaryBadge(t.is_primary);

  if (photoHtml) {
    return (
      `<article class="pg-terminal-card pg-terminal-card--has-photo" aria-labelledby="pg-terminal-${escapeHtml(String(t.slug || 'terminal'))}-title">` +
      badge +
      photoHtml +
      `<h3 class="pg-terminal-card-title" id="pg-terminal-${escapeHtml(String(t.slug || 'terminal'))}-title">${name}</h3>` +
      body +
      `</article>`
    );
  }

  const primaryInSummary = t.is_primary ? ` <span class="pg-pill">Primary</span>` : '';
  return (
    `<details class="pg-terminal-card" open>` +
    `<summary><span class="pg-terminal-card-title">${name}</span>${primaryInSummary}</summary>` +
    body +
    `</details>`
  );
}

function buildTransitioningNoticesHtml(terminals) {
  const notices = collectTransitioningVisitorNotices(terminals);
  if (!notices.length) return '';
  return notices
    .map(
      (text) =>
        `<p class="pg-prose pg-terminal-transition-notice" role="note">${escapeHtml(text)}</p>`
    )
    .join('');
}

function buildTerminalsSection(terminals, opts = {}) {
  const all = Array.isArray(terminals) ? terminals : [];
  const active = filterActiveTerminalsForDisplay(all);
  if (!all.length && !hasText(opts.logistics) && !hasGuideArrivalCopy(opts.guide)) return '';
  if (!all.length) {
    const editorial = hasGuideArrivalCopy(opts.guide) ? buildGettingThereBodyHtml(opts.guide) : '';
    if (editorial) {
      return section('Getting there & terminals', editorial, 'getting-there');
    }
    return section(
      'Getting there & terminals',
      `<p class="pg-prose">${escapeHtml(opts.logistics)}</p>`,
      'getting-there'
    );
  }
  const freq = distanceFrequency(active);
  const gate = typeof opts.gate === 'function' ? opts.gate : (s) => s;
  const cardOpts = { ...opts, distanceFreq: freq };
  const cards = active
    .map((t) => buildTerminalCardHtml(t, cardOpts, gate))
    .filter(Boolean)
    .join('');
  const logisticsHtml = hasText(opts.logistics) ? `<p class="pg-prose">${escapeHtml(opts.logistics)}</p>` : '';
  const transitionHtml = buildTransitioningNoticesHtml(all);
  const mapHtml = buildOsmTerminalMap(all);
  const body = `${logisticsHtml}${transitionHtml}${mapHtml}${cards ? `<div class="pg-terminal-grid">${cards}</div>` : ''}`;
  if (!body.replace(/\s/g, '')) {
    if (!hasText(opts.logistics)) return '';
    return section('Getting there & terminals', logisticsHtml, 'getting-there');
  }
  return section('Getting there & terminals', body, 'getting-there');
}

function prefixEachSentence(place, text, lead) {
  const clean = cleanPortCopy(text);
  if (!clean) return '';
  if (!place) return clean;
  const needle = String(place).toLowerCase();
  return splitSentences(clean)
    .map((sentence) => {
      if (sentence.toLowerCase().includes(needle)) return sentence;
      const body =
        lead === 'In' ? sentence.charAt(0).toLowerCase() + sentence.slice(1) : sentence;
      return `${lead} ${place}, ${body}`;
    })
    .join(' ');
}

function namedForPort(portName, text) {
  return prefixEachSentence(portName, text, 'For');
}

function collectPortFaqItems(guide, portName, portSlug) {
  const questions = [];
  const officialEntrySlugs = new Set(['hamburg-germany', 'aalborg-denmark', 'aarhus-denmark']);
  const skipPoliticsFaq =
    (portSlug && officialEntrySlugs.has(portSlug)) || portName === 'Hamburg' || portName === 'Aalborg';
  if (guide?.gettingThere?.distanceAnswer || guide?.gettingThere?.distanceToCity) {
    questions.push({
      q: `How far is ${portName} cruise terminal from the city center?`,
      a: namedForPort(portName, guide.gettingThere.distanceAnswer || guide.gettingThere.distanceToCity),
    });
  }
  if (guide?.gettingThere?.publicTransport || (guide?.gettingThere?.transportation || []).length) {
    questions.push({
      q: `What transport options are available from the ${portName} cruise port?`,
      a: namedForPort(
        portName,
        guide.gettingThere.publicTransport ||
          (guide.gettingThere.transportation || []).join(', ')
      ),
    });
  }
  if (!skipPoliticsFaq && (guide?.politics?.visaRequirements || guide?.politics?.entryRequirements)) {
    questions.push({
      q: `What are the entry or visa requirements for ${portName}?`,
      a: namedForPort(
        portName,
        [guide.politics.visaRequirements, guide.politics.entryRequirements].filter(Boolean).join(' ')
      ),
    });
  }
  if (guide?.climate?.bestMonths?.length) {
    questions.push({
      q: `When is the best time to visit ${portName} on a cruise?`,
      a: `Best months: ${guide.climate.bestMonths.join(', ')}. ${guide.climate.description || ''}`.trim(),
    });
  }
  return questions
    .map((item) => ({
      q: String(item.q || '').trim(),
      a: String(item.a || '').trim(),
    }))
    .filter((item) => item.q && item.a)
    .slice(0, 6);
}

function clipFaqAnswer(text) {
  const clean = preparePassengerGuideText(cleanPortCopy(text));
  if (!clean) return '';
  const first = clean.split(/(?<=[.!?])\s+/)[0] || clean;
  if (first.length <= 220) return first;
  return `${first.slice(0, 217).replace(/\s+\S*$/, '').trim()}…`;
}

function buildTravelerQuestionsSection(guide, portName, opts = {}) {
  const gate = typeof opts.gate === 'function' ? opts.gate : (s) => s;
  const questions = collectPortFaqItems(guide, portName, opts.portSlug)
    .map((item) => {
      const clipped = clipFaqAnswer(item.a);
      return { q: item.q, a: gate(clipped) };
    })
    .filter((item) => item.q && item.a)
    .slice(0, 3);
  if (!questions.length) {
    return section(
      'Traveler questions',
      `<p class="pg-prose">Cruisers ask about walking distance, taxis, and shore-day timing for ${escapeHtml(portName)}.</p>`,
      'traveler-questions'
    );
  }
  const cards = questions
    .slice(0, 4)
    .map(
      (item) =>
        `<article class="pg-qa-card">` +
        `<h3>${escapeHtml(item.q)}</h3>` +
        `<p>${escapeHtml(item.a)}</p>` +
        `</article>`
    )
    .join('');
  return section('Traveler questions', `<div class="pg-qa-grid">${cards}</div>`, 'traveler-questions');
}

function buildReviewsSection(port) {
  const rating = Number(port?.rating);
  const count = Number(port?.reviewCount);
  const hasAgg = Number.isFinite(rating) && rating > 0 && Number.isFinite(count) && count > 0;
  const summary = hasAgg
    ? `<p class="pg-prose"><strong>${escapeHtml(rating.toFixed(1))}/5</strong> from ${escapeHtml(String(Math.round(count)))} public review${count === 1 ? '' : 's'}.</p>` +
      `<p class="pg-prose">Preview: cruisers rate shore-day logistics, walkability, and overall port experience for ${escapeHtml(port.name || 'this port')}.</p>`
    : `<p class="pg-prose">Public community reviews for ${escapeHtml(port.name || 'this port')} live in the SeaDays app.</p>`;
  return section(
    'Reviews',
    summary +
      buildAppCommunityCta({
        title: 'Continue in SeaDays',
        body: 'Download the app to read full reviews, share your experience, and join the conversation.',
      }),
    'reviews'
  );
}

function buildGuideOverviewLead(guide) {
  if (!guide?.portInfo?.description) return '';
  return `<p class="pg-prose pg-lead-guide">${escapeHtml(guide.portInfo.description)}</p>`;
}

const PORT_GUIDE_STYLES = `
.pg-section { margin: 40px 0 28px; scroll-margin-top: 72px; }
.pg-section h2 { font-size: 24px; font-weight: 800; margin: 0 0 14px; color: #fff; }
.pg-section h3 { font-size: 17px; font-weight: 800; margin: 0 0 8px; color: #fff; }
.pg-prose { font-size: 17px; line-height: 1.75; color: rgba(255,255,255,0.88); margin: 0 0 14px; }
.pg-lead-guide { font-size: 18px; color: rgba(255,255,255,0.82); }
.pg-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.45); margin: 12px 0 8px; font-weight: 700; }
.pg-things-layout { display: grid; gap: 18px; }
.pg-things-intro { margin-bottom: 0; }
.pg-call-plans { display: grid; gap: 12px; }
@media (min-width: 900px) { .pg-call-plans { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pg-call-plan-card { padding: 16px 16px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.pg-call-plan-card--short { border-top: 3px solid rgba(34,211,238,0.75); }
.pg-call-plan-card--standard { border-top: 3px solid rgba(255,0,51,0.55); }
.pg-call-plan-card--longer { border-top: 3px solid rgba(255,255,255,0.35); }
.pg-call-plan-head { display: flex; align-items: flex-start; gap: 12px; }
.pg-call-plan-icon { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 12px; background: rgba(6,182,212,0.14); border: 1px solid rgba(34,211,238,0.35); position: relative; }
.pg-call-plan-icon::after { content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -9px 0 0 -7px; border: 2px solid rgba(255,255,255,0.82); border-radius: 50%; box-sizing: border-box; }
.pg-call-plan-icon::before { content: ''; position: absolute; left: 50%; top: 50%; width: 2px; height: 6px; margin: -8px 0 0 -1px; background: rgba(255,255,255,0.82); border-radius: 1px; }
.pg-call-plan-duration { margin: 0 0 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.48); }
.pg-call-plan-title { margin: 0; font-size: 16px; font-weight: 800; line-height: 1.25; color: #fff; }
.pg-call-plan-body { margin: 0; font-size: 14px; line-height: 1.58; color: rgba(255,255,255,0.86); }
.pg-top-things { padding: 16px 16px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
.pg-top-things-heading { margin: 0 0 12px; font-size: 15px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(255,255,255,0.92); }
.pg-top-things-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.pg-top-things-list li { position: relative; padding-left: 18px; font-size: 14px; line-height: 1.48; color: rgba(255,255,255,0.88); }
.pg-top-things-list li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,0,51,0.85); box-shadow: 0 0 0 3px rgba(255,0,51,0.12); }
.pg-cruise-tip { margin: 0; padding: 16px 18px; border-radius: 16px; border: 1px solid rgba(34,211,238,0.35); border-left: 4px solid #22d3ee; background: linear-gradient(120deg, rgba(6,182,212,0.16), rgba(255,255,255,0.03)); }
.pg-cruise-tip-label { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #22d3ee; }
.pg-cruise-tip-body { margin: 0; font-size: 16px; line-height: 1.65; color: rgba(255,255,255,0.92); font-weight: 650; }
.pg-section#things-to-do ul:not(.pg-top-things-list) { margin: 0 0 14px; padding-left: 1.2em; color: rgba(255,255,255,0.88); line-height: 1.65; }
.pg-section#things-to-do li:not(.pg-top-things-list li) { margin: 0 0 6px; }
.seo-detail .pg-section .pg-prose a.pg-editorial-link,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download) { color: #79D8FF; font-weight: 650; text-decoration: underline; text-decoration-color: rgba(121,216,255,0.45); text-underline-offset: 3px; }
.seo-detail .pg-section .pg-prose a.pg-editorial-link:visited,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):visited { color: #9ae4ff; }
.seo-detail .pg-section .pg-prose a.pg-editorial-link:hover,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):hover { color: #a8e8ff; text-decoration-color: rgba(168,232,255,0.75); }
.seo-detail .pg-section .pg-prose a.pg-editorial-link:focus-visible,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):focus-visible { outline: 2px solid #79D8FF; outline-offset: 3px; border-radius: 4px; }
.pg-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 12px 0 8px; }
.pg-fact { padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.pg-fact dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
.pg-fact dd { margin: 0; font-size: 15px; font-weight: 650; color: rgba(255,255,255,0.92); line-height: 1.45; }
.pg-terminal-grid, .pg-qa-grid { display: grid; gap: 14px; align-items: stretch; grid-template-columns: 1fr; }
.pg-terminal-card, .pg-qa-card { padding: 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-family: Inter, system-ui, sans-serif; font-weight: 400; min-height: 0; }
.pg-terminal-card--has-photo { display: flex; flex-direction: column; height: 100%; padding: 18px; }
.pg-terminal-card-badge-row { margin: 0 0 12px; min-height: 26px; display: flex; align-items: flex-start; flex: 0 0 auto; }
.pg-terminal-card-title { margin: 0 0 10px; font-size: 17px; font-weight: 700; line-height: 1.4; letter-spacing: normal; color: #fff; flex: 0 0 auto; }
.pg-terminal-card:not(.pg-terminal-card--has-photo) > summary .pg-terminal-card-title { font-size: 17px; font-weight: 700; }
.pg-terminal-card > p { display: block; margin: 0 0 10px; }
.pg-terminal-card-desc { font-size: 16px; font-weight: 400; line-height: 1.65; color: rgba(255,255,255,0.88); margin: 0 0 4px !important; flex: 1 1 auto; }
.pg-terminal-card summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; cursor: pointer; font-weight: 700; color: #fff; list-style: none; line-height: 1.4; }
.pg-terminal-card summary::-webkit-details-marker { display: none; }
.pg-terminal-card-photo { margin: 0 0 14px; border-radius: 12px; overflow: hidden; aspect-ratio: 3 / 2; width: 100%; flex: 0 0 auto; background: rgba(255,255,255,0.06); }
.pg-terminal-card-photo img { display: block; width: 100%; height: 100%; object-fit: cover; aspect-ratio: 3 / 2; }
.pg-terminal-card-photo figcaption { margin: 0; padding: 8px 10px; min-height: 40px; box-sizing: border-box; font-size: 11px; line-height: 1.4; color: rgba(255,255,255,0.55); background: rgba(0,0,0,0.35); }
.pg-terminal-card-photo figcaption a { color: #79D8FF; font-weight: 650; text-decoration: underline; text-decoration-color: rgba(121,216,255,0.45); text-underline-offset: 3px; }
.pg-terminal-card-photo figcaption a:hover { color: #a8e8ff; }
@media (min-width: 1100px) {
  .seo-detail-wide .pg-terminal-grid { align-items: stretch; }
  .seo-detail-wide .pg-terminal-grid > .pg-terminal-card--has-photo {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .seo-detail-wide .pg-terminal-grid .pg-terminal-card-photo { flex-shrink: 0; }
  .seo-detail-wide .pg-terminal-grid .pg-terminal-card-desc { flex: 1 1 auto; }
}
.port-jump { display: flex; gap: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 0 18px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
.port-jump a { color: rgba(255,255,255,0.78); font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
.port-jump a:hover { color: #fff; }
.port-jump a:focus-visible { outline: 2px solid rgba(6,182,212,0.85); outline-offset: 3px; border-radius: 4px; }
.pg-quick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.port-terminal-map { height: 380px; margin: 0 0 8px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); z-index: 1; }
.pg-terminal-map-focus { display: inline-flex; align-items: center; min-height: 44px; margin: 0; padding: 0; border: 0; background: none; font: inherit; font-size: 15px; font-weight: 600; color: #79D8FF; text-decoration: underline; cursor: pointer; }
.pg-terminal-map-focus:focus-visible { outline: 2px solid rgba(6,182,212,0.85); outline-offset: 3px; border-radius: 4px; }
.pg-map-credit { font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.55); margin: 0 0 14px; }
.pg-map-credit a { color: #79D8FF; font-weight: 650; text-decoration: underline; text-decoration-color: rgba(121,216,255,0.45); text-underline-offset: 3px; }
.pg-map-credit a:hover { color: #a8e8ff; }
.pg-meta { font-size: 15px; font-weight: 400; line-height: 1.55; letter-spacing: normal; color: rgba(255,255,255,0.62); margin: 0 0 8px; flex: 0 0 auto; }
.pg-terminal-card .pg-meta { color: rgba(255,255,255,0.68); }
.pg-pill { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; background: rgba(6,182,212,0.18); border: 1px solid rgba(6,182,212,0.45); color: #fff; }
.pg-tags { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; padding: 0; }
.pg-tags li { font-size: 12px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
.pg-eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(16,185,129,0.95); margin: 0 0 10px; }
.pg-booking-banner { display: grid; grid-template-columns: 1.4fr auto; gap: 18px; align-items: center; padding: 22px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.35); background: linear-gradient(120deg, rgba(6,95,70,0.55), rgba(6,182,212,0.18) 55%, rgba(255,255,255,0.04)); box-shadow: 0 18px 50px rgba(0,0,0,0.28); }
.pg-booking-badge { display: inline-flex; margin-bottom: 10px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; background: rgba(16,185,129,0.22); border: 1px solid rgba(16,185,129,0.45); }
.pg-booking-copy h2 { margin: 0 0 8px; font-size: 26px; }
.pg-booking-copy p { margin: 0 0 8px; color: rgba(255,255,255,0.86); }
.pg-booking-trust { font-size: 13px; color: rgba(255,255,255,0.65) !important; }
.pg-booking-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 12px 18px; border-radius: 999px; font-weight: 800; text-decoration: none; color: #042f2e; background: linear-gradient(90deg, #34d399, #22d3ee); white-space: nowrap; }
.pg-booking-cta:hover { filter: brightness(1.05); }
.pg-affiliate-note { margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; }
.pg-app-cta { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 18px 0 8px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(6,182,212,0.07); }
.pg-app-cta strong { display: block; font-size: 15px; margin-bottom: 4px; }
.pg-app-cta p { margin: 0; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; }
.pg-app-cta-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.pg-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; text-decoration: none; color: #fff; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
.pg-btn-primary { background: rgba(255,0,51,0.2); border-color: rgba(255,0,51,0.45); }
.pg-btn-ghost { background: transparent; }
.pg-btn:hover { border-color: rgba(255,0,51,0.7); }
.pg-breadcrumbs { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 18px; }
.pg-breadcrumbs a { color: rgba(255,255,255,0.75); text-decoration: none; }
.pg-breadcrumbs a:hover { color: var(--neon-red); }
.pg-section#weather-best-time { margin-top: 36px; }
.pg-section#weather-best-time .pg-prose { margin-bottom: 10px; }
.pg-section#weather-best-time .pg-facts { margin-top: 6px; margin-bottom: 0; }
.pg-section#entry-requirements { margin-top: 32px; }
.pg-section#entry-requirements .pg-prose { margin-bottom: 0; padding: 16px 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
@media (max-width: 720px) {
  .pg-facts, .pg-booking-banner { grid-template-columns: 1fr; }
  .pg-app-cta { flex-direction: column; align-items: flex-start; }
  .pg-app-cta-actions { width: 100%; }
  .pg-booking-cta { width: 100%; }
  .pg-terminal-grid { align-items: stretch; }
  .pg-terminal-card--has-photo { height: auto; }
}
`;

function firstSentence(text, maxLen) {
  const cleaned = cleanPortCopy(text);
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || '';
  if (!maxLen || sentence.length <= maxLen) return sentence;
  return `${sentence.slice(0, maxLen - 1).trim()}…`;
}

function wordList(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean);
}

function cityLabel(name) {
  const cleaned = String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .split('/')[0]
    .replace(/,\s*[A-Z]{2}\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || String(name || 'this port').trim();
}

function terminalBerthTotal(terminals) {
  if (!Array.isArray(terminals) || !terminals.length) return '';
  let sum = 0;
  for (const t of terminals) {
    const n = Number(t && t.berth_count);
    if (!Number.isInteger(n) || n < 1) return '';
    sum += n;
  }
  return String(sum);
}

function buildQuickFactsSection({ port, guide, terminals, isHomeport, gate }) {
  const filter = typeof gate === 'function' ? gate : (s) => s;
  const info = (guide && guide.portInfo) || {};
  const climate = (guide && guide.climate) || {};
  const months = Array.isArray(climate.bestMonths) && climate.bestMonths.length
    ? climate.bestMonths.join(', ')
    : Array.isArray(port?.popularMonths) && port.popularMonths.length
      ? port.popularMonths.join(', ')
      : '';
  const getting = filter(quickFactGettingSummary(guide) || firstSentence(guide?.gettingThere?.distanceToCity || '', 120));
  const passengers = honestFactValue(guide?.size?.publishedPassengers || '');
  const rows = [
    ['Port type', isHomeport ? 'Home port' : 'Port call'],
    ['Country', port?.country || ''],
    ['Region', port?.region || ''],
    ['Terminals', Array.isArray(terminals) && terminals.length ? String(terminals.length) : ''],
    ['Berths', terminalBerthTotal(terminals)],
    ['Cruise passengers', passengers],
    ['Getting to the city', getting],
    ['Currency', info.currency || ''],
    ['Language', info.language || ''],
    ['Best months', months],
  ]
    .filter(([, value]) => hasText(value))
    .map(
      ([label, value]) =>
        `<div class="pg-fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )
    .join('');
  if (!rows) return '';
  return section('Quick facts', `<dl class="pg-facts pg-quick">${rows}</dl>`, 'quick-facts');
}

function buildPrivateIslandNote() {
  return (
    `<section class="pg-section pg-booking" id="bookable-experiences" aria-label="Shore excursions">` +
    `<h2>Shore excursions</h2>` +
    `<p class="pg-prose">Excursions are sold by your cruise line.</p>` +
    `</section>`
  );
}

function buildExperiencesSection(affiliate, portName) {
  if (affiliate && affiliate.privateIsland) return buildPrivateIslandNote();
  return buildBookableExperiencesBanner(affiliate, portName);
}

const THINGS_PROSE_WORD_CAP = 80;

function buildCappedThingsSection(guide, port, gate) {
  if (hasRichThingsToDo(guide)) {
    return buildThingsToDoSection(guide);
  }
  const filter = typeof gate === 'function' ? gate : (s) => s;
  const city = cityLabel(port?.name || guide?.portName || 'this port');
  const t = guide && guide.thingsToDo && typeof guide.thingsToDo === 'object' ? guide.thingsToDo : null;
  const blocks = [];
  if (t) {
    const labeled = [
      { priority: 3, order: 1, label: '', text: t.intro },
      { priority: 2, order: 3, label: 'Short call (about 4–5 hours ashore)', text: t.shortCall },
      { priority: 1, order: 4, label: 'Standard call (about 6–8 hours ashore)', text: t.standardCall },
      { priority: 5, order: 5, label: 'Longer call (8+ hours or overnight)', text: t.longerCall },
      { priority: 4, order: 6, label: 'Practical cruise tip', text: t.practicalTip },
    ];
    const chosen = [];
    let words = 0;
    const uncapped = guide && guide.shorePlansFirst === true;
    for (const block of labeled.slice().sort((a, b) => a.priority - b.priority)) {
      const raw = cleanPortCopy(block.text || '');
      const count = wordList(raw).length;
      if (!count) continue;
      if (!uncapped && words + count > THINGS_PROSE_WORD_CAP) continue;
      const text = filter(raw);
      if (!text) continue;
      words += wordList(text).length;
      chosen.push({ ...block, text });
    }
    chosen.sort((a, b) => a.order - b.order);
    for (const block of chosen) {
      if (block.label) blocks.push(`<p class="pg-label">${escapeHtml(block.label)}</p>`);
      blocks.push(`<p class="pg-prose">${escapeHtml(block.text)}</p>`);
    }
    const bullets = (Array.isArray(t.topThings) ? t.topThings : [])
      .map((item) => filter(cleanPortCopy(item)))
      .filter((item) => hasText(item) && !/^[.]$/.test(item));
    if (bullets.length) {
      blocks.push(
        `<p class="pg-label">Top things to do</p><ul>${bullets
          .slice(0, 6)
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul>`
      );
    }
  }
  if (!blocks.length) {
    const highlights = filterHighlightList(port?.highlights, port?.description)
      .map((item) => filter(item))
      .filter((item) => hasText(item))
      .slice(0, 6);
    const fallback = filter(`For a shore day in ${city}, choose one main activity and leave time to get back to the ship.`);
    if (fallback) blocks.push(`<p class="pg-prose">${escapeHtml(fallback)}</p>`);
    if (highlights.length) {
      blocks.push(`<ul>${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    }
  }
  if (!blocks.length) return '';
  return section('Things to do', blocks.join('\n'), 'things-to-do');
}

function buildWeatherMergedSection(guide, port, gate) {
  const filter = typeof gate === 'function' ? gate : (s) => s;
  const c = guide && guide.climate ? guide.climate : null;
  const months =
    c && Array.isArray(c.bestMonths) && c.bestMonths.length
      ? c.bestMonths.join(', ')
      : Array.isArray(port?.popularMonths) && port.popularMonths.length
        ? port.popularMonths.join(', ')
        : '';
  const rawDesc = c ? cleanPortCopy(c.description || '') : '';
  const city = cityLabel(port?.name || (guide && guide.portName) || '');
  const desc = rawDesc ? filter(prefixEachSentence(city, rawDesc, 'In')) : '';
  const temp =
    c && hasText(c.averageTemp)
      ? filter(
          city ? `Average temperature in ${city}: ${c.averageTemp}.` : `Average temperature: ${c.averageTemp}.`
        )
      : '';
  const monthLine = months ? filter(`Best months: ${months}.`) : '';
  const prose = [desc, temp, monthLine].filter(Boolean);
  if (!prose.length && !months) return '';
  const rows =
    (c && hasText(c.type) ? `<div class="pg-fact"><dt>Climate</dt><dd>${escapeHtml(c.type)}</dd></div>` : '') +
    (months ? `<div class="pg-fact"><dt>Best months</dt><dd>${escapeHtml(months)}</dd></div>` : '');
  const paras = prose.map((p) => `<p class="pg-prose">${escapeHtml(p)}</p>`).join('');
  const dl = rows ? `<dl class="pg-facts">${rows}</dl>` : '';
  return section('Weather & best time', `${paras}${dl}`, 'weather-best-time');
}

function buildEntryCollapsedSection(guide, gate, cityName, port) {
  if (port && port.slug === 'hamburg-germany') {
    return section(
      'Entry & documents',
      `<p class="pg-prose">Germany is in the Schengen Area. Which passport or visa you need depends on your nationality. SeaDays does not set those rules. Check the <a class="pg-editorial-link" href="https://www.auswaertiges-amt.de/en/visa-service" target="_blank" rel="noopener noreferrer">German Federal Foreign Office</a> and the <a class="pg-editorial-link" href="https://home-affairs.ec.europa.eu/policies/schengen/visa-policy_en" target="_blank" rel="noopener noreferrer">European Commission visa policy</a> page before you travel.</p>`,
      'entry-requirements'
    );
  }
  if (port && (port.slug === 'aalborg-denmark' || port.slug === 'aarhus-denmark')) {
    return section(
      'Entry & documents',
      `<p class="pg-prose">Denmark is in the Schengen Area. Which passport or visa you need depends on your nationality and how you arrive. SeaDays does not set those rules. Check <a class="pg-editorial-link" href="https://um.dk/en/travel-and-residence" target="_blank" rel="noopener noreferrer">Denmark’s official travel information</a> and the <a class="pg-editorial-link" href="https://home-affairs.ec.europa.eu/policies/schengen/visa-policy_en" target="_blank" rel="noopener noreferrer">European Commission visa policy</a> page before you travel.</p>`,
      'entry-requirements'
    );
  }
  const filter = typeof gate === 'function' ? gate : (s) => s;
  const p = guide && guide.politics ? guide.politics : null;
  if (!p) return '';
  const city = cityLabel(cityName || '');
  const withCity = (text) => prefixEachSentence(city, text, 'For');
  const visa = filter(withCity(p.visaRequirements || ''));
  const entry = filter(withCity(p.entryRequirements || ''));
  const parts = [visa, entry].filter(Boolean);
  if (!parts.length) return '';
  const body = parts.map((part) => `<p class="pg-prose">${escapeHtml(part)}</p>`).join('');
  return section(
    'Entry & documents',
    `<details class="pg-terminal-card"><summary><span>Documents and entry rules</span></summary>${body}</details>`,
    'entry-requirements'
  );
}

function buildSinglePortAppPrompt(city) {
  const label = cityLabel(city);
  const tracking = {
    source: 'seadays_web',
    medium: 'port_guide',
    campaign: 'port_single_cta',
    content: 'port_single_cta',
  };
  const apple = appStoreUrl(tracking);
  const play = playStoreUrl(tracking);
  return (
    `<aside class="pg-app-cta" id="plan-port-day" aria-label="Plan this port day in SeaDays">` +
    `<div class="pg-app-cta-copy"><strong>Plan your ${escapeHtml(label)} port day in SeaDays.</strong>` +
    `<p>Read cruiser reviews, ask questions and save this port to your voyage. Free to use, with optional paid upgrades.</p></div>` +
    `<div class="pg-app-cta-actions">` +
    `<a class="pg-btn" href="${escapeHtml(apple)}" target="_blank" rel="noopener noreferrer">App Store</a>` +
    `<a class="pg-btn pg-btn-ghost" href="${escapeHtml(play)}" target="_blank" rel="noopener noreferrer">Google Play</a>` +
    `</div></aside>`
  );
}

function portCallsAsHomeport(port, terminals) {
  if (port && port.isHomeport === true) return true;
  return (Array.isArray(terminals) ? terminals : []).some((t) => {
    const type = String(t && t.terminal_type ? t.terminal_type : '').toLowerCase();
    return type === 'homeport' || type === 'both' || type.includes('embark');
  });
}

function buildPhase1GuideHtml({ port, guide, terminals, affiliate }) {
  const name = port?.name || (guide && guide.portName) || 'Port';
  const city = cityLabel(name);
  const gate = createSentenceGate();
  const isHomeport = portCallsAsHomeport(port, terminals);
  const lead = gate(cleanPortCopy((guide && guide.portInfo && guide.portInfo.description) || ''));
  const skipDatasetWikiOverview = Boolean(lead && usesPassengerEditorialLead(guide));
  const extra = skipDatasetWikiOverview ? '' : gate(cleanPortCopy(port?.overviewText || ''));
  const attribution =
    !skipDatasetWikiOverview && (lead || extra)
      ? wikipediaAttributionHtml(loadWikipediaAttribution()[port && port.slug])
      : '';
  const logistics = gate(
    isHomeport
      ? `Embarkation from ${city} can simplify flight planning when airports and hotels align.`
      : `On a call at ${city}, confirm the pier, shuttle, and all-aboard time before you leave the ship.`
  );
  const things = buildCappedThingsSection(guide, port, gate);
  const shoreFirst = Boolean(guide && guide.shorePlansFirst);
  return [
    lead ? `<p class="pg-prose pg-lead-guide">${escapeHtml(lead)}</p>` : '',
    extra ? `<p class="pg-prose">${escapeHtml(extra)}</p>` : '',
    attribution,
    shoreFirst ? things : '',
    buildQuickFactsSection({ port, guide, terminals, isHomeport, gate }),
    buildGuestReviewsSectionHtml(port),
    buildExperiencesSection(affiliate, city),
    buildTerminalsSection(terminals, { gate, logistics, portAppId: port?.appPortId || '', guide }),
    shoreFirst ? '' : things,
    buildWeatherMergedSection(guide, port, gate),
    buildEntryCollapsedSection(guide, gate, city, port),
    buildTravelerQuestionsSection(guide, city, { gate, portSlug: port?.slug }),
    buildSinglePortAppPrompt(city),
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPortGuideEarlySectionsHtml(args) {
  return buildPhase1GuideHtml(args);
}

function buildPortGuideLateSectionsHtml() {
  return '';
}

function buildPortGuideSectionsHtml(args) {
  return `${buildPortGuideEarlySectionsHtml(args)}\n${buildPortGuideLateSectionsHtml(args)}`;
}

function buildBreadcrumbsHtml(port) {
  const label = port.country ? `${port.name}, ${port.country}` : port.name;
  return (
    `<nav class="pg-breadcrumbs" aria-label="Breadcrumb">` +
    `<a href="/">Home</a> / <a href="/ports/">Ports</a> / <span>${escapeHtml(label)}</span>` +
    `</nav>`
  );
}

function buildBreadcrumbJsonLd(port, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://seadays.app/' },
      { '@type': 'ListItem', position: 2, name: 'Ports', item: 'https://seadays.app/ports/' },
      { '@type': 'ListItem', position: 3, name: port.country ? `${port.name}, ${port.country}` : port.name, item: canonical },
    ],
  };
}

module.exports = {
  escapeHtml,
  PORT_GUIDE_STYLES,
  buildPortGuideSectionsHtml,
  buildPortGuideEarlySectionsHtml,
  buildPortGuideLateSectionsHtml,
  buildBookableExperiencesBanner,
  buildAppCommunityCta,
  buildBreadcrumbsHtml,
  buildBreadcrumbJsonLd,
  buildTerminalsSection,
  buildOsmTerminalMap,
  buildThingsToDoSection,
  hasRichThingsToDo,
  collectPortFaqItems,
  buildPhase1GuideHtml,
  buildSinglePortAppPrompt,
  portCallsAsHomeport,
  cityLabel,
  distanceFrequency,
};
