# Geo holds — owner review pack (Aberdeen + Le Havre)

**Prepared:** 2026-11-13 · **Base `main`:** `64d6b97a31a809ab40072371c54e3f4fc449bcf8`
**Status:** Owner authorized replacements — published via geo-replacements release PR.

## Owner decisions required

| Port | Current frozen | Recommended | Owner choice (pick one) |
|------|----------------|-------------|-------------------------|
| **aberdeen-united-kingdom** | `pexels:5684661` NEEDS_GEO_REVIEW | Commons harbour **A** | `APPROVE_REPLACEMENT_COMMONS_HARBOUR_A` · `RETAIN_FROZEN_PEXELS` · `COMMONS_MARISCHAL_B` |
| **le-havre-paris-france** | `pexels:11691091` NEEDS_GEO_REVIEW | Batch 03 **A** `31781110` | `APPROVE_SWITCH_TO_BATCH03_A` · `RETAIN_FROZEN_PEXELS_B` · `REQUEST_NEW_ROUND4` |

---

## Aberdeen

### Current (unchanged)

- **ID:** `pexels:5684661` · **Owner:** APPROVE_B (Batch 05 frozen)
- **Source:** https://www.pexels.com/photo/bridge-in-aberdeen-united-kingdom-5684661/
- **Photographer:** Kieren Ridley · **Licence:** Pexels License
- **Geo:** NEEDS_GEO_REVIEW — title only; UK-only location; conflicting England tags; no GPS; bridge not uniquely Aberdeen

### Recommended replacement — Commons harbour A

| Field | Value |
|-------|--------|
| **File** | `File:Aberdeen_Harbour_-_geograph.org.uk_-_3122252.jpg` |
| **Commons** | https://commons.wikimedia.org/wiki/File:Aberdeen_Harbour_-_geograph.org.uk_-_3122252.jpg |
| **Geograph** | https://www.geograph.org.uk/photo/3122252 |
| **Photographer** | Graeme Smith |
| **Licence** | **CC BY-SA 2.0** — https://creativecommons.org/licenses/by-sa/2.0/ |
| **Attribution** | Required (credit + licence link; SA if adapted) |
| **GPS** | Camera 57°08′44.1″ N, 2°05′24″ W; object ~57°08′46″ N, 2°05′26″ W |
| **Subject** | Aberdeen Harbour / port / city center |
| **Local preview** | `qa-evidence/geo-replacements-20261113/previews/aberdeen-united-kingdom-alt-A-harbour.webp` |
| **Staging source** | `ports-directory-thumbnails-20261104/.../aberdeen-united-kingdom-alt-A-harbour.webp` |

**Why A over Marischal B:** Harbour imagery is more relevant for cruise passengers (per task brief).

---

## Le Havre

### Current (unchanged)

- **ID:** `pexels:11691091` · **Owner:** APPROVE_B (Batch 03 frozen)
- **Source:** https://www.pexels.com/photo/photo-of-sailboats-docked-at-the-marina-11691091/
- **Photographer:** Daria K · **Licence:** Pexels License
- **Geo:** NEEDS_GEO_REVIEW — generic sailboat marina; weak distinctive Le Havre / cruise port identity (see `batch03-selected-photo-verification-v2.json`)

### Recommended replacement — existing Batch 03 Pexels A (no new research)

| Field | Value |
|-------|--------|
| **ID** | `pexels:31781110` |
| **Source** | https://www.pexels.com/photo/scenic-view-of-river-and-town-in-le-havre-france-31781110/ |
| **Photographer** | Zarina Maizel |
| **Licence** | Pexels License — https://www.pexels.com/license/ |
| **Pexels location** | Le Havre, France (page + description: river and town architecture) |
| **Pair manifest** | `geoStatus: OK` — “Seine estuary waterfront and Le Havre town architecture” |
| **Local preview** | `qa-evidence/geo-replacements-20261113/previews/le-havre-paris-france-batch03-A-pexels-31781110.webp` |
| **Note** | Was **rejected** when owner chose B; publication requires explicit **slot switch** approval, not a new download |

**Narrow search:** Not run — existing verified-quality alternative already in frozen Batch 03 manifest.

---

## Files in this pack (local, uncommitted)

- `data/proposed-destination-photo-geo-replacements-v1.json`
- `qa-evidence/geo-replacements-20261113/OWNER_GEO_REPLACEMENT_REVIEW.md` (this file)
- `qa-evidence/geo-replacements-20261113/owner-geo-replacements-contact-sheet.html`
- `qa-evidence/geo-replacements-20261113/previews/*.webp` (4)

**Worktree:** `seadays-landing/.worktrees/geo-replacements-owner-review-20261113`

## Combined publication plan (after owner approval)

1. **One PR** `feat(ports): publish Aberdeen + Le Havre geo-cleared destination images` (or two micro-PRs if preferred).
2. **Aberdeen:** Apply Commons A WebP → `humanApproved` + owner-candidates with `wikimediaFileName`, hero **CC BY-SA 2.0** figcaption (Commons + photographer).
3. **Le Havre:** Amend frozen decision metadata to APPROVE_A (owner-signed) OR apply with documented owner slot switch; copy existing batch03 staging WebP; Pexels credit in figcaption.
4. **Scope:** ~2 WebPs, 2 port HTML, `ports/index.html`, review-state, owner-candidates, catalog, ledger geo notes, QA — expect **`channel=skip`**.
5. **Exclude:** Nice, Dubai rework, other batches.

## Workflow classification (this prep only)

`channel=skip` — QA JSON/HTML/previews only; no generator path edits.
