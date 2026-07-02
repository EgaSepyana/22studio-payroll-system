import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const STATUS_LABELS = {
  on_progress: 'On Progress',
  selesai: 'Selesai',
  belum_selesai: 'Belum Selesai',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || 'Selesai';
}

function formatCurrency(n) {
  return `Rp${Number(n).toLocaleString('id-ID')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(dateStr)
  );
}

// Groups a flat list of enriched work logs into one "Slip Gaji" per employee —
// mirrors the shop's existing manual slip format (No / Tanggal / Nama Customer /
// Jenis Artikel / Size / Harga Jahit / Quantity / Jumlah / Keterangan / Status).
function groupByEmployee(logs) {
  const groups = new Map();
  for (const log of logs) {
    const key = String(log.employee_id);
    if (!groups.has(key)) {
      groups.set(key, { employee_name: log.employee_name || `Karyawan #${key}`, items: [] });
    }
    groups.get(key).items.push(log);
  }
  return Array.from(groups.values());
}

export async function workLogsToExcel(logs) {
  const workbook = new ExcelJS.Workbook();
  const groups = groupByEmployee(logs);

  if (groups.length === 0) {
    workbook.addWorksheet('Slip Gaji').addRow(['Tidak ada data pekerjaan pada periode ini.']);
  }

  for (const group of groups) {
    const sheetName = group.employee_name.slice(0, 31).replace(/[[\]*/\\?:]/g, ' ');
    const sheet = workbook.addWorksheet(sheetName || 'Slip Gaji');

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = 'SLIP GAJI 22Studio';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.getCell('A3').value = 'Nama Pegawai';
    sheet.getCell('B3').value = group.employee_name;
    sheet.getCell('B3').font = { bold: true, color: { argb: 'FF1155CC' } };

    const headerRowNumber = 5;
    const headers = [
      'No',
      'Tanggal',
      'Nama Customer',
      'Jenis Artikel',
      'Size',
      'Harga Jahit',
      'Quantity',
      'Jumlah',
      'Keterangan',
      'Status',
    ];
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = headers;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9DAF8' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    sheet.columns = [
      { key: 'no', width: 6 },
      { key: 'tanggal', width: 16 },
      { key: 'customer', width: 16 },
      { key: 'artikel', width: 30 },
      { key: 'size', width: 8 },
      { key: 'harga', width: 14 },
      { key: 'qty', width: 12 },
      { key: 'jumlah', width: 16 },
      { key: 'keterangan', width: 18 },
      { key: 'status', width: 16 },
    ];

    let total = 0;
    group.items.forEach((item, idx) => {
      total += Number(item.total);
      const row = sheet.addRow([
        idx + 1,
        formatDate(item.work_date),
        item.customer_name,
        item.article_name,
        '',
        Number(item.price),
        Number(item.quantity),
        Number(item.total),
        item.notes || '',
        statusLabel(item.status),
      ]);
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (colNumber === 6 || colNumber === 8) cell.numFmt = '#,##0';
        if (colNumber === 1 || colNumber === 7) cell.alignment = { horizontal: 'center' };
      });

      const statusCell = row.getCell(10);
      if (item.status === 'selesai') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
      } else if (item.status === 'on_progress') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4CCCC' } };
      }
    });

    const totalRowNumber = headerRowNumber + group.items.length + 1;
    sheet.mergeCells(`A${totalRowNumber}:G${totalRowNumber}`);
    const totalLabelCell = sheet.getCell(`A${totalRowNumber}`);
    totalLabelCell.value = 'TOTAL';
    totalLabelCell.alignment = { horizontal: 'center' };
    totalLabelCell.font = { bold: true };
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };

    const totalValueCell = sheet.getCell(`H${totalRowNumber}`);
    totalValueCell.value = total;
    totalValueCell.numFmt = '#,##0';
    totalValueCell.font = { bold: true };
    totalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };

    sheet.getCell(`I${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
    sheet.getCell(`J${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };

    let r = totalRowNumber + 2;
    sheet.getCell(`F${r}`).value = 'Kasbon';
    sheet.getCell(`F${r}`).font = { color: { argb: 'FFFF0000' } };
    r += 1;
    sheet.getCell(`F${r}`).value = 'Lain-lain';
    sheet.getCell(`F${r}`).font = { color: { argb: 'FFFF0000' } };
    r += 1;
    sheet.getCell(`F${r}`).value = 'GAJI BERSIH';
    sheet.getCell(`F${r}`).font = { bold: true };
    sheet.getCell(`H${r}`).value = total;
    sheet.getCell(`H${r}`).numFmt = '#,##0';
    sheet.getCell(`H${r}`).font = { bold: true };
    sheet.getCell(`H${r}`).border = { top: { style: 'thin' } };
  }

  return workbook.xlsx.writeBuffer();
}

export function workLogsToPdf(logs) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const groups = groupByEmployee(logs);

    if (groups.length === 0) {
      doc.fontSize(14).text('Tidak ada data pekerjaan pada periode ini.', { align: 'center' });
      doc.end();
      return;
    }

    groups.forEach((group, groupIdx) => {
      if (groupIdx > 0) doc.addPage();

      doc.fontSize(16).font('Helvetica-Bold').text('SLIP GAJI 22Studio', { align: 'center' });
      doc.moveDown(0.8);
      doc.fontSize(11).font('Helvetica-Bold').text('Nama Pegawai: ', { continued: true });
      doc.font('Helvetica').fillColor('#1155cc').text(group.employee_name);
      doc.fillColor('#000');
      doc.moveDown(0.8);

      const startX = 40;
      let y = doc.y;
      const colWidths = [30, 75, 80, 150, 40, 70, 60, 80, 90, 80];
      const headers = ['No', 'Tanggal', 'Customer', 'Jenis Artikel', 'Size', 'Harga', 'Qty', 'Jumlah', 'Keterangan', 'Status'];

      function drawRow(values, opts = {}) {
        const rowHeight = 18;
        if (y + rowHeight > 560) {
          doc.addPage();
          y = 40;
        }
        if (opts.fill) {
          doc.rect(startX, y - 2, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(opts.fill);
          doc.fillColor('#000');
        }
        doc.fontSize(9).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
        values.forEach((v, i) => {
          const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(String(v), x + 3, y, { width: colWidths[i] - 4 });
        });
        y += rowHeight;
      }

      drawRow(headers, { bold: true, fill: '#c9daf8' });
      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();

      let total = 0;
      group.items.forEach((item, idx) => {
        total += Number(item.total);
        drawRow([
          idx + 1,
          formatDate(item.work_date),
          item.customer_name,
          item.article_name,
          '',
          formatCurrency(item.price),
          item.quantity,
          formatCurrency(item.total),
          item.notes || '-',
          statusLabel(item.status),
        ]);
      });

      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      y += 4;
      drawRow(['', '', '', '', '', '', 'TOTAL', formatCurrency(total), '', ''], { bold: true, fill: '#ffd966' });

      y += 12;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#cc0000').text('Kasbon', startX + 380, y);
      y += 16;
      doc.text('Lain-lain', startX + 380, y);
      y += 16;
      doc.fillColor('#000').text('GAJI BERSIH', startX + 380, y, { continued: false });
      doc.text(formatCurrency(total), startX + 480, y);
    });

    doc.end();
  });
}
