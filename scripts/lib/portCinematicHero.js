'use strict';

const { parseFocalPercent } = require('./ownerImagePresentation');

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Full-width port guide hero: natural height on mobile; width-fill + focal-aware cover cap on desktop. */
const PORT_DESTINATION_HERO_CSS = `
.seo-hero--destination { margin: 0 0 22px; }
@media (max-width: 720px) {
  .seo-hero--destination .seo-hero-img--port-destination {
    width: 100%;
    height: auto;
    max-height: none;
    object-fit: unset;
    object-position: var(--seo-hero-focal, 50% 38%);
    border-radius: 16px;
  }
}
@media (min-width: 721px) {
  .seo-hero--destination {
    border-radius: 16px;
    overflow: hidden;
    max-height: 480px;
  }
  .seo-hero--destination .seo-hero-img--port-destination {
    width: 100%;
    height: 480px;
    max-height: 480px;
    object-fit: cover;
    object-position: var(--seo-hero-focal, 50% 38%);
    border-radius: 0;
  }
}
@media (min-width: 721px) and (max-width: 1024px) {
  .seo-hero--destination { max-height: min(44vh, 480px); }
  .seo-hero--destination .seo-hero-img--port-destination {
    height: min(44vh, 480px);
    max-height: min(44vh, 480px);
  }
}
`;

/** @deprecated Use PORT_DESTINATION_HERO_CSS */
const PORT_CINEMATIC_HERO_CSS = PORT_DESTINATION_HERO_CSS;

function resolvePortHeroFocalPercent(options) {
  const explicit = String(options?.focalPercent || '').trim();
  if (explicit) return explicit;
  const fromOwner = parseFocalPercent(options?.ownerFocal);
  if (fromOwner) return fromOwner;
  const fromGuide = parseFocalPercent(options?.guideHeroFocal);
  if (fromGuide) return fromGuide;
  return '50% 38%';
}

/**
 * @param {{ url: string, alt: string, figcaptionHtml?: string, loading?: string, focalPercent?: string, ownerFocal?: object, guideHeroFocal?: object }} opts
 */
function buildPortDestinationHeroHtml(opts) {
  const url = String(opts?.url || '').trim();
  if (!url) return '';
  const alt = String(opts?.alt || 'Cruise port').trim();
  const loading = opts?.loading === 'lazy' ? 'lazy' : 'eager';
  const figcaptionHtml = opts?.figcaptionHtml != null ? String(opts.figcaptionHtml) : '';
  const focal = resolvePortHeroFocalPercent(opts);
  const styleAttr = `--seo-hero-focal: ${focal};`;
  return (
    `<figure class="seo-hero seo-hero--destination" style="${styleAttr}">` +
    `<img class="seo-hero-img seo-hero-img--port-destination" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="1280" loading="${loading}" decoding="async">` +
    (figcaptionHtml ? `<figcaption>${figcaptionHtml}</figcaption>` : '') +
    `</figure>`
  );
}

function buildPortCinematicHeroHtml(opts) {
  return buildPortDestinationHeroHtml(opts);
}

/** Strip internal QA labels from hero captions shown on public pages. */
function sanitizePublicHeroCaptionHtml(html) {
  let s = String(html || '');
  s = s.replace(/Photo candidate\s*\([^)]*\)\s*:\s*/gi, 'Photo: ');
  s = s.replace(/owner download via Pexels\s*[—–-]\s*/gi, '');
  s = s.replace(
    /Photo:\s*owner-provided download\s*[—–-]\s*confirm licen[sc]e and geography before production use\.?/gi,
    ''
  );
  s = s.replace(/confirm licen[sc]e and geography before production use\.?/gi, '');
  s = s.replace(/\s*\(confirm before production\)\.?/gi, '');
  s = s.replace(/\bNEEDS_REVIEW\b/gi, '');
  s = s.replace(/\bVERIFIED\b/gi, '');
  s = s.replace(/\bREJECTED\b/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s || /^Photo:\s*$/i.test(s)) return '';
  return s;
}

const CINEMATIC_LEGACY_CSS_RE =
  /\.seo-hero--cinematic[\s\S]*?@media \(prefers-reduced-motion: reduce\)[\s\S]*?\}\s*/;

const DESTINATION_HERO_CSS_BLOCK_RE =
  /\.seo-hero--destination \{ margin: 0 0 22px; \}[\s\S]*?@media \(min-width: 721px\) and \(max-width: 1024px\)[\s\S]*?\}\s*\}\s*/;

function stripLegacyPortHeroCss(html) {
  return String(html || '')
    .replace(CINEMATIC_LEGACY_CSS_RE, '')
    .replace(DESTINATION_HERO_CSS_BLOCK_RE, '');
}

module.exports = {
  PORT_DESTINATION_HERO_CSS,
  PORT_CINEMATIC_HERO_CSS,
  buildPortDestinationHeroHtml,
  buildPortCinematicHeroHtml,
  sanitizePublicHeroCaptionHtml,
  resolvePortHeroFocalPercent,
  stripLegacyPortHeroCss,
};
