# ✨ Feature: Employee Cash Advance (Kasbon)

## Description

Tambahkan fitur **Kasbon (Cash Advance)** pada sistem payroll 22Studio.

Kasbon memungkinkan karyawan mengajukan pinjaman kepada perusahaan melalui aplikasi. Pengajuan kasbon akan diproses oleh admin. Setelah disetujui, nominal kasbon akan otomatis dipotong dari payroll karyawan saat proses pembayaran gaji.

Fitur ini bertujuan agar proses pengajuan, persetujuan, dan pelunasan kasbon terdokumentasi dalam satu sistem tanpa perlu pencatatan manual.

---

## Business Flow

```text
Employee
    │
    ├── Mengajukan Kasbon
    │
    ▼
Admin
    │
    ├── Approve / Reject
    │
    ▼
Kasbon Berstatus Approved
    │
    ▼
Payroll Bulan Berjalan
    │
    ▼
Total Gaji - Total Kasbon
    │
    ▼
Admin Tandai Payroll Sudah Dibayar
    │
    ▼
Kasbon Berstatus Paid
```

---

# Employee Features

## Menu Baru

### Kasbon

Tambahkan menu baru pada sidebar Employee.

Menu terdiri dari:

* Ajukan Kasbon
* Riwayat Kasbon

---

## Form Pengajuan Kasbon

Field:

* Nominal Kasbon
* Alasan (opsional)

Contoh:

|   Nominal | Alasan            |
| --------: | ----------------- |
| Rp200.000 | Keperluan pribadi |

Validasi:

* Nominal wajib diisi.
* Nominal harus lebih dari Rp0.

Status awal:

```text
Pending
```

---

## Riwayat Kasbon

Tampilkan tabel:

| Tanggal | Nominal | Status | Keterangan |
| ------- | ------: | ------ | ---------- |

Status menggunakan badge:

* 🟡 Pending
* 🟢 Approved
* 🔴 Rejected
* 🔵 Paid

Employee hanya dapat melihat data miliknya sendiri.

---

# Admin Features

## Menu Baru

### Cash Advance Management

Menampilkan seluruh pengajuan kasbon.

Kolom:

* Employee
* Tanggal
* Nominal
* Alasan
* Status

Action:

* Approve
* Reject
* Detail

---

## Approve Kasbon

Saat admin menekan Approve:

Status berubah menjadi:

```text
Approved
```

Kasbon akan otomatis masuk ke perhitungan payroll berikutnya sebagai potongan gaji.

---

## Reject Kasbon

Status berubah menjadi:

```text
Rejected
```

Kasbon tidak mempengaruhi payroll.

---

# Payroll Integration

Saat menghitung payroll:

```text
Total Gaji

-

Total Kasbon Approved yang belum dibayar

=

Total Gaji Bersih
```

Contoh:

```text
Pendapatan Bulan Ini

Rp1.500.000

Kasbon

Rp200.000

Take Home Pay

Rp1.300.000
```

---

# Payroll Detail

Tambahkan informasi baru pada halaman detail payroll.

Contoh:

```text
Pendapatan

Rp1.500.000

Kasbon

Rp200.000

Total Dibayar

Rp1.300.000
```

---

# Payment Flow

Ketika admin menekan:

```text
Tandai Sudah Dibayar
```

Sistem akan:

* Mengubah status payroll menjadi **Paid**
* Mengubah seluruh kasbon yang digunakan pada payroll tersebut menjadi **Paid**
* Menyimpan tanggal pembayaran

Kasbon yang sudah berstatus **Paid** tidak boleh dipotong kembali pada payroll berikutnya.

---

# Database Changes

## Tambahkan Sheet Baru

```text
CashAdvances
```

Kolom:

* id
* employee_id
* amount
* reason
* status
* requested_at
* approved_at
* approved_by
* paid_at
* payroll_id

Status:

* Pending
* Approved
* Rejected
* Paid

---

# UI Requirements

## Employee

* Badge status berwarna
* Form sederhana
* Riwayat dalam bentuk table
* Filter berdasarkan status

---

## Admin

* Table Management
* Search Employee
* Filter Status
* Filter Tanggal
* Badge Status
* Confirmation Dialog saat Approve / Reject

---

# Acceptance Criteria

* Employee dapat mengajukan kasbon melalui aplikasi.
* Employee dapat melihat seluruh riwayat kasbon beserta statusnya.
* Admin dapat melihat seluruh pengajuan kasbon.
* Admin dapat melakukan Approve atau Reject kasbon.
* Kasbon yang berstatus **Approved** otomatis menjadi potongan pada payroll berikutnya.
* Kasbon yang sudah dipotong berubah menjadi **Paid** saat payroll ditandai sudah dibayar.
* Kasbon yang berstatus **Rejected** tidak mempengaruhi payroll.
* Kasbon yang sudah **Paid** tidak boleh dipotong kembali pada periode berikutnya.
* Seluruh perubahan status tercermin pada halaman Admin maupun Employee.
