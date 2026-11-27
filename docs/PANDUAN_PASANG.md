# Panduan Pasang — Aplikasi Akuntansi Dive Center Resto

Aplikasi terdiri dari 4 file: **Code.gs**, **Index.html**, **Css.html**, **Js.html**.
Datanya tersimpan di satu Google Sheet milik resto.

## 1. Buat Google Sheet dan proyek Apps Script

1. Buka Google Drive, buat **Google Spreadsheet baru**, beri nama mis. `DC RESTO - Data`.
2. Di spreadsheet itu: menu **Ekstensi → Apps Script**.
3. Di editor Apps Script:
   - Hapus isi file `Code.gs` bawaan, tempel isi **Code.gs**.
   - Klik **+ → HTML**, beri nama `Index` (tanpa .html), tempel isi **Index.html**.
   - Ulangi untuk `Css` (isi **Css.html**) dan `Js` (isi **Js.html**).
   - Nama file harus persis: `Index`, `Css`, `Js` (huruf besar di awal).
4. Klik ikon **Simpan**.

## 2. Jalankan setup (sekali saja)

1. Di bagian atas editor, pilih fungsi **setup**, klik **Jalankan**.
2. Google meminta izin akses: pilih akun Anda → **Lanjutan → Buka proyek (tidak aman) → Izinkan**.
   (Peringatan ini normal untuk skrip buatan sendiri.)
3. Setelah selesai, spreadsheet berisi sheet: AKUN (sudah terisi 57 akun: 53 dari Excel + 152, 220, 221, 305), MENU, POS_TRANSAKSI,
   POS_DETAIL, JURNAL, KONTAK, STOK_OPNAME, SALDO_AWAL, PENGGUNA, PENGATURAN, LOG.
4. Pilih fungsi **pasangTriggerTutupKasir**, klik **Jalankan**. Ini membuat rekap kasir otomatis
   setiap tengah malam (WITA) bila kasir lupa menekan Tutup Kasir.

## 3. Terbitkan sebagai aplikasi web

1. Klik **Terapkan (Deploy) → Deployment baru**.
2. Ikon roda gigi → pilih **Aplikasi web**.
3. Isi:
   - **Jalankan sebagai:** Saya
   - **Yang memiliki akses:** Siapa saja
4. Klik **Terapkan**, salin **URL aplikasi web**.
5. Buka URL itu di HP dan laptop. Di HP, pakai menu browser **Tambahkan ke layar utama**
   agar muncul seperti aplikasi.

**Mode pengembangan (saat ini aktif):** aplikasi langsung terbuka tanpa login sebagai Admin. Lewat tombol akun (kanan atas) Anda bisa mencoba tampilan tiap peran. Jurnal yang dibuat di mode ini tercatat dengan OPR `DEV`.

Untuk mengaktifkan login: di `Code.gs` ubah `var TANPA_LOGIN = true;` menjadi `false`, simpan, lalu terbitkan versi baru. Login pertama: **kode `ADM`, PIN `123456`**, lalu segera ganti PIN.

> Setiap kali mengubah kode, terbitkan ulang: **Terapkan → Kelola deployment → ikon pensil →
> Versi: Versi baru → Terapkan**. URL tetap sama.

## 4. Urutan pengisian awal (oleh Admin)

1. **Pengaturan → Profil resto:** cek nama, alamat, dan **Tanggal mulai buku**
   (tanggal saldo awal; jurnal tidak bisa dicatat sebelum tanggal ini).
2. **Pengaturan → Pengguna:** buat pengguna untuk Kasir, Operator, Spv, Admin, Pemilik
   (kode 2–6 huruf, mis. AGS, PIN 4–8 angka).
3. **Pengaturan → Kontak:** pelanggan (CS), karyawan (KR), supplier (SP), pemegang saham (SH).
   Kode dibuat otomatis (CS001, SP001, …).
4. **Pengaturan → Saldo awal:** isi saldo akun neraca per tanggal mulai buku. Piutang, hutang usaha
   dan saham diisi per kontak agar buku pembantu cocok. Debit dan kredit harus seimbang.
5. Mulai mencatat lewat **Jurnal Umum → Penjualan Harian** dan **Jurnal manual**.
6. Nanti, saat daftar menu siap: **Pengaturan → Menu → Impor dari Excel**
   (kolom: Nama · Kategori · Harga · Kelompok HALAL/ALKOHOL). Setelah itu tab POS aktif.

## 5. Hak akses

| Fitur | Kasir | Operator | Spv | Admin | Pemilik |
|---|---|---|---|---|---|
| POS: jual, struk, Tutup Kasir | Ya | — | Ya | Ya | Lihat riwayat |
| Void struk | — | — | Ya | Ya | — |
| Penjualan Harian, jurnal manual, pembelian alkohol, stok opname | — | Ya | Ya | Ya | Lihat |
| Edit/hapus jurnal | — | Milik sendiri, hari yang sama | Ya | Ya | — |
| Buku Besar & Buku Pembantu | — | Ya | Ya | Ya | Ya |
| Laba Rugi & Neraca | — | — | Ya | Ya | Ya |
| Pengaturan (akun, menu, kontak, saldo awal, pajak) | — | — | — | Ya | Lihat profil |
| Kelola pengguna, log aktivitas | — | — | — | Ya | Ya |

Jurnal dari POS tidak bisa diedit atau dihapus; koreksinya lewat **Void** (otomatis membuat jurnal kebalikan).

## 6. Aturan pemisahan alkohol

- Jurnal usaha halal bernomor **JU-xxxxx**, jurnal alkohol **AL-xxxxx**.
- Akun alkohol (151, 152, 305, 410) tidak bisa dipakai di jurnal halal, begitu pula sebaliknya.
  Akun UMUM (112 Kas Kecil, 113 Kas Bank, 130 Piutang, 211 Hutang Usaha, 220, 221) bisa dipakai keduanya.
- Kas tetap satu; setiap mutasi kas bertanda halal/alkohol (terlihat di Buku Besar 112/113).
- Laba Rugi bagian 1 = usaha halal → Laba Bersih → Zakat Mal.
  Bagian 2 = Perhitungan Hasil Alkohol, terkumpul di **305 Dana Hasil Alkohol** di Neraca.
- Stok opname alkohol dicatat terpisah dari bahan baku.

## 7. HPP dan stok opname

Persediaan akhir di Laba Rugi dan Neraca diambil dari **stok opname terakhir** pada periode itu
(Jurnal Umum → Stok Opname). Bila belum ada stok opname, dipakai saldo buku akun 140/152.
Lakukan stok opname tiap akhir bulan agar HPP tepat.

## 8. Cetak struk

- **Printer thermal bluetooth (58 mm):** di Android pasang aplikasi driver printer (mis. RawBT),
  lalu tekan **Cetak / PDF** di struk dan pilih printer tersebut. Di laptop, pilih printer thermal
  di dialog cetak (ukuran kertas 58 mm, margin minimum).
- **WhatsApp:** tombol WhatsApp membuka WA dengan teks struk siap dikirim.
- **PDF:** pada dialog cetak pilih **Simpan sebagai PDF**.

## 9. Pajak (PB1) dan service

Akun 220 Hutang Pajak Restoran dan 221 Hutang Service sudah tersedia. Tarif awal 0% (belum aktif).
Untuk mengaktifkan: **Pengaturan → Profil resto → Tarif PB1 / Tarif service**. POS lalu menghitungnya
per struk dan rekap memisahkannya dari omset.
