# AdSense classification — Marigot override correction (2026-10-28)

**Mode:** Report-only dry-run. No indexing apply, no manifest, no HTML/sitemap/CMS changes.

| Item | Value |
|------|--------|
| Production base | `369b39db215bac6119543b37fe5cfab25b1e93e9` |
| Worktree | `seadays-landing-chore-adsense-marigot-classification-refresh` |
| Branch | `chore/adsense-marigot-classification-refresh` |
| Uncorrected baseline (bundled) | `inputs/oct28-uncorrected-baseline.csv` (see `inputs/sweep-provenance.json`) |
| Bundled sweep | `inputs/sd_sweep-live-2026-10-28.json` + `inputs/sweep-provenance.json` |
| Classified rows | 252 (250 sitemap detail URLs + 2 directory hubs) |

## Counts (uncorrected → corrected)

| Bucket | Before | After |
|--------|-------:|------:|
| KEEP_INDEX | 53 | 54 |
| IMPROVE | 79 | 78 |
| NOINDEX_CANDIDATE | 120 | 120 |

**Only movement:** `marigot-st-maarten` IMPROVE → KEEP_INDEX.

## Reproduce

```bash
cd /Users/sharanestone/Semprog/seadays-landing-chore-adsense-marigot-classification-refresh
SEADAYS_PRODUCTION_BASE=369b39db215bac6119543b37fe5cfab25b1e93e9 node scripts/qa/adsense-port-ship-indexing-dry-run.js \
  --sweep qa-evidence/adsense-indexing-dry-run-2026-10-28-marigot-corrected/inputs/sd_sweep-live-2026-10-28.json \
  --out-dir qa-evidence/adsense-indexing-dry-run-2026-10-28-marigot-corrected
node scripts/test-adsense-port-ship-indexing-dry-run.js
```
