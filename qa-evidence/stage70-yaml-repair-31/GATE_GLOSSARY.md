# Stage 70 — policy gate glossary

These gates are **independent**. YAML parse success does **not** mean editorial publication approval.

| Gate | Source | What it measures | Stage 70 cohort (31 NEEDS_REVIEW existing guides) |
|------|--------|------------------|-----------------------------------------------------|
| **policy_dry_run.ok** | `buildBulkEligibilityReport` | Import/policy dry-run against linked research + current guide metadata | **31/31** pass |
| **bootstrap_policy_ok** | `analyzeBlockedCohort` → `computePolicyApply` on **empty** guide shell | Only ports with `publication_bucket: BLOCKED` in the unpublished bootstrap pool | **N/A — 0/31** (none in pool) |
| **preparation_technical_gate_pass** | Stage 70 `gateRow` | SHA, YAML, QA PASS, identifier, `policy_dry_run.ok`, has `public_port_guide`, not live passenger editorial | **31/31** (still `NEEDS_REVIEW`; `editorial_publication_approved: false`) |

**Live publication counts** (authoritative): `usesPassengerEditorialLead` + `public-port-guides.json` → **319** guides / **319** slugs. Historical slug ledger = **320** (`nice-france` ledger-only). **87** unpublished slugs in the owner universe.
