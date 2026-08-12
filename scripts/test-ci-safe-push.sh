#!/usr/bin/env bash
# Local simulation of ci-safe-push-generated.sh (no network, no production).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="${ROOT}/scripts/ci-safe-push-generated.sh"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/ci-safe-push.XXXXXX")"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

pass=0
fail=0
ok() { echo "PASS: $*"; pass=$((pass + 1)); }
bad() { echo "FAIL: $*"; fail=$((fail + 1)); }

# Bare "origin" + two clones simulating runner + concurrent main updates
git init --bare "${TMP}/origin.git" >/dev/null
git -C "${TMP}/origin.git" symbolic-ref HEAD refs/heads/main

git clone "${TMP}/origin.git" "${TMP}/main" >/dev/null 2>&1
git -C "${TMP}/main" config user.email "test@example.com"
git -C "${TMP}/main" config user.name "tester"
mkdir -p "${TMP}/main/blog" "${TMP}/main/ports" "${TMP}/main/ships"
echo base > "${TMP}/main/index.html"
echo base > "${TMP}/main/sitemap.xml"
echo base > "${TMP}/main/blog/a.html"
echo base > "${TMP}/main/ports/index.html"
echo base > "${TMP}/main/ships/index.html"
git -C "${TMP}/main" add .
git -C "${TMP}/main" commit -m "base" >/dev/null
git -C "${TMP}/main" push -u origin main >/dev/null

# ---------- Test 1: normal push (main unchanged) ----------
git clone "${TMP}/origin.git" "${TMP}/genA" >/dev/null 2>&1
git -C "${TMP}/genA" config user.email "bot@example.com"
git -C "${TMP}/genA" config user.name "bot"
SOURCE_A="$(git -C "${TMP}/genA" rev-parse HEAD)"
echo regeneratedA > "${TMP}/genA/blog/a.html"
echo regeneratedA > "${TMP}/genA/ports/index.html"
git -C "${TMP}/genA" add blog ports ships index.html sitemap.xml
git -C "${TMP}/genA" commit -m "chore: regenerate static blog, ships, ports, and sitemap [skip ci]" >/dev/null
(
  cd "${TMP}/genA"
  SOURCE_SHA="${SOURCE_A}" \
  PUSH_REMOTE=origin \
  PUSH_BRANCH=main \
  REMOTE_REF=origin/main \
  bash "${SCRIPT}"
) >/dev/null
REMOTE_AFTER="$(git -C "${TMP}/origin.git" rev-parse main)"
CONTENT="$(git --git-dir="${TMP}/origin.git" show main:blog/a.html)"
if [[ "${CONTENT}" == "regeneratedA" ]] && [[ "${REMOTE_AFTER}" != "${SOURCE_A}" ]]; then
  ok "normal push"
else
  bad "normal push (content=${CONTENT})"
fi

# ---------- Test 2: main moves during generation ----------
# Reset origin to SOURCE_A for a clean race simulation based on current tip
# Re-clone from current origin tip as generation base B
git clone "${TMP}/origin.git" "${TMP}/genB" >/dev/null 2>&1
git -C "${TMP}/genB" config user.email "bot@example.com"
git -C "${TMP}/genB" config user.name "bot"
SOURCE_B="$(git -C "${TMP}/genB" rev-parse HEAD)"

# Concurrent commit on main while genB "generates"
git clone "${TMP}/origin.git" "${TMP}/concurrent" >/dev/null 2>&1
git -C "${TMP}/concurrent" config user.email "dev@example.com"
git -C "${TMP}/concurrent" config user.name "dev"
echo concurrent > "${TMP}/concurrent/README.md"
mkdir -p "${TMP}/concurrent"
git -C "${TMP}/concurrent" add README.md
git -C "${TMP}/concurrent" commit -m "unrelated: concurrent main change" >/dev/null
git -C "${TMP}/concurrent" push origin main >/dev/null
CONCURRENT_SHA="$(git -C "${TMP}/origin.git" rev-parse main)"

