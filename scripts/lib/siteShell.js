/**
 * SeaDays global site shell — single source of truth.
 * Visual design is taken from the homepage (index.html) header/footer.
 * Generators and apply-site-shell.js must consume this module; do not fork markup.
 */

'use strict';

const { downloadPagePath } = require('./storeLinks');

const SITE_SHELL_CSS_HREF = '/assets/css/site-shell.css';
const SITE_SHELL_MARKER_START = '<!-- seadays-site-shell';
const SITE_SHELL_MARKER_END = 'seadays-site-shell -->';

/**
 * @typedef {'home' | 'default'} SiteShellPage
 */

/**
 * @param {{ page?: SiteShellPage }} [opts]
 * @returns {{ href: string, label: string }[]}
 */
function getSiteNavLinks(opts = {}) {
  const page = opts.page === 'home' ? 'home' : 'default';
  const featuresHref = page === 'home' ? '#cruise-planning-tools' : '/#cruise-planning-tools';
  const downloadHref = downloadPagePath({
    source: 'seadays_web',
    medium: 'nav',
    campaign: 'organic_nav',
  });

  // Homepage hero already has store badges; do not add a sixth header item there.
  // Inner pages send Get SeaDays to /download/ (not #download) so campaign tracking works.
  const links = [
    { href: featuresHref, label: 'Features' },
    { href: '/ships/', label: 'Ships' },
    { href: '/ports/', label: 'Ports' },
    { href: '/blog/', label: 'Blog' },
    { href: '/press/', label: 'Press' },
  ];
  if (page !== 'home') {
    links.push({ href: downloadHref, label: 'Get SeaDays' });
  }
  return links;
}

/**
 * Homepage-faithful top nav. Ships/Ports/Press added for global discoverability.
 * Roll Calls remains in footer Plan links (and on homepage content).
 * @param {{ page?: SiteShellPage }} [opts]
 */
function getSiteHeaderHtml(opts = {}) {
  const links = getSiteNavLinks(opts)
    .map((link) => {
      const href = String(link.href).replace(/&/g, '&amp;');
      return `                <a href="${href}">${link.label}</a>`;
    })
    .join('\n');

  return `${SITE_SHELL_MARKER_START}:header -->
        <header class="header site-header">
            <nav class="header-nav" aria-label="Main navigation">
${links}
            </nav>
        </header>
        ${SITE_SHELL_MARKER_START}:header-end ${SITE_SHELL_MARKER_END}`;
}

/**
 * Canonical footer from the homepage design, with Press in Explore.
 */
