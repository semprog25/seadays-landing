# Stage 11B — Visual root cause (Aalborg call-plan cards)

**Branch:** `fix/stage10-aalborg-editorial-recovery`  
**Worktree:** `seadays-landing/.worktrees/port-research-import-20261108`

## Symptom

Aalborg preview showed **correct** `pg-call-plan-card` **DOM** (articles, icons, titles) but **no** Hamburg-style card chrome—stacked plain text. Hamburg on the same template looked correct.

## Diagnosis

| Check | Aalborg (broken) | Hamburg |
| --- | --- | --- |
| DOM: `.pg-call-plan-card` × 3 | Yes | Yes |
| Inline CSS: `.pg-call-plan-card { … }` | **Missing** from `<style>` | Present |
| Computed `display` on `.pg-call-plan-card--standard` | `block` | `flex` |
| Computed `border-radius` | `0px` | `16px` |
| Console / CSS 404 | No errors; `/assets/css/site-shell.css` loads | Same |

Markup came from `portGuideSections.js` (`buildThingsToDoSection`). Full rules live in `PORT_GUIDE_STYLES` and are emitted by `seoShipPortPages.js` during regen.

## Verified root cause

`mergePublishedPortHtmlPreservation()` in `scripts/lib/publishedPortHtmlPreserve.js` **always replaced** the freshly generated `<style>` block with the **existing** committed inline CSS from `ports/aalborg-denmark/index.html`.

That older Aalborg bundle predated `PORT_GUIDE_STYLES` call-plan rules (partial `.pg-section` styles only). Regen produced the full Hamburg bundle, then preservation **reverted** the head styles—classic "HTML assertions pass, browser looks unstyled."

**Not caused by:** wrong server port alone (8765 can serve updated files once regen + preserve fix run; dual listeners were a preview pitfall, not the CSS bug).

## Evidence

- File diff: regenerated HTML contained `.pg-call-plan-card`; merged output did not until preserve logic fixed.
- Browser CDP (post-fix, port **8777**): Aalborg `display: flex`, `border-radius: 16px`, `border-top-width: 3px` on standard card; matches Hamburg.
- Before screenshot: `qa-evidence/stage11b-aalborg-visual/screenshots/aalborg-desktop-before.png` (Stage 10 capture, unstyled cards).
