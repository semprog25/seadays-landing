# Two-port Commons hero fix — local report

**Status:** `TWO_PORT_HERO_FIX_READY_LOCAL`

## Worktree / branch / base

| Field | Value |
|-------|--------|
| Worktree | `/Users/sharanestone/Semprog/seadays-landing/.worktrees/two-port-hero-fix-20261111` |
| Branch | `two-port-hero-fix-20261111` |
| Base SHA | `d9e64af461dcd41a6345eb76e91145baaccdcae7` (`origin/main`) |

## Before → after (hero mapping)

| Slug | Before | After |
|------|--------|--------|
| `kristiansund-norway` | No `humanApproved`; og/twitter/JSON-LD = favicon placeholder | `destination-commons-approved-kristiansund-norway.webp` |
| `skjolden-norway` | No `humanApproved`; og/twitter/JSON-LD = favicon placeholder | `destination-commons-approved-skjolden-norway.webp` |

Rejected PortPic geography (preserved in `rejectedOwnerPortpicGeography`): Pexels 13257229 (Kristiansand), Pexels 13602796 (Olden).

## Source identity

### Kristiansund

- **Commons:** https://commons.wikimedia.org/wiki/File:Port_of_Kristiansund_1.jpg
- **Photographer:** Davide Mauro — **CC BY-SA 4.0** — https://creativecommons.org/licenses/by-sa/4.0/
- **Source SHA256:** `d3abdd275e2f0412558ef2204f1d9d1d93d40f6f51cf6b34aeeb2f3cacf4563d` (4032×3024)

### Skjolden

- **Commons:** https://commons.wikimedia.org/wiki/File:Queen_Elizabeth_Skjolden_Norway.jpg
- **Photographer:** Gary Bembridge — **CC BY 2.0** — https://creativecommons.org/licenses/by/2.0/
- **Source SHA256:** `2893d5e5de9e47a36472882d44d87c154124d375d5c7cf4c9cf82d0a0b40441c` (4896×3672)

Public caption pattern: `Photo: {author} — Wikimedia Commons — {licence} — Resized and converted to WebP for web delivery`.

## Files touched (tracked diff)

- `data/ports-directory-image-review-state.json` — `humanApproved` + `rejectedOwnerPortpicGeography`
- `data/destination-image-catalog.json` — two `VERIFIED` port-destination rows (surgical patch, not full-site regen)
- `ports/kristiansund-norway/index.html`, `ports/skjolden-norway/index.html`
- `ports/index.html` — directory tiles for the two ports only (`data-verified-photo="1"`)
- `scripts/lib/seoShipPortPages.js` — Commons caption source label + modification note
- `scripts/test-portpic-replacements-20261107.js` — exclusions updated

## New / untracked (local)

- `assets/img/ports-directory/ports/kristiansund-norway/destination-commons-approved-kristiansund-norway.{webp,jpg}`
- `assets/img/ports-directory/ports/skjolden-norway/destination-commons-approved-skjolden-norway.{webp,jpg}`
- `scripts/apply-two-port-commons-heroes-20261111.cjs`
- `scripts/test-two-port-commons-heroes-20261111.js`
- `qa-evidence/two-port-commons-heroes-20261111/*` (source JPEGs + `APPLY_REPORT.json`)

## Targeted tests (all pass)

- `node scripts/test-two-port-commons-heroes-20261111.js`
- `node scripts/test-portpic-replacements-20261107.js`
- `node scripts/test-destination-image-catalog.js`
- `node scripts/test-public-photo-caption-internal-warnings.js`
- `node scripts/test-destination-image-source-policy.js`
- `node scripts/test-port-guide-human-approved-hero.js`
- `git diff --check` (clean)

## Unchanged spot-checks

- Hamburg, Kochi, Reine, Norway browse, Northern Europe — assertions in `test-two-port-commons-heroes-20261111` / portpic regression.

## Recommended PR scope (smallest)

1. Branch `two-port-hero-fix-20261111` from `main` @ `d9e64af4`
2. Include: 4 WebP/JPEG assets, 2 JSON data files, 3 HTML files, `seoShipPortPages.js`, apply script, both tests, narrow-portpic exclusion clear, evidence `APPLY_REPORT.json` (optional: omit large source JPEGs from repo; keep SHA in report only).

## Risks

- **CC BY-SA (Kristiansund):** Share-alike applies to derivatives; document that resized WebP is a derivative; attribution + source link on page (done).
- **Future catalogue build:** `build-destination-image-catalog.js` rebuilds from manifests — `humanApproved` metadata is source of truth; photographer fields in catalog are patched for these two rows only.
