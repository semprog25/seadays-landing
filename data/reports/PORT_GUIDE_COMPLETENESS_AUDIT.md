# Port Guide Completeness Audit (Phase 1)

Generated: 2026-08-11T21:14:08.344Z

## Dataset

- Guide records in `data/public-port-guides.json`: **468**
- Published SEO port pages under `/ports/`: **323** (+ index)
- Ports with terminal records (after Phase 1 enrichment): **26**
- Affiliate-mapped port IDs (`known-affiliate-port-ids.json`): **468** (file not modified)

## Public PortGuide schema

From website adapter `toPublicGuide`:

- **portInfo**: description, location, timezone, language, currency, population
- **facts**: established, significance, notableFeatures[], culturalHighlights[]
- **size**: portCapacity, terminalCount, berthCount, annualVisitors, citySize
- **climate**: type, averageTemp, bestMonths[], rainySeason, humidity, description
- **politics**: governmentType, stability, visaRequirements, entryRequirements
- **gettingThere**: fromTerminal, transportation[], distanceToCity, walkingTime, taxiInfo, publicTransport
- **terminals** (`public-port-terminals.json`): name, description, terminal_type, facilities[], distance_to_city_center_km, transport_options[], is_primary
- **Viator**: membership in `known-affiliate-port-ids.json` + `buildViatorDestinationUrl()`
- **Things to do**: website SEO highlights / overrides (not community reviews)
- **Traveler questions / Reviews**: derived snippets or app CTA — **do not fabricate**

Hamburg remains the structural/depth reference.

## Completeness tiers (boilerplate-penalized / meaningful depth)

| Tier | Count | Meaning |
|------|------:|---------|
| A — Rich / production quality | 31 | ≥75% meaningful destination-specific depth |
| B — Good but missing several sections | 61 | 55–74% |
| C — Thin | 376 | 35–54% |
| D — Very incomplete | 0 | <35% |

**Key finding:** Almost all 468 guides are *structurally filled*, but most size/capacity and many climate lines were shared boilerplate (e.g. “Handles cruise passengers and cargo vessels”, “Varies by location”). Terminal depth was previously limited to ~10 ports (now 26 after Phase 1).

## Top 20 enrichment candidates (curated — Phase 1)

Prioritized for major cruise traffic, Viator mapping, European/Med + Caribbean hubs, and terminal gaps:

1. **Barcelona** (Spain) — terminals=YES · viator=YES
2. **Vigo** (Spain) — terminals=YES · viator=YES
3. **Miami** (United States) — terminals=YES · viator=YES
4. **Civitavecchia** (Italy) — terminals=YES · viator=YES
5. **Southampton** (United Kingdom) — terminals=YES · viator=YES
6. **Dubrovnik** (Croatia) — terminals=YES · viator=YES
7. **Marseille** (France) — terminals=YES · viator=YES
8. **Genoa (genua)** (Italy) — terminals=YES · viator=YES
9. **Piraeus** (Greece) — terminals=YES · viator=YES
10. **Copenhagen** (Denmark) — terminals=YES · viator=YES
11. **Amsterdam** (Netherlands) — terminals=YES · viator=YES
12. **Naples** (Italy) — terminals=YES · viator=YES
13. **Palma** (Spain) — terminals=YES · viator=YES
14. **Valencia** (Spain) — terminals=YES · viator=YES
15. **Malaga** (Spain) — terminals=YES · viator=YES
16. **Cozumel** (Mexico) — terminals=YES · viator=YES
17. **Nassau** (Bahamas) — terminals=YES · viator=YES
18. **Santorini** (Greece) — terminals=YES · viator=YES
19. **Bergen** (Norway) — terminals=YES · viator=YES
20. **Stockholm** (Sweden) — terminals=YES · viator=YES

Machine audit snapshot: `data/reports/port-guide-completeness-audit.json`  
Enrichment report: `data/reports/phase1-port-guide-enrichment-report.json`
