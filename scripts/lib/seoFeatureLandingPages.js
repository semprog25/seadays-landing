'use strict';

const BASE_URL = 'https://seadays.app';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.seadays.app';
const APP_STORE_URL = 'https://apps.apple.com/de/app/seadays/id6759758357';
const LOGO_URL = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadays.png';
const FAVICON_URL = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';
const OG_IMAGE = 'https://seadays.app/og-image.png';

const FEATURE_PAGES = [
  {
    slug: 'cruise-roll-calls',
    title: 'Cruise Roll Call App',
    h1: 'Join Your Sailing Roll Call Before You Board',
    subtitle:
      'Find cruisers on your exact ship and sail date, introduce yourself, coordinate excursions, and meet fellow guests with the SeaDays cruise roll call app.',
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
    title: 'Cruise Planner App',
    h1: 'Plan Every Day of Your Cruise in One Place',
    subtitle:
      'Organize itineraries, excursions, shows, and sea days with a cruise planning app built for passengers—not spreadsheets scattered across group chats.',
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
  const relatedHtml = page.related
    .map((r) => `<li><a href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a></li>`)
    .join('\n              ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-WSQDQ33QZD"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-WSQDQ33QZD');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="${FAVICON_URL}">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(page.metaDescription)}">
  <meta name="keywords" content="${escapeHtml(page.primaryKeyword)}, cruise planning app, cruise vacation planner, SeaDays">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(page.metaDescription)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonical}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(page.metaDescription)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <script type="application/ld+json">${jsonLd}</script>
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
    .cta-section { background: rgba(255,0,51,0.12); border: 1px solid rgba(255,0,51,0.35); border-radius: 16px; padding: 44px 32px; text-align: center; margin-top: 40px; }
    .cta-section h2 { font-size: 30px; margin-bottom: 12px; }
    .cta-section p { color: var(--text-gray); margin-bottom: 24px; font-size: 17px; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
    .cta-button { display: inline-block; padding: 16px 36px; background: var(--neon-red); color: #fff; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 17px; min-height: 44px; }
    .cta-button:hover { background: #cc0029; transform: translateY(-2px); }
    .cta-button-secondary { background: transparent; border: 2px solid rgba(255,255,255,0.25); }
    .store-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 18px; }
    .store-row a { color: rgba(255,255,255,0.85); font-size: 14px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link" aria-label="Back to SeaDays home">← Back to Home</a>
    <header class="header">
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="subtitle">${escapeHtml(page.subtitle)}</p>
    </header>
    <section class="features-grid" aria-label="Key features">
      <article class="feature-card">
        <h2 class="visually-hidden">Features</h2>
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
    <section class="cta-section" aria-label="Download SeaDays">
      <h2>${escapeHtml(page.ctaLabel)}</h2>
      <p>Download SeaDays free on iOS and Android—the modern all-in-one cruise planner and roll call app.</p>
      <div class="cta-row">
        <a class="cta-button" href="${PLAY_STORE_URL}" rel="noopener noreferrer" target="_blank">Download SeaDays Free</a>
        <a class="cta-button cta-button-secondary" href="/#cruise-planning-tools">Explore Features</a>
      </div>
      <div class="store-row">
        <a href="${APP_STORE_URL}" rel="noopener noreferrer" target="_blank">App Store</a>
        <span aria-hidden="true">·</span>
        <a href="${PLAY_STORE_URL}" rel="noopener noreferrer" target="_blank">Google Play</a>
      </div>
    </section>
  </div>
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
