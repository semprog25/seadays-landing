# PHASE 1 PORT CORRECTION REPORT

Generated: 2026-08-11T21:26:00Z  
Repository: `seadays-landing` only  
Mobile app / Viator builder / `.env`: **unchanged**  
Commit/push: **not performed**

---

## 1. Problems found

1. **Genoa mapping broken** — enrichment + terminals under app ID `genua`, published page `/ports/genoa-italy/`, review key `genoa` → page had no Getting there / terminals / Viator banner.
2. **Palma enrichment on wrong ID** — rich content under `palma`; live page maps to `palma-de-mallorca` and still showed boilerplate getting-there copy.
3. **Amsterdam treated as enriched published port** — guide/terminals exist, but Amsterdam is **absent** from the 323-port SEO cruise dataset.
4. **172+ guides** still had definitive “Visa-free for EU, US, Canada, Australia…” immigration boilerplate.
5. **berthCount < terminalCount** contradictions on Barcelona, Miami, Southampton, Civitavecchia, Copenhagen, Stockholm (stale `berthCount: 2`).
6. Soft/unverified passenger stats: Valencia 500k+, Santorini 1M+; Barcelona needed precise definition; Vigo needed softer wording.
7. Genoa terminal model oversimplified (single Stazioni Marittime card vs Ponte dei Mille + Ponte Andrea Doria).
8. Flagged terminal wording gaps: Piraeus A/B, Cozumel pier assignment caveats, Marseille MPCT distance/shuttle, Bergen multi-quay wording.

---

## 2. Problems fixed

| Item | Fix |
|------|-----|
| Genoa | Alias `genoa` → `genua` in `buildSlugToAppPortIdMap`; terminals updated to Ponte dei Mille + Ponte Andrea Doria |
| Palma | Merged enrichment into `palma-de-mallorca`; moved terminals key; regenerated live page |
| Amsterdam | Documented **not published**; no invented SEO page |
| Visa boilerplate | Replaced across dataset (187 guides touched by correction script) |
| berth contradictions | Nulled misleading `berthCount` where `berthCount < terminalCount` (incl. tender `santorini` 0) |
| Stats | Barcelona verified/defined; Miami kept with FY label; Vigo/Valencia/Santorini softened |
| Terminals | Genoa/Piraeus/Cozumel/Marseille/Bergen wording corrected |
| Usefulness | Light all-aboard / short-call notes on key homeports + highlight prioritization for Barcelona/Palma/Genoa |

---

## 3. Data verified

| Claim | Result | Source |
|-------|--------|--------|
| Barcelona ~4M / 2025 | **Verified** as ~4.0M **pleasure-cruise passenger movements** (official total 3,999,258) | Port de Barcelona Dec 2025 traffic stats / Barcelona City Council summary |
| Miami 8,564,151 FY2025 | **Verified** (kept; labeled fiscal year) | Miami-Dade PortMiami official historical snapshot |
| Genoa cruise terminals | **Verified** Ponte dei Mille + Ponte Andrea Doria under Stazioni Marittime | smge.it / Ports of Genoa operator pages |

---

## 4. Data softened / removed

| Port | Action |
|------|--------|
| Valencia | Removed unverified “Over 500,000…” |
| Santorini | Softened unverified “million+” claim |
| Vigo | Softened “200,000+” to approximate port-authority marketing language + verify note |
| Barcelona/Miami/etc. | `berthCount` nulled where contradictory |
| Santorini | `berthCount: 0` nulled (tender; avoid fake precision) |

---

## 5. Genoa mapping result

```
SEO slug:     genoa-italy
Review key:   genoa
Canonical ID: genua  (app port-name-map)
Terminals:    byPortId.genua
Affiliate:    genua
```

**Before:** unmapped → no guide sections / no Viator on page  
**After:** `genoa-italy → genua`  
Rendered page now includes Getting there, Cruise terminals (Ponte dei Mille + Ponte Andrea Doria), Bookable Experiences + Viator URL.

---

## 6. Palma mapping result

```
SEO slug:     palma-de-mallorca-spain
Canonical ID: palma-de-mallorca
Terminals:    byPortId.palma-de-mallorca  (moved from palma)
```

**Before:** live page used thin `palma-de-mallorca` boilerplate; enrichment sat unused on `palma`  
**After:** enrichment merged into `palma-de-mallorca`; live page shows cathedral/port overview, getting there, terminals, Viator banner; old “Varies by terminal location” gone.

Legacy key `palma` retained only as a thin compatibility stub (not a second Mallorca page).

---

## 7. Amsterdam decision

**NOT an intended published SeaDays SEO port today.**

Evidence:

- Absent from `scripts/lib/appCruiseDataset.js` (323 ports that generate `/ports/`).
- No `/ports/amsterdam-*/` directory.
- Guide IDs `amsterdam` / `amsterdam-ijmuiden` + affiliate IDs exist for app/data compatibility only.

**Action taken:** do **not** invent a page outside the dataset architecture. Enrichment remains in JSON for a future dataset inclusion; it is not passenger-facing now.

---

## 8. Visa wording changes

Replaced definitive boilerplate:

> “Visa-free for EU, US, Canada, Australia, and many others (90 days).”

With nationality-dependent guidance, e.g. Schengen:

> “Entry and visa rules depend on nationality… confirm with official government sources and your cruise line before travel.”

Also replaced overly definitive “EU citizens need ID card only” entry stubs.

**Remaining definitive EU/US/Canada visa boilerplate in guides: 0**  
**On published HTML pages: 0** (spot-checked + scan)

---

## 9. berthCount / terminalCount resolution

