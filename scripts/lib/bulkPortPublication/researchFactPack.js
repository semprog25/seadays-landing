'use strict';

const crypto = require('crypto');

/** Stable short hash of a guide object for draft cache keys (pipeline tooling only). */
function hashGuide(guide) {
  return crypto.createHash('sha256').update(JSON.stringify(guide || {})).digest('hex').slice(0, 16);
}

module.exports = { hashGuide };
