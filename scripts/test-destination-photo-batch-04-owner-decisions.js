#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const pairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-04-review-pairs.json');
const ledgerPath = path.join(repoRoot, 'data', 'destination-photo-batch-04-owner-review-v1-decisions.json');

function candId(c) {
  if (!c) return null;
  return `${c.provider}:${c.providerImageId}`;
}

const pairs = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const errors = [];

if (ledger.batchId !== pairs.batchId) errors.push('batchId mismatch');
if (ledger.researchRound !== pairs.researchRound) errors.push('researchRound mismatch');
if (ledger.decisions.length !== 3) errors.push('decisions length');
const c = ledger.ownerReportedCounts;
if (c.totalPorts !== 3 || c.APPROVE_A !== 3 || c.APPROVE_B !== 0 || c.REJECT_BOTH !== 0 || c.NOT_REVIEWED !== 0) {
  errors.push('ownerReportedCounts');
}
for (const d of ledger.decisions) {
  const dest = pairs.destinations.find((x) => x.portSlug === d.portSlug);
  if (!dest) errors.push(`unknown slug ${d.portSlug}`);
  if (d.decision !== 'APPROVE_A') errors.push(`${d.portSlug} decision`);
  if (d.selectedCandidateId !== candId(dest.candidateA)) errors.push(`${d.portSlug} must match candidate A`);
  if (String(d.selectedProviderImageId) !== String(dest.candidateA.providerImageId)) {
    errors.push(`${d.portSlug} providerImageId`);
  }
}
if (ledger.approved.length !== 3) errors.push('approved length');
if (ledger.rejectBoth.length !== 0) errors.push('rejectBoth must be empty');

if (errors.length) {
  console.error('FAIL', errors);
  process.exit(1);
}
console.log('PASS batch04 owner decisions schema and selected-ID alignment');
