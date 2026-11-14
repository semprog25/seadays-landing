---
name: Ko Samui, Thailand
country: Thailand
region: Asia
port_type: unknown
iana_timezone: Asia/Bangkok
language_codes: [th", "en"]
currency_code: THB
primary_city_coordinates: {latitude: null, longitude: null, location_source_ids: []}
terminals:
- terminal_id: ko-samui-thailand--landing
  name: Ko Samui cruise landing (facility unverified)
  aliases: [Samui]
  operating_status: unknown
  facility_type: port_area_approximate
  address: Ko Samui, Surat Thani
  latitude: null
  longitude: null
  coordinate_precision: unverified
  location_source_ids: []
  assignment_caveat: "Tourism Authority of Thailand destination page returned HTTP 403 this pass. Alongside vs tender, pier LOA and door GPS unverified — confirm with cruise line. Many Samui calls historically tender; do not invent pier metrics."
  accessibility_notes: Not audited.
  transit_notes: Beach/island transfers — minutes unverified.
  verification_status: needs_review
  authority: unverified
attractions:
- id: samui-beach
  name: Samui beaches / Chaweng area
  address: Ko Samui
  latitude: null
  longitude: null
  location_source_ids: []
  typical_visit_minutes: 180
  source_ids: []
  official_url: null
schema_version: 1
port_id: null
slug: ko-samui-thailand
canonical_url: https://seadays.app/ports/ko-samui-thailand/
research_status: needs_review
researched_at_utc: '2026-11-06T11:17:09Z'
verified_at_utc: null
research_owner: F01-Asia
qa_owner: null
related_port_ids: []
ships_integration: app_dynamic
reviews_integration: app_dynamic
experiences_integration: viator_dynamic
source_ids: [S1, S2]
unverified_fields: ["port_id", "terminals[0].latitude", "facility_name", "loa", "related_port_ids"]
---

# Ko Samui, Thailand — SeaDays Cruise Port Guide

## Port day snapshot

- Island call — **landing mode/LOA null** (TAT page 403).
- Often tender historically — **confirm onboard**.
- **Top:** beach time with confirmed transfer.

## Overview

Ko Samui is a Gulf of Thailand island cruise call. The Tourism Authority of Thailand destination page could not be retrieved (HTTP 403) during this pass, and no harbour-authority berth table was saved. Many itineraries tender to a beach or pier; without a primary, this guide refuses to invent quay lengths or walk times. Confirm tender vs alongside and transport with the ship before planning independent time.

## Weather & best season

ERA5 grid 9.52,100.06 (2015-2024 ERA5 Open-Meteo) [S2]:

| Month | Mean max °C | Mean min °C | Mean precip mm |
| --- | ---: | ---: | ---: |
| Jan | 27.9 | 24.6 | 132 |
| Feb | 28.5 | 24.8 | 47 |
| Mar | 29.9 | 25.6 | 38 |
| Apr | 30.9 | 26.6 | 106 |
| May | 31.0 | 26.7 | 107 |
| Jun | 30.9 | 26.5 | 77 |
| Jul | 30.5 | 26.1 | 99 |
| Aug | 30.6 | 26.1 | 80 |
| Sep | 29.6 | 25.6 | 145 |
| Oct | 28.7 | 25.1 | 220 |
| Nov | 28.1 | 24.8 | 286 |
| Dec | 27.8 | 24.7 | 226 |

Wet roughly Oct–Dec; Jan–Apr preferred [S2].

## Port information

**Timezone:** Asia/Bangkok. **Currency:** THB. **Authority:** unverified this pass [S1 gap].

## Cruise terminals

| Landing | Type | Lat | Lon | Precision | Source | Caveat |
| --- | --- | ---: | ---: | --- | --- | --- |
| Unverified Samui landing | port_area_approximate | — | — | unverified | — | Tender vs pier unknown |

## Getting there

Songthaew/taxi after landing — minutes unverified.

## Things to do

### Top things to do

1. **Beach (Chaweng/Lamai)** — with transfer.
2. **Big Buddha / viewpoints** — coach.
3. **Ship beach club** — if offered.

### Short / standard / longer calls

Buffers **75 / 90 / 120 min** (more if tendering).

### Practical cruise tip

Tender queues eat clock — leave early for independent taxis.

## Climate

Use the ERA5 monthly table in Weather & best season [S2].

## Politics & entry requirements

Thailand entry national (not Schengen). Immigration primary **not captured** [S1 gap]. Not legal advice.

## Facts

- Climate verified [S2]; berth metrics pending.

## Size & capacity

Not verified.

## Traveler questions

**Do we tender?** Confirm with the ship — not verified here.

## Reviews

App-driven reviews placeholder. Do not invent ratings, review counts or quotations.

## Cruise relevance

Thai island leisure call with thin primary HTML this pass.

## Best time to visit

Jan–Apr [S2].

## Tips for travelers

- THB; sun protection.
- Confirm tender.
- Large buffer.

## Related ports

`bangkok-laem-chabang-thailand`, `phuket-thailand`, `singapore-singapore`.

## Ships to explore

App-driven ship associations placeholder. Do not invent cruise schedules.

## Bookable experiences

Viator/app dynamic placeholder. Do not invent product IDs.

## Sources & verification

| ID | Source / publisher | URL | Accessed UTC | Published / updated | Claim supported |
| --- | --- | --- | --- | --- | --- |
| S1 | TAT Samui page (attempted) | https://www.tourismthailand.org/Destinations/Provinces/Samui/219 | 2026-11-06 | HTTP 403 | Facility gap |
| S2 | Open-Meteo ERA5 | evidence/climate/om-ko-samui-thailand.json | 2026-11-06 | 2015-2024 ERA5 Open-Meteo | Climate |

## Open questions / missing evidence

- Harbour/pier primary; tender vs alongside; LOA; door GPS; transfer minutes.
