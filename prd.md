# 22Studio Payroll & Production Management System

> Product Requirement Document (PRD) — v2

Sistem manajemen produksi dan penggajian karyawan untuk **22Studio Konveksi & Sablon**, mencakup pengelolaan Order, Task per divisi, penggajian (piece-rate maupun hourly), kasbon, dan dokumen produksi (Lembar PO, Surat Jalan).

---

# Overview

22Studio Payroll & Production Management System adalah aplikasi internal yang awalnya dibangun sebagai sistem payroll piece-rate sederhana, dan telah berkembang menjadi sistem manajemen produksi end-to-end: mulai dari Order masuk, dipecah menjadi Task per divisi, dikerjakan dan dicatat oleh karyawan, hingga dibayar sebagai payroll dan dikirim ke customer lewat Surat Jalan.

Sistem ini mendukung **dua model penggajian sekaligus**, tergantung divisi karyawan:

* **Piece-rate** (Jahit, Sablon, Cutting) — gaji dihitung dari `Harga Artikel × Quantity` per pekerjaan yang dicatat lewat Data Pekerjaan (Work Log).
* **Hourly** (Finishing) — gaji dihitung dari `Jam Kerja × Tarif per Jam`, berdasarkan absensi check-in/check-out. Divisi Finishing tidak mencatat Data Pekerjaan sama sekali.

Contoh piece-rate:

| Customer  | Artikel           | Harga   | Qty | Total     |
| --------- | ----------------- | ------- | --- | --------- |
| Sugarship | Fullprint 3 Warna | Rp3.500 | 170 | Rp595.000 |

```
Total = Harga × Quantity
```

Contoh hourly (Finishing):

```
Total = Jam Kerja × Tarif per Jam
```

Kedua model kini dihitung **harian** (bukan hanya akumulasi bulanan) — setiap hari kerja yang belum dibayar disimpan sebagai baris payroll terpisah, sehingga admin bisa membayar per hari maupun per rentang tanggal.

---

# Goals

* Mempermudah admin mengelola alur Order dari masuk hingga terkirim (Order → Task per divisi → produksi → Surat Jalan).
* Mempermudah karyawan mencatat hasil pekerjaan (piece-rate) atau kehadiran (Finishing).
* Menghitung gaji secara otomatis untuk kedua model pembayaran, termasuk potongan kasbon.
* Mengurangi kesalahan perhitungan manual dan mencegah race condition pada progress task/penggajian.
* Menyediakan dokumen produksi tercetak (Lembar PO, Surat Jalan, Invoice Order, Slip Gaji) dan laporan (harian–tahunan, per customer/artikel/karyawan).
* Memberi visibilitas jadwal produksi (deadline & tanggal mulai order) lewat kalender.
* Mengetahui status pembayaran gaji dan status pelunasan kasbon setiap karyawan.

---

# Target Users

## Admin

Mengelola seluruh data pada sistem: master data, alur produksi (Order/Task), penggajian, kasbon, dan dokumen.

Hak akses:

* Mengelola karyawan (termasuk divisi & tarif per jam untuk Finishing)
* Mengelola customer, artikel
* Mengelola Order (termasuk rincian item & breakdown ukuran, upload desain)
* Mengelola Task per divisi untuk tiap Order
* Melihat seluruh pekerjaan (Data Pekerjaan) dan absensi
* Mengelola Kalender Produksi
* Mengelola Lembar PO (instruksi produksi per Order)
* Mengelola Surat Jalan (pengiriman ke customer)
* Menghitung & membayar payroll (per hari maupun per rentang tanggal), termasuk potongan kasbon parsial
* Menyetujui/menolak pengajuan kasbon karyawan
* Melihat & mengekspor laporan (PDF/Excel)

---

## Employee

Pengalaman aplikasi karyawan **berbeda tergantung divisi**:

### Karyawan Piece-rate (Jahit / Sablon / Cutting)

* Login, ganti password
* Melihat Tugas (Task) divisinya
* Menginput Pekerjaan (Data Pekerjaan) — pilih Task, Artikel, Quantity; harga otomatis dari Artikel
* Melihat Riwayat Pekerjaan
* Melihat Riwayat Gaji
* Mengajukan & melihat riwayat Kasbon
* Mengubah profil

