import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditSummary } from '../utils/auditSummary.js';

test('empty bodies give an empty summary', () => {
  for (const body of [undefined, null, '', {}]) assert.equal(buildAuditSummary(body), '');
});

test('a small body is kept as compact JSON', () => {
  assert.equal(buildAuditSummary({ status: 'Done' }), '{"status":"Done"}');
});

test('password, key, token and secret fields are dropped, at any depth', () => {
  const summary = buildAuditSummary({
    username: 'x',
    password: 'hunter2',
    old_password: 'a',
    newPassword: 'b',
    api_key: 'agk_abc_def',
    apiKey: 'k',
    api_key_hash: 'h',
    key: 'k2',
    token: 't',
    access_token: 't2',
    authorization: 'Bearer z',
    client_secret: 's',
    nested: { password: 'p', keep: 'ok', deeper: [{ token: 'tt', name: 'n' }] },
  });
  for (const leaked of ['hunter2', 'agk_', 'Bearer', '"k2"', '"t"', '"t2"', '"s"', '"p"', '"tt"']) {
    assert.equal(summary.includes(leaked), false, leaked);
  }
  assert.deepEqual(JSON.parse(summary), { username: 'x', nested: { keep: 'ok', deeper: [{ name: 'n' }] } });
});

test('long strings are truncated', () => {
  const parsed = JSON.parse(buildAuditSummary({ notes: 'a'.repeat(1000) }));
  assert.ok(parsed.notes.length <= 101);
  assert.ok(parsed.notes.endsWith('…'));
});

test('the whole summary is capped at about 500 characters', () => {
  const body = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`field_${i}`, 'x'.repeat(50)]));
  const summary = buildAuditSummary(body);
  assert.ok(summary.length <= 500, String(summary.length));
  assert.ok(summary.endsWith('…'));
});

test('long arrays are shortened and deep nesting is cut off', () => {
  const arr = JSON.parse(buildAuditSummary({ sizes: Array.from({ length: 25 }, (_, i) => i) }));
  assert.equal(arr.sizes.length, 11);
  assert.equal(arr.sizes[10], '…(+15)');
  const deep = JSON.parse(buildAuditSummary({ a: { b: { c: { d: { e: 'x' } } } } }));
  assert.equal(deep.a.b.c.d, '…');
});

test('non-object bodies and special values do not throw', () => {
  assert.equal(buildAuditSummary('plain text'), '"plain text"');
  assert.equal(buildAuditSummary(42), '42');
  assert.equal(buildAuditSummary({ a: null, b: true, c: 0 }), '{"a":null,"b":true,"c":0}');
});

test('the input is not mutated', () => {
  const body = { password: 'p', notes: 'a'.repeat(300), list: [1, 2, 3] };
  const copy = structuredClone(body);
  buildAuditSummary(body);
  assert.deepEqual(body, copy);
});
