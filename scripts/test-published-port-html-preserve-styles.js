#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { mergePublishedPortHtmlPreservation } = require('./lib/publishedPortHtmlPreserve');

const oldStyles =
  '<link rel="stylesheet" href="/assets/css/site-shell.css"><style>.pg-section { margin: 1px; }</style>';
const newStyles =
  '<link rel="stylesheet" href="/assets/css/site-shell.css"><style>.pg-call-plan-card { padding: 16px; }</style>';

function wrap(body) {
  return `<!DOCTYPE html><html><head>${body}</head><body></body></html>`;
}

const existing = wrap(oldStyles);
const generated = wrap(newStyles);
const merged = mergePublishedPortHtmlPreservation(generated, existing, {});
assert.ok(/\.pg-call-plan-card\s*\{/.test(merged), 'prefer generated when old head lacks call-plan css');

const existingWithCallPlan = wrap(
  '<link rel="stylesheet" href="/assets/css/site-shell.css"><style>.pg-call-plan-card { border: 1px solid red; }</style>'
);
const generatedWithCallPlan = wrap(
  '<link rel="stylesheet" href="/assets/css/site-shell.css"><style>.pg-call-plan-card { padding: 16px; }</style>'
);
const mergedKeep = mergePublishedPortHtmlPreservation(generatedWithCallPlan, existingWithCallPlan, {});
assert.ok(/border: 1px solid red/.test(mergedKeep), 'keep committed styles when both have call-plan rules');
assert.ok(!/padding: 16px/.test(mergedKeep), 'do not replace committed bundle when both are complete');

console.log('test-published-port-html-preserve-styles PASS');
