# Stage 54 — Historical exclusion reconciliation (PR #79)

**PR:** [#79](https://github.com/semprog25/seadays-landing/pull/79) @ `562884278`  
**Release bundle (11):** `d521c5a24120ae12a3dd7dd46a8238dc877e1ff745ec4324d86cdc241332285f`

Legend: **CLEARED** = new evidence supports lifting the historical block for owner sign-off. **HOLD** = explicit prior exclusion or unresolved operational risk remains; Stage 53 gates alone are insufficient.

---

## `bod-norway` (`bodo`)

| Field | Detail |
|--------|--------|
| **Original exclusion** | Stage 29: removed from 25-port cohort — “HTML gate failure”, replaced by `fukuoka-japan` (`STAGE29_25_PORT_RELEASE_CANDIDATE.md`). Stage 33+: `stage33_hard_exclude` / `STAGE43_HARD_EXCLUDE` (collision / deferred bulk policy). |
| **Supporting evidence** | `STAGE33_EXCEPTION_QUEUE.json` (`bod-norway` → BLOCKED, `stage33_hard_exclude`). Stage 28 READY was editorial only. |
| **Current proposed content** | Port-authority-grounded description; **no published quay table**; getting-there explicitly unverified; practical tip warns walking distance unknown. Call plans still use **estimated minute blocks** (`~90`, `75 min buffer`) in JSON. |
| **Risk resolved?** | **Partially** — berth precision discipline improved; **Stage 29 HTML-specific failure not re-documented**; hard-exclude ledger **not owner-cleared**. |
| **Eligibility** | **HOLD** for merge until owner clears Stage 29 + Stage 33 exclusion record. |

---

## `eilat-israel` (`eilat`)

| Field | Detail |
|--------|--------|
| **Original exclusion** | Stage 31: excluded from 24-port ship; guide/HTML restored to `origin/main`. Queue: *“Re-enrichment blocked until owner-verified current cruise calls and passenger arrival procedures.”* (`STAGE31_EILAT_EXCLUSION.json`). |
| **Supporting evidence** | `qa-evidence/stage29-25-port-release/STAGE31_EILAT_EXCLUSION.json`; Stage 33 `stage33_hard_exclude`. |
| **Current proposed content** | Passenger hall **unverified**; tender/turnaround caution in getting-there; attractions framed conditionally (no closure claim). Does **not** include owner attestation that cruise calls still operate. |
| **Risk resolved?** | **No** — copy is conservative but **does not satisfy Stage 31 owner gate** (verified current ops). |
| **Eligibility** | **HOLD** — requires owner sign-off on active cruise arrival status before passenger-tier publish. |

---

## `ravenna-italy` (`ravenna`)

| Field | Detail |
|--------|--------|
| **Original exclusion** | Stage 28 composite `venice-ravenna-trieste-italy` held for identity split; Stage 29 excluded composite from cohort; Stage 33+ **`stage33_hard_exclude`** for `ravenna-italy` (Venice/Ravenna/Trieste gateway collision set). |
| **Supporting evidence** | `STAGE33_EXCEPTION_QUEUE.json`; `STAGE43_HARD_EXCLUDE`; Stage 29 table (“Identity split — owner hold”). |
| **Current proposed content** | Distinct **Porto Corsini / Molo Crociere** framing (not Venice). Getting-there states historic centre **not** waterfront-walkable. **GAP tokens** and **itinerary-style** topThings/call plans remain (`Transfer in: 30`, `Sum: 180`). |
| **Risk resolved?** | **Partially** on geography vs Venice composite; **exclusion ledger not cleared**; residual **timing/GAP** editorial risk. |
| **Eligibility** | **HOLD** until owner clears hard-exclude + accepts transfer GAP wording (or editorial fixes GAP/itinerary blocks). |

---

## `trieste-italy` (`trieste`)

| Field | Detail |
|--------|--------|
| **Original exclusion** | Same gateway family as Ravenna/Venice; `stage33_hard_exclude`; composite slug excluded Stage 29. |
| **Supporting evidence** | `STAGE33_EXCEPTION_QUEUE.json` (`trieste-italy`); `STAGE43_HARD_EXCLUDE`. |
| **Current proposed content** | Generic “confirm berth” lead; **10–15 min walk** to centre (qualified by sailing programme). Separate app id `trieste` — not interchangeable with Ravenna HTML. |
| **Risk resolved?** | **Partially** — distinct gateway page; **hard-exclude not cleared**; walk-time still needs owner comfort vs authority gap. |
| **Eligibility** | **HOLD** — owner must clear Stage 33/43 exclusion before merge as passenger editorial. |

---

## Related PR ports (same exclusion family)

| Slug | Historical reason | Stage 54 |
|------|-------------------|----------|
| `mormugao-port-goa-india` | `stage33_hard_exclude` — Goa duplicate-gateway / secondary slug policy (`STAGE33_EXCEPTION_QUEUE.json`) | **HOLD** |
| `mumbai-india` | Same hard-exclude list; MbPA berth facts in copy, transfer minutes unverified | **HOLD** |

---

## Ports without historical hard-exclude (Stage 52 editorial)

| Slug | Stage 54 |
|------|----------|
| `almeria-spain`, `harstad-norway`, `montego-bay-jamaica`, `roseau-dominica`, `la-romana-dominican-republic` | **CLEARED for merge review** (no Stage 29/31/33 hard-exclude; Stage 53 + Stage 54 automated QA pass). |

---

## Recommended subset if exclusions are enforced

**5-port merge subset** (editorial only):  
`almeria-spain`, `harstad-norway`, `montego-bay-jamaica`, `roseau-dominica`, `la-romana-dominican-republic`  
**Subset bundle hash:** `6d6e0088ab641179e0f3fc95d6279ac99bd533094bdd86921df06d1f60b6ad3f`  
(Requires a **revised PR** or owner override on the 11-port manifest — do not merge 11 as-is without owner decision.)
