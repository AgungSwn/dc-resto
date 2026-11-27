// Uji logika akuntansi Code.gs di Node (tanpa Google)
const fs = require('fs');
const path = process.argv[2];
const src = fs.readFileSync(path, 'utf8');
const m = { exports: {} };
new Function('module', src)(m);
const C = m.exports;
C.setGetSet(k => (k === 'MULAI_BUKU' ? '2026-05-01' : ''));
let gagal = 0;
const cek = (nama, cond, info) => { console.log((cond ? 'OK   ' : 'GAGAL') + ' ' + nama + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); if (!cond) gagal++; };

const akun = C.COA.map(r => ({ kode: r[0], nama: r[1], normal: r[2], golongan: r[3], kelompok: r[4], pos: C.posDari_(r[3]), aktif: 'YA' }));
const peta = {}; akun.forEach(a => (peta[a.kode] = a));
let jurnal = [], n = 0;
function j(tgl, kel, baris, ket) {
  const id = (kel === 'ALKOHOL' ? 'AL-' : 'JU-') + (++n);
  C.validasiJurnal_({ tanggal: tgl, keterangan: ket || 'x', kelompok: kel, baris }, peta);
  baris.forEach(b => jurnal.push({ id, tgl, kode: b.kode, d: b.debit || 0, k: b.kredit || 0, kontak: b.kontak || '', ket: ket || 'x', opr: 'T', kel }));
}
const saldoAwal = [
  { kode: '113', kontak: '', saldo: 50000000 },
  { kode: '140', kontak: '', saldo: 2000000 },
  { kode: '172', kontak: '', saldo: 100000000 },
  { kode: '210', kontak: '', saldo: 150000000 },
  { kode: '300', kontak: '', saldo: 2000000 },
  { kode: '130', kontak: 'CS001', saldo: 0 }
];
// Mei
j('2026-05-02', 'HALAL', [{ kode: '141', debit: 3000000 }, { kode: '112', kredit: 3000000 }], 'Belanja');
j('2026-05-02', 'HALAL', [{ kode: '112', debit: 5000000 }, { kode: '113', kredit: 5000000 }], 'Isi kas kecil');
j('2026-05-03', 'HALAL', [{ kode: '112', debit: 800000 }, { kode: '401', kredit: 800000 }], 'Omset tunai');
j('2026-05-03', 'HALAL', [{ kode: '113', debit: 400000 }, { kode: '401', kredit: 400000 }], 'Omset EDC');
j('2026-05-03', 'ALKOHOL', [{ kode: '112', debit: 140000 }, { kode: '410', kredit: 140000 }], 'Omset alkohol');
j('2026-05-04', 'ALKOHOL', [{ kode: '151', debit: 500000 }, { kode: '211', kredit: 500000, kontak: 'SP001' }], 'Beli bir');
j('2026-05-05', 'HALAL', [{ kode: '130', debit: 250000, kontak: 'CS001' }, { kode: '402', kredit: 250000 }], 'Bon NPDC');
j('2026-05-10', 'HALAL', [{ kode: '601', debit: 1500000 }, { kode: '113', kredit: 1500000 }], 'Gaji');
j('2026-05-20', 'HALAL', [{ kode: '112', debit: 100000 }, { kode: '130', kredit: 100000, kontak: 'CS001' }], 'Pelunasan sebagian');
j('2026-05-25', 'HALAL', [{ kode: '700', debit: 50000 }, { kode: '112', kredit: 50000 }], 'Zakat');
// Juni
j('2026-06-03', 'HALAL', [{ kode: '112', debit: 900000 }, { kode: '401', kredit: 900000 }], 'Omset');
j('2026-06-03', 'ALKOHOL', [{ kode: '113', debit: 210000 }, { kode: '410', kredit: 210000 }], 'Omset alk');
j('2026-06-05', 'HALAL', [{ kode: '141', debit: 1000000 }, { kode: '112', kredit: 1000000 }], 'Belanja');
const stok = [
  { tgl: '2026-05-31', kel: 'HALAL', total: 1800000 },
  { tgl: '2026-05-31', kel: 'ALKOHOL', total: 300000 },
  { tgl: '2026-06-30', kel: 'HALAL', total: 1500000 },
  { tgl: '2026-06-30', kel: 'ALKOHOL', total: 250000 }
];
const ctx = { akun, jurnal, saldoAwal, stok, mulai: '2026-05-01', kontak: [{ kode: 'CS001' }, { kode: 'SP001' }] };

