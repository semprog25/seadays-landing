'use strict';

const { isDanglingSentence, splitSentences, normalizeSentenceKey } = require('./portCopyHygiene');
const { isAuditNoindexPort } = require('./auditHoldback');

const MIN_SHARED_CHARS = 45;
const EXEMPT_SENTENCE_KEYS = new Set([
  'book shore excursions tours activities with our partner',
  'book shore excursions in the seadays app with our partner',
]);
const LABEL_RE =
  /^(best months|climate|short call|standard call|longer call|practical cruise tip|top things|port type|documents and entry rules|photo|map data|average temperature)\b/i;

function decodeBasic(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function proseRoot(html) {
  const main = String(html || '').match(/<main\b[\s\S]*?<\/main>/i);
  let s = main ? main[0] : String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  s = s.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '');
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, '');
  s = s.replace(/<div class="seo-article-grid"[\s\S]*?<\/div>/gi, '');
  s = s.replace(/<p class="(?:pg-affiliate-note|wiki-attribution|pg-map-credit)"[\s\S]*?<\/p>/gi, '');
  return s;
}

function visibleText(fragment) {
  return decodeBasic(String(fragment || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function pageH1(html) {
  const m = String(html || '').match(/<h1>([^<]+)<\/h1>/i);
  return m ? visibleText(m[1]) : '';
}

function factValue(html, label) {
  const re = new RegExp(`<dt>${label}</dt>\\s*<dd>([^<]*)</dd>`, 'i');
  const m = String(html || '').match(re);
  return m ? visibleText(m[1]) : '';
}

function firstNumber(text) {
  const m = String(text || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function collectSentenceKeys(html) {
  const keys = [];
  const chunks = proseRoot(html).match(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  for (const chunk of chunks) {
    if (/\bclass="[^"]*\blead\b/.test(chunk)) continue;
    const text = visibleText(chunk);
    for (const sentence of splitSentences(text)) {
      if (sentence.length < MIN_SHARED_CHARS) continue;
      if (LABEL_RE.test(sentence)) continue;
      const key = normalizeSentenceKey(sentence);
      if (!key || EXEMPT_SENTENCE_KEYS.has(key)) continue;
      keys.push(key);
    }
  }
  return keys;
}

function localIssues(html, kind) {
  const issues = [];
  const text = visibleText(proseRoot(html));
  if (/cruise port profile in the seadays directory/i.test(html)) issues.push('placeholder');
  if (/mw-parser|ⓘ|\/ˈ|\[(?:\d{1,3}|[a-z])\]/.test(text)) issues.push('wiki markup');
  for (const sentence of splitSentences(text)) {
    if (sentence.length < 20) continue;
    if (isDanglingSentence(sentence)) {
      issues.push('cut-off sentence');
      break;
    }
  }

  if (kind === 'ship') {
    const overview = html.match(/<h2>Overview<\/h2>\s*<article\b[^>]*>([\s\S]*?)<\/article>/i);
    if (overview) {
      const first = splitSentences(visibleText(overview[1]))[0] || '';
      const name = pageH1(html).replace(/\s+cruise ship guide$/i, '').trim();
      if (name && !first.toLowerCase().includes(name.toLowerCase())) issues.push('overview subject');
    }
    const gt = firstNumber(factValue(html, 'Gross tonnage'));
    const pax = firstNumber(factValue(html, 'Passenger capacity'));
    const len = firstNumber(factValue(html, 'Length'));
    if (gt && pax) {
      const ratio = gt / pax;
      if (ratio < 15 || ratio > 110) issues.push('spec gt/pax');
    }
    if (gt && len) {
      const density = gt / (len * len);
      if (density < 0.12 || density > 3) issues.push('spec length');
    }
  } else {
    // Unnamed port leads are not a holdback. The 17 Oct 2026 page audit
    // decides which ports to noindex; the rest stay up until they are rewritten.
    const getting = html.match(/<section\b[^>]*id="getting-there"[\s\S]*?<\/section>/i);
    const cards = getting ? (getting[0].match(/<details\b/g) || []).length : 0;
    const terminalFact = firstNumber(factValue(html, 'Terminals'));
    const berthFact = firstNumber(factValue(html, 'Berths'));
    if (terminalFact != null && terminalFact !== cards) issues.push('terminal count');
    if (berthFact != null && getting) {
      let sum = 0;
      for (const match of getting[0].matchAll(/(\d+)\s+berths?/gi)) sum += Number(match[1]);
      if (sum !== berthFact) issues.push('berth count');
    }
    if (/id="related-ports"/.test(html) && !/id="related-ports"[^>]*data-related="curated"/.test(html)) {
      issues.push('default related ports');
    }
    if (/id="ships-calling"/.test(html) && !/id="ships-calling"[^>]*data-related="itinerary"/.test(html)) {
      issues.push('default related ships');
    }
  }
  return issues;
}

/**
 * @param {{ file: string, html: string, kind: 'port'|'ship', slug: string }[]} pages
 */
function evaluatePublishGate(pages) {
  const prepared = pages.map((page) => ({
    ...page,
    local: localIssues(page.html, page.kind),
    sentences: collectSentenceKeys(page.html),
  }));
  const freq = new Map();
  for (const page of prepared) {
    for (const key of new Set(page.sentences)) freq.set(key, (freq.get(key) || 0) + 1);
  }
  return prepared.map((page) => {
    const issues = page.local.slice();
    const shared = [...new Set(page.sentences)].filter((key) => (freq.get(key) || 0) > 6);
    if (shared.length) issues.push(`shared sentence: ${shared[0].slice(0, 90)}`);
    if (page.kind === 'port' && isAuditNoindexPort(page.slug)) issues.push('audit noindex');
    return {
      file: page.file,
      slug: page.slug,
      kind: page.kind,
      issues,
    };
  });
}

module.exports = {
  evaluatePublishGate,
  localIssues,
  collectSentenceKeys,
};
