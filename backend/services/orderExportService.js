import PDFDocument from 'pdfkit';
import { formatCurrency, formatDateShort, loadLogoImage, ensurePdfSpace } from './pdfHelpers.js';

const SHOP_NAME = '22STUDIO SABLON & KONVEKSI';
const SHOP_ADDRESS_LINE = 'JL.CIMERANG NO.14 BANDUNG BARAT • 81312322833';
// Real business info, same account already shown on the shop's other printed
// documents (Surat Jalan) — reused here, not fabricated.
const BANK_INFO = 'BCA 2820157781 Sutikano Dainullah';
const NOTE_TEXT =
  'Mohon diperiksa kembali pesanan Anda sebelum diambil. Setelah pesanan dibawa, kesalahan/kekurangan di luar tanggung jawab kami.';

const LABEL_COLOR = '#6b7fa3';
const BORDER_COLOR = '#c7d0e0';

function drawBox(doc, x, y, w, h) {
  doc.roundedRect(x, y, w, h, 6).lineWidth(0.75).strokeColor(BORDER_COLOR).stroke();
}

function drawHeader(doc, startX, pageWidth) {
  const y = 40;
  const logoSize = 50;

  const logo = loadLogoImage();
  if (logo) {
    doc.image(logo, startX, y, { width: logoSize, height: logoSize });
  } else {
    doc.roundedRect(startX, y, logoSize, logoSize, 6).lineWidth(1).strokeColor(BORDER_COLOR).stroke();
    doc.fontSize(9).fillColor(LABEL_COLOR).text('Logo', startX, y + logoSize / 2 - 5, { width: logoSize, align: 'center' });
  }

  const titleX = startX + logoSize + 14;
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000').text(SHOP_NAME, titleX, y + 4);
  doc.fontSize(9).font('Helvetica').fillColor(LABEL_COLOR).text(SHOP_ADDRESS_LINE, titleX, y + 22);

  const boxW = 180;
  const boxH = 55;
  const boxX = startX + pageWidth - boxW;
  drawBox(doc, boxX, y, boxW, boxH);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('INVOICE / NOTA', boxX, y + 10, { width: boxW - 16, align: 'right' });

  return { boxX, boxY: y, boxW, boxH };
}

