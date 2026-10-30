# Phase D3B — Verified catalogue website integration (local)

**Status:** READY (local verification complete)  
**Date:** 2026-10-29

## Summary

Isolated landing worktree on Phase C2 adds a **disabled-by-default** verified-catalogue preview path. Pilot HTML is written only under `qa-evidence/wikimedia-catalog-phase-d3b/`. Fixtures reproduce **D2H public GET envelopes** (`success`, `value`, optional `display`, `recordStatus`) with no Edge/KV/network I/O.

## Verification

| Check | Result |
|-------|--------|
| `npm run test:catalog-image-parity-d2` | PASS (5 cases) |
| `npm run test:catalog-mock-preview` | PASS (C2 path unchanged) |
| `npm run test:catalog-verified-preview` | PASS |
| `npm run test:ci-generation-release-guard` | PASS (PR #43 guard unchanged) |
| Preview OFF vs production `ships/`/`ports/` | Byte-identical (6 pilots) |
| Playwright visual QA 390×844 + 1280×800 | PASS (`visual-qa/D3B_VISUAL_QA.json`) |

## Feature flag

- `SEADAYS_VERIFIED_CATALOG_PREVIEW=true` — local preview build/test only
- Default unset/false — no generator or production HTML changes
- Not wired into `test:ci-channels` or production CI generation

## Image precedence (pilots)

- **Ships:** explicit licensed on-page hero wins when `entityImage` is set; verified hero only when preview enabled and no skip
- **Ports:** destination heroes — Hamburg Elbphilharmonie, Barcelona skyline, Miami sunset; infrastructure images only in terminal block

## Envelope snapshot

See `D2H_PUBLIC_GET_ENVELOPES.json` (9 pilot KV routes).
