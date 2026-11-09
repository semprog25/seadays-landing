# PR #81 — Final review (no merge)

**Branch:** `release/bulk-50-port-prep`  
**Prior commit reviewed:** `29c1ee412`  
**Updated release bundle:** `4e731d5625d1427e2b33d5637131f893b418de023a5476d8b1f534b6d831bb6a`  
**Baseline:** `9ea50c967a26a705fbbf93ab196b39f8b7835cbe`

## Decision: **READY FOR MERGE APPROVAL** (owner sign-off still required)

Conditions met after remediation:

1. **Field-exclusion bug fixed** — `portInfo.description` exclusions now **preserve** legacy copy instead of deleting it (`stage24ApplyEditorialDraft.js`).
2. **Corner Brook / Reykjavik timing** — Specific minute-buffer call plans replaced with qualified generic plans (Stage 52 `timing_claim_needs_owner_confirm` addressed).
3. **Lofoten call plans** — Same qualification pass applied (residual minute math removed).
4. **Playwright** — 5/5 ports pass desktop + mobile (`qa-evidence/bulk-50-port-release/VISUAL_QA.json`).

`owner_publication_authorized` remains **false** in manifest until owner approves.

---

## 1. Description exclusions (five ports)

| Slug | Keep exclusion? | Legacy description | Assessment |
|------|-----------------|---------------------|------------|
| `corner-brook-canada` | **Yes** | Thin Newfoundlands / facilities boilerplate | Not contradictory with new getting-there / call plans; draft intro is terminal-spec heavy — unsuitable for lead. |
| `horta-azores-portugal` | **Yes** | Marina / murals summary | Accurate at headline level; draft is policy/research dense. |
| `lofoten-islands-norway` | **Yes** | Archipelago / midnight sun summary | Correct gateway framing; draft mixes tender logistics suitable for body fields only. |
| `reykjavik-iceland` | **Yes** | Capital / geothermal gateway copy | Acceptable lead; draft is Faxaflói authority procedural text. |
| `sydney-australia` | **Yes** | Harbour / Opera House one-liner | Iconic summary still true; draft is terminal FAQ/admin tone. |

**Verdict:** Retain **`portInfo.description` exclusion on all five**. None of the legacy lines are materially misleading relative to applied passenger fields; none should be replaced with the excluded draft leads without a separate editorial upgrade pass.

---

## 2. Timing risks (Corner Brook, Reykjavik, Lofoten)

**Stage 52 flags:** `scan.risks` / `timing_claim_needs_owner_confirm` on `thingsToDo.shortCall|standardCall|longerCall` when numeric buffers appear without programme qualifiers.

| Slug | Before (PR #81 initial) | After remediation |
|------|-------------------------|------------------|
| Corner Brook | `≥4 h`, `≥90 min buffer`, Gros Morne timing | Generic buffer language; Gros Morne qualified as full-day/coach only |
| Reykjavik | `75` / `90` / `≥120 min buffer` | Generic buffer language |
| Lofoten | `≈ 215`, `90 min return buffer`, etc. | Qualified plans without invented minute math (same PR pass) |

Factual gate re-run: **no `exclude_from_release`** on the five after remediation.

---

## 3. Browser verification

| Check | Result |
|-------|--------|
| Desktop 1280×800 | **PASS** (5/5) |
| Mobile 390×844 | **PASS** (5/5) |
| ≥3 call-plan cards | **PASS** |
| Getting There present | **PASS** |
| Site nav / logo link | **PASS** |
| Research markers / raw `**markdown**` | **PASS** (none) |
| Horizontal overflow | **PASS** |

Tooling: `playwright` installed locally for this worktree; `node scripts/stage61-playwright-visual-audit.js`.

---

## 4. Remaining copy risks (minor)

- **Thin boilerplate descriptions** on all five (pre-existing). Acceptable under exclusion policy; optional future pass could swap in passenger v2.5 intros after fact-check.
- **Lofoten / multi-berth complexity** — Call plans stay high-level; guests must still confirm tender vs alongside on the programme.
- **Sydney OTP vs White Bay** — Getting-there copy should continue to defer to sailing documents (unchanged from draft apply).

---

## 5. Hashes and evidence

| Artifact | Location |
|----------|----------|
| Manifest | `qa-evidence/bulk-50-port-release/BULK_50_RELEASE_MANIFEST.json` |
| Gates | `qa-evidence/bulk-50-port-release/FACTUAL_AND_EDITORIAL_GATES.json` |
| Validation | `qa-evidence/bulk-50-port-release/RELEASE_VALIDATION.json` |
| Visual QA | `qa-evidence/bulk-50-port-release/VISUAL_QA.json` |
| Rollback | `qa-evidence/bulk-50-port-release/rollback-pre-apply/` |

**Not merged. Not deployed.**
