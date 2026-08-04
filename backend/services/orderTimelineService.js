import { OrderTimelineRepo, OrderShippingRepo } from '../google-sheet/models.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

// Every status-changing code path (automatic cascade, admin manual change,
// customer approval) calls this instead of writing Order.status silently —
// it's what turns a single flat status field into a real timestamped
// history for the public tracking API.
export async function appendTimelineEntry(orderId, { stage, sub_stage, note, actor }) {
  const entry = await OrderTimelineRepo.insert({
    order_id: orderId,
    stage,
    sub_stage: sub_stage || '',
    note: note || '',
    actor,
    created_at: new Date().toISOString(),
  });
  return clean(entry);
}

export async function getOrderTimeline(orderId) {
  const all = await OrderTimelineRepo.getAll();
  return all
    .filter((t) => String(t.order_id) === String(orderId))
    .map(clean)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

export async function getOrderShipping(orderId) {
  const all = await OrderShippingRepo.getAll();
  const found = all.find((s) => String(s.order_id) === String(orderId));
  return found ? clean(found) : null;
}

// Called from orderService.updateOrder when transitioning Done -> Dikirim.
// One shipping record per order — upserts if one already exists (e.g. admin
// corrects a typo'd resi shortly after confirming).
export async function upsertOrderShipping(orderId, { method, resi, note }) {
  const existing = await getOrderShipping(orderId);
  const patch = { method, resi, note: note || '', shipped_at: new Date().toISOString() };
  if (existing) {
    const updated = await OrderShippingRepo.updateById(existing.id, patch);
    return clean(updated);
  }
  const created = await OrderShippingRepo.insert({ order_id: orderId, ...patch });
  return clean(created);
}

export async function deleteOrderTimelineAndShipping(orderId) {
  const [timeline, shipping] = await Promise.all([
    OrderTimelineRepo.getAll(),
    OrderShippingRepo.getAll(),
  ]);
  for (const t of timeline.filter((x) => String(x.order_id) === String(orderId))) {
    await OrderTimelineRepo.deleteById(t.id);
  }
  for (const s of shipping.filter((x) => String(x.order_id) === String(orderId))) {
    await OrderShippingRepo.deleteById(s.id);
  }
}
