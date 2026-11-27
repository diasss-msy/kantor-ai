import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tanggalWIB, detikHari, formatJam, hariIniWIB, daftarTanggal, laporanPada,
  statusPada, ringkasHari, tautan, tataMeja, rencanaRute, menganggur, LORONG_X, MANAJER_X, ruteLorong, sampahTerpenuh, PETUGAS,
} from './status.js';

const L = (waktu, agen, status) => ({ waktu, agen, status, tugas: 't', ringkasan: 'r', hasil: [] });
const data = [
  L('2026-11-27T12:29:48+07:00', 'coding', 'butuh-input'),
  L('2026-11-27T08:27:55+07:00', 'kuliah', 'selesai'),
  L('2026-11-27T12:34:15+07:00', 'coding', 'selesai'),
  L('2026-11-26T23:59:00+07:00', 'kerja', 'gagal'),
];
const ID = ['manajer', 'kuliah', 'coding', 'kerja'];

test('tanggal dan jam dibaca dari teks WIB', () => {
  assert.equal(tanggalWIB('2026-11-27T00:10:00+07:00'), '2026-11-27');
  assert.equal(detikHari('2026-11-27T12:34:15+07:00'), 12 * 3600 + 34 * 60 + 15);
  assert.equal(formatJam(45296), '12:34');
});

test('hari ini memakai WIB, bukan UTC', () => {
  assert.equal(hariIniWIB(new Date('2026-11-27T17:30:00Z')), '2026-11-28');
  assert.equal(hariIniWIB(new Date('2026-11-27T16:59:00Z')), '2026-11-27');
});

test('daftar tanggal unik, terbaru dulu, termasuk hari ini', () => {
  assert.deepEqual(daftarTanggal(data, '2026-11-29'), ['2026-11-29', '2026-11-27', '2026-11-26']);
  assert.deepEqual(daftarTanggal(data, '2026-11-27'), ['2026-11-27', '2026-11-26']);
});

test('laporan pada tanggal urut dan dipotong jam', () => {
  assert.deepEqual(laporanPada(data, '2026-11-27').map((l) => l.agen), ['kuliah', 'coding', 'coding']);
  assert.equal(laporanPada(data, '2026-11-27', detikHari('2026-11-27T12:30:00+07:00')).length, 2);
});

test('status = laporan terakhir hari itu, kosong kalau belum ada', () => {
  const s = statusPada(data, ID, '2026-11-27');
  assert.equal(s.coding.status, 'selesai');
  assert.equal(s.kuliah.status, 'selesai');
  assert.equal(s.manajer.status, 'kosong');
  assert.equal(s.manajer.laporan, null);
  assert.equal(s.kerja.status, 'kosong', 'laporan kemarin tidak terbawa');
});

test('timelapse: status mengikuti jam yang dipilih', () => {
  const jam = (t) => detikHari(`2026-11-27T${t}+07:00`);
  assert.equal(statusPada(data, ID, '2026-11-27', jam('08:00:00')).kuliah.status, 'kosong');
  assert.equal(statusPada(data, ID, '2026-11-27', jam('12:30:00')).coding.status, 'butuh-input');
  assert.equal(statusPada(data, ID, '2026-11-27', jam('12:34:15')).coding.status, 'selesai');
});

test('agen yang tidak ada di karyawan diabaikan', () => {
  const s = statusPada([L('2026-11-27T09:00:00+07:00', 'hantu', 'gagal')], ID, '2026-11-27');
  assert.deepEqual(Object.keys(s), ID);
});

test('ringkasan per status', () => {
  assert.deepEqual(ringkasHari(data, '2026-11-27'), { dikerjakan: 0, 'butuh-input': 1, gagal: 0, selesai: 2 });
});

test('tautan hanya untuk http(s)', () => {
  assert.equal(tautan('https://github.com/diasss-msy/kantor-ai/pull/2'), 'https://github.com/diasss-msy/kantor-ai/pull/2');
  assert.equal(tautan('https://github.com/x/y (main = b3ee622)'), 'https://github.com/x/y');
  assert.equal(tautan('javascript:alert(1)'), null);
  assert.equal(tautan('PR #12 di repo perpustakaan'), null);
});

test('tata meja: manajer di belakang, lainnya tiga per baris', () => {
  const k = (id) => ({ id });
  const t = tataMeja([k('manajer'), k('kuliah'), k('coding'), k('kerja')]);
  const m = Object.fromEntries(t.meja.map((d) => [d.id, d]));
  assert.ok(m.manajer.z < m.coding.z);
  assert.deepEqual([m.kuliah.x, m.coding.x, m.kerja.x], [-4.2, 0, 4.2]);
  const t2 = tataMeja([k('manajer'), ...'abcde'.split('').map(k)]);
  assert.equal(t2.meja.length, 6);
  assert.ok(t2.dalam > t.dalam);
  assert.deepEqual(t2.meja.slice(4).map((d) => d.x), [-2.1, 2.1]);
  const t3 = tataMeja([k('manajer'), k('kuliah'), k('coding'), k('kerja'), k('maintenance')]);
  const lain = t3.meja.slice(1);
  assert.equal(new Set(lain.map((d) => d.z)).size, 1, 'empat departemen dalam satu baris');
  assert.deepEqual(lain.map((d) => +d.x.toFixed(2)), [-5.1, -1.7, 1.7, 5.1]);
  assert.equal(t3.dalam, t.dalam);
});

