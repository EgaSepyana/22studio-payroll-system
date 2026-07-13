import { z } from 'zod';
import * as orderService from '../services/orderService.js';
import * as orderExportService from '../services/orderExportService.js';
import { ORDER_STATUSES } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  customer_id: z.union([z.string(), z.number()]),
  order_name: z.string().min(1),
  notes: z.string().optional(),
  deadline: z.string().optional(),
});

const updateSchema = z.object({
  order_name: z.string().min(1).optional(),
  notes: z.string().optional(),
  deadline: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const filterSchema = z.object({
  customer_id: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const itemSchema = z.object({
  nama_item: z.string().min(1),
  harga: z.coerce.number().min(0),
  qty: z.coerce.number().positive(),
});

const itemUpdateSchema = z.object({
  nama_item: z.string().min(1).optional(),
  harga: z.coerce.number().min(0).optional(),
  qty: z.coerce.number().positive().optional(),
});

export async function create(req, res, next) {
  try {
    created(res, await orderService.createOrder(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    ok(res, await orderService.listOrders(filterSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
}

export async function detail(req, res, next) {
  try {
    ok(res, await orderService.getOrderDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await orderService.updateOrder(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await orderService.deleteOrder(req.params.id);
    ok(res, { message: 'Order dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function invoicePdf(req, res, next) {
  try {
    const data = await orderService.getOrderInvoice(req.params.id);
    const buffer = await orderExportService.orderInvoiceToPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${data.invoice_no}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    created(res, await orderService.addOrderItem(req.params.id, itemSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    ok(res, await orderService.updateOrderItem(req.params.id, req.params.itemId, itemUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    await orderService.deleteOrderItem(req.params.id, req.params.itemId);
    ok(res, { message: 'Item dihapus' });
  } catch (err) {
    next(err);
  }
}
