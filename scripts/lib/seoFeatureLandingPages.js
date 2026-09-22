'use strict';

const { getAnalyticsHeadHtml } = require('./analyticsSnippet');
const { getFaviconHeadHtml } = require('./faviconHead');
const { PLAY_STORE_URL, APP_STORE_URL, downloadPagePath } = require('./storeLinks');
const { GUIDE_BY_SLUG } = require('./featureLandingGuideContent');
const { getSiteHeaderHtml, getSiteFooterHtml, getSiteShellCssLinkHtml } = require('./siteShell');
const BASE_URL = 'https://seadays.app';
const LOGO_URL = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadays.png';
const FAVICON_URL = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';
const OG_IMAGE = 'https://seadays.app/og-image.png';

const FEATURE_PAGES_RAW = [
  {
    slug: 'cruise-roll-calls',
    title: 'Cruise Roll Call App',
    h1: 'Join Your Sailing Roll Call Before You Board',
    subtitle:
      'Find cruisers on your exact ship and sail date, introduce yourself, coordinate excursions, and meet fellow guests with the SeaDays cruise roll call app.',
    readingLead: [
      'A cruise roll call is a group for one ship on one sail date. It is where you introduce yourself, ask a question someone on that week can answer, and agree on a meetup before the pier gets loud. It is not the cruise line’s official channel, and it is not a place to post cabin numbers or booking codes.',
      'The notes below are the parts that make a roll call useful: what to say first, what to settle before money changes hands, and how to keep a shared excursion from missing all-aboard. You can follow them in any group chat. SeaDays is one place that keeps the thread attached to the sailing.',
    ],
    primaryKeyword: 'cruise roll call app',
    metaDescription:
      'Join cruise roll calls by ship and sailing date. Meet fellow cruisers, plan meetups, and coordinate excursions with SeaDays—the modern cruise roll call app.',
    ctaLabel: 'Join Your Sailing Roll Call',
    bullets: [
      'Roll calls matched to your ship and departure date',
      'Introduce yourself before embarkation day',
      'Coordinate private excursions and port meetups',
      'Crew chat with travelers on your sailing',
    ],
    faq: [
      {
        q: 'What is a cruise roll call?',
        a: 'A roll call is a group for one ship on one sailing date. Cruisers introduce themselves, ask questions, and plan meetups before and during the voyage.',
      },
      {
        q: 'How do I find my roll call in SeaDays?',
        a: 'Open Crew, search your ship and sailing date, and join the roll call for your voyage. You can post introductions and chat with other guests on the same sailing.',
      },
      {
        q: 'Is SeaDays only for roll calls?',
        a: 'No. SeaDays is an all-in-one cruise planner app with roll calls, itineraries, budget tracking, ship and port discovery, and community features.',
      },
    ],
    related: [
      { href: '/cruise-community/', label: 'Cruise community app' },
      { href: '/cruise-planner/', label: 'Cruise planner' },
      { href: '/blog/', label: 'Cruise tips blog' },
    ],
  },
  {
    slug: 'cruise-planner',
    title: 'Cruise Planner — Itineraries, Excursions & Sea Days',
    h1: 'Plan Every Day of Your Cruise in One Place',
    subtitle:
      'Organize itineraries, excursions, shows, and sea days with a cruise planning app built for passengers—not spreadsheets scattered across group chats.',
    readingLead: [
      'A cruise plan is the operating picture of the voyage: embarkation timing, which days are at sea, which ports are too short for a countryside tour, and who is holding the tickets. If that picture only lives in a group chat, it disappears the moment the ship Wi-Fi stalls.',
      'Use the sections on this page to decide what belongs in the plan before you sail. The checklist works on paper. The app is optional storage for the same decisions — itinerary, reservations, and the offline copy you still need at the gangway.',
    ],
    primaryKeyword: 'cruise planner app',
    metaDescription:
      'Plan cruise itineraries, excursions, reservations, and sea days with SeaDays—the cruise planner app that keeps your whole voyage organized.',
    ctaLabel: 'Start Planning Your Cruise',
    bullets: [
      'Daily itinerary and activity planning',
      'Excursion and reservation tracking',
      'Shared plans for couples, families, and groups',
      'Countdown and pre-cruise checklists',
    ],
    faq: [
      {
        q: 'What should a cruise planner app include?',
        a: 'A strong cruise planner covers daily schedules, port days, bookings, packing, and shared planning for travel companions—without forcing you to juggle multiple apps.',
      },
      {
        q: 'Can I share my cruise plan with family?',
        a: 'Yes. SeaDays Plan supports shared workspaces so everyone sees the same itinerary, packing list, and to-dos in real time.',
      },
      {
        q: 'Does SeaDays work offline on the ship?',
        a: 'SeaDays caches key trip data for weak onboard Wi‑Fi, so your itinerary and notes stay available when connectivity drops at sea.',
      },
    ],
    related: [
      { href: '/cruise-roll-calls/', label: 'Cruise roll calls' },
      { href: '/cruise-budget-planner/', label: 'Cruise budget planner' },
      { href: '/ships/', label: 'Browse cruise ships' },
    ],
  },
  {
    slug: 'cruise-budget-planner',
    title: 'Cruise Budget Planner',
    h1: 'Track Your Cruise Budget Before and During the Voyage',
    subtitle:
      'See the real cost of your cruise—fare, excursions, drinks, gratuities, and onboard spending—in one cruise budget planner made for vacationers.',
    readingLead: [
      'The fare on the booking page is not the cost of the trip. Gratuities, Wi-Fi, drinks, excursions, transfers, and port-day cash sit in different places, and the cabin folio only shows the charges you put on the ship after you board.',
      'The method below separates those stacks so a calm folio does not hide a prepaid package or a single expensive port. Prices vary by line and sailing — use your own booking, not a sample total from someone else’s week.',
    ],
    primaryKeyword: 'cruise budget planner',
    metaDescription:
      'Track cruise expenses, excursions, onboard spending, and trip budgets with SeaDays Voyage Analytics—the cruise budget planner for smarter spending.',
    ctaLabel: 'Track Your Cruise Budget',
    bullets: [
      'Trip-level and daily spending visibility',
      'Excursion and onboard purchase tracking',
      'Compare budget vs. actual before you overspend',
      'Works alongside drink package planning tools',
    ],
    faq: [
      {
        q: 'What cruise costs should I budget for?',
        a: 'Include fare, taxes, gratuities, excursions, specialty dining, drinks, Wi‑Fi, spa, and souvenirs. SeaDays helps you capture categories most spreadsheets miss.',
      },
      {
        q: 'Can SeaDays help with drink package math?',
        a: 'Yes. Use the drink package calculator landing page and Voyage Analytics together to decide whether a package beats pay-as-you-go for your habits.',
      },
      {
        q: 'Is this a bank or accounting app?',
        a: 'No. SeaDays is a cruise vacation planner for passengers. Budget tools are designed for trip planning, not corporate accounting.',
      },
    ],
    related: [
      { href: '/cruise-drink-calculator/', label: 'Drink package calculator' },
      { href: '/cruise-planner/', label: 'Cruise planner app' },
      { href: '/ports/', label: 'Port guides' },
    ],
  },
  {
    slug: 'cruise-drink-calculator',
    title: 'Cruise Drink Package Calculator',
    h1: 'See If Your Cruise Drink Package Is Worth It',
    subtitle:
      'Run real break-even math for your cruise line, sailing length, and drinking habits—so you skip the package when pay-as-you-go wins.',
    readingLead: [
      'A drink package is worth it only when the prepaid total is lower than what you will actually order à la carte, including gratuities and the drinks the package does not cover. That answer changes with the line, the number of sea days, and whether every adult in the cabin must buy in.',
      'Work the steps on this page with the prices on your booking. Do not copy a break-even number from a forum. The calculator in SeaDays is a place to store that personal math; the worksheet stands without it.',
    ],
    primaryKeyword: 'cruise drink calculator',
    metaDescription:
      'Calculate cruise drink package break-even by line and habits. SeaDays shows when a beverage package saves money—and when to skip it.',
    ctaLabel: 'Calculate Drink Package Value',
    bullets: [
      'Line-specific package assumptions',
      'Break-even drinks per day',
      'Compare package vs. à la carte estimates',
      'Pair results with full voyage budgeting',
    ],
    faq: [
      {
        q: 'How does a cruise drink package calculator work?',
        a: 'You enter sailing length, typical drinks per day, and package price. The calculator estimates break-even servings and whether the package beats buying drinks individually.',
      },
      {
        q: 'Do all cruise lines price packages the same?',
        a: 'No. Lines and regions price packages differently. SeaDays models common package tiers so you can sanity-check the upsell at booking or embarkation.',
      },
      {
        q: 'Where do drink costs fit in my overall budget?',
        a: 'Add calculator results to Voyage Analytics in SeaDays to see drinks alongside excursions, dining, and onboard spending.',
      },
    ],
    related: [
      { href: '/cruise-budget-planner/', label: 'Cruise budget planner' },
      { href: '/cruise-planner/', label: 'Cruise planner' },
      { href: '/blog/', label: 'Drink package guides' },
    ],
  },
  {
    slug: 'cruise-community',
    title: 'Cruise Community App',
    h1: 'Meet Cruisers, Share Tips, and Plan Together',
    subtitle:
      'Connect with fellow cruise passengers through roll calls, ship and port reviews, and chat—built for cruise vacations, not generic social networks.',
    readingLead: [
      'Cruise advice is only useful when it names the ship, the month, and the region. A buffet complaint from a holiday mega-ship does not tell you how a small ship handles the same port, and a five-year-old review does not describe a ship that has been refit.',
      'Read the sections below before you treat a thread as a reason to change cabins or skip a port. Community tools in SeaDays are for passengers on a voyage. The reading here is the filter you should apply in any forum.',
    ],
    primaryKeyword: 'cruise community app',
    metaDescription:
      'Meet people on cruises, join roll calls, read ship and port reviews, and chat with fellow cruisers in the SeaDays cruise community app.',
    ctaLabel: 'Download SeaDays Free',
    bullets: [
      'Roll calls for your exact sailing',
      'Ship and port reviews from real cruisers',
      'Crew chat and group planning',
      'SeaStories tips and photos from the community',
    ],
    faq: [
      {
        q: 'How do I meet people on a cruise?',
        a: 'Join your sailing roll call in SeaDays, introduce yourself in chat, and coordinate meetups for port days or onboard events before you board.',
      },
      {
        q: 'Are SeaDays reviews from passengers?',
        a: 'Yes. Ship and port reviews come from cruisers sharing honest experiences about cabins, dining, entertainment, and things to do ashore.',
      },
      {
        q: 'Is the community public?',
        a: 'Community features are designed for cruise passengers planning or taking a voyage. Use roll calls and chat for your specific ship and dates.',
      },
    ],
    related: [
      { href: '/cruise-roll-calls/', label: 'Cruise roll calls' },
      { href: '/ships/', label: 'Ship guides' },
      { href: '/ports/', label: 'Port guides' },
    ],
  },
];

