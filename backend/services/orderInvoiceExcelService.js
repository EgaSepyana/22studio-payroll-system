import ExcelJS from 'exceljs';
import { ORDER_ITEM_FIXED_SIZES } from '../google-sheet/models.js';

// Matches the shop's original manual "invoice basic.xlsx" template
// (sheet "basic 20s") cell-for-cell: same header layout, same size-grid
// columns, same per-color price/qty/total block repeated per item+warna,
// same yellow TOTAL highlighting and grey headers.
const CURRENCY_FMT = '_-"Rp"* #,##0_-;"-Rp"* #,##0_-;_-"Rp"* \\-_-;_-@';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F3F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const SIZE_INPUT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8EAADB' } };
const COLOR_BLOCK_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } };
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
const CODE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0CECE' } };
const NAME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECECEC' } };
const THIN_BORDER = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};
const CENTER = { horizontal: 'center', vertical: 'middle' };

function borderedCell(cell, opts = {}) {
  cell.border = THIN_BORDER;
  cell.alignment = { ...CENTER, ...opts };
}

// One "color block" per distinct item+warna — matches the template's
// pattern of one BASIC 20s row expanding into a same-colored group of
// per-size price rows (Black, White, Green, ...), each block spanning
// exactly as many rows as the item has sizes.
function buildColorBlocks(items) {
  return items.map((item) => ({
    nama_item: item.nama_item,
    warna: item.warna || '-',
    sizes: item.sizes,
  }));
}

