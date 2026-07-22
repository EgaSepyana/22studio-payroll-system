import { SheetRepository } from './SheetRepository.js';

export const WORK_STATUSES = ['on_progress', 'selesai', 'belum_selesai'];
export const DEFAULT_WORK_STATUS = 'selesai';

export const CASH_ADVANCE_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

export const DIVISIONS = ['Jahit', 'Sablon', 'Cutting', 'Finishing'];
export const FINISHING_DIVISION = 'Finishing';

export const PAY_SOURCES = ['worklog', 'attendance'];

export const ORDER_STATUSES = ['Desain Fix', 'On Progress', 'Done', 'Di Ambil Costumer'];
export const TASK_STATUSES = ['open', 'in_progress', 'completed'];

export const ORDER_JENIS_CATEGORIES = [
  'ATRIBUT SEKOLAH',
  'CMT (cutting-finishing)',
  'JAKET',
  'JAS ALMAMATER',
  'JERSEY',
  'KAOS',
  'KAOS POLOS',
  'KAOS SATUAN',
  'KAOS WISATA',
  'KEMEJA',
  'MAKLON BORDIR',
  'MAKLON JAHIT',
  'MAKLON SABLON',
  'PENDAPATAN LAINNYA',
  'SERAGAM SEKOLAH',
];
export const ORDER_FROM_OPTIONS = ['SHOPEE', 'TIKTOK', 'WHATSAPP', 'WORKSHOP'];

// Matches the size options offered in the Order Item Sizing UI (frontend
// OrderDetail.tsx) — used by Lembar PO's "Ukuran per Tipe" print table to
// bucket each item's sizes into fixed columns, with anything else (custom
// size names) summed into a single CUSTOM column.
export const ORDER_ITEM_FIXED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];

// The fixed set of WhatsApp follow-up templates — admin can edit each
// template's content/label, but the key itself (and the set of 7) is fixed,
// since order follow-up actions reference these keys directly.
export const WA_TEMPLATE_DEFAULTS = [
  {
    template_key: 'invoice',
    label: 'Kirim Invoice',
    content: `{SALAM}, Kak {NAMA}! Berikut detail invoice pesanan Kakak:

INVOICE ORDER {NAMA_USAHA}
------------------------------
No. Order : {NO_INVOICE}
Nama      : {NAMA}
Alamat    : {ALAMAT}
Nama Order: {ORDER}
------------------------------

{RINCIAN}

Total Invoice     : {TOTAL_BRUTO}
DP minimal 60%    : {DP_MIN}

Transfer ke salah satu rekening:
{REKENING_BANK}

{CATATAN}`,
  },
  {
    template_key: 'payment_confirmation',
    label: 'Konfirmasi Pembayaran',
    content: `TERIMA KASIH PEMBAYARANNYA — {NAMA_USAHA}

No. Order : {NO_INVOICE}
Nama      : {NAMA}
Alamat    : {ALAMAT}
Order     : {ORDER}
--------------------------
Total      : {TOTAL}
Pembayaran : {BAYAR}
Sisa       : {SISA}
Estimasi selesai: {DEADLINE}

{DP_HISTORY}

Pelunasan ke salah satu rekening:
{REKENING_BANK}

Terima kasih 🙏`,
  },
  {
    template_key: 'production_started',
    label: 'Data Diproduksi',
    content: `{SALAM}, Kak {NAMA}!

No. Invoice: {NO_INVOICE}
Order: {ORDER}

TELAH DI-ACC TANPA DP. Pesanan di-antrikan ke produksi.

Terima kasih.`,
  },
  {
    template_key: 'order_completed',
    label: 'Pesanan Selesai',
    content: `HALO KAK {NAMA}!

Pesanan {ORDER} (No. {NO_INVOICE}) SUDAH SELESAI.
Sisa pembayaran {SISA}
Bisa diambil langsung / dikirim.

Terima kasih telah order di {NAMA_USAHA}.`,
  },
  {
    template_key: 'payment_reminder',
    label: 'Kirim Tagihan',
    content: `{SALAM}, Kak {NAMA}.

Kami mengingatkan untuk sisa pembayaran pesanan:
No. Invoice: {NO_INVOICE}
Order: {ORDER}

Sisa tagihan: {SISA}

Pelunasan dapat ditransfer ke:
{REKENING_BANK}

Terima kasih.`,
  },
  {
    template_key: 'picked_up',
    label: 'Diambil Customer',
    content: `Terima kasih, {NAMA}!

Pesanan Anda:
No Invoice: {NO_INVOICE}
Nama Order: {ORDER}

Pesanan telah {DISTRIBUSI} dan diterima oleh {DITERIMA}.

Jika puas dengan pelayanan kami, mohon bantu ulasan di Google Maps:
https://maps.app.goo.gl/H6YqpBHhvhLpaxRv6`,
  },
  {
    template_key: 'qc_report',
    label: 'Laporan QC - Pesanan Selesai',
    content: `✅ *LAPORAN QC - PESANAN SELESAI*

{SALAM} Admin *22STUDIO SABLON KONVEKSI*,
Pesanan *{ORDER}* a.n. *{NAMA}* dengan No Invoice *{NO_INVOICE}* telah selesai dicek oleh tim QC.

QTY PO : *{QTY_PO}*
QTY QC : *{QTY_QC}*
Selisih : *{QTY_SELISIH}*

Status Order : *{STATUS}*`,
  },
];

