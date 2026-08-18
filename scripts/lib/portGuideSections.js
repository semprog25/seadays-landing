'use strict';

/**
 * HTML section builders for the public SeaDays Port Guide (website only).
 * Information depth mirrors the app PortDetail guide; UI is web-editorial.
 */

const { PLAY_STORE_URL, APP_STORE_URL } = require('./seoFeatureLandingPages');

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

function listItems(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr
    .filter((x) => hasText(x))
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join('');
}

function dlRow(label, value) {
  if (!hasText(value) && value !== 0) return '';
  return `<div class="pg-fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
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
    'Read the full community reviews, answer traveler questions, and share your own experience in the SeaDays app.';
  const play = PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.seadays.app';
  const apple = APP_STORE_URL || 'https://apps.apple.com/app/id6759758357';
  return (
    `<aside class="pg-app-cta" aria-label="Continue in SeaDays">` +
    `<div class="pg-app-cta-copy"><strong>${escapeHtml(title)}</strong>` +
    `<p>${escapeHtml(body)}</p></div>` +
    `<div class="pg-app-cta-actions">` +
    `<a class="pg-btn pg-btn-primary" href="${escapeHtml(apple)}" target="_blank" rel="noopener noreferrer">Download on the App Store</a>` +
    `<a class="pg-btn" href="${escapeHtml(play)}" target="_blank" rel="noopener noreferrer">Get it on Google Play</a>` +
    `<a class="pg-btn pg-btn-ghost" href="/#download">Open SeaDays</a>` +
    `</div></aside>`
  );
}

function buildBookableExperiencesBanner(affiliate, portName) {
  if (!affiliate || !affiliate.show) return '';
  const name = portName || affiliate.destinationLabel || 'this port';
  const hasUrl = hasText(affiliate.url);
  const href = hasUrl
    ? affiliate.url
    : '/#download';
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

function buildGettingThereSection(guide) {
  if (!guide || !guide.gettingThere) return '';
  const g = guide.gettingThere;
  const transport = listItems(g.transportation);
  const rows =
    dlRow('From the terminal', g.fromTerminal) +
    dlRow('Distance to city', g.distanceToCity) +
    dlRow('Walking', g.walkingTime) +
    dlRow('Taxi', g.taxiInfo) +
    dlRow('Public transport', g.publicTransport);
  const list = transport ? `<p class="pg-label">Transportation options</p><ul>${transport}</ul>` : '';
  if (!rows && !list) return '';
  return section('Getting there', `<dl class="pg-facts">${rows}</dl>${list}`, 'getting-there');
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
  return section('Facts', `<dl class="pg-facts">${rows}</dl>${lists}`, 'facts');
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
  if (hasText(t.intro)) blocks.push(`<p class="pg-prose">${escapeHtml(t.intro)}</p>`);
  if (top) {
    blocks.push(`<p class="pg-label">Top things to do</p><ul>${top}</ul>`);
  }
  if (hasText(t.shortCall)) {
    blocks.push(
      `<p class="pg-label">Short call (about 4–5 hours ashore)</p><p class="pg-prose">${escapeHtml(t.shortCall)}</p>`
    );
  }
  if (hasText(t.standardCall)) {
    blocks.push(
      `<p class="pg-label">Standard call (about 6–8 hours ashore)</p><p class="pg-prose">${escapeHtml(t.standardCall)}</p>`
    );
  }
  if (hasText(t.longerCall)) {
    blocks.push(
      `<p class="pg-label">Longer call (8+ hours or overnight)</p><p class="pg-prose">${escapeHtml(t.longerCall)}</p>`
    );
  }
  if (hasText(t.practicalTip)) {
    blocks.push(
      `<p class="pg-label">Practical cruise tip</p><p class="pg-prose">${escapeHtml(t.practicalTip)}</p>`
    );
  }
  if (!blocks.length) return '';
  return section('Things to do', blocks.join('\n'), 'things-to-do');
}

function hasRichThingsToDo(guide) {
  const t = guide && guide.thingsToDo;
  if (!t || typeof t !== 'object') return false;
  return (
    (Array.isArray(t.topThings) && t.topThings.filter((x) => hasText(x)).length >= 3) ||
    hasText(t.standardCall) ||
    hasText(t.shortCall)
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

function buildTerminalsSection(terminals) {
  if (!Array.isArray(terminals) || !terminals.length) return '';
  const cards = terminals
    .map((t) => {
      const facilities = Array.isArray(t.facilities)
        ? t.facilities.filter((x) => typeof x === 'string').slice(0, 8)
        : [];
      const dist =
        t.distance_to_city_center_km != null && Number.isFinite(Number(t.distance_to_city_center_km))
          ? `${Number(t.distance_to_city_center_km)} km from city center`
          : '';
      const facHtml = facilities.length
        ? `<ul class="pg-tags">${facilities.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
        : '';
      const desc = hasText(t.description) ? `<p>${escapeHtml(t.description)}</p>` : '';
      const primary = t.is_primary ? `<span class="pg-pill">Primary</span>` : '';
      return (
        `<article class="pg-terminal-card">` +
        `<header><h3>${escapeHtml(t.name || 'Cruise terminal')}</h3>${primary}</header>` +
        `<p class="pg-meta">${escapeHtml(formatTerminalType(t.terminal_type))}${dist ? ` · ${escapeHtml(dist)}` : ''}</p>` +
        desc +
        facHtml +
        `</article>`
      );
    })
    .join('');
  return section('Cruise terminals', `<div class="pg-terminal-grid">${cards}</div>`, 'cruise-terminals');
}

