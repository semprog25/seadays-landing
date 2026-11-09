# Falmouth cross-country `app_port_id` — deferred migration

## Confirmed collision

- **Landing slugs:** `falmouth-united-kingdom`, `falmouth-jamaica`
- **Shared `app_port_id` today:** `falmouth` (app dataset + identifier manifest)
- **Production JSON:** single `byAppPortId.falmouth` UK passenger editorial (`landing_slug` = `falmouth-united-kingdom`)

This is **not** an intentional alias (unlike Nice/Villefranche in `collisionGroups.js`).

## Guard (landing only, this PR)

- `scripts/lib/bulkPortPublication/crossCountryHomonymPublicationGuards.js`
- Blocks `falmouth-jamaica` from writing `byAppPortId.falmouth` while UK passenger editorial is present
- **Persistence boundary:** `writePublicPortGuidesFile` / `writePublicPortGuidesFileAtomic` (payload assert before any disk write)
- **Assignment boundary:** `assignPublicPortGuideByAppPortId` on stage `*-apply-*` and `applyPortResearch` merges
- **Empty bootstrap:** `sanitizeBootstrapPublicPortGuidesExtract` in `generateBlogs` / `regenerate-port-pages` omits unsafe `falmouth` slot from app extract only (does not run when guides JSON already populated)

### Writer coverage

| Path | Class | Guard |
|------|-------|-------|
| Stage `29–67` apply + `applyPortResearch` | Active publication | assign + `writePublicPortGuidesFile` / `writePublicPortGuidesFileAtomic` |
| `stage55-scope-pr-to-five.js` | Legacy release scope (maintenance) | `writePublicPortGuidesFile` |
| `strip-public-port-guide-research-markers.js` (`--write`) | Maintenance | `writePublicPortGuidesFile` |
| `strip-port-guide-boilerplate.js` | Maintenance | `writePublicPortGuidesFile` |
| `enrich-priority-port-guides.js` | Maintenance | `writePublicPortGuidesFile` |
| `phase1-correction-pass.js` | Maintenance | `writePublicPortGuidesFile` |
| `correct-phase1-port-quality.js` | Maintenance | `writePublicPortGuidesFile` |
| `extract-public-port-guides.js` | Active bootstrap tool | `writePublicPortGuidesFile` |
| `generateBlogs.js` / `regenerate-port-pages.js` empty guides | CI bootstrap | sanitize + `writePublicPortGuidesFile` |
| Stage validators / reconcile (read-only) | Read-only | N/A — cannot modify Falmouth slot |
| Manual `fs.writeFileSync` / editor | Out of band | Not guardable in repo |

## Required cross-repo migration (not done here)

1. Split app cruise dataset IDs: e.g. `falmouth` (UK) vs `falmouth-jamaica`
2. Update review-key / picker maps and affiliate `knownPortIds`
3. Add landing `byAppPortId.falmouth-jamaica` when owner approves Jamaica passenger content
4. Retire shared `falmouth` id for Jamaica-only references

Until migration, **do not** publish Jamaica passenger editorial into `byAppPortId.falmouth`.
