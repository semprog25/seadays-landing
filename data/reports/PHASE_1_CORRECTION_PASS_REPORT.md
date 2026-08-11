# PHASE 1 CORRECTION PASS

Generated: 2026-08-11T21:50:00Z  
Repository: `seadays-landing` only  
Mobile app / Viator builder / `.env`: **unchanged**  
Commit/push: **not performed**

---

## Summary

| Item | Result |
|------|--------|
| Civitavecchia terminal data | **FIXED** |
| Valencia berthCount | **REMOVED** |
| Things-to-do SEO templates replaced | **19 published Phase 1 pages** (+ Amsterdam JSON-only) |
| Amsterdam published | **NO** |
| Viator integration | **UNCHANGED** |
| Smoke tests | **PASS** |
| Build (regenerate-port-pages) | **PASS** (323 pages) |

---

## 1. Civitavecchia

**FIXED**

- Removed duplicate short card `Terminal Bramante (Pier 12)`.
- Canonicalized Pier 12 South as **Terminal Donato Bramante (Quay 12 South / Pier 12)** (same facility historically called Terminal Bramante; new Donato Bramante building on Quay 12 South per Port Mobility / RCT materials).
- Retained **Terminal Amerigo Vespucci**.
- Added clearly documented RCT facilities **Terminal 10** and **Terminal 25 South**.
- Set `terminalCount` to **4** to match listed records.
- `portCapacity` notes RCT’s wider quay set (commonly cited as five terminal/berth areas) without inventing extra unnamed cards.

Sources consulted: Port Mobility Civitavecchia RCT pages; RCT operations materials; Seatrade/CruiseMapper secondary corroboration for quay naming.

---

## 2. Valencia berthCount

**REMOVED** (`null`)

`15` could not be confidently defined as cruise-specific berths (likely commercial/port-wide). Per rules: remove rather than guess.

---

## 3. Things to do

Destination-specific `guide.thingsToDo` objects added for all Phase 1 ports (20 including Amsterdam JSON).

Published pages now render `buildThingsToDoSection` instead of the SEO filler paragraphs when rich content exists.

Template phrases removed from Phase 1 pages:

- “Guided excursions from…”
- “Photography, markets…”
- “Water-based activities…”

Each port includes:

1. Top things to do  
2. Short call (~4–5h)  
3. Standard call (~6–8h)  
4. Longer call (8+) where appropriate  
5. Practical cruise tip  

---

## 4–5. Terminal / distance corrections

| Port | Change |
|------|--------|
| Palma | EM 1–4 (Poniente/Paraires) vs EM 5–6 (Dique del Oeste); distance ranges; shuttle/walk guidance |
| Málaga | Central Levante / Muelle Uno terminal wording; **Granada framed as full-day excursion only** |
| Cozumel | Three-pier model: **Punta Langosta**, **Puerta Maya**, **International Pier**; rare tender caveat; no hard line→pier guarantees |
| Vigo | Clarified **two concessioned operators inside Alberto Durán** (not distant naming variants) + Comercio secondary |

---

## 6. Statistics

| Port | Action |
|------|--------|
| Barcelona | Kept ~4.0M **pleasure-cruise passenger movements in 2025** (definition retained) |
| Miami | Kept **8,564,151 FY2025** with fiscal-year label |
| Vigo | Kept qualitative “200,000+” marketing language with verify note |
| Others | Soft qualitative volume wording; no fabricated precise annuals |
| Valencia | Soft volume wording + berth removed |

---

## 7–9. Entry / climate / facts

- Entry/visa: nationality-dependent; lightly destination-framed (US/UK/Bahamas/Mexico/Schengen) — no personalized immigration advice.
- Climate: destination-specific cruise-season language (heat, rain, tender/wind where relevant).
- Facts: trimmed overlap with Things-to-do; retained port significance / geography.

---

## 10–12. Reviews / Viator / Amsterdam

- No fake reviews or traveler Q&A generated.
- Viator mappings, PID/MCID, URL builder, Bookable Experiences: **untouched**; banners verified live on spot-checks.
- Amsterdam: enriched in JSON only; **not** in 323 SEO dataset; **no page invented**.

---

## 13–14. Regenerate & QA

```
SEADAYS_APP_ROOT=… npm run regenerate-port-pages
→ wrote 323 port pages (guides=181, terminals=23, affiliateShown=181)

npm run smoke-port-guides → PASS
```

Spot-checks **PASS**: Hamburg, Barcelona, Civitavecchia, Valencia, Palma, Málaga, Cozumel, Vigo, Santorini, Naples.

`npm run build` / `test:unit`: **N/A** (not defined in landing `package.json`); regenerate + smoke used as static validation.

---

## Files changed

- `scripts/phase1-correction-pass.js` (new)
- `scripts/lib/portGuideSections.js` — `thingsToDo` renderer
- `scripts/lib/seoShipPortPages.js` — prefer rich Things-to-do over SEO template
- `scripts/smoke-port-guides.js` — Phase 1 assertions
- `data/public-port-guides.json`
- `data/public-port-terminals.json`
- `data/landing-cruise-content-overrides.json`
- `data/reports/PHASE_1_CORRECTION_PASS_REPORT.md`
- `data/reports/phase1-correction-pass-actions.json`
- `ports/**/index.html` (regenerated)

**Not changed:** mobile app (`Seadays-main`), `.env`, `known-affiliate-port-ids.json`, Viator URL builder.

---

**STOP.** No commit. No push.