function collectPortFaqItems(guide, portName) {
  const questions = [];
  if (guide?.gettingThere?.distanceToCity) {
    questions.push({
      q: `How far is ${portName} cruise terminal from the city center?`,
      a: guide.gettingThere.distanceToCity,
    });
  }
  if (guide?.gettingThere?.publicTransport || (guide?.gettingThere?.transportation || []).length) {
    questions.push({
      q: `What transport options are available from the ${portName} cruise port?`,
      a:
        guide.gettingThere.publicTransport ||
        (guide.gettingThere.transportation || []).join(', '),
    });
  }
  if (guide?.politics?.visaRequirements || guide?.politics?.entryRequirements) {
    questions.push({
      q: `What are the entry or visa requirements for ${portName}?`,
      a: [guide.politics.visaRequirements, guide.politics.entryRequirements].filter(Boolean).join(' '),
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

function buildTravelerQuestionsSection(guide, portName) {
  const questions = collectPortFaqItems(guide, portName);
  if (!questions.length) {
    return (
      section(
        'Traveler questions',
        `<p class="pg-prose">Cruisers ask about walking distance, taxis, and shore-day timing for ${escapeHtml(portName)}.</p>` +
          buildAppCommunityCta({
            title: 'Want to answer traveler questions?',
            body: 'Continue in the SeaDays app to join the conversation and help fellow cruisers.',
          }),
        'traveler-questions'
      )
    );
  }
  const cards = questions
    .slice(0, 6)
    .map(
      (item) =>
        `<article class="pg-qa-card">` +
        `<h3>${escapeHtml(item.q)}</h3>` +
        `<p>${escapeHtml(item.a)}</p>` +
        `<p class="pg-meta">Guide answer</p>` +
        `</article>`
    )
    .join('');
  return section(
    'Traveler questions',
    `<div class="pg-qa-grid">${cards}</div>` +
      buildAppCommunityCta({
        title: 'Want to answer this question?',
        body: 'Continue in the SeaDays app to share tips and join the port conversation.',
      }),
    'traveler-questions'
  );
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
.pg-section { margin: 40px 0 28px; }
.pg-section h2 { font-size: 24px; font-weight: 800; margin: 0 0 14px; color: #fff; }
.pg-section h3 { font-size: 17px; font-weight: 800; margin: 0 0 8px; color: #fff; }
.pg-prose { font-size: 17px; line-height: 1.75; color: rgba(255,255,255,0.88); margin: 0 0 14px; }
.pg-lead-guide { font-size: 18px; color: rgba(255,255,255,0.82); }
.pg-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.45); margin: 12px 0 8px; font-weight: 700; }
.pg-section#things-to-do ul { margin: 0 0 14px; padding-left: 1.2em; color: rgba(255,255,255,0.88); line-height: 1.65; }
.pg-section#things-to-do li { margin: 0 0 6px; }
.pg-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 12px 0 8px; }
.pg-fact { padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.pg-fact dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
.pg-fact dd { margin: 0; font-size: 15px; font-weight: 650; color: rgba(255,255,255,0.92); line-height: 1.45; }
.pg-terminal-grid, .pg-qa-grid { display: grid; gap: 14px; }
.pg-terminal-card, .pg-qa-card { padding: 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.pg-terminal-card header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.pg-meta { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 10px; }
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
@media (max-width: 720px) {
  .pg-facts, .pg-booking-banner { grid-template-columns: 1fr; }
  .pg-app-cta { flex-direction: column; align-items: flex-start; }
  .pg-app-cta-actions { width: 100%; }
  .pg-booking-cta { width: 100%; }
}
`;

function buildPortGuideEarlySectionsHtml({ port, guide, terminals, affiliate }) {
  const name = port?.name || guide?.portName || 'Port';
  return [
    buildGuideOverviewLead(guide),
    buildBookableExperiencesBanner(affiliate, name),
    buildWeatherBestSeasonBlock(guide),
    buildPortInfoSection(guide),
    buildTerminalsSection(terminals),
    buildGettingThereSection(guide),
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPortGuideLateSectionsHtml({ port, guide }) {
  const name = port?.name || guide?.portName || 'Port';
  return [
    buildClimateSection(guide),
    buildPoliticsSection(guide),
    buildFactsSection(guide),
    buildSizeSection(guide),
    buildTravelerQuestionsSection(guide, name),
    buildReviewsSection(port),
    buildAppCommunityCta({
      title: 'Plan this port day in SeaDays',
      body: 'Use the full Port Guide, community tips, and voyage tools in the SeaDays app.',
    }),
  ]
    .filter(Boolean)
    .join('\n');
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
  buildThingsToDoSection,
  hasRichThingsToDo,
  collectPortFaqItems,
};