export async function orderInvoiceToExcel(order, customer) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Invoice');

  const sizeColStart = 5; // E
  const sizeCols = ORDER_ITEM_FIXED_SIZES; // XS..6XL, 10 columns (E..N)
  const sizeColEnd = sizeColStart + sizeCols.length - 1;
  const codeCol = 2; // B
  const namaCol = 3; // C (merges C:D)
  const namaColEnd = 4;
  const warnaCol = sizeColEnd + 2; // skip one column after size grid, like template's N (sum) gap
  const jumlahCol = warnaCol + 1;
  const hargaCol = jumlahCol + 1;
  const totalCol = hargaCol + 1;
  const lastCol = totalCol;

  sheet.mergeCells(1, codeCol, 1, lastCol);
  const titleCell = sheet.getCell(1, codeCol);
  titleCell.value = 'INVOICE';
  titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = HEADER_FILL;
  titleCell.alignment = CENTER;
  sheet.getRow(1).height = 28;

  // Shop info block (left) — static, same as the original template.
  sheet.mergeCells(3, codeCol, 4, namaColEnd);
  sheet.getCell(3, codeCol).value = '22Studio-Sablon Konveksi Bandung';
  sheet.getCell(3, codeCol).font = { bold: true };
  sheet.getCell(3, codeCol).alignment = { horizontal: 'center' };

  sheet.mergeCells(5, codeCol, 5, namaColEnd);
  sheet.getCell(5, codeCol).value = 'JL. Cimerang No.16 Padalarang, Bandung Barat';
  sheet.getCell(5, codeCol).alignment = { horizontal: 'center' };

  sheet.mergeCells(6, codeCol, 6, namaColEnd);
  sheet.getCell(6, codeCol).value = 'tlp';
  sheet.getCell(6, codeCol).font = { bold: true };
  sheet.getCell(6, codeCol).alignment = { horizontal: 'center' };

  sheet.mergeCells(7, codeCol, 7, namaColEnd);
  sheet.getCell(7, codeCol).value = '0813 1232 2833';
  sheet.getCell(7, codeCol).alignment = { horizontal: 'center' };

  // Order/customer info block (right) — NUMBER/DATE/NAME/ADDRESS/PHONE/EMAIL.
  // "ADDRESS" holds the customer's PIC contact name, matching how the shop's
  // original template actually used that label; EMAIL is left blank since
  // Customer has no email field today.
  const infoLabelCol = jumlahCol - 1;
  const infoValueCol = jumlahCol;
  const infoRows = [
    ['NUMBER', order.invoice_no || '-'],
    ['DATE', order.created_at ? new Date(order.created_at) : null],
    ['NAME/COMPANY', customer?.name || '-'],
    ['ADDRESS', customer?.pic || '-'],
    ['PHONE', customer?.no_hp || '-'],
    ['EMAIL', ''],
  ];
  infoRows.forEach(([label, value], idx) => {
    const r = 3 + idx;
    const labelCell = sheet.getCell(r, infoLabelCol);
    labelCell.value = label;
    labelCell.font = { bold: true };
    borderedCell(labelCell);

    sheet.mergeCells(r, infoValueCol, r, lastCol);
    const valueCell = sheet.getCell(r, infoValueCol);
    valueCell.value = value;
    if (label === 'DATE' && value) valueCell.numFmt = 'mm/dd/yyyy';
    valueCell.alignment = { horizontal: 'center' };
    valueCell.border = { bottom: { style: 'thin' } };
  });

  // Table header (Code / Keterangan / Ukuran.. / Warna / Jumlah / Harga / Total)
  const headerRow1 = 9;
  const headerRow2 = 10;
  sheet.mergeCells(headerRow1, codeCol, headerRow2, codeCol);
  sheet.mergeCells(headerRow1, namaCol, headerRow2, namaColEnd);
  sheet.mergeCells(headerRow1, sizeColStart, headerRow1, sizeColEnd);
  sheet.mergeCells(headerRow1, warnaCol, headerRow2, warnaCol);
  sheet.mergeCells(headerRow1, jumlahCol, headerRow2, jumlahCol);
  sheet.mergeCells(headerRow1, hargaCol, headerRow2, hargaCol);
  sheet.mergeCells(headerRow1, totalCol, headerRow2, totalCol);

  const headerCells = [
    [headerRow1, codeCol, 'Code'],
    [headerRow1, namaCol, 'KETERANGAN'],
    [headerRow1, sizeColStart, 'UKURAN'],
    [headerRow1, warnaCol, 'WARNA'],
    [headerRow1, jumlahCol, 'JUMLAH'],
    [headerRow1, hargaCol, 'HARGA @'],
    [headerRow1, totalCol, 'TOTAL'],
  ];
  for (const [row, col, text] of headerCells) {
    const cell = sheet.getCell(row, col);
    cell.value = text;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    borderedCell(cell);
  }
  sizeCols.forEach((size, i) => {
    const cell = sheet.getCell(headerRow2, sizeColStart + i);
    cell.value = size;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    borderedCell(cell);
  });

  // Item + color blocks — one block per OrderItem (each item already carries
  // exactly one warna in this app's data model), one row per size within it.
  const blocks = buildColorBlocks(order.items || []);
  let row = headerRow2 + 1;
  let itemNo = 0;
  const totalRowsStart = row;

  for (const block of blocks) {
    itemNo += 1;
    const blockStartRow = row;
    const blockRowCount = Math.max(block.sizes.length, 1);
    const blockEndRow = blockStartRow + blockRowCount - 1;

    if (blockRowCount > 1) {
      sheet.mergeCells(blockStartRow, codeCol, blockEndRow, codeCol);
      sheet.mergeCells(blockStartRow, namaCol, blockEndRow, namaColEnd);
    }
    const codeCell = sheet.getCell(blockStartRow, codeCol);
    codeCell.value = itemNo;
    codeCell.font = { bold: true };
    codeCell.fill = CODE_FILL;
    borderedCell(codeCell);

    const nameCell = sheet.getCell(blockStartRow, namaCol);
    nameCell.value = block.nama_item;
    nameCell.font = { bold: true };
    nameCell.fill = NAME_FILL;
    borderedCell(nameCell);

    // Bucket each size into its fixed column (E..N); anything not in
    // ORDER_ITEM_FIXED_SIZES lands in the trailing custom-size slot instead
    // of being silently dropped.
    const sizesBySlot = new Map();
    block.sizes.forEach((s) => {
      const idx = sizeCols.indexOf(s.size);
      const col = idx >= 0 ? sizeColStart + idx : null;
      sizesBySlot.set(s, col);
    });

    block.sizes.forEach((size, i) => {
      const r = blockStartRow + i;
      const col = sizesBySlot.get(size);
      if (col) {
        const qtyCell = sheet.getCell(r, col);
        qtyCell.value = size.qty;
        qtyCell.fill = SIZE_INPUT_FILL;
        borderedCell(qtyCell);
      }
      // Fill remaining (non-populated) size cells in this row so the grid
      // reads as a full table, matching the template's appearance.
      sizeCols.forEach((_, sIdx) => {
        const c = sizeColStart + sIdx;
        if (c === col) return;
        const cell = sheet.getCell(r, c);
        if (!cell.value) {
          cell.fill = SIZE_INPUT_FILL;
          borderedCell(cell);
        }
      });

      const warnaCell = sheet.getCell(r, warnaCol);
      if (i === 0) warnaCell.value = block.warna;
      warnaCell.fill = COLOR_BLOCK_FILL;
      borderedCell(warnaCell);

      const jumlahCell = sheet.getCell(r, jumlahCol);
      jumlahCell.value = size.qty;
      jumlahCell.fill = COLOR_BLOCK_FILL;
      jumlahCell.numFmt = '0';
      borderedCell(jumlahCell);

      const hargaCell = sheet.getCell(r, hargaCol);
      hargaCell.value = size.harga;
      hargaCell.numFmt = CURRENCY_FMT;
      hargaCell.fill = COLOR_BLOCK_FILL;
      borderedCell(hargaCell);

      const totalCell = sheet.getCell(r, totalCol);
      totalCell.value = size.total;
      totalCell.numFmt = CURRENCY_FMT;
      totalCell.font = { bold: true };
      totalCell.fill = TOTAL_FILL;
      borderedCell(totalCell);
    });

    if (block.sizes.length === 0) {
      // Item has no sizes recorded yet — still render its identity row so
      // it's visible on the export rather than silently vanishing.
      sizeCols.forEach((_, sIdx) => borderedCell(sheet.getCell(blockStartRow, sizeColStart + sIdx)));
      borderedCell(sheet.getCell(blockStartRow, warnaCol));
      borderedCell(sheet.getCell(blockStartRow, jumlahCol));
      borderedCell(sheet.getCell(blockStartRow, hargaCol));
      borderedCell(sheet.getCell(blockStartRow, totalCol));
    }

    row = blockEndRow + 1;
  }
  const totalRowsEnd = row - 1;

  // JUMLAH / TOTAL summary row.
  const summaryRow = row;
  const jumlahLabelCell = sheet.getCell(summaryRow, warnaCol);
  jumlahLabelCell.value = 'JUMLAH';
  jumlahLabelCell.font = { bold: true };
  borderedCell(jumlahLabelCell);

  const jumlahSumCell = sheet.getCell(summaryRow, jumlahCol);
  if (totalRowsEnd >= totalRowsStart) {
    jumlahSumCell.value = { formula: `SUM(${sheet.getCell(totalRowsStart, jumlahCol).address}:${sheet.getCell(totalRowsEnd, jumlahCol).address})` };
  } else {
    jumlahSumCell.value = 0;
  }
  jumlahSumCell.font = { bold: true };
  borderedCell(jumlahSumCell);

  const totalSumCell = sheet.getCell(summaryRow, totalCol);
  totalSumCell.value = order.items_total;
  totalSumCell.numFmt = CURRENCY_FMT;
  totalSumCell.font = { bold: true };
  totalSumCell.fill = TOTAL_FILL;
  borderedCell(totalSumCell, { horizontal: 'left' });

  // Pembayaran DP / Balance — reuses the order's real, already-tracked DP
  // total and remaining balance instead of a manually-typed number.
  const dpRow = summaryRow + 2;
  const balanceRow = summaryRow + 1;

  const balanceLabelCell = sheet.getCell(balanceRow, hargaCol);
  balanceLabelCell.value = 'Balance';
  balanceLabelCell.font = { bold: true };
  balanceLabelCell.alignment = { horizontal: 'left' };
  balanceLabelCell.border = { bottom: { style: 'thin' } };

  const balanceValueCell = sheet.getCell(balanceRow, totalCol);
  balanceValueCell.value = order.sisa_pembayaran;
  balanceValueCell.numFmt = CURRENCY_FMT;
  balanceValueCell.border = { bottom: { style: 'thin' } };

  const dpLabelCell = sheet.getCell(dpRow, hargaCol);
  dpLabelCell.value = 'Pembayaran DP';
  dpLabelCell.font = { bold: true };
  dpLabelCell.alignment = { horizontal: 'left' };
  dpLabelCell.border = { bottom: { style: 'thin' } };

  const dpValueCell = sheet.getCell(dpRow, totalCol);
  dpValueCell.value = order.total_dp;
  dpValueCell.numFmt = CURRENCY_FMT;
  dpValueCell.font = { bold: true };
  dpValueCell.border = { bottom: { style: 'thin' } };

  // Footer signatures.
  const footerRow = dpRow + 3;
  const penerimaCell = sheet.getCell(footerRow, namaCol);
  penerimaCell.value = 'Penerima';
  penerimaCell.font = { bold: true };
  penerimaCell.alignment = { horizontal: 'center' };

  const hormatCell = sheet.getCell(footerRow, warnaCol);
  hormatCell.value = 'Hormat kami';
  hormatCell.font = { bold: true };
  hormatCell.alignment = { horizontal: 'center' };

  const bankRow = footerRow + 1;
  sheet.mergeCells(bankRow, jumlahCol, bankRow, lastCol);
  sheet.getCell(bankRow, jumlahCol).value = 'BCA a/n : Sutikano Dainullah           2820157781';
  sheet.getCell(bankRow, jumlahCol).font = { bold: true };
  sheet.getCell(bankRow, jumlahCol).alignment = { horizontal: 'left' };

  sheet.mergeCells(bankRow + 3, namaCol, bankRow + 3, namaColEnd);
  sheet.getCell(bankRow + 3, namaCol).value = customer?.pic || '';
  sheet.getCell(bankRow + 3, namaCol).alignment = { horizontal: 'center' };

  // Column widths — narrow size columns, wider text/currency columns.
  sheet.getColumn(codeCol).width = 6;
  sheet.getColumn(namaCol).width = 10;
  sheet.getColumn(namaColEnd).width = 10;
  sizeCols.forEach((_, i) => {
    sheet.getColumn(sizeColStart + i).width = 6;
  });
  sheet.getColumn(warnaCol).width = 14;
  sheet.getColumn(jumlahCol).width = 9;
  sheet.getColumn(hargaCol).width = 12;
  sheet.getColumn(totalCol).width = 14;

  return workbook.xlsx.writeBuffer();
}
