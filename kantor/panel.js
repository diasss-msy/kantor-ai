// Antarmuka 2D di atas adegan: pemilih tanggal, ringkasan, panel laporan.
// Semua isi laporan dimasukkan lewat textContent, tidak pernah sebagai HTML.
import { STATUS, formatJam, detikHari, tautan } from './status.js';

const $ = (id) => document.getElementById(id);
const REPO = 'https://github.com/diasss-msy/kantor-ai/blob/main/';

function el(tag, attrs = {}, ...anak) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  for (const a of anak) if (a != null) e.append(a);
  return e;
}

export function namaTanggal(tanggal, hariIni) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  const teks = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  return tanggal === hariIni ? `Hari ini · ${teks}` : teks;
}

export function isiTanggal(daftar, pilihan, hariIni) {
  const s = $('tanggal');
  s.replaceChildren(...daftar.map((t) => {
    const o = el('option', { value: t }, namaTanggal(t, hariIni));
    if (t === pilihan) o.selected = true;
    return o;
  }));
}

export function isiRingkas(jumlah) {
  $('ringkas').replaceChildren(...STATUS.map((s) =>
    el('li', { class: `s-${s}` }, el('span', { class: 'titik' }), s.replace('-', ' '), ' ', el('b', {}, String(jumlah[s])))));
}

export function isiInfo(data) {
  const jam = data.dibuat ? data.dibuat.slice(11, 16) : '?';
  $('info-data').textContent = `${data.laporan.length} laporan · data diperbarui ${jam} WIB`;
}

export function bukaPanel(karyawan, laporan) {
  $('panel-dept').textContent = karyawan.departemen;
  $('panel-nama').textContent = karyawan.nama;
  $('panel-tugas').textContent = karyawan.tugas;
  const isi = laporan.slice().reverse().map((l) => {
    const hasil = l.hasil.length
      ? el('ul', {}, ...l.hasil.map((h) => {
          const url = tautan(h);
          return el('li', {}, url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, h) : h);
        }))
      : el('p', { class: 'kecil' }, 'Belum ada hasil.');
    return el('li', {},
      el('div', { class: 'baris-atas' },
        el('span', {}, formatJam(detikHari(l.waktu))),
        el('span', { class: `lencana s-${l.status}` }, l.status),
        el('span', {}, `dipesan ${l.dipesan_oleh}`)),
      el('h3', {}, l.tugas),
      el('p', {}, l.ringkasan),
      hasil,
      el('p', { class: 'kecil' }, el('a', { href: REPO + l.file, target: '_blank', rel: 'noopener noreferrer' }, 'lihat file laporan')));
  });
  $('daftar').replaceChildren(...(isi.length ? isi : [el('li', { class: 'kosong' }, 'Belum ada laporan pada hari dan jam ini.')]));
  $('panel').hidden = false;
}

export function tutupPanel() {
  $('panel').hidden = true;
}

export function tampilGalat(pesan) {
  const g = $('galat');
  g.textContent = pesan;
  g.hidden = false;
}
