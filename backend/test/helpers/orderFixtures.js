// Raw sheet rows (all strings, like SheetRepository returns). Every field a
// mapper must NOT leak carries a SECRET marker so tests can search for it.
export const order = {
  id: '1',
  customer_id: 'SECRET_CUSTOMER_ID',
  order_name: 'SECRET Brand Polo Hijau',
  status: 'On Progress',
  created_at: '2026-07-13T10:00:00.000Z',
  notes: 'Size L dan XL',
  deadline: '2026-07-29',
  invoice_no: 'INV-SECRET-001',
  jenis_category: 'KAOS WISATA',
  order_from: 'SECRET_ORDER_FROM',
  broker: 'SECRET_BROKER',
  desain_fix_url: 'https://res.example.com/design-1.png',
  boleh_publikasi: '',
  catatan_publikasi: 'SECRET internal consent note',
};

export const items = [
  { id: '1', order_id: '1', nama_item: 'Polo', harga: '99999', qty: '', total: '', warna: 'Hijau' },
  { id: '2', order_id: '1', nama_item: 'Topi', harga: '88888', qty: '', total: '', warna: '' },
  { id: '3', order_id: '2', nama_item: 'Other order item', harga: '1', qty: '', total: '', warna: '' },
];

export const sizes = [
  { id: '1', order_item_id: '1', size: 'L', harga: '77777', qty: '30' },
  { id: '2', order_item_id: '1', size: 'XL', harga: '77777', qty: '20' },
  { id: '3', order_item_id: '2', size: 'All', harga: '66666', qty: '10' },
  { id: '4', order_item_id: '3', size: 'M', harga: '1', qty: '5' },
];

export const lembarPO = {
  id: '1',
  order_id: '1',
  sablon_bordir: 'Bordir dada kiri',
  catatan: 'Logo 5cm',
  label: 'true',
  bahan_tipe: 'Lacoste',
  pola_potong: 'Slim',
  hangtag: '',
  created_at: '2026-07-14T00:00:00.000Z',
};

export const SECRET_MARKERS = ['SECRET', '99999', '88888', '77777', '66666'];
