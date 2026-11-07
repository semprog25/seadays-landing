'use strict';

/**
 * Guards against publishing Claire table cells that were clipped mid-word in deliverables.
 */
function isTruncatedResearchCopy(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 24) return false;
  if (/[.!?…)"'\]]$/.test(s)) return false;
  const tail = (s.split(/\s+/).pop() || '').toLowerCase();
  if (tail.length <= 3) return true;
  if (/^(cr|cal|doc|htt|por)$/i.test(tail)) return true;
  return false;
}

function assertResearchCopyNotTruncated(text, label = 'copy') {
  if (!isTruncatedResearchCopy(text)) return;
  throw new Error(`${label} looks truncated (ends with "${String(text).trim().split(/\s+/).pop()}")`);
}

module.exports = {
  isTruncatedResearchCopy,
  assertResearchCopyNotTruncated,
};
