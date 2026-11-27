/**
 * DIVE CENTER RESTO — Aplikasi Akuntansi Resto
 * Nusa Penida · Google Apps Script + Google Sheet
 *
 * Cara pasang singkat:
 * 1. Buat Google Sheet baru → Ekstensi → Apps Script.
 * 2. Tempel file Code.gs, Index.html, Css.html, Js.html.
 * 3. Jalankan fungsi setup() sekali (izinkan akses).
 * 4. Jalankan pasangTriggerTutupKasir() sekali (rekap otomatis tengah malam).
 * 5. Deploy → Deployment baru → Aplikasi web (Jalankan sebagai: Saya, Akses: Siapa saja).
 * Login awal: kode ADM, PIN 123456 → segera ganti PIN.
 */

// ===================== KONFIGURASI =====================
var TZ = 'Asia/Makassar'; // WITA (Bali / Nusa Penida)

var SH = {
  AKUN: ['Kode', 'Nama', 'SaldoNormal', 'Pos', 'Golongan', 'Kelompok', 'Aktif'],
  MENU: ['ID', 'Nama', 'Kategori', 'Harga', 'Kelompok', 'Aktif'],
  POS_TRANSAKSI: ['No', 'Tanggal', 'Jam', 'OPR', 'Meja', 'KodePelanggan', 'SubHalal', 'SubAlkohol', 'Diskon',
    'NetHalal', 'NetAlkohol', 'PajakHalal', 'PajakAlkohol', 'ServHalal', 'ServAlkohol', 'Total', 'Metode',
    'Dibayar', 'Kembali', 'Status', 'TanggalRekap', 'Catatan'],
  POS_DETAIL: ['No', 'IDMenu', 'Nama', 'Kelompok', 'Qty', 'Harga', 'Subtotal', 'Catatan'],
  JURNAL: ['ID', 'Tanggal', 'OPR', 'Keterangan', 'Kode', 'NamaAkun', 'Debit', 'Kredit', 'Kontak', 'Kelompok',
    'Sumber', 'Ref', 'DibuatPada'],
  KONTAK: ['Kode', 'Nama', 'Jenis', 'Alamat', 'Bank', 'NoRek', 'AtasNama', 'Aktif'],
  STOK_OPNAME: ['Tanggal', 'NamaBarang', 'Satuan', 'Qty', 'Harga', 'Total', 'Kelompok'],
  SALDO_AWAL: ['Kode', 'Kontak', 'Saldo'],
  PENGGUNA: ['Kode', 'Nama', 'Peran', 'PinHash', 'Aktif'],
  PENGATURAN: ['Kunci', 'Nilai'],
  LOG: ['Waktu', 'User', 'Aksi', 'Detail']
};

// Kolom yang harus disimpan sebagai teks (supaya tanggal tidak diubah otomatis oleh Sheet)
var TEKS = {
  AKUN: ['Kode'], MENU: ['ID'], POS_TRANSAKSI: ['No', 'Tanggal', 'Jam', 'TanggalRekap', 'KodePelanggan'],
  POS_DETAIL: ['No', 'IDMenu'], JURNAL: ['ID', 'Tanggal', 'Kode', 'Kontak', 'Ref', 'DibuatPada'],
  KONTAK: ['Kode', 'NoRek'], STOK_OPNAME: ['Tanggal'], SALDO_AWAL: ['Kode', 'Kontak'],
  PENGGUNA: ['Kode'], PENGATURAN: ['Kunci', 'Nilai'], LOG: ['Waktu']
};

var PERAN = ['KASIR', 'OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'];

var IZIN = {
  bootstrap: PERAN,
  gantiPin: PERAN,
  posSimpan: ['KASIR', 'SPV', 'ADMIN'],
  posVoid: ['SPV', 'ADMIN'],
  posTutupKasir: ['KASIR', 'SPV', 'ADMIN'],
  posDaftar: ['KASIR', 'SPV', 'ADMIN', 'PEMILIK'],
  posStruk: ['KASIR', 'SPV', 'ADMIN', 'PEMILIK'],
  jurnalSimpan: ['OPERATOR', 'SPV', 'ADMIN'],
  jurnalHapus: ['OPERATOR', 'SPV', 'ADMIN'],
  jurnalDaftar: ['OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'],
  jurnalAmbil: ['OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'],
  penjualanHarian: ['OPERATOR', 'SPV', 'ADMIN'],
  pembelianAlkohol: ['OPERATOR', 'SPV', 'ADMIN'],
  bukuBesar: ['OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'],
  bukuPembantu: ['OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'],
  kartuKontak: ['OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'],
  laporan: ['SPV', 'ADMIN', 'PEMILIK'],
  stokDaftar: ['OPERATOR', 'SPV', 'ADMIN', 'PEMILIK'],
  stokSimpan: ['OPERATOR', 'SPV', 'ADMIN'],
  akunSimpan: ['ADMIN'],
  menuSimpan: ['ADMIN'],
  menuImpor: ['ADMIN'],
  kontakSimpan: ['ADMIN'],
  saldoAwalDaftar: ['ADMIN', 'PEMILIK'],
  saldoAwalSimpan: ['ADMIN'],
  pengaturanSimpan: ['ADMIN'],
  penggunaDaftar: ['ADMIN', 'PEMILIK'],
  penggunaSimpan: ['ADMIN', 'PEMILIK'],
  logDaftar: ['ADMIN', 'PEMILIK']
};

// Bagan akun awal (dari sheet KODE Excel DC_RESTO_AGU_2026 + akun baru 152, 220, 221, 305)
// [Kode, Nama, SaldoNormal, Golongan, Kelompok]
var COA = [
  ['112', 'KAS KECIL', 'DEBIT', 'ASET_LANCAR', 'UMUM'],
  ['113', 'KAS BANK', 'DEBIT', 'ASET_LANCAR', 'UMUM'],
  ['130', 'PIUTANG DAGANG', 'DEBIT', 'ASET_LANCAR', 'UMUM'],
  ['135', 'CAD KERUGIAN PIUTANG', 'KREDIT', 'ASET_LANCAR', 'HALAL'],
  ['138', 'PIUTANG KARYAWAN', 'DEBIT', 'ASET_LANCAR', 'HALAL'],
  ['139', 'PIUTANG DC', 'DEBIT', 'ASET_LANCAR', 'HALAL'],
  ['140', 'PERSEDIAAN', 'DEBIT', 'PERSEDIAAN', 'HALAL'],
  ['141', 'PEMBELIAN TUNAI', 'DEBIT', 'PEMBELIAN', 'HALAL'],
  ['142', 'PEMBELIAN KREDIT', 'DEBIT', 'PEMBELIAN', 'HALAL'],
  ['151', 'PEMBELIAN ALKOHOL', 'DEBIT', 'PEMBELIAN', 'ALKOHOL'],
  ['152', 'PERSEDIAAN ALKOHOL', 'DEBIT', 'PERSEDIAAN', 'ALKOHOL'],
  ['165', 'SEWA DIBAYAR DIMUKA', 'DEBIT', 'ASET_LANCAR', 'HALAL'],
  ['172', 'GEDUNG', 'DEBIT', 'ASET_TETAP', 'HALAL'],
  ['173', 'KENDARAAN', 'DEBIT', 'ASET_TETAP', 'HALAL'],
  ['174', 'PERALATAN DAPUR', 'DEBIT', 'ASET_TETAP', 'HALAL'],
  ['175', 'PERALATAN UMUM', 'DEBIT', 'ASET_TETAP', 'HALAL'],
  ['176', 'AKTIVA LAINNYA', 'DEBIT', 'ASET_TETAP', 'HALAL'],
  ['182', 'AP GEDUNG', 'KREDIT', 'AKUM_PENY', 'HALAL'],
  ['183', 'AP KENDARAAN', 'KREDIT', 'AKUM_PENY', 'HALAL'],
  ['184', 'AP PERALATAN DAPUR', 'KREDIT', 'AKUM_PENY', 'HALAL'],
  ['185', 'AP PERALATAN UMUM', 'KREDIT', 'AKUM_PENY', 'HALAL'],
  ['186', 'AP AKTIVA LAINNYA', 'KREDIT', 'AKUM_PENY', 'HALAL'],
  ['210', 'HUTANG MODAL', 'KREDIT', 'HUTANG', 'HALAL'],
  ['211', 'HUTANG USAHA', 'KREDIT', 'HUTANG', 'UMUM'],
  ['212', 'HUTANG PAK RAKA', 'KREDIT', 'HUTANG', 'HALAL'],
  ['219', 'PENDAPATAN DITERIMA DIMUKA', 'KREDIT', 'HUTANG', 'HALAL'],
  ['220', 'HUTANG PAJAK RESTORAN (PB1)', 'KREDIT', 'HUTANG', 'UMUM'],
  ['221', 'HUTANG SERVICE', 'KREDIT', 'HUTANG', 'UMUM'],
  ['300', 'MODAL SAHAM', 'KREDIT', 'MODAL', 'HALAL'],
  ['301', 'AGIO SAHAM', 'KREDIT', 'MODAL', 'HALAL'],
  ['302', 'MODAL PENGEMBANGAN', 'KREDIT', 'MODAL', 'HALAL'],
  ['303', 'LABA DITAHAN', 'KREDIT', 'MODAL', 'HALAL'],
  ['304', 'LABA BERJALAN', 'KREDIT', 'MODAL', 'HALAL'],
  ['305', 'DANA HASIL ALKOHOL', 'KREDIT', 'DANA_ALKOHOL', 'ALKOHOL'],
  ['401', 'PENJUALAN TUNAI', 'KREDIT', 'PENDAPATAN', 'HALAL'],
  ['402', 'PENJUALAN KREDIT', 'KREDIT', 'PENDAPATAN', 'HALAL'],
  ['403', 'PENDAPATAN LAINNYA', 'KREDIT', 'PENDAPATAN', 'HALAL'],
  ['410', 'PENJUALAN ALKOHOL', 'KREDIT', 'PENDAPATAN', 'ALKOHOL'],
  ['601', 'BEBAN GAJI KARYAWAN', 'DEBIT', 'BEBAN', 'HALAL'],
  ['602', 'BEBAN BTK', 'DEBIT', 'BEBAN', 'HALAL'],
  ['611', 'BEBAN RETRIBUSI', 'DEBIT', 'BEBAN', 'HALAL'],
  ['613', 'BEBAN TRANSPORTASI', 'DEBIT', 'BEBAN', 'HALAL'],
  ['614', 'BEBAN PENGIRIMAN', 'DEBIT', 'BEBAN', 'HALAL'],
  ['616', 'BEBAN PAJAK', 'DEBIT', 'BEBAN', 'HALAL'],
  ['617', 'BEBAN SEWA', 'DEBIT', 'BEBAN', 'HALAL'],
  ['652', 'BEBAN LATI', 'DEBIT', 'BEBAN', 'HALAL'],
  ['653', 'BEBAN PERLENGKAPAN', 'DEBIT', 'BEBAN', 'HALAL'],
  ['654', 'BEBAN PENY GEDUNG', 'DEBIT', 'BEBAN', 'HALAL'],
  ['655', 'BEBAN PENY KENDARAAN', 'DEBIT', 'BEBAN', 'HALAL'],
  ['656', 'BEBAN PENY PERALATAN KANTOR', 'DEBIT', 'BEBAN', 'HALAL'],
  ['657', 'BEBAN PERBAIKAN', 'DEBIT', 'BEBAN', 'HALAL'],
  ['658', 'BEBAN PENY PERALATAN UMUM', 'DEBIT', 'BEBAN', 'HALAL'],
  ['661', 'BEBAN ENTERTAINT', 'DEBIT', 'BEBAN', 'HALAL'],
  ['662', 'BEBAN CICILAN', 'DEBIT', 'BEBAN', 'HALAL'],
  ['690', 'BEBAN ADMINISTRASI', 'DEBIT', 'BEBAN', 'HALAL'],
  ['691', 'BEBAN LAINNYA', 'DEBIT', 'BEBAN', 'HALAL'],
  ['700', 'ZAKAT MAL', 'DEBIT', 'ZAKAT', 'HALAL']
];