test('rute jalan: kursi -> lorong belakang meja -> lorong samping -> tujuan', () => {
  const r = rencanaRute({ x: -4.2, z: -1.35 }, { x: 5.6, z: -5 });
  assert.deepEqual(r[0], { x: -4.2, z: -1.35 });
  assert.deepEqual(r[1], { x: -3.6, z: -1.35 });
  assert.equal(+r[2].z.toFixed(2), -2.4);
  assert.equal(r[3].x, LORONG_X);
  assert.deepEqual(r.at(-1), { x: 5.6, z: -5 });
  // setiap ruas lurus (sejajar sumbu x atau z)
  for (let i = 1; i < r.length; i++) assert.ok(r[i].x === r[i - 1].x || r[i].z === r[i - 1].z, `ruas ${i}`);
  const kiri = rencanaRute({ x: 2.1, z: 2.65 }, { x: -5.6, z: -3.5 });
  assert.equal(kiri[3].x, -LORONG_X);
});

test('ruang manajer: meja manajer di dalamnya, meja lain di luarnya', () => {
  const k = (id) => ({ id });
  const t = tataMeja([k('manajer'), k('kuliah'), k('coding'), k('kerja'), k('maintenance'), k('logikaku')]);
  const r = t.ruangManajer;
  const di = (d) => d.x > r.x0 && d.x < r.x1 && d.z > r.z0 && d.z < r.z1;
  const m = t.meja.find((d) => d.id === 'manajer');
  assert.equal(m.x, MANAJER_X);
  assert.ok(di(m), 'meja manajer di dalam ruangan');
  // kursi dan lorong belakang kursi karyawan lain tetap di luar dinding kaca
  for (const d of t.meja.filter((d) => d.id !== 'manajer')) assert.ok(d.z - 0.85 - 1.05 > r.z1 + 0.3, d.id);
  assert.equal(tataMeja([k('kuliah')]).ruangManajer, null);
});

test('rute manajer keluar lewat pintu ruangannya', () => {
  const t = tataMeja([{ id: 'manajer' }, { id: 'kuliah' }]);
  const m = t.meja[0], pintu = t.ruangManajer.pintu;
  const rute = rencanaRute({ x: m.x, z: m.z - 0.85 }, { x: 5.6, z: -5.2 }, pintu);
  const i = rute.findIndex((p) => p.x === pintu.x && p.z > pintu.z);
  assert.ok(i > 0, 'melewati pintu');
  // sebelum pintu semua titik di dalam ruangan, sesudahnya di luar atau di lorong samping
  for (const p of rute.slice(0, i)) assert.ok(p.z < pintu.z && p.x <= t.ruangManajer.x1, JSON.stringify(p));
  for (let j = 1; j < rute.length; j++) assert.ok(rute[j].x === rute[j - 1].x || rute[j].z === rute[j - 1].z, `ruas ${j}`);
  assert.deepEqual(rute.at(-1), { x: 5.6, z: -5.2 });
});

test('petugas kebersihan tidak dapat meja di baris departemen', () => {
  const k = (id) => ({ id });
  const t = tataMeja([k('manajer'), k('kuliah'), k('coding'), k('kerja'), k(PETUGAS)]);
  const tanpa = tataMeja([k('manajer'), k('kuliah'), k('coding'), k('kerja')]);
  const p = t.meja.find((d) => d.id === PETUGAS);
  assert.ok(p.x < -5 && p.z > 0, 'mangkal di kiri depan');
  assert.deepEqual(t.meja.filter((d) => d.id !== PETUGAS), tanpa.meja);
  assert.equal(t.dalam, tanpa.dalam);
});

test('rute petugas lewat lorong kiri, dan lewat pintu ke ruang manajer', () => {
  const lurus = (r) => r.every((p, i) => i === 0 || p.x === r[i - 1].x || p.z === r[i - 1].z);
  const r = ruteLorong({ x: -5.6, z: 4.4 }, { x: 1.25, z: -2.4 });
  assert.ok(lurus(r));
  assert.ok(r.some((p) => p.x === -LORONG_X));
  const pintu = { x: 2.2, z: -2.85 };
  const m = ruteLorong({ x: -5.6, z: 4.4 }, { x: 0.4, z: -6.3 }, pintu);
  assert.ok(lurus(m));
  assert.ok(m.some((p) => p.x === pintu.x && p.z > pintu.z), 'lewat depan pintu');
  assert.deepEqual(m.at(-1), { x: 0.4, z: -6.3 });
});

test('tempat sampah terpenuh dikosongkan duluan', () => {
  assert.equal(sampahTerpenuh([{ isi: 0.1 }, { isi: 0.2 }]), null);
  const t = [{ id: 'a', isi: 0.5 }, { id: 'b', isi: 0.9 }, { id: 'c', isi: 0.4 }];
  assert.equal(sampahTerpenuh(t).id, 'b');
});

test('menganggur hanya untuk kosong dan selesai', () => {
  assert.ok(menganggur('kosong') && menganggur('selesai'));
  assert.ok(!menganggur('dikerjakan') && !menganggur('butuh-input') && !menganggur('gagal'));
});
