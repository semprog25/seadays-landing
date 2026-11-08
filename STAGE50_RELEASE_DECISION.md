# Stage 50 — Final publication decision (PR #78)

## Verdict: **READY FOR MERGE APPROVAL**

*(Merge/deploy still **not** executed in Stage 50.)*

## PR gates

| Check | Result |
|-------|--------|
| PR state | **OPEN** |
| HEAD | `079887bc10ffbc4abe08f32b442559810f3e8554` (= approved `079887bc1`) |
| Base | `aa14e0f19f1df22f933fc25368bae82f5941a0e1` |
| Stage 49 release bundle | `74305cf8a7298f1ec9bcb23806119e12ace6448c25b02e80c7094738a606a789` **verified** |
| Guide mutations | **33** `appPortId`s |
| HTML mutations | **33** `ports/*/index.html` |
| `public-port-terminals.json` | **0** diff vs `main` |
| Marker / draft tests | **PASS** |
| `stage49-validate-release.js` | **PASS** (33/33) |

## Bundle reconciliation (P0)

- Authoritative Stage 45 rescore bundle: **`f13e73e56c6a099c…`** (proven).
- Prompt ref **`01fde17f…`**: **orphan** — **not** a content block; update owner runbooks.

## Factual (P0)

- **33 PASS / 0 HOLD** — see `STAGE50_GATEWAY_FACT_CHECK.md`.
- **1 advisory** (Phu My generic call-plan phrase).

## Visual (P0)

- **Playwright** on PR-built `ports/*/index.html` (file URLs): **33/33** desktop + mobile — see `STAGE50_VISUAL_QA.json`.
- **5 mobile screenshots:** `qa-evidence/stage50-visual/*-mobile.png` (HCMC, Port Said, Princess Cays, Boston, Dublin).
- Stage 49 HTML heuristics **superseded** for decision purposes.

## Regression notes

- `test-site-layout.js` **fails on branch** because new `qa-evidence/stage49-…/previews/` paths trigger layout index rules — **unrelated to port page quality**; pre-existing Barcelona assertions unchanged.
- Do **not** treat as release blocker.

## Remaining owner decisions

1. **Retire `01fde17f`** as Stage 45 bundle ID (use `f13e73e56c…`).
2. **Explicit publication authorization** to merge PR #78.
3. Optional post-merge copy tweak: Phu My `standardCall` template de-genericization.
4. Live smoke on production after deploy (out of scope here).

## Eligible port list (33)

`alanya-turkey`, `bari-italy`, `belfast-united-kingdom`, `bilbao-spain`, `bodrum-turkey`, `bordeaux-france`, `boston-ma-united-states`, `brindisi-italy`, `brisbane-australia`, `cagliari-italy`, `cairns-australia`, `cannes-france`, `charleston-sc-united-states`, `cherbourg-france`, `christchurch-lyttelton-new-zealand`, `crotone-italy`, `dover-united-kingdom`, `dublin-ireland`, `edinburgh-south-queensferry-united-kingdom`, `gijon-spain`, `halifax-ns-canada`, `ho-chi-minh-city-phu-my-vietnam`, `kiel-germany`, `monaco-monaco`, `panama-city-panama`, `port-said-egypt`, `princess-cays-bahamas`, `puerto-vallarta-mexico`, `punta-arenas-chile`, `riga-latvia`, `rotterdam-netherlands`, `salalah-oman`, `sir-bani-yas-island-united-arab-emirates`.
