#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  FUNDING_CHOICES_ORIGIN,
  META_CSP_MAX_LENGTH,
  getContentSecurityPolicyDirectives,
  getContentSecurityPolicyMetaDirectives,
  injectContentSecurityPolicyMeta,
} = require('./lib/contentSecurityPolicy');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('meta CSP fits Chromium meta tag length cap', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.ok(
    policy.length <= META_CSP_MAX_LENGTH,
    `meta CSP length ${policy.length} exceeds ${META_CSP_MAX_LENGTH}`
  );
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

test('header CSP includes frame-src for Funding Choices UI', () => {
  const policy = getContentSecurityPolicyDirectives();
  assert.match(policy, /frame-src[^;]*fundingchoicesmessages\.google\.com/);
});

test('CSP still allows existing GA and AdSense script origins', () => {
  const meta = getContentSecurityPolicyMetaDirectives();
  assert.match(meta, /https:\/\/www\.googletagmanager\.com/);
  assert.match(meta, /https:\/\/pagead2\.googlesyndication\.com/);
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
  const blocked =
    'https://fundingchoicesmessages.google.com/i/ca-pub-3084834499411817?fc=alwaysshow&fctype=gdpr';
  const origin = new URL(blocked).origin;
  assert.strictEqual(origin, FUNDING_CHOICES_ORIGIN);
  assert.match(policy, /script-src[^;]*fundingchoicesmessages\.google\.com/);
});

test('unrelated script origin evil.example remains blocked', () => {
  const policy = getContentSecurityPolicyMetaDirectives();
  assert.doesNotMatch(policy, /evil\.example/);
});

console.log('\nAll content security policy tests passed.');