### Karyawan Finishing

* Login, ganti password
* Absensi — check-in / check-out harian (bukan input pekerjaan)
* Melihat Tugas divisinya, dan **update progress Task langsung** (tanpa mencatat artikel/harga — tidak memengaruhi payroll, karena Finishing dibayar dari jam kerja)
* Membuat & mengelola Surat Jalan (divisi Finishing adalah pihak yang mengirim barang jadi ke customer)
* Melihat Riwayat Gaji
* Mengajukan & melihat riwayat Kasbon
* Mengubah profil

---

# High Level Concept

```
                         Admin
                           │
              Kelola Customer / Artikel
                           │
                    Admin Buat Order
                           │
         Order dipecah jadi Task per Divisi
                           │
                           ▼
              ┌────────────┴────────────┐
              │                         │
     Divisi Piece-rate            Divisi Finishing
   (Jahit/Sablon/Cutting)             │
              │                  Absen Check-in/out
     Input Data Pekerjaan              │
   (Artikel × Qty = Total)     Update Progress Task
              │                  (tanpa Data Pekerjaan)
              └────────────┬────────────┘
                           │
                Task/Order Status Otomatis
             (progress qty vs target qty)
                           │
                           ▼
              Payroll Harian Otomatis
        (Piece-rate: dari Data Pekerjaan)
         (Finishing: dari Jam × Tarif)
                           │
                Potong Kasbon (jika ada,
              bisa dicicil/parsial)
                           │
                           ▼
            Admin Tandai Sudah Dibayar
                           │
                           ▼
        Finishing Buat Surat Jalan → Barang Terkirim
```

---

# Business Flow

## 1. Master Data

Admin membuat **Customer** (nama, PIC, alamat, no HP, kategori) dan **Artikel** (nama, harga per pcs, divisi, terkait customer). `terakhir_order` dan `order_terakhir` pada Customer dihitung otomatis dari data Order, tidak diinput manual.

## 2. Order Masuk

Admin membuat **Order**: nama order, customer, deadline, jenis kategori, sumber order (Shopee/TikTok/WhatsApp/Workshop), broker, dan upload gambar desain fix (disimpan di Cloudinary).

Setiap Order memiliki **Rincian Item** (nama item + warna), dan tiap item memiliki breakdown **ukuran** (XS/S/M/L/XL/XXL/3XL/4XL/5XL/6XL, atau ukuran custom) dengan harga & qty masing-masing. Total harga/qty item selalu dihitung dari breakdown ukuran ini, bukan disimpan terpisah.

## 3. Order Dipecah Menjadi Task

Admin membuat satu atau beberapa **Task** untuk Order tersebut, satu Task per divisi (Jahit/Sablon/Cutting/Finishing), masing-masing dengan target quantity sendiri.

## 4a. Karyawan Piece-rate Mencatat Pekerjaan

Karyawan memilih Task miliknya, lalu mengisi Data Pekerjaan:

* Tanggal, Task, Artikel, Quantity, Keterangan

Harga otomatis dari data Artikel. Total = Harga × Quantity. Progress Task (`completed_qty`) bertambah otomatis dan status Task (open → in_progress → completed) mengikuti perbandingan progress terhadap target — dihitung ulang secara atomik agar tidak ada progress yang hilang jika dua karyawan mencatat pekerjaan bersamaan.

## 4b. Karyawan Finishing Absen & Update Progress

Karyawan Finishing check-in/check-out setiap hari kerja (jam dibulatkan ke jam terdekat). Untuk progress Task, karyawan Finishing memakai form **Update Progress** yang hanya berisi quantity — tanpa artikel/harga, dan tidak membuat Data Pekerjaan sama sekali (progress Finishing tidak pernah memengaruhi payroll; payroll Finishing murni dari jam kerja).

## 5. Status Order Otomatis

Status Order mengikuti progres Task-nya: **Desain Fix** (belum ada Task berjalan) → **On Progress** (≥1 Task berjalan) → **Done** (semua Task selesai). Status **Di Ambil Costumer** bersifat manual dan permanen — tidak pernah ditimpa otomatis begitu di-set.

## 6. Payroll Harian

