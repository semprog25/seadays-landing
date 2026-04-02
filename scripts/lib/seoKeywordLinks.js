'use strict';

/**
 * Injects first-match contextual links to /ships/ and /ports/ in HTML body text
 * (text nodes only; does not modify existing <a> href bodies).
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

function injectKeywordLinksIntoBodyHtml(html, opts = {}) {
  const maxShip = opts.maxShipLinks != null ? opts.maxShipLinks : 2;
  const maxPort = opts.maxPortLinks != null ? opts.maxPortLinks : 2;
  let shipLeft = maxShip;
  let portLeft = maxPort;
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

module.exports = { injectKeywordLinksIntoBodyHtml, SHIP_PHRASES, PORT_PHRASES };