function drawLabeledBox(doc, x, y, w, h, label, lines) {
  drawBox(doc, x, y, w, h);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(LABEL_COLOR).text(label, x + 12, y + 10);
  let ly = y + 24;
  lines.forEach((line, idx) => {
    doc.fontSize(idx === 0 ? 10.5 : 9).font(idx === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000');
    doc.text(line, x + 12, ly, { width: w - 24 });
    ly += idx === 0 ? 15 : 13;
  });
}

export function orderInvoiceToPdf(order) {
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

    const { boxX, boxY, boxW } = drawHeader(doc, startX, pageWidth);
    doc.fillColor(LABEL_COLOR).fontSize(8.5).font('Helvetica');
    doc.text(`No: ${order.invoice_no}`, boxX + 8, boxY + 28, { width: boxW - 16, align: 'right' });
    doc.text(`Tanggal: ${formatDateShort(new Date())}`, boxX + 8, boxY + 40, { width: boxW - 16, align: 'right' });

    let y = 110;

    const infoBoxW = (pageWidth - 15) / 2;
    const infoBoxH = 70;
    drawLabeledBox(doc, startX, y, infoBoxW, infoBoxH, 'CUSTOMER', [order.customer_name || '-']);
    drawLabeledBox(doc, startX + infoBoxW + 15, y, infoBoxW, infoBoxH, 'DETAIL ORDER', [
      order.order_name,
      order.deadline ? `Deadline: ${formatDateShort(order.deadline)}` : 'Deadline: -',
    ]);

    y += infoBoxH + 24;

    const colWidths = [250, 50, 90, 125];
    const colX = [
      startX,
      startX + colWidths[0],
      startX + colWidths[0] + colWidths[1],
      startX + colWidths[0] + colWidths[1] + colWidths[2],
    ];
    const align = ['left', 'center', 'right', 'right'];
    const headers = ['Deskripsi', 'Qty', 'Harga', 'Total'];

    doc.fontSize(9).font('Helvetica-Bold').fillColor(LABEL_COLOR);
    headers.forEach((h, i) => doc.text(h, colX[i], y, { width: colWidths[i], align: align[i] }));
    y += 16;
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(0.75).strokeColor(BORDER_COLOR).stroke();
    y += 10;

    order.items.forEach((item) => {
      const values = [item.nama_item, String(item.qty), formatCurrency(item.harga), formatCurrency(item.total)];
      doc.fontSize(9).font('Helvetica');
      const rowHeight = Math.max(14, doc.heightOfString(values[0], { width: colWidths[0] }));
      y = ensurePdfSpace(doc, y, rowHeight + 8, pageTop, pageBottom);
      doc.fillColor('#000');
      values.forEach((v, i) => doc.text(v, colX[i], y, { width: colWidths[i], align: align[i] }));
      y += rowHeight + 8;
    });

    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(0.75).strokeColor(BORDER_COLOR).stroke();
    y += 10;

    const summaryLabelX = colX[2];
    const summaryValueW = colWidths[2] + colWidths[3];
    doc.fontSize(9).font('Helvetica').fillColor(LABEL_COLOR);
    doc.text('Subtotal', summaryLabelX, y, { width: colWidths[2], align: 'right' });
    doc.fillColor('#000').text(formatCurrency(order.items_total), colX[3], y, { width: colWidths[3], align: 'right' });
    y += 18;

    doc.moveTo(summaryLabelX, y).lineTo(startX + pageWidth, y).lineWidth(0.75).strokeColor(BORDER_COLOR).stroke();
    y += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
    doc.text('Total', summaryLabelX, y, { width: colWidths[2], align: 'right' });
    doc.text(formatCurrency(order.items_total), colX[3], y, { width: colWidths[3], align: 'right' });
    y += 30;

    y = ensurePdfSpace(doc, y, 160, pageTop, pageBottom);

    const bottomBoxW = (pageWidth - 15) / 2;
    const bottomBoxH = 55;
    drawBox(doc, startX, y, bottomBoxW, bottomBoxH);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LABEL_COLOR).text('Pembayaran ke:', startX + 12, y + 10);
    doc.fontSize(9).font('Helvetica').fillColor('#000').text(`• ${BANK_INFO}`, startX + 12, y + 26, { width: bottomBoxW - 24 });

    const noteBoxX = startX + bottomBoxW + 15;
    drawBox(doc, noteBoxX, y, bottomBoxW, bottomBoxH);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(LABEL_COLOR).text('Catatan:', noteBoxX + 12, y + 10);
    doc.fontSize(8).font('Helvetica').fillColor('#000').text(NOTE_TEXT, noteBoxX + 12, y + 22, { width: bottomBoxW - 24 });

    y += bottomBoxH + 15;
    y = ensurePdfSpace(doc, y, 90, pageTop, pageBottom);

    const signBoxH = 80;
    drawBox(doc, startX, y, bottomBoxW, signBoxH);
    doc.fontSize(9).font('Helvetica').fillColor(LABEL_COLOR).text('Hormat kami,', startX + 12, y + 12);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(SHOP_NAME, startX + 12, y + signBoxH - 24, { width: bottomBoxW - 24 });

    const receiveBoxX = startX + bottomBoxW + 15;
    drawBox(doc, receiveBoxX, y, bottomBoxW, signBoxH);
    doc.fontSize(9).font('Helvetica').fillColor(LABEL_COLOR).text('Diterima oleh (Customer),', receiveBoxX + 12, y + 12);
    doc
      .moveTo(receiveBoxX + 12, y + signBoxH - 20)
      .lineTo(receiveBoxX + bottomBoxW - 12, y + signBoxH - 20)
      .lineWidth(0.75)
      .strokeColor('#000')
      .stroke();

    doc.end();
  });
}
