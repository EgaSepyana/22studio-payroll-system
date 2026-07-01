# 22Studio Payroll Management System

> Product Requirement Document (PRD)

Sistem manajemen pekerjaan dan penggajian karyawan berbasis hasil kerja (Piece Rate Payroll) untuk **22Studio Konveksi & Sablon**.

---

# Overview

22Studio Payroll Management System adalah aplikasi internal yang digunakan untuk mencatat hasil pekerjaan setiap karyawan dan menghitung gaji berdasarkan jumlah pekerjaan yang telah diselesaikan.

Berbeda dengan sistem payroll konvensional yang menggunakan gaji pokok, aplikasi ini menggunakan sistem **Piece Rate Payroll**, yaitu gaji dihitung berdasarkan banyaknya pekerjaan yang dikerjakan oleh karyawan.

Contoh:

| Customer  | Artikel           | Harga   | Qty | Total     |
| --------- | ----------------- | ------- | --- | --------- |
| Sugarship | Fullprint 3 Warna | Rp3.500 | 170 | Rp595.000 |

Perhitungan:

```
Total = Harga × Quantity
```

Seluruh pekerjaan selama satu bulan akan dijumlahkan menjadi total gaji karyawan pada bulan tersebut.

---

# Goals

Tujuan aplikasi:

* Mempermudah karyawan mencatat hasil pekerjaan.
* Mempermudah admin memonitor pekerjaan seluruh karyawan.
* Menghitung gaji secara otomatis.
* Mengurangi kesalahan perhitungan manual.
* Menyediakan laporan pekerjaan harian hingga tahunan.
* Mengetahui status pembayaran gaji setiap karyawan.

---

# Target Users

## Admin

Bertugas mengelola seluruh data pada sistem.

Hak akses:

* Mengelola karyawan
* Mengelola customer
* Mengelola artikel
* Mengatur harga artikel
* Melihat seluruh pekerjaan
* Menghitung payroll
* Menandai payroll sudah dibayar
* Melihat laporan

---

## Employee

Bertugas menginput hasil pekerjaan yang telah dikerjakan.

Hak akses:

* Login
* Menginput pekerjaan
* Melihat riwayat pekerjaan
* Melihat total pendapatan
* Melihat riwayat gaji
* Mengubah profil

---

# High Level Concept

```
                 Admin

        Kelola Customer
               │
        Kelola Artikel
               │
        Tentukan Harga
               │
               ▼

           Employee Login

               │
      Input Hasil Pekerjaan
               │
               ▼

     Sistem menghitung otomatis

     Harga × Quantity = Total

               │
               ▼

      Masuk ke Riwayat Kerja

               │
               ▼

     Payroll Bulanan Otomatis

               │
               ▼

    Admin Tandai Sudah Dibayar
```

---

# Business Flow

## 1. Admin membuat Customer

Contoh:

* Sugarship
* Erigo
* Compass

---

## 2. Admin membuat Artikel

Contoh:

Customer

Sugarship

Artikel

Fullprint 3 Warna

Harga

Rp3.500 / pcs

---

## 3. Employee Login

Employee memilih artikel yang sedang dikerjakan.

Mengisi:

* Tanggal
* Customer
* Artikel
* Quantity
* Keterangan

Harga akan otomatis muncul dari data artikel.

---

## 4. Sistem Menghitung

Misal

Harga

Rp3.500

Quantity

170

Maka

```
3500 × 170

=

595000
```

Total langsung tersimpan.

---

## 5. Payroll

Saat admin membuka Payroll bulan Agustus.

Sistem otomatis menjumlahkan seluruh pekerjaan.

Misal

```
595000

+

320000

+

175000

+

450000

=

1540000
```

Payroll bulan Agustus

Rp1.540.000

---

## 6. Pembayaran

Admin cukup menekan

```
Tandai Sudah Dibayar
```

Sistem akan menyimpan:

* Status
* Tanggal pembayaran
* Admin yang melakukan pembayaran

Tidak ada proses approval.

---

# Features

## Authentication

### Admin

* Login
* Logout
* Ganti Password

### Employee

* Login
* Logout
* Ganti Password

---

# Admin Features

## Dashboard

