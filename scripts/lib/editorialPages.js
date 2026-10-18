'use strict';

/**
 * Hand-written editorial bodies for individual port and ship pages.
 *
 * data/editorial-pages/<ports|ships>/<slug>.html holds the page body and
 * data/editorial-pages/meta.json the title, description and robots value.
 * The generator rebuilds ports/ and ships/ from CMS and app data, so this
 * runs after generation and swaps the generated body for the editorial one.
 * It is idempotent: the body sits between seadays-editorial markers.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'editorial-pages');
const START = '<!-- seadays-editorial:start -->';
const END = '<!-- seadays-editorial:end -->';

function escAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decode(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadEditorialPages() {
  const metaPath = path.join(DIR, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const out = [];
  for (const kind of ['ports', 'ships']) {
    const dir = path.join(DIR, kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.html')) continue;
      const slug = name.replace(/\.html$/, '');
      out.push({
        kind,
        slug,
        body: fs.readFileSync(path.join(dir, name), 'utf8').trim(),
        meta: meta[`${kind}/${slug}`] || {},
      });
    }
  }
  return out;
}

/** Question/answer pairs visible in the editorial body (port cards or ship details). */
function faqPairs(body) {
  const pairs = [];
  for (const m of body.matchAll(/<article class="pg-qa-card"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/article>/g)) {
    pairs.push([decode(m[1]), decode(m[2])]);
  }
  for (const m of body.matchAll(/<details class="seo-faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)) {
    pairs.push([decode(m[1]), decode(m[2])]);
  }
  return pairs;
}

function bodyRegion(html, kind) {
  const marked = html.indexOf(START);
  if (marked !== -1) {
    const end = html.indexOf(END, marked);
    if (end === -1) throw new Error('editorial start marker without end marker');
    let stop = end + END.length;
    if (html[stop] === '\n') stop += 1;
    return [marked, stop];
  }
  if (kind === 'ports') {
    let start = html.indexOf('<nav class="port-jump"');
    if (start === -1) {
      const lead = html.match(/<p class="lead">[\s\S]*?<\/p>/);
      if (!lead) throw new Error('port page has no lead paragraph');
      start = lead.index + lead[0].length;
    }
    const end = html.indexOf('<aside class="pg-app-cta"', start);
    if (end === -1) throw new Error('port page has no app CTA anchor');
    return [start, end];
  }
  const lead = html.match(/<p class="lead">[\s\S]*?<\/p>/);
  if (!lead) throw new Error('ship page has no lead paragraph');
  const start = lead.index + lead[0].length;
  const end = html.indexOf('<h2>More reading</h2>', start);
  if (end === -1) throw new Error('ship page has no More reading anchor');
  return [start, end];
}

function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*">`);
  return re.test(html) ? html.replace(re, `<meta ${attr}="${key}" content="${escAttr(value)}">`) : html;
}

function patchJsonLd(html, meta, pairs) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, json) => {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return whole;
    }
    if (!data || typeof data !== 'object') return whole;
    if (data['@type'] === 'FAQPage') {
      if (!pairs.length) return '';
      data.mainEntity = pairs.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      }));
    } else if (meta.description && typeof data.description === 'string') {
      data.description = meta.description;
    }
    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  });
}

/**
 * @param {string} html generated page
 * @param {{kind:string, body:string, meta:object}} page
 */
function applyEditorialPage(html, page) {
  const [start, end] = bodyRegion(html, page.kind);
  let out = `${html.slice(0, start)}${START}\n${page.body}\n${END}\n${html.slice(end)}`;
  const meta = page.meta || {};
  if (meta.title) {
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(meta.title)}</title>`);
    out = setMeta(out, 'property', 'og:title', meta.title);
    out = setMeta(out, 'property', 'twitter:title', meta.title);
    out = setMeta(out, 'name', 'twitter:title', meta.title);
  }
  if (meta.description) {
    out = setMeta(out, 'name', 'description', meta.description);
    out = setMeta(out, 'property', 'og:description', meta.description);
    out = setMeta(out, 'property', 'twitter:description', meta.description);
    out = setMeta(out, 'name', 'twitter:description', meta.description);
  }
  if (meta.robots) out = setMeta(out, 'name', 'robots', meta.robots);
  return patchJsonLd(out, meta, faqPairs(page.body));
}

const BASE_URL = 'https://seadays.app';

function isNoindex(html) {
  const head = String(html || '').split(/<\/head>/i)[0];
  return /<meta\s+name=["'](?:robots|googlebot)["']\s+content=["'][^"']*(?:noindex|none)/i.test(head);
}

/**
 * Keep sitemap.xml in step with editorial pages without rebuilding it
 * (a full rebuild would reset every lastmod): indexable editorial pages get
 * a lastmod of their meta.checked date, noindex ones are dropped.
 */
function syncSitemap(root, pages) {
  const file = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(file)) return 0;
  let xml = fs.readFileSync(file, 'utf8');
  const before = xml;
  for (const page of pages) {
    const loc = `${BASE_URL}/${page.kind}/${page.slug}/`;
    const html = fs.readFileSync(path.join(root, page.kind, page.slug, 'index.html'), 'utf8');
    const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(String(page.meta.checked || '')) ? page.meta.checked : null;
    const re = new RegExp(`[ \\t]*<url><loc>${loc.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc>[\\s\\S]*?</url>\\r?\\n?`);
    if (isNoindex(html)) {
      xml = xml.replace(re, '');
      continue;
    }
    const line = `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.65</priority></url>\n`;
    if (re.test(xml)) {
      if (lastmod) xml = xml.replace(re, (block) => block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${lastmod}</lastmod>`));
    } else {
      xml = xml.replace('</urlset>', `${line}</urlset>`);
    }
  }
  if (xml !== before) fs.writeFileSync(file, xml, 'utf8');
  return xml !== before ? 1 : 0;
}

function applyAllEditorialPages(root = ROOT) {
  const results = [];
  for (const page of loadEditorialPages()) {
    const file = path.join(root, page.kind, page.slug, 'index.html');
    if (!fs.existsSync(file)) {
      results.push({ file, status: 'missing' });
      continue;
    }
    const before = fs.readFileSync(file, 'utf8');
    const after = applyEditorialPage(before, page);
    if (after !== before) fs.writeFileSync(file, after, 'utf8');
    results.push({ file, status: after === before ? 'unchanged' : 'updated' });
  }
  const present = loadEditorialPages().filter((page) =>
    fs.existsSync(path.join(root, page.kind, page.slug, 'index.html'))
  );
  if (syncSitemap(root, present)) results.push({ file: path.join(root, 'sitemap.xml'), status: 'updated' });
  return results;
}

module.exports = {
  START,
  END,
  loadEditorialPages,
  applyEditorialPage,
  applyAllEditorialPages,
  faqPairs,
  syncSitemap,
};
