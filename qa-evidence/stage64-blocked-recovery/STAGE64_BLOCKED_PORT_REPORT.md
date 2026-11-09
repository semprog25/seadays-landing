# Stage 64 — Research BLOCKED cohort recovery (≤25)

**Production baseline:** `4fc0b2545da0210afad4a54b0114dfd4f9451273`  
**Research root:** `seadays-ports-deliverables-2026-11-06` (local manifest; not committed)  
**Bundle hash:** `62dabec5bb8bb4700e6078a3c99160e8788671dac3b15631e5cff1615f3ae3d8`  
**Status:** READY_FOR_OWNER_REVIEW — do not merge or deploy without owner approval.

## Executive summary

| Metric | Count |
|--------|------:|
| Unpublished **BLOCKED** (inventory) | 184 |
| Candidates inspected (reconcile) | 184 |
| Bootstrap policy-ok (qa PASS, sha ok, no policy/multi-slug hold) | 108 |
| Prepared (oversampled) | 35 |
| Passenger gates passed | 34 |
| **Approved in bundle (capped)** | **25** |
| Playwright desktop+mobile | 25/25 |

## Blocking cause breakdown (184 unpublished BLOCKED)

| Cause | Ports |
|-------|------:|
| `research_status` metadata `needs_review` (qa already PASS) | 177 |
| Missing `public-port-guides.json` entry (`missing_public_guide_entry`) | 175 |
| Research QA **BLOCKED** (true research holds) | 27 |
| Multi-slug / gateway ambiguity | 1 |
| Historical Stage 43 hard exclude | 1 |

**Interpretation:** The dominant queue is **import/bootstrap**, not failed research QA. Most rows are `qa_verdict: PASS` but never received a public guide entry, so eligibility buckets them as BLOCKED. A smaller set (27) are genuine `qa_verdict: BLOCKED` (unsupported terminal facts, cargo ports, TLS/source failures) and were **not** selected.

## Recovery approach

1. **No full 406-port rerun.** Reused Stage 63 eligibility/manifest + research sha verification.
2. **Targeted defect:** bootstrap missing guide entries (empty shell → Stage 62/63 targeted passenger editorial).
3. **Gates unchanged:** editorial validation, factual review, leak scan, HTML validation, rollback snapshots.
4. **Terminals JSON unchanged** (content-only / passenger tier on guides + HTML regen).

## Approved slugs (exact membership)

1. alghero-italy  
2. ancona-italy  
3. antwerp-belgium  
4. arendal-norway  
5. bar-montenegro  
6. bastia-corsica-france  
7. bimini-bahamas  
8. bonaire-bonaire  
9. bonifacio-france  
10. bremen-germany  
11. cadiz-seville-spain  
12. calvi-corsica-france  
13. capri-italy  
14. cartagena-colombia  
15. cartagena-spain-spain  
16. durres-albania  
17. ephesus-kusadasi-turkey  
18. florence-pisa-livorno-italy  
19. grundarfjor-ur-iceland  
20. ibiza-spain  
21. motril-granada-spain  
22. porto-vecchio-france  
23. pula-croatia  
24. rovinj-croatia  
25. saranda-albania  

**Held from prepare pool (1):** `banjul-gambia` — failed publication gates (see `RECOVERY_RESULTS.json`).

## Remaining BLOCKED (held) — why

| Hold class | Est. ports | Notes |
|------------|-----------:|-------|
| YAML frontmatter parse errors in research pack | 48 | Import/schema; needs research deliverable fix (e.g. Falmouth, Jeddah variants, Manama) |
| Research QA BLOCKED | 27 | Unsupported/cargo/missing cruise berth — no auto-unblock |
| Policy / multi-slug / Stage 43 | few | Unchanged historical holds |
| Not selected after oversample | 83 | Lower bootstrap score; still missing guide entry |

## Rollback evidence

- `qa-evidence/stage64-blocked-recovery/rollback-pre-apply/public-port-guides.json`
- Per-slug `rollback/*.production-snapshot.json` (empty `{}` where no prior guide)
- `qa-evidence/stage64-blocked-recovery/BLOCKED_CAUSE_REPORT.json`
- `qa-evidence/stage64-blocked-recovery/STAGE64_BLOCKED_MANIFEST.json`

## Validation

- `RELEASE_VALIDATION.json` — 25/25 HTML gates OK  
- `BROWSER_QA.json` — 25/25 desktop + mobile  
- `APPLY_REPORT.json` — guides sha after apply

## Owner next step

Review PR diff (guides + 25 port HTML only). Merge only when authorized; no Supabase or app changes included.