Payroll dihitung **per hari**, bukan hanya akumulasi bulanan — setiap hari kerja yang belum dibayar tersimpan sebagai baris tersendiri, bisa dilihat per bulan atau per rentang tanggal bebas.

* Piece-rate: dijumlahkan dari total Data Pekerjaan pada hari itu.
* Finishing: `Jam Kerja hari itu × Tarif per Jam`.

## 7. Potongan Kasbon (bisa dicicil)

Jika karyawan punya kasbon disetujui yang belum lunas, saat admin menandai payroll sudah dibayar, jumlah kasbon yang dipotong **default penuh** tapi bisa dikurangi (dicicil) oleh admin. Kasbon yang baru terpotong sebagian tetap berstatus "approved" dengan sisa saldo, dan sisanya otomatis masuk ke perhitungan payroll berikutnya. Payroll rentang tanggal (bulk) selalu memotong penuh.

## 8. Pembayaran

Admin menekan **Tandai Sudah Dibayar**. Sistem menyimpan status, tanggal pembayaran, admin yang membayar, dan (jika ada) baris kasbon yang ikut terpotong/lunas. Tidak ada proses approval berlapis.

## 9. Dokumen Produksi & Pengiriman

* **Lembar PO** — dicetak per Order, berisi instruksi produksi (Sablon/Bordir, Bahan & Tipe, Pola Potong, checkbox Label & Hangtag), foto desain, dan tabel breakdown ukuran — otomatis muat dalam 1 halaman.
* **Surat Jalan** — dibuat saat barang jadi dikirim ke customer (nama & kontak penerima + daftar barang). Bisa dibuat oleh admin maupun karyawan divisi Finishing.
* **Invoice Order** — nomor invoice (`INV-YYYYMMDD-NNN`) dibuat sekali saat pertama dicetak dan tidak berubah walau dicetak ulang.

## 10. Kalender Produksi

Admin dapat melihat kalender bulanan berisi tanggal mulai dan deadline seluruh Order; klik salah satu event membuka detail Order terkait.

---

# Features

## Authentication (Admin & Employee)

* Login, Logout, Ganti Password

---

# Admin Features

## Dashboard

* Total Karyawan, Total Customer, Total Artikel
* Total Pekerjaan Hari Ini, Total Pendapatan Hari Ini
* Total Payroll Bulan Ini
* Aktivitas terbaru, Top produktivitas karyawan, Grafik pekerjaan bulanan

## Master Data

* **Karyawan** — CRUD; termasuk divisi dan tarif per jam (untuk Finishing)
* **Customer** — CRUD; termasuk PIC, alamat, no HP, kategori; `terakhir_order`/`order_terakhir` otomatis
* **Artikel** — CRUD; customer, nama, harga/pcs, divisi, status aktif

## Produksi

* **Order** — CRUD Order + rincian item + breakdown ukuran per item; upload desain (Cloudinary); cetak invoice PDF
* **Order & Task** — kelola Task per divisi untuk tiap Order, assign karyawan otomatis saat pekerjaan pertama dicatat
* **Surat Jalan** — CRUD dokumen pengiriman + item; cetak/download PDF
* **Kalender Produksi** — kalender bulanan tanggal mulai & deadline Order
* **Lembar PO** — CRUD instruksi produksi per Order; cetak PDF 1 halaman

## Penggajian

* **Data Pekerjaan** — lihat seluruh Data Pekerjaan (piece-rate); filter tanggal/customer/artikel/karyawan; export
* **Payroll** — hitung otomatis per hari/rentang tanggal, filter bulan/tahun/karyawan/divisi; tandai sudah dibayar (dengan opsi potongan kasbon parsial); export slip gaji PDF/Excel
* **Kasbon** — kelola pengajuan kasbon karyawan: setujui/tolak; lihat status & sisa saldo tiap kasbon
* **Absensi** — kelola absensi harian karyawan Finishing

## Reports

* Laporan harian, mingguan, bulanan, tahunan, per customer, per artikel, per karyawan
* Export PDF & Excel

---

# Employee Features

## Dashboard

Menampilkan (berbeda per divisi):

* Piece-rate: Pendapatan hari ini/bulan ini, jumlah pekerjaan, total quantity bulan ini
* Finishing: Pendapatan hari ini/bulan ini, jam kerja hari ini/bulan ini, jumlah hari kerja bulan ini