# genB finishes generation based on SOURCE_B (stale tip)
echo regeneratedB > "${TMP}/genB/blog/a.html"
echo regeneratedB > "${TMP}/genB/ports/index.html"
# leave ships as-is to reduce conflict surface; ports will rebase cleanly as text change
git -C "${TMP}/genB" add blog ports ships index.html sitemap.xml
git -C "${TMP}/genB" commit -m "chore: regenerate static blog, ships, ports, and sitemap [skip ci]" >/dev/null

(
  cd "${TMP}/genB"
  SOURCE_SHA="${SOURCE_B}" \
  PUSH_REMOTE=origin \
  PUSH_BRANCH=main \
  REMOTE_REF=origin/main \
  bash "${SCRIPT}"
) >/tmp/ci-safe-push-test2.log

REMOTE_FINAL="$(git -C "${TMP}/origin.git" rev-parse main)"
HAS_README="$(git --git-dir="${TMP}/origin.git" show main:README.md 2>/dev/null || true)"
HAS_B="$(git --git-dir="${TMP}/origin.git" show main:blog/a.html 2>/dev/null || true)"
# Concurrent commit must still exist; regenerated content should land via rebase
if [[ "${HAS_README}" == "concurrent" ]] && [[ "${HAS_B}" == "regeneratedB" ]] && git -C "${TMP}/origin.git" merge-base --is-ancestor "${CONCURRENT_SHA}" "${REMOTE_FINAL}"; then
  ok "main moves during generation (rebase preserves concurrent commit)"
else
  bad "main moves during generation (readme=${HAS_README} blog=${HAS_B} log=$(cat /tmp/ci-safe-push-test2.log))"
fi

# ---------- Test 3: never force-pushes (script source check) ----------
if rg -n 'push --force|push -f|force-with-lease' "${SCRIPT}" >/dev/null; then
  bad "script contains force push"
else
  ok "no force push in script"
fi

# ---------- Test 4: conflict aborts without overwriting ----------
git clone "${TMP}/origin.git" "${TMP}/genC" >/dev/null 2>&1
git -C "${TMP}/genC" config user.email "bot@example.com"
git -C "${TMP}/genC" config user.name "bot"
SOURCE_C="$(git -C "${TMP}/genC" rev-parse HEAD)"

git clone "${TMP}/origin.git" "${TMP}/conflictor" >/dev/null 2>&1
git -C "${TMP}/conflictor" config user.email "dev@example.com"
git -C "${TMP}/conflictor" config user.name "dev"
echo conflict-main > "${TMP}/conflictor/ports/index.html"
git -C "${TMP}/conflictor" add ports/index.html
git -C "${TMP}/conflictor" commit -m "unrelated: conflict on ports index" >/dev/null
git -C "${TMP}/conflictor" push origin main >/dev/null
PROTECTED="$(git --git-dir="${TMP}/origin.git" show main:ports/index.html)"

echo conflict-gen > "${TMP}/genC/ports/index.html"
git -C "${TMP}/genC" add ports/index.html
git -C "${TMP}/genC" commit -m "chore: regenerate static blog, ships, ports, and sitemap [skip ci]" >/dev/null
set +e
(
  cd "${TMP}/genC"
  SOURCE_SHA="${SOURCE_C}" \
  PUSH_REMOTE=origin \
  PUSH_BRANCH=main \
  REMOTE_REF=origin/main \
  bash "${SCRIPT}"
) >/tmp/ci-safe-push-test4.log
rc=$?
set -e
AFTER="$(git --git-dir="${TMP}/origin.git" show main:ports/index.html)"
if [[ "${rc}" -eq 0 ]] && [[ "${AFTER}" == "${PROTECTED}" ]]; then
  ok "rebase conflict aborts without overwriting main"
else
  bad "rebase conflict handling (rc=${rc} after=${AFTER})"
fi

echo
echo "ci-safe-push tests: ${pass} passed, ${fail} failed"
[[ "${fail}" -eq 0 ]]