// Validasi aturan kelompok
let err = '';
try { C.validasiJurnal_({ tanggal: '2026-05-03', keterangan: 'x', kelompok: 'HALAL', baris: [{ kode: '112', debit: 1 }, { kode: '410', kredit: 1 }] }, peta); } catch (e) { err = e.message; }
cek('Akun alkohol ditolak di jurnal halal', /khusus alkohol/.test(err), err);
err = '';
try { C.validasiJurnal_({ tanggal: '2026-05-03', keterangan: 'x', kelompok: 'ALKOHOL', baris: [{ kode: '112', debit: 1 }, { kode: '401', kredit: 1 }] }, peta); } catch (e) { err = e.message; }
cek('Akun halal ditolak di jurnal alkohol', /tidak boleh di jurnal alkohol/.test(err), err);
err = '';
try { C.validasiJurnal_({ tanggal: '2026-05-03', keterangan: 'x', kelompok: 'HALAL', baris: [{ kode: '112', debit: 2 }, { kode: '401', kredit: 1 }] }, peta); } catch (e) { err = e.message; }
cek('Jurnal tidak seimbang ditolak', /tidak seimbang/.test(err), err);
err = '';
try { C.validasiJurnal_({ tanggal: '2026-04-30', keterangan: 'x', kelompok: 'HALAL', baris: [{ kode: '112', debit: 1 }, { kode: '401', kredit: 1 }] }, peta); } catch (e) { err = e.message; }
cek('Tanggal sebelum mulai buku ditolak', /mulai buku/.test(err), err);

// Laba rugi Mei
const lrMei = C.hitungLabaRugi_(ctx, '2026-05-01', '2026-05-31');
// pendapatan halal 800+400+250 = 1.450.000 ; HPP = 2.000.000 + 3.000.000 - 1.800.000 = 3.200.000 ; beban 1.500.000; zakat 50.000
cek('Pendapatan halal Mei', lrMei.halal.totalPendapatan === 1450000, lrMei.halal.totalPendapatan);
cek('HPP halal Mei', lrMei.halal.hpp === 3200000, lrMei.halal.hpp);
cek('Laba sebelum zakat Mei', lrMei.halal.labaSebelumZakat === 1450000 - 3200000 - 1500000, lrMei.halal.labaSebelumZakat);
cek('Laba bersih Mei (setelah zakat)', lrMei.halal.labaBersih === 1450000 - 3200000 - 1500000 - 50000, lrMei.halal.labaBersih);
// alkohol: 140.000 - (0 + 500.000 - 300.000) = -60.000
cek('Hasil alkohol Mei terpisah', lrMei.alkohol.hasil === 140000 - 200000, lrMei.alkohol.hasil);
cek('Penjualan alkohol tidak masuk pendapatan halal', !lrMei.halal.pendapatan.some(p => p.kode === '410'));

// LR Juni (persediaan awal = opname 31 Mei)
const lrJun = C.hitungLabaRugi_(ctx, '2026-06-01', '2026-06-30');
cek('Persediaan awal Juni = opname 31 Mei', lrJun.halal.persediaanAwal.nilai === 1800000, lrJun.halal.persediaanAwal);
cek('HPP Juni', lrJun.halal.hpp === 1800000 + 1000000 - 1500000, lrJun.halal.hpp);
// kumulatif = Mei + Juni
const lrAll = C.hitungLabaRugi_(ctx, '2026-05-01', '2026-06-30');
cek('LR kumulatif = Mei + Juni', lrAll.halal.labaBersih === lrMei.halal.labaBersih + lrJun.halal.labaBersih, [lrAll.halal.labaBersih, lrMei.halal.labaBersih + lrJun.halal.labaBersih]);
cek('Hasil alkohol kumulatif = Mei + Juni', lrAll.alkohol.hasil === lrMei.alkohol.hasil + lrJun.alkohol.hasil);

// Neraca harus seimbang di berbagai tanggal
['2026-05-01', '2026-05-15', '2026-05-31', '2026-06-04', '2026-06-30', '2026-07-31'].forEach(t => {
  const nr = C.hitungNeraca_(ctx, t);
  cek('Neraca seimbang per ' + t, nr.selisih === 0, { aktiva: nr.totalAktiva, passiva: nr.totalPassiva, selisih: nr.selisih });
});
const nrJun = C.hitungNeraca_(ctx, '2026-06-30');
cek('Dana Hasil Alkohol di neraca', nrJun.danaAlkohol.total === lrAll.alkohol.hasil, nrJun.danaAlkohol);
cek('Persediaan alkohol di neraca = opname', nrJun.persediaan.find(p => p.kode === '152').nilai === 250000);

// Penyaluran dana (nanti): Dr 305 Cr 113 → tetap seimbang
const ctx2 = JSON.parse(JSON.stringify(ctx));
ctx2.jurnal.push({ id: 'AL-99', tgl: '2026-06-30', kode: '305', d: 10000, k: 0, kontak: '', ket: 'salur', opr: 'T', kel: 'ALKOHOL' });
ctx2.jurnal.push({ id: 'AL-99', tgl: '2026-06-30', kode: '113', d: 0, k: 10000, kontak: '', ket: 'salur', opr: 'T', kel: 'ALKOHOL' });
const nr2 = C.hitungNeraca_(ctx2, '2026-06-30');
cek('Neraca seimbang setelah penyaluran dana alkohol', nr2.selisih === 0 && nr2.danaAlkohol.total === lrAll.alkohol.hasil - 10000, nr2.danaAlkohol);

