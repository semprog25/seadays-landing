# Stage 66 — 406-port inventory accounting (read-only)

**Production passenger count (canonical):** count distinct `byAppPortId` entries with `usesPassengerEditorialLead` → **220** at baseline `30018ce`.

**Reconcile unpublished (slug-set):** `buildPublishedSlugSet` → **221** published slugs, **185** unpublished research rows (221 + 185 = 406).

**One-port duplicate, not a missing guide:** research manifest includes both `nice-france` (Stage 34 locked slug) and `villefranche-nice-france` (canonical `researchImport.landing_slug` on `app_port_id` `nice`). A single live passenger guide covers both; slug-set math counts two.

**After Stage 66 merge (projected):** **270** passenger guides · **136** remaining (406 − 270).
