import { CustomersRepo, FINISHING_DIVISION } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { normalizePhone } from '../utils/phoneUtils.js';
import { formatCurrency, formatDate } from './pdfHelpers.js';
import * as orderService from './orderService.js';
import * as settingsService from './settingsService.js';

const SALUTATION = 'Assalamualaikum';
const DP_MIN_RATIO = 0.6;

// Ad-hoc fields the admin types fresh at send-time rather than something
// derived from stored data — e.g. CATATAN on the invoice template, or
// DISTRIBUSI/DITERIMA on the "picked up" template. Any key not in this list
// is silently ignored from the `fields` the caller sends, so a template can
// never be tricked into overriding a computed value like {SISA}.
const ADHOC_FIELD_KEYS = ['CATATAN', 'DISTRIBUSI', 'DITERIMA'];

function formatRincian(items) {
  const lines = [];
  for (const item of items) {
    for (const size of item.sizes) {
      const label = item.warna ? `${item.nama_item} (${item.warna})` : item.nama_item;
      const unitPrice = Number(size.harga).toLocaleString('id-ID');
      lines.push(`- ${label} ${size.size} ( ${unitPrice} x ${size.qty} ) = ${formatCurrency(size.total)}`);
    }
  }
  return lines.length ? lines.join('\n') : '-';
}

function formatDPHistory(dp) {
  if (!dp.length) return 'Belum ada riwayat DP.';
  return dp.map((d) => `- ${formatDate(d.dp_at)}: ${formatCurrency(d.total_dp)}`).join('\n');
}

function substitute(content, variables) {
  return content.replace(/\{([A-Z_]+)\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

export async function resolveFollowUpMessage(orderId, templateKey, fields = {}) {
  const [order, templates] = await Promise.all([
    orderService.getOrderInvoice(orderId),
    settingsService.listWATemplates(),
  ]);

  const template = templates.find((t) => t.template_key === templateKey);
  if (!template) throw new ApiError(404, 'Template tidak ditemukan');

  const customer = await CustomersRepo.getById(order.customer_id);
  if (!customer) throw new ApiError(400, 'Customer tidak valid');

  const bankAccountText = await settingsService.getBankAccountText();

  const financeTasks = order.tasks.filter((t) => t.divisi === FINISHING_DIVISION);
  const qtyPO = financeTasks.reduce((sum, t) => sum + Number(t.target_qty), 0);
  const qtyQC = financeTasks.reduce((sum, t) => sum + Number(t.completed_qty), 0);

  const variables = {
    SALAM: SALUTATION,
    NAMA: customer.pic || customer.name,
    NAMA_USAHA: customer.name,
    ALAMAT: customer.alamat || '-',
    ORDER: order.order_name,
    NO_INVOICE: order.invoice_no,
    RINCIAN: formatRincian(order.items),
    TOTAL_BRUTO: formatCurrency(order.items_total),
    TOTAL: formatCurrency(order.items_total),
    DP_MIN: formatCurrency(Math.round(order.items_total * DP_MIN_RATIO)),
    REKENING_BANK: bankAccountText || '-',
    DEADLINE: order.deadline ? formatDate(order.deadline) : '-',
    BAYAR: formatCurrency(order.total_dp),
    SISA: formatCurrency(order.sisa_pembayaran),
    DP_HISTORY: formatDPHistory(order.dp),
    QTY_PO: String(qtyPO),
    QTY_QC: String(qtyQC),
    QTY_SELISIH: String(qtyPO - qtyQC),
    STATUS: order.status,
  };

  for (const key of ADHOC_FIELD_KEYS) {
    if (fields[key] !== undefined) variables[key] = String(fields[key]);
    else if (!(key in variables)) variables[key] = '';
  }

  return {
    phone: normalizePhone(customer.no_hp),
    message: substitute(template.content, variables),
  };
}
