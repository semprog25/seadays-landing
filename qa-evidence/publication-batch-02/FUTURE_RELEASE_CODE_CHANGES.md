# Batch 02 Mormugao — proposed main-tree changes (not applied)

**Target PE after authorized production merge:** 359 → 360  
**Baseline main at prep:** `bdd1802dd639a388268dcba5d154c5c12fd93e79`

## 1. `scripts/lib/bulkPortPublication/stage43PublishedBaseline.js`

Add owner publication exception set (mirror Wave 01), active only when guide JSON carries `owner_publication_authorized: true`:

```javascript
const BATCH02_OWNER_POLICY_EXCEPTION_SLUGS = new Set(['mormugao-port-goa-india']);
```

In `buildActiveHardExclude()`, after Wave 01 deletes:

```javascript
for (const slug of BATCH02_OWNER_POLICY_EXCEPTION_SLUGS) {
  if (/* guide.owner_publication_authorized */) active.delete(slug);
}
```

**Keep** `goa-india` on `STAGE43_HARD_EXCLUDE_HISTORICAL` permanently (redirect alias — not a PE slot).

Record clearance: `qa-evidence/publication-batch-02/BATCH_02_PUBLICATION_POLICY_CLEARANCE.json` (future; `owner_publication_authorized: true` only when owner signs publication).

## 2. PE validators (359 → 360)

| File | Change |
|------|--------|
| `scripts/validate-pages-jekyll-output.js` | `359` → `360` when Batch 02 merges to production |
| `scripts/test-wave01-publication-release.js` | If superseded, pin post-Batch-02 baseline or add `test-publication-batch-02-release.js` |
| `scripts/test-publication-batch-apply-safety.js` | Accept `360` when batch-02 production merge authorized |
| `scripts/test-stage92-bodo-publication-safety.js` | Production PE baseline `359` (post–Wave 1) |

## 3. `researchImport` on apply (production merge)

Set on `byAppPortId.mormugao` when owner publication authorized:

- `owner_publication_authorized: true`
- `owner_indexing_authorized: false` until separate sign-off
- `goa_canonical_decision_ref`: `qa-evidence/publication-batch-02/GOA_CANONICAL_OWNER_DECISION.json`
- Preserve `research_sha256`, `field_exclusions`, `research_main_pin`

## 4. Explicitly unchanged at publication merge

- `ports/goa-india/index.html` redirect stub
- `PORT_ALIAS_REDIRECTS` / `portBrowseAliases.js`
- Sitemap indexing for Mormugao (until `owner_indexing_authorized`)
- `eilat-israel` and other Stage 43 holds

## 5. Suggested merge order (future)

1. Policy clearance JSON + Stage 43 exception code (publication auth true).
2. Apply candidate from `qa-evidence/publication-batch-02/candidates/mormugao-port-goa-india/`.
3. Bump PE validators to 360.
4. Deploy with historical publication gate + `validate-pages-jekyll-output`.
