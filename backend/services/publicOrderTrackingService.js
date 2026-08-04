import { OrdersRepo, CustomersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { normalizePhone } from '../utils/phoneUtils.js';
import * as orderService from './orderService.js';
import * as orderTimelineService from './orderTimelineService.js';

// Looks up an order by invoice_no + the owning customer's phone number.
// Both must match the same order — this pair is the only "credential" this
// public, unauthenticated endpoint has, so the match is exact (no partial
// matching) and a miss never reveals which of the two was wrong.
async function findOrderByNoWaAndInvoice(noWa, invoiceId) {
  const targetPhone = normalizePhone(noWa);
  if (!targetPhone || !invoiceId) throw new ApiError(404, 'Order tidak ditemukan');

  const orders = await OrdersRepo.getAll();
  const order = orders.find((o) => o.invoice_no === invoiceId);
  if (!order) throw new ApiError(404, 'Order tidak ditemukan');

  const customer = await CustomersRepo.getById(order.customer_id);
  if (!customer || normalizePhone(customer.no_hp) !== targetPhone) {
    throw new ApiError(404, 'Order tidak ditemukan');
  }

  return order;
}

function summarizeItems(items) {
  const parts = items.map((item) => {
    const qty = item.sizes.reduce((sum, s) => sum + s.qty, 0);
    return { nama_item: item.nama_item, warna: item.warna, qty };
  });
  const totalQty = parts.reduce((sum, p) => sum + p.qty, 0);
  const itemLabel = parts.map((p) => p.nama_item).join(', ');
  return { item: itemLabel, qty: totalQty };
}

export async function getPublicOrderTimeline(noWa, invoiceId) {
  const order = await findOrderByNoWaAndInvoice(noWa, invoiceId);
  const detail = await orderService.getOrderDetail(order.id);
  const customer = await CustomersRepo.getById(order.customer_id);
  const [timelineEntries, shipping] = await Promise.all([
    orderTimelineService.getOrderTimeline(order.id),
    orderTimelineService.getOrderShipping(order.id),
  ]);
  const { item, qty } = summarizeItems(detail.items);

  const lastSubStageEntry = [...timelineEntries].reverse().find((t) => t.sub_stage);

  return {
    orderId: order.invoice_no,
    nama: customer?.pic || customer?.name || null,
    noWa: customer?.no_hp || null,
    item,
    qty,
    createdAt: order.created_at,
    estimatedReady: order.deadline || null,
    currentStage: order.status,
    currentSubStage: order.status === 'On Progress' ? lastSubStageEntry?.sub_stage || null : null,
    shipping: shipping ? { method: shipping.method, resi: shipping.resi, note: shipping.note } : null,
    timeline: timelineEntries.map((t) => ({
      stage: t.stage,
      subStage: t.sub_stage || undefined,
      note: t.note,
      timestamp: t.created_at,
    })),
  };
}

export async function approveDesignPublic(noWa, invoiceId, note) {
  const order = await findOrderByNoWaAndInvoice(noWa, invoiceId);
  if (order.status !== 'Belum Di Proses') {
    throw new ApiError(400, 'Order ini sudah tidak menunggu approval desain');
  }
  const updated = await orderService.approveDesign(order, note);
  return { orderId: order.invoice_no, status: updated.status };
}
