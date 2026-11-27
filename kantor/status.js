// Logika status kantor 3D. Fungsi murni, tanpa DOM dan tanpa Three.js,
// supaya bisa dites dengan `node --test kantor/`.
// Semua waktu laporan memakai offset +07:00 (dijamin tools/cek_laporan.py),
// jadi tanggal dan jam WIB bisa dibaca langsung dari teksnya.

/** Ukuran lantai kantor (satuan dunia). */
export const LEBAR = 50;
export const DALAM = 50;

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
 * Posisi meja: manajer di baris belakang, karyawan lain di depannya
 * (empat sebaris kalau tepat empat, selain itu tiga per baris).
 * Hasil: { meja: [{ id, x, z }], lebar, dalam } dalam satuan dunia.
 */
export function tataMeja(karyawan) {
  const manajer = karyawan.filter((k) => k.id === 'manajer');
  const lain = karyawan.filter((k) => k.id !== 'manajer' && k.id !== PETUGAS);
  const petugas = karyawan.filter((k) => k.id === PETUGAS);
  const perBaris = lain.length === 4 ? 4 : 3; // empat departemen muat sebaris
  const jarak = perBaris === 4 ? 4.2 : 5;
  const dalam = DALAM;
  const meja = [];
  // manajer punya ruangan sendiri berdinding kaca: seperempat lantai di belakang kiri
  for (const k of manajer) meja.push({ id: k.id, x: MANAJER_X, z: -dalam / 4 });
  // departemen di separuh depan, tepat di depan ruang manajer
  const z0 = manajer.length ? 4 : -dalam / 2 + 3.8;
  lain.forEach((k, i) => {
    const r = Math.floor(i / perBaris), sisa = Math.min(perBaris, lain.length - r * perBaris), c = i % perBaris;
    meja.push({ id: k.id, x: (c - (sisa - 1) / 2) * jarak, z: z0 + r * 4.4 });
  });
  // petugas kebersihan tidak punya meja: ia mangkal di troli kebersihan di sisi kiri depan
  for (const k of petugas) meja.push({ id: k.id, x: POS_PETUGAS.x, z: dalam / 2 - POS_PETUGAS.dariDepan });
  const lebar = LEBAR;
  const ruangManajer = manajer.length ? {
    x0: -lebar / 2, x1: 0, z0: -dalam / 2, z1: 0,
    pintu: { x: -1.5, z: 0 },
  } : null;
  return { meja, lebar, dalam, ruangManajer };
}

/** Posisi x meja manajer di dalam ruangannya (membelakangi jendela belakang). */
export const MANAJER_X = -LEBAR / 4;

/** Lorong samping kiri dan kanan (koordinat x) yang bebas meja, untuk berjalan. */
export const LORONG_X = LEBAR / 2 - 1.3;

/**
 * Rute berjalan dari kursi ke tujuan: mundur ke lorong di belakang meja,
 * menyusuri lorong itu ke lorong samping (kiri atau kanan, yang lebih dekat
 * ke tujuan), lalu ke tujuan. Hasil: daftar titik { x, z } diawali kursi.
 */
export function rencanaRute(kursi, tujuan, pintu = null) {
  const lorongZ = kursi.z - 1.05; // tepat di belakang sandaran kursi
  const cx = tujuan.x >= 0 ? LORONG_X : -LORONG_X;
  const titik = [
    { x: kursi.x, z: kursi.z },
    { x: kursi.x + 0.6, z: kursi.z }, // geser ke samping kursi dulu
    { x: kursi.x + 0.6, z: lorongZ },
  ];
  // dari ruangan tertutup (ruang manajer): keluar lewat pintunya dulu
  const luarZ = pintu ? pintu.z + 0.5 : lorongZ;
  if (pintu) titik.push({ x: pintu.x, z: lorongZ }, { x: pintu.x, z: luarZ });
  titik.push(
    { x: cx, z: luarZ },
    { x: cx, z: tujuan.z },
    { x: tujuan.x, z: tujuan.z },
  );
  // buang titik ganda berurutan
  return titik.filter((p, i) => i === 0 || Math.hypot(p.x - titik[i - 1].x, p.z - titik[i - 1].z) > 1e-6);
}

/** Pegawai menganggur (boleh jalan-jalan) kalau tidak sedang bekerja atau menunggu input. */
export function menganggur(status) {
  return status === 'kosong' || status === 'selesai';
}

/** id petugas kebersihan (cleaning service) di karyawan.json. */
export const PETUGAS = 'kebersihan';
/** Tempat mangkal petugas kebersihan: di depan troli, dekat dinding kiri. */
export const POS_PETUGAS = { x: -LORONG_X + 0.1, dariDepan: 4 };

/**
 * Rute petugas kebersihan dari titik a ke titik b lewat lorong samping kiri.
 * Kalau b ada di ruang manajer, lewat pintunya. Setiap ruas sejajar sumbu.
 */
export function ruteLorong(a, b, pintu = null) {
  const cx = -LORONG_X;
  const t = [{ x: a.x, z: a.z }, { x: cx, z: a.z }];
  if (pintu) {
    const luar = pintu.z + 0.5;
    t.push({ x: cx, z: luar }, { x: pintu.x, z: luar }, { x: pintu.x, z: b.z });
  } else t.push({ x: cx, z: b.z });
  t.push({ x: b.x, z: b.z });
  return t.filter((p, i) => i === 0 || Math.hypot(p.x - t[i - 1].x, p.z - t[i - 1].z) > 1e-6);
}

/** Tempat sampah yang paling penuh (dikosongkan duluan); null kalau semua hampir kosong. */
export function sampahTerpenuh(tempat, minimal = 0.34) {
  let pilih = null;
  for (const t of tempat) if (t.isi >= minimal && (!pilih || t.isi > pilih.isi)) pilih = t;
  return pilih;
}
