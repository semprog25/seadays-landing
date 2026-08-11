'use strict';

/**
 * Injects first-match contextual links to /ships/ and /ports/ in HTML body text
 * (text nodes only; does not modify existing <a> href bodies).
 *
 * When `opts.portLinks` is provided ({ phrase: '/ports/slug/' }), specific port
 * names link to their Port Guide pages before generic region phrases.
 */

const SHIP_PHRASES = [
  'Royal Caribbean',
  'Norwegian Cruise Line',
  'MSC Cruises',
  'Carnival Cruise Line',
  'Disney Cruise Line',
  'Celebrity Cruises',
  'Princess Cruises',
  'Holland America Line',
  'Virgin Voyages',
  'Cunard Line',
  'AIDA Cruises',
  'Costa Cruises',
];

const PORT_PHRASES = [
  'Eastern Caribbean',
  'Western Caribbean',
  'Southern Caribbean',
  'the Caribbean',
  'Caribbean',
  'Mediterranean',
  'Western Mediterranean',
  'Eastern Mediterranean',
  'Alaska',
  'Northern Europe',
  'Baltic Sea',
  'Bahamas',
  'Panama Canal',
  'Norwegian fjords',
  'Greek Isles',
  'Mexican Riviera',
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPortLinkEntries(portLinks) {
  if (!portLinks || typeof portLinks !== 'object') return [];
  return Object.keys(portLinks)
    .filter((k) => k && portLinks[k])
    .sort((a, b) => b.length - a.length)
    .map((phrase) => ({ phrase, href: String(portLinks[phrase]) }));
}

function injectKeywordLinksIntoBodyHtml(html, opts = {}) {
  const maxShip = opts.maxShipLinks != null ? opts.maxShipLinks : 2;
  const maxPort = opts.maxPortLinks != null ? opts.maxPortLinks : 2;
  const maxSpecific = opts.maxSpecificPortLinks != null ? opts.maxSpecificPortLinks : 3;
  let shipLeft = maxShip;
  let portLeft = maxPort;
  let specificLeft = maxSpecific;
  const specificPorts = buildPortLinkEntries(opts.portLinks);
  const parts = html.split(/(<[^>]+>)/g);
  const out = [];
  let anchorDepth = 0;
  for (const part of parts) {
    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) anchorDepth++;
      else if (/^<\/a\s*>/i.test(part)) anchorDepth = Math.max(0, anchorDepth - 1);
      out.push(part);
      continue;
    }
    if (anchorDepth > 0) {
      out.push(part);
      continue;
    }
    let seg = part;
    let insertedLinkInSegment = false;

    if (specificLeft > 0 && specificPorts.length) {
      for (const entry of specificPorts) {
        if (specificLeft <= 0) break;
        const re = new RegExp(`(^|[^\\w])(${escapeRegExp(entry.phrase)})(?!\\w)`, 'i');
        if (!re.test(seg)) continue;
        specificLeft--;
        seg = seg.replace(
          re,
          (full, before, matched) =>
            `${before}<a href="${entry.href}" class="contextual-link port-guide-link">${matched}</a>`
        );
        insertedLinkInSegment = true;
        break;
      }
    }

    if (shipLeft > 0) {
      for (const phrase of SHIP_PHRASES) {
        if (shipLeft <= 0) break;
        const re = new RegExp(`(^|[^\\w])(${escapeRegExp(phrase)})(?!\\w)`, 'i');
        if (!re.test(seg)) continue;
        shipLeft--;
        seg = seg.replace(re, (full, before, matched) => `${before}<a href="/ships/" class="contextual-link">${matched}</a>`);
        insertedLinkInSegment = true;
        break;
      }
    }
    if (!insertedLinkInSegment && portLeft > 0) {
      for (const phrase of PORT_PHRASES) {
        if (portLeft <= 0) break;
        const re = new RegExp(`(^|[^\\w])(${escapeRegExp(phrase)})(?!\\w)`, 'i');
        if (!re.test(seg)) continue;
        portLeft--;
        seg = seg.replace(re, (full, before, matched) => `${before}<a href="/ports/" class="contextual-link">${matched}</a>`);
        insertedLinkInSegment = true;
        break;
      }
    }
    out.push(seg);
  }
  return out.join('');
}

/**
 * Build phrase → /ports/<slug>/ map from seo port records (name + "Name, Country").
 * Skips short / ambiguous names that collide with English words.
 */
function buildPortLinksFromSeoPorts(seoPorts) {
  const BLOCKLIST = new Set([
    'split',
    'nice',
    'bar',
    'bali',
    'cork',
    'bari',
    'rome',
    'lima',
    'aden',
    'para',
    'male',
    'sale',
    'port',
    'bay',
  ]);
  const map = {};
  for (const p of Array.isArray(seoPorts) ? seoPorts : []) {
    const slug = String(p.slug || '').trim();
    const name = String(p.name || '').trim();
    if (!slug || !name || name.length < 5) continue;
    if (BLOCKLIST.has(name.toLowerCase())) continue;
    const href = `/ports/${slug}/`;
    map[name] = href;
    if (p.country) map[`${name}, ${p.country}`] = href;
    if (name.length >= 5) map[`${name} cruise port`] = href;
  }
  return map;
}

module.exports = {
  injectKeywordLinksIntoBodyHtml,
  SHIP_PHRASES,
  PORT_PHRASES,
  buildPortLinksFromSeoPorts,
};
