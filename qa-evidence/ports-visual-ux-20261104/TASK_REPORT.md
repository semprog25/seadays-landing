# PR59 release blocker closure — 2026-11-04

**PR:** https://github.com/semprog25/seadays-landing/pull/59  
**Baseline:** `09099fa6ba549ed1aeab4b362b1ca68475780703` (production catalogue on main)

## A. Production-shell parity — **PASS** (repaired)

**Finding:** `regenerate-port-pages.js` output **FAIL** — drops production inline layout CSS (`blog-hero`, starfield, directory-style blocks) while keeping some shell links. It is a **preview/slim** generator, not the CI path.

**Reference pipeline** (`scripts/ci-run-channel.sh ports`):

1. `node scripts/generateBlogs.js --ports-only`
2. `node scripts/rewrite-download-ctas.js`
3. `node scripts/inject-analytics-head.js`
4. `node scripts/apply-publish-gate.js`

**Scoped repair (PR preview):** `node scripts/patch-pr59-hamburg-shell.js`

- Starts from **`origin/main`** Hamburg HTML (production shell at merge base).
- Replaces `#things-to-do` + `#getting-there` from shared templates + PR57 terminal CSS patch.
- Runs `rewriteHtml` (Save / contextual CTA path).
- Asserts: AdSense meta, `gtag`, `seadays-contextual-cta`, `safeImage`, `seadays-web-phamburg`, JSON-LD, four terminal photos, no sticky `port-jump`.

| Marker | Baseline `09099fa` | Patched PR59 Hamburg |
|--------|-------------------|----------------------|
| Production CSS (`blog-hero`, `starfield`) | yes | yes |
| `site-shell.css` / footer guard | yes | yes |
| GA4 / consent / AdSense meta | yes | yes |
| Viator `campaign=seadays-web-phamburg` | yes | yes |
| robots / canonical / JSON-LD | yes | yes |
| Leaflet map + 4 Commons photos | yes | yes (4 photo cards) |
| PR59 Things to do + stretch terminals | no | yes |

**Deploy note:** After merge, **do not** publish Hamburg from `regenerate-port-pages.js` alone. Use **ports CI channel** (or `--ports-only` generation) so shell + gate match production. PR Hamburg file is **parity-patched preview**, not a substitute for skipping CI.

## B. Unsafe HTML — **safely repaired**

- Removed reliance on slim `regenerate-port-pages` Hamburg artifact.
- Committed Hamburg = `patch-pr59-hamburg-shell.js` output + shared `scripts/lib/*` sources.
- `ports/index.html` still from `regenerate-ports-index.js` (directory-only; safe).

## C. Terminal alignment — **PASS**

@ 1280px rendered preview:

- Row 1 card heights: **661 × 661** px; photo tops **3107 / 3107**
- Row 2: **688 × 688**; photo tops **3782 / 3782**
- Image blocks: uniform **3:2** aspect; badge row reserved on all four cards
- Mobile @ 390px: **no horizontal overflow**; natural single-column heights

## D. Visual QA (rendered @ 127.0.0.1:19283)

| Check | 390px | 1280px |
|-------|-------|--------|
| Things to do call cards + tip | ok | ok |
| Editorial `#79D8FF` (entry + related) | ok | ok |
| Terminal row alignment | n/a (stack) | ok |
| Directory text-first + search spacing | ok | ok |

Screenshots: `qa-evidence/ports-visual-ux-20261104/*.png`

## E. Tests & SEO/affiliate preservation

| Test | Result |
|------|--------|
| `test-ports-directory.js` | pass |
| `test-ports-phase1.js` (+ Hamburg shell asserts) | pass |
| `test-port-guide-pr57-baseline-guard.js` | pass |
| `test-targeted-viator-affiliate-guard.js` | pass |
| `test-publish-gate.js` | pass (baseline indexed-port count 0 in worktree — pre-existing) |
| `test-publish-gate-terminal-cards.js` | pass |

No Viator/robots/canonical regressions on Hamburg vs baseline markers.

## F. Files changed (blocker closure)

- `ports/hamburg-germany/index.html` — production-shell patched preview
- `scripts/patch-pr59-hamburg-shell.js` — scoped shell parity command
- `scripts/test-ports-phase1.js` — Hamburg production-shell guards
- `qa-evidence/ports-visual-ux-20261104/TASK_REPORT.md` (this file)
- (unchanged from prior PR59) `scripts/lib/portGuideSections.js`, `portsDirectoryIndex.js`, `seoShipPortPages.js`, `ports/index.html`, directory tests

## G. PR head SHA

See git after push (replaces `c8fdfcfca` when blocker commit lands).

## H. MERGE READY — **NO**

- **Code/templates:** ready for merge review.
- **Production deploy:** still requires **ports CI generation** after merge (not raw regen HTML).
- **Owner:** visual sign-off on screenshots still outstanding.