function getSiteFooterHtml() {
  return `${SITE_SHELL_MARKER_START}:footer -->
        <footer>
            <div class="container">
                <div class="footer-shell">
                    <div class="footer-brand">
                        <a class="footer-brand-logo" href="/" aria-label="SeaDays home">
                            <img src="/press/logos/seadays-logo-dark.png" alt="SeaDays" width="180" height="40" decoding="async">
                        </a>
                        <p class="footer-brand-desc">SeaDays is a cruise planning and community app for smarter voyages.</p>
                        <p class="footer-brand-meta">made with love from the port city of <span class="footer-hamburg">Hamburg <span aria-hidden="true">⚓</span></span></p>
                        <ul class="footer-social">
                            <li><a href="https://www.instagram.com/seadaysapp/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
                            <li><a href="https://www.tiktok.com/@seadaysapp" target="_blank" rel="noopener noreferrer">TikTok</a></li>
                        </ul>
                    </div>

                    <div class="footer-content">
                        <div class="footer-section">
                            <h4>Explore</h4>
                            <ul>
                                <li><a href="/ships/">Ships</a></li>
                                <li><a href="/ports/">Ports</a></li>
                                <li><a href="/blog/">Blog</a></li>
                                <li><a href="/press/">Press</a></li>
                                <li><a href="/#blog">SeaStories</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>Plan</h4>
                            <ul>
                                <li><a href="/cruise-planner/">Cruise Planner</a></li>
                                <li><a href="/cruise-roll-calls/">Roll Calls</a></li>
                                <li><a href="/cruise-community/">Cruise Community</a></li>
                                <li><a href="/#cruise-passport">Cruise Passport</a></li>
                                <li><a href="${downloadPagePath({ source: 'seadays_web', medium: 'footer', campaign: 'organic_web' }).replace(/&/g, '&amp;')}">Get SeaDays</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>SeaDays</h4>
                            <ul>
                                <li><a href="/about.html">About</a></li>
                                <li><a href="/help.html">Help</a></li>
                                <li><a href="/faq.html">FAQ</a></li>
                                <li><a href="/contact.html">Contact</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>Sustainability</h4>
                            <ul>
                                <li><a href="/co2/">CO₂ Contribution</a></li>
                            </ul>
                        </div>
                        <div class="footer-section footer-section--legal">
                            <h4>Legal</h4>
                            <ul>
                                <li><a href="/privacy.html">Privacy</a></li>
                                <li><a href="/security.html">Security</a></li>
                                <li><a href="/terms.html">Terms</a></li>
                                <li><a href="/cookies.html">Cookie Policy</a></li>
                                <li><a href="/gdpr.html">GDPR</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="footer-mobile-brand">
                    <a class="footer-logo-mobile" href="/" aria-label="SeaDays home">
                        <img src="/press/logos/seadays-logo-dark.png" alt="SeaDays" width="160" height="36" decoding="async">
                    </a>
                    <p class="footer-brand-desc">SeaDays is a cruise planning and community app for smarter voyages.</p>
                    <p class="footer-brand-meta">made with love from the port city of <span class="footer-hamburg">Hamburg <span aria-hidden="true">⚓</span></span></p>
                </div>

                <div class="footer-bottom">
                    <p>© 2026 SeaDays. All rights reserved.</p>
                    <a href="https://seadays.app/" style="position:absolute; left:-9999px;">SeaDays Cruise Planner</a>
                </div>
            </div>
        </footer>
        ${SITE_SHELL_MARKER_START}:footer-end ${SITE_SHELL_MARKER_END}`;
}

/**
 * Compact stylesheet link tag for pages that do not already inline shell CSS.
 */
function getSiteShellCssLinkHtml() {
  return `<link rel="stylesheet" href="${SITE_SHELL_CSS_HREF}">`;
}

/**
 * Homepage-derived header + footer CSS.
 * Scoped to header.header / footer so content blocks like div.header are not affected.
 */
