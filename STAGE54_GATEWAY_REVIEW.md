# Stage 54 — Gateway and canonical review (11 ports)

## Canonical identity

| Slug | appPortId | Notes |
|------|-----------|--------|
| `bod-norway` | `bodo` | SEO slug **bod-norway** maps to app id **`bodo`** (Bodø). Not conflated with other Norway ports. |
| `eilat-israel` | `eilat` | Single Red Sea gateway id. |
| `ravenna-italy` | `ravenna` | **Porto Corsini** cruise terminal; distinct from `trieste` and from composite `venice-ravenna-trieste-italy`. |
| `trieste-italy` | `trieste` | Adriatic city port; composite slug still excluded. |
| `mormugao-port-goa-india` | `mormugao` | Goa cruise gateway (secondary slug policy vs `goa-india`). |
| `mumbai-india` | `mumbai` | Ballard Pier Extension passenger berth facts cited; door GPS null in research. |
| `roseau-dominica` | `dominica` | Canonical id `dominica` (not `roseau`). |
| Others | almeria, harstad, montego-bay, la-romana | Standard 1:1 slug ↔ appPortId. |

**11 unique appPortIds** verified on manifest.

---

## Priority gateway notes

### Bodø (`bod-norway` / `bodo`)
- Description cites Port of Bodø / Visit Bodø collaboration; **no LOA/draft table** in published English cruise copy (aligned with research).
- Getting there: centre distance **not verified**.
- **Concern:** call-plan minute estimates in JSON (`timing_est` heuristic) — passengers should treat as editorial buffers only.

### Ravenna vs Trieste vs Venice composite
- Ravenna copy anchors **Molo Crociere, Porto Corsini** and inland UNESCO transfer need — **not** a Venice terminal interchange page.
- Trieste copy is thinner (generic berth confirm + qualified 10–15 min walk).
- Composite `venice-ravenna-trieste-italy` **unchanged** on branch (correct).

### Eilat
- **Cruise-operation uncertainty** explicitly preserved: hall geometry unverified, programme/tender language in getting-there.
- No claim that port is closed; also **no owner-verified “cruises currently call”** attestation (Stage 31 gate still open).

### Mumbai & Mormugao
- Mumbai: MbPA Ballard Pier dimensions in description; **minutes to Colaba unverified**; topThings[2] field exclusion preserved in manifest.
- Mormugao: Goa gateway; transfer/excursion claims conservative; topThings[2] exclusion preserved.

### Stage 52 editorial five
- Almeria: ferry vs future 2027 terminal called out; no OSM leak post-sanitize.
- La Romana: East Berth vs Catalina product split in practical tip.
- Roseau / Montego / Harstad: generic call-plan templates after Stage 52 recovery.

---

## Unsupported-claim scan (applied JSON, post-sanitize)

| Slug | Flags |
|------|--------|
| `bod-norway` | `timing_est` |
| `ravenna-italy` | `gap_token`, `timing_est` |
| Others in cohort | none (heuristic) |

No `[S#]` markers in passenger JSON/HTML (tests PASS).

---

## Integrations preserved (spot check)

- `public-port-terminals.json` **byte-identical** to pre-apply rollback.
- Regen used `generateBlogs.js --ports-only --only=<11>` — sitemap/ads untouched.
- Hamburg + Singapore control guides unchanged in validate script.
