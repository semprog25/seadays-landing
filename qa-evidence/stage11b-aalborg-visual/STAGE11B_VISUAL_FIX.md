# Stage 11B — Visual fix & verification

## Fix (smallest correct change)

**File:** `scripts/lib/publishedPortHtmlPreserve.js`

When **generated** head styles include `.pg-call-plan-card` but **existing** committed styles do not, **keep generated** styles instead of blind preservation. When both bundles already include call-plan rules, existing preservation behaviour is unchanged (Hamburg-safe).

**Regen:** `SEADAYS_REGEN_PORT_SLUGS=aalborg-denmark node scripts/regenerate-port-pages.js`

**Tests added/extended:**

- `scripts/test-published-port-html-preserve-styles.js`
- `scripts/test-port-guide-aalborg-content-quality.js` — asserts inline CSS contains `.pg-call-plan-card` and `.pg-cruise-tip`

## Visual proof (port 8777, worktree root)

| Asset | Path |
| --- | --- |
| Before (desktop) | `screenshots/aalborg-desktop-before.png` |
| After (desktop) | `screenshots/aalborg-desktop-after.png` |
| After (mobile) | `screenshots/aalborg-mobile-after.png` |
| Hamburg ref (desktop) | `screenshots/hamburg-desktop-reference.png` |
| Hamburg ref (mobile) | `screenshots/hamburg-mobile-reference.png` |
| Computed styles | `computed-styles-comparison.json` |

## Section checklist (Aalborg)

| Item | Status |
| --- | --- |
| Three itinerary cards (styled grid/cards) | Pass |
| Top-five attractions list | Pass |
| Practical tip (`pg-cruise-tip`) | Pass |
| Getting there (`pg-facts` dl) | Pass (no terminal map; policy) |
| Quick facts concise | Pass |
| FAQ / markdown leaks | Pass |
| Mobile horizontal overflow | Pass (CDP) |

## Regression & safety

All targeted tests pass:

```bash
SEADAYS_REGEN_PORT_SLUGS=aalborg-denmark node scripts/regenerate-port-pages.js
node scripts/test-published-port-html-preserve-styles.js
node scripts/test-port-guide-aalborg-content-quality.js
node scripts/test-port-guide-aalborg-render.js
node scripts/test-research-copy-guards.js
node scripts/test-public-guide-sanitize-regression.js
```

No changes to `public-port-terminals.json`, Supabase/app, or bulk port pages.

## Changed files (Stage 11B)

1. `scripts/lib/publishedPortHtmlPreserve.js`
2. `ports/aalborg-denmark/index.html` (regenerated full inline CSS)
3. `scripts/test-published-port-html-preserve-styles.js` (new)
4. `scripts/test-port-guide-aalborg-content-quality.js`
5. `qa-evidence/stage11b-aalborg-visual/**`

(Prior Stage 11 files on branch remain: editorial JSON, sanitizer, `seoShipPortPages.js`, etc.)

## Stage 11B verdict

**PASS** — browser-confirmed call-plan, tip, and facts styling matches Hamburg’s design system for the shared components. **PARTIAL** vs Hamburg overall only for content/policy gaps (no hero, no terminal map/cards).

**Preview:** `python3 -m http.server 8777` from this worktree → `/ports/aalborg-denmark/`