var GOL_NERACA = ['ASET_LANCAR', 'PERSEDIAAN', 'ASET_TETAP', 'AKUM_PENY', 'HUTANG', 'MODAL', 'DANA_ALKOHOL'];
var GOL_AKTIVA = ['ASET_LANCAR', 'PERSEDIAAN', 'ASET_TETAP', 'AKUM_PENY'];

// Buku pembantu: jenis kontak → akun induk
var PEMBANTU = {
  CS: { nama: 'Piutang Pelanggan', akun: ['130'] },
  KR: { nama: 'Piutang Karyawan', akun: ['138'] },
  SP: { nama: 'Hutang Supplier', akun: ['211'] },
  SH: { nama: 'Saham / Modal Pemegang Saham', akun: ['300', '302'] }
};

var PENGATURAN_AWAL = {
  NAMA_RESTO: 'Dive Center Resto',
  ALAMAT: 'Nusa Penida',
  TAGLINE: 'Coffee · Sea · Kitchen',
  MULAI_BUKU: '',
  TARIF_PB1: '0',
  TARIF_SERVICE: '0',
  CATATAN_STRUK: 'Thank you · Terima kasih',
  NO_JU: '0', NO_AL: '0', NO_POS: '0', SALT: ''
};

// ===================== WEB APP =====================
function doGet() {
  ensureSetup_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Dive Center Resto')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

// ===================== SETUP =====================
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SH).forEach(function (nama) {
    var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
    var head = SH[nama];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold')
        .setBackground('#3B4A22').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
    (TEKS[nama] || []).forEach(function (kol) {
      var c = head.indexOf(kol) + 1;
      if (c > 0) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });
  var akun = ss.getSheetByName('AKUN');
  if (akun.getLastRow() < 2) {
    akun.getRange(2, 1, COA.length, 7).setValues(COA.map(function (r) {
      return [r[0], r[1], r[2], posDari_(r[3]), r[3], r[4], 'YA'];
    }));
  }
  var set = ss.getSheetByName('PENGATURAN');
  var ada = {};
  if (set.getLastRow() > 1) set.getRange(2, 1, set.getLastRow() - 1, 1).getValues().forEach(function (r) { ada[r[0]] = 1; });
  var baru = [];
  Object.keys(PENGATURAN_AWAL).forEach(function (k) {
    if (!ada[k]) {
      var v = PENGATURAN_AWAL[k];
      if (k === 'SALT') v = Utilities.getUuid();
      if (k === 'MULAI_BUKU') v = hariIni_();
      baru.push([k, v]);
    }
  });
  if (baru.length) set.getRange(set.getLastRow() + 1, 1, baru.length, 2).setValues(baru);
  var user = ss.getSheetByName('PENGGUNA');
  if (user.getLastRow() < 2) {
    user.appendRow(['ADM', 'Administrator', 'ADMIN', hashPin_('123456', getSet_('SALT')), 'YA']);
  }
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  PropertiesService.getScriptProperties().setProperty('SETUP_OK', '1');
  return 'Setup selesai. Login awal: ADM / 123456';
}

function ensureSetup_() {
  if (PropertiesService.getScriptProperties().getProperty('SETUP_OK') !== '1') setup();
}

function pasangTriggerTutupKasir() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tutupKasirOtomatis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('tutupKasirOtomatis').timeBased().everyDays(1).atHour(0).nearMinute(15).inTimezone(TZ).create();
  return 'Trigger rekap otomatis tengah malam terpasang.';
}

function posDari_(gol) {
  return GOL_NERACA.indexOf(gol) >= 0 ? 'NERACA' : 'LABA RUGI';
}

// ===================== UTIL SHEET =====================
var _cache = {};
function sheet_(nama) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama); }

function rows_(nama) {
  if (_cache[nama]) return _cache[nama];
  var sh = sheet_(nama), head = SH[nama];
  var n = sh.getLastRow() - 1;
  var out = [];
  if (n > 0) {
    var vals = sh.getRange(2, 1, n, head.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var o = { _row: i + 2 };
      for (var j = 0; j < head.length; j++) {
        var v = vals[i][j];
        if (v instanceof Date) v = Utilities.formatDate(v, TZ, head[j] === 'Jam' ? 'HH:mm' : 'yyyy-MM-dd');
        o[head[j]] = v;
      }
      out.push(o);
    }
  }
  _cache[nama] = out;
  return out;
}

function append_(nama, objs) {
  if (!objs.length) return;
  var sh = sheet_(nama), head = SH[nama];
  var vals = objs.map(function (o) { return head.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; }); });
  var start = sh.getLastRow() + 1;
  (TEKS[nama] || []).forEach(function (kol) {
    var c = head.indexOf(kol) + 1;
    if (c > 0) sh.getRange(start, c, vals.length, 1).setNumberFormat('@');
  });
  sh.getRange(start, 1, vals.length, head.length).setValues(vals);
  delete _cache[nama];
}

function updateRow_(nama, rowNum, obj) {
  var sh = sheet_(nama), head = SH[nama];
  sh.getRange(rowNum, 1, 1, head.length).setValues([head.map(function (h) { return obj[h] === undefined ? '' : obj[h]; })]);
  delete _cache[nama];
}

function deleteRows_(nama, rowNums) {
  var sh = sheet_(nama);
  rowNums.sort(function (a, b) { return b - a; });
  rowNums.forEach(function (r) { sh.deleteRow(r); });
  delete _cache[nama];
}

function getSet_(k) {
  var r = rows_('PENGATURAN').filter(function (x) { return x.Kunci === k; })[0];
  return r ? String(r.Nilai) : (PENGATURAN_AWAL[k] || '');
}

function setSet_(k, v) {
  var r = rows_('PENGATURAN').filter(function (x) { return x.Kunci === k; })[0];
  if (r) updateRow_('PENGATURAN', r._row, { Kunci: k, Nilai: String(v) });
  else append_('PENGATURAN', [{ Kunci: k, Nilai: String(v) }]);
}

function nomor_(kunci, prefix, panjang) {
  var n = Number(getSet_(kunci) || 0) + 1;
  setSet_(kunci, n);
  var s = String(n);
  while (s.length < panjang) s = '0' + s;
  return prefix + s;
}

function hariIni_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function sekarang_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function rp_(n) { return Math.round(Number(n) || 0); }

