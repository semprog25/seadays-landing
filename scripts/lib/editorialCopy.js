'use strict';

/**
 * Section A copy rules that must survive the next blog generation:
 * roll calls stay free, tipping/gratuity/service-charge copy is removed,
 * recycled place-name summaries are rewritten, and AIDAcosma is spelled
 * the way the line spells it.
 */

const BANNED_TOPIC =
  /\b(?:tipping|gratuities|gratuity|auto-gratuities|auto gratuities|service charges?|service-charges?)\b/i;

// Money-sense tips only. Advice uses of "tips" (cruise tips, share tips) stay.
const MONEY_TIP =
  /\b(?:cash for tips|taxis,\s*tips|tips for staff|small bills for tips|bills for tips|rely on tips|tip extra|tipping expectations)\b/i;

const LEFTOVER_TIP =
  /often go to these teams|pooled systems|cash envelopes|compensation design|budget cash for exceptional|prepaid or added daily|often automatic but add up|\$15[–-]20 per person per day|that auto-post|Watch automatic\b|are real money whether|round up in Italy|culture varies|how you handle\s*,|how you handle\s+and where you eat|delivery\s+vary\b|promotion stacks\s+and drinks|or\s+on many lines|beverage and\s+models|where and beverages|Understood About\b|Fees, and [“"]Base Fare|for and caps|spa\s+added at checkout|debates online often ignore|follow each brand[’']s policies|automatic\s+vary|Crew and guides appreciate cash|Extra cash for exceptional|^Cruise costs include this\.?$/i;

const DROP_SENTENCE =
  /often go to these teams|pooled systems|cash envelopes|compensation design|budget cash for exceptional|prepaid or added daily|often automatic but add up|\$15[–-]20 per person per day|are real money whether|round up in Italy|culture varies|automatic\s+vary|Crew and guides appreciate cash|Extra cash for exceptional|Do crew members rely on tips|should I tip extra|^Cruise costs include this\.?$/i;

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

function rewriteKnownPhrases(text) {
  let s = String(text || '');
  const reps = [
    [/cash for taxis,\s*tips,\s*or small purchases/gi, 'cash for taxis and small purchases'],
    [/taxis,\s*tips,\s*and small vendors/gi, 'taxis and small vendors'],
    [/\s*\(\s*small cash for tips helps\s*\)/gi, ''],
    [/cash for tips assigned to/gi, 'cash assigned to'],
    [
      /Bring small bills for tips on excursions and in port\s*\.\s*Crew and guides appreciate cash\s*\.\s*(?:Cruise travel(?!\s+[A-Za-z])\s*)?/gi,
      'Bring small bills if a port vendor or taxi does not take cards. ',
    ],
    [/Bring small bills on excursions and in port\s*\.\s*/gi, 'Bring small bills if a port vendor or taxi does not take cards. '],
    [/small bills for tips/gi, 'small bills'],
    [/Tipping expectations,\s*terminal/g, 'Terminal'],
    [/Tipping expectations,\s*/gi, ''],
    [/once gratuities and /gi, 'once '],
    [/Gratuities added automatically to packages also increase the true daily cost\.\s*/g, ''],
    [/Automatic gratuities,\s*specialty/g, 'Specialty'],
    [/Automatic gratuities,\s*/gi, ''],
    [/What Crew Wish First-Time Cruisers Understood About/g, 'What Crew Wish First-Time Cruisers Understood'],
    [/Fees, and “Base Fare”/g, 'Fees and “Base Fare”'],
    [/Fees, and "Base Fare"/g, 'Fees and "Base Fare"'],
    [
      /Budget for\s*\.\s*They(?:'|’)re often automatic but add up\s*\.\s*Plan for \$15[–-]20 per person per day on many cruise lines\s*\.\s*(?:Cruise costs include this\s*\.\s*)?(?:Cruise budget tip: factor it in upfront\s*\.\s*)?/g,
      'Budget for the extras that sit outside the fare: drinks, Wi-Fi, excursions, and specialty dining. ',
    ],
    [
      /They(?:'|’)re often automatic but add up\s*\.\s*Plan for \$15[–-]20 per person per day on many cruise lines\s*\.\s*(?:Cruise costs include this\s*\.\s*)?(?:Cruise budget tip: factor it in upfront\s*\.\s*)?/g,
      'Budget for the extras that sit outside the fare: drinks, Wi-Fi, excursions, and specialty dining. ',
    ],
    [/Cruise budget tip: factor it in upfront\s*\.?/g, 'Budget for the extras that sit outside the fare: drinks, Wi-Fi, excursions, and specialty dining.'],
    [/\bgratuities and beverages\b/gi, 'beverages'],
    [/\bGratuities,\s+/g, ''],
    [/\bgratuities,\s+/g, ''],
  ];
  for (const [pattern, replacement] of reps) s = s.replace(pattern, replacement);
  return s;
}

function shouldDropSentence(sentence) {
  return DROP_SENTENCE.test(sentence);
}

function fixFragments(sentence) {
  let s = String(sentence || '');
  s = s.replace(/\bhow you handle\s*,?\s*and where you eat/gi, 'and where you eat');
  s = s.replace(/\bpromotion stacks\s+and drinks/gi, 'promotion stacks drinks');
  s = s.replace(/\bbeverages or\s+on many lines/gi, 'beverages on many lines');
  s = s.replace(/\bbeverage and\s+models/gi, 'beverage models');
  s = s.replace(/\bdelivery\s+vary\b/gi, 'delivery times vary');
  s = s.replace(/\bfor and caps\b/gi, 'for package caps');
  s = s.replace(/\bWatch automatic\s+on beverages/gi, 'Watch beverage charges');
  s = s.replace(/\bspa\s+added at checkout/gi, 'spa extras added at checkout');
  s = s.replace(/\bthat auto-post,?\s*/gi, '');
  s = s.replace(/\bdebates online often ignore/gi, 'Online debates often ignore');
  s = s.replace(/\bwhere\s+and\s+beverages\b/gi, 'where beverages');
  s = s.replace(/\.\s+cruise drink packages\b/g, '. Cruise drink packages');
  s = s.replace(/^\s*and\s+/, '');
  s = s.replace(/,\s*,+/g, ',');
  s = s.replace(/^\s*,\s*/, '');
  s = s.replace(/:\s*,\s*/g, ': ');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/,\s*\)/g, ')');
  s = s.replace(/\(\s*,/g, '(');
  return s.trim();
}

function cleanSentence(part) {
  let s = String(part || '').trim();
  if (!s) return null;
  s = fixFragments(rewriteKnownPhrases(s));
  if (/service charges follow each brand/i.test(s) && /prepay/i.test(s) && /lock rates/i.test(s)) {
    return 'Prepay during promotions to lock rates and avoid surprises at disembarkation.';
  }
  if (shouldDropSentence(s)) return null;
  if (BANNED_TOPIC.test(s) || MONEY_TIP.test(s)) {
    const cleaned = removeBannedClauses(s);
    if (!cleaned || shouldDropSentence(cleaned) || isBrokenAfterRemoval(s, cleaned)) return null;
    if (BANNED_TOPIC.test(cleaned) || MONEY_TIP.test(cleaned)) return null;
    s = fixFragments(cleaned);
  }
  if (!s || shouldDropSentence(s)) return null;
  if (BANNED_TOPIC.test(s) || MONEY_TIP.test(s)) return null;
  return s;
}

function needsSentencePass(text) {
  return BANNED_TOPIC.test(text) || MONEY_TIP.test(text) || LEFTOVER_TIP.test(text);
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
  const rewritten = rewriteKnownPhrases(text);
  if (!needsSentencePass(rewritten)) return rewritten;
  const parts = rewritten.split(/(?<=[.!?])\s+/);
  const kept = [];
  let changed = rewritten !== text;
  for (const part of parts) {
    if (/^some lines auto-add\b/i.test(part) || /\bauto-add gratuities\b/i.test(part)) {
      changed = true;
      continue;
    }
    const cleaned = cleanSentence(part);
    if (cleaned == null) {
      changed = true;
      continue;
    }
    if (cleaned !== part.trim()) changed = true;
    kept.push(cleaned);
  }
  if (!changed) return text;
  return tidyPunctuation(kept.join(' '));
}

function plainOf(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeEmptyStrong(html) {
  return String(html || '')
    .replace(/,\s*<strong>\s*<\/strong>\s*,/gi, ',')
    .replace(/<strong>\s*<\/strong>\s*,\s*/gi, '')
    .replace(/,\s*<strong>\s*<\/strong>/gi, '')
    .replace(/<strong>\s*<\/strong>/gi, '');
}

function blockStillBad(block) {
  const plain = plainOf(block);
  return BANNED_TOPIC.test(plain) || MONEY_TIP.test(plain) || LEFTOVER_TIP.test(plain);
}

function flattenBlock(block) {
  const openMatch = String(block).match(/^<(p|li|h[1-4])\b[^>]*>/i);
  if (!openMatch) return block;
  const open = openMatch[0];
  const tag = openMatch[1].toLowerCase();
  const inner = block.slice(open.length, block.length - (tag.length + 3));
  if (/<(?:a|img|figure|aside)\b/i.test(inner)) return open + removeEmptyStrong(inner) + `</${tag}>`;
  const cleaned = stripBannedTopicText(plainOf(inner));
  if (!cleaned) return '';
  const safe = cleaned.replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `${open}${safe}</${tag}>`;
}

function repairMoneyTipMarkup(html) {
  const source = String(html || '');
  if (
    !/<strong>\s*<\/strong>|service\s*charges?|gratuit|cash for tips|taxis,\s*tips|bills for tips|rely on tips|tip extra|tipping expectations|\$15[–-]20 per person|Understood About|Fees, and [“"]Base Fare/i.test(
      source
    )
  ) {
    return source;
  }
  let out = removeEmptyStrong(source);
  out = out.replace(/(\.\s*(?:<\/strong>\s*)*)<strong>cruise drink packages/gi, '$1<strong>Cruise drink packages');
  out = out.replace(/<(p|li|h[1-4])\b[^>]*>[\s\S]*?<\/\1>/gi, (block) =>
    blockStillBad(block) ? flattenBlock(block) : block
  );
  return out;
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
      let out = repairMoneyTipMarkup(part);
      out = out.replace(
        /(\b(?:content|alt|aria-label)=["'])([\s\S]*?)(["'])/gi,
        (_m, pre, value, post) => pre + applyEditorialCopyToText(value) + post
      );
      out = out.replace(/>([^<]+)</g, (_m, text) => `>${applyEditorialCopyToText(text)}<`);
      return removeEmptyStrong(out);
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
