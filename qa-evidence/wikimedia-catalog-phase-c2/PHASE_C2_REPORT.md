# Wikimedia catalogue Phase C2 — website mock integration report

**Date:** 2026-10-29  
**Status:** **READY** (local mock preview + QA complete; no production wiring)  
**App catalogue base (reference):** `50bf8883130c33394406fb9b95ddd4eaf422f6c4` (`feat/wikimedia-catalog-phase-c1`)  
**No commit / push / deploy / KV / edge changes performed.**

---

## A. Website branch / worktree / HEAD

| Field | Value |
|-------|--------|
| Worktree | `seadays-landing/.worktrees/wikimedia-catalog-phase-c2` |
| Branch | `feat/wikimedia-catalog-phase-c2` |
| HEAD | `be175c40488b9f82358c108fcef3faefc88e1e28` |
| Tracks | `origin/main` (verified current production website base) |

---

## B. Changed-file inventory (Phase C2 worktree only)

| Path | Role |
|------|------|
| `data/catalog-image-mock/*.json` | Pilot slug maps, `records-by-slug`, port destination heroes (from Phase C1 vetted mock) |
| `scripts/lib/catalogImage/*.js` | Shared `CatalogImageRecordV1` read/validate + mock preview resolver (mirrors app Phase A/C1) |
| `scripts/buildCatalogMockPreviewPages.js` | Writes preview HTML under `qa-evidence/` only |
| `scripts/test-catalog-mock-preview.js` | Focused preview tests + production immutability checks |
| `package.json` | Adds `build:catalog-mock-preview`, `test:catalog-mock-preview` only |
| `qa-evidence/wikimedia-catalog-phase-c2/**` | Manifests, screenshots, this report |

**Not modified:** `ships/**`, `ports/**`, `blog/**`, sitemaps, robots, canonicals, CMS data, AdSense, `generateBlogs.js`, `.github/ci-generation-release-guard.json`.

---

## C. Shared catalogue compatibility

- Reuses **Phase C1** pilot maps, six infrastructure/ship records, and port **destinationHero** vs **portInfrastructure** split.
- Validator rules align with app `validateCatalogImageRecordV1` (https-only media, license + attribution, `v: 1`, verified-only display).
- Mock records remain **draft semantics in repo**; preview simulates **`status: verified`** only in isolated HTML output.
- Contract reference: app `docs/catalog-image-integration-contract.md` (unchanged in this phase).

---

## D. Six pilot preview results

Preview URLs (local server root = worktree, port **3012** during QA):

`http://127.0.0.1:3012/qa-evidence/wikimedia-catalog-phase-c2/preview-on/<ships|ports>/<slug>/index.html`

| Entity | Slug | Preview ON hero | Notes |
|--------|------|-----------------|-------|
| Wonder of the Seas | `wonder-of-the-seas` | Ship Commons hero injected | Málaga cropped ship photo |
| AIDAcosma | `aidacosma` | Ship Commons hero injected | Zeebrugge bow view |
| Symphony of the Seas | `symphony-of-the-seas` | Ship Commons hero injected | Nassau |
| Hamburg | `hamburg-germany` | Destination Elbphilharmonie (same subject as production) | + terminal block |
| Barcelona | `barcelona-spain` | Barcelona skyline destination hero | + Moll Adossat terminal |
| Miami | `miami-fl-united-states` | Miami skyline destination hero | + PortMiami cruise ships |

Build:

```bash
cd .worktrees/wikimedia-catalog-phase-c2
node scripts/buildCatalogMockPreviewPages.js                    # preview OFF manifest
SEADAYS_MOCK_CATALOG_PREVIEW=true node scripts/buildCatalogMockPreviewPages.js
```

---

## E. Destination vs terminal roles (ports)

| Port | `destinationHero` | `portInfrastructure` |
|------|-------------------|----------------------|
| Hamburg | Elbphilharmonie / harbour skyline | Cruise Center HafenCity (Chicagokai) |
| Barcelona | `Barcelona_Skyline.jpg` | Moll Adossat Terminal B |
| Miami | `Miami_Sunset` skyline | `Miamicruiseships20071208.jpg` (berths) |

