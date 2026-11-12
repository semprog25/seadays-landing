# Batch 03 — Ocho Rios publication release rollback

## Preconditions

- Merge **not** yet authorized; production on `main` remains PE **360** until this PR merges and Pages deploys.

## Rollback (post-merge only, owner-authorized)

1. Restore `data/public-port-guides.json` from  
   `qa-evidence/publication-batch-03-ocho/rollback-pre-apply/ocho-rios-jamaica/public-port-guides.json`
2. Restore `ports/ocho-rios-jamaica/index.html` from  
   `qa-evidence/publication-batch-03-ocho/rollback-pre-apply/ocho-rios-jamaica/ports/ocho-rios-jamaica/index.html`
3. Verify PE returns to **360** via `node scripts/publication-batch-workflow.js matrix`
4. Run `test-batch03-ocho-rios-publication-release.js` (expect fail until reverted) and historical policy gate.

## Evidence pins

- Candidate hash: `5635233496acf009f81ec86289e3a165bfb1d93302deaee74709a71f47b3032e`
- Research SHA: `50682517fb65fb632488d2075a6782d1e049956b84f61b91c4e9171d720b99a2`
- Policy: `BATCH03_OCHO_PUBLICATION_POLICY_CLEARANCE.json`
