'use strict';

/**
 * Page-by-page audit holdbacks (Sesame spreadsheets, 17 Oct 2026).
 * Slug lists only. Figures in those workbooks are not applied here.
 */

const data = require('../../data/audit-holdback.json');

const AUDIT_PORT_NOINDEX = new Set(data.portNoindex || []);
const AUDIT_SHIP_HIDE_OVERVIEW = new Set(data.shipHideOverview || []);

function isAuditNoindexPort(slug) {
  return AUDIT_PORT_NOINDEX.has(String(slug || '').trim());
}

function shipOverviewHiddenByAudit(slug) {
  return AUDIT_SHIP_HIDE_OVERVIEW.has(String(slug || '').trim());
}

module.exports = {
  AUDIT_PORT_NOINDEX,
  AUDIT_SHIP_HIDE_OVERVIEW,
  isAuditNoindexPort,
  shipOverviewHiddenByAudit,
};
