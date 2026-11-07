import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScopes, isTrueFlag, isPublishAllowed, isAccountDisabled } from '../utils/agentFields.js';

test('empty or missing scopes mean no scopes', () => {
  assert.deepEqual(parseScopes(''), []);
  assert.deepEqual(parseScopes(undefined), []);
  assert.deepEqual(parseScopes(null), []);
  assert.deepEqual(parseScopes(' , ,'), []);
});

test('scopes are split, trimmed and de-duplicated', () => {
  assert.deepEqual(parseScopes('orders:read, tasks:read,orders:read'), ['orders:read', 'tasks:read']);
});

test('only "true" counts as true', () => {
  assert.equal(isTrueFlag('true'), true);
  assert.equal(isTrueFlag(' TRUE '), true);
  for (const v of ['', undefined, null, 'false', '1', 'yes']) assert.equal(isTrueFlag(v), false);
});

test('empty boleh_publikasi means publishing is not allowed', () => {
  assert.equal(isPublishAllowed({ boleh_publikasi: '' }), false);
  assert.equal(isPublishAllowed({}), false);
  assert.equal(isPublishAllowed(undefined), false);
  assert.equal(isPublishAllowed({ boleh_publikasi: 'true' }), true);
});

test('empty disabled means the account is enabled', () => {
  assert.equal(isAccountDisabled({ disabled: '' }), false);
  assert.equal(isAccountDisabled({}), false);
  assert.equal(isAccountDisabled({ disabled: 'true' }), true);
});
