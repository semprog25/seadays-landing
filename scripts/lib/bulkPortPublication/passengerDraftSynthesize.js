'use strict';

const {
  preparePassengerGuideText,
  stripMarkdownEmphasis,
  containsInternalResearchLeak,
  isResearchItineraryCopy,
} = require('../publicGuideCopySanitize');
const { sectionBody, bulletLines, stripCitationMarkers } = require('../portResearchImport/extractMarkdownSections');
const { isTruncatedResearchCopy } = require('../researchCopyGuards');
const { preferText } = require('../portResearchImport/mergePublicGuide');
const { emptyDraftMeta, PROMPT_VERSION, MAX_TOP_THINGS, MIN_TOP_THINGS } = require('./editorialDraftSchema');
const { hashGuide } = require('./researchFactPack');
const { sanitizePassengerDraftSurfaces } = require('./sanitizePassengerDraftSurfaces');

const BOILERPLATE_RE = /excellent facilities|vibrant port destination|beautiful harbor|gateway to/i;

const DEFAULT_CALL_PLANS = {
  shortCall: 'Stay near the port area and keep a generous buffer before all-aboard.',
  standardCall: 'Combine a central walk, one attraction, and lunch if times allow—start back well before all-aboard.',
  longerCall: 'A second stop or coach outing is realistic only with confirmed transport and an eight-hour or longer window.',
};

function cleanField(text, label, unresolved) {
  const raw = stripMarkdownEmphasis(String(text || '').trim());
  if (!raw) return '';
  const cleaned = preparePassengerGuideText(raw, { label });
  if (!cleaned) {
    if (/\*\*/.test(raw)) unresolved.push(`dropped_markdown_${label}`);
    if (isTruncatedResearchCopy(raw)) unresolved.push(`dropped_truncated_${label}`);
    if (containsInternalResearchLeak(raw) || isResearchItineraryCopy(raw)) unresolved.push(`dropped_research_${label}`);
    return '';
  }
  return cleaned;
}

function isGenericAttractionLine(item) {
  return /waterfront and harbour area when alongside|Central shopping streets|Local museum or church|Ship or partner excursion|Stay near the port on tight calls/i.test(
    String(item || '')
  );
}

function buildTopThings(factPack, existingGuide, unresolved) {
  const fromResearch = (factPack.things_raw?.topThings || [])
    .map((t) => cleanField(t, 'topThing', unresolved))
    .filter(Boolean)
    .filter((t) => !isGenericAttractionLine(t));
  const fromSectionBullets = (factPack.things_section_bullets || [])
    .map((t) => cleanField(t, 'thingsBullet', unresolved))
    .filter(Boolean)
    .filter((t) => !isGenericAttractionLine(t));
  const fromYaml = factPack.attraction_names.map((n) => cleanField(n, 'attraction', unresolved)).filter(Boolean);
  const fromLive = (existingGuide?.thingsToDo?.topThings || [])
    .map((t) => cleanField(t, 'liveTop', unresolved))
    .filter(Boolean)
    .filter((t) => !isGenericAttractionLine(t));
  const merged = [];
  const seen = new Set();
  for (const item of [...fromResearch, ...fromSectionBullets, ...fromYaml, ...fromLive]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= MAX_TOP_THINGS) break;
  }
  if (merged.length < MIN_TOP_THINGS) unresolved.push(`insufficient_supported_attractions_${merged.length}`);
  return merged.slice(0, MAX_TOP_THINGS);
}

function hedgeWalkingClaims(text) {
  let s = String(text || '');
  if (!s) return s;
  if (/\b\d+\s*[-–]\s*\d+\s*minute/i.test(s) || /\babout \d+ minutes/i.test(s)) {
    if (!/confirm|depending|programme|berth|quay/i.test(s)) {
      s = `${s.replace(/\.$/, '')}—confirm on your sailing programme before you rely on a fixed walk time.`;
    }
  }
  return s;
}

