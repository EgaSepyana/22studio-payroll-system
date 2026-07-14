import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedLogoBuffer;

// The shop logo is stored as an SVG that just wraps a single embedded PNG
// (a raster image, not real vector paths) — PDFKit has no SVG support, but
// it renders PNG/JPEG buffers natively, so we pull the base64 payload back
// out of the <image xlink:href="data:img/png;base64,...."> tag instead of
// pulling in a whole SVG-rendering dependency.
export function loadLogoImage() {
  if (cachedLogoBuffer !== undefined) return cachedLogoBuffer;
  try {
    const svgPath = path.resolve(__dirname, '..', 'public', 'logo.svg');
    const svg = fs.readFileSync(svgPath, 'utf8');
    const match = /xlink:href="data:[a-z]+\/png;base64,([^"]+)"/.exec(svg);
    cachedLogoBuffer = match ? Buffer.from(match[1], 'base64') : null;
  } catch {
    cachedLogoBuffer = null;
  }
  return cachedLogoBuffer;
}

export function formatCurrency(n) {
  return `Rp${Number(n).toLocaleString('id-ID')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(dateStr)
  );
}

export function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
}

// DD/MM/YYYY — short numeric form used by the invoice template, distinct
// from formatDate's long "13 Juli 2026" form used elsewhere.
export function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(dateStr)
  );
}

const PDF_ROW_MIN_HEIGHT = 20;
const PDF_ROW_PADDING = 6;

// Measures how tall a row needs to be for its longest-wrapping cell, given
// the same font/column widths drawPdfRow will use — call this before
// ensurePdfSpace so the page-break check accounts for wrapped text, not just
// a flat minimum.
export function measurePdfRowHeight(doc, colWidths, values, opts = {}) {
  const fontSize = opts.fontSize || 9;
  doc.fontSize(fontSize).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
  let maxHeight = PDF_ROW_MIN_HEIGHT;
  values.forEach((v, i) => {
    const text = v === '' || v == null ? '' : String(v);
    if (!text) return;
    const height = doc.heightOfString(text, { width: colWidths[i] - 10 }) + PDF_ROW_PADDING;
    if (height > maxHeight) maxHeight = height;
  });
  return maxHeight;
}

// Draws one bordered table row (grid on all four sides of every cell, not
// just a stray line under the header) and returns the y position the next
// row should start at. Row height is measured up front (measurePdfRowHeight)
// so long text wraps onto multiple lines within its own cell instead of
// overflowing into the row below — pass the same height back in via
// opts.height, computed from measurePdfRowHeight.
export function drawPdfRow(doc, startX, colWidths, values, y, opts = {}) {
  const rowHeight = opts.height || measurePdfRowHeight(doc, colWidths, values, opts);
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

  doc.fontSize(fontSize).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
  values.forEach((v, i) => {
    const text = v === '' || v == null ? '' : String(v);
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    const textHeight = doc.heightOfString(text, { width: colWidths[i] - 10 });
    const textY = y + Math.max(PDF_ROW_PADDING / 2, (rowHeight - textHeight) / 2);
    const cellColor = Array.isArray(opts.textColor) ? opts.textColor[i] : opts.textColor || '#000';
    doc.fillColor(cellColor).text(text, x + 5, textY, {
      width: colWidths[i] - 10,
      lineBreak: true,
      align: (opts.align && opts.align[i]) || 'left',
    });
  });

  doc.fillColor('#000');
  return y + rowHeight;
}

export function ensurePdfSpace(doc, y, rowHeight, pageTop, pageBottom) {
  if (y + rowHeight > pageBottom) {
    doc.addPage();
    return pageTop;
  }
  return y;
}
