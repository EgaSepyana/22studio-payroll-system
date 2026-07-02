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

function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function periodLabel(month, year) {
  return `${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
}

// Draws one bordered table row (grid on all four sides of every cell, not
// just a stray line under the header) and returns the y position the next
// row should start at. Text is vertically centered and truncated with an
// ellipsis instead of wrapping, so long values can never bleed into the row
// below — this was the root cause of the previous "unreadable" rendering.
function drawPdfRow(doc, startX, colWidths, values, y, opts = {}) {
  const rowHeight = opts.height || 20;
  const fontSize = opts.fontSize || 9;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  if (opts.fill) {
    doc.rect(startX, y, tableWidth, rowHeight).fill(opts.fill);
  }

  doc.lineWidth(0.75).strokeColor('#b7b7b7');
  doc.rect(startX, y, tableWidth, rowHeight).stroke();
  let vx = startX;
  for (let i = 0; i < colWidths.length - 1; i++) {
    vx += colWidths[i];
    doc.moveTo(vx, y).lineTo(vx, y + rowHeight).stroke();
  }
  doc.strokeColor('#000000');

  doc.fillColor(opts.textColor || '#000').fontSize(fontSize).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
  const textY = y + (rowHeight - fontSize) / 2;
  values.forEach((v, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(v === '' || v == null ? '' : String(v), x + 5, textY, {
      width: colWidths[i] - 10,
      lineBreak: false,
      ellipsis: true,
      align: (opts.align && opts.align[i]) || 'left',
    });
  });

  doc.fillColor('#000');
  return y + rowHeight;
}

function ensurePdfSpace(doc, y, rowHeight, pageTop, pageBottom) {
  if (y + rowHeight > pageBottom) {
    doc.addPage();
    return pageTop;
  }
  return y;
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

    const pageTop = 40;
    const pageBottom = 560;

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
      const colWidths = [30, 78, 90, 165, 70, 50, 85, 100, 87];
      const headers = ['No', 'Tanggal', 'Customer', 'Jenis Artikel', 'Harga', 'Qty', 'Jumlah', 'Keterangan', 'Status'];
      const align = ['center', 'left', 'left', 'left', 'right', 'center', 'right', 'left', 'center'];

      y = drawPdfRow(doc, startX, colWidths, headers, y, { bold: true, fill: '#c9daf8', align });

      let total = 0;
      group.items.forEach((item, idx) => {
        total += Number(item.total);
        y = ensurePdfSpace(doc, y, 20, pageTop, pageBottom);
        y = drawPdfRow(
          doc,
          startX,
          colWidths,
          [
            idx + 1,
            formatDate(item.work_date),
            item.customer_name,
            item.article_name,
            formatCurrency(item.price),
            item.quantity,
            formatCurrency(item.total),
            item.notes || '-',
            statusLabel(item.status),
          ],
          y,
          { align }
        );
      });

      y = ensurePdfSpace(doc, y, 20, pageTop, pageBottom);
      y = drawPdfRow(doc, startX, colWidths, ['', '', '', '', '', 'TOTAL', formatCurrency(total), '', ''], y, {
        bold: true,
        fill: '#ffd966',
        align,
      });

      y = ensurePdfSpace(doc, y, 70, pageTop, pageBottom);
      y += 14;
      const summaryX = startX + colWidths.reduce((a, b) => a + b, 0) - 200;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#cc0000').text('Kasbon', summaryX, y);
      doc.text('Rp0', summaryX + 100, y);
      y += 16;
      doc.text('Lain-lain', summaryX, y);
      doc.text('Rp0', summaryX + 100, y);
      y += 16;
      doc.fillColor('#000').text('GAJI BERSIH', summaryX, y);
      doc.font('Helvetica-Bold').text(formatCurrency(total), summaryX + 100, y);
      doc.fillColor('#000');
    });

    doc.end();
  });
}

// Powers the "Sudah Dibayar" payroll export/print — one slip per paid Payroll
// row (already scoped to a single employee + period), reusing the same visual
// template as the Data Pekerjaan slip above but with the REAL kasbon_deduction
// and net_salary already locked in at payment time, and columns that branch
// by pay source (piece-rate work logs vs hourly attendance).
export async function payrollToExcel(rows) {
  const workbook = new ExcelJS.Workbook();

  if (rows.length === 0) {
    workbook.addWorksheet('Slip Gaji').addRow(['Tidak ada payroll yang sudah dibayar pada periode ini.']);
    return workbook.xlsx.writeBuffer();
  }

  rows.forEach((row, idx) => {
    const isAttendance = row.items_type === 'attendance';
    const sheetName = `${row.employee_name || 'Karyawan'} ${row.month}-${row.year}`
      .slice(0, 31)
      .replace(/[[\]*/\\?:]/g, ' ');
    const sheet = workbook.addWorksheet(sheetName || `Slip ${idx + 1}`);

    const lastCol = isAttendance ? 'F' : 'J';
    sheet.mergeCells(`A1:${lastCol}1`);
    sheet.getCell('A1').value = 'SLIP GAJI 22Studio';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.getCell('A3').value = 'Nama Pegawai';
    sheet.getCell('B3').value = row.employee_name;
    sheet.getCell('B3').font = { bold: true, color: { argb: 'FF1155CC' } };
    sheet.getCell('A4').value = 'Periode';
    sheet.getCell('B4').value = periodLabel(row.month, row.year);

    const headerRowNumber = 6;
    const headers = isAttendance
      ? ['No', 'Tanggal', 'Check-in', 'Check-out', 'Jam Kerja', 'Total']
      : ['No', 'Tanggal', 'Nama Customer', 'Jenis Artikel', 'Size', 'Harga Jahit', 'Quantity', 'Jumlah', 'Keterangan', 'Status'];

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

    sheet.columns = isAttendance
      ? [
          { key: 'no', width: 6 },
          { key: 'tanggal', width: 16 },
          { key: 'checkin', width: 14 },
          { key: 'checkout', width: 14 },
          { key: 'jam', width: 12 },
          { key: 'total', width: 16 },
        ]
      : [
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

    row.items.forEach((item, itemIdx) => {
      const values = isAttendance
        ? [itemIdx + 1, formatDate(item.date), formatTime(item.check_in), formatTime(item.check_out), item.hours, Number(item.total)]
        : [
            itemIdx + 1,
            formatDate(item.work_date),
            item.customer_name,
            item.article_name,
            '',
            Number(item.price),
            Number(item.quantity),
            Number(item.total),
            item.notes || '',
            statusLabel(item.status),
          ];
      const excelRow = sheet.addRow(values);
      excelRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      if (isAttendance) {
        excelRow.getCell(6).numFmt = '#,##0';
        excelRow.getCell(1).alignment = { horizontal: 'center' };
      } else {
        excelRow.getCell(6).numFmt = '#,##0';
        excelRow.getCell(8).numFmt = '#,##0';
        excelRow.getCell(1).alignment = { horizontal: 'center' };
        excelRow.getCell(7).alignment = { horizontal: 'center' };

        const statusCell = excelRow.getCell(10);
        if (item.status === 'selesai') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
        } else if (item.status === 'on_progress') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        } else {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4CCCC' } };
        }
      }
    });

    const totalRowNumber = headerRowNumber + row.items.length + 1;
    const labelCol = isAttendance ? 'D' : 'G';
    const valueCol = isAttendance ? 'F' : 'H';

    sheet.mergeCells(`A${totalRowNumber}:${labelCol}${totalRowNumber}`);
    const totalLabelCell = sheet.getCell(`A${totalRowNumber}`);
    totalLabelCell.value = 'TOTAL';
    totalLabelCell.alignment = { horizontal: 'center' };
    totalLabelCell.font = { bold: true };
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };

    const totalValueCell = sheet.getCell(`${valueCol}${totalRowNumber}`);
    totalValueCell.value = Number(row.total_salary);
    totalValueCell.numFmt = '#,##0';
    totalValueCell.font = { bold: true };
    totalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };

    // Fill the columns between the merged label and the value cell so the
    // yellow TOTAL band spans the full row, matching the Data Pekerjaan slip.
    const fillCol = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
    if (isAttendance) {
      sheet.getCell(`E${totalRowNumber}`).fill = fillCol;
    } else {
      sheet.getCell(`I${totalRowNumber}`).fill = fillCol;
      sheet.getCell(`J${totalRowNumber}`).fill = fillCol;
    }

    const summaryLabelCol = isAttendance ? 'D' : 'F';
    const summaryValueCol = isAttendance ? 'F' : 'H';
    let r = totalRowNumber + 2;
    sheet.getCell(`${summaryLabelCol}${r}`).value = 'Kasbon';
    sheet.getCell(`${summaryLabelCol}${r}`).font = { color: { argb: 'FFFF0000' } };
    sheet.getCell(`${summaryValueCol}${r}`).value = -Number(row.kasbon_deduction || 0);
    sheet.getCell(`${summaryValueCol}${r}`).numFmt = '#,##0';
    sheet.getCell(`${summaryValueCol}${r}`).font = { color: { argb: 'FFFF0000' } };
    r += 1;
    sheet.getCell(`${summaryLabelCol}${r}`).value = 'Lain-lain';
    sheet.getCell(`${summaryLabelCol}${r}`).font = { color: { argb: 'FFFF0000' } };
    r += 1;
    sheet.getCell(`${summaryLabelCol}${r}`).value = 'GAJI BERSIH';
    sheet.getCell(`${summaryLabelCol}${r}`).font = { bold: true };
    sheet.getCell(`${summaryValueCol}${r}`).value = Number(row.net_salary);
    sheet.getCell(`${summaryValueCol}${r}`).numFmt = '#,##0';
    sheet.getCell(`${summaryValueCol}${r}`).font = { bold: true };
    sheet.getCell(`${summaryValueCol}${r}`).border = { top: { style: 'thin' } };
  });

  return workbook.xlsx.writeBuffer();
}

export function payrollToPdf(rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (rows.length === 0) {
      doc.fontSize(14).text('Tidak ada payroll yang sudah dibayar pada periode ini.', { align: 'center' });
      doc.end();
      return;
    }

    rows.forEach((row, rowIdx) => {
      if (rowIdx > 0) doc.addPage();

      const isAttendance = row.items_type === 'attendance';

      doc.fontSize(16).font('Helvetica-Bold').text('SLIP GAJI 22Studio', { align: 'center' });
      doc.moveDown(0.8);
      doc.fontSize(11).font('Helvetica-Bold').text('Nama Pegawai: ', { continued: true });
      doc.font('Helvetica').fillColor('#1155cc').text(row.employee_name || '-');
      doc.fillColor('#000');
      doc.font('Helvetica-Bold').text('Periode: ', { continued: true });
      doc.font('Helvetica').text(periodLabel(row.month, row.year));
      doc.moveDown(0.8);

      const startX = 40;
      let y = doc.y;
      const pageTop = 40;
      const pageBottom = 560;
      const colWidths = isAttendance
        ? [40, 110, 110, 110, 90, 110]
        : [30, 78, 90, 165, 70, 50, 85, 100, 87];
      const headers = isAttendance
        ? ['No', 'Tanggal', 'Check-in', 'Check-out', 'Jam Kerja', 'Total']
        : ['No', 'Tanggal', 'Customer', 'Jenis Artikel', 'Harga', 'Qty', 'Jumlah', 'Keterangan', 'Status'];
      const align = isAttendance
        ? ['center', 'left', 'center', 'center', 'right', 'right']
        : ['center', 'left', 'left', 'left', 'right', 'center', 'right', 'left', 'center'];

      y = drawPdfRow(doc, startX, colWidths, headers, y, { bold: true, fill: '#c9daf8', align });

      row.items.forEach((item, itemIdx) => {
        y = ensurePdfSpace(doc, y, 20, pageTop, pageBottom);
        const values = isAttendance
          ? [
              itemIdx + 1,
              formatDate(item.date),
              formatTime(item.check_in),
              formatTime(item.check_out),
              item.hours ?? '-',
              formatCurrency(item.total),
            ]
          : [
              itemIdx + 1,
              formatDate(item.work_date),
              item.customer_name,
              item.article_name,
              formatCurrency(item.price),
              item.quantity,
              formatCurrency(item.total),
              item.notes || '-',
              statusLabel(item.status),
            ];
        y = drawPdfRow(doc, startX, colWidths, values, y, { align });
      });

      y = ensurePdfSpace(doc, y, 20, pageTop, pageBottom);
      const totalRow = isAttendance
        ? ['', '', '', '', 'TOTAL', formatCurrency(row.total_salary)]
        : ['', '', '', '', '', 'TOTAL', formatCurrency(row.total_salary), '', ''];
      y = drawPdfRow(doc, startX, colWidths, totalRow, y, { bold: true, fill: '#ffd966', align });

      y = ensurePdfSpace(doc, y, 70, pageTop, pageBottom);
      y += 14;
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const summaryX = startX + tableWidth - 200;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#cc0000').text('Kasbon', summaryX, y);
      doc.text(`-${formatCurrency(row.kasbon_deduction || 0)}`, summaryX + 100, y);
      y += 16;
      doc.text('Lain-lain', summaryX, y);
      doc.text('Rp0', summaryX + 100, y);
      y += 16;
      doc.fillColor('#000').text('GAJI BERSIH', summaryX, y);
      doc.font('Helvetica-Bold').text(formatCurrency(row.net_salary), summaryX + 100, y);
      doc.fillColor('#000');
    });

    doc.end();
  });
}
