import PDFDocument from 'pdfkit';
import { formatDate, measurePdfRowHeight, drawPdfRow, ensurePdfSpace, loadLogoImage } from './pdfHelpers.js';

// Matches the shop's existing printed nota header — see duaduaStudio nota template.
const SHOP_NAME = '22Studio';
const SHOP_ADDRESS = ['JL. Cimerang No.14 Rt.03/Rw.05', 'Seberang SDN Margalaksana 1', 'Cimerang, Bandung Barat 40553'];
const SHOP_PHONE = '0813-1232-2833';
const SHOP_INSTAGRAM = '@sablon_konveksi_bandung';

function drawHeader(doc) {
  const startX = 40;
  const y = 40;
  const logoSize = 52;

  const logo = loadLogoImage();
  if (logo) {
    doc.image(logo, startX, y, { width: logoSize, height: logoSize });
  } else {
    doc.circle(startX + logoSize / 2, y + logoSize / 2, logoSize / 2).lineWidth(1.5).strokeColor('#000').stroke();
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('22', startX, y + logoSize / 2 - 8, { width: logoSize, align: 'center' });
  }

  const infoX = startX + logoSize + 14;
  const infoWidth = 260;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(SHOP_NAME, infoX, y);
  doc.fontSize(9).font('Helvetica');
  let infoY = y + 16;
  SHOP_ADDRESS.forEach((line) => {
    doc.text(line, infoX, infoY);
    infoY += 12;
  });

  // Divider between the shop address block and the contact block, as requested.
  infoY += 2;
  doc.moveTo(infoX, infoY).lineTo(infoX + infoWidth, infoY).lineWidth(0.5).strokeColor('#999').stroke();
  infoY += 8;

  doc.text(`WA: ${SHOP_PHONE}`, infoX, infoY);
  infoY += 12;
  doc.text(`IG: ${SHOP_INSTAGRAM}`, infoX, infoY);

  return Math.max(y + logoSize, infoY + 12);
}

export function suratJalanToPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = 40;
    const pageTop = 40;
    const pageBottom = 780;
    const pageWidth = 515;

    let headerBottom = drawHeader(doc);

    // Right-aligned document info block, next to the shop header.
    const rightColX = startX + 300;
    const rightColWidth = pageWidth - 300;
    doc.fontSize(10).font('Helvetica-Bold').text('SURAT JALAN', rightColX, pageTop, { width: rightColWidth, align: 'right' });
    doc.fontSize(9).font('Helvetica');
    doc.text(`No. Dokumen: ${data.no_document}`, rightColX, pageTop + 16, { width: rightColWidth, align: 'right' });
    doc.text(`Tanggal: ${formatDate(data.created_at)}`, rightColX, pageTop + 30, { width: rightColWidth, align: 'right' });

    let y = Math.max(headerBottom, pageTop + 48) + 16;

    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(1).strokeColor('#000').stroke();
    y += 12;

    doc.fontSize(9).font('Helvetica-Bold').text('Kepada Yth:', startX, y);
    y += 13;
    doc.fontSize(10).font('Helvetica-Bold').text(data.customer_name || '-', startX, y);
    y += 14;
    doc.fontSize(9).font('Helvetica');
    if (data.penerima_nama) {
      doc.text(`Penerima: ${data.penerima_nama}`, startX, y);
      y += 12;
    }
    if (data.penerima_telepon) {
      doc.text(`Telepon: ${data.penerima_telepon}`, startX, y);
      y += 12;
    }
    if (data.penerima_alamat) {
      const addrHeight = doc.heightOfString(`Alamat: ${data.penerima_alamat}`, { width: pageWidth });
      doc.text(`Alamat: ${data.penerima_alamat}`, startX, y, { width: pageWidth });
      y += addrHeight + 4;
    }

    y += 10;

    const colWidths = [40, 375, 100];
    const headers = ['No', 'Nama Item', 'Qty'];
    const align = ['center', 'left', 'center'];

    y = drawPdfRow(doc, startX, colWidths, headers, y, { bold: true, fill: '#c9daf8', align });

    data.items.forEach((item, idx) => {
      const values = [idx + 1, item.nama_item, item.qty];
      const rowHeight = measurePdfRowHeight(doc, colWidths, values, { align });
      y = ensurePdfSpace(doc, y, rowHeight, pageTop, pageBottom);
      y = drawPdfRow(doc, startX, colWidths, values, y, { align, height: rowHeight });
    });

    y = ensurePdfSpace(doc, y, 90, pageTop, pageBottom);
    y += 30;

    const signColWidth = pageWidth / 2;
    doc.fontSize(9).font('Helvetica').text('Pengirim,', startX, y, { width: signColWidth, align: 'center' });
    doc.text('Penerima,', startX + signColWidth, y, { width: signColWidth, align: 'center' });
    y += 50;
    doc.text('(.............................)', startX, y, { width: signColWidth, align: 'center' });
    doc.text('(.............................)', startX + signColWidth, y, { width: signColWidth, align: 'center' });

    doc.end();
  });
}