const FEATURE_PAGES = FEATURE_PAGES_RAW.map((page) => ({
  ...page,
  guideSections: GUIDE_BY_SLUG[page.slug] || [],
}));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFaqSchema(faq, pageUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
    url: pageUrl,
  };
}

function buildPageJsonLd(page) {
  const pageUrl = `${BASE_URL}/${page.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'SeaDays',
        url: BASE_URL + '/',
        logo: LOGO_URL,
      },
      {
        '@type': 'WebPage',
        name: page.title,
        description: page.metaDescription,
        url: pageUrl,
        isPartOf: { '@type': 'WebSite', name: 'SeaDays', url: BASE_URL + '/' },
      },
      {
        '@type': 'MobileApplication',
        name: 'SeaDays',
        applicationCategory: 'TravelApplication',
        operatingSystem: 'iOS, Android',
        url: pageUrl,
        downloadUrl: PLAY_STORE_URL,
        installUrl: APP_STORE_URL,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      buildFaqSchema(page.faq, pageUrl),
    ],
  };
}

function buildFeatureLandingPageHtml(page) {
  const canonical = `${BASE_URL}/${page.slug}/`;
  const title = `SeaDays – ${page.title}`;
  const jsonLd = JSON.stringify(buildPageJsonLd(page));
  const bulletHtml = page.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('\n              ');
  const faqHtml = page.faq
    .map(
      (f) =>
        `<div class="faq-item"><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></motion>`
    )
    .join('\n          ')
    .replace(/<\/motion>/g, '</div>');
  const guideHtml = Array.isArray(page.guideSections)
    ? page.guideSections
        .map((section) => {
          const blocks = (section.blocks || [])
            .map((block) => {
              if (block.type === 'p') return `<p>${escapeHtml(block.text)}</p>`;
              if (block.type === 'h3') return `<h3>${escapeHtml(block.text)}</h3>`;
              if (block.type === 'ul' || block.type === 'ol') {
                const tag = block.type;
                const items = (block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
                return `<${tag}>${items}</${tag}>`;
              }
              if (block.type === 'callout') {
                return `<div class="guide-callout"><p>${escapeHtml(block.text)}</p></div>`;
              }
              if (block.type === 'links') {
                const items = (block.items || [])
                  .map(
                    (item) =>
                      `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`
                  )
                  .join('');
                return `<ul class="guide-links">${items}</ul>`;
              }
              return '';
            })
            .join('\n          ');
          return `<section class="guide-section" aria-labelledby="guide-${escapeHtml(section.id)}"><h2 id="guide-${escapeHtml(section.id)}">${escapeHtml(section.heading)}</h2>\n          ${blocks}\n        </section>`;
        })
        .join('\n        ')
    : '';

  const leadHtml = (page.readingLead || [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n      ');

  const relatedHtml = page.related
    .map((r) => `<li><a href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a></li>`)
    .join('\n              ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
${getAnalyticsHeadHtml()}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
${getFaviconHeadHtml()}
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(page.metaDescription)}">
  <meta name="keywords" content="${escapeHtml(page.primaryKeyword)}, cruise planning app, cruise vacation planner, SeaDays">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(page.metaDescription)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="SeaDays — plan your cruise in one app">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonical}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(page.metaDescription)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <script type="application/ld+json">${jsonLd}</script>
  ${getSiteShellCssLinkHtml()}
  <style id="site-shell-page-pad">body > .container, body > .content-layer { padding-top: 88px; }</style>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --dark-bg: #0a0a0a; --neon-red: #FF0033; --text-light: #fff; --text-gray: rgba(255,255,255,0.72); }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: var(--dark-bg); color: var(--text-light); line-height: 1.6; min-height: 100vh; }
    .container { max-width: 960px; margin: 0 auto; padding: 40px 20px 80px; }
    .back-link { display: inline-flex; align-items: center; gap: 8px; color: var(--neon-red); text-decoration: none; font-weight: 600; margin-bottom: 28px; }
    .back-link:hover { color: #ff3366; }
    .header { text-align: center; margin-bottom: 40px; }
    h1 { font-size: clamp(32px, 5vw, 48px); font-weight: 900; margin-bottom: 16px; line-height: 1.15; }
    .subtitle { font-size: 18px; color: var(--text-gray); max-width: 720px; margin: 0 auto 28px; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin: 36px 0; }
    .feature-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,0,51,0.2); border-radius: 16px; padding: 28px; }
    .feature-card ul { margin: 0; padding-left: 20px; color: var(--text-gray); }
    .feature-card li { margin-bottom: 10px; }
    .guide-section { margin: 36px 0; text-align: left; }
    .guide-section h2 { font-size: 26px; margin-bottom: 14px; }
    .guide-section h3 { font-size: 18px; margin: 18px 0 8px; }
    .guide-section p, .guide-section li { color: var(--text-gray); font-size: 16px; line-height: 1.7; }
    .guide-section p { margin-bottom: 12px; }
    .guide-section ul, .guide-section ol { margin: 0 0 14px; padding-left: 22px; }
    .guide-section li { margin-bottom: 8px; }
    .reading-lead { text-align: left; margin: 8px 0 28px; }
    .reading-lead p { color: var(--text-gray); font-size: 17px; line-height: 1.7; margin-bottom: 14px; }
    .guide-callout { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px 20px; margin: 16px 0; }
    .guide-links { margin: 8px 0 0; padding-left: 22px; }
    .guide-links a { color: var(--neon-red); font-weight: 600; text-decoration: none; }
    .guide-links a:hover { text-decoration: underline; }
    .product-note { margin: 28px 0 8px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.45); font-weight: 700; }
    .faq-section { margin: 48px 0; }
    .faq-section h2 { font-size: 28px; margin-bottom: 20px; }
    .faq-item { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px 22px; margin-bottom: 14px; }
    .faq-item h3 { font-size: 18px; margin-bottom: 8px; }
    .faq-item p { color: var(--text-gray); }
    .related-links { margin: 32px 0; }
    .related-links h2 { font-size: 22px; margin-bottom: 12px; }
    .related-links ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 12px 20px; }
    .related-links a { color: var(--neon-red); font-weight: 600; text-decoration: none; }
    .related-links a:hover { text-decoration: underline; }
    .cta-section { border-top: 1px solid rgba(255,255,255,0.08); padding: 28px 0 8px; margin-top: 12px; text-align: left; }
    .cta-section h2 { font-size: 20px; margin-bottom: 8px; font-weight: 700; }
    .cta-section p { color: var(--text-gray); margin-bottom: 12px; font-size: 16px; }
    .cta-text-link { color: #fff; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  </style>
</head>
<body>
  ${getSiteHeaderHtml({ page: 'default' })}
  <div class="container">
    <a href="/" class="back-link" aria-label="Back to SeaDays home">← Back to Home</a>
    <header class="header">
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="subtitle">${escapeHtml(page.subtitle)}</p>
    </header>
    <section class="reading-lead">
      ${leadHtml}
    </section>
    ${guideHtml}
    <p class="product-note">In the SeaDays app</p>
    <section class="features-grid" aria-label="What the app stores">
      <article class="feature-card">
        <h2 class="visually-hidden">What the app stores</h2>
        <ul>
              ${bulletHtml}
        </ul>
      </article>
    </section>
    <section class="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Frequently asked questions</h2>
          ${faqHtml}
    </section>
    <section class="related-links" aria-labelledby="related-heading">
      <h2 id="related-heading">Explore more</h2>
      <ul>
              ${relatedHtml}
      </ul>
    </section>
    <section class="cta-section" aria-label="SeaDays app">
      <h2>Optional: keep this in SeaDays</h2>
      <p>The guide above stands on its own. When you want the itinerary, notes, and roll call in one place, open the app.</p>
      <p><a class="cta-text-link" href="${downloadPagePath({ source: 'seadays_web', medium: 'feature', campaign: 'feature_landing' })}">${escapeHtml(page.ctaLabel)}</a></p>
    </section>
  </div>
  ${getSiteFooterHtml()}
</body>
</html>`;
}

module.exports = {
  BASE_URL,
  PLAY_STORE_URL,
  APP_STORE_URL,
  LOGO_URL,
  FAVICON_URL,
  OG_IMAGE,
  FEATURE_PAGES,
  buildFeatureLandingPageHtml,
  buildPageJsonLd,
  escapeHtml,
};
