# Stage 68 held-port recovery (owner review)

- **Baseline main:** `90b981f409427bb81f29e6f736b0d35cae94e39e` (313 passenger editorial)
- **Preparation bundle (unchanged):** `d5095e1ef878d8cc1fd8a437a0ff9bdc48b2c6d169a3f899e6fa17fed06d6583`
- **Recovery bundle:** `00f727d48bca33659b84fb18ae687e25c0297af6fcb9c713040d988bf8b22c99`
- **PR #94:** preparation-only — **not required** to merge this recovery PR

## Inspected / passing / held

| Metric | Count |
|--------|------:|
| Inspected | 6 |
| Passing (this PR) | 6 |
| Still held | 0 |

## Failing gate → fix (evidence)

| Slug | Original gate | Root cause | Fix |
|------|---------------|------------|-----|
| `oslo-norway` | `NEEDS_FACT_CHECK` | Internal QA phrase in `portInfo.description` (`stay null`) | Removed; closed with programme-confirm wording |
| `st-croix-frederiksted-us-virgin-islands` | `NEEDS_FACT_CHECK` | `pins stay null` in overview | Removed non-passenger pin note |
| `new-york-ny-united-states` | `NEEDS_FACT_CHECK` | `pins stay null` + `Not verified` in transfers | Passenger-safe MCT/BCT/Cape Liberty copy |
| `ocean-cay-msc-reserve-bahamas` | `NEEDS_FACT_CHECK` | `keep pins null` / quay LOA internal note | Removed trailing internal sentence |
| `kefalonia-greece` | `unexpected_terminal_map` | Approximate-area terminal still rendered map | `mergePolicy` `allow_terminal_map_pin: false` + strip lat/lng for preview/apply |
| `wilhelmshaven-germany` | Editorial schema / 1 attraction | One `topThings` with `hours not verified`; only one attraction | Three research-backed port-context items; distance copy without “not verified” |

## Validation

- `RELEASE_VALIDATION.json` — 6/6 HTML PASS
- `BROWSER_QA.json` — 6/6 desktop + mobile PASS
- CocoCay + Falmouth Jamaica guards unchanged (rollback evidence)
- Terminals JSON unchanged on disk

## Projected after merge

- **319 / 406** passenger editorial (**87** remaining)