function hashPin_(pin, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pin, Utilities.Charset.UTF_8);
  return raw.map(function (b) { var h = (b & 0xff).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

function log_(user, aksi, detail) {
  try {
    append_('LOG', [{ Waktu: sekarang_(), User: user ? user.kode : '-', Aksi: aksi, Detail: JSON.stringify(detail || {}).slice(0, 45000) }]);
  } catch (e) { /* log tidak boleh menggagalkan transaksi */ }
}

// ===================== API =====================
function login(kode, pin) {
  ensureSetup_();
  kode = String(kode || '').trim().toUpperCase();
  var u = rows_('PENGGUNA').filter(function (r) { return String(r.Kode).toUpperCase() === kode && r.Aktif === 'YA'; })[0];
  if (!u || u.PinHash !== hashPin_(String(pin || ''), getSet_('SALT'))) {
    return { ok: false, error: 'Kode atau PIN salah.' };
  }
  var user = { kode: String(u.Kode), nama: u.Nama, peran: u.Peran };
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('S_' + token, JSON.stringify(user), 21600);
  log_(user, 'LOGIN', {});
  return { ok: true, data: { token: token, user: user } };
}

function logout(token) {
  CacheService.getScriptCache().remove('S_' + token);
  return { ok: true };
}

function api(req) {
  try {
    req = req || {};
    var raw = CacheService.getScriptCache().get('S_' + req.token);
    if (!raw) return { ok: false, error: 'Sesi berakhir, silakan login lagi.', relogin: true };
    var user = JSON.parse(raw);
    var izin = IZIN[req.action];
    if (!izin || !AKSI[req.action]) return { ok: false, error: 'Aksi tidak dikenal.' };
    if (izin.indexOf(user.peran) < 0) return { ok: false, error: 'Peran ' + user.peran + ' tidak punya akses untuk aksi ini.' };
    var lock = null;
    if (/Simpan|Hapus|Void|Tutup|Harian|Alkohol|Impor|gantiPin/.test(req.action)) {
      lock = LockService.getScriptLock();
      lock.waitLock(20000);
    }
    try {
      return { ok: true, data: AKSI[req.action](req.data || {}, user) };
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

var AKSI = {};

AKSI.bootstrap = function (d, user) {
  var set = {};
  rows_('PENGATURAN').forEach(function (r) { if (r.Kunci !== 'SALT' && !/^NO_/.test(r.Kunci)) set[r.Kunci] = String(r.Nilai); });
  return {
    user: user,
    pengaturan: set,
    akun: daftarAkun_(),
    kontak: rows_('KONTAK').map(function (r) {
      return { kode: String(r.Kode), nama: r.Nama, jenis: r.Jenis, alamat: r.Alamat, bank: r.Bank, norek: String(r.NoRek), atasNama: r.AtasNama, aktif: r.Aktif };
    }),
    menu: rows_('MENU').map(function (r) {
      return { id: String(r.ID), nama: r.Nama, kategori: r.Kategori, harga: Number(r.Harga) || 0, kelompok: r.Kelompok, aktif: r.Aktif };
    }),
    izin: Object.keys(IZIN).filter(function (k) { return IZIN[k].indexOf(user.peran) >= 0; }),
    hariIni: hariIni_()
  };
};

AKSI.gantiPin = function (d, user) {
  if (!/^\d{4,8}$/.test(String(d.pinBaru || ''))) throw new Error('PIN baru harus 4–8 angka.');
  var u = rows_('PENGGUNA').filter(function (r) { return String(r.Kode) === user.kode; })[0];
  var salt = getSet_('SALT');
  if (!u || u.PinHash !== hashPin_(String(d.pinLama || ''), salt)) throw new Error('PIN lama salah.');
  u.PinHash = hashPin_(String(d.pinBaru), salt);
  updateRow_('PENGGUNA', u._row, u);
  log_(user, 'GANTI_PIN', {});
  return 'PIN berhasil diganti.';
};

// ---------- AKUN ----------
function daftarAkun_() {
  return rows_('AKUN').map(function (r) {
    return { kode: String(r.Kode), nama: r.Nama, normal: r.SaldoNormal, pos: r.Pos, golongan: r.Golongan, kelompok: r.Kelompok, aktif: r.Aktif };
  }).sort(function (a, b) { return a.kode < b.kode ? -1 : 1; });
}

function petaAkun_() {
  var m = {};
  daftarAkun_().forEach(function (a) { m[a.kode] = a; });
  return m;
}

AKSI.akunSimpan = function (d, user) {
  var kode = String(d.kode || '').trim();
  if (!/^\d{3,6}$/.test(kode)) throw new Error('Kode akun harus 3–6 angka.');
  if (!d.nama) throw new Error('Nama akun wajib diisi.');
  if (['DEBIT', 'KREDIT'].indexOf(d.normal) < 0) throw new Error('Saldo normal harus DEBIT atau KREDIT.');
  var gol = ['ASET_LANCAR', 'PERSEDIAAN', 'ASET_TETAP', 'AKUM_PENY', 'HUTANG', 'MODAL', 'DANA_ALKOHOL', 'PENDAPATAN', 'PEMBELIAN', 'BEBAN', 'ZAKAT'];
  if (gol.indexOf(d.golongan) < 0) throw new Error('Golongan tidak valid.');
  if (['HALAL', 'ALKOHOL', 'UMUM'].indexOf(d.kelompok) < 0) throw new Error('Kelompok tidak valid.');
  var obj = { Kode: kode, Nama: String(d.nama).toUpperCase(), SaldoNormal: d.normal, Pos: posDari_(d.golongan), Golongan: d.golongan, Kelompok: d.kelompok, Aktif: d.aktif === 'TIDAK' ? 'TIDAK' : 'YA' };
  var ada = rows_('AKUN').filter(function (r) { return String(r.Kode) === kode; })[0];
  if (ada) updateRow_('AKUN', ada._row, obj); else append_('AKUN', [obj]);
  log_(user, 'AKUN_SIMPAN', obj);
  return daftarAkun_();
};

// ---------- KONTAK ----------
AKSI.kontakSimpan = function (d, user) {
  var jenis = String(d.jenis || '').toUpperCase();
  if (!PEMBANTU[jenis]) throw new Error('Jenis kontak harus CS, KR, SP atau SH.');
  if (!d.nama) throw new Error('Nama wajib diisi.');
  var kode = String(d.kode || '').trim().toUpperCase();
  var semua = rows_('KONTAK');
  if (!kode) {
    var maks = 0;
    semua.forEach(function (r) { var k = String(r.Kode); if (k.indexOf(jenis) === 0) maks = Math.max(maks, Number(k.slice(2)) || 0); });
    var s = String(maks + 1); while (s.length < 3) s = '0' + s;
    kode = jenis + s;
  }
  var obj = { Kode: kode, Nama: d.nama, Jenis: jenis, Alamat: d.alamat || '', Bank: d.bank || '', NoRek: d.norek || '', AtasNama: d.atasNama || '', Aktif: d.aktif === 'TIDAK' ? 'TIDAK' : 'YA' };
  var ada = semua.filter(function (r) { return String(r.Kode) === kode; })[0];
  if (ada) updateRow_('KONTAK', ada._row, obj); else append_('KONTAK', [obj]);
  log_(user, 'KONTAK_SIMPAN', obj);
  return AKSI.bootstrap({}, user).kontak;
};

// ---------- MENU ----------
AKSI.menuSimpan = function (d, user) {
  if (!d.nama) throw new Error('Nama menu wajib diisi.');
  if (!(Number(d.harga) > 0)) throw new Error('Harga harus lebih dari 0.');
  var kel = d.kelompok === 'ALKOHOL' ? 'ALKOHOL' : 'HALAL';
  var semua = rows_('MENU');
  var id = String(d.id || '').trim();
  if (!id) {
    var maks = 0;
    semua.forEach(function (r) { maks = Math.max(maks, Number(String(r.ID).replace(/\D/g, '')) || 0); });
    var s = String(maks + 1); while (s.length < 4) s = '0' + s;
    id = 'M' + s;
  }
  var obj = { ID: id, Nama: d.nama, Kategori: d.kategori || (kel === 'ALKOHOL' ? 'Alkohol' : 'Makanan'), Harga: rp_(d.harga), Kelompok: kel, Aktif: d.aktif === 'TIDAK' ? 'TIDAK' : 'YA' };
  var ada = semua.filter(function (r) { return String(r.ID) === id; })[0];
  if (ada) updateRow_('MENU', ada._row, obj); else append_('MENU', [obj]);
  log_(user, 'MENU_SIMPAN', obj);
  return AKSI.bootstrap({}, user).menu;
};

AKSI.menuImpor = function (d, user) {
  // d.baris: [{nama, kategori, harga, kelompok}]
  var baris = d.baris || [];
  if (!baris.length) throw new Error('Tidak ada baris untuk diimpor.');
  var n = 0;
  baris.forEach(function (b) {
    if (b.nama && Number(b.harga) > 0) { AKSI.menuSimpan({ nama: b.nama, kategori: b.kategori, harga: b.harga, kelompok: String(b.kelompok || '').toUpperCase() }, user); n++; }
  });
  return { jumlah: n, menu: AKSI.bootstrap({}, user).menu };
};

// ---------- PENGATURAN ----------
AKSI.pengaturanSimpan = function (d, user) {
  var boleh = ['NAMA_RESTO', 'ALAMAT', 'TAGLINE', 'MULAI_BUKU', 'TARIF_PB1', 'TARIF_SERVICE', 'CATATAN_STRUK'];
  Object.keys(d).forEach(function (k) {
    if (boleh.indexOf(k) < 0) return;
    var v = String(d[k]);
    if ((k === 'TARIF_PB1' || k === 'TARIF_SERVICE') && !(Number(v) >= 0 && Number(v) <= 30)) throw new Error('Tarif harus 0–30%.');
    if (k === 'MULAI_BUKU' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Tanggal mulai buku tidak valid.');
    setSet_(k, v);
  });
  log_(user, 'PENGATURAN_SIMPAN', d);
  return AKSI.bootstrap({}, user).pengaturan;
};

// ---------- PENGGUNA ----------
AKSI.penggunaDaftar = function () {
  return rows_('PENGGUNA').map(function (r) { return { kode: String(r.Kode), nama: r.Nama, peran: r.Peran, aktif: r.Aktif }; });
};

AKSI.penggunaSimpan = function (d, user) {
  var kode = String(d.kode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(kode)) throw new Error('Kode pengguna 2–6 huruf/angka, mis. AGS.');
  if (PERAN.indexOf(d.peran) < 0) throw new Error('Peran tidak valid.');
  var semua = rows_('PENGGUNA');
  var ada = semua.filter(function (r) { return String(r.Kode).toUpperCase() === kode; })[0];
  var salt = getSet_('SALT');
  var obj = { Kode: kode, Nama: d.nama || kode, Peran: d.peran, PinHash: ada ? ada.PinHash : '', Aktif: d.aktif === 'TIDAK' ? 'TIDAK' : 'YA' };
  if (d.pin) {
    if (!/^\d{4,8}$/.test(String(d.pin))) throw new Error('PIN harus 4–8 angka.');
    obj.PinHash = hashPin_(String(d.pin), salt);
  }
  if (!obj.PinHash) throw new Error('PIN wajib diisi untuk pengguna baru.');
  // jangan sampai tidak ada ADMIN aktif
  var adminAktif = semua.filter(function (r) {
    var k = String(r.Kode).toUpperCase();
    var peran = k === kode ? obj.Peran : r.Peran, aktif = k === kode ? obj.Aktif : r.Aktif;
    return peran === 'ADMIN' && aktif === 'YA';
  }).length + (!ada && obj.Peran === 'ADMIN' && obj.Aktif === 'YA' ? 1 : 0);
  if (adminAktif < 1) throw new Error('Harus ada minimal satu ADMIN aktif.');
  if (ada) updateRow_('PENGGUNA', ada._row, obj); else append_('PENGGUNA', [obj]);
  log_(user, 'PENGGUNA_SIMPAN', { kode: kode, peran: obj.Peran, aktif: obj.Aktif, pinDiubah: !!d.pin });
  return AKSI.penggunaDaftar();
};

AKSI.logDaftar = function (d) {
  var r = rows_('LOG');
  return r.slice(Math.max(0, r.length - 300)).reverse().map(function (x) { return { waktu: x.Waktu, user: x.User, aksi: x.Aksi, detail: x.Detail }; });
};

// ===================== JURNAL =====================
/**
 * Menulis satu jurnal (beberapa baris) ke sheet JURNAL.
 * j = {id?, tanggal, keterangan, kelompok: HALAL|ALKOHOL, sumber, ref, baris:[{kode, debit, kredit, kontak}]}
 */
function tulisJurnal_(j, user) {
  var peta = petaAkun_();
  validasiJurnal_(j, peta);
  var id = j.id || (j.kelompok === 'ALKOHOL' ? nomor_('NO_AL', 'AL-', 5) : nomor_('NO_JU', 'JU-', 5));
  var waktu = sekarang_();
  var objs = j.baris.map(function (b) {
    return {
      ID: id, Tanggal: j.tanggal, OPR: user.kode, Keterangan: j.keterangan, Kode: String(b.kode),
      NamaAkun: peta[String(b.kode)].nama, Debit: rp_(b.debit), Kredit: rp_(b.kredit), Kontak: b.kontak || '',
      Kelompok: j.kelompok, Sumber: j.sumber || 'MANUAL', Ref: j.ref || '', DibuatPada: waktu
    };
  });
  append_('JURNAL', objs);
  return id;
}

function validasiJurnal_(j, peta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(j.tanggal || ''))) throw new Error('Tanggal jurnal tidak valid.');
  var mulai = getSet_('MULAI_BUKU');
  if (mulai && j.tanggal < mulai) throw new Error('Tanggal jurnal sebelum tanggal mulai buku (' + mulai + ').');
  if (!j.keterangan) throw new Error('Keterangan wajib diisi.');
  if (['HALAL', 'ALKOHOL'].indexOf(j.kelompok) < 0) throw new Error('Kelompok jurnal harus HALAL atau ALKOHOL.');
  if (!j.baris || j.baris.length < 2) throw new Error('Jurnal minimal 2 baris.');
  var td = 0, tk = 0;
  j.baris.forEach(function (b, i) {
    var a = peta[String(b.kode)];
    if (!a) throw new Error('Baris ' + (i + 1) + ': akun ' + b.kode + ' tidak ada.');
    if (a.aktif !== 'YA') throw new Error('Baris ' + (i + 1) + ': akun ' + b.kode + ' tidak aktif.');
    if (j.kelompok === 'HALAL' && a.kelompok === 'ALKOHOL') throw new Error('Akun ' + a.kode + ' ' + a.nama + ' khusus alkohol, tidak boleh di jurnal halal.');
    if (j.kelompok === 'ALKOHOL' && a.kelompok === 'HALAL') throw new Error('Akun ' + a.kode + ' ' + a.nama + ' tidak boleh di jurnal alkohol.');
    var d = rp_(b.debit), k = rp_(b.kredit);
    if (d < 0 || k < 0) throw new Error('Baris ' + (i + 1) + ': nilai tidak boleh minus.');
    if ((d > 0) === (k > 0)) throw new Error('Baris ' + (i + 1) + ': isi debit ATAU kredit.');
    td += d; tk += k;
  });
  if (td !== tk) throw new Error('Jurnal tidak seimbang: debit ' + td + ' ≠ kredit ' + tk + '.');
  if (td === 0) throw new Error('Nilai jurnal 0.');
}

function barisJurnal_(id) {
  return rows_('JURNAL').filter(function (r) { return String(r.ID) === id; });
}

function cekBolehUbah_(baris, user) {
  if (!baris.length) throw new Error('Jurnal tidak ditemukan.');
  var b = baris[0];
  if (b.Sumber === 'POS' || b.Sumber === 'POS_VOID') throw new Error('Jurnal dari POS tidak bisa diubah. Gunakan void struk.');
  if (user.peran === 'OPERATOR') {
    if (String(b.OPR) !== user.kode) throw new Error('Operator hanya boleh mengubah jurnal miliknya sendiri.');
    if (String(b.DibuatPada).slice(0, 10) !== hariIni_()) throw new Error('Operator hanya boleh mengubah jurnal di hari yang sama.');
  }
}

AKSI.jurnalSimpan = function (d, user) {
  var j = {
    tanggal: d.tanggal, keterangan: String(d.keterangan || '').trim(), kelompok: d.kelompok,
    sumber: 'MANUAL', baris: (d.baris || []).filter(function (b) { return b.kode && (rp_(b.debit) || rp_(b.kredit)); })
  };
  if (d.id) {
    var lama = barisJurnal_(d.id);
    cekBolehUbah_(lama, user);
    if (lama[0].Sumber !== 'MANUAL' && lama[0].Sumber !== 'PEMBELIAN_ALKOHOL') throw new Error('Jurnal ini hanya bisa dihapus, tidak bisa diedit.');
    if (lama[0].Kelompok !== j.kelompok) throw new Error('Kelompok jurnal tidak boleh diubah (JU/AL).');
    validasiJurnal_(j, petaAkun_());
    j.id = d.id;
    j.sumber = lama[0].Sumber;
    deleteRows_('JURNAL', lama.map(function (r) { return r._row; }));
    tulisJurnal_(j, user);
    log_(user, 'JURNAL_EDIT', { id: d.id, sebelum: lama.map(ringkasBaris_), sesudah: j.baris });
    return d.id;
  }
  var id = tulisJurnal_(j, user);
  log_(user, 'JURNAL_BARU', { id: id });
  return id;
};

function ringkasBaris_(r) { return [r.Tanggal, r.Kode, r.Debit, r.Kredit, r.Kontak, r.Keterangan].join('|'); }

AKSI.jurnalHapus = function (d, user) {
  var lama = barisJurnal_(String(d.id || ''));
  cekBolehUbah_(lama, user);
  deleteRows_('JURNAL', lama.map(function (r) { return r._row; }));
  log_(user, 'JURNAL_HAPUS', { id: d.id, baris: lama.map(ringkasBaris_) });
  return 'Jurnal ' + d.id + ' dihapus.';
};

AKSI.jurnalAmbil = function (d) {
  var b = barisJurnal_(String(d.id || ''));
  if (!b.length) throw new Error('Jurnal tidak ditemukan.');
  return {
    id: d.id, tanggal: b[0].Tanggal, keterangan: b[0].Keterangan, kelompok: b[0].Kelompok, sumber: b[0].Sumber,
    baris: b.map(function (r) { return { kode: String(r.Kode), debit: Number(r.Debit) || 0, kredit: Number(r.Kredit) || 0, kontak: String(r.Kontak || '') }; })
  };
};

AKSI.jurnalDaftar = function (d) {
  var dari = d.dari || '0000-00-00', sampai = d.sampai || '9999-99-99';
  var cari = String(d.cari || '').toLowerCase();
  var rows = rows_('JURNAL').filter(function (r) {
    if (r.Tanggal < dari || r.Tanggal > sampai) return false;
    if (d.kelompok && r.Kelompok !== d.kelompok) return false;
    if (d.opr && String(r.OPR) !== d.opr) return false;
    if (d.sumber && r.Sumber !== d.sumber) return false;
    return true;
  });
  // kelompokkan per ID
  var grup = {}, urut = [];
  rows.forEach(function (r) {
    var id = String(r.ID);
    if (!grup[id]) { grup[id] = { id: id, tanggal: r.Tanggal, opr: String(r.OPR), keterangan: r.Keterangan, kelompok: r.Kelompok, sumber: r.Sumber, ref: r.Ref, dibuat: r.DibuatPada, baris: [] }; urut.push(id); }
    grup[id].baris.push({ kode: String(r.Kode), nama: r.NamaAkun, debit: Number(r.Debit) || 0, kredit: Number(r.Kredit) || 0, kontak: String(r.Kontak || '') });
  });
  var hasil = urut.map(function (id) { return grup[id]; }).filter(function (g) {
    if (d.akun && !g.baris.some(function (b) { return b.kode === d.akun; })) return false;
    if (cari && (g.keterangan + ' ' + g.id).toLowerCase().indexOf(cari) < 0) return false;
    return true;
  });
  hasil.sort(function (a, b) { return a.tanggal === b.tanggal ? (a.id < b.id ? 1 : -1) : (a.tanggal < b.tanggal ? 1 : -1); });
  var total = { debit: 0, kredit: 0 };
  hasil.forEach(function (g) { g.baris.forEach(function (b) { total.debit += b.debit; total.kredit += b.kredit; }); });
  return { jurnal: hasil.slice(0, Number(d.batas) || 500), jumlah: hasil.length, total: total };
};

// ---------- Penjualan Harian (sementara, sebelum POS aktif) ----------
AKSI.penjualanHarian = function (d, user) {
  var tgl = d.tanggal, id = [];
  var tglTeks = tglIndo_(tgl);
  var pasang = [
    ['tunaiHalal', 'HALAL', '112', '401', 'OMSET TUNAI ' + tglTeks],
    ['nontunaiHalal', 'HALAL', '113', '401', 'OMSET EDC/QRIS/TRANSFER ' + tglTeks],
    ['tunaiAlkohol', 'ALKOHOL', '112', '410', 'OMSET ALKOHOL TUNAI ' + tglTeks],
    ['nontunaiAlkohol', 'ALKOHOL', '113', '410', 'OMSET ALKOHOL EDC/QRIS/TRANSFER ' + tglTeks]
  ];
  var jurnal = [];
  pasang.forEach(function (p) {
    var n = rp_(d[p[0]]);
    if (n < 0) throw new Error('Nilai omset tidak boleh minus.');
    if (n > 0) jurnal.push({ tanggal: tgl, keterangan: p[4], kelompok: p[1], sumber: 'PENJUALAN_HARIAN', baris: [{ kode: p[2], debit: n }, { kode: p[3], kredit: n }] });
  });
  (d.bon || []).forEach(function (b) {
    var n = rp_(b.jumlah);
    if (!n) return;
    if (!b.kontak) throw new Error('Pilih pelanggan untuk setiap bon.');
    var alk = b.kelompok === 'ALKOHOL';
    jurnal.push({ tanggal: tgl, keterangan: (alk ? 'BON ALKOHOL ' : 'BON ') + b.kontak + ' ' + tglTeks, kelompok: alk ? 'ALKOHOL' : 'HALAL', sumber: 'PENJUALAN_HARIAN',
      baris: [{ kode: '130', debit: n, kontak: b.kontak }, { kode: alk ? '410' : '402', kredit: n }] });
  });
  if (!jurnal.length) throw new Error('Belum ada nilai penjualan yang diisi.');
  var peta = petaAkun_();
  jurnal.forEach(function (j) { validasiJurnal_(j, peta); });
  jurnal.forEach(function (j) { id.push(tulisJurnal_(j, user)); });
  log_(user, 'PENJUALAN_HARIAN', { tanggal: tgl, jurnal: id });
  return id;
};

AKSI.pembelianAlkohol = function (d, user) {
  var n = rp_(d.jumlah);
  if (!(n > 0)) throw new Error('Jumlah pembelian harus lebih dari 0.');
  var bayar = String(d.bayar || '');
  if (['112', '113', '211'].indexOf(bayar) < 0) throw new Error('Pilih cara bayar.');
  if (bayar === '211' && !d.kontak) throw new Error('Pembelian kredit wajib memilih supplier.');
  var j = { tanggal: d.tanggal, keterangan: String(d.keterangan || 'PEMBELIAN ALKOHOL').toUpperCase(), kelompok: 'ALKOHOL', sumber: 'PEMBELIAN_ALKOHOL',
    baris: [{ kode: '151', debit: n }, { kode: bayar, kredit: n, kontak: bayar === '211' ? d.kontak : '' }] };
  var id = tulisJurnal_(j, user);
  log_(user, 'PEMBELIAN_ALKOHOL', { id: id });
  return id;
};

function tglIndo_(t) {
  var p = String(t).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : t;
}

// ===================== POS =====================
AKSI.posSimpan = function (d, user) {
  var menu = {};
  rows_('MENU').forEach(function (m) { menu[String(m.ID)] = m; });
  var items = (d.items || []).filter(function (i) { return Number(i.qty) > 0; });
  if (!items.length) throw new Error('Keranjang kosong.');
  var subH = 0, subA = 0, detail = [];
  items.forEach(function (i) {
    var m = menu[String(i.id)];
    if (!m || m.Aktif !== 'YA') throw new Error('Menu ' + i.id + ' tidak tersedia.');
    var qty = Number(i.qty), harga = Number(m.Harga) || 0, sub = rp_(qty * harga);
    if (m.Kelompok === 'ALKOHOL') subA += sub; else subH += sub;
    detail.push({ IDMenu: String(m.ID), Nama: m.Nama, Kelompok: m.Kelompok, Qty: qty, Harga: harga, Subtotal: sub, Catatan: i.catatan || '' });
  });
  var hitung = hitungStruk_(subH, subA, rp_(d.diskon), Number(getSet_('TARIF_PB1')) || 0, Number(getSet_('TARIF_SERVICE')) || 0);
  var metode = String(d.metode || '');
  if (['TUNAI', 'EDC', 'QRIS', 'TRANSFER', 'BON'].indexOf(metode) < 0) throw new Error('Pilih metode bayar.');
  if (metode === 'BON' && !d.kodePelanggan) throw new Error('Bon wajib memilih pelanggan.');
  var dibayar = metode === 'TUNAI' ? rp_(d.dibayar) : hitung.total;
  if (metode === 'TUNAI' && dibayar < hitung.total) throw new Error('Uang diterima kurang dari total.');
  if (metode === 'BON') dibayar = 0;
  var no = nomor_('NO_POS', 'POS-', 6);
  var now = new Date();
  var trx = {
    No: no, Tanggal: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), Jam: Utilities.formatDate(now, TZ, 'HH:mm'), OPR: user.kode,
    Meja: d.meja || '', KodePelanggan: d.kodePelanggan || '', SubHalal: subH, SubAlkohol: subA, Diskon: hitung.diskon,
    NetHalal: hitung.netH, NetAlkohol: hitung.netA, PajakHalal: hitung.pajakH, PajakAlkohol: hitung.pajakA,
    ServHalal: hitung.servH, ServAlkohol: hitung.servA, Total: hitung.total, Metode: metode, Dibayar: dibayar,
    Kembali: metode === 'TUNAI' ? dibayar - hitung.total : 0, Status: metode === 'BON' ? 'BON' : 'LUNAS', TanggalRekap: '', Catatan: d.catatan || ''
  };
  append_('POS_TRANSAKSI', [trx]);
  append_('POS_DETAIL', detail.map(function (x) { x.No = no; return x; }));
  log_(user, 'POS_SIMPAN', { no: no, total: hitung.total });
  return strukDari_(trx, detail);
};

/** Diskon dibagi proporsional ke halal/alkohol; pajak & service dihitung per kelompok. */
function hitungStruk_(subH, subA, diskon, tarifPb1, tarifServ) {
  var sub = subH + subA;
  diskon = Math.min(Math.max(0, diskon || 0), sub);
  var diskA = sub ? Math.round(diskon * subA / sub) : 0;
  var diskH = diskon - diskA;
  var netH = subH - diskH, netA = subA - diskA;
  var servH = Math.round(netH * tarifServ / 100), servA = Math.round(netA * tarifServ / 100);
  var pajakH = Math.round((netH + servH) * tarifPb1 / 100), pajakA = Math.round((netA + servA) * tarifPb1 / 100);
  return { diskon: diskon, netH: netH, netA: netA, servH: servH, servA: servA, pajakH: pajakH, pajakA: pajakA,
    total: netH + netA + servH + servA + pajakH + pajakA };
}

function strukDari_(t, detail) {
  return {
    no: t.No, tanggal: t.Tanggal, jam: t.Jam, opr: String(t.OPR), meja: t.Meja, pelanggan: String(t.KodePelanggan || ''),
    items: detail.map(function (x) { return { nama: x.Nama, qty: Number(x.Qty), harga: Number(x.Harga), subtotal: Number(x.Subtotal), kelompok: x.Kelompok }; }),
    subtotal: Number(t.SubHalal) + Number(t.SubAlkohol), diskon: Number(t.Diskon),
    service: Number(t.ServHalal) + Number(t.ServAlkohol), pajak: Number(t.PajakHalal) + Number(t.PajakAlkohol),
    total: Number(t.Total), metode: t.Metode, dibayar: Number(t.Dibayar), kembali: Number(t.Kembali), status: t.Status,
    tanggalRekap: t.TanggalRekap
  };
}

AKSI.posDaftar = function (d) {
  var tgl = d.tanggal || hariIni_();
  var trx = rows_('POS_TRANSAKSI').filter(function (t) { return t.Tanggal === tgl; });
  var ringkas = { jumlah: 0, total: 0, tunai: 0, nontunai: 0, bon: 0, halal: 0, alkohol: 0, belumRekap: 0 };
  var daftar = trx.map(function (t) {
    if (t.Status !== 'VOID') {
      ringkas.jumlah++; ringkas.total += Number(t.Total);
      if (t.Metode === 'TUNAI') ringkas.tunai += Number(t.Total); else if (t.Metode === 'BON') ringkas.bon += Number(t.Total); else ringkas.nontunai += Number(t.Total);
      ringkas.halal += Number(t.NetHalal); ringkas.alkohol += Number(t.NetAlkohol);
      if (!t.TanggalRekap) ringkas.belumRekap++;
    }
    return { no: String(t.No), jam: t.Jam, meja: t.Meja, pelanggan: String(t.KodePelanggan || ''), total: Number(t.Total), metode: t.Metode, status: t.Status, opr: String(t.OPR), rekap: t.TanggalRekap };
  }).reverse();
  return { tanggal: tgl, daftar: daftar, ringkas: ringkas };
};

AKSI.posStruk = function (d) {
  var t = rows_('POS_TRANSAKSI').filter(function (x) { return String(x.No) === d.no; })[0];
  if (!t) throw new Error('Struk tidak ditemukan.');
  var det = rows_('POS_DETAIL').filter(function (x) { return String(x.No) === d.no; });
  return strukDari_(t, det);
};

AKSI.posVoid = function (d, user) {
  var t = rows_('POS_TRANSAKSI').filter(function (x) { return String(x.No) === d.no; })[0];
  if (!t) throw new Error('Struk tidak ditemukan.');
  if (t.Status === 'VOID') throw new Error('Struk sudah di-void.');
  if (!d.alasan) throw new Error('Alasan void wajib diisi.');
  var jurnalKoreksi = [];
  if (t.TanggalRekap) {
    // sudah masuk rekap → buat jurnal koreksi (kebalikan)
    jurnalRekapStruk_([t], true).forEach(function (j) {
      j.tanggal = hariIni_();
      j.keterangan = 'VOID ' + t.No + ' (' + d.alasan + ')';
      j.sumber = 'POS_VOID';
      j.ref = String(t.No);
      jurnalKoreksi.push(tulisJurnal_(j, user));
    });
  }
  t.Status = 'VOID';
  t.Catatan = (t.Catatan ? t.Catatan + ' | ' : '') + 'VOID oleh ' + user.kode + ': ' + d.alasan;
  updateRow_('POS_TRANSAKSI', t._row, t);
  log_(user, 'POS_VOID', { no: t.No, alasan: d.alasan, jurnal: jurnalKoreksi });
  return { no: t.No, jurnalKoreksi: jurnalKoreksi };
};

/**
 * Menyusun jurnal rekap dari sekumpulan struk.
 * Dipisah: kelompok (HALAL/ALKOHOL) × cara bayar (TUNAI→112, EDC/QRIS/TRANSFER→113, BON→130 per pelanggan).
 * balik = true → jurnal kebalikan (untuk void).
 */
function jurnalRekapStruk_(trx, balik) {
  var grup = {};
  trx.forEach(function (t) {
    ['HALAL', 'ALKOHOL'].forEach(function (kel) {
      var h = kel === 'HALAL';
      var net = Number(h ? t.NetHalal : t.NetAlkohol) || 0;
      var pajak = Number(h ? t.PajakHalal : t.PajakAlkohol) || 0;
      var serv = Number(h ? t.ServHalal : t.ServAlkohol) || 0;
      if (!(net + pajak + serv)) return;
      var cara = t.Metode === 'TUNAI' ? 'TUNAI' : (t.Metode === 'BON' ? 'BON' : 'NONTUNAI');
      var kunci = kel + '|' + cara + '|' + (cara === 'BON' ? t.KodePelanggan : '');
      if (!grup[kunci]) grup[kunci] = { kel: kel, cara: cara, kontak: cara === 'BON' ? String(t.KodePelanggan) : '', net: 0, pajak: 0, serv: 0, no: [] };
      var g = grup[kunci];
      g.net += net; g.pajak += pajak; g.serv += serv; g.no.push(String(t.No));
    });
  });
  var nama = { TUNAI: 'TUNAI', NONTUNAI: 'EDC/QRIS/TRANSFER', BON: 'BON' };
  return Object.keys(grup).sort().map(function (k) {
    var g = grup[k], alk = g.kel === 'ALKOHOL';
    var debitAkun = g.cara === 'TUNAI' ? '112' : (g.cara === 'NONTUNAI' ? '113' : '130');
    var pendapatan = alk ? '410' : (g.cara === 'BON' ? '402' : '401');
    var total = g.net + g.pajak + g.serv;
    var baris = [{ kode: debitAkun, debit: total, kontak: g.kontak }, { kode: pendapatan, kredit: g.net }];
    if (g.serv) baris.push({ kode: '221', kredit: g.serv });
    if (g.pajak) baris.push({ kode: '220', kredit: g.pajak });
    if (balik) baris.forEach(function (b) { var x = b.debit || 0; b.debit = b.kredit || 0; b.kredit = x; });
    return {
      kelompok: g.kel, sumber: 'POS', ref: g.no.join(','),
      keterangan: 'OMSET ' + (alk ? 'ALKOHOL ' : '') + nama[g.cara] + (g.kontak ? ' ' + g.kontak : ''),
      baris: baris.filter(function (b) { return (b.debit || 0) + (b.kredit || 0) > 0; })
    };
  });
}

function tutupKasir_(tanggal, user) {
  var trx = rows_('POS_TRANSAKSI').filter(function (t) {
    return t.Tanggal === tanggal && (t.Status === 'LUNAS' || t.Status === 'BON') && !t.TanggalRekap;
  });
  if (!trx.length) return { tanggal: tanggal, jurnal: [], struk: 0 };
  var ids = [];
  var jurnal = jurnalRekapStruk_(trx, false);
  var peta = petaAkun_();
  jurnal.forEach(function (j) {
    j.tanggal = tanggal;
    j.keterangan = j.keterangan + ' ' + tglIndo_(tanggal);
    validasiJurnal_(j, peta);
  });
  jurnal.forEach(function (j) { ids.push(tulisJurnal_(j, user)); });
  var stamp = sekarang_();
  trx.forEach(function (t) { t.TanggalRekap = stamp; updateRow_('POS_TRANSAKSI', t._row, t); });
  log_(user, 'TUTUP_KASIR', { tanggal: tanggal, jurnal: ids, struk: trx.length });
  return { tanggal: tanggal, jurnal: ids, struk: trx.length };
}

AKSI.posTutupKasir = function (d, user) {
  return tutupKasir_(d.tanggal || hariIni_(), user);
};

/** Dipanggil trigger harian: rekap semua tanggal sebelum hari ini yang belum direkap. */
function tutupKasirOtomatis() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var hari = hariIni_(), tgl = {};
    rows_('POS_TRANSAKSI').forEach(function (t) {
      if (t.Tanggal < hari && !t.TanggalRekap && (t.Status === 'LUNAS' || t.Status === 'BON')) tgl[t.Tanggal] = 1;
    });
    Object.keys(tgl).sort().forEach(function (x) { tutupKasir_(x, { kode: 'SYSTEM', nama: 'Otomatis', peran: 'ADMIN' }); });
  } finally { lock.releaseLock(); }
}

// ===================== STOK OPNAME =====================
AKSI.stokDaftar = function (d) {
  var semua = rows_('STOK_OPNAME');
  var tanggalList = {};
  semua.forEach(function (r) { tanggalList[r.Tanggal + '|' + r.Kelompok] = 1; });
  var tgl = d.tanggal;
  var kel = d.kelompok === 'ALKOHOL' ? 'ALKOHOL' : 'HALAL';
  var isi = semua.filter(function (r) { return r.Tanggal === tgl && r.Kelompok === kel; });
  var contoh = [];
  if (!isi.length) {
    // pakai daftar barang dari opname terakhir kelompok ini sebagai template (qty dikosongkan)
    var terakhir = semua.filter(function (r) { return r.Kelompok === kel; }).map(function (r) { return r.Tanggal; }).sort().pop();
    if (terakhir) contoh = semua.filter(function (r) { return r.Tanggal === terakhir && r.Kelompok === kel; })
      .map(function (r) { return { nama: r.NamaBarang, satuan: r.Satuan, qty: '', harga: Number(r.Harga) || 0 }; });
  }
  return {
    riwayat: Object.keys(tanggalList).sort().reverse().map(function (k) { var p = k.split('|'); return { tanggal: p[0], kelompok: p[1] }; }),
    baris: isi.map(function (r) { return { nama: r.NamaBarang, satuan: r.Satuan, qty: Number(r.Qty) || 0, harga: Number(r.Harga) || 0 }; }),
    template: contoh
  };
};

AKSI.stokSimpan = function (d, user) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) throw new Error('Tanggal opname tidak valid.');
  var kel = d.kelompok === 'ALKOHOL' ? 'ALKOHOL' : 'HALAL';
  var lama = rows_('STOK_OPNAME').filter(function (r) { return r.Tanggal === d.tanggal && r.Kelompok === kel; });
  deleteRows_('STOK_OPNAME', lama.map(function (r) { return r._row; }));
  var baru = (d.baris || []).filter(function (b) { return b.nama && Number(b.qty) > 0; }).map(function (b) {
    var qty = Number(b.qty), harga = Number(b.harga) || 0;
    return { Tanggal: d.tanggal, NamaBarang: String(b.nama).toUpperCase(), Satuan: b.satuan || '', Qty: qty, Harga: harga, Total: rp_(qty * harga), Kelompok: kel };
  });
  append_('STOK_OPNAME', baru);
  var total = baru.reduce(function (s, b) { return s + b.Total; }, 0);
  log_(user, 'STOK_SIMPAN', { tanggal: d.tanggal, kelompok: kel, baris: baru.length, total: total });
  return { baris: baru.length, total: total };
};

