'use strict';

/** Used when Supabase /reviews/ships|ports returns empty (local dev, API down). */
const FALLBACK_SHIP_GRID = [
  { id: 'wonder', name: 'Wonder of the Seas', cruiseLine: 'Royal Caribbean International', description: 'Oasis-class megaship with neighborhoods, pools, and broad dining variety for families and couples.', highlights: ['Neighborhood concept', 'Broad dining', 'Family activities'] },
  { id: 'encore', name: 'Norwegian Encore', cruiseLine: 'Norwegian Cruise Line', description: 'Modern NCL ship with racetrack, Broadway-style shows, and flexible dining.', highlights: ['Go-kart track', 'Flexible dining', 'Observation lounge'] },
  { id: 'celebration', name: 'Carnival Celebration', cruiseLine: 'Carnival Cruise Line', description: 'Excel-class fun ship with zones for food, comedy, and outdoor attractions.', highlights: ['Zones', 'Casual dining', 'Family fun'] },
  { id: 'seaside', name: 'MSC Seaside', cruiseLine: 'MSC Cruises', description: 'Miami-style design with waterfront promenade and international dining.', highlights: ['Promenade', 'Pools', 'International menus'] },
  { id: 'wish', name: 'Disney Wish', cruiseLine: 'Disney Cruise Line', description: 'Disney storytelling at sea with family cabins and themed dining.', highlights: ['Family focus', 'Themed dining', 'Kids clubs'] },
  { id: 'beyond', name: 'Celebrity Beyond', cruiseLine: 'Celebrity Cruises', description: 'Edge-series ship with modern design, fine dining, and wellness spaces.', highlights: ['Wellness', 'Fine dining', 'Modern suites'] },
  { id: 'discovery-princess', name: 'Discovery Princess', cruiseLine: 'Princess Cruises', description: 'Medallion-enabled ship with relaxed pacing and international itineraries.', highlights: ['Medallion', 'Relaxed pace', 'Global routes'] },
  { id: 'scarlet', name: 'Scarlet Lady', cruiseLine: 'Virgin Voyages', description: 'Adults-only sailing with modern cabins and inclusive dining concepts.', highlights: ['Adults-only', 'Inclusive dining', 'Modern vibe'] },
];

const FALLBACK_PORT_GRID = [
  { id: 'miami', portName: 'Miami', country: 'United States', region: 'North America', description: 'Major Florida embarkation hub with pre-cruise hotels and air access.', highlights: ['Pre-cruise stays', 'Air connections', 'Multiple terminals'], popularMonths: ['Year-round'] },
  { id: 'barcelona', portName: 'Barcelona', country: 'Spain', region: 'Mediterranean', description: 'Iconic city port pairing culture with Mediterranean itineraries.', highlights: ['Gothic Quarter', 'Beaches', 'Food scene'], popularMonths: ['April', 'May', 'June', 'September', 'October'] },
  { id: 'civitavecchia', portName: 'Civitavecchia (Rome)', country: 'Italy', region: 'Mediterranean', description: 'Gateway for Rome and central Italy cruises.', highlights: ['Rome access', 'Train links', 'Coastal charm'], popularMonths: ['April', 'May', 'September', 'October'] },
  { id: 'nassau', portName: 'Nassau', country: 'Bahamas', region: 'Caribbean', description: 'Short-cruise favorite with beaches and excursions.', highlights: ['Beaches', 'Snorkeling', 'Straw market'], popularMonths: ['Year-round'] },
  { id: 'cozumel', portName: 'Cozumel', country: 'Mexico', region: 'Caribbean', description: 'Western Caribbean port known for reefs and beach clubs.', highlights: ['Reefs', 'Beach clubs', 'Mayan sites'], popularMonths: ['Year-round'] },
  { id: 'juneau', portName: 'Juneau', country: 'United States', region: 'Alaska', description: 'Alaska capital with glacier and wildlife excursions.', highlights: ['Mendenhall Glacier', 'Whale watching', 'Tram'], popularMonths: ['May', 'June', 'July', 'August', 'September'] },
  { id: 'southampton', portName: 'Southampton', country: 'United Kingdom', region: 'Northern Europe', description: 'Major UK embarkation port for Northern Europe sailings.', highlights: ['London access', 'Historic docks', 'Channel routes'], popularMonths: ['May', 'June', 'July', 'August'] },
  { id: 'sydney', portName: 'Sydney', country: 'Australia', region: 'Australia', description: 'Harbor city with iconic embarkation near the Opera House.', highlights: ['Harbor views', 'City tours', 'Beaches'], popularMonths: ['October', 'November', 'December', 'January', 'February', 'March'] },
];

module.exports = { FALLBACK_SHIP_GRID, FALLBACK_PORT_GRID };
