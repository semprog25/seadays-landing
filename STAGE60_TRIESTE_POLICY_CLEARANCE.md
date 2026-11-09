# Stage 60 — Trieste policy clearance (single-port PR)

**Owner decision:** **APPROVE WITH CONDITIONS** — `trieste-italy` only.

This record authorizes **one release PR** against `main`. It does **not** authorize merge, deployment, or global hard-exclude changes.

## Lineage

| Stage | Artifact |
|-------|----------|
| 58 | Conditional factual review (`trieste-italy` — APPROVE_WITH_CONDITIONS) |
| 59 | Verified draft, targeted apply, bundle `d7ac66c00c4eef89011ead8dd189a2f791e1eec003d51a5877d000fad2b2150f` |
| 60 | Policy clearance + PR (this file, `STAGE60_TRIESTE_POLICY_CLEARANCE.json`) |

## Scoped clearance

- **`scoped_policy_clearance_status`:** `APPROVED_WITH_CONDITIONS`
- **`owner_publication_authorized`:** `false` until separate merge approval after PR review
- **Global `STAGE43_HARD_EXCLUDE`:** unchanged (Trieste may remain listed; owner clears at merge time only)

## Unchanged holds

`ravenna-italy`, `venice-ravenna-trieste-italy`, `bod-norway`, `mumbai-india`, `mormugao-port-goa-india`, `eilat-israel`

## Remaining uncertainties (not resolved)

- Overflow / non-central berth transfers
- Miramare hours and fixed bus routes
- `factually_verified` remains false in validation metadata

## Passenger payload lock

Stage 60 PR must match Stage 59 verified draft SHA  
`6f772bfeeba2ecd5782f450e8a2863bb2d15d1426da49124e2ca058bed859aea`  
and release bundle `d7ac66c00c4eef89011ead8dd189a2f791e1eec003d51a5877d000fad2b2150f`.