## Tugas

Daftar Task milik divisi karyawan, dengan filter/sort (deadline, status, progress, nama order). Karyawan Finishing melihat tombol **Update Progress** langsung pada tiap Task.

## Input Pekerjaan (Piece-rate)

Form: Task, Artikel (harga tampil otomatis), Quantity, Keterangan. Total otomatis.

## Absensi (Finishing)

Check-in / check-out harian; riwayat absensi & jam kerja.

## Surat Jalan (Finishing)

Buat & kelola Surat Jalan pengiriman ke customer; cetak/download PDF.

## Riwayat Pekerjaan (Piece-rate)

Tabel Data Pekerjaan sendiri; filter tanggal.

## Riwayat Gaji

Bulan/tanggal, total gaji, potongan kasbon, status pembayaran.

## Kasbon

Ajukan kasbon (nominal + alasan); lihat riwayat & status (pending/approved/rejected/paid) beserta sisa saldo jika dicicil.

## Profile

Edit nomor HP, edit password.

---

# Data Model

Backend menggunakan Google Sheets sebagai database; setiap sheet = satu tabel, diakses lewat generic repository dengan write-through cache dan per-sheet lock.

## Users
id, username, password, role, employee_id

## Employees
id, name, phone, status, divisi, hourly_rate

## Customers
id, name, pic, alamat, no_hp, category

## Articles
id, customer_id, article_name, price, status, divisi

## WorkLogs
id, employee_id, customer_id, article_id, work_date, quantity, price, total, notes, payroll_id, status, task_id

## Payroll
id, employee_id, month, year, total_salary, payment_status, paid_at, paid_by, kasbon_deduction, net_salary, pay_source, pay_date

## CashAdvances
id, employee_id, amount, reason, status, requested_at, approved_at, approved_by, paid_at, payroll_id, paid_amount

## Attendance
id, employee_id, date, check_in, check_out, hours, payroll_id, notes

## Orders
id, customer_id, order_name, status, created_at, notes, deadline, invoice_no, jenis_category, order_from, broker, desain_fix_url

## OrderItems
id, order_id, nama_item, harga, qty, total, warna
> `harga`/`qty`/`total` selalu dihitung ulang dari OrderItemSizes, tidak jadi sumber kebenaran.

## OrderItemSizes
id, order_item_id, size, harga, qty

## Tasks
id, order_id, divisi, description, target_qty, completed_qty, assigned_to, status, created_at

## SuratJalan
id, no_document, customer_id, penerima_nama, penerima_telepon, penerima_alamat, created_at

## SuratJalanItems
id, surat_jalan_id, nama_item, qty

## LembarPO
id, order_id, sablon_bordir, catatan, label, bahan_tipe, pola_potong, hangtag, created_at

---

# Key Enumerations

* **Divisi**: Jahit, Sablon, Cutting, Finishing
* **Order Status**: Desain Fix, On Progress, Done, Di Ambil Costumer
* **Task Status**: open, in_progress, completed
* **Work Log Status**: on_progress, selesai, belum_selesai (label saja, tidak memengaruhi status Task)
* **Cash Advance Status**: pending, approved, rejected, paid
* **Pay Source**: worklog, attendance
* **Order Jenis Kategori**: Atribut Sekolah, CMT, Jaket, Jas Almamater, Jersey, Kaos, Kaos Polos, Kaos Satuan, Kaos Wisata, Kemeja, Maklon Bordir, Maklon Jahit, Maklon Sablon, Pendapatan Lainnya, Seragam Sekolah
* **Order From**: Shopee, TikTok, WhatsApp, Workshop
* **Customer Category**: Brand Owner, Kaos Anak, Kaos Event, Kaos Wisata, Seragam Komunitas, Seragam Perusahaan, Seragam Sekolah
* **Order Item Size (fixed)**: XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL, 6XL, + Custom

---

# Tech Stack

## Frontend

* React 19 + Vite + TypeScript
* Tailwind CSS v4, shadcn/ui (Radix-based)
* React Router v7
* TanStack Query
* React Hook Form + Zod
* Axios
* `@dayflow/react` + `@dayflow/core` — Kalender Produksi
* Recharts — grafik dashboard
* Sonner — toast notifications

## Backend

