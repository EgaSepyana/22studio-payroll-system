import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toPublicOrderSummary,
  toDesignBrief,
  generatedOrderLabel,
  matchesSummaryFilters,
} from '../utils/agentOrderMappers.js';
import { order, items, sizes, lembarPO, SECRET_MARKERS } from './helpers/orderFixtures.js';

const FORBIDDEN_KEYS = [
  'customer_id',
  'customer_name',
  'customer',
  'no_hp',
  'phone',
  'alamat',
  'pic',
  'invoice_no',
  'broker',
  'order_from',
  'harga',
  'price',
  'total',
  'total_dp',
  'sisa_pembayaran',
  'items_total',
  'catatan_publikasi',
  'deadline',
];

function allKeys(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      found.add(k);
      allKeys(v, found);
    }
  }
  return found;
}

function assertNoLeak(output, { allowed = [] } = {}) {
  const keys = allKeys(output);
  for (const key of FORBIDDEN_KEYS) assert.equal(keys.has(key), false, `forbidden key: ${key}`);
  const text = JSON.stringify(output);
  for (const marker of SECRET_MARKERS) {
    if (allowed.includes(marker)) continue;
    assert.equal(text.includes(marker), false, `leaked value containing ${marker}`);
  }
}

const consented = { ...order, boleh_publikasi: 'true' };

test('public summary without consent: no forbidden keys, no real name, no design url', () => {
  const out = toPublicOrderSummary(order, items, sizes);
  assertNoLeak(out);
  assert.equal(out.order_name, 'Kaos Wisata · 60 pcs');
  assert.equal(out.boleh_publikasi, false);
  assert.equal('desain_fix_url' in out, false);
});

test('public summary lists only this order\'s items with summed qty', () => {
  const out = toPublicOrderSummary(order, items, sizes);
  assert.deepEqual(out.items, [
    { nama_item: 'Polo', warna: 'Hijau', qty: 50 },
    { nama_item: 'Topi', warna: '', qty: 10 },
  ]);
  assert.deepEqual(Object.keys(out).sort(), ['boleh_publikasi', 'created_at', 'id', 'items', 'jenis_category', 'order_name', 'status']);
});

test('public summary with consent: real name and design url appear, nothing else leaks', () => {
  const out = toPublicOrderSummary(consented, items, sizes);
  assert.equal(out.order_name, 'SECRET Brand Polo Hijau');
  assert.equal(out.desain_fix_url, 'https://res.example.com/design-1.png');
  assert.equal(out.boleh_publikasi, true);
  assertNoLeak(out, { allowed: ['SECRET'] });
  const text = JSON.stringify(out);
  for (const marker of ['SECRET_CUSTOMER_ID', 'INV-SECRET', 'SECRET_BROKER', 'SECRET_ORDER_FROM', 'SECRET internal', '99999', '77777']) {
    assert.equal(text.includes(marker), false, marker);
  }
});

test('consent only counts when boleh_publikasi is exactly "true"', () => {
  for (const value of ['', 'false', undefined, 'yes', '1']) {
    const out = toPublicOrderSummary({ ...order, boleh_publikasi: value }, items, sizes);
    assert.equal(out.boleh_publikasi, false, String(value));
    assert.equal('desain_fix_url' in out, false);
    assert.notEqual(out.order_name, order.order_name);
  }
});

test('consented order with an empty name still gets the generated label', () => {
  const out = toPublicOrderSummary({ ...consented, order_name: '' }, items, sizes);
  assert.equal(out.order_name, 'Kaos Wisata · 60 pcs');
});

test('generated label handles a missing category and no items', () => {
  assert.equal(generatedOrderLabel({ jenis_category: '' }, 0), 'Order · 0 pcs');
  assert.equal(generatedOrderLabel({ jenis_category: 'KAOS' }, 50), 'Kaos · 50 pcs');
  assert.equal(toPublicOrderSummary({ ...order, jenis_category: '' }, [], []).order_name, 'Order · 0 pcs');
});

test('a new column on the order row never reaches the summary or the brief', () => {
  const withExtra = { ...order, some_future_column: 'SECRET_FUTURE' };
  assert.equal(JSON.stringify(toPublicOrderSummary(withExtra, items, sizes)).includes('SECRET_FUTURE'), false);
  assert.equal(JSON.stringify(toDesignBrief(withExtra, items, sizes, lembarPO)).includes('SECRET_FUTURE'), false);
});

test('design brief: items, sizes, notes, design url and Lembar PO; no PII or prices', () => {
  const out = toDesignBrief(order, items, sizes, lembarPO);
  assertNoLeak(out);
  assert.equal(out.order_id, '1');
  assert.equal(out.notes, 'Size L dan XL');
  assert.equal(out.desain_fix_url, 'https://res.example.com/design-1.png');
  assert.deepEqual(out.items[0], {
    nama_item: 'Polo',
    warna: 'Hijau',
    qty: 50,
    sizes: [
      { size: 'L', qty: 30 },
      { size: 'XL', qty: 20 },
    ],
  });
  assert.deepEqual(out.lembar_po, {
    sablon_bordir: 'Bordir dada kiri',
    catatan: 'Logo 5cm',
    label: true,
    bahan_tipe: 'Lacoste',
    pola_potong: 'Slim',
    hangtag: false,
  });
});

test('design brief without a Lembar PO or items', () => {
  const out = toDesignBrief(order, [], [], null);
  assert.equal(out.lembar_po, null);
  assert.deepEqual(out.items, []);
});

test('design brief does not depend on publish consent', () => {
  assert.equal(toDesignBrief(order, items, sizes, null).desain_fix_url, order.desain_fix_url);
});

test('summary filters: status, category and inclusive date range', () => {
  assert.equal(matchesSummaryFilters(order, {}), true);
  assert.equal(matchesSummaryFilters(order, { status: 'On Progress' }), true);
  assert.equal(matchesSummaryFilters(order, { status: 'Done' }), false);
  assert.equal(matchesSummaryFilters(order, { jenis_category: 'KAOS WISATA' }), true);
  assert.equal(matchesSummaryFilters(order, { jenis_category: 'JAKET' }), false);
  assert.equal(matchesSummaryFilters(order, { from: '2026-07-13', to: '2026-07-13' }), true);
  assert.equal(matchesSummaryFilters(order, { from: '2026-07-14' }), false);
  assert.equal(matchesSummaryFilters(order, { to: '2026-07-12' }), false);
});