// ===================== SALDO AWAL =====================
AKSI.saldoAwalDaftar = function () {
  return { mulai: getSet_('MULAI_BUKU'), saldo: rows_('SALDO_AWAL').map(function (r) { return { kode: String(r.Kode), kontak: String(r.Kontak || ''), saldo: Number(r.Saldo) || 0 }; }) };
};

AKSI.saldoAwalSimpan = function (d, user) {
  var peta = petaAkun_();
  var baris = (d.saldo || []).filter(function (s) { return s.kode && rp_(s.saldo); });
  var td = 0, tk = 0;
  baris.forEach(function (s) {
    var a = peta[String(s.kode)];
    if (!a) throw new Error('Akun ' + s.kode + ' tidak ada.');
    if (a.pos !== 'NERACA') throw new Error('Saldo awal hanya untuk akun neraca (' + s.kode + ' adalah akun laba rugi).');
    var n = rp_(s.saldo);
    var sisiDebit = (a.normal === 'DEBIT') === (n >= 0);
    if (sisiDebit) td += Math.abs(n); else tk += Math.abs(n);
  });
  if (td !== tk && !d.paksa) throw new Error('Saldo awal tidak seimbang: debit ' + td + ' ≠ kredit ' + tk + '. Selisih ' + (td - tk) + '.');
  var lama = rows_('SALDO_AWAL');
  deleteRows_('SALDO_AWAL', lama.map(function (r) { return r._row; }));
  append_('SALDO_AWAL', baris.map(function (s) { return { Kode: String(s.kode), Kontak: s.kontak || '', Saldo: rp_(s.saldo) }; }));
  log_(user, 'SALDO_AWAL', { baris: baris.length, debit: td, kredit: tk });
  return AKSI.saldoAwalDaftar();
};

