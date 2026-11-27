import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tanggalWIB, detikHari, formatJam, hariIniWIB, daftarTanggal, laporanPada,
  statusPada, ringkasHari, tautan, tataMeja,
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
