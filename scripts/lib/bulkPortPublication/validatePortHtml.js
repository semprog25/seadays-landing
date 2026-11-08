'use strict';

const { containsInternalResearchLeak } = require('../publicGuideCopySanitize');

function validateGeneratedPortHtml(html, { slug, expectTerminalMap = false, previewFragment = false } = {}) {
  const issues = [];
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || '';
  if (!main) issues.push('missing_main');
  if (main.includes('**')) issues.push('raw_markdown');
  if (containsInternalResearchLeak(main)) issues.push('research_leak');
  if (!/\.pg-call-plan-card\s*\{/.test(html)) issues.push('missing_call_plan_css');
  const cardCount = (main.match(/pg-call-plan-card pg-call-plan-card--/g) || []).length;
  if (cardCount < 3) issues.push(`call_plan_cards_${cardCount}`);
  if (!main.includes('pg-cruise-tip') && !main.includes('practicalTip')) {
    const hasTip = /pg-cruise-tip/.test(main);
    if (!hasTip) issues.push('missing_cruise_tip');
  }
  const hasMap = /id="port-terminal-map"/.test(main);
  if (hasMap && !expectTerminalMap) issues.push('unexpected_terminal_map');
  if (!hasMap && expectTerminalMap) issues.push('missing_expected_terminal_map');
  if (!main.includes('application/ld+json') && !html.includes('FAQPage')) {
    /* JSON-LD in head */
  }
  if (!previewFragment && !html.includes('FAQPage')) issues.push('missing_faq_jsonld');
  return { ok: issues.length === 0, issues, slug };
}

module.exports = { validateGeneratedPortHtml };