**Meaning used:** `terminalCount` ≈ passenger terminal/facility count shown to cruisers; `berthCount` ≈ berthing positions when known.

When `berthCount < terminalCount` with a stale `2`, the berth value was treated as **unreliable leftover** and set to `null` rather than inventing a number.

Ports nulled include: Barcelona, Miami, Southampton, Civitavecchia, Copenhagen, Stockholm, Santorini (0).

Vigo `berthCount: 8` with `terminalCount: 3` left as-is (berths > terminals is plausible).

---

## 10. Terminal verification

| Port | Outcome |
|------|---------|
| Genoa | Updated to Ponte dei Mille + Ponte Andrea Doria (Stazioni Marittime) |
| Piraeus | Clarified Miaoulis Terminal A vs outer berths / internal shuttle |
| Cozumel | Kept Puerta Maya / International Pier with assignment caveats |
| Marseille | MPCT ~8 km; shuttle caveat (no walk through industrial port) |
| Bergen | Multi-quay downtown / Skolten-area wording (not a single exclusive building) |

---

## 11. Mapping audit results

See `data/reports/PORT_MAPPING_AUDIT.md`.

- **CRITICAL:** 0  
- **WARNING:** ~148 (mostly pre-existing published pages with no guide ID, e.g. Lisbon, Juneau, Galveston — deferred; not Phase 1 expansion)  
- Genoa / Palma / Amsterdam special cases: **OK**  
- Pages with guides: **181 / 323** (was 180; Genoa now included)

---

## 12. Tests

| Command | Result |
|---------|--------|
| `npm run smoke-port-guides` | **PASS** |
| `npm run test:unit` | **N/A** — script does not exist in this repo |
| `npm run build` | **N/A** — script does not exist; static site uses `regenerate-port-pages` |

Verified pages: Genoa, Palma, Barcelona, Miami, Southampton, Civitavecchia, Vigo, Naples, Valencia, Malaga, Santorini (+ Hamburg regression sample in regenerate verify).

---

## 13. Build / regenerate

`SEADAYS_APP_ROOT=… node scripts/regenerate-port-pages.js`  
→ wrote **323** port pages (`guides=181`, `terminals=23`, `affiliateShown=181`)

---

## 14. Files changed

- `scripts/lib/publicPortGuideAdapter.js` — Genoa/alias mapping
- `scripts/correct-phase1-port-quality.js` — correction script (new)
- `data/public-port-guides.json`
- `data/public-port-terminals.json`
- `data/landing-cruise-content-overrides.json`
- `ports/**/index.html` (regenerated)
- `data/reports/PORT_MAPPING_AUDIT.md`
- `data/reports/PHASE_1_PORT_CORRECTION_REPORT.md` (this file)
- `data/reports/phase1-quality-correction-actions.json`

**Not changed:** mobile app, Viator URL builder, `known-affiliate-port-ids.json`, `.env`, auth, Supabase, analytics.

---

## 15. Remaining risks

1. **142 published pages still lack guide mappings** (Lisbon, Seattle/Juneau-class gaps, etc.) — foundation work for a later phase; do not enrich blindly.
2. **Amsterdam enrichment is orphaned from `/ports/`** by design until added to `appCruiseDataset`.
3. Climate sections remain somewhat template-shaped (only lightly touched by design).
4. Exact berth counts still mostly unknown (correctly nulled rather than invented).
5. Cozumel/Piraeus pier labels can change with port operations — copy uses assignment caveats.
6. No `test:unit`/`build` scripts in landing `package.json` — rely on smoke + regenerate verification.

---

## Before / after scores (Phase 1 set of 20)

| Port | Before | After | Notes |
|------|-------:|------:|-------|
| Barcelona | 5 | 5 | Stats definition tightened |
| Vigo | 5 | 5 | Softened visitors wording |
| Miami | 5 | 5 | FY label retained |
| Copenhagen | 5 | 5 | berth contradiction cleared |
| Stockholm | 5 | 5 | berth contradiction cleared |
| Civitavecchia | 4 | 4 | berth contradiction cleared |
| Southampton | 4 | 4 | berth contradiction cleared |
| Dubrovnik | 4 | 4 | unchanged materially |
| Marseille | 4 | 4 | distance/shuttle clarified |
| Piraeus | 4 | 4 | A/B wording clarified |
| Cozumel | 4 | 4 | pier caveats |
| Nassau | 4 | 4 | unchanged materially |
| Santorini | 4 | 4 | visa + stats softened |
| Bergen | 4 | 4 | multi-quay wording |
| Naples | 3 | 4 | visa fix |
| Valencia | 3 | 4 | visa + stats softened |
| Malaga | 3 | 4 | visa/entry fix |
| Genoa | 2 | 4 | **mapping fixed + dual terminals** |
| Palma | 2 | 4 | **live page now uses enrichment** |
| Amsterdam | 2 | N/A* | *Correctly unpublished; not scored as live page |

**Previous average (live-oriented): ~3.8**  
**Estimated average for 19 live Phase 1 ports after correction: ~4.4**

---

## Target checklist

| Target | Status |
|--------|--------|
| No known critical mapping problems (Genoa/Palma/Amsterdam) | **MET** |
| No knowingly misleading definitive visa wording | **MET** |
| No unresolved obvious berth/terminal contradictions | **MET** |
| No published enrichment orphaned from intended page (Genoa/Palma) | **MET** |
| Viator/bookable experiences intact on wired ports | **MET** |
| Next-20 catalogue expansion | **NOT DONE** (as required) |

---

**STOP.** No commit. No push.
