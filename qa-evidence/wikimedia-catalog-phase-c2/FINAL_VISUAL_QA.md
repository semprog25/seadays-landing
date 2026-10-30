# Phase C2 final visual QA (2026-10-29)

- **Server:** `python3 -m http.server 8765` from worktree root (avoids Express rate limit during screenshot bursts).
- **DOM gate:** All six pilots PASS at 390×844 and 1280×800 (MOCK banner, loaded Commons images, 3/2 frame, Creator + Commons + License blocks).
- **Fix applied before commit:** Preview builder no longer skips MOCK banner when preview CSS is injected; phase-1 port pages (Barcelona, Miami) now receive destination heroes after `<p class="lead">`.
- **Screenshots:** `screenshots-final/*-{mobile-390x844,desktop-1280x800}.png`
- **Preview OFF:** `cmp` byte-identical to production for all six sources.
