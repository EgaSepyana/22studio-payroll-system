import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

function formatCurrency(n) {
  return `Rp${Number(n).toLocaleString('id-ID')}`;
}

export async function reportToExcel(report) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Laporan');

  sheet.columns = [
    { header: 'Keterangan', key: 'label', width: 30 },
    { header: 'Quantity', key: 'quantity', width: 15 },
    { header: 'Jumlah Pekerjaan', key: 'count', width: 18 },
    { header: 'Total', key: 'total', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  report.rows.forEach((row) => {
    sheet.addRow({ label: row.label, quantity: row.quantity, count: row.count, total: row.total });
  });

  sheet.addRow({});
  const totalRow = sheet.addRow({ label: 'GRAND TOTAL', quantity: report.grand_quantity, total: report.grand_total });
  totalRow.font = { bold: true };

  sheet.getColumn('total').numFmt = '#,##0';

  return workbook.xlsx.writeBuffer();
}

export function reportToPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('22Studio Payroll — Laporan', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text(`Group by: ${report.groupBy}`, { align: 'center' });
    doc.moveDown(1.5);

    const startX = 40;
    let y = doc.y;
    const colWidths = [220, 90, 90, 120];
    const headers = ['Keterangan', 'Quantity', 'Jumlah', 'Total'];

    doc.fontSize(10).fillColor('#000');
    headers.forEach((h, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(h, x, y, { width: colWidths[i], continued: false });
    });
    y += 18;
    doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
    y += 6;

    report.rows.forEach((row) => {
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      const values = [row.label, String(row.quantity), String(row.count), formatCurrency(row.total)];
      values.forEach((v, i) => {
        const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(v, x, y, { width: colWidths[i] });
      });
      y += 18;
    });

    y += 10;
    doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
    y += 8;
    doc.font('Helvetica-Bold').text(`GRAND TOTAL: ${formatCurrency(report.grand_total)}`, startX, y);

    doc.end();
  });
}
