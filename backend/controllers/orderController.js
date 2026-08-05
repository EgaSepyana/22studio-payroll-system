import { z } from 'zod';
import * as orderService from '../services/orderService.js';
import * as orderExportService from '../services/orderExportService.js';
import * as orderInvoiceExcelService from '../services/orderInvoiceExcelService.js';
import * as waFollowUpService from '../services/waFollowUpService.js';
import * as orderTimelineService from '../services/orderTimelineService.js';
import { ORDER_STATUSES, ORDER_JENIS_CATEGORIES, ORDER_FROM_OPTIONS } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  customer_id: z.union([z.string(), z.number()]),
  order_name: z.string().min(1),
  notes: z.string().optional(),
  deadline: z.string().optional(),
  jenis_category: z.enum(ORDER_JENIS_CATEGORIES).optional(),
  order_from: z.enum(ORDER_FROM_OPTIONS).optional(),
  broker: z.string().optional(),
  desain_fix_url: z.union([z.literal(''), z.string().url()]).optional(),
});

const updateSchema = z.object({
  order_name: z.string().min(1).optional(),
  notes: z.string().optional(),
  deadline: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  jenis_category: z.enum(ORDER_JENIS_CATEGORIES).optional(),
  order_from: z.enum(ORDER_FROM_OPTIONS).optional(),
  broker: z.string().optional(),
  desain_fix_url: z.union([z.literal(''), z.string().url()]).optional(),
  note: z.string().optional(),
  resi: z.string().optional(),
  shipping_method: z.string().optional(),
});

const filterSchema = z.object({
  customer_id: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const itemSchema = z.object({
  nama_item: z.string().min(1),
  warna: z.string().optional(),
});

const itemUpdateSchema = z.object({
  nama_item: z.string().min(1),
  warna: z.string().optional(),
});

const itemTemplateSchema = z.object({
  nama_item: z.string().min(1),
  warna: z.string().optional(),
  sizes: z
    .array(
      z.object({
        size: z.string().min(1),
        harga: z.coerce.number().min(0).optional(),
        qty: z.coerce.number().positive(),
      })
    )
    .min(1),
});

const sizeSchema = z.object({
  size: z.string().min(1),
  harga: z.coerce.number().min(0),
  qty: z.coerce.number().positive(),
});

const sizeUpdateSchema = z.object({
  size: z.string().min(1).optional(),
  harga: z.coerce.number().min(0).optional(),
  qty: z.coerce.number().positive().optional(),
});

const dpSchema = z.object({
  dp_at: z.string().min(1),
  total_dp: z.coerce.number().positive(),
});

const followUpSchema = z.object({
  template_key: z.string().min(1),
  fields: z.record(z.string(), z.string()).optional(),
});

const dpUpdateSchema = z.object({
  dp_at: z.string().min(1).optional(),
  total_dp: z.coerce.number().positive().optional(),
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

export async function invoiceExcel(req, res, next) {
  try {
    const { invoice, customer } = await orderService.getOrderInvoiceWithCustomer(req.params.id);
    const buffer = await orderInvoiceExcelService.orderInvoiceToExcel(invoice, customer);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_no}.xlsx"`);
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

export async function addItemTemplate(req, res, next) {
  try {
    created(
      res,
      await orderService.addOrderItemFromTemplate(req.params.id, itemTemplateSchema.parse(req.body))
    );
  } catch (err) {
    next(err);
  }
}

export async function addSize(req, res, next) {
  try {
    created(
      res,
      await orderService.addOrderItemSize(req.params.id, req.params.itemId, sizeSchema.parse(req.body))
    );
  } catch (err) {
    next(err);
  }
}

export async function updateSize(req, res, next) {
  try {
    ok(
      res,
      await orderService.updateOrderItemSize(
        req.params.id,
        req.params.itemId,
        req.params.sizeId,
        sizeUpdateSchema.parse(req.body)
      )
    );
  } catch (err) {
    next(err);
  }
}

export async function removeSize(req, res, next) {
  try {
    await orderService.deleteOrderItemSize(req.params.id, req.params.itemId, req.params.sizeId);
    ok(res, { message: 'Size dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function addDP(req, res, next) {
  try {
    created(res, await orderService.addOrderDP(req.params.id, dpSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function updateDP(req, res, next) {
  try {
    ok(res, await orderService.updateOrderDP(req.params.id, req.params.dpId, dpUpdateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function removeDP(req, res, next) {
  try {
    await orderService.deleteOrderDP(req.params.id, req.params.dpId);
    ok(res, { message: 'DP dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function followUp(req, res, next) {
  try {
    const { template_key, fields } = followUpSchema.parse(req.body);
    ok(res, await waFollowUpService.resolveFollowUpMessage(req.params.id, template_key, fields || {}));
  } catch (err) {
    next(err);
  }
}

export async function timeline(req, res, next) {
  try {
    const [timelineEntries, shipping] = await Promise.all([
      orderTimelineService.getOrderTimeline(req.params.id),
      orderTimelineService.getOrderShipping(req.params.id),
    ]);
    ok(res, { timeline: timelineEntries, shipping });
  } catch (err) {
    next(err);
  }
}

export async function trackingLink(req, res, next) {
  try {
    ok(res, await orderService.getTrackingLink(req.params.id));
  } catch (err) {
    next(err);
  }
}
