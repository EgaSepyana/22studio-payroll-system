import { SheetRepository } from './SheetRepository.js';

export const WORK_STATUSES = ['on_progress', 'selesai', 'belum_selesai'];
export const DEFAULT_WORK_STATUS = 'selesai';

export const CASH_ADVANCE_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

export const DIVISIONS = ['Jahit', 'Sablon', 'Cutting', 'Finishing'];
export const FINISHING_DIVISION = 'Finishing';

export const PAY_SOURCES = ['worklog', 'attendance'];

export const ORDER_STATUSES = [
  'Belum Di Proses',
  'Desain Fix',
  'On Progress',
  'Done',
  'Dikirim',
  'Di Ambil Costumer',
];
export const TASK_STATUSES = ['open', 'in_progress', 'completed'];

// Owner (Keuangan) module — the `type` values OwnerCategories rows can take.
// One flexible table (see SHEET_SCHEMAS.OwnerCategories) replaces the
// legacy app's per-module fixed-length category lists; every financial
// module's category dropdown filters this same sheet by its own type.
export const OWNER_CATEGORY_TYPES = [
  'income',
  'expense',
  'asset',
  'inventory',
  'liability',
];

// The COGS bucket a Liability's auto-synced entry falls into, driven by an
// explicit field on its category (see SHEET_SCHEMAS.OwnerCategories'
// cogs_bucket column) instead of owner.md §4.7's fragile match against the
// literal category names "Supplier debt"/"Labor wages" — same fix pattern as
// is_sales_category for Income.
export const OWNER_COGS_BUCKETS = ['fabric_purchase', 'production_cost', 'generic'];

// Fixed divisi -> production sub-stage label, used to build the "Proses
// <label> Selesai" timeline note when a division's task completes.
export const DIVISI_SUBSTAGE_LABELS = {
  Jahit: 'Sewing',
  Sablon: 'Printing',
  Cutting: 'Cutting',
  Finishing: 'QC',
};

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

