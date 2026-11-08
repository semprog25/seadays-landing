'use strict';

/**
 * Passenger-facing editorial for Stage 15 five-port pilot (not raw Claire markdown).
 * Source: verified research deliverables 2026-11-06; no invented terminal coordinates.
 */

const STAGE15_PILOT_SLUGS = [
  'aarhus-denmark',
  'akureyri-iceland',
  'eidfjord-norway',
  'aqaba-jordan',
  'aruba-oranjestad-aruba',
];

const STAGE15_PILOT_GUIDES = {
  aarhus: {
    appPortId: 'aarhus',
    portName: 'Aarhus',
    country: 'Denmark',
    portInfo: {
      description:
        'Aarhus is Denmark’s lively second city on a semi-urban cruise quay. Confirm whether you are at the main cruise quay or Omni Terminal on your daily programme before you plan the day.',
      location: '',
      timezone: 'CET (UTC+1) / CEST (UTC+2)',
      language: 'Danish',
      currency: 'Danish Krone (DKK)',
      population: '',
    },
    gettingThere: {
      fromTerminal:
        'Cruise ships use Port of Aarhus quays at Vandvejen 7. The port describes the city centre as close to the waterfront; berth names and ship length limits vary by quay. Check your sailing documents before you leave the ship.',
      transportation: ['Walking', 'Bus', 'Taxi', 'Local train'],
      distanceToCity: 'Semi-urban quay; many guests reach the main shopping streets on foot when alongside.',
      distanceAnswer:
        'The port positions the city centre near the cruise quay; walking is practical for many mobile guests when your ship is on the waterfront berths.',
      walkingTime:
        'Allow roughly 15–25 minutes on foot to central ARoS and Latin Quarter areas depending on berth fencing and crowds.',
      taxiInfo: 'Taxis are available at the port when ships call; confirm a return pick-up time for longer outings.',
      publicTransport:
        'Local buses and trains serve Aarhus from near the harbour. Use Rejseplanen for live times on your call date.',
    },
    thingsToDo: {
      intro:
        'Cluster one neighbourhood—waterfront, Latin Quarter, or a single museum—so you keep time for gangway queues and security on the way back.',
      topThings: [
        'Aarhus city centre and waterfront promenade',
        'ARoS Aarhus Art Museum (check hours before you commit)',
        'Latin Quarter lanes and cafés',
        'Den Gamle By open-air museum on longer calls',
        'Marselisborg or beach loop only if you have confirmed transport and return time',
      ],
      shortCall:
        'After you clear the berth, stay in the centre: waterfront walk, one cultural stop such as ARoS if tickets allow, and a café before heading back. Keep a generous buffer for security and the gangway queue.',
      standardCall:
        'You can combine a museum visit, lunch in the Latin Quarter, and a waterfront loop on a typical six-to-eight-hour call. Check opening times before you commit, and start your return well before all-aboard.',
      longerCall:
        'With eight hours or more, Den Gamle By or a second museum is realistic only if you have confirmed bus or taxi timings and a clear path back. On overnight calls, reconfirm reboarding rules with the ship.',
      practicalTip:
        'Confirm cruise quay versus Omni Terminal 503 on your programme—berth length and depth limits differ between them.',
    },
    shorePlansFirst: true,
    researchImport: {
      schema_version: 1,
      publication_tier: 'passenger_editorial',
      editorial_rewrite: 'stage15-pilot',
      landing_slug: 'aarhus-denmark',
      qa_verdict: 'PASS',
      content_only_apply: true,
    },
  },
  akureyri: {
    appPortId: 'akureyri',
    portName: 'Akureyri',
    country: 'Iceland',
    portInfo: {
      description:
        'Akureyri is North Iceland’s main harbour town in Eyjafjörður. Ask the ship which quay you are using—larger vessels often use the longer Tangabryggja or Oddeyrarbryggja berths.',
      location: '',
      timezone: 'GMT (UTC+0)',
      language: 'Icelandic',
      currency: 'Icelandic Króna (ISK)',
      population: '',
    },
    gettingThere: {
      fromTerminal:
        'Cruise ships berth at Port of Akureyri quays along the waterfront. Published walk times to downtown were not verified in research—confirm distance and transport with the crew on your sailing.',
      transportation: ['Walking', 'Taxi', 'Bus', 'Coach excursions'],
      distanceToCity: 'Harbour adjoins town; exact minutes depend on berth assignment.',
      distanceAnswer:
        'The port is integrated with Akureyri town, but gangway-to-centre time varies by quay—confirm on board rather than assuming a fixed walk.',
      walkingTime:
        'If your berth is central, many guests reach the main shopping streets in about 15–30 minutes on foot; shuttle or taxi may be offered on busy days.',
      taxiInfo: 'Taxis meet ships when available; book return time for waterfall or Mývatn coaches.',
      publicTransport:
        'Local buses link the harbour area with town services. Excursion coaches are the practical choice for Goðafoss or Mývatn on longer days.',
    },
    thingsToDo: {
      intro:
        'Pick one scale: compact town centre, a single nearby garden or church, or a pre-booked coach day—North Iceland distances eat time quickly.',
      topThings: [
        'Town centre waterfront and main shopping streets',
        'Akureyri Botanical Garden when open',
        'Church of Akureyri and hillside views',
        'Goðafoss waterfall on a coach half-day with confirmed timing',
        'Mývatn region only on long calls with a licensed excursion',
      ],
      shortCall:
        'Stay in Akureyri centre: waterfront stroll, botanical garden or church if open, and coffee before you head back. Keep at least 75 minutes before all-aboard for gangway and security.',
      standardCall:
        'Combine town centre, lunch, and one attraction such as the botanical garden or a short coach to a nearby viewpoint. Start your return with a 90-minute buffer before all-aboard.',
      longerCall:
        'Goðafoss or Mývatn-style outings need pre-booked coaches and a two-hour-plus return margin. Do not commit unless the operator matches your ship’s timetable.',
      practicalTip:
        'Larger ships typically use Tangabryggja or Oddeyrarbryggia—confirm which of the three quays your sailing uses before you choose a return landmark.',
    },
    shorePlansFirst: true,
    researchImport: {
      schema_version: 1,
      publication_tier: 'passenger_editorial',
      editorial_rewrite: 'stage15-pilot',
      landing_slug: 'akureyri-iceland',
      qa_verdict: 'PASS',
      content_only_apply: true,
    },
  },
  eidfjord: {
    appPortId: 'eidfjord',
    portName: 'Eidfjord',
    country: 'Norway',
    portInfo: {
      description:
        'Eidfjord is a compact Hardangerfjord village call with the pier near the centre. Most guests use coaches for Vøringsfossen—confirm departure times and weather on your sailing day.',
      location: '',
      timezone: 'CET (UTC+1)',
      language: 'Norwegian',
      currency: 'Norwegian Krone (NOK)',
      population: '',
    },
    gettingThere: {
      fromTerminal:
        'Eidfjord Cruise Port places ships alongside near the village. The town centre is walkable from the quay for most mobile guests.',
      transportation: ['Walking', 'Coach', 'Taxi'],
      distanceToCity: 'Village quay; centre is a short walk for most calls.',
      distanceAnswer:
        'The cruise kai is in the village centre—many guests reach shops and the fjord shore on foot within minutes.',
      walkingTime: 'Town services and the fjord shore are typically within a 10–20 minute walk from the quay.',
      taxiInfo: 'Taxis are limited; coaches to Vøringsfossen are the usual option on standard calls.',
      publicTransport:
        'Pre-booked excursion coaches cover Vøringsfossen and Hardangervidda routes. There is no practical independent bus link for a short call.',
    },
    thingsToDo: {
      intro:
        'Weather and coach capacity drive the day. A village loop is the safe default; waterfall coaches need confirmed seats and return time.',
      topThings: [
        'Eidfjord village stroll and fjord shoreline',
        'Vøringsfossen viewpoints via pre-booked coach',
        'Hardangervidda nature outings on longer days',
        'Local café stop as a weather buffer',
        'Photo stops only when coaches run on schedule',
      ],
      shortCall:
        'Stay in the village: short fjord walk, one café or shop stop, and head back with at least 75 minutes before all-aboard. Vøringsfossen usually will not fit a 4–5 hour window.',
      standardCall:
        'A timed coach to Vøringsfossen plus a village walk fits many six-to-eight-hour calls if seats are available. Keep a 90-minute buffer for traffic and gangway queues.',
      longerCall:
        'Hardangervidda or a second nature stop is realistic only with eight hours or more, confirmed coach timing, and a two-hour return margin.',
      practicalTip:
        'Ship routing under the Hardanger Bridge can affect arrival time—coach departures to Vøringsfossen may shift; reconfirm at the excursion desk.',
    },
    shorePlansFirst: true,
    researchImport: {
      schema_version: 1,
      publication_tier: 'passenger_editorial',
      editorial_rewrite: 'stage15-pilot',
      landing_slug: 'eidfjord-norway',
      qa_verdict: 'PASS',
      content_only_apply: true,
    },
  },
  aqaba: {
    appPortId: 'aqaba',
    portName: 'Aqaba',
    country: 'Jordan',
    portInfo: {
      description:
        'Aqaba is Jordan’s Red Sea gateway. You can keep the day local around the castle and waterfront, or book a long coach to Petra or Wadi Rum—those need a full day, not a short call.',
      location: '',
      timezone: 'Asia/Amman (UTC+3)',
      language: 'Arabic',
      currency: 'Jordanian Dinar (JOD)',
      population: '',
    },
    gettingThere: {
      fromTerminal:
        'Cruise passengers use the dedicated Aqaba cruise terminal area. Gate layout and accessible boarding vary by sailing—follow your ship’s shuttle or tour instructions rather than the separate ferry terminal nearby.',
      transportation: ['Ship shuttle', 'Taxi', 'Coach excursion'],
      distanceToCity: 'Terminal to downtown sights needs a taxi, shuttle, or organised transfer.',
      distanceAnswer:
        'The cruise terminal is not a walking-distance city centre; plan a confirmed vehicle for castle, museum, or beach outings.',
      walkingTime: 'Do not assume a gangway-to-town walk; use ship-approved transport.',
      taxiInfo: 'Licensed taxis and tour coaches are the practical options; agree return time before you leave.',
      publicTransport:
        'Independent buses are poor fit for cruise deadlines. Pre-booked excursions or ship tours are safer for Wadi Rum and Petra.',
    },
    thingsToDo: {
      intro:
        'Choose one scale: Aqaba fort and museum, a marine-park beach outing with an operator, Wadi Rum desert, or Petra—never stack Petra onto a short call.',
      topThings: [
        'Aqaba Castle and waterfront history',
        'Aqaba Archaeological Museum when open',
        'South Beach / marine park with a licensed operator',
        'Wadi Rum desert outing with arranged vehicle access',
        'Petra from Wadi Musa on long calls with timed entry only',
      ],
      shortCall:
        'Keep it local: castle and adjoining museum or waterfront if open, then return with a 60–90 minute buffer before all-aboard. Petra and Wadi Rum are out of scope on 4–5 hours.',
      standardCall:
        'A Wadi Rum half-day or a deeper Aqaba museum and lunch loop can work on six-to-eight hours with pre-booked transport. Build extra margin for loading and traffic.',
      longerCall:
        'Petra needs most of the day plus substantial walking at the site. Book only with a line-approved operator and a return time that clears your ship’s deadline.',
      practicalTip:
        'Confirm whether your itinerary uses ship time or Jordan local time, especially on multi-country sailings—mixing clocks has caused missed all-aboard.',
    },
    shorePlansFirst: true,
    researchImport: {
      schema_version: 1,
      publication_tier: 'passenger_editorial',
      editorial_rewrite: 'stage15-pilot',
      landing_slug: 'aqaba-jordan',
      qa_verdict: 'PASS',
      content_only_apply: true,
    },
  },
  aruba: {
    appPortId: 'aruba',
    portName: 'Aruba',
    country: 'Aruba',
    portInfo: {
      description:
        'Oranjestad is Aruba’s cruise gateway with APA waterfront berths. Confirm your berth with the daily programme, then pick either downtown museums or a beach run—not both on a tight call.',
      location: '',
      timezone: 'AST (UTC-4)',
      language: 'Dutch, Papiamento',
      currency: 'Aruban Florin (AWG)',
      population: '',
    },
    gettingThere: {
      fromTerminal:
        'Cruise ships berth at Aruba Ports Authority quays in Oranjestad. APA describes taxis outside the terminal and downtown museums within walking reach for some berths—confirm your pier before you commit to a walk.',
      transportation: ['Walking', 'Taxi', 'Bus'],
      distanceToCity: 'Downtown Oranjestad is walkable from many berths; beaches need a taxi.',
      distanceAnswer:
        'Fort Zoutman and the archaeological museum are in Oranjestad; APA notes beaches are a short taxi ride without naming a fixed journey time.',
      walkingTime:
        'When alongside downtown, many guests reach Fort Zoutman in about 10–20 minutes on foot depending on berth and heat.',
      taxiInfo: 'Taxis queue at the terminal; agree pickup point and return time for Eagle Beach or lighthouse runs.',
      publicTransport:
        'Buses serve the island from the terminal area; taxis are simpler for beach or lighthouse timings on a port day.',
    },
    thingsToDo: {
      intro:
        'Heat and berth location matter. A downtown museum loop is the low-transfer option; beaches and Arikok need confirmed rides and longer windows.',
      topThings: [
        'Fort Zoutman Historical Museum in Oranjestad',
        'National Archaeological Museum Aruba',
        'Eagle Beach with a named taxi pickup',
        'Arikok National Park on a guided half-day or longer',
        'California Lighthouse viewpoint in Noord with confirmed access',
      ],
      shortCall:
        'After the ship clears you ashore, do Fort Zoutman and the archaeological museum if both are open, then head back with a full hour before all-aboard.',
      standardCall:
        'Pair downtown museums with either Eagle Beach or the California Lighthouse—not both distant stops unless you have pre-booked transport and an 8-hour window.',
      longerCall:
        'Arikok or a beach-plus-lighthouse combination needs eight hours or more, licensed transport, and a generous return buffer in afternoon heat.',
      practicalTip:
        'APA lists different berth lengths and terminal buildings—mega-ship berths are not always steps from downtown; check your berth on the programme before planning a walk back.',
    },
    shorePlansFirst: true,
    researchImport: {
      schema_version: 1,
      publication_tier: 'passenger_editorial',
      editorial_rewrite: 'stage15-pilot',
      landing_slug: 'aruba-oranjestad-aruba',
      qa_verdict: 'PASS',
      content_only_apply: true,
    },
  },
};

module.exports = {
  STAGE15_PILOT_SLUGS,
  STAGE15_PILOT_GUIDES,
};
