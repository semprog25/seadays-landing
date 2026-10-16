'use strict';

/**
 * Inline "Get SeaDays" store badges for generated blog articles.
 * Insertion only: intro after the first paragraph, and again at the end
 * of the article. Never placed inside an AdSense slot.
 */

const { blogStoreUrls } = require('./storeLinks');

// Raster PNG, not SVG. generateBlogs post-build validation rejects every <img src> that ends in .svg.
const APP_STORE_BADGE_SRC = '/assets/img/badges/app-store.png';
const PLAY_BADGE_SRC = '/assets/img/badges/google-play.png';

const ARTICLE_BODY_RE =
  /(<div class="article-body">)([\s\S]*?)(<\/div>\s*(?=<section class="same-topic-section"|<section class="app-download-cta"|<section class="explore-seadays"|<nav class="article-nav"|<section class="more-to-read"|<\/article>))/;

function hrefAttr(url) {
  return String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Shared responsive rules. Also appended to site-shell.css so existing
 * articles pick them up without rewriting their inline style blocks.
 */
function getBlogStoreCtaCss() {
  return `
.get-seadays-cta{margin:28px 0;padding:16px 14px 14px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);text-align:center;}
.article-body aside.get-seadays-cta{margin:28px 0;padding:16px 14px 14px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);}
.get-seadays-cta-title,.article-body .get-seadays-cta p{margin:0 0 12px;font-size:16px;font-weight:800;letter-spacing:-0.2px;line-height:1.3;color:#fff;}
.get-seadays-cta-badges{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center;}
.get-seadays-cta a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;line-height:0;text-decoration:none;}
.get-seadays-cta img,.article-body .get-seadays-cta img{display:block;width:auto;height:44px;max-width:min(180px,72vw);margin:0;border-radius:7px;object-fit:contain;}
@media (max-width:600px){
  .get-seadays-cta-badges{flex-direction:column;}
  .get-seadays-cta img,.article-body .get-seadays-cta img{height:48px;}
}
`.trim();
}

/**
 * @param {string} slug
 * @param {'intro' | 'end'} placement
 */
function buildBlogStoreCtaHtml(slug, placement) {
  const which = placement === 'end' ? 'end' : 'intro';
  const urls = blogStoreUrls(slug, which);
  return (
    `<aside class="get-seadays-cta" data-seadays-blog-cta="${which}" data-seadays-fixed-store="1" aria-label="Get SeaDays">` +
    `<p class="get-seadays-cta-title">Get SeaDays</p>` +
    `<div class="get-seadays-cta-badges">` +
    `<a href="${hrefAttr(urls.apple)}" data-seadays-fixed-store="1" target="_blank" rel="noopener noreferrer">` +
    `<img src="${APP_STORE_BADGE_SRC}" alt="Download SeaDays on the App Store" width="135" height="40" loading="lazy" decoding="async">` +
    `</a>` +
    `<a href="${hrefAttr(urls.play)}" data-seadays-fixed-store="1" target="_blank" rel="noopener noreferrer">` +
    `<img src="${PLAY_BADGE_SRC}" alt="Get SeaDays on Google Play" width="146" height="40" loading="lazy" decoding="async">` +
    `</a>` +
    `</div></aside>`
  );
}

/**
 * Index just after the first paragraph that is not inside an ad slot.
 * @param {string} body
 * @returns {number}
 */
function findIntroInsertIndex(body) {
  const re = /<\/p>/gi;
  let match;
  while ((match = re.exec(body))) {
    const at = match.index + match[0].length;
    const before = body.slice(0, at);
    const lastAside = before.lastIndexOf('<aside');
    if (lastAside >= 0) {
      const slice = before.slice(lastAside);
      if (/\bseadays-ad-slot\b/.test(slice) && !/<\/aside>/i.test(slice)) continue;
    }
    return at;
  }
  const h2 = body.search(/<\/h2>/i);
  if (h2 >= 0) return h2 + '</h2>'.length;
  return 0;
}

/**
 * Insert intro + end store CTAs into a generated article page.
 * Idempotent. Leaves redirect stubs and non-articles unchanged.
 * @param {string} html
 * @param {string} slug
 */
function applyBlogStoreCtasToHtml(html, slug) {
  if (!html || typeof html !== 'string' || !slug) return html;
  if (!html.includes('<div class="article-body">')) return html;
  const match = html.match(ARTICLE_BODY_RE);
  if (!match || match.index == null) return html;

  let body = match[2];
  const hadIntro = html.includes('data-seadays-blog-cta="intro"');
  const hadEnd = html.includes('data-seadays-blog-cta="end"');
  if (hadIntro && hadEnd) return html;

  if (!hadIntro) {
    const intro = buildBlogStoreCtaHtml(slug, 'intro');
    const at = findIntroInsertIndex(body);
    body = body.slice(0, at) + intro + body.slice(at);
  }
  const end = hadEnd ? '' : buildBlogStoreCtaHtml(slug, 'end');
  return (
    html.slice(0, match.index) +
    match[1] +
    body +
    match[3] +
    end +
    html.slice(match.index + match[0].length)
  );
}

module.exports = {
  APP_STORE_BADGE_SRC,
  PLAY_BADGE_SRC,
  getBlogStoreCtaCss,
  buildBlogStoreCtaHtml,
  findIntroInsertIndex,
  applyBlogStoreCtasToHtml,
};
