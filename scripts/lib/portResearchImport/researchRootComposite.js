'use strict';

const fs = require('fs');
const path = require('path');
const { sha256File } = require('./verifyResearchSha');

/**
 * Build a read-only composite PORT_RESEARCH_ROOT: by-port tree + patched index JSON.
 * @param {{
 *   byPortRoot: string,
 *   indexSourcePath: string,
 *   shaPatchBySlug?: Record<string, string>,
 *   workDir: string,
 * }} opts
 */
function buildCompositeResearchRoot(opts) {
  const { byPortRoot, indexSourcePath, shaPatchBySlug = {}, workDir } = opts;
  const finalDir = path.join(workDir, 'final');
  fs.mkdirSync(finalDir, { recursive: true });

  const byPortLink = path.join(workDir, 'by-port');
  if (fs.existsSync(byPortLink)) fs.rmSync(byPortLink, { recursive: true, force: true });
  fs.symlinkSync(path.resolve(byPortRoot, 'by-port'), byPortLink, 'dir');

  const index = JSON.parse(fs.readFileSync(indexSourcePath, 'utf8'));
  const ports = Array.isArray(index.ports) ? index.ports : [];
  const updated = [];
  for (const row of ports) {
    const slug = String(row.slug || '').trim();
    const patch = shaPatchBySlug[slug];
    if (!patch) continue;
    const mdPath = path.join(byPortRoot, 'by-port', `${slug}.md`);
    const fileSha = fs.existsSync(mdPath) ? sha256File(mdPath) : null;
    if (fileSha !== patch) {
      throw new Error(`patch sha mismatch for ${slug}: patch=${patch} file=${fileSha}`);
    }
    row.sha256 = patch;
    updated.push(slug);
  }

  fs.writeFileSync(
    path.join(finalDir, 'PORTS_MASTER_INDEX.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8'
  );

  return { compositeRoot: workDir, patched_slugs: updated };
}

module.exports = { buildCompositeResearchRoot };