Menampilkan:

* Total Karyawan
* Total Customer
* Total Artikel
* Total Pekerjaan Hari Ini
* Total Pendapatan Hari Ini
* Total Payroll Bulan Ini

Widget:

* Aktivitas terbaru
* Top produktivitas karyawan
* Grafik pekerjaan bulanan

---

## Employee Management

CRUD

Data:

* Nama
* Username
* Password
* Nomor HP
* Status

---

## Customer Management

CRUD Customer

---

## Artikel Management

CRUD Artikel

Data:

* Customer
* Nama Artikel
* Harga per pcs
* Status Aktif

---

## Data Pekerjaan

Melihat seluruh pekerjaan.

Filter:

* Tanggal
* Customer
* Artikel
* Karyawan

Kolom:

* Tanggal
* Nama Karyawan
* Customer
* Artikel
* Harga
* Quantity
* Total
* Keterangan

---

## Payroll

Filter berdasarkan:

* Bulan
* Tahun
* Karyawan

Kolom:

* Nama
* Total Pendapatan
* Status Pembayaran

Status:

* Belum Dibayar
* Sudah Dibayar

Action:

* Lihat Detail
* Tandai Sudah Dibayar

---

## Reports

Laporan:

* Harian
* Mingguan
* Bulanan
* Tahunan
* Per Customer
* Per Artikel
* Per Karyawan

Export:

* PDF
* Excel

---

# Employee Features

## Dashboard

Menampilkan

* Pendapatan Hari Ini
* Pendapatan Bulan Ini
* Jumlah Pekerjaan
* Total Quantity

---

## Input Pekerjaan

Form

* Tanggal
* Customer
* Artikel
* Harga (otomatis)
* Quantity
* Total (otomatis)
* Keterangan

---

## Riwayat Pekerjaan

Tabel:

* Tanggal
* Customer
* Artikel
* Harga
* Quantity
* Total

Filter tanggal.

---

## Riwayat Gaji

Menampilkan:

* Bulan
* Total Gaji
* Status Pembayaran

---

## Profile

* Edit Nomor HP
* Edit Password

---

# Data Model

## Users

* id
* username
* password
* role

---

## Employees

* id
* name
* phone
* status

---

## Customers

* id
* name

---

## Articles

* id
* customer_id
* article_name
* price

---

## Work Logs

* id
* employee_id
* customer_id
* article_id
* work_date
* quantity
* price
* total
* notes

---

## Payroll

* id
* employee_id
* month
* year
* total_salary
* payment_status
* paid_at
* paid_by

---

# Tech Stack

## Frontend

* React
* Shadcn/UI
* React Router
* TanStack Query
* React Hook Form
* Zod
* Axios
* Tailwind CSS

---

## Backend

* Node.js
* Express.js

REST API.

---

## Database

Menggunakan **Google Sheets** sebagai database utama untuk tahap prototype.

Setiap sheet merepresentasikan satu tabel.

Contoh:

```
Users
Employees
Customers
Articles
WorkLogs
Payroll
```

Backend akan menggunakan Google Sheets API sebagai media CRUD.

---

# Folder Structure

```
frontend/
│
├── components/
├── pages/
├── layouts/
├── hooks/
├── services/
├── types/
└── utils/

backend/
│
├── routes/
├── controllers/
├── services/
├── middleware/
├── utils/
├── config/
└── google-sheet/
```

---

# Non Functional Requirements

* Responsive
* Mobile Friendly
* Clean UI
* Fast Loading
* Mudah digunakan oleh admin non-teknis
* Validasi input sederhana
* Struktur kode modular
* Mudah dikembangkan ke database SQL di masa depan

---

# Success Criteria

Aplikasi dianggap berhasil apabila:

* Karyawan dapat mencatat pekerjaan dalam waktu kurang dari 30 detik.
* Admin dapat melihat total gaji seluruh karyawan secara otomatis tanpa menghitung manual.
* Admin dapat mengetahui status pembayaran setiap karyawan.
* Seluruh laporan dapat difilter berdasarkan periode dan diekspor.
* Sistem sederhana, cepat dipelajari, dan mudah digunakan oleh operasional 22Studio.