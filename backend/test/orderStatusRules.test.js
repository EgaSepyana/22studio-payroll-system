import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const models = await import('../google-sheet/models.js');
const orderService = await import('../services/orderService.js');
const { ApiError } = await import('../utils/response.js');

const { ORDER_STATUSES } = models;

// The only manual transitions humans have (updateOrder / approveDesign).
const ALLOWED = new Set([
  'Belum Di Proses -> Desain Fix',
  'Done -> Dikirim',
  'Dikirim -> Di Ambil Costumer',
]);

const PATCHED = [
  [models.OrdersRepo, 'getById'],
  [models.OrdersRepo, 'updateById'],
  [models.OrderTimelineRepo, 'insert'],
  [models.OrderShippingRepo, 'getAll'],
  [models.OrderShippingRepo, 'insert'],
];
const originals = PATCHED.map(([repo, name]) => repo[name]);

let order;
let updates;
let timeline;
let shipping;

test.before(() => {
  models.OrdersRepo.getById = async (id) => (String(id) === '1' ? order : null);
  models.OrdersRepo.updateById = async (id, patch) => {
    updates.push(patch);
    order = { ...order, ...patch };
    return order;
  };
  models.OrderTimelineRepo.insert = async (entry) => {
    timeline.push(entry);
    return { id: String(timeline.length), ...entry };
  };
  models.OrderShippingRepo.getAll = async () => shipping;
  models.OrderShippingRepo.insert = async (row) => {
    shipping.push(row);
    return row;
  };
});

test.after(() => {
  PATCHED.forEach(([repo, name], i) => {
    repo[name] = originals[i];
  });
});

function start(status) {
  order = { id: '1', status };
  updates = [];
  timeline = [];
  shipping = [];
}

const details = { actor: 'agent-admin', note: 'catatan', resi: 'JNE123', shipping_method: 'JNE' };

test('STATUS_API_TARGETS are the three manual-transition targets', () => {
  assert.deepEqual(orderService.STATUS_API_TARGETS, ['Desain Fix', 'Dikirim', 'Di Ambil Costumer']);
});

test('every allowed transition passes and writes status + timeline with the actor', async () => {
  for (const key of ALLOWED) {
    const [from, to] = key.split(' -> ');
    start(from);
    const result = await orderService.setOrderStatus('1', to, details);
    assert.deepEqual(result, { id: '1', status: to }, key);
    assert.deepEqual(updates, [{ status: to }], key);
    assert.equal(timeline.length, 1, key);
    assert.equal(timeline[0].stage, to, key);
    assert.equal(timeline[0].actor, 'agent-admin', key);
    assert.equal(timeline[0].note, 'catatan', key);
  }
});

test('every other transition is a 400 and writes nothing', async () => {
  let rejected = 0;
  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      if (from === to || ALLOWED.has(`${from} -> ${to}`)) continue;
      start(from);
      await assert.rejects(
        orderService.setOrderStatus('1', to, details),
        (err) => err instanceof ApiError && err.status === 400,
        `${from} -> ${to}`
      );
      assert.equal(updates.length, 0, `${from} -> ${to}`);
      assert.equal(timeline.length, 0, `${from} -> ${to}`);
      assert.equal(shipping.length, 0, `${from} -> ${to}`);
      rejected += 1;
    }
  }
  assert.equal(rejected, ORDER_STATUSES.length * (ORDER_STATUSES.length - 1) - ALLOWED.size);
});

test('On Progress and Done can never be set, from any status', async () => {
  for (const from of ORDER_STATUSES) {
    for (const to of ['On Progress', 'Done']) {
      if (from === to) continue;
      start(from);
      await assert.rejects(orderService.setOrderStatus('1', to, details), { status: 400 }, `${from} -> ${to}`);
    }
  }
});

test('Dikirim without resi or shipping method is 400 and writes nothing', async () => {
  for (const missing of [{ resi: undefined }, { shipping_method: undefined }, { resi: '', shipping_method: '' }]) {
    start('Done');
    await assert.rejects(
      orderService.setOrderStatus('1', 'Dikirim', { ...details, ...missing }),
      { status: 400 },
      JSON.stringify(missing)
    );
    assert.equal(order.status, 'Done');
    assert.equal(updates.length, 0);
    assert.equal(timeline.length, 0);
    assert.equal(shipping.length, 0);
  }
});

test('Dikirim with resi and shipping method records the shipping', async () => {
  start('Done');
  await orderService.setOrderStatus('1', 'Dikirim', details);
  assert.equal(shipping.length, 1);
  assert.equal(shipping[0].resi, 'JNE123');
  assert.equal(shipping[0].method, 'JNE');
  assert.equal(shipping[0].order_id, '1');
});

test('setting the current status is a no-op, even without shipping details', async () => {
  for (const status of orderService.STATUS_API_TARGETS) {
    start(status);
    const result = await orderService.setOrderStatus('1', status, { actor: 'agent-admin' });
    assert.deepEqual(result, { id: '1', status });
    assert.equal(updates.length, 0, status);
    assert.equal(timeline.length, 0, status);
  }
});

test('an unknown order is 404', async () => {
  start('Done');
  await assert.rejects(orderService.setOrderStatus('999', 'Dikirim', details), { status: 404 });
});