function passengerCallPlan(raw, field, unresolved, factPackFallback) {
  const cleaned = cleanField(raw, field, unresolved);
  if (cleaned && /^buffers\s+\d/i.test(cleaned)) {
    unresolved.push(`thin_research_call_plan_${field}`);
    return DEFAULT_CALL_PLANS[field] || DEFAULT_CALL_PLANS.standardCall;
  }
  if (cleaned && !isResearchItineraryCopy(cleaned)) return cleaned;
  const fromResearch = cleanField(factPackFallback, field, unresolved);
  if (fromResearch && /^buffers\s+\d/i.test(fromResearch)) {
    unresolved.push(`thin_research_call_plan_${field}`);
    return DEFAULT_CALL_PLANS[field] || DEFAULT_CALL_PLANS.standardCall;
  }
  if (fromResearch && !isResearchItineraryCopy(fromResearch) && fromResearch.length <= 280) return fromResearch;
  if (raw) unresolved.push(`replaced_research_itinerary_${field}`);
  return DEFAULT_CALL_PLANS[field] || DEFAULT_CALL_PLANS.standardCall;
}

function gateExcursionCopy(text, field, unresolved) {
  const s = String(text || '').toLowerCase();
  const risky = /(petra|wadi rum|hardangervidda|vøringsfossen|voeringfossen|mývatn|myvatn|great barrier|long coach)/i;
  if (!risky.test(s)) return text;
  if (field === 'shortCall' && risky.test(s)) {
    unresolved.push('excursion_on_short_call_research');
    return cleanField(
      'Keep the day local—distant excursions need a pre-booked operator and more time than a short call allows.',
      field,
      unresolved
    );
  }
  unresolved.push(`excursion_claim_${field}`);
  return hedgeWalkingClaims(cleanField(text, field, unresolved));
}

const GENERIC_TERMINAL_LIVE_RE = /cruise terminal at|passenger terminal$|haifa port$/i;
const GENERIC_DISTANCE_LIVE_RE = /^terminal is at the port/i;

function buildFromTerminal(factPack, existingGuide, unresolved) {
  const live = cleanField(existingGuide?.gettingThere?.fromTerminal, 'fromTerminal', unresolved);
  const terminal = factPack.terminal_notes?.[0];
  let terminalBuilt = terminal?.name ? cleanField(terminal.name, 'fromTerminal', unresolved) : '';
  if (terminal?.address) {
    const withAddr = cleanField([terminal.name, terminal.address].filter(Boolean).join(' — '), 'fromTerminal', unresolved);
    if (withAddr) terminalBuilt = withAddr;
  }

  if (live && !containsInternalResearchLeak(live) && !GENERIC_TERMINAL_LIVE_RE.test(live)) return live;
  if (terminalBuilt) return terminalBuilt;

  const arrivalRaw = String(factPack.terminals_arrival || '').split('—')[0].trim();
  const arrival = cleanField(arrivalRaw || factPack.terminals_arrival, 'fromTerminal', unresolved);
  if (arrival) return arrival;

  if (live && !containsInternalResearchLeak(live) && !GENERIC_TERMINAL_LIVE_RE.test(live)) return live;

  const gettingLead = cleanField(factPack.getting_summary, 'fromTerminal', unresolved);
  return gettingLead || '';
}

function buildDistanceGuidance(factPack, existingGuide, unresolved, fromTerminal) {
  const distLive = existingGuide?.gettingThere?.distanceAnswer || existingGuide?.gettingThere?.distanceToCity;
  const fromLive = cleanField(distLive, 'distance', unresolved);
  if (
    fromLive &&
    !containsInternalResearchLeak(fromLive) &&
    !/^Distance depends on berth/i.test(fromLive) &&
    !GENERIC_DISTANCE_LIVE_RE.test(fromLive)
  ) {
    return fromLive;
  }

  const fromSummary = cleanField(factPack.getting_summary, 'distance', unresolved);
  if (fromSummary) return fromSummary;

  for (const bullet of factPack.getting_bullets || []) {
    const b = cleanField(bullet, 'distance', unresolved);
    if (b) return b;
  }

  if (fromTerminal) {
    return 'Check the daily programme for your berth and allow extra time on turnaround or tender days.';
  }
  return '';
}

