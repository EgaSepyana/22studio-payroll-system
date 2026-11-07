import { OrdersRepo, OrderItemsRepo, OrderItemSizesRepo, LembarPORepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { toPublicOrderSummary, toDesignBrief, matchesSummaryFilters } from '../utils/agentOrderMappers.js';

export async function getPublicSummary(filters = {}) {
  const [orders, items, sizes] = await Promise.all([
    OrdersRepo.getAll(),
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
  ]);
  return orders
    .filter((order) => matchesSummaryFilters(order, filters))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((order) => toPublicOrderSummary(order, items, sizes));
}

export async function getDesignBrief(orderId) {
  const order = await OrdersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order tidak ditemukan');
  const [items, sizes, lembarPOs] = await Promise.all([
    OrderItemsRepo.getAll(),
    OrderItemSizesRepo.getAll(),
    LembarPORepo.getAll(),
  ]);
  const lembarPO = lembarPOs.find((row) => String(row.order_id) === String(order.id)) || null;
  return toDesignBrief(order, items, sizes, lembarPO);
}
