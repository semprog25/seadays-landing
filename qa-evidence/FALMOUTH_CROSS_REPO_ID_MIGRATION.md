# Falmouth cross-country `app_port_id` — deferred migration

## Confirmed collision

- **Landing slugs:** `falmouth-united-kingdom`, `falmouth-jamaica`
- **Shared `app_port_id` today:** `falmouth` (app dataset + identifier manifest)
- **Production JSON:** single `byAppPortId.falmouth` UK passenger editorial (`landing_slug` = `falmouth-united-kingdom`)

This is **not** an intentional alias (unlike Nice/Villefranche in `collisionGroups.js`).

## Guard (landing only, this PR)

- `scripts/lib/bulkPortPublication/crossCountryHomonymPublicationGuards.js`
- Blocks `falmouth-jamaica` from writing `byAppPortId.falmouth` while UK passenger editorial is present
- Validated on `writePublicPortGuidesFile`, `applyPortResearch` atomic writes, and stage `*-apply-*` assignment

## Required cross-repo migration (not done here)

1. Split app cruise dataset IDs: e.g. `falmouth` (UK) vs `falmouth-jamaica`
2. Update review-key / picker maps and affiliate `knownPortIds`
3. Add landing `byAppPortId.falmouth-jamaica` when owner approves Jamaica passenger content
4. Retire shared `falmouth` id for Jamaica-only references

Until migration, **do not** publish Jamaica passenger editorial into `byAppPortId.falmouth`.