// Landing-page CMS (content.js) — the public site's icon/color vocabulary is
// fixed by its own CSS/icon set, so these are validated server-side rather
// than left as free text an admin could typo into a broken reference.
export const CMS_SERVICE_ICONS = ['shirt', 'spray-can', 'scissors', 'palette', 'package'];
export const CMS_CSS_VARS = ['--primary', '--accent', '--secondary', '--accent-2'];
export const CMS_INK_CSS_VARS = [...CMS_CSS_VARS, '--ink'];

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
  {
    template_key: 'design_confirmation',
    label: 'Konfirmasi Design',
    content: `{SALAM} Kak {NAMA} 👋

**Anda memiliki Tracking Order Link** untuk pesanan dengan **No. Invoice {NO_INVOICE}**.

Silakan buka link berikut untuk melihat status pesanan dan melakukan konfirmasi desain:

🔗 {LINK_TRACKING}

Jika desain sudah sesuai, mohon lakukan konfirmasi melalui halaman tersebut agar pesanan dapat segera diproses.

Terima kasih 🙏`,
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
  Employees: ['id', 'name', 'phone', 'status', 'divisi', 'hourly_rate', 'upah_lembur_per_jam'],
  Customers: ['id', 'name', 'pic', 'alamat', 'no_hp', 'category'],
  Articles: ['id', 'category_id', 'article_name', 'price', 'status', 'divisi'],
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
    // Appended at the end, not inserted mid-schema — see the OrderDP
    // comment above for why. account_id is the cash account the salary was
    // paid from; expense_id links to the OwnerExpense row this payment
    // auto-created (Gaji Karyawan). Rows paid before this Owner integration
    // existed have neither — nothing to reconcile since a paid Payroll row
    // is already immutable (workLogService/payrollService both refuse to
    // touch a worklog/payroll once paid), so there's no edit-sync concern
    // here the way there is for OrderDP.
    'account_id',
    'expense_id',
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
  // 'category'/'account_id'/'income_id' appended at the end, not inserted
  // mid-schema, so existing rows already in the sheet don't have every
  // later column silently shift by one (see SheetRepository.rowToObject —
  // columns are read by index). Existing rows have no value in these
  // columns; the service layer treats a missing category as 'dp' (every
  // entry before that change was a down payment) and a missing
  // account_id/income_id as "not linked to a cash account/Owner Income
  // entry" (rows written before this Owner integration existed).
  // income_id links to the OwnerIncome row this payment auto-created, kept
  // in sync on edit/delete — the one exception to "payments are
  // independent rows" this table has, mirroring OwnerLiabilityPayments'
  // reversal-on-delete pattern for the same reason (two ledgers, one
  // source of truth).
  OrderDP: ['id', 'order_id', 'dp_at', 'total_dp', 'category', 'account_id', 'income_id'],
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
  OrderTimeline: ['id', 'order_id', 'stage', 'sub_stage', 'note', 'actor', 'created_at'],
  OrderShipping: ['id', 'order_id', 'method', 'resi', 'note', 'shipped_at'],
  ArticlesCategory: ['id', 'name'],
  CustomerArticles: ['id', 'category_id', 'customer_id', 'created_at'],
  ShortLink: ['id', 'code', 'original_url', 'created_at'],
  NavLinks: ['id', 'href', 'label', 'sort_order'],
  InkSwatches: ['id', 'code', 'name', 'css_var', 'sort_order'],
  HeroStats: ['id', 'label', 'value', 'sort_order'],
  HeroSlides: ['id', 'image_url', 'alt', 'sort_order'],
  Clients: ['id', 'name', 'logo_url', 'sort_order'],
  CmsServices: ['id', 'icon', 'css_var', 'title', 'description', 'points', 'sort_order'],
  CmsProjects: ['id', 'title', 'description', 'image_url', 'sort_order'],
  CmsSteps: ['id', 'stage', 'title', 'description', 'sort_order'],
  StatsBand: ['id', 'value', 'prefix', 'suffix', 'label', 'sort_order'],
  Faqs: ['id', 'question', 'answer', 'sort_order'],

  // Owner (Keuangan) module — master data feeding every financial module's
  // dropdowns. One flexible table per concern instead of the legacy app's
  // fixed-length column-range lists (see owner.md §6.10/§9) — `type`
  // distinguishes which module/purpose a row belongs to (e.g. 'income',
  // 'expense', 'asset', 'inventory', 'liability'), `is_active` lets an entry
  // be retired without deleting it out from under historical records that
  // still reference it by name.
  // `is_sales_category` only means something for type 'income' rows — an
  // explicit flag instead of owner.md §4.2's fragile client-side string
  // match against literal category names ("PENJUALAN"/"PENDAPATAN LAINNYA")
  // for the Income page's sales-vs-other summary split.
  // `cogs_bucket` only means something for type 'liability' rows — see
  // OWNER_COGS_BUCKETS.
  OwnerCategories: ['id', 'type', 'name', 'is_active', 'is_sales_category', 'cogs_bucket', 'created_at'],
  OwnerLocations: ['id', 'name', 'is_active', 'created_at'],

  // Cash accounts (kas/bank) — referenced by nearly every money-moving Owner
  // module (owner.md §5's `cash_accounts`). Balance is never stored here;
  // it's always derived from the ledger (transfers/reconciliations now,
  // income/expenses once those modules exist).
  OwnerCashAccounts: ['id', 'name', 'is_active', 'created_at'],
  // Mutasi Kas: moves value between two of the business's own accounts —
  // net zero on total cash, but shifts each account's derived balance.
  OwnerCashTransfers: [
    'id',
    'date',
    'from_account_id',
    'to_account_id',
    'amount',
    'description',
    'created_at',
  ],
  // Penyesuaian Kas: reconciles the ledger-derived "system" balance against a
  // physically-counted "actual" balance. system_balance/difference/status are
  // computed server-side at save time (owner.md §4.4's explicit correctness
  // fix over the original) and stored as a snapshot for history, not
  // recomputed live on every read.
  OwnerCashReconciliations: [
    'id',
    'date',
    'account_id',
    'system_balance',
    'actual_balance',
    'difference',
    'status',
    'description',
    'created_at',
  ],

  // Pemasukan (owner.md §4.2) — miscellaneous income not otherwise captured
  // by the inventory-sale flow. Increases its account_id's derived balance.
  OwnerIncome: ['id', 'date', 'category_id', 'account_id', 'description', 'amount', 'created_at'],
  // Pengeluaran (owner.md §4.3) — order_id is optional; when set, this
  // expense counts against that order's per-invoice profitability estimate.
  // Decreases its account_id's derived balance.
  OwnerExpenses: ['id', 'date', 'category_id', 'account_id', 'order_id', 'description', 'amount', 'created_at'],

  // Kewajiban (owner.md §4.7) — money the business owes. amount_paid/status
  // are maintained here as a materialized running total (owner.md's own
  // "keep a materialized current-balance table" note in §3), kept in sync by
  // every LiabilityPayments write rather than re-summed on every read.
  OwnerLiabilities: [
    'id',
    'code',
    'date',
    'due_date',
    'creditor_name',
    'creditor_address',
    'category_id',
    'qty',
    'unit_price',
    'value',
    'amount_paid',
    'status',
    'description',
    'cogs_entry_id',
    'created_at',
    'updated_at',
    // 'manual' (Kewajiban page — a real incurred cost, syncs a COGS entry)
    // or 'funding' (auto-created by Asset/Inventory's Payable funding
    // source — the cost isn't recognized yet since the purchased goods
    // still sit as an unconsumed asset; no COGS entry until they're later
    // sold/consumed). Determines whether create/edit sync a COGS entry.
    // Appended at the end, not inserted mid-schema, so any existing sheet
    // rows don't have every later column silently shift by one.
    'source',
  ],
  // Deleting a row here must reverse its parent liability's
  // amount_paid/status — the one exception to "ledgers are append-only" this
  // module has (owner.md §4.7's explicit "proper compensating transaction").
  OwnerLiabilityPayments: [
    'id',
    'liability_id',
    'date',
    'amount',
    'account_id',
    'description',
    'created_at',
  ],
  // Auto-synced 1:1 with a Liability (owner.md §6.7) — created alongside it,
  // recalculated on edit, deleted with it. Feeds the future Laba Rugi P&L's
  // COGS section; never written to directly by any UI.
  OwnerCogsEntries: [
    'id',
    'source',
    'source_ref',
    'date',
    'bucket',
    'amount',
    'description',
    'created_at',
    'updated_at',
  ],

  // Modal (owner.md §5 capital_entries) — created whenever an Asset or
  // Inventory purchase is funded by "Capital" instead of Cash/Payable.
  // asset_or_stock_ref + ref_type point back at whichever ledger row it
  // funded, for traceability only — never read to compute a balance.
  OwnerCapitalEntries: [
    'id',
    'code',
    'date',
    'source_name',
    'description',
    'amount',
    'entry_type',
    'ref_type',
    'ref_id',
    'created_at',
  ],

  // Aset (owner.md §4.5) — ledger model only, per the plan's explicit
  // decision: identity/master record here, purchases/sales as
  // OwnerFixedAssetTransactions rows; current qty/value = sum of those rows.
  // Depreciation is out of scope for this phase (owner.md itself calls it
  // out as a separate feature, not part of this ledger).
  OwnerFixedAssets: ['id', 'code', 'date', 'name', 'category_id', 'location_id', 'description', 'created_at'],
  OwnerFixedAssetTransactions: [
    'id',
    'asset_id',
    'date',
    'type', // opening | purchase | sale
    'qty',
    'unit_price',
    'total_value',
    'funding_source', // cash | payable | capital — purchase only
    'account_id',
    'liability_id',
    'capital_entry_id',
    'description',
    'created_at',
  ],

  // Stok Persediaan (owner.md §4.6) — same ledger shape as Fixed Assets,
  // plus exit_type/sale_method for stock_out and linked_transaction_id for
  // production conversions (raw material -> finished goods, one atomic op
  // writing two linked rows).
  OwnerInventoryItems: [
    'id',
    'code',
    'date',
    'name',
    'category_id',
    'location_id',
    'item_type', // raw_material | finished_good
    'description',
    'created_at',
  ],
  OwnerInventoryTransactions: [
    'id',
    'item_id',
    'date',
    'type', // opening | stock_in | stock_out
    'qty',
    'unit_price',
    'total_value',
    'funding_source', // cash | payable | capital — opening/stock_in only
    'account_id',
    'liability_id',
    'capital_entry_id',
    'exit_type', // production | sold | damaged — stock_out only
    'sale_method', // cash | credit — exit_type sold only
    'linked_transaction_id',
    'description',
    'created_at',
  ],
  // Piutang (owner.md §5 receivables) — created when finished goods are sold
  // on credit (exit_type sold, sale_method credit) instead of posting to
  // Income immediately.
  OwnerReceivables: [
    'id',
    'date',
    'source', // always 'inventory_sale' for now
    'source_ref',
    'amount',
    'description',
    'created_at',
  ],
  // Penyesuaian Ekuitas (owner.md §5 equity_adjustments) — created when
  // stock is marked damaged/lost (a direct equity write-down, not a normal
  // expense — owner.md's explicit distinction).
  OwnerEquityAdjustments: [
    'id',
    'date',
    'account', // always 'retained_earnings' for now
    'amount', // signed; negative for a write-down
    'source_ref',
    'description',
    'created_at',
  ],
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
export const OrderTimelineRepo = new SheetRepository('OrderTimeline', SHEET_SCHEMAS.OrderTimeline);
export const OrderShippingRepo = new SheetRepository('OrderShipping', SHEET_SCHEMAS.OrderShipping);
export const ArticlesCategoryRepo = new SheetRepository('ArticlesCategory', SHEET_SCHEMAS.ArticlesCategory);
export const CustomerArticlesRepo = new SheetRepository('CustomerArticles', SHEET_SCHEMAS.CustomerArticles);
export const ShortLinkRepo = new SheetRepository('ShortLink', SHEET_SCHEMAS.ShortLink);
export const NavLinksRepo = new SheetRepository('NavLinks', SHEET_SCHEMAS.NavLinks);
export const InkSwatchesRepo = new SheetRepository('InkSwatches', SHEET_SCHEMAS.InkSwatches);
export const HeroStatsRepo = new SheetRepository('HeroStats', SHEET_SCHEMAS.HeroStats);
export const HeroSlidesRepo = new SheetRepository('HeroSlides', SHEET_SCHEMAS.HeroSlides);
export const ClientsRepo = new SheetRepository('Clients', SHEET_SCHEMAS.Clients);
export const CmsServicesRepo = new SheetRepository('CmsServices', SHEET_SCHEMAS.CmsServices);
export const CmsProjectsRepo = new SheetRepository('CmsProjects', SHEET_SCHEMAS.CmsProjects);
export const CmsStepsRepo = new SheetRepository('CmsSteps', SHEET_SCHEMAS.CmsSteps);
export const StatsBandRepo = new SheetRepository('StatsBand', SHEET_SCHEMAS.StatsBand);
export const FaqsRepo = new SheetRepository('Faqs', SHEET_SCHEMAS.Faqs);
export const OwnerCategoriesRepo = new SheetRepository('OwnerCategories', SHEET_SCHEMAS.OwnerCategories);
export const OwnerLocationsRepo = new SheetRepository('OwnerLocations', SHEET_SCHEMAS.OwnerLocations);
export const OwnerCashAccountsRepo = new SheetRepository('OwnerCashAccounts', SHEET_SCHEMAS.OwnerCashAccounts);
export const OwnerCashTransfersRepo = new SheetRepository('OwnerCashTransfers', SHEET_SCHEMAS.OwnerCashTransfers);
export const OwnerCashReconciliationsRepo = new SheetRepository(
  'OwnerCashReconciliations',
  SHEET_SCHEMAS.OwnerCashReconciliations
);
export const OwnerIncomeRepo = new SheetRepository('OwnerIncome', SHEET_SCHEMAS.OwnerIncome);
export const OwnerExpensesRepo = new SheetRepository('OwnerExpenses', SHEET_SCHEMAS.OwnerExpenses);
export const OwnerLiabilitiesRepo = new SheetRepository('OwnerLiabilities', SHEET_SCHEMAS.OwnerLiabilities);
export const OwnerLiabilityPaymentsRepo = new SheetRepository(
  'OwnerLiabilityPayments',
  SHEET_SCHEMAS.OwnerLiabilityPayments
);
export const OwnerCogsEntriesRepo = new SheetRepository('OwnerCogsEntries', SHEET_SCHEMAS.OwnerCogsEntries);
export const OwnerCapitalEntriesRepo = new SheetRepository('OwnerCapitalEntries', SHEET_SCHEMAS.OwnerCapitalEntries);
export const OwnerFixedAssetsRepo = new SheetRepository('OwnerFixedAssets', SHEET_SCHEMAS.OwnerFixedAssets);
export const OwnerFixedAssetTransactionsRepo = new SheetRepository(
  'OwnerFixedAssetTransactions',
  SHEET_SCHEMAS.OwnerFixedAssetTransactions
);
export const OwnerInventoryItemsRepo = new SheetRepository('OwnerInventoryItems', SHEET_SCHEMAS.OwnerInventoryItems);
export const OwnerInventoryTransactionsRepo = new SheetRepository(
  'OwnerInventoryTransactions',
  SHEET_SCHEMAS.OwnerInventoryTransactions
);
export const OwnerReceivablesRepo = new SheetRepository('OwnerReceivables', SHEET_SCHEMAS.OwnerReceivables);
export const OwnerEquityAdjustmentsRepo = new SheetRepository(
  'OwnerEquityAdjustments',
  SHEET_SCHEMAS.OwnerEquityAdjustments
);

// Seed data for the landing-page CMS — the exact current values from the
// external site's content.js, so the sheets start already representing the
// real live site instead of empty. sort_order uses gaps of 10 so an admin
// can later insert an item between two existing ones without renumbering.
export const CMS_SEED_DATA = {
  general: {
    cms_wa_phone: '6281312322833',
    cms_wa_default_message: 'sablon konveksi bandung?',
    cms_form_endpoint:
      'https://script.google.com/macros/s/AKfycbzs2uCsuGLBFdVgsnNo-iqBxvjRAOW1lqTTAm0jk1nwLSiW_5VBLd9IIicy-x_CEYWy/exec',
  },
  foundersPromise: {
    cms_founder_quote:
      'Setiap kaos yang keluar dari workshop kami melewati pemeriksaan kualitas yang ketat. Kami tidak sekadar menyablon — kami mengerjakan cutting, sablon, jahit, QC, hingga finishing di bawah satu atap, supaya kualitasnya konsisten dari pcs pertama sampai terakhir. Itu janji kami ke setiap klien, kecil atau besar.',
    cms_founder_name: 'Tino',
    cms_founder_role: 'Founder, 22Studio',
  },
  contactInfo: {
    cms_contact_address:
      'Jl. Cimerang No.14, RT.03/RW.05, Cimerang, Kec. Padalarang, Kabupaten Bandung Barat, Jawa Barat 40553',
    cms_contact_phone: '+62 813 1232 2833',
    cms_contact_email: '22Studio.tino@gmail.com',
    cms_contact_hours: 'Senin–Jumat: 09.00–18.00\nSabtu: 10.00–16.00',
    cms_contact_map_embed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.1439687836223!2d107.4875514745986!3d-6.873347767250977!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e5445d090367%3A0xb859f3fd6ee9bba4!2s22Studio%20Sablon%20konveksi%20bandung!5e0!3m2!1sid!2sid!4v1746873374947!5m2!1sid!2sid',
  },
  navLinks: [
    { href: '#about', label: 'Tentang' },
    { href: '#services', label: 'Layanan' },
    { href: '#projects', label: 'Projek' },
    { href: '#how-to-start', label: 'Cara Order' },
    { href: '#contact', label: 'Kontak' },
  ],
  inkSwatches: [
    { code: 'INK.01', name: 'Biru Logo', css_var: '--primary' },
    { code: 'INK.02', name: 'Ochre', css_var: '--accent' },
    { code: 'INK.03', name: 'Teal', css_var: '--secondary' },
    { code: 'INK.04', name: 'Orange', css_var: '--accent-2' },
    { code: 'INK.05', name: 'Ink Black', css_var: '--ink' },
  ],
  heroStats: [
    { label: 'Berdiri Sejak', value: '2015' },
    { label: 'Lini Produksi', value: '3' },
    { label: 'Proses In-House', value: '100%' },
  ],
  heroSlides: [
    { image_url: 'gambar2.jpg', alt: 'Hasil sablon kaos custom 22Studio' },
    { image_url: 'gambar3.jpg', alt: 'Proses produksi konveksi 22Studio' },
    { image_url: 'gambar4.jpg', alt: 'Kaos custom siap kirim' },
    { image_url: 'gambar5.jpg', alt: 'Detail sablon berkualitas premium' },
    { image_url: 'jumbotron.jpg', alt: 'Workshop 22Studio Bandung' },
  ],
  clients: [
    {
      name: 'Persib Bandung',
      logo_url:
        'https://upload.wikimedia.org/wikipedia/min/thumb/d/db/Persib_Bandung.svg/1200px-Persib_Bandung.svg.png',
    },
    { name: 'Lacoste', logo_url: 'https://brandlogos.net/wp-content/uploads/2021/05/lacoste-crocodiles-logo.png' },
    { name: 'Nike', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg' },
    { name: 'Adidas', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg' },
    {
      name: 'TNI',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/4/48/Insignia_of_the_Indonesian_National_Armed_Forces.svg',
    },
    {
      name: 'Pertamina',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Pertamina_Logo.svg/1200px-Pertamina_Logo.svg.png',
    },
  ],
  services: [
    {
      icon: 'shirt',
      css_var: '--primary',
      title: 'Screen Printing',
      description:
        'Sablon tradisional untuk desain yang cerah dan tahan lama. Sempurna untuk pesanan massal dengan desain sederhana hingga rumit.',
      points: ['Terbaik untuk pesanan 25+', 'Warna-warna cerah', 'Cetakan tahan lama'],
    },
    {
      icon: 'spray-can',
      css_var: '--accent',
      title: 'DTF Printing',
      description:
        'Pencetakan langsung pada pakaian untuk desain yang realistis. Ideal untuk pesanan kecil atau desain dengan banyak warna.',
      points: ['Cocok untuk 1–24 buah', 'Tidak ada batasan warna', 'Hasil raba lembut'],
    },
    {
      icon: 'scissors',
      css_var: '--secondary',
      title: 'Embroidery',
      description:
        'Layanan bordir premium untuk tampilan profesional dan mewah. Sempurna untuk logo dan teks pada polo dan topi.',
      points: ['Tampilan profesional', 'Tahan lama', 'Cocok untuk pakaian kerja'],
    },
    {
      icon: 'palette',
      css_var: '--accent-2',
      title: 'Custom Design',
      description:
        'Desainer berbakat kami akan bekerja sama dengan Anda untuk menciptakan karya seni yang sempurna untuk pakaian khusus Anda.',
      points: ['Desainer profesional', 'Revisi tanpa batas', 'Perputaran cepat'],
    },
    {
      icon: 'shirt',
      css_var: '--primary',
      title: 'Sublimation',
      description: 'Cetakan penuh warna untuk pakaian performa dan pakaian berwarna terang.',
      points: ['Cetakan menyeluruh yang cerah', 'Tidak ada retak atau terkelupas', 'Bagus untuk tim olahraga'],
    },
    {
      icon: 'package',
      css_var: '--accent',
      title: 'Private Label',
      description: 'Ciptakan lini pakaian Anda sendiri dengan label, tag, dan kemasan khusus.',
      points: ['Pencitraan merek khusus', 'Layanan label putih', 'Diskon massal'],
    },
  ],
  projects: [
    {
      title: 'Merchandise Band Musik',
      description: 'Kaos tur sablon untuk band rock indie',
      image_url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=776&q=80',
    },
    {
      title: 'Seragam Perusahaan',
      description: 'Polo bordir khusus untuk perusahaan teknologi',
      image_url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=774&q=80',
    },
    {
      title: 'Jersey Tim Olahraga',
      description: 'Jersey basket sublimasi untuk liga lokal',
      image_url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=776&q=80',
    },
    {
      title: 'Kaos Charity',
      description: 'Kaos cetak DTG untuk penggalangan dana lari 5K',
      image_url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=774&q=80',
    },
    {
      title: 'Streetwear Collection',
      description: 'Kaos grafis edisi terbatas untuk merek lokal',
      image_url: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=776&q=80',
    },
    {
      title: 'Pakaian Sekolah',
      description: 'Hoodie sablon untuk sekolah menengah',
      image_url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=774&q=80',
    },
  ],
  steps: [
    {
      stage: '01',
      title: 'Konsultasi',
      description:
        'Hubungi kami untuk mendiskusikan proyek Anda. Kami akan menanyakan tentang jumlah, desain, warna, preferensi kain, dan jadwal pengerjaan.',
    },
    {
      stage: '02',
      title: 'Design',
      description:
        'Kirimkan karya seni atau pekerjaan Anda kepada desainer kami. Kami akan memberikan contoh dan rekomendasi untuk metode pencetakan terbaik.',
    },
    {
      stage: '03',
      title: 'Persetujuan',
      description: 'Tinjau dan setujui rancangan akhir. Kami akan memberikan penawaran harga terperinci dan jadwal produksi.',
    },
    {
      stage: '04',
      title: 'Produksi',
      description: 'Kami mencetak kaos Anda dengan hati-hati dan teliti. Pemeriksaan kualitas dilakukan di setiap tahap.',
    },
    {
      stage: '05',
      title: 'Pengiriman',
      description:
        'Kemeja kustom Anda dikemas dengan hati-hati dan dikirim ke depan pintu Anda atau siap diambil.',
    },
  ],
  statsBand: [
    { value: '2015', prefix: '', suffix: '', label: 'Tahun Berdiri' },
    { value: '3', prefix: '', suffix: '', label: 'Lini Produksi Aktif' },
    { value: '100', prefix: '', suffix: '%', label: 'Proses In-House' },
    { value: '10', prefix: '', suffix: 'th+', label: 'Pengalaman Produksi' },
  ],
  faqs: [
    {
      question: 'Apa saja jenis produk yang bisa kami pesan di tempat Anda?',
      answer:
        'Kami melayani berbagai kebutuhan sablon dan konveksi seperti kaos, hoodie, jaket, polo shirt, tote bag, seragam kerja, hingga merchandise custom.',
    },
    {
      question: 'Apakah bisa custom desain sendiri?',
      answer:
        'Tentu! Anda bisa mengirim desain sendiri dalam format PNG, AI, atau PDF. Kami juga menyediakan layanan desain jika Anda belum punya desain.',
    },
    {
      question: 'Minimal pemesanan berapa pcs?',
      answer:
        'Minimal order untuk konveksi adalah 12 pcs. Untuk sablon custom satuan bisa kami layani tergantung desain dan media yang digunakan.',
    },
    {
      question: 'Apa saja jenis sablon yang tersedia?',
      answer: 'Kami menyediakan berbagai teknik sablon seperti sablon plastisol, rubber, polyflex, dan DTF (Direct to Film).',
    },
    {
      question: 'Berapa lama proses produksinya?',
      answer:
        'Waktu produksi tergantung jumlah pesanan dan kompleksitas desain. Rata-rata 5–14 hari kerja setelah desain disetujui dan DP dibayar.',
    },
    {
      question: 'Apakah bisa order express?',
      answer:
        'Bisa, kami menyediakan layanan express dengan waktu pengerjaan 1–3 hari tergantung ketersediaan bahan dan workload. Biaya tambahan berlaku.',
    },
    {
      question: 'Bagaimana cara pemesanan?',
      answer:
        'Anda bisa memesan melalui WhatsApp, form order di website, atau datang langsung ke workshop kami. Jangan lupa sertakan detail produk dan desain.',
    },
    {
      question: 'Apakah tersedia katalog bahan dan warna?',
      answer: 'Ya, kami memiliki katalog bahan dan warna yang bisa dilihat langsung di workshop kami.',
    },
    {
      question: 'Apakah bisa kirim ke luar kota atau luar negeri?',
      answer: 'Tentu, kami melayani pengiriman ke seluruh Indonesia via JNE, J&T, Sicepat, atau ekspedisi pilihan Anda.',
    },
    {
      question: 'Bagaimana sistem pembayarannya?',
      answer:
        'Pembayaran dilakukan dengan DP minimal 50% di awal, dan pelunasan saat produk siap kirim. Kami menerima transfer bank dan QRIS.',
    },
  ],
};