// Buku besar kas kecil
const bb = C.hitungBukuBesar_(ctx, '112', '2026-05-01', '2026-05-31');
cek('Buku besar 112 saldo akhir Mei', bb.saldoAkhir === -3000000 + 5000000 + 800000 + 140000 + 100000 - 50000, bb.saldoAkhir);
const bb2 = C.hitungBukuBesar_(ctx, '112', '2026-06-01', '2026-06-30');
cek('Saldo awal 112 Juni = saldo akhir Mei', bb2.saldoAwal === bb.saldoAkhir);
const bbH = C.hitungBukuBesar_(ctx, '210', '2026-05-01', '2026-06-30');
cek('Akun kredit normal: saldo positif', bbH.saldoAkhir === 150000000, bbH.saldoAkhir);

// Buku pembantu piutang
const bp = C.hitungBukuPembantu_(ctx, 'CS', '2026-05-01', '2026-06-30');
cek('Buku pembantu piutang CS001', bp.baris[0].saldoAkhir === 150000, bp.baris);
cek('Buku pembantu cocok dengan akun induk 130', bp.selisih === 0, bp);
const bpu = C.hitungBukuPembantu_(ctx, 'SP', '2026-05-01', '2026-06-30');
cek('Buku pembantu hutang SP001 (dari pembelian alkohol)', bpu.baris.find(b => b.kontak === 'SP001').saldoAkhir === 500000 && bpu.selisih === 0, bpu.total);

// Struk & rekap POS
const h = C.hitungStruk_(35000, 70000, 5000, 10, 5);
cek('Diskon dibagi proporsional', h.netH + h.netA === 100000 && h.netA === 70000 - 3333, h);
cek('Total struk = net + service + pajak', h.total === h.netH + h.netA + h.servH + h.servA + h.pajakH + h.pajakA, h.total);
const trx = [
  { No: 'POS-1', Metode: 'TUNAI', NetHalal: 35000, NetAlkohol: 70000, PajakHalal: 0, PajakAlkohol: 0, ServHalal: 0, ServAlkohol: 0 },
  { No: 'POS-2', Metode: 'EDC', NetHalal: 50000, NetAlkohol: 0, PajakHalal: 0, PajakAlkohol: 0, ServHalal: 0, ServAlkohol: 0 },
  { No: 'POS-3', Metode: 'QRIS', NetHalal: 20000, NetAlkohol: 35000, PajakHalal: 2000, PajakAlkohol: 3500, ServHalal: 0, ServAlkohol: 0 },
  { No: 'POS-4', Metode: 'BON', KodePelanggan: 'CS001', NetHalal: 60000, NetAlkohol: 0, PajakHalal: 0, PajakAlkohol: 0, ServHalal: 0, ServAlkohol: 0 },
  { No: 'POS-5', Metode: 'TUNAI', NetHalal: 15000, NetAlkohol: 0, PajakHalal: 0, PajakAlkohol: 0, ServHalal: 0, ServAlkohol: 0 }
];
const rek = C.jurnalRekapStruk_(trx, false);
const ringkas = rek.map(r => r.kelompok + ' ' + r.keterangan + ' ' + r.baris.map(b => b.kode + ':' + (b.debit || 0) + '/' + (b.kredit || 0)).join(' '));
console.log(ringkas.join('\n'));
cek('Rekap: 5 jurnal (halal tunai, halal EDC, halal bon, alkohol tunai, alkohol EDC)', rek.length === 5, rek.length);
rek.forEach(r => { r.tanggal = '2026-06-10'; C.validasiJurnal_(r, peta); });
cek('Semua jurnal rekap valid & seimbang', true);
const htunai = rek.find(r => r.kelompok === 'HALAL' && /TUNAI/.test(r.keterangan));
cek('Halal tunai = 35.000 + 15.000', htunai.baris[0].debit === 50000, htunai.baris);
const anon = rek.find(r => r.kelompok === 'ALKOHOL' && /EDC/.test(r.keterangan));
cek('Alkohol non-tunai termasuk pajak ke 220', anon.baris.some(b => b.kode === '220' && b.kredit === 3500) && anon.baris[0].debit === 38500, anon.baris);
const balik = C.jurnalRekapStruk_([trx[0]], true);
cek('Void → jurnal kebalikan', balik.length === 2 && balik[0].baris[0].kredit > 0, balik.map(b => b.baris));

console.log(gagal ? '\n' + gagal + ' UJI GAGAL' : '\nSEMUA UJI LULUS');
process.exit(gagal ? 1 : 0);
