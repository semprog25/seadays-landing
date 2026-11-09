# Stage 67 — 406-port inventory accounting (read-only)

**Production baseline (verified main `92788f0b`):** **270** distinct `byAppPortId` entries with passenger editorial lead.

**Research scale:** **406** canonical `app_port_id` rows in the identifier manifest (Nice duplicate slugs do not double-count publications).

**Remaining after baseline:** **136** unpublished `app_port_id` rows (`REMAINING_INVENTORY.json` → `unpublished_app_port_ids`).

**Stage 67 cohort (this PR):** **2** net-new approved slugs (`victoria-bc-canada`, `vlore-albania`).

**Projected if merged:** **272 / 406** published · **134** remaining.

**50-port target not met:** post–Stage 66 only **7** bootstrap rows pass `policy_ok`; **48** blocked by research YAML/policy simulation; **0** policy-ready `NEEDS_REVIEW` rows outside historical excludes. **5** additional bootstrap selections held (editorial/factual gates).
