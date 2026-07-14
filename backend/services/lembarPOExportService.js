import PDFDocument from 'pdfkit';
import { drawPdfRow, measurePdfRowHeight, ensurePdfSpace } from './pdfHelpers.js';
import { ORDER_ITEM_FIXED_SIZES } from '../google-sheet/models.js';

const LABEL_COLOR = '#6b7fa3';
const BORDER_COLOR = '#c7d0e0';
const VALUE_COLOR = '#1f3a63';
const QTY_COLOR = '#b5651d';
const TABLE_HEADER_FILL = '#eef1f8';

function drawBox(doc, x, y, w, h, opts = {}) {
  doc.roundedRect(x, y, w, h, 6).lineWidth(0.75).strokeColor(BORDER_COLOR);
  if (opts.dashed) doc.dash(3, { space: 2 });
  doc.stroke();
  if (opts.dashed) doc.undash();
}

// Prints "Label : Value" on one line, label in black, value bold in navy —
// pdfkit's `continued` chains differently-styled runs onto the same line.
function drawFieldLine(doc, x, y, width, label, value) {
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(label, x, y, { continued: true, width });
  doc.font('Helvetica').fillColor('#000').text(' : ', { continued: true });
  doc.font('Helvetica-Bold').fillColor(VALUE_COLOR).text(value || '-');
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// Buckets every item's sizes into the fixed columns used across the app
// (see ORDER_ITEM_FIXED_SIZES), summing anything else — arbitrary custom
// size names — into a single CUSTOM column, then adds a grand-total row.
function buildSizeTable(items) {
  const columns = [...ORDER_ITEM_FIXED_SIZES, 'CUSTOM'];
  const rows = items.map((item) => {
    const bySize = Object.fromEntries(columns.map((c) => [c, 0]));
    for (const size of item.sizes) {
      const key = ORDER_ITEM_FIXED_SIZES.includes(size.size) ? size.size : 'CUSTOM';
      bySize[key] += size.qty;
    }
    return { nama_item: item.nama_item, bySize, total: item.qty };
  });

  const totals = Object.fromEntries(columns.map((c) => [c, 0]));
  let grandTotal = 0;
  for (const row of rows) {
    for (const c of columns) totals[c] += row.bySize[c];
    grandTotal += row.total;
  }

  return { columns, rows, totals, grandTotal };
}

export async function lembarPOToPdf(data) {
  const order = data.order;
  const sizeTable = buildSizeTable(order.items);
  const imageBuffer = await fetchImageBuffer(order.desain_fix_url);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = 40;
    const pageWidth = 515;
    const pageTop = 40;
    const pageBottom = 780;

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(`LEMBAR PO  •  ${order.invoice_no}`, startX, pageTop);
    let y = pageTop + 30;

    // Order summary box: Nama Order / Customer / QTY / Deadline.
    const infoBoxH = 62;
    drawBox(doc, startX, y, pageWidth, infoBoxH);
    const colW = pageWidth / 2 - 12;
    drawFieldLine(doc, startX + 14, y + 14, colW, 'Nama Order', order.order_name);
    drawFieldLine(doc, startX + pageWidth / 2 + 2, y + 14, colW, 'Customer', order.customer_name);
    drawFieldLine(doc, startX + 14, y + 36, colW, 'QTY', String(sizeTable.grandTotal));
    drawFieldLine(doc, startX + pageWidth / 2 + 2, y + 36, colW, 'Deadline', order.deadline);
    y += infoBoxH + 16;

    // Jahit / Finishing boxes — height is dynamic, driven by whichever side
    // wraps to more lines (Catatan vs Pola Potong), so both boxes match.
    const boxW = (pageWidth - 15) / 2;
    const boxPad = 14;
    const innerW = boxW - boxPad * 2;

    doc.fontSize(9).font('Helvetica');
    const catatanHeight = doc.heightOfString(data.catatan || '-', { width: innerW });
    const polaHeight = doc.heightOfString(data.pola_potong || '-', { width: innerW });
    const fieldsBaseY = 92; // header + LABEL/HANGTAG line + first field label/value
    const boxH = fieldsBaseY + Math.max(catatanHeight, polaHeight) + boxPad;

    drawBox(doc, startX, y, boxW, boxH);
    drawBox(doc, startX + boxW + 15, y, boxW, boxH);

    // Jahit
    let jx = startX + boxPad;
    let jy = y + 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Jahit', jx, jy);
    jy += 18;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(`LABEL: ${data.label ? 'YA' : 'TIDAK'}`, jx, jy);
    jy += 20;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000').text('Sablon / Bordir', jx, jy, { width: innerW });
    jy += 12;
    doc.fontSize(9).font('Helvetica').fillColor(VALUE_COLOR).text(data.sablon_bordir || '-', jx, jy, { width: innerW });
    jy += doc.heightOfString(data.sablon_bordir || '-', { width: innerW }) + 10;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000').text('Catatan', jx, jy, { width: innerW });
    jy += 12;
    doc.fontSize(9).font('Helvetica').fillColor(VALUE_COLOR).text(data.catatan || '-', jx, jy, { width: innerW });

    // Finishing
    let fx = startX + boxW + 15 + boxPad;
    let fy = y + 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Finishing', fx, fy);
    fy += 18;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(`HANGTAG: ${data.hangtag ? 'YA' : 'TIDAK'}`, fx, fy);
    fy += 20;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000').text('Bahan & Tipe', fx, fy, { width: innerW });
    fy += 12;
    doc.fontSize(9).font('Helvetica').fillColor(VALUE_COLOR).text(data.bahan_tipe || '-', fx, fy, { width: innerW });
    fy += doc.heightOfString(data.bahan_tipe || '-', { width: innerW }) + 10;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000').text('Pola Potong', fx, fy, { width: innerW });
    fy += 12;
    doc.fontSize(9).font('Helvetica').fillColor(VALUE_COLOR).text(data.pola_potong || '-', fx, fy, { width: innerW });

    y += boxH + 16;

    // Design photo.
    const imageBoxH = 300;
    y = ensurePdfSpace(doc, y, imageBoxH, pageTop, pageBottom);
    drawBox(doc, startX, y, pageWidth, imageBoxH, { dashed: true });
    if (imageBuffer) {
      doc.image(imageBuffer, startX + 10, y + 10, {
        fit: [pageWidth - 20, imageBoxH - 20],
        align: 'center',
        valign: 'center',
      });
    } else {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(LABEL_COLOR)
        .text('Tidak ada gambar desain', startX, y + imageBoxH / 2 - 5, { width: pageWidth, align: 'center' });
      doc.fillColor('#000');
    }
    y += imageBoxH + 16;

    // "Ukuran per Tipe" table.
    y = ensurePdfSpace(doc, y, 60, pageTop, pageBottom);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Ukuran per Tipe', startX, y);
    y += 16;

    const numCols = sizeTable.columns.length + 1; // +1 for the TOTAL column
    const nameColW = 100;
    const remaining = pageWidth - nameColW;
    const numColW = Math.floor((remaining / numCols) * 10) / 10;
    const lastColW = pageWidth - nameColW - numColW * (numCols - 1);
    const colWidths = [nameColW, ...Array(numCols - 1).fill(numColW), lastColW];
    const headers = ['NAMA TIPE', ...sizeTable.columns.map((c) => (c === 'CUSTOM' ? 'CUST' : c)), 'TOTAL'];
    const align = ['left', ...sizeTable.columns.map(() => 'center'), 'center'];

    y = drawPdfRow(doc, startX, colWidths, headers, y, { bold: true, fill: TABLE_HEADER_FILL, align, fontSize: 8 });

    const rowTextColors = [VALUE_COLOR, ...sizeTable.columns.map(() => QTY_COLOR), QTY_COLOR];
    sizeTable.rows.forEach((row) => {
      const values = [row.nama_item, ...sizeTable.columns.map((c) => row.bySize[c]), row.total];
      const rowHeight = measurePdfRowHeight(doc, colWidths, values, { align, fontSize: 8.5 });
      y = ensurePdfSpace(doc, y, rowHeight, pageTop, pageBottom);
      y = drawPdfRow(doc, startX, colWidths, values, y, {
        align,
        height: rowHeight,
        fontSize: 8.5,
        textColor: rowTextColors,
      });
    });

    const totalValues = ['TOTAL', ...sizeTable.columns.map((c) => sizeTable.totals[c]), sizeTable.grandTotal];
    const totalRowHeight = measurePdfRowHeight(doc, colWidths, totalValues, { align, fontSize: 8.5, bold: true });
    y = ensurePdfSpace(doc, y, totalRowHeight, pageTop, pageBottom);
    y = drawPdfRow(doc, startX, colWidths, totalValues, y, {
      align,
      height: totalRowHeight,
      fontSize: 8.5,
      bold: true,
      fill: TABLE_HEADER_FILL,
      textColor: QTY_COLOR,
    });

    y += 30;

    // Signature boxes.
    y = ensurePdfSpace(doc, y, 90, pageTop, pageBottom);
    const signGap = 15;
    const signW = (pageWidth - signGap * 2) / 3;
    const signH = 80;
    ['Disetujui', 'Diterima', 'Produksi'].forEach((label, i) => {
      const sx = startX + i * (signW + signGap);
      drawBox(doc, sx, y, signW, signH);
      doc.fontSize(9).font('Helvetica').fillColor(LABEL_COLOR).text(label, sx, y + signH - 22, { width: signW, align: 'center' });
    });

    doc.end();
  });
}
