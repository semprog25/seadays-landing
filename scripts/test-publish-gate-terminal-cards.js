#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { countTerminalCardsInGettingThereSection, localIssues } = require('./lib/publishGate');

const gettingOpen =
  '<section id="getting-there"><h2>Getting there</h2><div class="pg-terminal-grid">';

assert.strictEqual(
  countTerminalCardsInGettingThereSection(
    `${gettingOpen}<details class="pg-terminal-card" open><summary>A</summary></details></div></section>`
  ),
  1,
  'legacy details card'
);

assert.strictEqual(
  countTerminalCardsInGettingThereSection(
    `${gettingOpen}<article class="pg-terminal-card pg-terminal-card--has-photo" aria-labelledby="t1"><figure class="pg-terminal-card-photo"><img alt=""></figure><h3 id="t1">B</h3></article></div></section>`
  ),
  1,
  'photo article card without counting figure'
);

assert.strictEqual(
  countTerminalCardsInGettingThereSection(
    `${gettingOpen}` +
      '<details class="pg-terminal-card" open><summary>One</summary></details>' +
      '<article class="pg-terminal-card pg-terminal-card--has-photo"><h3>Two</h3></article>' +
      '<article class="pg-terminal-card pg-terminal-card--has-photo"><h3>Three</h3></article>' +
      '</div></section>'
  ),
  3,
  'mixed details and photo articles'
);

assert.strictEqual(
  countTerminalCardsInGettingThereSection(`${gettingOpen}</div></section>`),
  0,
  'missing terminal cards'
);

assert.strictEqual(
  countTerminalCardsInGettingThereSection(
    `${gettingOpen}<figure class="pg-terminal-card-photo"><img alt=""></figure></div></section>`
  ),
  0,
  'figure alone is not a terminal card'
);

assert.strictEqual(
  countTerminalCardsInGettingThereSection(
    `${gettingOpen}<article class="pg-terminal-card pg-terminal-card--has-photo"><figure class="pg-terminal-card-photo"><img alt=""></figure></article></div></section>`
  ),
  1,
  'single article with nested figure counts once'
);

const hamburgHtml =
  '<main><dl class="pg-facts"><dt>Terminals</dt><dd>4</dd><dt>Berths</dt><dd>5</dd></dl>' +
  '<section id="getting-there">' +
  '<article class="pg-terminal-card pg-terminal-card--has-photo"><p>2 berths</p></article>' +
  '<article class="pg-terminal-card pg-terminal-card--has-photo"><p>1 berth</p></article>' +
  '<article class="pg-terminal-card pg-terminal-card--has-photo"><p>1 berth</p></article>' +
  '<article class="pg-terminal-card pg-terminal-card--has-photo"><p>1 berth</p></article>' +
  '</section></main>';
assert.deepStrictEqual(localIssues(hamburgHtml, 'port'), [], 'four photo articles match Terminals fact');

const legacyHtml =
  '<main><dl class="pg-facts"><dt>Terminals</dt><dd>2</dd></dl>' +
  '<section id="getting-there">' +
  '<details class="pg-terminal-card" open></details>' +
  '<details class="pg-terminal-card"></details>' +
  '</section></main>';
assert.deepStrictEqual(localIssues(legacyHtml, 'port'), [], 'legacy details count');

const mismatchHtml =
  '<main><dl class="pg-facts"><dt>Terminals</dt><dd>3</dd></dl>' +
  '<section id="getting-there"><details class="pg-terminal-card"></details></section></main>';
assert.ok(localIssues(mismatchHtml, 'port').includes('terminal count'), 'still flags mismatch');

console.log('test-publish-gate-terminal-cards: ok');