// ===================== MESIN LAPORAN =====================
function konteks_() {
  return {
    akun: daftarAkun_(),
    jurnal: rows_('JURNAL').map(function (r) {
      return { id: String(r.ID), tgl: r.Tanggal, kode: String(r.Kode), d: Number(r.Debit) || 0, k: Number(r.Kredit) || 0, kontak: String(r.Kontak || ''), ket: r.Keterangan, opr: String(r.OPR), kel: r.Kelompok, sumber: r.Sumber };
    }),
    saldoAwal: rows_('SALDO_AWAL').map(function (r) { return { kode: String(r.Kode), kontak: String(r.Kontak || ''), saldo: Number(r.Saldo) || 0 }; }),
    stok: rows_('STOK_OPNAME').map(function (r) { return { tgl: r.Tanggal, kel: r.Kelompok, total: Number(r.Total) || 0 }; }),
    mulai: getSet_('MULAI_BUKU') || '0000-01-01'
  };
}

/** Nilai D−K saldo awal sebuah akun (opsional per kontak). */
function awalDK_(ctx, kode, kontak) {
  var a = ctx.akun.filter(function (x) { return x.kode === kode; })[0];
  var s = 0;
  ctx.saldoAwal.forEach(function (r) {
    if (r.kode !== kode) return;
    if (kontak !== undefined && r.kontak !== kontak) return;
    s += r.saldo;
  });
  return a && a.normal === 'KREDIT' ? -s : s;
}