function synthesizePassengerDraft({ landingSlug, appPortId, portName, country, factPack, existingGuide }) {
  const unresolved = [...(factPack.unresolved || [])];
  const liveDesc = String(existingGuide?.portInfo?.description || '').trim();
  let description = '';
  const researchOverview = cleanField(factPack.overview_raw, 'description', unresolved);
  if (
    liveDesc &&
    !BOILERPLATE_RE.test(liveDesc) &&
    liveDesc.length >= 120 &&
    !containsInternalResearchLeak(liveDesc)
  ) {
    description = cleanField(liveDesc, 'description', unresolved);
  }
  if (!description && researchOverview) description = researchOverview;
  if (!description && liveDesc && !BOILERPLATE_RE.test(liveDesc)) {
    description = cleanField(liveDesc, 'description', unresolved);
  }
  if (!description && portName) {
    description = `${portName} is a cruise call—confirm your berth on the daily programme before you plan the day.`;
    unresolved.push('synthetic_minimal_overview');
  }

  const fromTerminal = buildFromTerminal(factPack, existingGuide, unresolved);
  const distanceAnswer = buildDistanceGuidance(factPack, existingGuide, unresolved, fromTerminal);

  const gt = existingGuide?.gettingThere || {};
  const transportation = Array.isArray(gt.transportation) && gt.transportation.length
    ? gt.transportation
    : ['Walking', 'Taxi', 'Coach excursion'];
  const walkingTime = cleanField(hedgeWalkingClaims(gt.walkingTime), 'walkingTime', unresolved);
  const taxiInfo = cleanField(gt.taxiInfo, 'taxiInfo', unresolved);
  const publicTransport =
    preferText(
      cleanField(gt.publicTransport, 'publicTransport', unresolved),
      cleanField((factPack.getting_bullets || []).join(' '), 'publicTransport', unresolved).slice(0, 400)
    ) || 'Confirm local transport options with the ship on your call date.';

  const thingsRaw = factPack.things_raw || {};
  const tdLive = existingGuide?.thingsToDo || {};
  const intro =
    cleanField(tdLive.intro, 'intro', unresolved) ||
    cleanField(thingsRaw.intro, 'intro', unresolved) ||
    'Pick one neighbourhood or excursion scale and keep time for the gangway queue on the way back.';

  const shortCall = gateExcursionCopy(
    passengerCallPlan(tdLive.shortCall || thingsRaw.shortCall, 'shortCall', unresolved, thingsRaw.shortCall),
    'shortCall',
    unresolved
  );
  const standardCall = gateExcursionCopy(
    passengerCallPlan(tdLive.standardCall || thingsRaw.standardCall, 'standardCall', unresolved, thingsRaw.standardCall),
    'standardCall',
    unresolved
  );
  const longerCall = gateExcursionCopy(
    passengerCallPlan(tdLive.longerCall || thingsRaw.longerCall, 'longerCall', unresolved, thingsRaw.longerCall),
    'longerCall',
    unresolved
  );
  const practicalTip =
    cleanField(tdLive.practicalTip, 'practicalTip', unresolved) ||
    cleanField(thingsRaw.practicalTip, 'practicalTip', unresolved) ||
    (factPack.terminal_notes[0]?.name
      ? `Confirm whether your ship uses ${factPack.terminal_notes[0].name} or another quay before you choose a return landmark.`
      : 'Confirm your berth name on the daily programme before you commit to a return time.');

  const topThings = buildTopThings(factPack, existingGuide, unresolved);

  const meta = emptyDraftMeta({
    research_sha256: factPack.research_sha256,
    existing_guide_hash: hashGuide(existingGuide),
    source_provenance: factPack.provenance,
    unresolved_claims: [...new Set(unresolved)],
    generated_at_utc: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
  });

  const assembled = {
    landing_slug: landingSlug,
    appPortId,
    portName,
    country,
    portInfo: {
      ...(existingGuide?.portInfo || {}),
      description,
    },
    gettingThere: {
      ...gt,
      fromTerminal: fromTerminal || gt.fromTerminal || '',
      transportation,
      distanceToCity: distanceAnswer,
      distanceAnswer,
      walkingTime: walkingTime || gt.walkingTime || '',
      taxiInfo: taxiInfo || gt.taxiInfo || '',
      publicTransport,
    },
    thingsToDo: {
      intro,
      topThings,
      shortCall,
      standardCall,
      longerCall,
      practicalTip,
    },
    shorePlansFirst: true,
    researchImport: meta,
  };
  return sanitizePassengerDraftSurfaces(assembled);
}

module.exports = {
  synthesizePassengerDraft,
  cleanField,
  buildTopThings,
};
