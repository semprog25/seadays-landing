# Stage 50 — Gateway factual review (33 ports)

**Sources:** `qa-evidence/stage49-33-port-release/proposed-guides/*.json`, `STAGE49_FACTUAL_GATE_RESULTS.json`, `reviewConsequentialClaims` + research tables under `PORT_RESEARCH_ROOT`.

**Pass:** `exclude_from_release === false` and gateway prose matches known berth/tender patterns.  
**Advisory:** generic template wording; does not block release.  
**Hold:** would block if `exclude_from_release` or demonstrably false operational claim (none).

## Summary

| Result | Count |
|--------|------:|
| **PASS** | **33** |
| **HOLD (blocking)** | **0** |
| **Advisory** | **1** |

## Priority gateways

### Ho Chi Minh City / Phu My (`phu-my`)

- **Arrival:** PTSC Phu My industrial wharf (not downtown).
- **Transfer:** Coach-only framing; practical tip: *not walking into Saigon from the gangway.*
- **Advisory:** Boilerplate `standardCall` still says “central walk” — **shared template**, not a pier-to-downtown walk claim. Owner may tighten copy post-merge.

### Port Said (`port-said`)

- **Arrival:** West Port Said touristic berth; distinguishes East complex.
- **No unsupported Cairo day-trip guarantee** in published fields.

### Princess Cays (`princess-cays`)

- **Tender port** stated in description; tender time buffers in `distanceAnswer`; water-shoe tip.

### Boston (`boston`)

- **Flynn Cruiseport / Black Falcon** identity; Massport parking + shuttle; timed taxi minutes explicitly **not verified**.

### Other high-variance (spot read)

| Slug | Verdict | Note |
|------|---------|------|
| `christchurch-lyttelton-new-zealand` | PASS | Mandatory shuttle from Lyttelton berth |
| `edinburgh-south-queensferry-united-kingdom` | PASS | Hawes Pier; tender timing caveats |
| `panama-city-panama` | PASS | Amador vs Colón disambiguation in tip |
| `punta-arenas-chile` | PASS | Berth vs tender assignment caveated |
| `sir-bani-yas-island-united-arab-emirates` | PASS | Long Abu Dhabi transfer; resort/ship booking |

## Corrections applied in Stage 50

**None** — no demonstrably false claims identified; conservative wording already present.

## Excluded ports (this release)

| Slug | Reason |
|------|--------|
| *(none)* | All 33 remain eligible |

Pilot **not in this PR:** 6 `NEEDS_FACT_CHECK` + 4 `NEEDS_EDITORIAL_FIX` from Stage 45 rescore (unchanged).
