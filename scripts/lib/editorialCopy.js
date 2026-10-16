'use strict';

/**
 * Section A copy rules that must survive the next blog generation:
 * roll calls stay free, tipping/gratuity/service-charge copy is removed,
 * recycled place-name summaries are rewritten, and AIDAcosma is spelled
 * the way the line spells it.
 */

const BANNED_TOPIC =
  /\b(?:tipping|gratuities|gratuity|auto-gratuities|auto gratuities|service charges?|service-charges?)\b/i;

const SUMMARY_TEMPLATE =
  /([^<>\n"]+?): practical cruise advice covering [^<>\n"]+?, and real scenarios\. Written for travelers who want useful details, not generic tips\./g;

const SUMMARY_BY_TITLE = {
  '7 Ways Planning Your Cruise Properly Saves You Money':
    'Seven planning habits that keep a cruise from costing more than the fare you booked.',
  'River Cruises vs Ocean Cruises: Which Is Right for You':
    'How river cruises and ocean cruises differ in pace, ports, and daily logistics, so you can choose the trip that fits.',
  'Why Last-Minute Cruise Decisions Cost More Money':
    'Why cruise choices made at the last minute tend to cost more, and what to decide before you sail.',
  'Why Balcony Cabins Sell Out First':
    'Why balcony cabins sell out ahead of other categories, and what to check if you still want one.',
  'Best Honeymoon Cruises and Romantic Sailings for 2026':
    'How to choose a honeymoon or romantic sailing in 2026 by pace, cabin, and port style.',
  'The Hidden Costs of Not Using a Cruise Planning App':
    'The costs that show up when cruise plans stay scattered across chats, screenshots, and memory.',
  'How Better Planning Reduces Cruise Expenses Instantly':
    'How deciding excursions, dining, and port timing before you sail keeps cruise spending visible.',
  'How to Get the Best Cruise Cabin Location on Any Ship':
    'How to choose a cruise cabin location for noise, motion, and the walk to the places you actually use.',
  'How to Avoid Getting Sick on a Cruise Ship':
    'Practical habits that lower the chance of getting sick on a cruise, from embarkation through port days.',
  'How to Travel With Kids on a Cruise Without Losing Your Mind':
    'How to plan a cruise with kids so meals, port days, and cabin time stay manageable.',
};

const ROLL_CALL_REPLACEMENTS = [
  [
    /Roll Call access is on SeaDays paid plans;\s*Points Shop can unlock Roll Call posting where available\./g,
    'Roll calls are free in SeaDays.',
  ],
  [
    /Roll Call meetups \(paid sailing-chat access on Basic Monthly\+\)/g,
    'Roll Call meetups, which are free in SeaDays',
  ],
  [
    /sailing chat \/ Roll Call coordination sits on Basic Monthly and higher—use it for prep, not as a pier panic channel/g,
    'Roll calls are free in SeaDays—use them for prep, not as a pier panic channel',
  ],
  [
    /Roll Call access is included on paid plans\./g,
    'Roll calls are free in SeaDays.',
  ],
  [/,\s*Roll Call access\b/g, ''],
  [/\bRoll Call access,\s*/g, ''],
  [/\band Roll Call access\b/g, ''],
  [/\bRoll Call access and\s*/g, ''],
  [/,\s*Roll Call posting\b/g, ''],
  [/\bRoll Call posting,\s*/g, ''],
];

function tidyPunctuation(text) {
  return String(text || '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/\(\s*,/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+—/g, ' —')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s+,/g, ',')
    .trim();
}

function removeBannedClauses(sentence) {
  let s = sentence;
  s = s.replace(/\s*\((?:[^()]*)\b(?:gratuities|gratuity|tipping|service charges?|service-charges?|auto-gratuities)\b[^()]*\)/gi, '');
  s = s.replace(/\b(?:and\s+)?whether\s+(?:auto-)?gratuities?\s+are\s+included\b/gi, '');
  s = s.replace(/\bnote\s+whether\s+gratuity\s+is\s+inside\s+that\s+price,?\s*/gi, '');
  s = s.replace(/\bincluding\s+gratuities\s+and\s+/gi, 'including ');
  s = s.replace(/\bplus\s+gratuities\s+in\s+some\s+fares\s+and\s+not\s+in\s+others\b/gi, '');
  s = s.replace(/,?\s*and\s+auto-gratuities\b/gi, '');
  s = s.replace(/,?\s*auto-gratuities\b/gi, '');
  s = s.replace(/\bauto-gratuities\b/gi, '');
  s = s.replace(/\bgratuities\b,?\s*/gi, '');
  s = s.replace(/\bgratuity\b,?\s*/gi, '');
  s = s.replace(/\btipping\b,?\s*/gi, '');
  s = s.replace(/\bservice[-\s]charges?\b,?\s*/gi, '');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s*,+/g, ',');
  s = s.replace(/\band\s+and\s+/g, 'and ');
  s = s.replace(/\b(including|plus|with|or|and)\s+(and|or)\b/gi, '$1');
  s = s.replace(/\b(including|plus)\s+([.!?])/gi, '$2');
  return tidyPunctuation(s);
}

function isBrokenAfterRemoval(original, cleaned) {
  if (!cleaned || !/[a-z]/i.test(cleaned)) return true;
  if (/\b(auto-add|whether)\b/i.test(cleaned) && !BANNED_TOPIC.test(cleaned) && /\b(auto-add)\b/i.test(original)) {
    return true;
  }
  if (/^(and|or|including|plus|with)\b/i.test(cleaned)) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  return false;
}

/**
 * Remove tipping, gratuity, and service-charge wording from plain text.
 * @param {string} input
 * @returns {string}
 */
function stripBannedTopicText(input) {
  const text = String(input || '');
  if (!BANNED_TOPIC.test(text)) return text;
  const parts = text.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const part of parts) {
    if (!BANNED_TOPIC.test(part)) {
      if (part.trim()) kept.push(part.trim());
      continue;
    }
    if (/^some lines auto-add\b/i.test(part) || /\bauto-add gratuities\b/i.test(part)) continue;
    const cleaned = removeBannedClauses(part);
    if (isBrokenAfterRemoval(part, cleaned)) continue;
    if (BANNED_TOPIC.test(cleaned)) continue;
    kept.push(cleaned);
  }
  return tidyPunctuation(kept.join(' '));
}

