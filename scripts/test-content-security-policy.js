#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  FUNDING_CHOICES_ORIGIN,
  getContentSecurityPolicyDirectives,
  getContentSecurityPolicyMetaDirectives,
  injectContentSecurityPolicyMeta,
} = require('./lib/contentSecurityPolicy');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('meta CSP preserves upgrade-insecure-requests and GA script host', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.match(policy, /upgrade-insecure-requests/);
  assert.match(policy, /script-src[^;]*https:\/\/www\.google-analytics\.com/);
  assert.match(policy, /connect-src[^;]*region1\.google-analytics\.com/);
});

test('meta CSP allows Funding Choices script origin in script-src', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.match(
    policy,
    new RegExp(`script-src[^;]*${FUNDING_CHOICES_ORIGIN.replace(/\./g, '\\.')}`)
  );
});

test('meta CSP allows Funding Choices in connect-src', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.match(policy, /connect-src[^;]*fundingchoicesmessages\.google\.com/);
});

test('meta and header CSP include frame-src for Funding Choices UI', () => {
  const meta = getContentSecurityPolicyMetaDirectives();
  const header = getContentSecurityPolicyDirectives();
  assert.strictEqual(meta, header);
  assert.match(meta, /frame-src[^;]*fundingchoicesmessages\.google\.com/);
  assert.match(meta, /frame-src[^;]*googleads\.g\.doubleclick\.net/);
});

test('CSP does not add unsafe-eval or script-src https: wildcard', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(policy, /script-src[^;]*\shttps:\s/);
});

test('inject is idempotent on sample index head', () => {
  const root = path.join(__dirname, '..');
  const sample = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const once = injectContentSecurityPolicyMeta(sample);
  const twice = injectContentSecurityPolicyMeta(once);
  assert.strictEqual(once, twice);
});

test('blocked Funding Choices loader URL is permitted by meta script-src', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.match(policy, /script-src[^;]*fundingchoicesmessages\.google\.com/);
});

test('unrelated script origin evil.example remains blocked', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.doesNotMatch(policy, /evil\.example/);
});

console.log('\nAll content security policy tests passed.');