/** Jumlah D−K mutasi jurnal untuk akun dalam rentang tanggal (inklusif). */
function mutasiDK_(ctx, kode, dari, sampai, kontak) {
  var s = 0;
  ctx.jurnal.forEach(function (j) {
    if (j.kode !== kode || j.tgl < dari || j.tgl > sampai) return;
    if (kontak !== undefined && j.kontak !== kontak) return;
    s += j.d - j.k;
  });
  return s;
}

function hariSebelum_(t) {
  var p = t.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Nilai stok opname terakhir (kelompok) dengan tanggal <= batas. null bila belum ada. */
function opname_(ctx, kel, batas) {
  var tgl = null;
  ctx.stok.forEach(function (s) { if (s.kel === kel && s.tgl <= batas && (!tgl || s.tgl > tgl)) tgl = s.tgl; });
  if (!tgl) return null;
  var total = 0;
  ctx.stok.forEach(function (s) { if (s.kel === kel && s.tgl === tgl) total += s.total; });
  return { tanggal: tgl, total: total };
}

/**
 * Nilai persediaan pada akhir tanggal `batas`:
 * - stok opname terakhir <= batas bila ada (dan tidak sebelum tanggal mulai buku),
 * - selain itu saldo buku akun persediaan.
 */
function nilaiPersediaan_(ctx, kel, akunKode, batas) {
  var op = opname_(ctx, kel === 'ALKOHOL' ? 'ALKOHOL' : 'HALAL', batas);
  if (op && op.tanggal >= ctx.mulai) return { nilai: op.total, sumber: 'Stok opname ' + op.tanggal, tanggal: op.tanggal };
  return { nilai: awalDK_(ctx, akunKode) + mutasiDK_(ctx, akunKode, '0000-01-01', batas), sumber: 'Saldo buku akun ' + akunKode, tanggal: null };
}

/**
 * Laba Rugi periode [dari, sampai].
 * Bagian 1 usaha halal (semua akun laba rugi selain kelompok ALKOHOL),
 * Bagian 2 perhitungan hasil alkohol (akun laba rugi kelompok ALKOHOL).
 */
function hitungLabaRugi_(ctx, dari, sampai) {
  var sebelum = hariSebelum_(dari);
  function bagian(alk) {
    var kelOk = function (a) { return alk ? a.kelompok === 'ALKOHOL' : a.kelompok !== 'ALKOHOL'; };
    var persKode = alk ? '152' : '140';
    var pend = [], beli = [], beban = [], zakat = [];
    ctx.akun.forEach(function (a) {
      if (!kelOk(a)) return;
      var m = mutasiDK_(ctx, a.kode, dari, sampai);
      if (a.golongan === 'PENDAPATAN') pend.push({ kode: a.kode, nama: a.nama, nilai: -m });
      else if (a.golongan === 'PEMBELIAN') beli.push({ kode: a.kode, nama: a.nama, nilai: m });
      else if (a.golongan === 'BEBAN') beban.push({ kode: a.kode, nama: a.nama, nilai: m });
      else if (a.golongan === 'ZAKAT') zakat.push({ kode: a.kode, nama: a.nama, nilai: m });
    });
    var tambahPers = mutasiDK_(ctx, persKode, dari, sampai); // jurnal langsung ke akun persediaan
    if (tambahPers) beli.push({ kode: persKode, nama: 'Penambahan langsung ke akun persediaan', nilai: tambahPers });
    var awal = nilaiPersediaan_(ctx, alk ? 'ALKOHOL' : 'HALAL', persKode, sebelum);
    var akhir = nilaiPersediaan_(ctx, alk ? 'ALKOHOL' : 'HALAL', persKode, sampai);
    var jml = function (arr) { return arr.reduce(function (s, x) { return s + x.nilai; }, 0); };
    var totPend = jml(pend), totBeli = jml(beli);
    var siapJual = awal.nilai + totBeli;
    var hpp = siapJual - akhir.nilai;
    var labaKotor = totPend - hpp;
    var totBeban = jml(beban);
    var sebelumZakat = labaKotor - totBeban;
    var totZakat = jml(zakat);
    return {
      pendapatan: pend, totalPendapatan: totPend,
      persediaanAwal: awal, pembelian: beli, totalPembelian: totBeli, barangSiapJual: siapJual,
      persediaanAkhir: akhir, hpp: hpp, labaKotor: labaKotor,
      beban: beban, totalBeban: totBeban, labaSebelumZakat: sebelumZakat,
      zakat: zakat, totalZakat: totZakat, labaBersih: sebelumZakat - totZakat
    };
  }
  var halal = bagian(false), alk = bagian(true);
  return {
    dari: dari, sampai: sampai,
    halal: halal,
    alkohol: {
      penjualan: alk.pendapatan, totalPenjualan: alk.totalPendapatan,
      persediaanAwal: alk.persediaanAwal, pembelian: alk.pembelian, totalPembelian: alk.totalPembelian,
      persediaanAkhir: alk.persediaanAkhir, hpp: alk.hpp, beban: alk.beban, totalBeban: alk.totalBeban,
      hasil: alk.labaBersih
    }
  };
}

/** Neraca pada tanggal `per`. Laba berjalan & hasil alkohol dihitung dari tanggal mulai buku. */
function hitungNeraca_(ctx, per) {
  var lr = hitungLabaRugi_(ctx, ctx.mulai, per);
  var aktiva = { ASET_LANCAR: [], PERSEDIAAN: [], ASET_TETAP: [], AKUM_PENY: [] };
  var hutang = [], modal = [];
  var danaBuku = 0;
  ctx.akun.forEach(function (a) {
    if (a.pos !== 'NERACA') return;
    var dk = awalDK_(ctx, a.kode) + mutasiDK_(ctx, a.kode, '0000-01-01', per);
    if (a.golongan === 'PERSEDIAAN') {
      var n = a.kode === '152' ? lr.alkohol.persediaanAkhir.nilai : (a.kode === '140' ? lr.halal.persediaanAkhir.nilai : dk);
      aktiva.PERSEDIAAN.push({ kode: a.kode, nama: a.nama, nilai: n, kelompok: a.kelompok });
    } else if (GOL_AKTIVA.indexOf(a.golongan) >= 0) {
      aktiva[a.golongan].push({ kode: a.kode, nama: a.nama, nilai: dk, kelompok: a.kelompok });
    } else if (a.golongan === 'HUTANG') {
      hutang.push({ kode: a.kode, nama: a.nama, nilai: -dk });
    } else if (a.golongan === 'MODAL') {
      modal.push({ kode: a.kode, nama: a.nama, nilai: -dk });
    } else if (a.golongan === 'DANA_ALKOHOL') {
      danaBuku += -dk;
    }
  });
  var jml = function (arr) { return arr.reduce(function (s, x) { return s + x.nilai; }, 0); };
  var totLancar = jml(aktiva.ASET_LANCAR) + jml(aktiva.PERSEDIAAN);
  var totTetap = jml(aktiva.ASET_TETAP) + jml(aktiva.AKUM_PENY);
  var totAktiva = totLancar + totTetap;
  var totHutang = jml(hutang), totModal = jml(modal);
  var labaBerjalan = lr.halal.labaBersih;
  var dana = { saldoBuku: danaBuku, hasilAkumulasi: lr.alkohol.hasil, total: danaBuku + lr.alkohol.hasil };
  var totPassiva = totHutang + totModal + labaBerjalan + dana.total;
  // porsi kas yang merupakan dana alkohol (kas tetap satu, ditandai kelompok)
  return {
    per: per, mulai: ctx.mulai,
    asetLancar: aktiva.ASET_LANCAR, persediaan: aktiva.PERSEDIAAN, totalAsetLancar: totLancar,
    asetTetap: aktiva.ASET_TETAP, akumPeny: aktiva.AKUM_PENY, totalAsetTetap: totTetap,
    totalAktiva: totAktiva,
    hutang: hutang, totalHutang: totHutang, modal: modal, totalModal: totModal,
    labaBerjalan: labaBerjalan, danaAlkohol: dana, totalPassiva: totPassiva,
    selisih: totAktiva - totPassiva
  };
}

AKSI.laporan = function (d) {
  var ctx = konteks_();
  var dari = d.dari || ctx.mulai, sampai = d.sampai || hariIni_();
  if (dari < ctx.mulai) dari = ctx.mulai;
  return { labaRugi: hitungLabaRugi_(ctx, dari, sampai), neraca: hitungNeraca_(ctx, sampai) };
};

function hitungBukuBesar_(ctx, kode, dari, sampai, kontak) {
  var a = ctx.akun.filter(function (x) { return x.kode === kode; })[0];
  if (!a) throw new Error('Akun tidak ditemukan.');
  var tanda = a.normal === 'KREDIT' ? -1 : 1;
  var awal = (awalDK_(ctx, kode, kontak) + mutasiDK_(ctx, kode, '0000-01-01', hariSebelum_(dari), kontak)) * tanda;
  var perId = {};
  ctx.jurnal.forEach(function (j) { (perId[j.id] = perId[j.id] || []).push(j); });
  var baris = ctx.jurnal.filter(function (j) {
    return j.kode === kode && j.tgl >= dari && j.tgl <= sampai && (kontak === undefined || j.kontak === kontak);
  }).sort(function (x, y) { return x.tgl === y.tgl ? (x.id < y.id ? -1 : 1) : (x.tgl < y.tgl ? -1 : 1); });
  var saldo = awal, td = 0, tk = 0;
  var out = baris.map(function (j) {
    saldo += (j.d - j.k) * tanda; td += j.d; tk += j.k;
    var lawan = perId[j.id].filter(function (x) { return x.kode !== kode; }).map(function (x) { return x.kode; });
    return { id: j.id, tanggal: j.tgl, opr: j.opr, keterangan: j.ket, lawan: lawan.filter(function (v, i) { return lawan.indexOf(v) === i; }).join(', '), kontak: j.kontak, kelompok: j.kel, debit: j.d, kredit: j.k, saldo: saldo };
  });
  return { akun: a, dari: dari, sampai: sampai, saldoAwal: awal, totalDebit: td, totalKredit: tk, saldoAkhir: saldo, baris: out };
}

AKSI.bukuBesar = function (d) {
  var ctx = konteks_();
  var hasil = hitungBukuBesar_(ctx, String(d.kode), d.dari || ctx.mulai, d.sampai || hariIni_());
  // porsi alkohol pada akun kas/bank (kas tetap satu)
  var porsi = { halal: 0, alkohol: 0 };
  hasil.baris.forEach(function (b) { var n = b.debit - b.kredit; if (b.kelompok === 'ALKOHOL') porsi.alkohol += n; else porsi.halal += n; });
  hasil.porsiMutasi = porsi;
  return hasil;
};

function hitungBukuPembantu_(ctx, jenis, dari, sampai) {
  var p = PEMBANTU[jenis];
  if (!p) throw new Error('Jenis buku pembantu tidak dikenal.');
  var kontak = {};
  ctx.jurnal.forEach(function (j) { if (p.akun.indexOf(j.kode) >= 0 && j.kontak && j.kontak.indexOf(jenis) === 0) kontak[j.kontak] = 1; });
  ctx.saldoAwal.forEach(function (s) { if (p.akun.indexOf(s.kode) >= 0 && s.kontak && s.kontak.indexOf(jenis) === 0) kontak[s.kontak] = 1; });
  (ctx.kontak || []).forEach(function (k) { if (k.kode.indexOf(jenis) === 0) kontak[k.kode] = 1; });
  var baris = Object.keys(kontak).sort().map(function (kd) {
    var r = { kontak: kd, saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0 };
    p.akun.forEach(function (ak) {
      var bb = hitungBukuBesar_(ctx, ak, dari, sampai, kd);
      r.saldoAwal += bb.saldoAwal; r.debit += bb.totalDebit; r.kredit += bb.totalKredit; r.saldoAkhir += bb.saldoAkhir;
    });
    return r;
  });
  var tot = { saldoAwal: 0, debit: 0, kredit: 0, saldoAkhir: 0 };
  baris.forEach(function (r) { tot.saldoAwal += r.saldoAwal; tot.debit += r.debit; tot.kredit += r.kredit; tot.saldoAkhir += r.saldoAkhir; });
  var induk = 0;
  p.akun.forEach(function (ak) { induk += hitungBukuBesar_(ctx, ak, dari, sampai).saldoAkhir; });
  return { jenis: jenis, nama: p.nama, akun: p.akun, baris: baris, total: tot, saldoAkunInduk: induk, selisih: induk - tot.saldoAkhir };
}

AKSI.bukuPembantu = function (d) {
  var ctx = konteks_();
  ctx.kontak = AKSI.bootstrap({}, { peran: 'ADMIN' }).kontak;
  return hitungBukuPembantu_(ctx, String(d.jenis || 'CS'), d.dari || ctx.mulai, d.sampai || hariIni_());
};

AKSI.kartuKontak = function (d) {
  var ctx = konteks_();
  var kd = String(d.kontak || '');
  var jenis = kd.slice(0, 2);
  var p = PEMBANTU[jenis];
  if (!p) throw new Error('Kontak tidak dikenal.');
  var dari = d.dari || ctx.mulai, sampai = d.sampai || hariIni_();
  var semua = { saldoAwal: 0, totalDebit: 0, totalKredit: 0, saldoAkhir: 0, baris: [] };
  p.akun.forEach(function (ak) {
    var bb = hitungBukuBesar_(ctx, ak, dari, sampai, kd);
    semua.saldoAwal += bb.saldoAwal; semua.totalDebit += bb.totalDebit; semua.totalKredit += bb.totalKredit; semua.saldoAkhir += bb.saldoAkhir;
    bb.baris.forEach(function (b) { b.akun = ak; semua.baris.push(b); });
  });
  semua.baris.sort(function (x, y) { return x.tanggal === y.tanggal ? (x.id < y.id ? -1 : 1) : (x.tanggal < y.tanggal ? -1 : 1); });
  var s = semua.saldoAwal;
  var tanda = petaAkunCtx_(ctx)[p.akun[0]].normal === 'KREDIT' ? -1 : 1;
  semua.baris.forEach(function (b) { s += (b.debit - b.kredit) * tanda; b.saldo = s; });
  semua.kontak = kd; semua.nama = p.nama; semua.dari = dari; semua.sampai = sampai;
  return semua;
};

function petaAkunCtx_(ctx) { var m = {}; ctx.akun.forEach(function (a) { m[a.kode] = a; }); return m; }

// ===== ekspor untuk pengujian di luar Apps Script (diabaikan oleh Google) =====
if (typeof module !== 'undefined') {
  module.exports = { hitungLabaRugi_: hitungLabaRugi_, hitungNeraca_: hitungNeraca_, hitungBukuBesar_: hitungBukuBesar_,
    hitungBukuPembantu_: hitungBukuPembantu_, jurnalRekapStruk_: jurnalRekapStruk_, hitungStruk_: hitungStruk_,
    validasiJurnal_: validasiJurnal_, COA: COA, posDari_: posDari_, setGetSet: function (f) { getSet_ = f; } };
}