function getSiteShellCss() {
  return `/* SeaDays global site shell — derived from homepage index.html. Do not fork. */
header.header.site-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 20px 40px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  z-index: 100;
  background: transparent;
  border-bottom: none;
}

header.header.site-header .header-nav {
  display: flex;
  gap: 30px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

header.header.site-header .header-nav a {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-weight: 500;
  font-size: 15px;
  transition: all 0.3s ease;
  white-space: nowrap;
}

header.header.site-header .header-nav a:hover {
  color: white;
  text-shadow: 0 0 18px rgba(255, 140, 170, 0.85), 0 0 40px rgba(255, 0, 51, 0.45);
}

/* Get SeaDays is a download CTA, not a content destination. Campaign URLs stay on /download/. */
header.header.site-header .header-nav a[href*="/download/"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 0, 51, 0.18);
  border: 1px solid rgba(255, 0, 51, 0.45);
  color: #fff;
  font-weight: 700;
}
header.header.site-header .header-nav a[href*="/download/"]:hover {
  color: #fff;
  background: rgba(255, 0, 51, 0.32);
  border-color: rgba(255, 0, 51, 0.7);
  text-shadow: none;
}

footer:has(.footer-shell),
footer.site-footer {
  padding: 80px 0 36px;
  margin-top: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  text-align: left;
  background: #050505;
  scroll-snap-align: none;
}

.footer-shell {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 48px 48px;
  margin-bottom: 44px;
  align-items: start;
  width: 100%;
}

.footer-shell > * { min-width: 0; }

.footer-brand { max-width: 340px; }

.footer-brand-logo {
  display: inline-block;
  text-decoration: none;
  margin-bottom: 18px;
}

.footer-brand-logo img {
  display: block;
  width: auto;
  height: 40px;
  max-width: 180px;
}

.footer-brand-desc {
  color: rgba(255, 255, 255, 0.62);
  font-size: 15px;
  line-height: 1.65;
  margin-bottom: 12px;
}

.footer-brand-meta {
  color: rgba(255, 255, 255, 0.38);
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 18px;
}

.footer-hamburg { display: block; }

.footer-social {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.footer-social a {
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  font-size: 14px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
}

.footer-social a:hover { color: var(--neon-red, #FF0033); }

.footer-shell .footer-content {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 28px 16px;
  text-align: left;
  min-width: 0;
  width: 100%;
}

.footer-shell .footer-section h4 {
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
}

.footer-shell .footer-section ul { list-style: none; margin: 0; padding: 0; }
.footer-shell .footer-section ul li { margin-bottom: 11px; }

.footer-shell .footer-section a {
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: color 0.25s ease;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
}

.footer-shell .footer-section a:hover { color: var(--neon-red, #FF0033); }

.footer-bottom {
  padding-top: 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.32);
  font-size: 14px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}

.footer-mobile-brand { display: none; }

@media (max-width: 1100px) {
  .footer-shell {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .footer-shell .footer-content {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 28px 24px;
  }
}

@media (max-width: 768px) {
  header.header.site-header { padding: 15px 20px; }
  header.header.site-header .header-nav { gap: 12px 15px; }
  header.header.site-header .header-nav a { font-size: 13px; }

  footer:has(.footer-shell),
  footer.site-footer {
    padding: 48px 0 28px;
    padding-bottom: max(28px, env(safe-area-inset-bottom));
  }
  .footer-shell {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 0;
  }
  .footer-brand { max-width: none; text-align: center; }
  .footer-brand .footer-brand-logo { display: none; }
  .footer-brand > .footer-brand-desc,
  .footer-brand > .footer-brand-meta { display: none; }
  .footer-social { gap: 12px 16px; justify-content: center; }
  .footer-shell .footer-content {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px 20px;
    text-align: center;
    margin-bottom: 0;
    align-items: start;
    justify-items: center;
  }
  .footer-shell .footer-section { width: 100%; text-align: center; }
  .footer-shell .footer-section h4 { margin-bottom: 16px; text-align: center; }
  .footer-shell .footer-section ul {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .footer-shell .footer-section ul li { margin-bottom: 10px; }
  .footer-shell .footer-section a { justify-content: center; }
  .footer-shell .footer-section--legal { grid-column: 1 / -1; }
  .footer-mobile-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    margin-top: 28px;
  }
  .footer-logo-mobile {
    display: inline-block;
    text-decoration: none;
  }
  .footer-logo-mobile img {
    display: block;
    width: auto;
    height: 36px;
    max-width: 160px;
  }
  .footer-mobile-brand .footer-brand-desc {
    margin-bottom: 0;
    max-width: 28rem;
  }
  .footer-mobile-brand .footer-brand-meta {
    margin-bottom: 0;
  }
  .footer-hamburg { display: inline; }
  .footer-bottom {
    justify-content: center;
    text-align: center;
    margin-top: 24px;
  }
  .footer-bottom p { width: 100%; }
}

@media (max-width: 480px) {
  /* Match homepage: hide text nav on small phones; keep Get SeaDays as a CTA */
  header.header.site-header .header-nav a { display: none; }
  header.header.site-header .header-nav a[href*="/download/"] { display: inline-flex; }
  footer:has(.footer-shell),
  footer.site-footer {
    padding: 40px 0 24px;
    padding-bottom: max(24px, env(safe-area-inset-bottom));
  }
  .footer-shell .footer-content { gap: 28px 14px; }
  .footer-shell .footer-section a { font-size: 13px; }
  .footer-mobile-brand { margin-top: 24px; }
  .footer-logo-mobile img { height: 32px; }
}

@media (max-width: 360px) {
  .footer-shell .footer-content {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .footer-shell .footer-section--legal { grid-column: auto; }
}

/* AdSense: occupy no layout until consent marks the slot ready. */
.article-body aside.seadays-ad-slot:not(.seadays-ad-slot--ready) {
  display: none;
  min-height: 0;
  margin: 0;
  padding: 0;
}
`;
}

