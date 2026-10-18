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

# Hand-written, fact-checked bodies (data/editorial-pages) replace the generated ones,
# then the publish gate re-applies noindex to failing port/ship pages. Without these
# steps a ports/ships/full run would undo both and put noindex pages back in sitemap.xml.
echo "[ci-run-channel] applying editorial page bodies"
node scripts/apply-editorial-pages.js
if [[ "${CHANNEL}" == "ports" || "${CHANNEL}" == "ships" || "${CHANNEL}" == "catalogue" || "${CHANNEL}" == "full" ]]; then
  echo "[ci-run-channel] applying publish gate"
  node scripts/apply-publish-gate.js
fi

echo "[ci-run-channel] restore acquisition download CTAs"
node scripts/rewrite-download-ctas.js
node scripts/inject-analytics-head.js
