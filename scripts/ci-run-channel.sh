#!/usr/bin/env bash
# Run one landing generation channel, then optional featured-thumb repair.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

CHANNEL="${1:?channel required (blogs|ports|ships|catalogue|full|sitemap)}"
ALLOW_ORPHAN="${ALLOW_ORPHAN_CLEANUP:-false}"

mapfile -t ARGS < <(node -e '
const { generateArgsForChannel } = require("./scripts/lib/generateMode");
const channel = process.argv[1];
const allow = process.argv[2] === "true" || process.argv[2] === "1";
for (const arg of generateArgsForChannel(channel, { allowOrphanCleanup: allow })) {
  process.stdout.write(arg + "\n");
}
' "${CHANNEL}" "${ALLOW_ORPHAN}")

echo "[ci-run-channel] node scripts/generateBlogs.js ${ARGS[*]}"
node scripts/generateBlogs.js "${ARGS[@]}"

if [[ "${CHANNEL}" == "ports" || "${CHANNEL}" == "ships" || "${CHANNEL}" == "catalogue" || "${CHANNEL}" == "full" ]]; then
  echo "[ci-run-channel] repairing featured guide thumbnails"
  npm run fix-featured-guide-thumbnails
  node scripts/guard-featured-thumbs.js
fi