/**
 * Strip previously injected shell markers (idempotent re-apply).
 * @param {string} html
 * @param {'header' | 'footer' | 'all'} [which]
 */
function stripSiteShellMarkers(html, which = 'all') {
  let out = String(html || '');
  if (which === 'all' || which === 'header') {
    out = out.replace(
      /<!-- seadays-site-shell:header -->[\s\S]*?<!-- seadays-site-shell:header-end seadays-site-shell -->/g,
      ''
    );
  }
  if (which === 'all' || which === 'footer') {
    out = out.replace(
      /<!-- seadays-site-shell:footer -->[\s\S]*?<!-- seadays-site-shell:footer-end seadays-site-shell -->/g,
      ''
    );
  }
  return out;
}

/**
 * @param {string} html
 * @param {string} blockHtml
 */
function insertBeforeBodyClose(html, blockHtml) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${blockHtml}\n</body>`);
  }
  return html + blockHtml;
}

/**
 * Replace a classic <header class="header">…</header> site chrome block.
 * @param {string} html
 * @param {{ page?: SiteShellPage }} [opts]
 */
function replaceSiteHeaderInHtml(html, opts = {}) {
  const headerHtml = getSiteHeaderHtml(opts);
  let out = String(html || '');

  if (/<!-- seadays-site-shell:header -->/.test(out)) {
    return out.replace(
      /<!-- seadays-site-shell:header -->[\s\S]*?<!-- seadays-site-shell:header-end seadays-site-shell -->/g,
      headerHtml
    );
  }

  const replaced = out.replace(
    /<header\s+class="header(?:\s+site-header)?"[^>]*>\s*<nav\s+class="header-nav"[\s\S]*?<\/header>/i,
    headerHtml
  );
  if (replaced !== out) return replaced;

  const replaced2 = out.replace(
    /<header\s+class="header(?:\s+site-header)?"[^>]*>\s*(?:<a[^>]*class="header-brand"[^>]*>[\s\S]*?<\/a>\s*)?<nav\s+class="header-nav"[\s\S]*?<\/header>/i,
    headerHtml
  );
  if (replaced2 !== out) return replaced2;

  return out;
}

/**
 * Replace existing footer chrome with the canonical homepage footer.
 * @param {string} html
 */
function replaceSiteFooterInHtml(html) {
  const footerHtml = getSiteFooterHtml();
  let out = String(html || '');

  if (/<!-- seadays-site-shell:footer -->/.test(out)) {
    return out.replace(
      /<!-- seadays-site-shell:footer -->[\s\S]*?<!-- seadays-site-shell:footer-end seadays-site-shell -->/g,
      footerHtml
    );
  }

  const replaced = out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, footerHtml);
  if (replaced !== out) return replaced;

  // Recover pages that lost a footer during a prior apply
  if (/<div class="content-layer"[^>]*>/i.test(out) && /<\/div>\s*<script[\s>]/i.test(out)) {
    return out.replace(/(<\/div>)\s*(<script[\s>])/i, `$1\n${footerHtml}\n$2`);
  }

  return insertBeforeBodyClose(out, footerHtml);
}

/**
 * Ensure the shared stylesheet link is present once in <head>.
 * @param {string} html
 */
function ensureSiteShellCssLink(html) {
  let out = String(html || '');
  if (out.includes(SITE_SHELL_CSS_HREF)) return out;
  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, `  ${getSiteShellCssLinkHtml()}\n</head>`);
  }
  return out;
}

module.exports = {
  SITE_SHELL_CSS_HREF,
  getSiteNavLinks,
  getSiteHeaderHtml,
  getSiteFooterHtml,
  getSiteShellCss,
  getSiteShellCssLinkHtml,
  stripSiteShellMarkers,
  replaceSiteHeaderInHtml,
  replaceSiteFooterInHtml,
  ensureSiteShellCssLink,
};
