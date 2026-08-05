import ExcelJS from 'exceljs';
import { ORDER_ITEM_FIXED_SIZES } from '../google-sheet/models.js';

// Reproduces the shop's original manual "invoice basic.xlsx" template
// (sheet "basic 20s") using the SAME column positions and widths as the
// original file — B=Code, C:D=Keterangan, E:N=size grid, O=Warna, P=Jumlah,
// Q=Harga, R=Total — not just matching colors/fonts in an arbitrary layout.
// Reusing narrow size-grid columns for wide text (shop name, item name) was
// the bug in the first version: those columns are only ~6-7 wide, so text
// truncated instead of spanning into the sheet's wider default-width columns
// the way the original does.
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

// Fixed column positions, matching invoice basic.xlsx exactly.
const COL = {
  code: 2, // B
  namaStart: 3, // C
  namaEnd: 4, // D
  sizeStart: 5, // E
  sizeEnd: 13, // M (9 columns: S..6XL — matches the original's E:M grid)
  sizeSumCol: 14, // N (per-block SUM(E:M) helper, hidden-ish like original)
  warna: 15, // O
  jumlah: 16, // P
  harga: 17, // Q
  total: 18, // R
  hitungan: 20, // T
};
const LAST_COL = COL.total;

function borderedCell(cell, opts = {}) {
  cell.border = THIN_BORDER;
  cell.alignment = { ...CENTER, ...opts };
}

// The original template's size grid is S..6XL (9 columns, no XS) — matches
// ORDER_ITEM_FIXED_SIZES minus its leading XS entry, so XS sizes (rare in
// practice) fall back to the CUSTOM handling below rather than being lost.
const TEMPLATE_SIZES = ORDER_ITEM_FIXED_SIZES.filter((s) => s !== 'XS');

