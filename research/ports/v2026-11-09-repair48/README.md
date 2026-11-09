# Port research composite — Stage 67 YAML repair (48 ports)

Verified Git `by-port` tree (merged research **`f4552cf944e55c1087797567661b948e13e3978c`**) is combined at apply time with the owner deliverable index at `final/PORTS_MASTER_INDEX.json` plus the landing SHA patch:

`qa-evidence/stage67-yaml-repair-48/PORTS_MASTER_INDEX_SHA_PATCH.json`

Reconcile runner: `node scripts/stage67-reconcile-repaired-48.js`

Environment:

- `PORT_RESEARCH_BY_PORT_ROOT` — checkout of `seadays-ports-deliverables` at commit above
- `PORT_RESEARCH_INDEX_SOURCE` — path to owner `PORTS_MASTER_INDEX.json` (2026-11-06 deliverable)
- `SEADAYS_APP_ROOT` — SeaDays app repo for identifier resolution (defaults to sibling `Seadays-trust-boundary`)

No passenger guides or port HTML are published from this folder.