export const CUSTOMER_CATEGORIES = [
  'BRAND OWNER',
  'KAOS ANAK',
  'KAOS EVENT',
  'KAOS WISATA',
  'SERAGAM KOMUNITAS',
  'SERAGAM PERUSAHAAN',
  'SERAGAM SEKOLAH',
];

export const SHEET_SCHEMAS = {
  Users: ['id', 'username', 'password', 'role', 'employee_id'],
  Employees: ['id', 'name', 'phone', 'status', 'divisi', 'hourly_rate'],
  Customers: ['id', 'name', 'pic', 'alamat', 'no_hp', 'category'],
  Articles: ['id', 'customer_id', 'article_name', 'price', 'status', 'divisi'],
  WorkLogs: [
    'id',
    'employee_id',
    'customer_id',
    'article_id',
    'work_date',
    'quantity',
    'price',
    'total',
    'notes',
    'payroll_id',
    'status',
    'task_id',
  ],
  Payroll: [
    'id',
    'employee_id',
    'month',
    'year',
    'total_salary',
    'payment_status',
    'paid_at',
    'paid_by',
    'kasbon_deduction',
    'net_salary',
    'pay_source',
    'pay_date',
  ],
  CashAdvances: [
    'id',
    'employee_id',
    'amount',
    'reason',
    'status',
    'requested_at',
    'approved_at',
    'approved_by',
    'paid_at',
    'payroll_id',
    'paid_amount',
  ],
  Attendance: ['id', 'employee_id', 'date', 'check_in', 'check_out', 'hours', 'payroll_id', 'notes'],
  Orders: [
    'id',
    'customer_id',
    'order_name',
    'status',
    'created_at',
    'notes',
    'deadline',
    'invoice_no',
    'jenis_category',
    'order_from',
    'broker',
    'desain_fix_url',
  ],
  OrderItems: ['id', 'order_id', 'nama_item', 'harga', 'qty', 'total', 'warna'],
  OrderItemSizes: ['id', 'order_item_id', 'size', 'harga', 'qty'],
  OrderDP: ['id', 'order_id', 'dp_at', 'total_dp'],
  Tasks: [
    'id',
    'order_id',
    'divisi',
    'description',
    'target_qty',
    'completed_qty',
    'assigned_to',
    'status',
    'created_at',
  ],
  SuratJalan: [
    'id',
    'no_document',
    'customer_id',
    'penerima_nama',
    'penerima_telepon',
    'penerima_alamat',
    'created_at',
  ],
  SuratJalanItems: ['id', 'surat_jalan_id', 'nama_item', 'qty'],
  LembarPO: [
    'id',
    'order_id',
    'sablon_bordir',
    'catatan',
    'label',
    'bahan_tipe',
    'pola_potong',
    'hangtag',
    'created_at',
  ],
  AppSettings: ['id', 'key', 'value'],
  WATemplates: ['id', 'template_key', 'label', 'content'],
};

export const UsersRepo = new SheetRepository('Users', SHEET_SCHEMAS.Users);
export const EmployeesRepo = new SheetRepository('Employees', SHEET_SCHEMAS.Employees);
export const CustomersRepo = new SheetRepository('Customers', SHEET_SCHEMAS.Customers);
export const ArticlesRepo = new SheetRepository('Articles', SHEET_SCHEMAS.Articles);
export const WorkLogsRepo = new SheetRepository('WorkLogs', SHEET_SCHEMAS.WorkLogs);
export const PayrollRepo = new SheetRepository('Payroll', SHEET_SCHEMAS.Payroll);
export const CashAdvancesRepo = new SheetRepository('CashAdvances', SHEET_SCHEMAS.CashAdvances);
export const AttendanceRepo = new SheetRepository('Attendance', SHEET_SCHEMAS.Attendance);
export const OrdersRepo = new SheetRepository('Orders', SHEET_SCHEMAS.Orders);
export const OrderItemsRepo = new SheetRepository('OrderItems', SHEET_SCHEMAS.OrderItems);
export const OrderItemSizesRepo = new SheetRepository('OrderItemSizes', SHEET_SCHEMAS.OrderItemSizes);
export const OrderDPRepo = new SheetRepository('OrderDP', SHEET_SCHEMAS.OrderDP);
export const TasksRepo = new SheetRepository('Tasks', SHEET_SCHEMAS.Tasks);
export const SuratJalanRepo = new SheetRepository('SuratJalan', SHEET_SCHEMAS.SuratJalan);
export const SuratJalanItemsRepo = new SheetRepository('SuratJalanItems', SHEET_SCHEMAS.SuratJalanItems);
export const LembarPORepo = new SheetRepository('LembarPO', SHEET_SCHEMAS.LembarPO);
export const AppSettingsRepo = new SheetRepository('AppSettings', SHEET_SCHEMAS.AppSettings);
export const WATemplatesRepo = new SheetRepository('WATemplates', SHEET_SCHEMAS.WATemplates);

