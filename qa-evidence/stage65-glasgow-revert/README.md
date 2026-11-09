# Stage 65 — Glasgow unintended publication revert

Removes `glasgow` from `data/public-port-guides.json` after PR #85 left passenger JSON when `glasgow-united-kingdom` was swapped for `greifswald-germany`.

- **Rollback evidence:** `public-port-guides.before-revert.json`, `GLASGOW_REVERT_REPORT.json`
- **Approved cohort integrity:** `STAGE65_APPROVED_GUIDE_HASHES.json` (25 slugs unchanged)
- **Test:** `npm run test:stage65-glasgow-excluded`
