# Stage 10 — Aalborg editorial & UI recovery

**Repo:** `seadays-landing`  
**Branch (local):** `fix/stage10-aalborg-editorial-recovery` (not pushed)  
**Live before fix:** https://seadays.app/ports/aalborg-denmark/  
**Reference:** https://seadays.app/ports/hamburg-germany/  
**Research:** `/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06/by-port/aalborg-denmark.md`

## Executive verdict

**PARTIAL → PASS (editorial gate)** for owner preview on this branch.

- Passenger-facing defects from PR #68 (raw markdown, internal research prose, arithmetic itineraries, clipped table import) are **resolved** in local preview.
- **Full Hamburg parity** is not claimed: Aalborg still has **no verified terminal map/cards** (policy), no hero image block, and generic Denmark **entry** accordion (shared template). Those are documented follow-ups, not regressions from this fix.

## Root causes

| Defect (live / screenshots) | Origin |
| --- | --- |
| `**bold**` markdown visible | Research markdown preserved in JSON; renderer used `escapeHtml` only |
| `null/unverified`, quay/OSM processing notes in Getting there | Import used clipped **table cell** + post-table **QA prose**, not passenger copy |
| Minute-by-minute arithmetic in call cards | Research “Things to do” timing worksheets copied verbatim |
| Quick facts “Getting to the city” research paragraph | `firstSentence(fromTerminal)` pulled internal line; 180-char clip |
| Generic “confirm the pier, shuttle…” | Empty `gettingThere` before Stage 7; after Stage 7, internal text masked UX but not quality |
| Clipped `Port of Aalborg cr` | **Claire deliverable** table row truncated mid-word (line 161 in `.md`) |

**Not deployment/cache:** Live HTML matches merged `main` content (`curl` showed 7× `**`, internal strings). Pages build had completed; issue was **content + render pipeline**, not stale CDN alone.

## Fixes implemented (this branch)

### Editorial (JSON)

Rewrote `byAppPortId.aalborg` to Hamburg-style passenger prose:

- `portInfo.description`, `thingsToDo` (intro, 5 highlights, 3 itineraries, tip)
- `gettingThere` split: `fromTerminal`, `distanceToCity`, `distanceAnswer`, `walkingTime`, `taxiInfo`, `publicTransport`, `transportation[]`
- `shorePlansFirst: true` (Things to do before Quick facts, matching Hamburg rhythm)
- `researchImport` retained for provenance only (not rendered)

### Rendering safeguards

- `scripts/lib/publicGuideCopySanitize.js` — strip markdown emphasis, block internal research leaks, quick-fact length cap
- `scripts/lib/portGuideSections.js` — `preparePassengerGuideText()` on facts, call cards, getting there, lists, FAQ clips; `quickFactGettingSummary()` for Quick facts

### Import pipeline (future ports)

- `extractMarkdownSections.js` — reject truncated table cells; fall back to post-table prose only when still passenger-safe (Stage 7); Stage 10 adds **publication must not auto-publish** research leaks (editorial rewrite still required)

## Before / after (editorial)

### `gettingThere.fromTerminal`

**Before (main / live):**

> Aalborg Royal Cruise Berth / Honnørkajen waterfront — Coordinates and definitive quay number remain null/unverified until sailing-specific or clearer primary quay geometry is captured. Secondary "quay 4041 / Honnørkajen" claims were not copied without matching primary HTML text in this pass.

**After (branch):**

> Most cruise ships use the Royal Cruise Berth on the Honnørkajen waterfront, within walking distance of the city centre. Some sailings list Berth 4110 instead—check your daily programme and cruise documents before you leave the ship.

### `thingsToDo.shortCall` (excerpt)

**Before:** `15 minutes clear berth… **75-minute** buffer (15+45+60+30+15+75=240).`

**After:** Natural prose with return buffer, no arithmetic.

## Visual verification

Local preview: `python3 -m http.server 8765` from worktree root.

| Asset | Path |
| --- | --- |
| Aalborg after (desktop) | `qa-evidence/stage10-aalborg-recovery/screenshots/aalborg-desktop-after.png` |
| Hamburg reference (desktop) | `qa-evidence/stage10-aalborg-recovery/screenshots/hamburg-desktop-reference.png` |

**Checked in browser snapshot / screenshot:**

- No `**` in rendered passenger sections (post-fix)
- Three call-plan cards + `pg-cruise-tip`
- Getting there: From terminal, Walking, Taxi, Public transport + transport mode list
- No `port-terminal-map`
- Jump nav: Things to do first (shorePlansFirst)

## Tests

| Test | Result |
| --- | --- |
| `test-port-guide-aalborg-content-quality.js` | PASS |
| `test-port-guide-aalborg-render.js` | PASS |
| `test-research-copy-guards.js` | PASS |
| Live `curl` (before) | 7× `**`, internal QA strings present |
| Local HTML (after) | No `**`, no `null/unverified`, no arithmetic pattern |

## Changed files (exact)

1. `data/public-port-guides.json` — Aalborg block only  
2. `ports/aalborg-denmark/index.html` — regen  
3. `scripts/lib/portGuideSections.js` — passenger copy sanitization  
4. `scripts/lib/publicGuideCopySanitize.js` — new  
5. `scripts/test-port-guide-aalborg-content-quality.js` — new  

## Remaining unsupported / follow-ups

| Item | Action |
| --- | --- |
| Verified terminal coordinates / map pin | Omit until approved; do not fabricate |
| DMI monthly climate normals (digits) | Keep generic climate; research “open” |
| Annual cruise passenger headline | Not in quick facts |
| Hamburg-style terminal photo cards | Needs verified media + terminal JSON |
| Hero image for Aalborg | Optional product follow-up |
| Entry accordion (generic Denmark) | Template shared; consider Hamburg-style Schengen links later |
| Long Wikipedia population paragraph under lead | Pre-existing; separate trim/summary task |
| `smoke-port-guides.js` Barcelona label | Baseline on `main`; not changed here |

## Recommended content publication gate (all future ports)

1. **Import tier:** `researchImport` → `passenger_editorial` required before publish; auto-merge research fields **blocked** unless `preparePassengerGuideText` passes and `assertPassengerReadyGuideFields` passes.
2. **No raw markdown** in `public-port-guides.json` for passenger fields.
3. **Reject** `isTruncatedResearchCopy` and `containsInternalResearchLeak` at import and at render (render returns empty rather than leaking).
4. **Human rewrite** for first publication per port (pilot proved table-to-JSON is insufficient).
5. **Visual smoke:** scripted screenshot diff vs Hamburg reference for call cards + getting there.
6. **Quick facts:** never bind long `fromTerminal` research; use `distanceToCity` ≤ 120 chars.

## Owner next steps

1. Review local preview: `http://127.0.0.1:8765/ports/aalborg-denmark/` on branch `fix/stage10-aalborg-editorial-recovery`.
2. Approve → push branch, open PR, merge, wait for Pages build.
3. Do **not** merge until satisfied with screenshots above.
