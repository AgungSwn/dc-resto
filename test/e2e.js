// Uji ujung-ke-ujung: tampilan + server tersimulasi
const { chromium } = require('playwright');
const { createGas, buildPage } = require('./gasmock');
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src'), OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const gas = createGas(DIR + '/Code.gs');
  gas.call('setup');
  gas.run('TANPA_LOGIN = false'); // uji alur login
  const html = buildPage(DIR);
  const browser = await chromium.launch();
  const errors = [];
  let fails = 0;
  const ok = (name, cond, info) => { console.log((cond ? 'OK   ' : 'GAGAL') + ' ' + name + (info ? ' → ' + info : '')); if (!cond) fails++; };

  async function newPage(w, h) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    await page.route('**/*', r => r.request().url().startsWith('http://app.test') ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort());
    await page.exposeFunction('__gas', (fn, args) => { try { return gas.call(fn, args); } catch (e) { return { ok: false, error: 'SERVER: ' + e.message + '\n' + e.stack }; } });
    await page.goto('http://app.test/');
    return page;
  }
  const idle = (p) => p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 8000 }).then(() => p.waitForTimeout(120));
  async function login(p, kode, pin) {
    await p.fill('#lgKode', kode); await p.fill('#lgPin', pin); await p.click('#lgBtn');
    await p.waitForSelector('#app:not([hidden])', { timeout: 8000 }); await idle(p);
  }
  async function toast(p) { await p.waitForTimeout(150); return p.textContent('#toast'); }
  async function confirmModal(p, label) { await p.click('#modalBody .btn-primary:has-text("' + label + '")'); await idle(p); }

  // ===== Laptop =====
  const p = await newPage(1366, 820);
  await p.screenshot({ path: OUT + '/00_login.png' });
  await p.fill('#lgKode', 'ADM'); await p.fill('#lgPin', '0000'); await p.click('#lgBtn'); await p.waitForTimeout(300);
  ok('PIN salah ditolak', (await p.textContent('#lgErr')).includes('salah'));
  await login(p, 'ADM', '123456');
  ok('Login admin → tab POS', (await p.textContent('#viewTitle')) === 'POS');
  ok('POS belum aktif tanpa menu', (await p.textContent('#view')).includes('POS belum aktif'));
  await p.screenshot({ path: OUT + '/01_pos_kosong_laptop.png' });

  // Kontak pelanggan & supplier
  await p.click('#btnSet'); await idle(p);
  await p.click('.subtabs button:has-text("Kontak")'); await idle(p);
  await p.click('#setBody .btn-primary'); await p.fill('#fkNama', "NPDC (Nusa Penida Dive Center)"); await p.click('#modalBody .btn-primary'); await idle(p);
  ok('Kontak CS001 dibuat', (await p.textContent('#setBody')).includes('CS001'));
  await p.click('#setBody .seg button:has-text("SP")'); await p.click('#setBody .btn-primary'); await p.fill('#fkNama', "Toko Bir O'Reilly"); await p.click('#modalBody .btn-primary'); await idle(p);
  ok('Kontak SP001 dibuat (nama dengan tanda kutip)', (await p.textContent('#setBody')).includes('SP001'));

  // Saldo awal seimbang
  await p.click('.subtabs button:has-text("Saldo awal")'); await idle(p);
  await p.selectOption('#saA0', '113'); await p.fill('#saS0', '5000000'); await p.dispatchEvent('#saS0', 'input');
  await p.click('#setBody button:has-text("Baris")');
  await p.selectOption('#saA1', '300'); await p.fill('#saS1', '5000000'); await p.dispatchEvent('#saS1', 'input');
  await p.click('#setBody button:has-text("Simpan saldo awal")'); await idle(p);
  ok('Saldo awal tersimpan', (await toast(p)).includes('Saldo awal tersimpan'));

  // Penjualan harian
  await p.click('#nav button[data-tab="jurnal"]'); await idle(p);
  await p.click('.subtabs button:has-text("Penjualan Harian")'); await idle(p);
  for (const [id, v] of [['phTH', '850000'], ['phNH', '420000'], ['phTA', '140000'], ['phNA', '70000']]) { await p.fill('#' + id, v); await p.dispatchEvent('#' + id, 'input'); }
  await p.click('#jHarian button:has-text("Tambah bon")');
  await p.selectOption('#phBK0', 'CS001'); await p.fill('#phBJ0', '250000'); await p.dispatchEvent('#phBJ0', 'input');
  await p.screenshot({ path: OUT + '/02_penjualan_harian.png' });
  await p.click('#jHarian button:has-text("Simpan penjualan harian")'); await confirmModal(p, 'Simpan');
  const t1 = await toast(p);
  ok('Penjualan harian → 5 jurnal (JU & AL)', /JU-00001/.test(t1) && /AL-00001/.test(t1) && /AL-00002/.test(t1), t1);

  // Jurnal manual: coba akun alkohol di halal (tidak muncul di pilihan)
  await p.click('.subtabs button:has-text("Jurnal manual")'); await idle(p);
  const opsi = await p.$$eval('#mfA0 option', os => os.map(o => o.value));
  ok('Akun 410/151 tidak bisa dipilih di jurnal halal', !opsi.includes('410') && !opsi.includes('151') && opsi.includes('112'));
  await p.fill('#mfKet', 'belanja pasar');
  await p.selectOption('#mfA0', '141'); await p.fill('#mfD0', '300000'); await p.dispatchEvent('#mfD0', 'input');
  await p.selectOption('#mfA1', '112'); await p.fill('#mfC1', '250000'); await p.dispatchEvent('#mfC1', 'input');
  ok('Indikator selisih tampil', (await p.textContent('#mfBal')).includes('Selisih'));
  await p.click('#jManual button:has-text("Simpan jurnal")'); await idle(p);
  ok('Jurnal tidak seimbang ditolak server', (await toast(p)).includes('tidak seimbang'));
  await p.fill('#mfC1', '300000'); await p.dispatchEvent('#mfC1', 'input');
  await p.click('#jManual button:has-text("Simpan jurnal")'); await idle(p);
  ok('Jurnal manual tersimpan', (await toast(p)).includes('JU-'));

  // Pembelian alkohol kredit ke supplier
  await p.click('.subtabs button:has-text("Pembelian Alkohol")'); await idle(p);
  await p.fill('#paKet', 'beli bir 2 krat'); await p.fill('#paJml', '200000'); await p.dispatchEvent('#paJml', 'input');
  await p.selectOption('#paBayar', '211'); await p.dispatchEvent('#paBayar', 'change'); await p.selectOption('#paSup', 'SP001');
  await p.click('#jAlk button.btn-primary'); await idle(p);
  ok('Pembelian alkohol → jurnal AL', (await toast(p)).includes('AL-'));

  // Stok opname
  await p.click('.subtabs button:has-text("Stok Opname")'); await idle(p);
  await p.fill('#soN0', 'beras'); await p.fill('#soS0', 'KG'); await p.fill('#soQ0', '10'); await p.fill('#soH0', '15000'); await p.dispatchEvent('#soH0', 'input');
  await p.click('#jStok button:has-text("Simpan stok opname")'); await idle(p);
  ok('Stok opname tersimpan', (await toast(p)).includes('150.000'));

  // Daftar jurnal
  await p.click('.subtabs button:has-text("Daftar jurnal")'); await idle(p);
  const nJ = await p.$$eval('.jr', x => x.length);
  ok('Daftar jurnal berisi 7 jurnal', nJ === 7, String(nJ));
  await p.screenshot({ path: OUT + '/03_daftar_jurnal_laptop.png', fullPage: true });

  // Menu
  await p.click('#btnSet'); await idle(p);
  await p.click('.subtabs button:has-text("Menu")'); await idle(p);
  await p.click('#setBody button:has-text("Impor dari Excel")');
  await p.fill('#imTeks', "Nasi Goreng\tMakanan\t35000\tHALAL\nKopi Bali\tKopi\t25000\tHALAL\nFlat White\tKopi\t35.000\tHALAL\nSmoothie Bowl\tMakanan\t55000\tHALAL\nBintang Beer\tAlkohol\t70000\tALKOHOL");
  await p.click('#modalBody .btn-primary'); await idle(p);
  ok('Impor 5 menu', (await toast(p)).includes('5 menu'));

  // POS
  await p.click('#nav button[data-tab="pos"]'); await idle(p);
  await p.click('.mi:has-text("Nasi Goreng")'); await p.click('.mi:has-text("Kopi Bali")'); await p.click('.mi:has-text("Kopi Bali")'); await p.click('.mi:has-text("Bintang")');
  await p.fill('#posMeja', '3');
  ok('Total keranjang 155.000', (await p.textContent('#cartTot')).includes('155.000'));
  await p.screenshot({ path: OUT + '/04_pos_laptop.png' });
  await p.click('#btnBayar'); await p.fill('#payUang', '200000'); await p.dispatchEvent('#payUang', 'input');
  ok('Kembalian 45.000', (await p.textContent('#payKembali')).includes('45.000'));
  await p.click('#modalBody button:has-text("Simpan & Cetak Struk")'); await idle(p);
  ok('Struk tampil', (await p.textContent('#modalBody')).includes('POS-000001'));
  await p.screenshot({ path: OUT + '/05_struk.png' });
  await p.click('#modalBody button:has-text("Selesai")');
  // transaksi bon
  await p.click('.mi:has-text("Flat White")'); await p.click('#btnBayar'); await p.click('#payGrid button[data-m="BON"]'); await p.selectOption('#payPlg', 'CS001');
  await p.click('#modalBody button:has-text("Simpan & Cetak Struk")'); await idle(p); await p.click('#modalBody button:has-text("Selesai")');
  // transaksi void
  await p.click('.mi:has-text("Smoothie")'); await p.click('#btnBayar'); await p.click('#payGrid button[data-m="QRIS"]');
  await p.click('#modalBody button:has-text("Simpan & Cetak Struk")'); await idle(p); await p.click('#modalBody button:has-text("Selesai")');
  await p.click('button:has-text("Riwayat transaksi")'); await idle(p);
  await p.click('#modalBody tr:has-text("POS-000003") button:has-text("Void")'); await p.fill('#voidAlasan', 'salah input'); await p.click('#modalBody button:has-text("Void struk")'); await idle(p);
  ok('Void sebelum rekap', (await toast(p)).includes('di-void'));
  await p.click('button:has-text("Tutup Kasir")'); await confirmModal(p, 'Tutup Kasir');
  const t2 = await toast(p);
  ok('Tutup kasir: 2 struk direkap (void tidak ikut)', t2.includes('2 struk'), t2);

  // Laba rugi
  await p.click('#nav button[data-tab="lr"]'); await idle(p);
  const lr = await p.textContent('#lrHasil');
  // pendapatan halal: 850+420+250 (harian) + 85.000 tunai POS + 35.000 bon = 1.640.000
  ok('Pendapatan halal 1.640.000', lr.includes('1.640.000'));
  // alkohol: 140+70 harian + 70 POS = 280.000 ; HPP alk = 200.000 → hasil 80.000
  ok('Hasil alkohol 80.000 terpisah', lr.includes('80.000') && lr.includes('Perhitungan Hasil Alkohol'));
  await p.screenshot({ path: OUT + '/06_laba_rugi_laptop.png', fullPage: true });

  // Neraca
  await p.click('#nav button[data-tab="neraca"]'); await idle(p);
  const nr = await p.textContent('#nrHasil');
  ok('Neraca seimbang', nr.includes('Seimbang'), nr.slice(0, 160));
  await p.screenshot({ path: OUT + '/07_neraca_laptop.png', fullPage: true });

  // Buku besar & pembantu
  await p.click('#nav button[data-tab="bb"]'); await idle(p);
  ok('Buku besar kas kecil tampil porsi alkohol', (await p.textContent('#bbHasil')).includes('alkohol'));
  await p.screenshot({ path: OUT + '/08_buku_besar.png', fullPage: true });
  await p.click('.subtabs button:has-text("Buku Pembantu")'); await idle(p);
  const bp = await p.textContent('#bpHasil');
  ok('Buku pembantu piutang cocok (250.000 + 35.000)', bp.includes('285.000') && bp.includes('Cocok'));
  await p.click('#bpTbl tr.click'); await idle(p);
  ok('Kartu pelanggan terbuka', (await p.textContent('#modalBody')).includes('Saldo awal'));
  await p.click('#modal .modal-head .icon-btn');
  await p.selectOption('#bpJenis', 'SP'); await p.click('.card button:has-text("Tampilkan")'); await idle(p);
  ok('Buku pembantu hutang supplier 200.000 cocok', (await p.textContent('#bpHasil')).includes('200.000') && (await p.textContent('#bpHasil')).includes('Cocok'));

  // Pengguna kasir
  await p.click('#btnSet'); await idle(p);
  await p.click('.subtabs button:has-text("Pengguna")'); await idle(p);
  await p.click('#setBody .btn-primary'); await p.fill('#fuKode', 'KSR'); await p.fill('#fuNama', 'Kasir Satu'); await p.selectOption('#fuPeran', 'KASIR'); await p.fill('#fuPin', '1111');
  await p.click('#modalBody .btn-primary'); await idle(p);
  ok('Pengguna kasir dibuat', (await p.textContent('#setBody')).includes('KSR'));
  await p.click('#btnUser'); await p.click('#modalBody button:has-text("Keluar")');
  await login(p, 'KSR', '1111');
  const tabs = await p.$$eval('#nav button', b => b.map(x => x.dataset.tab));
  ok('Kasir hanya melihat tab POS', tabs.length === 1 && tabs[0] === 'pos', tabs.join(','));
  ok('Kasir tidak melihat Pengaturan', await p.$eval('#btnSet', b => b.hidden));
  const r = gas.call('api', [{ action: 'laporan', token: (await p.evaluate(() => S.token)), data: {} }]);
  ok('Server menolak laporan untuk kasir', !r.ok && /tidak punya akses/.test(r.error), r.error);
  await p.close();

  // ===== HP portrait & landscape =====
  for (const [nm, w, h] of [['hp_portrait', 390, 844], ['hp_landscape', 844, 390], ['tablet', 820, 1180]]) {
    const q = await newPage(w, h);
    await login(q, 'ADM', '123456');
    await q.screenshot({ path: OUT + '/10_' + nm + '_pos.png' });
    await q.click('.mi:has-text("Nasi Goreng")'); await q.click('.mi:has-text("Bintang")');
    if (nm === 'hp_portrait') { await q.click('#posBar'); await q.waitForTimeout(350); await q.screenshot({ path: OUT + '/11_' + nm + '_keranjang.png' }); await q.click('.pos-close'); }
    await q.click('#nav button[data-tab="lr"]'); await idle(q);
    await q.screenshot({ path: OUT + '/12_' + nm + '_labarugi.png' });
    await q.click('#nav button[data-tab="jurnal"]'); await idle(q);
    await q.screenshot({ path: OUT + '/13_' + nm + '_jurnal.png' });
    const over = await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(nm + ': tidak ada geser horizontal halaman', !over);
    await q.close();
  }
  // ===== Mode pengembangan: tanpa login =====
  {
    gas.run('TANPA_LOGIN = true');
    const d = await newPage(1366, 820);
    await d.waitForSelector('#app:not([hidden])', { timeout: 8000 }); await idle(d);
    ok('Mode tanpa login: langsung masuk sebagai ADMIN', (await d.textContent('#btnUser')).includes('ADMIN'));
    await d.click('#btnUser'); await d.selectOption('#devPeran', 'KASIR'); await d.click('#modalBody button:has-text("Ganti peran")');
    await d.waitForFunction(() => S.user && S.user.peran === 'KASIR', null, { timeout: 8000 }); await idle(d);
    const tb = await d.$$eval('#nav button', b => b.map(x => x.dataset.tab));
    ok('Mode tanpa login: ganti peran ke Kasir → hanya POS', tb.join(',') === 'pos', tb.join(','));
    await d.close();
  }
  await browser.close();
  const errs = errors.filter(e => !/net::ERR_FAILED|ERR_BLOCKED|Failed to load resource/.test(e));
  ok('Tidak ada error JavaScript di browser', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(fails ? '\n' + fails + ' UJI GAGAL' : '\nSEMUA UJI E2E LULUS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
