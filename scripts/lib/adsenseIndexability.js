'use strict';

/**
 * Indexability gates for AdSense / thin-content remediation.
 * Keep directories + high-quality detail pages indexable; noindex template-thin clones.
 */

const MIN_SHIP_DESCRIPTION_CHARS = 250;
const MIN_SHIP_CONFIDENCE = 0.7;
const MIN_PORT_DESCRIPTION_CHARS = 360;

/**
 * Sister-ship near-duplicates that remain indexable under length/confidence gates
 * but fail uniqueness (production Jaccard >0.90 after name stripping).
 * Keep one representative per class indexable; noindex the rest.
 */
const SHIP_NEAR_DUPLICATE_NOINDEX = new Set([
  'le-champlain',
  'le-bellot',
]);

/**
 * @param {{ description?: string, confidenceScore?: number, hasContentOverride?: boolean, slug?: string }} ship
 * @returns {boolean}
 */
function isShipDetailIndexable(ship) {
  if (!ship || typeof ship !== 'object') return false;
  const slug = String(ship.slug || '').trim().toLowerCase();
  if (slug && SHIP_NEAR_DUPLICATE_NOINDEX.has(slug)) return false;
  const description = String(ship.description || '').trim();
  const confidence = Number(ship.confidenceScore);
  const hasOverride = Boolean(ship.hasContentOverride);
  if (!hasOverride && description.length < MIN_SHIP_DESCRIPTION_CHARS) return false;
  if (description.length < MIN_SHIP_DESCRIPTION_CHARS) return false;
  if (Number.isFinite(confidence) && confidence < MIN_SHIP_CONFIDENCE) return false;
  // Missing confidence: allow only long unique descriptions
  if (!Number.isFinite(confidence) && description.length < 360) return false;
  return true;
}

/**
 * @param {{ description?: string, hasContentOverride?: boolean, name?: string, country?: string }} port
 * @param {{ thingsToDo?: unknown, portInfo?: { description?: string } } | null | undefined} guide
 * @returns {boolean}
 */
function isPortDetailIndexable(port, guide) {
  if (!port || !String(port.name || '').trim()) return false;
  // Enriched guides are always indexable.
  if (guide && (guide.thingsToDo || (guide.portInfo && guide.portInfo.description))) return true;
  const guideDesc = guide && guide.portInfo && guide.portInfo.description
    ? String(guide.portInfo.description).trim()
    : '';
  const desc = String((port && port.description) || guideDesc || '').trim();
  if (desc.length >= MIN_PORT_DESCRIPTION_CHARS) return true;
  if (port.hasContentOverride && desc.length >= 160) return true;
  // Unique place pages with country context remain useful supporting content.
  if (String(port.country || '').trim().length >= 2 && desc.length >= 80) return true;
  // Thin stubs without geography or prose should not be indexed.
  return false;
}

/**
 * @param {string} html
 * @param {'index, follow' | 'noindex, follow'} robots
 * @returns {string}
 */
function replaceRobotsMeta(html, robots) {
  if (!html || typeof html !== 'string') return html;
  if (/name=["']robots["']/i.test(html)) {
    return html.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="robots" content="${robots}">`
    );
  }
  return html.replace(
    /<meta\s+name=["']viewport["'][^>]*>/i,
    (m) => `${m}\n  <meta name="robots" content="${robots}">`
  );
}

module.exports = {
  MIN_SHIP_DESCRIPTION_CHARS,
  MIN_SHIP_CONFIDENCE,
  MIN_PORT_DESCRIPTION_CHARS,
  SHIP_NEAR_DUPLICATE_NOINDEX,
  isShipDetailIndexable,
  isPortDetailIndexable,
  replaceRobotsMeta,
};
