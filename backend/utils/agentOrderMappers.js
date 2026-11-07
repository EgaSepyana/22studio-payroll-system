import { isPublishAllowed } from './agentFields.js';

// Pure mappers for the order data agents may see without customer PII.
// Each output is built field by field from an allowlist — never by spreading
// a sheet row — so a column added to Orders later can't leak by accident.

function itemsOfOrder(orderId, itemRows, sizeRows) {
  return itemRows
    .filter((item) => String(item.order_id) === String(orderId))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((item) => ({
      item,
      sizes: sizeRows
        .filter((s) => String(s.order_item_id) === String(item.id))
        .sort((a, b) => Number(a.id) - Number(b.id)),
    }));
}

function sumQty(sizes) {
  return sizes.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase());
}

// order_name can hold a customer or brand name, so without publish consent
// the summary shows a generated label instead, e.g. "Kaos · 50 pcs".
export function generatedOrderLabel(order, totalQty) {
  const kind = order.jenis_category ? titleCase(order.jenis_category) : 'Order';
  return `${kind} · ${totalQty} pcs`;
}

export function toPublicOrderSummary(order, itemRows, sizeRows) {
  const consent = isPublishAllowed(order);
  const groups = itemsOfOrder(order.id, itemRows, sizeRows);
  const totalQty = groups.reduce((sum, g) => sum + sumQty(g.sizes), 0);

  const summary = {
    id: order.id,
    order_name: consent && order.order_name ? order.order_name : generatedOrderLabel(order, totalQty),
    jenis_category: order.jenis_category || '',
    status: order.status,
    created_at: order.created_at,
    items: groups.map(({ item, sizes }) => ({
      nama_item: item.nama_item,
      warna: item.warna || '',
      qty: sumQty(sizes),
    })),
    boleh_publikasi: consent,
  };
  if (consent) summary.desain_fix_url = order.desain_fix_url || '';
  return summary;
}

export function toDesignBrief(order, itemRows, sizeRows, lembarPO) {
  return {
    order_id: order.id,
    notes: order.notes || '',
    desain_fix_url: order.desain_fix_url || '',
    items: itemsOfOrder(order.id, itemRows, sizeRows).map(({ item, sizes }) => ({
      nama_item: item.nama_item,
      warna: item.warna || '',
      qty: sumQty(sizes),
      sizes: sizes.map((s) => ({ size: s.size, qty: Number(s.qty) || 0 })),
    })),
    lembar_po: lembarPO
      ? {
          sablon_bordir: lembarPO.sablon_bordir || '',
          catatan: lembarPO.catatan || '',
          label: lembarPO.label === 'true',
          bahan_tipe: lembarPO.bahan_tipe || '',
          pola_potong: lembarPO.pola_potong || '',
          hangtag: lembarPO.hangtag === 'true',
        }
      : null,
  };
}

// `from` / `to` are inclusive YYYY-MM-DD dates compared with created_at.
export function matchesSummaryFilters(order, { status, from, to, jenis_category } = {}) {
  if (status && order.status !== status) return false;
  if (jenis_category && order.jenis_category !== jenis_category) return false;
  const day = String(order.created_at || '').slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
