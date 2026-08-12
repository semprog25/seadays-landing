#!/usr/bin/env bash
# Safe push of generated static site files onto origin/main.
#
# Required env:
#   SOURCE_SHA — commit this generation started from (GITHUB_SHA at job start)
#
# Never force-pushes. If main moved, rebases onto origin/main; on conflict aborts
# cleanly so a newer workflow can regenerate from the tip.
set -euo pipefail

REMOTE_REF="${REMOTE_REF:-origin/main}"
PUSH_REMOTE="${PUSH_REMOTE:-origin}"
PUSH_BRANCH="${PUSH_BRANCH:-main}"
COMMIT_MSG="${COMMIT_MSG:-chore: regenerate static blog, ships, ports, and sitemap [skip ci]}"
SOURCE_SHA="${SOURCE_SHA:-}"
PATHS=(blog sitemap.xml index.html ships ports)

if [[ -z "${SOURCE_SHA}" ]]; then
  echo "::error::SOURCE_SHA is required (generation base commit)"
  exit 1
fi

git config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}"

needs_commit=0
if ! git diff --quiet -- "${PATHS[@]}" 2>/dev/null; then
  needs_commit=1
fi
if ! git diff --quiet --cached -- "${PATHS[@]}" 2>/dev/null; then
  needs_commit=1
fi

if [[ "${needs_commit}" -eq 1 ]]; then
  git add blog/ sitemap.xml index.html ships/ ports/
  if ! git diff --cached --quiet; then
    git commit -m "${COMMIT_MSG}"
  fi
fi

# If nothing to push (HEAD still at SOURCE_SHA), exit success.
if [[ "$(git rev-parse HEAD)" == "${SOURCE_SHA}" ]]; then
  echo "[ci-safe-push] No generated commit to push (HEAD == SOURCE_SHA)."
  exit 0
fi

git fetch "${PUSH_REMOTE}" "${PUSH_BRANCH}"

REMOTE_SHA="$(git rev-parse "${REMOTE_REF}")"
echo "[ci-safe-push] SOURCE_SHA=${SOURCE_SHA}"
echo "[ci-safe-push] REMOTE_SHA=${REMOTE_SHA}"
echo "[ci-safe-push] LOCAL_HEAD=$(git rev-parse HEAD)"

if [[ "${REMOTE_SHA}" == "${SOURCE_SHA}" ]]; then
  echo "[ci-safe-push] main unchanged during generation — fast-forward push"
  git push "${PUSH_REMOTE}" "HEAD:${PUSH_BRANCH}"
  echo "[ci-safe-push] push OK"
  exit 0
fi

# Remote moved. Only proceed if remote is a descendant of our generation base.
if ! git merge-base --is-ancestor "${SOURCE_SHA}" "${REMOTE_SHA}"; then
  echo "::warning::origin/main is not a descendant of SOURCE_SHA — aborting push without force."
  exit 0
fi

echo "[ci-safe-push] main moved during generation — rebasing generated commit onto ${REMOTE_REF}"
set +e
git rebase "${REMOTE_REF}"
rebase_rc=$?
set -e
if [[ "${rebase_rc}" -ne 0 ]]; then
  echo "::warning::rebase conflict while integrating generated output onto newer main — aborting."
  echo "::warning::A newer Generate Static Blogs run should regenerate from the tip."
  git rebase --abort 2>/dev/null || true
  exit 0
fi

set +e
git push "${PUSH_REMOTE}" "HEAD:${PUSH_BRANCH}"
push_rc=$?
set -e
if [[ "${push_rc}" -eq 0 ]]; then
  echo "[ci-safe-push] rebase + push OK"
  exit 0
fi

echo "::warning::push rejected after rebase (main moved again) — aborting without force."
exit 0
