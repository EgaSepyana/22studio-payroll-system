import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const models = await import('../google-sheet/models.js');
const { SHEET_SCHEMAS, AuditLogRepo } = models;

// Sheet columns are read by index: existing columns must never move, and
// new ones may only be appended. Update these lists only by appending.
const USERS_BEFORE = ['id', 'username', 'password', 'role', 'employee_id'];
const ORDERS_BEFORE = [
  'id',
  'customer_id',
  'order_name',
  'status',
  'created_at',
  'notes',
  'deadline',
  'invoice_no',
  'jenis_category',
  'order_from',
  'broker',
  'desain_fix_url',
];

test('Users: existing column order unchanged, new columns appended last', () => {
  assert.deepEqual(SHEET_SCHEMAS.Users.slice(0, USERS_BEFORE.length), USERS_BEFORE);
  assert.deepEqual(SHEET_SCHEMAS.Users.slice(USERS_BEFORE.length), [
    'scopes',
    'api_key_hash',
    'api_key_prefix',
    'disabled',
  ]);
});

test('Orders: existing column order unchanged, new columns appended last', () => {
  assert.deepEqual(SHEET_SCHEMAS.Orders.slice(0, ORDERS_BEFORE.length), ORDERS_BEFORE);
  assert.deepEqual(SHEET_SCHEMAS.Orders.slice(ORDERS_BEFORE.length), ['boleh_publikasi', 'catatan_publikasi']);
});

test('AuditLog sheet and repo match the PRD', () => {
  assert.deepEqual(SHEET_SCHEMAS.AuditLog, [
    'id',
    'created_at',
    'user_id',
    'username',
    'role',
    'method',
    'path',
    'status_code',
    'summary',
  ]);
  assert.equal(AuditLogRepo.sheetName, 'AuditLog');
  assert.deepEqual(AuditLogRepo.columns, SHEET_SCHEMAS.AuditLog);
});

test('rows written before the new columns existed read back with empty values', () => {
  const { UsersRepo, OrdersRepo } = models;
  const oldUser = UsersRepo.rowToObject(['1', 'admin', 'hash', 'admin', '']);
  assert.equal(oldUser.scopes, '');
  assert.equal(oldUser.api_key_hash, '');
  assert.equal(oldUser.disabled, '');
  const oldOrder = OrdersRepo.rowToObject(ORDERS_BEFORE.map(() => 'x'));
  assert.equal(oldOrder.boleh_publikasi, '');
  assert.equal(oldOrder.catatan_publikasi, '');
});