* Node.js + Express 5 — REST API
* Zod — validasi
* JWT (jsonwebtoken) + bcryptjs — autentikasi
* PDFKit — semua dokumen cetak (Invoice, Lembar PO, Surat Jalan, Slip Gaji, Laporan)
* ExcelJS — export Excel
* Multer + Cloudinary — upload gambar desain Order (Google Drive dievaluasi tapi tidak dipakai karena service account tidak punya kuota storage di luar Shared Drive Workspace)

## Database

Google Sheets sebagai database utama (belum migrasi ke SQL). Setiap sheet = satu tabel:

```
Users, Employees, Customers, Articles, WorkLogs, Payroll,
CashAdvances, Attendance, Orders, OrderItems, OrderItemSizes,
Tasks, SuratJalan, SuratJalanItems, LembarPO
```

Diakses lewat `googleapis` + `google-auth-library` (service account), dengan generic `SheetRepository` (write-through cache, per-sheet lock, atomic read-modify-write untuk operasi qty/status yang rawan race condition seperti progress Task dan potongan kasbon).

## Deployment

Deploy ke **Vercel**: frontend sebagai static build (`frontend/dist`), backend sebagai satu serverless function (`api/index.js`, membungkus Express app yang sama dipakai `backend/server.js`). Karena Vercel hanya menjalankan `npm install` di root (bukan di `backend/`), root `package.json` sengaja meng-copy seluruh dependency runtime backend agar serverless function-nya bisa resolve module dengan benar.

---

# Folder Structure

```
frontend/
│
├── components/ 
├── pages/
│   ├── admin/       # 17 halaman: Dashboard, Employees, Customers, Articles,
│   │                # Order, Orders, OrderDetail, TaskDetail, SuratJalan,
│   │                # SuratJalanDetail, KalenderProduksi, LembarPO, WorkLogs,
│   │                # Payroll, Kasbon, Attendance, Reports
│   └── employee/    # 10 halaman: Dashboard, Tasks, InputPekerjaan,
│                    # RiwayatPekerjaan, RiwayatGaji, Kasbon, Absensi,
│                    # SuratJalan, SuratJalanDetail, Profile
├── layouts/         # AdminLayout (sidebar), EmployeeLayout (bottom nav,
│                    # 2 varian nav tergantung divisi)
├── hooks/
├── services/
├── types/
└── utils/

backend/
│
├── routes/          # 16 route file, 1 per resource
├── controllers/
├── services/        # logika bisnis inti + komentar penjelasan invariant
├── middleware/       # auth.js: requireAuth, requireRole, requireDivisi
├── utils/
├── config/
└── google-sheet/     # models.js (schema), SheetRepository.js, setup.js

api/
└── index.js          # Vercel serverless entry point
```

---

# Non Functional Requirements

* Responsive & mobile friendly (halaman employee didesain mobile-first dengan bottom nav)
* Clean UI, fast loading
* Mudah digunakan oleh admin non-teknis
* Validasi input di frontend (Zod + React Hook Form) dan backend (Zod)
* Struktur kode modular (routes → controllers → services → repositories)
* Operasi qty/status yang bersifat concurrent-sensitive (progress Task, potongan kasbon) dibuat atomik untuk mencegah lost update
* Mudah dikembangkan ke database SQL di masa depan (abstraksi repository generic per sheet)

---

# Success Criteria

* Karyawan dapat mencatat pekerjaan atau absen dalam waktu kurang dari 30 detik.
* Admin dapat melihat total gaji seluruh karyawan (piece-rate maupun Finishing) secara otomatis tanpa menghitung manual.
* Progress Task dan status Order selalu konsisten dengan data pekerjaan/absensi yang tercatat, bahkan saat beberapa karyawan mencatat bersamaan.
* Admin dapat mengetahui status pembayaran gaji dan status pelunasan kasbon (termasuk yang dicicil) setiap karyawan.
* Seluruh laporan dan dokumen (Invoice, Lembar PO, Surat Jalan, Slip Gaji) dapat difilter/dibuat berdasarkan periode dan diekspor/dicetak dengan format rapi.
* Sistem sederhana, cepat dipelajari, dan mudah digunakan oleh operasional 22Studio baik oleh admin maupun karyawan di lapangan.