export async function orderInvoiceToExcel(order, customer) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Invoice');
  sheet.properties.defaultColWidth = 12.63;
  sheet.properties.defaultRowHeight = 15.75;

  // Column widths — copied from the original file so text has the same
  // room to breathe (columns not listed keep the 12.63 sheet default).
  sheet.getColumn(1).width = 7.63; // A
  sheet.getColumn(COL.code).width = 8; // B
  sheet.getColumn(COL.namaStart).width = 7.63; // C
  sheet.getColumn(COL.namaEnd).width = 9.38; // D
  sheet.getColumn(COL.sizeStart).width = 7.63; // E
  // F, G, H keep the wide 12.63 default, same as the original.
  sheet.getColumn(9).width = 7.25; // I
  sheet.getColumn(10).width = 7; // J
  sheet.getColumn(11).width = 7.13; // K
  // L keeps the wide default.
  sheet.getColumn(13).width = 7.25; // M
  sheet.getColumn(COL.sizeSumCol).width = 5; // N
  sheet.getColumn(COL.warna).width = 14.75; // O
  sheet.getColumn(COL.jumlah).width = 9.38; // P
  sheet.getColumn(COL.harga).width = 14; // Q
  sheet.getColumn(COL.total).width = 12.25; // R
  sheet.getColumn(19).width = 19.38; // S
  sheet.getColumn(COL.hitungan).width = 12.63; // T

  // Title bar.
  sheet.mergeCells(1, COL.code, 1, 19); // B1:S1, matches original's B1:R1 span + margin col
  const titleCell = sheet.getCell(1, COL.code);
  titleCell.value = 'INVOICE';
  titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = HEADER_FILL;
  titleCell.alignment = CENTER;
  sheet.getRow(1).height = 14.25;
  sheet.getRow(2).height = 20;

  // Shop info block (left), spans wide columns C:H like the original D4:H5.
  sheet.mergeCells(4, COL.namaStart, 5, 8);
  const shopNameCell = sheet.getCell(4, COL.namaStart);
  shopNameCell.value = '22Studio-Sablon Konveksi Bandung';
  shopNameCell.font = { bold: true };
  shopNameCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(6, COL.namaStart, 6, 8);
  const addrCell = sheet.getCell(6, COL.namaStart);
  addrCell.value = 'JL. Cimerang No.16 Padalarang, Bandung Barat';
  addrCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(7, COL.namaStart, 7, 8);
  const tlpLabelCell = sheet.getCell(7, COL.namaStart);
  tlpLabelCell.value = 'tlp';
  tlpLabelCell.font = { bold: true };
  tlpLabelCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(8, COL.namaStart, 8, 8);
  const tlpCell = sheet.getCell(8, COL.namaStart);
  tlpCell.value = '0813 1232 2833';
  tlpCell.alignment = { horizontal: 'center' };

  // Order/customer info block (right) — NUMBER/DATE/NAME/ADDRESS/PHONE/EMAIL.
  // "ADDRESS" holds the customer's PIC contact name, matching how the shop's
  // original template actually used that label; EMAIL is left blank since
  // Customer has no email field today.
  const infoLabelCol = 9; // I
  const infoValueCol = COL.warna; // O, matching original's I:M label / O:R value split
  const infoRows = [
    ['NUMBER', order.invoice_no || '-'],
    ['DATE', order.created_at ? new Date(order.created_at) : null],
    ['NAME/COMPANY', customer?.name || '-'],
    ['ADDRESS', customer?.pic || '-'],
    ['PHONE', customer?.no_hp || '-'],
    ['EMAIL', ''],
  ];
  infoRows.forEach(([label, value], idx) => {
    const r = 4 + idx;
    sheet.mergeCells(r, infoLabelCol, r, 13); // I:M
    const labelCell = sheet.getCell(r, infoLabelCol);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10 };
    labelCell.alignment = CENTER;
    labelCell.border = { bottom: { style: 'thin' } };

    sheet.mergeCells(r, infoValueCol, r, 18); // O:R
    const valueCell = sheet.getCell(r, infoValueCol);
    valueCell.value = value;
    if (label === 'DATE' && value) valueCell.numFmt = 'mm/dd/yyyy';
    valueCell.alignment = { horizontal: 'center' };
    valueCell.border = { bottom: { style: 'thin' } };
  });

  // Table header (Code / Keterangan / Ukuran.. / Warna / Jumlah / Harga / Total).
  const headerRow1 = 11;
  const headerRow2 = 12;
  sheet.mergeCells(headerRow1, COL.code, headerRow2, COL.code);
  sheet.mergeCells(headerRow1, COL.namaStart, headerRow2, COL.namaEnd);
  sheet.mergeCells(headerRow1, COL.sizeStart, headerRow1, COL.sizeEnd);
  sheet.mergeCells(headerRow1, COL.warna, headerRow2, COL.warna);
  sheet.mergeCells(headerRow1, COL.jumlah, headerRow2, COL.jumlah);
  sheet.mergeCells(headerRow1, COL.harga, headerRow2, COL.harga);
  sheet.mergeCells(headerRow1, COL.total, headerRow2, COL.total);

  const headerCells = [
    [headerRow1, COL.code, 'Code'],
    [headerRow1, COL.namaStart, 'KETERANGAN'],
    [headerRow1, COL.sizeStart, 'UKURAN'],
    [headerRow1, COL.warna, 'WARNA'],
    [headerRow1, COL.jumlah, 'JUMLAH'],
    [headerRow1, COL.harga, 'HARGA @'],
    [headerRow1, COL.total, 'TOTAL'],
  ];
  for (const [row, col, text] of headerCells) {
    const cell = sheet.getCell(row, col);
    cell.value = text;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    borderedCell(cell);
  }
  // Also paint the merged-but-empty header cells in row 11 (size grid) and
  // fill in the size sub-labels on row 12.
  for (let c = COL.sizeStart; c <= COL.sizeEnd; c++) {
    const topCell = sheet.getCell(headerRow1, c);
    topCell.fill = HEADER_FILL;
    borderedCell(topCell);
  }
  TEMPLATE_SIZES.forEach((size, i) => {
    const cell = sheet.getCell(headerRow2, COL.sizeStart + i);
    cell.value = size;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    borderedCell(cell);
  });

  // Item + color blocks — one block per OrderItem (each item already carries
  // exactly one warna in this app's data model), one row per size within it.
  let row = headerRow2 + 1;
  let itemNo = 0;
  const totalRowsStart = row;
  const items = order.items || [];

  for (const item of items) {
    itemNo += 1;
    const blockStartRow = row;
    const blockRowCount = Math.max(item.sizes.length, 1);
    const blockEndRow = blockStartRow + blockRowCount - 1;

    if (blockRowCount > 1) {
      sheet.mergeCells(blockStartRow, COL.code, blockEndRow, COL.code);
      sheet.mergeCells(blockStartRow, COL.namaStart, blockEndRow, COL.namaEnd);
    }
    const codeCell = sheet.getCell(blockStartRow, COL.code);
    codeCell.value = itemNo;
    codeCell.font = { bold: true };
    codeCell.fill = CODE_FILL;
    borderedCell(codeCell);

    const nameCell = sheet.getCell(blockStartRow, COL.namaStart);
    nameCell.value = item.nama_item;
    nameCell.font = { bold: true };
    nameCell.fill = NAME_FILL;
    borderedCell(nameCell, { wrapText: true });

    const warna = item.warna || '-';

    item.sizes.forEach((size, i) => {
      const r = blockStartRow + i;
      const idx = TEMPLATE_SIZES.indexOf(size.size);
      const col = idx >= 0 ? COL.sizeStart + idx : null;

      for (let c = COL.sizeStart; c <= COL.sizeEnd; c++) {
        const cell = sheet.getCell(r, c);
        if (c === col) cell.value = size.qty;
        cell.fill = SIZE_INPUT_FILL;
        borderedCell(cell);
      }
      if (col === null) {
        // Custom/unrecognized size name — surfaced in the Keterangan cell's
        // note rather than silently dropped (rare: template has no spare
        // column for it).
        nameCell.value = `${item.nama_item} (${size.size})`;
      }

      const warnaCell = sheet.getCell(r, COL.warna);
      if (i === 0) warnaCell.value = warna;
      warnaCell.fill = COLOR_BLOCK_FILL;
      borderedCell(warnaCell);

      const jumlahCell = sheet.getCell(r, COL.jumlah);
      jumlahCell.value = { formula: `SUM(${sheet.getCell(r, COL.sizeStart).address}:${sheet.getCell(r, COL.sizeEnd).address})` };
      jumlahCell.fill = COLOR_BLOCK_FILL;
      jumlahCell.numFmt = '0';
      borderedCell(jumlahCell);

      const hargaCell = sheet.getCell(r, COL.harga);
      hargaCell.value = size.harga;
      hargaCell.numFmt = CURRENCY_FMT;
      hargaCell.fill = COLOR_BLOCK_FILL;
      borderedCell(hargaCell);

      const totalCell = sheet.getCell(r, COL.total);
      totalCell.value = { formula: `${sheet.getCell(r, COL.harga).address}*${sheet.getCell(r, COL.jumlah).address}` };
      totalCell.numFmt = CURRENCY_FMT;
      totalCell.font = { bold: true };
      totalCell.fill = TOTAL_FILL;
      borderedCell(totalCell);
    });

    // Block-level size-sum helper in column N, matching the original's
    // N13-style "=SUM(E13:M18)" per-block total.
    const sumCell = sheet.getCell(blockStartRow, COL.sizeSumCol);
    sumCell.value = {
      formula: `SUM(${sheet.getCell(blockStartRow, COL.sizeStart).address}:${sheet.getCell(blockEndRow, COL.sizeEnd).address})`,
    };
    if (blockRowCount > 1) sheet.mergeCells(blockStartRow, COL.sizeSumCol, blockEndRow, COL.sizeSumCol);
    sumCell.alignment = CENTER;

    if (item.sizes.length === 0) {
      for (let c = COL.sizeStart; c <= COL.sizeEnd; c++) borderedCell(sheet.getCell(blockStartRow, c));
      borderedCell(sheet.getCell(blockStartRow, COL.warna));
      borderedCell(sheet.getCell(blockStartRow, COL.jumlah));
      borderedCell(sheet.getCell(blockStartRow, COL.harga));
      borderedCell(sheet.getCell(blockStartRow, COL.total));
    }

    row = blockEndRow + 1;
  }
  const totalRowsEnd = row - 1;

  // JUMLAH / TOTAL summary row.
  const summaryRow = row;
  const jumlahLabelCell = sheet.getCell(summaryRow, COL.warna);
  jumlahLabelCell.value = 'JUMLAH';
  jumlahLabelCell.font = { bold: true };
  borderedCell(jumlahLabelCell);

  const jumlahSumCell = sheet.getCell(summaryRow, COL.jumlah);
  jumlahSumCell.value =
    totalRowsEnd >= totalRowsStart
      ? {
          formula: `SUM(${sheet.getCell(totalRowsStart, COL.jumlah).address}:${sheet.getCell(totalRowsEnd, COL.jumlah).address})`,
        }
      : 0;
  jumlahSumCell.font = { bold: true };
  borderedCell(jumlahSumCell);

  const totalSumCell = sheet.getCell(summaryRow, COL.total);
  totalSumCell.value =
    totalRowsEnd >= totalRowsStart
      ? {
          formula: `SUM(${sheet.getCell(totalRowsStart, COL.total).address}:${sheet.getCell(totalRowsEnd, COL.total).address})`,
        }
      : 0;
  totalSumCell.numFmt = CURRENCY_FMT;
  totalSumCell.font = { bold: true };
  totalSumCell.fill = TOTAL_FILL;
  borderedCell(totalSumCell, { horizontal: 'left' });

  // Pembayaran DP / Balance — reuses the order's real, already-tracked DP
  // total and remaining balance instead of a manually-typed number.
  const balanceRow = summaryRow + 1;
  const dpRow = summaryRow + 2;

  const balanceLabelCell = sheet.getCell(balanceRow, COL.harga);
  balanceLabelCell.value = 'Balance';
  balanceLabelCell.font = { bold: true };
  balanceLabelCell.alignment = { horizontal: 'left' };
  balanceLabelCell.border = { bottom: { style: 'thin' } };

  const balanceValueCell = sheet.getCell(balanceRow, COL.total);
  balanceValueCell.value = order.sisa_pembayaran;
  balanceValueCell.numFmt = CURRENCY_FMT;
  balanceValueCell.border = { bottom: { style: 'thin' } };

  const dpLabelCell = sheet.getCell(dpRow, COL.harga);
  dpLabelCell.value = 'Pembayaran DP';
  dpLabelCell.font = { bold: true };
  dpLabelCell.alignment = { horizontal: 'left' };
  dpLabelCell.border = { bottom: { style: 'thin' } };

  const dpValueCell = sheet.getCell(dpRow, COL.total);
  dpValueCell.value = order.total_dp;
  dpValueCell.numFmt = CURRENCY_FMT;
  dpValueCell.font = { bold: true };
  dpValueCell.border = { bottom: { style: 'thin' } };

  // Footer signatures.
  const footerRow = dpRow + 4;
  const penerimaCell = sheet.getCell(footerRow, COL.namaStart);
  penerimaCell.value = 'Penerima';
  penerimaCell.font = { bold: true };
  penerimaCell.alignment = { horizontal: 'center' };

  const hormatCell = sheet.getCell(footerRow, COL.warna);
  hormatCell.value = 'Hormat kami';
  hormatCell.font = { bold: true };
  hormatCell.alignment = { horizontal: 'center' };

  const bankRow = footerRow + 1;
  sheet.mergeCells(bankRow, COL.harga, bankRow, LAST_COL);
  const bankCell = sheet.getCell(bankRow, COL.harga);
  bankCell.value = 'BCA a/n : Sutikano Dainullah           2820157781';
  bankCell.font = { bold: true };
  bankCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(bankRow + 4, COL.namaStart, bankRow + 4, COL.namaEnd);
  const signeeCell = sheet.getCell(bankRow + 4, COL.namaStart);
  signeeCell.value = customer?.pic || '';
  signeeCell.alignment = { horizontal: 'center' };

  return workbook.xlsx.writeBuffer();
}
