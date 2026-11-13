#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const pairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-review-pairs.json');
const ledgerPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-owner-review-v1-decisions.json');

function candId(c) {
  if (!c) return null;
  return `${c.provider}:${c.providerImageId}`;
}

const pairs = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const errors = [];

if (ledger.batchId !== pairs.batchId) errors.push('batchId mismatch');
if (ledger.status !== 'DECISIONS_FROZEN') errors.push('status');
if (ledger.decisions.length !== 15) errors.push('decisions length');
const c = ledger.ownerReportedCounts;
if (c.totalPorts !== 15 || c.APPROVE_A !== 10 || c.APPROVE_B !== 5 || c.REJECT_BOTH !== 0 || c.NOT_REVIEWED !== 0) {
  errors.push('ownerReportedCounts');
}
const ids = new Set();
for (const d of ledger.decisions) {
  const dest = pairs.destinations.find((x) => x.portSlug === d.portSlug);
  if (!dest) errors.push(`unknown slug ${d.portSlug}`);
  const slot = d.decision === 'APPROVE_A' ? dest.candidateA : d.decision === 'APPROVE_B' ? dest.candidateB : null;
  if (!slot) errors.push(`${d.portSlug} missing slot`);
  if (d.selectedCandidateId !== candId(slot)) errors.push(`${d.portSlug} selected id`);
  if (String(d.selectedProviderImageId) !== String(slot.providerImageId)) errors.push(`${d.portSlug} providerImageId`);
  if (ids.has(d.selectedCandidateId)) errors.push(`duplicate ${d.selectedCandidateId}`);
  ids.add(d.selectedCandidateId);
}
if (ledger.approved.length !== 15) errors.push('approved length');
if (ledger.rejectBoth.length !== 0) errors.push('rejectBoth must be empty');
const open = (ledger.geoReviewStillOpen || []).map((g) => g.selectedCandidateId).sort();
const expectedOpen = ['pexels:5684661'];
if (JSON.stringify(open) !== JSON.stringify(expectedOpen)) errors.push('geoReviewStillOpen ' + open.join(','));

if (errors.length) {
  console.error('FAIL', errors);
  process.exit(1);
}
console.log('PASS batch05 owner decisions schema and selected-ID alignment');