Terminal imagery is rendered in **`#catalog-mock-terminal-preview`** above `#getting-there` (preview-on only).

---

## F. Attribution verification

Each preview figure includes a **`<dl class="catalog-attribution">`** with:

- **Creator** (linked when `creatorUrl` present)
- **Source** → Wikimedia Commons (`commons.pageUrl`)
- **License** → name + `licenseUrl`

Separate attribution blocks for **destination hero** and **terminal** sections on port pages. Caption-only figcaptions are not used for mock catalogue heroes.

---

## G. Mobile / desktop screenshots

Stored under:

`qa-evidence/wikimedia-catalog-phase-c2/screenshots/`

| File pattern | Viewport |
|--------------|----------|
| `{slug}-mobile-390x844.png` | 390×844 |
| `{slug}-desktop-1280x800.png` | 1280×800 |

Slugs: `wonder-of-the-seas`, `aidacosma`, `symphony-of-the-seas`, `hamburg-germany`, `barcelona-spain`, `miami-fl-united-states`.

Visual checks: MOCK banner visible, 3:2 `.catalog-preview-frame`, images loaded, no obvious horizontal overflow at tested widths.

---

## H. Preview OFF comparison

- `preview-off/` copies are **byte-identical** to production `ships/` / `ports/` sources (`preview-off-manifest.json` → `unchangedFromProduction: true` for all six).
- Live production Hamburg (`/ports/hamburg-germany/`) Elbphilharmonie hero **unchanged** on disk.
- Screenshots: `hamburg-production-desktop-1280x800.png` vs `hamburg-preview-off-desktop-1280x800.png` (equivalent hero; preview-off copy matches production HTML).

Default: `SEADAYS_MOCK_CATALOG_PREVIEW` unset → **`isMockCatalogPreviewEnabled()` false**.

---

## I. Tests / build results

| Command | Result |
|---------|--------|
| `npm run test:catalog-mock-preview` | **PASS** |
| `npm run test:ci-generation-release-guard` | **PASS** (PR #43 guard intact) |
| `node scripts/buildCatalogMockPreviewPages.js` | **PASS** (6 preview-off copies) |
| `SEADAYS_MOCK_CATALOG_PREVIEW=true node scripts/buildCatalogMockPreviewPages.js` | **PASS** (6 preview-on pages) |

No catalogue generator (`generateBlogs.js` / `--catalogue-only`) was executed. No KV/network catalogue ingestion.

---

## J. Existing WIP preservation

| Repo | State |
|------|--------|
| App `Seadays-trust-boundary` @ `65c9c6a` | Dirty WIP untouched; Phase A/B/C1 worktrees preserved |
| Landing primary @ `fix/port-ship-content-recovery` | CMS/AdSense WIP untouched |
| Phase C2 worktree | Isolated branch from `origin/main` only |

See `REPO_SAFETY_SNAPSHOT.md` in this folder.

---

## K. Remaining production integration needs

1. Authorized Edge GET returning validated `CatalogImageRecordV1` + `display` payload by slug.
2. Opt-in build-time wiring in `scripts/lib/seoShipPortPages.js` / `generateBlogs.js` (not broad regen; respect CI guard).
3. Production attribution HTML parity with preview `<dl class="catalog-attribution">` pattern.
4. KV write workflow + pilot slug promotion (product approval).
5. App/website fallback chain when record missing or `status !== verified`.
6. Optional: share JSON fixtures via single package or sync script from app `phaseCVerifiedCatalog` to landing `data/catalog-image-mock/`.

---

## L. Verdict

**READY** for a future PR that wires preview logic behind an explicit env flag and production authorization gates.

**BLOCKED items:** none for Phase C2 scope (all six pilots have complete Commons provenance from Phase B/C1; no unlicensed city images added).

---

## Quick local QA replay

```bash
cd seadays-landing/.worktrees/wikimedia-catalog-phase-c2
npm run test:catalog-mock-preview
SEADAYS_MOCK_CATALOG_PREVIEW=true npm run build:catalog-mock-preview
PORT=3012 node server.js
# open preview-on URLs under /qa-evidence/wikimedia-catalog-phase-c2/preview-on/
```