/**
 * @param {string} input
 * @returns {string}
 */
function rewriteTemplateSummaries(input) {
  return String(input || '').replace(SUMMARY_TEMPLATE, (_full, title) => {
    const cleanTitle = String(title).replace(/^>/, '').trim();
    return (
      SUMMARY_BY_TITLE[cleanTitle] ||
      `${cleanTitle}. A practical SeaDays guide for this decision, without a recycled port list.`
    );
  });
}

/**
 * @param {string} input
 * @returns {string}
 */
function applyRollCallFreeCopy(input) {
  let text = String(input || '');
  let changed = false;
  for (const [pattern, replacement] of ROLL_CALL_REPLACEMENTS) {
    const next = text.replace(pattern, replacement);
    if (next !== text) changed = true;
    text = next;
  }
  return changed ? tidyPunctuation(text) : text;
}

/**
 * @param {string} input
 * @returns {string}
 */
function applyNameFixes(input) {
  return String(input || '')
    .replace(/\bAIDACosma\b/g, 'AIDAcosma')
    .replace(/\ba AIDA\b/g, 'an AIDA')
    .replace(/\ba Oceania\b/g, 'an Oceania');
}

/**
 * @param {string} input
 * @returns {string}
 */
function applyEditorialCopyToText(input) {
  return applyNameFixes(applyRollCallFreeCopy(rewriteTemplateSummaries(stripBannedTopicText(input))));
}

/**
 * Clean visible copy, meta descriptions, and JSON-LD text.
 * Leaves script and style blocks alone except JSON-LD string values.
 * @param {string} html
 * @returns {string}
 */
function applyEditorialCopyToHtml(html) {
  const source = String(html || '');
  const parts = source.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi);
  return parts
    .map((part) => {
      if (/^<style\b/i.test(part)) return part;
      if (/^<script\b/i.test(part)) {
        if (!/application\/ld\+json/i.test(part)) return applyNameFixes(part);
        return part.replace(/"(?:\\.|[^"\\])*"/g, (token) => {
          const raw = token.slice(1, -1);
          const decoded = raw.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
          const next = applyEditorialCopyToText(decoded);
          if (next === decoded) return token;
          return JSON.stringify(next);
        });
      }
      let out = part.replace(
        /(\b(?:content|alt|aria-label)=["'])([\s\S]*?)(["'])/gi,
        (_m, pre, value, post) => pre + applyEditorialCopyToText(value) + post
      );
      out = out.replace(/>([^<]+)</g, (_m, text) => `>${applyEditorialCopyToText(text)}<`);
      return out;
    })
    .join('');
}

/**
 * @param {object} article
 * @returns {object}
 */
function sanitizeArticleCopy(article) {
  if (!article || typeof article !== 'object') return article;
  for (const key of ['excerpt', 'seoDescription', 'metaDescription', 'description']) {
    if (typeof article[key] === 'string' && article[key]) {
      article[key] = applyEditorialCopyToText(article[key]);
    }
  }
  return article;
}

module.exports = {
  BANNED_TOPIC,
  SUMMARY_BY_TITLE,
  stripBannedTopicText,
  rewriteTemplateSummaries,
  applyRollCallFreeCopy,
  applyNameFixes,
  applyEditorialCopyToText,
  applyEditorialCopyToHtml,
  sanitizeArticleCopy,
};
