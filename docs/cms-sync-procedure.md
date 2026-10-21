# CMS sync procedure (authoritative copy back to Portside)

**Status:** Documentation only. No writes are performed by the landing repo automation described here.

## Goal

Align Portside CMS records with corrected website content in `data/blog-body-overrides/` and `meta.json` **without** changing article ids, slugs, draft state, website visibility, or unrelated metadata.

## Preconditions

1. Fresh manifest: `node scripts/cms-reconciliation-dry-run.js` with `SUPABASE_ANON_KEY` (or publishable key via `SEADAYS_APP_ROOT` / app `info.tsx`). Confirm `data/cms-reconciliation-manifest.json` has `complete: true` and `overrideCount` matches `meta.json`.
2. **Per article:** `GET /make-server-51d3ca8d/portside-articles/:id` immediately before any write. Compare field-by-field to the manifest row and local override files.
3. **Author session:** Authenticated user must pass `requirePortsidePublisher` and `userId` in the POST body must match the normalized publisher id. Stored `authorId` on the record must match that publisher (403 if publishing for another author).
4. **Not in feed:** Do not treat override files as permission to publish. Resolve `isDraft` / `showOnWebsite` in CMS first for slugs marked `NOT_IN_FEED`.

## Write shape (update only)

```json
{
  "userId": "<publisher uuid matching session>",
  "article": {
    "id": "<existing id from GET>",
    "title": "<from local meta if title differs>",
    "excerpt": "<from local meta if excerpt differs>",
    "content": "<from data/blog-body-overrides/<slug>.html if body differs>",
    "isDraft": <copy from fresh GET — do not flip>,
    "showOnWebsite": <copy from fresh GET — do not flip>
  }
}
```

Omit fields that are already equal to CMS after the fresh GET. Include engagement fields (`likes`, `comments`, etc.) from GET if the client sends a partial payload — the server merges `{ ...existingArticle, ...articleIncoming }`, but **unspecified keys in `articleIncoming` do not delete existing keys**; values in the POST body **do** overwrite.

## What this API does **not** guarantee

| Gap | Risk | Mitigation |
|-----|------|------------|
| No `updatedAt` / ETag precondition on POST | Concurrent edit can be overwritten | Re-GET immediately before POST; abort if `updatedAt` changed since diff |
| No partial-field PATCH | Accidental inclusion of stale fields in POST body | Send only changed fields + `id`; merge GET snapshot for flags |
| Visibility is separate `PUT .../visibility` | Accidental visibility change if POST sends `showOnWebsite` | Copy visibility from GET; prefer omitting `showOnWebsite` unless intentionally changing |
| App feed uses same KV record | CMS body update changes in-app Portside article | Coordinate release comms; verify app feed after sync |

## Rollback

1. Export CMS article JSON from GET before POST (per-id backup file, dated).
2. To rollback: POST prior snapshot with same `id` and `authorId` (author session required).
3. Regenerate website from CMS (`generate-blogs` / GitHub workflow) only after CMS is confirmed.

## Audit trail

- Keep `data/cms-reconciliation-manifest.json` commit tied to the sync batch.
- Log operator, timestamp, and article ids updated.
- Re-run dry-run after sync; expect `fieldsDiffer` empty for synced slugs before removing local override files.

## Approval state

This procedure does not bypass CMS approval or publisher allowlists. If `requirePortsidePublisher` fails, stop — do not change ownership to bypass author permissions.
