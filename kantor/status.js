// Logika status kantor 3D. Fungsi murni, tanpa DOM dan tanpa Three.js,
// supaya bisa dites dengan `node --test kantor/`.
// Semua waktu laporan memakai offset +07:00 (dijamin tools/cek_laporan.py),
// jadi tanggal dan jam WIB bisa dibaca langsung dari teksnya.

export const STATUS = ['dikerjakan', 'butuh-input', 'gagal', 'selesai'];
export const SEHARI = 86399; // detik terakhir dalam sehari (23:59:59)

export function tanggalWIB(waktu) {
  return waktu.slice(0, 10);
}

export function detikHari(waktu) {
  const [j, m, d] = waktu.slice(11, 19).split(':').map(Number);
  return j * 3600 + m * 60 + d;
}

export function formatJam(detik) {
  const j = Math.floor(detik / 3600), m = Math.floor((detik % 3600) / 60);
  return `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hariIniWIB(sekarang = new Date()) {
  return new Date(sekarang.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Tanggal yang punya laporan, ditambah hari ini, terbaru dulu. */
export function daftarTanggal(laporan, hariIni) {
  const s = new Set(laporan.map((l) => tanggalWIB(l.waktu)));
  if (hariIni) s.add(hariIni);
  return [...s].sort().reverse();
}

/** Laporan pada satu tanggal sampai detik tertentu, urut menurut waktu. */
export function laporanPada(laporan, tanggal, sampai = SEHARI) {
  return laporan
    .filter((l) => tanggalWIB(l.waktu) === tanggal && detikHari(l.waktu) <= sampai)
    .sort((a, b) => detikHari(a.waktu) - detikHari(b.waktu));
}

/**
 * Status setiap karyawan pada tanggal dan detik tertentu:
 * laporan terakhirnya hari itu, atau 'kosong' kalau belum ada laporan.
 * Hasil: { [id]: { status, laporan } }
 */
export function statusPada(laporan, idKaryawan, tanggal, sampai = SEHARI) {
  const hasil = Object.fromEntries(idKaryawan.map((id) => [id, { status: 'kosong', laporan: null }]));
  for (const l of laporanPada(laporan, tanggal, sampai)) {
    if (l.agen in hasil) hasil[l.agen] = { status: l.status, laporan: l };
  }
  return hasil;
}

/** Jumlah laporan per status pada satu tanggal. */
export function ringkasHari(laporan, tanggal, sampai = SEHARI) {
  const n = Object.fromEntries(STATUS.map((s) => [s, 0]));
  for (const l of laporanPada(laporan, tanggal, sampai)) if (l.status in n) n[l.status] += 1;
  return n;
}

/** URL http(s) yang aman dijadikan tautan, atau null. */
export function tautan(teks) {
  try {
    const u = new URL(String(teks).trim().split(/\s/)[0]);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Posisi meja: manajer di baris belakang, karyawan lain tiga per baris di depannya.
 * Hasil: { meja: [{ id, x, z }], lebar, dalam } dalam satuan dunia.
 */
export function tataMeja(karyawan) {
  const manajer = karyawan.filter((k) => k.id === 'manajer');
  const lain = karyawan.filter((k) => k.id !== 'manajer');
  const baris = Math.max(1, Math.ceil(lain.length / 3));
  const dalam = 6 + baris * 4;
  const meja = [];
  let z0 = -dalam / 2 + 2.6;
  for (const k of manajer) meja.push({ id: k.id, x: 0, z: z0 });
  z0 += manajer.length ? 3.9 : 1.2;
  lain.forEach((k, i) => {
    const r = Math.floor(i / 3), sisa = Math.min(3, lain.length - r * 3), c = i % 3;
    meja.push({ id: k.id, x: (c - (sisa - 1) / 2) * 4.2, z: z0 + r * 4 });
  });
  return { meja, lebar: 14, dalam };
}
