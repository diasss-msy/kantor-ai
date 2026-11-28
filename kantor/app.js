// Kantor AI tahap 2: adegan 3D gaya "diorama tengah malam".
// Membaca data.json (dibuat tools/bangun_data.py) dan menampilkan status
// setiap karyawan menurut laporan terakhirnya pada tanggal dan jam yang dipilih.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import {
  AREA, SEHARI, daftarTanggal, formatJam, hariIniWIB, laporanPada, LORONG_X, menganggur, PETUGAS, rencanaRute, ringkasHari, ruteLorong, sampahTerpenuh, statusPada, tataMeja,
} from './status.js';
import { bukaPanel, isiInfo, isiRingkas, isiTanggal, tampilGalat, tutupPanel } from './panel.js';

const $ = (id) => document.getElementById(id);
const WARNA = {
  malam: 0x0a1128, dinding: 0x1b2a4e, dinding2: 0x1f2f57, lantai: 0x22305a, lantaiGaris: 0x18244a,
  gelap: 0x121a33, gelap2: 0x0e1530, meja: 0x2c3e70, sodium: 0xffb347, layar: 0x5ad1ff,
  merah: 0xff5d6c, krem: 0xe8dcc0, redup: 0x7f93c9, kulit: 0xa8775a,
};
const BAJU = { manajer: '#c9b9e8', kuliah: '#e8dcc0', coding: '#3a4f8a', kerja: '#ff8f6b', maintenance: '#7fd1b9', logikaku: '#b6c46a', kebersihan: '#3fa69a' };
const BAJU_LAIN = ['#7fd1b9', '#d98fb0', '#b6c46a', '#8fb3ff'];
const LABEL = {
  kosong: null,
  dikerjakan: { teks: 'dikerjakan', bg: '#5ad1ff' },
  'butuh-input': { teks: 'butuh input', bg: '#ffb347' },
  gagal: { teks: 'gagal', bg: '#ff5d6c' },
  selesai: { teks: 'selesai', bg: '#e8dcc0' },
};
const FONT = '"Inter Display", Inter, system-ui, sans-serif';
const DURASI_TIMELAPSE = 20; // detik untuk satu hari
const KURANGI_GERAK = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Mesin kopi dan tempat-tempat yang didatangi pegawai yang menganggur (koordinat dunia).
// Diisi bangunRuangan() karena bergantung pada ukuran ruangan.
const kopi = { titik: null, uap: 0 };
let tempatJalan = [];
// Tempat sampah di samping setiap meja; dikosongkan petugas kebersihan.
const tempatSampah = [];

// Acak dengan benih tetap, supaya kota dan hujan selalu sama.
function acak(benih) {
  return () => {
    benih |= 0; benih = (benih + 0x6d2b79f5) | 0;
    let t = Math.imul(benih ^ (benih >>> 15), 1 | benih);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- renderer
const kanvas = $('adegan');
const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e1736, 230, 520); // gedung jauh dan bagian bawah kota memudar
const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1400);
const kontrol = new OrbitControls(kamera, kanvas);
kontrol.enablePan = false;
kontrol.enableDamping = true;
kontrol.rotateSpeed = 1.6; // satu kali geser cukup untuk berputar jauh
kontrol.minZoom = 0.5;
kontrol.maxZoom = 9; // lantai 50x50: boleh zoom dekat sampai karakter terlihat jelas
kontrol.minPolarAngle = 0.7;
kontrol.maxPolarAngle = 1.1;
// putaran horizontal bebas 360 derajat (tanpa batas azimut)

// ---------------------------------------------------------------- pembantu
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({
  color: c, roughness: o.r ?? 0.8, metalness: o.m ?? 0, emissive: o.e ?? 0x000000,
  emissiveIntensity: o.ei ?? 1, transparent: o.t ?? false, opacity: o.op ?? 1,
});
function kotak(w, h, d, m, x, y, z, induk = scene, bayangan = true) {
  const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.isMaterial ? m : mat(m));
  k.position.set(x, y, z); k.castShadow = bayangan; k.receiveShadow = true; induk.add(k); return k;
}
function tabung(rt, rb, h, m, x, y, z, induk = scene) {
  const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), m.isMaterial ? m : mat(m));
  k.position.set(x, y, z); k.castShadow = true; k.receiveShadow = true; induk.add(k); return k;
}
function bola(r, m, x, y, z, induk = scene) {
  const k = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m.isMaterial ? m : mat(m));
  k.position.set(x, y, z); k.castShadow = true; induk.add(k); return k;
}
function teksturKanvas(w, h, gambar) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  gambar(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** Sprite teks yang bisa diganti isinya. */
const SKALA_LABEL = 1.5; // label lebih besar supaya terbaca di lantai 50x50
function papan(lebar = 2.1) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(lebar * SKALA_LABEL, (lebar * SKALA_LABEL) / 4, 1); s.renderOrder = 10;
  s.tulis = (teks, o) => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 512, 128);
    if (o.bg) { g.fillStyle = o.bg; g.beginPath(); g.roundRect(6, 14, 500, 100, o.bulat ?? 50); g.fill(); }
    if (o.garis) { g.strokeStyle = o.garis; g.lineWidth = 5; g.beginPath(); g.roundRect(9, 17, 494, 94, o.bulat ?? 8); g.stroke(); }
    g.fillStyle = o.fg; g.font = `800 ${o.ukuran || 50}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    let ukuran = o.ukuran || 50;
    while (g.measureText(teks).width > 470 && ukuran > 20) { ukuran -= 2; g.font = `800 ${ukuran}px ${FONT}`; }
    g.fillText(teks, 256, 66);
    t.needsUpdate = true;
  };
  return s;
}

// ---------------------------------------------------------------- ruangan
// ---------------------------------------------------------------- kota
/** Tekstur fasad: kisi jendela, sebagian menyala hangat atau dingin. */
function teksturFasad(benih, kolom = 8, baris = 24) {
  const r = acak(benih);
  return teksturKanvas(kolom * 32, baris * 40, (g, w, h) => {
    g.fillStyle = '#0c1430'; g.fillRect(0, 0, w, h);
    for (let b = 0; b < baris; b++) {
      g.fillStyle = '#16204a'; g.fillRect(0, b * 40 + 34, w, 6); // pelat lantai
      for (let k = 0; k < kolom; k++) {
        const n = r();
        g.fillStyle = n < 0.12 ? '#e9c27a' : n < 0.17 ? '#7fc0e6' : n < 0.2 ? '#d99a4a' : '#121a3a';
        g.fillRect(k * 32 + 4, b * 40 + 6, 24, 26);
      }
    }
  });
}
const FASAD = [11, 23, 37].map((b) => teksturFasad(b));
/** Material fasad dengan pengulangan sesuai ukuran (1 jendela ≈ 0.9 x 1.25 satuan). */
function matFasad(i, w, h) {
  const t = FASAD[i % FASAD.length].clone(); t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 4, h / 16);
  return new THREE.MeshStandardMaterial({ color: 0x8a96c0, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4, roughness: 0.6 });
}
const lampuAtap = []; // lampu merah di puncak gedung yang berkedip
let kedip = 0;

/**
 * Menara kantor (lantai di bawah dan dua lantai di atas kantor) dan gedung-gedung
 * tinggi di sekelilingnya. Tinggi gedung dibatasi menurut jaraknya, supaya dari
 * sudut kamera mana pun tidak menutupi ruangan kantor.
 */
function bangunKota(lebar, dalam, dinding, r) {
  const RX = lebar / 2, RZ = dalam / 2, LW = lebar + 0.6, DW = dalam + 0.6;
  const mAtap = mat(0x141b36, { r: 0.9 });
  const TANAH = -25; // permukaan jalan; lantai kantor di y = 0

  // ---- menara sendiri: lantai-lantai di bawah kantor sampai jalan, lobi menyala di dasar
  const TB = -1.65 - TANAH;
  const bawah = new THREE.Mesh(new THREE.BoxGeometry(LW, TB, DW), [
    matFasad(0, DW, TB), matFasad(0, DW, TB), mAtap, mAtap, matFasad(1, LW, TB), matFasad(1, LW, TB),
  ]);
  bawah.position.set(0, TANAH + TB / 2, 0); scene.add(bawah);
  kotak(LW + 0.1, 2.2, DW + 0.1, mat(0xffcf7a, { e: 0xffb347, ei: 0.55 }), 0, TANAH + 1.1, 0, scene, false);
  kotak(LW + 0.8, 0.25, DW + 0.8, 0x1b2a4e, 0, TANAH + 2.35, 0); // kanopi lobi
  // ---- dua lantai di atas kantor: hanya fasad yang berada di belakang ruangan (potongan diorama)
  const TA = 7, ya = 5 + TA / 2;
  const mDalam = mat(WARNA.dinding, { r: 0.9 });
  const fasad = (w, d, x, z, induk, i, sisiDalam) => {
    const luar = matFasad(i, Math.max(w, d), TA);
    const mats = [luar, luar, mAtap, mAtap, luar, luar]; mats[sisiDalam] = mDalam; // sisi dalam polos
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, TA, d), mats);
    m.position.set(x, ya, z); induk.add(m);
  };
  fasad(LW, 0.3, 0, -RZ - 0.15, dinding.dBelakang, 1, 4);
  fasad(LW, 0.3, 0, RZ + 0.15, dinding.dDepan, 1, 5);
  fasad(0.3, dalam, -RX - 0.15, 0, dinding.dKiri, 0, 0);
  fasad(0.3, dalam, RX + 0.15, 0, dinding.dKanan, 0, 1);
  for (const [g, w, d, x, z] of [
    [dinding.dBelakang, LW, 0.5, 0, -RZ - 0.1], [dinding.dDepan, LW, 0.5, 0, RZ + 0.1],
    [dinding.dKiri, 0.5, dalam, -RX - 0.1, 0], [dinding.dKanan, 0.5, dalam, RX + 0.1, 0],
  ]) kotak(w, 0.18, d, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.5 }), x, 5.05, z, g, false);
  const antena = new THREE.Group(); antena.position.set(-RX + 0.6, 5 + TA, -RZ + 0.6); dinding.dBelakang.add(antena);
  tabung(0.08, 0.12, 6, 0x8a96c0, 0, 3, 0, antena);
  const mMerah = mat(0xff5d6c, { e: 0xff5d6c, ei: 2 });
  bola(0.18, mMerah, 0, 6.1, 0, antena); lampuAtap.push(mMerah);

  // ---- jalan: blok 19 x 19 dengan jalan selebar 8 di antaranya
  const P = 62, N = 3, BATAS = (N + 0.5) * P, B = P - 8; // blok B x B, jalan selebar 8
  kotak(1000, 1, 1000, mat(0x161d38, { r: 1 }), 0, TANAH - 0.5, 0); // aspal
  const mTrotoar = mat(0x232c4f, { r: 0.95 });
  const mMarka = mat(0xe8dcc0, { e: 0xe8dcc0, ei: 0.25 });
  const mZebra = mat(0xb8c4e0, { e: 0xb8c4e0, ei: 0.15 });
  const mLampuJalan = mat(0xffcf7a, { e: 0xffb347, ei: 2.2 });
  const mSinar = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.22, depthWrite: false });
  const mKerb = mat(0x5a6690, { r: 0.8 });
  const mKayu = mat(0x8a5a3c, { r: 0.8 }), mBesi = mat(0x2a3242, { r: 0.6, m: 0.4 });
  const mPot = mat(0x3a4566, { r: 0.9 }), mDaun = mat(0x3f7a5e, { r: 0.9 });
  /** Bangku taman menghadap jalan; arah = rotasi y (0 menghadap +z). */
  function bangku(x, z, arah) {
    const g = new THREE.Group(); g.position.set(x, TANAH + 0.25, z); g.rotation.y = arah; scene.add(g);
    kotak(1.4, 0.08, 0.42, mKayu, 0, 0.42, 0, g, false);
    kotak(1.4, 0.32, 0.07, mKayu, 0, 0.7, -0.2, g, false);
    for (const s of [-0.6, 0.6]) kotak(0.06, 0.42, 0.42, mBesi, s, 0.21, 0, g, false);
  }
  function tanamanPot(x, z) {
    tabung(0.35, 0.28, 0.5, mPot, x, TANAH + 0.5, z);
    bola(0.45, mDaun, x, TANAH + 1.05, z);
  }
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const cx = i * P, cz = j * P;
    kotak(B, 0.25, B, mTrotoar, cx, TANAH + 0.12, cz); // trotoar blok
    kotak(B + 0.1, 0.05, B + 0.1, mKerb, cx, TANAH + 0.03, cz, scene, false); // bibir trotoar
    // lampu jalan di tengah keempat sisi blok, bangku di kiri-kanannya
    for (const [sx, sz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const lx = cx + (sx ? sx * (B / 2 - 0.4) : 0), lz = cz + (sz ? sz * (B / 2 - 0.4) : 0);
      for (const geser of [-9, 9]) bangku(lx + (sz ? geser : 0) - sx * 0.35, lz + (sx ? geser : 0) - sz * 0.35, Math.atan2(sx, sz));
      for (const pp of [-18, 18]) tanamanPot(lx + (sz ? pp : 0) - sx * 0.3, lz + (sx ? pp : 0) - sz * 0.3);
      tabung(0.06, 0.08, 3.2, 0x3a4566, lx, TANAH + 1.85, lz);
      bola(0.18, mLampuJalan, lx, TANAH + 3.5, lz);
      const s = new THREE.Mesh(new THREE.CircleGeometry(1.8, 20), mSinar);
      s.rotation.x = -Math.PI / 2; s.position.set(lx, TANAH + 0.27, lz); scene.add(s);
    }
  }
  // marka putus-putus di tengah jalan dan zebra cross di persimpangan
  for (let k = -N; k < N; k++) {
    const c = (k + 0.5) * P;
    for (let t = -BATAS; t < BATAS; t += 3) {
      if (Math.abs(((t % P) + P) % P - P / 2) < 4) continue; // kosongkan persimpangan
      kotak(0.15, 0.02, 1.4, mMarka, c, TANAH + 0.01, t, scene, false);
      kotak(1.4, 0.02, 0.15, mMarka, t, TANAH + 0.01, c, scene, false);
    }
  }
  // setiap persimpangan: zebra cross di keempat sisi, garis berhenti, dan lampu lalu lintas
  // Fase: jalan sumbu x hijau -> kuning -> merah (jalan sumbu z hijau) -> kuning -> ulang.
  const fase = { x: { m: mat(0x3a1418), k: mat(0x3a2a10), h: mat(0x10301c) }, z: { m: mat(0x3a1418), k: mat(0x3a2a10), h: mat(0x10301c) } };
  for (const f of Object.values(fase)) {
    f.m.emissive.set(0xff3b4a); f.k.emissive.set(0xffc23a); f.h.emissive.set(0x3dff8a);
  }
  const PUSAT = [];
  for (let k = -N; k < N; k++) PUSAT.push((k + 0.5) * P);
  const mTiang = mat(0x2a3242, { r: 0.6, m: 0.4 }), mKepala = mat(0x10141f, { r: 0.7 });
  function lampuLalin(x, z, sumbu, arahLengan) {
    tabung(0.07, 0.09, 4.2, mTiang, x, TANAH + 2.35, z);
    const g = new THREE.Group(); g.position.set(x, TANAH + 4.1, z); scene.add(g);
    const panjang = 1.6;
    const lengan = kotak(sumbu === 'x' ? 0.08 : panjang, 0.08, sumbu === 'x' ? panjang : 0.08, mTiang, 0, 0.3, 0, g, false);
    const ox = sumbu === 'x' ? 0 : arahLengan * panjang, oz = sumbu === 'x' ? arahLengan * panjang : 0;
    lengan.position.set(ox / 2, 0.3, oz / 2);
    const f = fase[sumbu];
    kotak(0.42, 1.15, 0.42, mKepala, ox, -0.05, oz, g, false);
    for (const sisi of [-1, 1]) { // lampu menghadap kedua arah arus
      const bx = sumbu === 'x' ? sisi * 0.24 : 0, bz = sumbu === 'z' ? sisi * 0.24 : 0;
      [f.m, f.k, f.h].forEach((mm, i) => bola(0.14, mm, ox + bx, 0.3 - i * 0.35, oz + bz, g));
    }
    // lampu kecil untuk penyeberang di tiang
    kotak(0.25, 0.3, 0.25, mKepala, 0, -2.1, 0, g, false);
  }
  for (const c of PUSAT) for (const d of PUSAT) {
    for (let s = -2.6; s <= 2.6; s += 0.75) {
      kotak(0.42, 0.02, 1.6, mZebra, c + s, TANAH + 0.01, d - 3.4, scene, false);
      kotak(0.42, 0.02, 1.6, mZebra, c + s, TANAH + 0.01, d + 3.4, scene, false);
      kotak(1.6, 0.02, 0.42, mZebra, c - 3.4, TANAH + 0.01, d + s, scene, false);
      kotak(1.6, 0.02, 0.42, mZebra, c + 3.4, TANAH + 0.01, d + s, scene, false);
    }
    for (const t of [-1, 1]) { // garis berhenti
      kotak(3.4, 0.02, 0.18, mMarka, c + t * 1.9, TANAH + 0.01, d - t * 4.5, scene, false);
      kotak(0.18, 0.02, 3.4, mMarka, c + t * 4.5, TANAH + 0.01, d + t * 1.9, scene, false);
    }
    // lampu di dua pojok berseberangan: satu untuk arus sumbu x, satu untuk sumbu z
    lampuLalin(c - 4.4, d - 4.4, 'x', 1);
    lampuLalin(c + 4.4, d + 4.4, 'x', -1);
    lampuLalin(c + 4.4, d - 4.4, 'z', 1);
    lampuLalin(c - 4.4, d + 4.4, 'z', -1);
  }
  const SIKLUS = 16;
  const jalanBoleh = (sumbu, t) => {
    const u = t % SIKLUS; // 0-6 x hijau, 6-8 x kuning, 8-14 z hijau, 14-16 z kuning
    return sumbu === 'x' ? u < 6 : (u >= 8 && u < 14);
  };
  const aturFase = (t) => {
    const u = t % SIKLUS;
    const xs = u < 6 ? 'h' : u < 8 ? 'k' : 'm', zs = u < 8 ? 'm' : u < 14 ? 'h' : u < 16 ? 'k' : 'm';
    for (const [sb, st] of [['x', xs], ['z', zs]]) for (const w of ['m', 'k', 'h']) fase[sb][w].emissiveIntensity = w === st ? 2.6 : 0.05;
  };
  aturFase(0);
  // mobil di setiap jalan, dua arah
  const mobil = [];
  const warnaMobil = [0xff5d6c, 0x5ad1ff, 0xe8dcc0, 0xffb347, 0x7fd1b9, 0x3a4f8a, 0xc9b9e8];
  const mDepan = mat(0xffffff, { e: 0xfff2c8, ei: 2.5 }), mBelakang = mat(0xff3b4a, { e: 0xff3b4a, ei: 2 });
  for (let k = -N; k < N; k++) for (const sumbu of ['x', 'z']) for (const arah of [-1, 1]) {
    for (let n = 0; n < 2; n++) {
      const g = new THREE.Group();
      kotak(1.0, 0.45, 2.1, warnaMobil[Math.floor(r() * warnaMobil.length)], 0, 0.42, 0, g);
      kotak(0.85, 0.35, 1.1, 0x16204a, 0, 0.8, -0.1, g);
      for (const s of [-0.32, 0.32]) {
        kotak(0.2, 0.12, 0.05, mDepan, s, 0.45, 1.06, g, false);
        kotak(0.2, 0.1, 0.05, mBelakang, s, 0.45, -1.06, g, false);
      }
      const lajur = (k + 0.5) * P + arah * 1.4; // lajur kiri/kanan
      g.userData = { sumbu, arah, lajur, pos: (r() - 0.5) * 2 * BATAS, laju: 5 + r() * 4 };
      g.rotation.y = sumbu === 'z' ? (arah > 0 ? 0 : Math.PI) : (arah > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.position.y = TANAH; scene.add(g); mobil.push(g);
    }
  }

  // ---- gedung di setiap blok, dengan bentuk berbeda-beda
  const BENTUK = ['kotak', 'bertingkat', 'silinder', 'kembar', 'runcing', 'L', 'bertingkat', 'silinder'];
  let nomor = 0;
  /** Tinggi puncak maksimum supaya tidak menutupi ruangan dari sudut kamera mana pun. */
  const maksPuncak = (x, z, w, d) => {
    const dx = Math.max(0, Math.abs(x) - w / 2), dz = Math.max(0, Math.abs(z) - d / 2);
    return 0.5 * (Math.hypot(dx, dz) - Math.hypot(lebar, dalam) / 2) - 1;
  };
  const kotakGedung = (w, h, d, x, y0, z, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
      matFasad(i, d, h), matFasad(i, d, h), mAtap, mAtap, matFasad(i + 1, w, h), matFasad(i + 1, w, h),
    ]);
    m.position.set(x, y0 + h / 2, z); scene.add(m); return m;
  };
  const atap = (w, d, x, y, z, i) => {
    kotak(w + 0.2, 0.35, d + 0.2, 0x1b2a4e, x, y + 0.17, z);
    if (i % 2 === 0) kotak(Math.min(1.4, w * 0.3), 0.8, Math.min(1.2, d * 0.3), 0x2a3a66, x + w * 0.2, y + 0.6, z - d * 0.15);
    if (i % 3 === 0) {
      tabung(0.06, 0.1, 3, 0x8a96c0, x - w * 0.25, y + 1.6, z + d * 0.2);
      const mm = mat(0xff5d6c, { e: 0xff5d6c, ei: 2 });
      bola(0.15, mm, x - w * 0.25, y + 3.15, z + d * 0.2); lampuAtap.push(mm);
    }
  };
  function gedung(x, z, w, d) {
    const i = nomor++;
    const bentuk = BENTUK[Math.floor(r() * BENTUK.length)];
    const jauh = Math.max(Math.abs(x), Math.abs(z)) > 2.5 * P;
    const ingin = TANAH + (jauh ? 22 + r() * 30 : 6 + r() * 18);
    const puncak = Math.min(ingin, maksPuncak(x, z, w, d));
    let h = puncak - TANAH;
    if (h < 5) return;
    if (bentuk === 'kotak') {
      kotakGedung(w, h, d, x, TANAH, z, i); atap(w, d, x, puncak, z, i);
    } else if (bentuk === 'bertingkat') {
      let y = TANAH, ww = w, dd = d;
      for (const bag of [0.55, 0.28, 0.17]) {
        const hh = h * bag; kotakGedung(ww, hh, dd, x, y, z, i);
        kotak(ww + 0.15, 0.2, dd + 0.15, 0x1b2a4e, x, y + hh, z);
        y += hh; ww *= 0.72; dd *= 0.72;
      }
      atap(ww / 0.72, dd / 0.72, x, y, z, i);
    } else if (bentuk === 'silinder') {
      const rr = Math.min(w, d) / 2, tex = matFasad(i, Math.PI * 2 * rr, h);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, h, 28), [tex, mAtap, mAtap]);
      m.position.set(x, TANAH + h / 2, z); scene.add(m);
      tabung(rr + 0.15, rr + 0.15, 0.35, 0x1b2a4e, x, puncak + 0.17, z);
      tabung(rr * 0.5, rr * 0.6, 1.2, mAtap, x, puncak + 0.9, z);
      const mm = mat(0x5ad1ff, { e: 0x5ad1ff, ei: 1.2 });
      tabung(rr * 0.52, rr * 0.52, 0.15, mm, x, puncak + 1.4, z); // cincin lampu di puncak
    } else if (bentuk === 'kembar') {
      const lebarSatu = w * 0.42, h2 = h * (0.7 + r() * 0.25);
      kotakGedung(lebarSatu, h, d * 0.8, x - w * 0.29, TANAH, z, i); atap(lebarSatu, d * 0.8, x - w * 0.29, puncak, z, i);
      kotakGedung(lebarSatu, h2, d * 0.8, x + w * 0.29, TANAH, z, i + 1); atap(lebarSatu, d * 0.8, x + w * 0.29, TANAH + h2, z, i + 1);
      kotak(w * 0.2, 1.2, d * 0.4, mat(0x5ad1ff, { e: 0x5ad1ff, ei: 0.5 }), x, TANAH + h2 * 0.6, z); // jembatan penghubung
    } else if (bentuk === 'runcing') {
      const hBadan = h * 0.82; kotakGedung(w * 0.85, hBadan, d * 0.85, x, TANAH, z, i);
      const atapLimas = new THREE.Mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.62, h * 0.14, 4), mat(0x2a3a66, { r: 0.5, m: 0.4 }));
      atapLimas.rotation.y = Math.PI / 4; atapLimas.position.set(x, TANAH + hBadan + h * 0.07, z); scene.add(atapLimas);
      tabung(0.05, 0.12, h * 0.06, 0xb0b8c8, x, TANAH + h * 0.97, z);
      const mm = mat(0xff5d6c, { e: 0xff5d6c, ei: 2 }); bola(0.16, mm, x, puncak + 0.1, z); lampuAtap.push(mm);
    } else { // L
      const h2 = h * (0.55 + r() * 0.3);
      kotakGedung(w, h2, d * 0.45, x, TANAH, z - d * 0.275, i); atap(w, d * 0.45, x, TANAH + h2, z - d * 0.275, i);
      kotakGedung(w * 0.45, h, d * 0.55, x - w * 0.275, TANAH, z + d * 0.225, i + 1); atap(w * 0.45, d * 0.55, x - w * 0.275, puncak, z + d * 0.225, i + 1);
    }
    if (i % 5 === 2 && bentuk !== 'silinder' && bentuk !== 'runcing') { // papan neon di atap
      const warna = ['#5ad1ff', '#ff8f6b', '#c9b9e8'][i % 3];
      const tx = teksturKanvas(256, 96, (c, cw, ch) => {
        c.fillStyle = '#0b1128'; c.fillRect(0, 0, cw, ch);
        c.shadowColor = warna; c.shadowBlur = 14; c.fillStyle = warna;
        c.font = `800 46px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(['LOGIKA', 'KOPI 24', 'HOTEL', 'APOTEK', 'MART'][i % 5], cw / 2, ch / 2);
      });
      const pp = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide }));
      pp.position.set(x, puncak + 1.4, z); pp.lookAt(0, puncak + 1.4, 0); scene.add(pp);
    }
  }
  // ---- minimarket dan papan reklame
  const TOKO = [
    { nama: 'SERBA ADA', papan: '#d9532b', teks: '#fff3e0', tenda: ['#d9532b', '#fff3e0'], dinding: 0xe8dcc0 },
    { nama: 'MART 24', papan: '#2f6fd6', teks: '#ffffff', tenda: ['#2f6fd6', '#ffd23a'], dinding: 0xdfe6f2 },
    { nama: 'TOKO KITA', papan: '#3f9a5e', teks: '#f4ffe8', tenda: ['#3f9a5e', '#f4ffe8'], dinding: 0xd8e8d0 },
    { nama: 'SEGAR MART', papan: '#ffb347', teks: '#3a2208', tenda: ['#ff8f6b', '#ffe7c2'], dinding: 0xf2e2cc },
    { nama: 'POJOK MART', papan: '#7a4fc9', teks: '#f6efff', tenda: ['#7a4fc9', '#e8dcff'], dinding: 0xe4dcf2 },
    { nama: 'KEDAI MALAM', papan: '#1d2b55', teks: '#ffcf7a', tenda: ['#1d2b55', '#ffcf7a'], dinding: 0xc8cfe0 },
    { nama: 'SINAR MART', papan: '#c92f4a', teks: '#ffe9ee', tenda: ['#c92f4a', '#ffffff'], dinding: 0xf0dde2 },
    { nama: 'BERKAH', papan: '#14857e', teks: '#e6fffb', tenda: ['#14857e', '#ffd23a'], dinding: 0xd4ece9 },
  ];
  const mEtalase = mat(0xfff2d0, { e: 0xfff2d0, ei: 0.9 }), mRak = mat(0x8a96c0, { r: 0.8 });
  const mPintuKaca = mat(0x9fc4ff, { e: 0x9fc4ff, ei: 0.35, r: 0.2 });
  /** Minimarket satu lantai; (fx, fz) arah muka toko ke jalan. */
  function minimarket(x, z, fx, fz, v) {
    const t = TOKO[v % TOKO.length];
    const g = new THREE.Group(); g.position.set(x, TANAH + 0.25, z); g.rotation.y = Math.atan2(fx, fz); scene.add(g);
    const W = 6.6, D = 5.4, H = 3.4;
    kotak(W, H, D, mat(t.dinding, { r: 0.85 }), 0, H / 2, 0, g, false);
    kotak(W + 0.2, 0.25, D + 0.2, 0x2a3242, 0, H + 0.12, 0, g, false);
    kotak(W - 1, 2.1, 0.06, mEtalase, 0, 1.25, D / 2 + 0.03, g, false); // etalase menyala
    for (let k = -2; k <= 2; k++) if (k !== 0) kotak(0.12, 1.9, 0.05, mRak, k * 1.15, 1.2, D / 2 + 0.07, g, false);
    kotak(1.2, 2.2, 0.08, mPintuKaca, 0, 1.1, D / 2 + 0.08, g, false); // pintu kaca
    const papan = teksturKanvas(512, 96, (c, w, h) => {
      c.fillStyle = t.papan; c.fillRect(0, 0, w, h);
      c.fillStyle = t.teks; c.font = `800 54px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t.nama, w / 2, h / 2 + 2);
    });
    const mPapan = new THREE.MeshStandardMaterial({ map: papan, emissive: 0xffffff, emissiveMap: papan, emissiveIntensity: 0.9 });
    const mPolos = mat(0x1b2233);
    const papanM = new THREE.Mesh(new THREE.BoxGeometry(W, 0.9, 0.2), [mPolos, mPolos, mPolos, mPolos, mPapan, mPolos]);
    papanM.position.set(0, H - 0.15, D / 2 + 0.12); g.add(papanM);
    const tenda = teksturKanvas(128, 32, (c, w, h) => {
      for (let k = 0; k < 8; k++) { c.fillStyle = t.tenda[k % 2]; c.fillRect(k * 16, 0, 16, h); }
    });
    const awning = kotak(W - 0.4, 0.06, 1.1, new THREE.MeshStandardMaterial({ map: tenda, roughness: 0.8 }), 0, 2.45, D / 2 + 0.55, g, false);
    awning.rotation.x = 0.35;
    kotak(1.2, 0.6, 0.9, 0xb0b8c8, -1.6, H + 0.55, -0.8, g, false); // AC di atap
    // kulkas es krim dan galon di teras
    kotak(0.9, 0.8, 0.6, mat(0xffffff, { e: 0xbfe6ff, ei: 0.4 }), W / 2 - 0.7, 0.4, D / 2 + 0.6, g, false);
    tabung(0.2, 0.2, 0.5, mat(0x7fd6ff, { t: true, op: 0.7 }), -W / 2 + 0.6, 0.25, D / 2 + 0.5, g);
  }
  const IKLAN = [
    ['KOPI SUSU', 'cuma 10 ribu', '#ffb347', '#1d1408'],
    ['PROMO 50%', 'akhir pekan', '#ff5d6c', '#ffffff'],
    ['LogikaKu', 'belajar logika tiap hari', '#5ad1ff', '#0b1128'],
    ['MIE PEDAS', 'level 1 sampai 10', '#d9532b', '#fff3e0'],
    ['KANTOR AI', 'buka 24 jam', '#ffcf7a', '#0b1128'],
    ['NONTON', 'malam ini jam 9', '#c9b9e8', '#1a1030'],
  ];
  /** Papan reklame bertiang di pojok blok, menghadap persimpangan. */
  function reklame(x, z, arah, i) {
    const [judul, sub, latar, warna] = IKLAN[i % IKLAN.length];
    tabung(0.18, 0.22, 7, mTiang, x, TANAH + 3.75, z);
    const g = new THREE.Group(); g.position.set(x, TANAH + 8.4, z); g.rotation.y = arah; scene.add(g);
    const tx = teksturKanvas(512, 256, (c, w, h) => {
      c.fillStyle = latar; c.fillRect(0, 0, w, h);
      c.fillStyle = warna; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 92px ${FONT}`; c.fillText(judul, w / 2, h * 0.42);
      c.font = `600 40px ${FONT}`; c.fillText(sub, w / 2, h * 0.78);
    });
    const mm = new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.75 });
    kotak(4.4, 2.3, 0.22, 0x1b2233, 0, 0, 0, g, false);
    const muka = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), mm); muka.position.z = 0.12; g.add(muka);
    const belakang = muka.clone(); belakang.rotation.y = Math.PI; belakang.position.z = -0.12; g.add(belakang);
    kotak(4.4, 0.08, 0.6, mTiang, 0, -1.25, 0.3, g, false); // jalan servis
    for (const s of [-1.4, 0, 1.4]) bola(0.1, mLampuJalan, s, 1.3, 0.35, g); // lampu sorot
  }
  // blok ritel: dua minimarket di satu sisi, gedung kecil di sisi lain, reklame di pojok
  const RITEL = new Map([[`1,0`, 0], [`0,1`, 1], [`1,1`, 2], [`-1,0`, 3], [`0,-1`, 4], [`2,-1`, 5], [`-1,2`, 6], [`-2,-2`, 7], [`2,2`, 8], [`-2,1`, 9]]);
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    if (i === 0 && j === 0) continue; // blok menara kantor
    const cx = i * P, cz = j * P;
    if (RITEL.has(`${i},${j}`)) {
      const v = RITEL.get(`${i},${j}`);
      // sisi toko menghadap jalan yang paling dekat kamera bawaan (+x/+z) bila mungkin
      const sx = (v % 2 === 0) ? 1 : -1;
      for (const [i2, dz] of [[0, -14], [1, 0], [2, 14]]) minimarket(cx + sx * (B / 2 - 5), cz + dz, sx, 0, v * 3 + i2);
      for (const sz of [-1, 1]) gedung(cx - sx * 12, cz + sz * 12, 18 + r() * 4, 18 + r() * 4);
      const pz = v % 3 === 0 ? -1 : 1;
      reklame(cx + sx * (B / 2 - 1.6), cz + pz * (B / 2 - 1.6), Math.atan2(sx, pz), v);
      continue;
    }
    const n = r();
    if (n < 0.35) gedung(cx, cz, 30 + r() * 10, 30 + r() * 10);
    else if (n < 0.7) {
      const sb = r() < 0.5;
      for (const s of [-1, 1]) gedung(cx + (sb ? s * 13 : 0), cz + (sb ? 0 : s * 13), sb ? 20 : 40, sb ? 40 : 20);
    } else for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (r() < 0.8) gedung(cx + sx * 12.5, cz + sz * 12.5, 18 + r() * 4, 18 + r() * 4);
    }
  }

  let waktuLalin = 0;
  return (dt) => {
    waktuLalin += dt; aturFase(waktuLalin);
    for (const g of mobil) {
      const u = g.userData;
      let maju = u.laju * dt;
      if (!jalanBoleh(u.sumbu, waktuLalin)) {
        // berhenti sebelum garis berhenti persimpangan di depan
        for (const c of PUSAT) {
          const jarak = (c - u.pos) * u.arah - 5.6;
          if (jarak > -0.3 && jarak < 2.5) { maju = Math.min(maju, Math.max(0, jarak)); break; }
        }
      }
      u.pos += u.arah * maju;
      if (u.pos > BATAS) u.pos -= 2 * BATAS; if (u.pos < -BATAS) u.pos += 2 * BATAS;
      if (u.sumbu === 'z') g.position.set(u.lajur, TANAH, u.pos); else g.position.set(u.pos, TANAH, u.lajur);
    }
  };
}

function bangunRuangan(lebar, dalam) {
  const RX = lebar / 2, RZ = dalam / 2;
  scene.add(new THREE.HemisphereLight(0x6f8fe8, 0x1b2a4e, 1.1));
  const bulan = new THREE.DirectionalLight(0x7fa0ff, 0.55);
  bulan.position.set(-10, 14, -8); bulan.castShadow = true;
  Object.assign(bulan.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36 });
  bulan.shadow.mapSize.set(2048, 2048); scene.add(bulan);
  const isi = new THREE.DirectionalLight(0x8fa8ff, 0.6); isi.position.set(14, 10, 14); scene.add(isi);
  const tepi = new THREE.DirectionalLight(0xb8c8ff, 0.9); tepi.position.set(-4, 8, -14); scene.add(tepi);

  // lantai kantor di dalam menara (lempeng + list emas pemisah lantai)
  kotak(lebar, 0.25, dalam, mat(WARNA.lantai, { r: 0.7 }), 0, -0.12, 0);
  kotak(lebar + 0.2, 1.4, dalam + 0.2, mat(WARNA.gelap, { r: 0.9 }), 0, -0.95, 0);
  kotak(lebar + 0.24, 0.06, dalam + 0.24, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.6 }), 0, -0.25, 0, scene, false);
  for (let z = -RZ + 0.35; z < RZ; z += 0.7) kotak(lebar, 0.02, 0.04, WARNA.lantaiGaris, 0, 0.01, z, scene, false);
  // dinding di empat sisi, masing-masing dengan isinya. Dinding yang berada di
  // antara kamera dan ruangan diganti tembok pendek (potongan diorama), supaya
  // ruangan tetap terlihat ketika diputar 360 derajat.
  const dBelakang = new THREE.Group(), dKiri = new THREE.Group();
  const dDepan = new THREE.Group(), dKanan = new THREE.Group();
  const pendek = { belakang: new THREE.Group(), kiri: new THREE.Group(), depan: new THREE.Group(), kanan: new THREE.Group() };
  scene.add(dBelakang, dKiri, dDepan, dKanan, ...Object.values(pendek));
  const LW = lebar + 0.6, TP = 0.55; // lebar dinding depan/belakang (menutup sudut), tinggi tembok pendek
  // dinding belakang dan depan berlubang jendela (kaca tembus pandang ke kota)
  const JB = { x: -12.5, w: 6 }, JD = { x: 2.2, w: 5 }, JY0 = 1.6, JY1 = 4.4;
  const mKaca = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const dindingJendela = (j, z, induk) => {
    const kiri = j.x - j.w / 2 + LW / 2, kanan = LW / 2 - (j.x + j.w / 2);
    kotak(kiri, 5, 0.3, WARNA.dinding, -LW / 2 + kiri / 2, 2.5, z, induk);
    kotak(kanan, 5, 0.3, WARNA.dinding, LW / 2 - kanan / 2, 2.5, z, induk);
    kotak(j.w, JY0, 0.3, WARNA.dinding, j.x, JY0 / 2, z, induk);
    kotak(j.w, 5 - JY1, 0.3, WARNA.dinding, j.x, (JY1 + 5) / 2, z, induk);
    const kaca = new THREE.Mesh(new THREE.PlaneGeometry(j.w, JY1 - JY0), mKaca);
    kaca.position.set(j.x, (JY0 + JY1) / 2, z); kaca.renderOrder = 5; induk.add(kaca);
  };
  dindingJendela(JB, -RZ - 0.15, dBelakang);
  kotak(0.3, 5, dalam, WARNA.dinding2, -RX - 0.15, 2.5, 0, dKiri);
  dindingJendela(JD, RZ + 0.15, dDepan);
  kotak(0.3, 5, dalam, WARNA.dinding2, RX + 0.15, 2.5, 0, dKanan);
  const mTepi = mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.5 });
  for (const [g, w, d, x, z] of [
    [pendek.belakang, LW, 0.3, 0, -RZ - 0.15], [pendek.depan, LW, 0.3, 0, RZ + 0.15],
    [pendek.kiri, 0.3, dalam, -RX - 0.15, 0], [pendek.kanan, 0.3, dalam, RX + 0.15, 0],
  ]) {
    kotak(w, TP, d, WARNA.dinding, x, TP / 2, z, g);
    kotak(w + 0.02, 0.04, d + 0.02, mTepi, x, TP + 0.02, z, g, false);
  }
  // list bawah (plint) di sepanjang dinding penuh
  kotak(lebar, 0.18, 0.06, WARNA.gelap2, 0, 0.09, -RZ + 0.03, dBelakang);
  kotak(lebar, 0.18, 0.06, WARNA.gelap2, 0, 0.09, RZ - 0.03, dDepan);
  kotak(0.06, 0.18, dalam, WARNA.gelap2, -RX + 0.03, 0.09, 0, dKiri);
  kotak(0.06, 0.18, dalam, WARNA.gelap2, RX - 0.03, 0.09, 0, dKanan);

  // jendela belakang: bingkai dan hujan di kaca
  const r = acak(27);
  const jx = JB.x;
  kotak(6.2, 0.12, 0.2, WARNA.gelap2, jx, 1.55, -RZ + 0.1, dBelakang); kotak(6.2, 0.12, 0.2, WARNA.gelap2, jx, 4.45, -RZ + 0.1, dBelakang);
  for (const dx of [-3.05, -1, 1, 3.05]) kotak(0.1, 2.9, 0.18, WARNA.gelap2, jx + dx, 3.0, -RZ + 0.1, dBelakang);
  // garis hujan di kaca (bergerak)
  const hujanKaca = [];
  const mHujan = new THREE.MeshBasicMaterial({ color: 0xc8d7ff, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.25), mHujan);
    m.position.set(jx - 2.9 + r() * 5.8, 1.7 + r() * 2.6, -RZ + 0.04); m.rotation.z = 0.2;
    dBelakang.add(m); hujanKaca.push(m);
  }

  // rak buku
  const rakZ = -RZ + 2.6; // di dalam ruang manajer
  kotak(0.5, 3.2, 2.6, WARNA.gelap, -RX + 0.25, 1.6, rakZ);
  const warnaBuku = [0x3a4f8a, 0xffb347, 0xc9b9e8, 0x5ad1ff, 0xe8dcc0];
  for (let b = 0; b < 4; b++) {
    kotak(0.5, 0.06, 2.6, 0x2a3a66, -RX + 0.25, 0.4 + b * 0.8, rakZ);
    for (let i = 0; i < 9; i++) kotak(0.35, 0.5 + r() * 0.15, 0.18, warnaBuku[(i + b) % 5], -RX + 0.28, 0.7 + b * 0.8, rakZ - 1.1 + i * 0.25);
  }
  // neon
  const neon = teksturKanvas(512, 160, (g, w, h) => {
    g.fillStyle = '#0b1128'; g.fillRect(0, 0, w, h);
    g.shadowColor = '#ffb347'; g.shadowBlur = 24; g.strokeStyle = '#ffcf7a'; g.lineWidth = 5;
    g.font = `800 78px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText('KANTOR AI', w / 2, h / 2);
  });
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.88), new THREE.MeshBasicMaterial({ map: neon }));
  nm.rotation.y = Math.PI / 2; nm.position.set(-RX + 0.02, 3.6, rakZ + 6.2); dKiri.add(nm);
  const lampuNeon = new THREE.PointLight(WARNA.sodium, 6, 6, 1.6); lampuNeon.position.set(-RX + 1, 3.6, rakZ + 6.2); scene.add(lampuNeon);
  // ---- dinding depan: jendela kedua
  const jx2 = 2.2;
  kotak(5.2, 0.12, 0.2, WARNA.gelap2, jx2, 1.55, RZ - 0.1, dDepan); kotak(5.2, 0.12, 0.2, WARNA.gelap2, jx2, 4.45, RZ - 0.1, dDepan);
  for (const dx of [-2.55, 0, 2.55]) kotak(0.1, 2.9, 0.18, WARNA.gelap2, jx2 + dx, 3.0, RZ - 0.1, dDepan);
  kotak(5.4, 0.08, 0.35, WARNA.krem, jx2, 1.5, RZ - 0.2, dDepan); // ambang jendela
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.25), mHujan);
    m.rotation.y = Math.PI; m.rotation.z = -0.2;
    m.position.set(jx2 - 2.4 + r() * 4.8, 1.7 + r() * 2.6, RZ - 0.04);
    dDepan.add(m); hujanKaca.push(m);
  }
  // kaktus kecil di ambang jendela
  for (const dx of [-1.6, 1.4]) {
    tabung(0.12, 0.1, 0.18, 0xd9532b, jx2 + dx, 1.63, RZ - 0.2, dDepan);
    tabung(0.07, 0.07, 0.25, 0x4f8a6b, jx2 + dx, 1.84, RZ - 0.2, dDepan);
  }

  // ---- dinding kanan: pintu, keset, tanda MASUK, papan tulis, jam dinding
  const pz = 3.6, px = RX - 0.04;
  kotak(0.1, 3.0, 1.7, WARNA.gelap2, px, 1.5, pz, dKanan); // kusen
  kotak(0.08, 2.8, 1.4, 0x8a5a3c, px - 0.03, 1.4, pz, dKanan); // daun pintu kayu
  for (const dy of [0.75, 2.0]) kotak(0.03, 0.9, 1.1, 0x7a4e33, px - 0.08, dy, pz, dKanan);
  bola(0.06, WARNA.krem, px - 0.12, 1.35, pz - 0.5, dKanan);
  const celah = kotak(0.02, 0.04, 1.4, mat(WARNA.sodium, { e: WARNA.sodium, ei: 2 }), px - 0.06, 0.02, pz, dKanan, false);
  celah.castShadow = false;
  const masuk = teksturKanvas(256, 96, (g, w, h) => {
    g.fillStyle = '#0d2a1c'; g.fillRect(0, 0, w, h);
    g.shadowColor = '#6dff9a'; g.shadowBlur = 16; g.fillStyle = '#9dffbb';
    g.font = `800 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MASUK', w / 2, h / 2 + 2);
  });
  const tMasuk = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: masuk }));
  tMasuk.rotation.y = -Math.PI / 2; tMasuk.position.set(RX - 0.03, 3.3, pz); dKanan.add(tMasuk);
  const lampuPintu = new THREE.PointLight(0x6dff9a, 1.5, 3, 2); lampuPintu.position.set(RX - 0.5, 3.2, pz); dKanan.add(lampuPintu);
  kotak(0.9, 0.02, 1.3, 0x3a2a4a, RX - 0.6, 0.02, pz, scene, false); // keset

  const papanTulis = teksturKanvas(512, 320, (g, w, h) => {
    g.fillStyle = '#e8eef8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a4f8a'; g.lineWidth = 6; g.lineCap = 'round';
    g.font = `800 40px ${FONT}`; g.fillStyle = '#3a4f8a'; g.fillText('RENCANA', 28, 60);
    g.fillStyle = '#d9532b'; g.font = `700 30px ${FONT}`;
    ['✓ tahap 1', '✓ tahap 2', '→ LogikaKu', '○ tahap 3'].forEach((t, i) => g.fillText(t, 36, 120 + i * 50));
    g.strokeStyle = '#4f8a6b'; g.beginPath(); g.moveTo(300, 260); g.lineTo(350, 190); g.lineTo(400, 220); g.lineTo(470, 110); g.stroke();
  });
  const papanM = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: papanTulis, color: 0xb8c4e0 }));
  papanM.rotation.y = -Math.PI / 2; papanM.position.set(RX - 0.08, 2.6, -3.6); dKanan.add(papanM);
  kotak(0.08, 1.7, 2.7, WARNA.gelap2, RX - 0.02, 2.6, -3.6, dKanan);
  kotak(0.15, 0.05, 2.0, WARNA.gelap2, RX - 0.1, 1.77, -3.6, dKanan);

  const jamCv = document.createElement('canvas'); jamCv.width = jamCv.height = 256;
  const jamTex = new THREE.CanvasTexture(jamCv); jamTex.colorSpace = THREE.SRGBColorSpace;
  let menitJam = -1;
  const gambarJam = () => {
    const d = new Date(Date.now() + 7 * 3600e3), h = d.getUTCHours(), m = d.getUTCMinutes();
    if (m === menitJam) return; menitJam = m;
    const g = jamCv.getContext('2d'); g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    g.strokeStyle = '#0a1128'; g.lineWidth = 10; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.lineWidth = 6; g.beginPath(); g.moveTo(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); g.lineTo(128 + Math.sin(a) * 106, 128 - Math.cos(a) * 106); g.stroke(); }
    const jarum = (a, p, l, c) => { g.strokeStyle = c; g.lineWidth = l; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * p, 128 - Math.cos(a) * p); g.stroke(); };
    jarum(((h % 12) + m / 60) * Math.PI / 6, 58, 10, '#0a1128');
    jarum(m * Math.PI / 30, 88, 6, '#d9532b');
    jamTex.needsUpdate = true;
  };
  gambarJam();
  const jamM = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40), new THREE.MeshBasicMaterial({ map: jamTex }));
  jamM.rotation.y = -Math.PI / 2; jamM.position.set(RX - 0.06, 3.9, -0.6); dKanan.add(jamM);

  // ---- ruang santai di seperempat kanan belakang: karpet, sofa L, TV, bean bag
  const lx0 = RX / 2, lz0 = -RZ / 2;
  kotak(13, 0.02, 10, 0x1f3a4a, lx0, 0.025, lz0 + 1, scene, false).receiveShadow = true;
  kotak(12.4, 0.022, 9.4, 0x27485a, lx0, 0.03, lz0 + 1, scene, false).receiveShadow = true;
  const mSofaL = mat(0x3a6f7a, { r: 0.95 });
  kotak(6, 0.45, 1, mSofaL, lx0, 0.32, lz0 + 4.5); kotak(6, 0.8, 0.28, mSofaL, lx0, 0.75, lz0 + 4.9);
  kotak(1, 0.45, 3.4, mSofaL, lx0 - 3.5, 0.32, lz0 + 3.3); kotak(0.28, 0.8, 3.4, mSofaL, lx0 - 3.9, 0.75, lz0 + 3.3);
  for (const dx of [-1.6, 0.4, 2.0]) kotak(0.6, 0.4, 0.14, [0xffcf7a, 0xff8f6b, 0xc9b9e8][Math.round(dx + 2) % 3], lx0 + dx, 0.7, lz0 + 4.65).rotation.x = -0.3;
  kotak(2.4, 0.08, 1.2, WARNA.meja, lx0, 0.42, lz0 + 2.4);
  for (const [dx, dz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) kotak(0.07, 0.4, 0.07, WARNA.gelap, lx0 + dx, 0.2, lz0 + 2.4 + dz);
  tabung(0.08, 0.07, 0.14, WARNA.krem, lx0 + 0.5, 0.53, lz0 + 2.3);
  // lemari TV dengan layar menyala
  kotak(5, 0.6, 0.7, WARNA.gelap, lx0, 0.3, lz0 - 3.2);
  kotak(4.4, 2.5, 0.12, 0x0a0f22, lx0, 2.0, lz0 - 3.3);
  const mTV = mat(0x5ad1ff, { e: 0x3a7fd6, ei: 0.9 });
  kotak(4.2, 2.3, 0.02, mTV, lx0, 2.0, lz0 - 3.23, scene, false);
  const lampuTV = new THREE.PointLight(0x5ad1ff, 3, 7, 1.6); lampuTV.position.set(lx0, 2, lz0 - 2.2); scene.add(lampuTV);
  for (const [dx, w] of [[-3.6, 0x5b3f7a], [3.6, 0xd9532b]]) { const bb = bola(0.6, w, lx0 + dx, 0.45, lz0 - 0.6); bb.scale.set(1, 0.7, 1); }
  // tanaman besar mengisi sudut-sudut kosong
  for (const [tx, tz, s] of [[RX - 0.6, -1.5, 1], [RX - 0.6, RZ - 6, 1.2], [-1, RZ - 0.7, 1], [-RX + 0.6, 12, 1.1], [1.5, -RZ + 1.2, 0.9], [RX - 9, -RZ + 1.2, 1]]) {
    tabung(0.35 * s, 0.28 * s, 0.6 * s, 0xd9532b, tx, 0.3 * s, tz);
    bola(0.55 * s, 0x4f8a6b, tx, 1.05 * s, tz); bola(0.38 * s, 0x3f7a5e, tx + 0.2, 1.5 * s, tz - 0.1);
  }
  // meja pingpong di area depan
  const px0 = RX / 2, pz0 = RZ - 7;
  kotak(5.4, 0.1, 3, 0x2f6f5e, px0, 1.0, pz0); kotak(5.4, 0.012, 0.05, 0xffffff, px0, 1.06, pz0, scene, false);
  kotak(0.04, 0.25, 3.1, 0xe8eef8, px0, 1.17, pz0, scene, false);
  for (const [dx, dz] of [[-2.4, -1.2], [2.4, -1.2], [-2.4, 1.2], [2.4, 1.2]]) kotak(0.1, 0.95, 0.1, WARNA.gelap, px0 + dx, 0.48, pz0 + dz);
  bola(0.06, 0xffffff, px0 + 1.2, 1.12, pz0 + 0.5);

  bangunFasilitas(RX, RZ);

  // ---- pojok santai: sofa dan meja kopi
  const sx = -RX + 3.5, sz = RZ - 0.75;
  const mSofa = mat(0x5b3f7a, { r: 0.95 });
  kotak(2.6, 0.45, 0.9, mSofa, sx, 0.32, sz);
  kotak(2.6, 0.75, 0.25, mSofa, sx, 0.75, sz + 0.35);
  for (const s of [-1, 1]) kotak(0.25, 0.6, 0.9, mSofa, sx + s * 1.3, 0.5, sz);
  kotak(0.5, 0.35, 0.12, 0xffb347, sx - 0.6, 0.72, sz + 0.15).rotation.x = -0.3; // bantal
  kotak(1.4, 0.06, 0.7, WARNA.meja, sx, 0.42, sz - 1.15);
  for (const [dx, dz] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]]) kotak(0.06, 0.4, 0.06, WARNA.gelap, sx + dx, 0.2, sz - 1.15 + dz);
  tabung(0.08, 0.07, 0.14, WARNA.krem, sx + 0.3, 0.52, sz - 1.1); // cangkir
  kotak(0.4, 0.04, 0.3, 0x5ad1ff, sx - 0.3, 0.47, sz - 1.2); // buku

  // ---- dispenser air dekat pintu
  const dx0 = RX - 0.55, dz0 = RZ - 0.8;
  kotak(0.5, 1.0, 0.5, WARNA.krem, dx0, 0.5, dz0);
  tabung(0.2, 0.2, 0.5, mat(0x7fd6ff, { t: true, op: 0.6, r: 0.2 }), dx0, 1.25, dz0);
  kotak(0.08, 0.06, 0.08, 0xff5d6c, dx0 - 0.26, 0.75, dz0 - 0.1); kotak(0.08, 0.06, 0.08, 0x5ad1ff, dx0 - 0.26, 0.75, dz0 + 0.1);

  // ---- lampu lantai di pojok kiri belakang
  tabung(0.2, 0.25, 0.05, WARNA.gelap, -RX + 0.7, 0.03, -RZ + 0.7);
  tabung(0.03, 0.03, 2.4, WARNA.krem, -RX + 0.7, 1.2, -RZ + 0.7);
  tabung(0.15, 0.35, 0.4, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.6 }), -RX + 0.7, 2.5, -RZ + 0.7);
  const lampuLantai = new THREE.PointLight(0xffa640, 3, 5, 1.6); lampuLantai.position.set(-RX + 0.8, 2.2, -RZ + 0.8); scene.add(lampuLantai);

  // ---- pojok kopi di kanan belakang: lemari, mesin espresso, cangkir, uap
  const kx = RX - 0.45, kz = -RZ + 2.1;
  kotak(0.8, 1.0, 1.8, WARNA.gelap, kx, 0.5, kz);
  kotak(0.86, 0.06, 1.86, 0x8a5a3c, kx, 1.03, kz);
  for (const dz of [-0.45, 0.45]) kotak(0.02, 0.7, 0.75, WARNA.gelap2, kx - 0.41, 0.48, kz + dz);
  const mesin = new THREE.Group(); mesin.position.set(kx, 1.06, kz - 0.3); scene.add(mesin);
  kotak(0.5, 0.65, 0.55, 0xb0b8c8, 0, 0.33, 0, mesin);
  kotak(0.52, 0.12, 0.57, 0xd9532b, 0, 0.7, 0, mesin);
  kotak(0.2, 0.08, 0.3, 0x0a0f22, -0.27, 0.42, 0, mesin);
  tabung(0.04, 0.04, 0.12, 0x2a3242, -0.27, 0.32, 0, mesin);
  kotak(0.22, 0.03, 0.3, 0x2a3242, -0.27, 0.03, 0, mesin);
  const mLampuKopi = mat(0x6dff9a, { e: 0x6dff9a, ei: 0.4 });
  bola(0.03, mLampuKopi, -0.26, 0.58, 0.18, mesin);
  tabung(0.06, 0.05, 0.1, WARNA.krem, -0.27, 0.1, 0, mesin); // cangkir di bawah corong
  for (let i = 0; i < 4; i++) tabung(0.06, 0.05, 0.11, [WARNA.krem, 0xff8f6b, 0x5ad1ff, 0xc9b9e8][i], kx - 0.15 + (i % 2) * 0.2, 1.12, kz + 0.35 + Math.floor(i / 2) * 0.22);
  kotak(0.3, 0.35, 0.25, 0x5b3f7a, kx + 0.05, 1.23, kz + 0.75); // stoples biji kopi
  const mUap = new THREE.MeshBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0, depthWrite: false });
  const uap = Array.from({ length: 6 }, (_, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mUap.clone());
    b.position.set(-0.27, 0.2 + i * 0.12, 0); b.userData.fase = i / 6; mesin.add(b); return b;
  });
  const lampuKopi = new THREE.PointLight(0xffa640, 0, 2.5, 1.8); lampuKopi.position.set(kx - 0.6, 1.8, kz - 0.3); scene.add(lampuKopi);
  kopi.titik = { x: LORONG_X - 0.1, z: kz - 0.3, arah: Math.PI / 2 };

  // tempat yang didatangi pegawai yang sedang jalan-jalan (arah = hadap tubuh, radian)
  tempatJalan = [
    { x: 2.2, z: RZ - 0.8, arah: 0 }, // jendela depan
    { x: -3, z: 1.0, arah: Math.PI }, // mengintip ruang manajer lewat kaca
    { x: RX / 2, z: -3.5, arah: Math.PI }, // menonton TV di ruang santai
    { x: RX - 1.3, z: RZ - 0.8, arah: Math.PI / 2 }, // dispenser
    { x: LORONG_X, z: 1.6, arah: Math.PI / 2 }, // papan tulis dari jauh
    { x: -1, z: 12.4, arah: 0 }, // ngemil di meja bar pantry
    { x: 19, z: 11.6, arah: Math.PI }, // memilih buku di perpustakaan
  ];

  // tanaman
  tabung(0.3, 0.25, 0.6, WARNA.gelap, RX - 0.8, 0.3, -RZ + 0.8);
  for (let i = 0; i < 6; i++) {
    const d = bola(0.3, 0x2d5a50, RX - 0.8 + Math.cos(i) * 0.2, 0.9 + i * 0.08, -RZ + 0.8 + Math.sin(i) * 0.2);
    d.scale.set(0.5, 1.5, 0.5); d.rotation.z = Math.cos(i * 2) * 0.6;
  }
  // tanaman besar di pojok kiri depan
  tabung(0.35, 0.28, 0.7, 0xd9532b, -RX + 0.7, 0.35, RZ - 0.7);
  for (let i = 0; i < 9; i++) {
    const d = bola(0.32, i % 2 ? 0x2d5a50 : 0x3f7a62, -RX + 0.7 + Math.cos(i * 1.3) * 0.25, 1.0 + i * 0.1, RZ - 0.7 + Math.sin(i * 1.3) * 0.25);
    d.scale.set(0.45, 1.6, 0.45); d.rotation.z = Math.cos(i * 2.1) * 0.7; d.rotation.x = Math.sin(i * 1.7) * 0.5;
  }

  const animasiKota = bangunKota(lebar, dalam, { dBelakang, dKiri, dDepan, dKanan }, r);

  // hujan di luar lempeng
  const titik = [];
  for (let i = 0; i < 900; i++) {
    const x = (r() - 0.5) * 140, z = (r() - 0.5) * 140;
    if (Math.abs(x) < RX + 0.5 && Math.abs(z) < RZ + 0.5) continue;
    const y = r() * 41 - 25;
    titik.push(x, y, z, x - 0.05, y - 0.55, z);
  }
  const gHujan = new THREE.BufferGeometry();
  gHujan.setAttribute('position', new THREE.Float32BufferAttribute(titik, 3));
  const hujan = new THREE.LineSegments(gHujan, new THREE.LineBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.35 }));
  scene.add(hujan);

  return (dt) => {
    const cz = kamera.position.z > kontrol.target.z, cx = kamera.position.x > kontrol.target.x;
    dBelakang.visible = cz; pendek.belakang.visible = !cz;
    dDepan.visible = !cz; pendek.depan.visible = cz;
    dKiri.visible = cx; pendek.kiri.visible = !cx;
    dKanan.visible = !cx; pendek.kanan.visible = cx;
    gambarJam();
    animasiKota(dt);
    const p = gHujan.attributes.position.array;
    for (let i = 1; i < p.length; i += 6) {
      p[i] -= dt * 9; p[i + 3] -= dt * 9;
      if (p[i] < -25) { p[i] += 41; p[i + 3] += 41; }
    }
    gHujan.attributes.position.needsUpdate = true;
    for (const m of hujanKaca) { m.position.y -= dt * 1.2; if (m.position.y < 1.7) m.position.y += 2.6; }
    kedip = (kedip + dt) % 1.6;
    for (const m of lampuAtap) m.emissiveIntensity = kedip < 0.5 ? 2.4 : 0.15;
    // mesin kopi mengepul saat ada yang menyeduh
    kopi.uap = Math.max(0, kopi.uap - dt);
    const aktif = kopi.uap > 0;
    lampuKopi.intensity = aktif ? 2.5 : 0; mLampuKopi.emissiveIntensity = aktif ? 2.5 : 0.4;
    for (const b of uap) {
      b.userData.fase = (b.userData.fase + dt * 0.6) % 1;
      const f = b.userData.fase;
      b.position.y = 0.2 + f * 0.9; b.scale.setScalar(0.6 + f * 1.6);
      b.material.opacity = aktif ? 0.35 * (1 - f) : 0;
    }
  };
}

// ---------------------------------------------------------------- area departemen + fasilitas
/** Papan nama dua sisi (teks terang di atas panel gelap). */
function papanNama(teks, w, x, y, z, rotY = 0, warna = '#ffcf7a') {
  const tx = teksturKanvas(512, 128, (c, cw, ch) => {
    c.fillStyle = '#141b36'; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = warna; c.lineWidth = 6; c.strokeRect(6, 6, cw - 12, ch - 12);
    c.fillStyle = warna; c.font = `800 ${teks.length > 10 ? 50 : 62}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(teks, cw / 2, ch / 2 + 3);
  });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide }));
  pl.position.set(x, y, z); pl.rotation.y = rotY; scene.add(pl);
  return pl;
}

/** Dinding kaca sejajar sumbu dari (ax, az) ke (bx, bz), setinggi T. */
function dindingKaca(ax, az, bx, bz, T = 2.6) {
  const mRangka = mat(0x2a3242, { r: 0.5, m: 0.5 });
  const mKaca = new THREE.MeshStandardMaterial({ color: 0xa9c8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const panjang = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, sepanjangX = az === bz;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(panjang, T - 0.15), mKaca);
  p.position.set(cx, (T - 0.15) / 2 + 0.08, cz); if (!sepanjangX) p.rotation.y = Math.PI / 2;
  p.renderOrder = 5; scene.add(p);
  const w = sepanjangX ? panjang : 0.08, d = sepanjangX ? 0.08 : panjang;
  kotak(w, 0.08, d, mRangka, cx, T, cz, scene, false);
  kotak(w, 0.12, d, mRangka, cx, 0.06, cz, scene, false);
  const n = Math.max(1, Math.round(panjang / 1.8));
  for (let i = 0; i <= n; i++) kotak(0.08, T, 0.08, mRangka, ax + (bx - ax) * i / n, T / 2, az + (bz - az) * i / n, scene, false);
}

/**
 * Area kerja satu departemen: karpet berwarna departemen, sekat rendah di kiri,
 * kanan, dan depan (belakang kursi dibiarkan terbuka untuk lorong), papan nama,
 * lemari rendah, tanaman, dan kursi tamu.
 */
function bangunArea(k, x, z, indeks) {
  const baju = BAJU[k.id] || BAJU_LAIN[indeks % BAJU_LAIN.length];
  const L = AREA.lebar, hx = L / 2, za = z - 2.2, zd = z + AREA.dalam - 1; // karpet dari belakang kursi sampai sekat depan
  const warnaKarpet = new THREE.Color(baju).lerp(new THREE.Color(0x141a3a), 0.78);
  kotak(L, 0.02, zd - za, warnaKarpet, x, 0.025, (za + zd) / 2, scene, false).receiveShadow = true;
  kotak(L - 0.5, 0.022, zd - za - 0.5, warnaKarpet.clone().lerp(new THREE.Color(baju), 0.12), x, 0.03, (za + zd) / 2, scene, false).receiveShadow = true;
  const mSekat = mat(0x2c3766, { r: 0.95 }), mList = mat(baju, { r: 0.6 });
  const H = 1.15, zs = z - 0.5; // sekat samping mulai di depan kursi, lorong di belakang kursi tetap bebas
  for (const s of [-1, 1]) {
    kotak(0.1, H, zd - zs, mSekat, x + s * hx, H / 2, (zs + zd) / 2);
    kotak(0.14, 0.06, zd - zs, mList, x + s * hx, H + 0.03, (zs + zd) / 2, scene, false);
  }
  kotak(L, 0.9, 0.1, mSekat, x, 0.45, zd);
  kotak(L, 0.06, 0.14, mList, x, 0.93, zd, scene, false);
  papanNama((k.departemen || k.nama || k.id).toUpperCase(), 2.6, x, 0.5, zd + 0.07, 0, baju);
  // lemari rendah di sisi depan dalam, tanaman di atasnya
  kotak(2.2, 0.6, 0.5, WARNA.gelap, x + 1.9, 0.3, zd - 0.4);
  kotak(2.24, 0.05, 0.54, 0x8a5a3c, x + 1.9, 0.62, zd - 0.4);
  for (let i = 0; i < 3; i++) kotak(0.16, 0.32 + (i % 2) * 0.08, 0.3, [0x5ad1ff, 0xffcf7a, 0xff8f6b][(i + indeks) % 3], x + 1.2 + i * 0.22, 0.82, zd - 0.4);
  tabung(0.14, 0.11, 0.22, 0xd9532b, x + 2.6, 0.76, zd - 0.4);
  bola(0.22, 0x4f8a6b, x + 2.6, 1.0, zd - 0.4);
  // kursi tamu menghadap meja
  const kt = new THREE.Group(); kt.position.set(x - 1.6, 0, z + 1.9); kt.rotation.y = Math.PI; scene.add(kt);
  kotak(0.6, 0.08, 0.6, mList, 0, 0.5, 0, kt); kotak(0.6, 0.6, 0.08, mList, 0, 0.8, -0.28, kt);
  for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) kotak(0.05, 0.5, 0.05, WARNA.gelap, dx, 0.25, dz, kt);
}

/** Ruang rapat kaca (kiri depan), pantry (tengah depan), dan perpustakaan (kanan depan). */
function bangunFasilitas(RX, RZ) {
  // ---- ruang rapat berdinding kaca
  const r0 = { x0: -20, x1: -8, z0: 14, z1: 22 };
  kotak(r0.x1 - r0.x0 - 0.1, 0.03, r0.z1 - r0.z0 - 0.1, mat(0x24304f, { r: 0.8 }), (r0.x0 + r0.x1) / 2, 0.02, (r0.z0 + r0.z1) / 2, scene, false).receiveShadow = true;
  dindingKaca(r0.x0, r0.z0, r0.x1, r0.z0);
  dindingKaca(r0.x0, r0.z1, r0.x1, r0.z1);
  dindingKaca(r0.x0, r0.z0, r0.x0, r0.z1);
  dindingKaca(r0.x1, r0.z0 + 1.6, r0.x1, r0.z1); // celah pintu di ujung depan dinding kanan
  papanNama('RUANG RAPAT', 3.2, (r0.x0 + r0.x1) / 2, 3.05, r0.z1);
  const mx = (r0.x0 + r0.x1) / 2, mz = (r0.z0 + r0.z1) / 2;
  kotak(6.4, 0.1, 2.0, mat(WARNA.meja, { r: 0.4 }), mx, 0.8, mz);
  for (const dx of [-2.4, 2.4]) kotak(0.2, 0.75, 1.4, WARNA.gelap, mx + dx, 0.38, mz);
  const mKursi = mat(0x3a4f8a, { r: 0.9 });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const kx = mx - 2.4 + i * 1.6, kz = mz + s * 1.45;
    kotak(0.6, 0.08, 0.6, mKursi, kx, 0.5, kz); kotak(0.6, 0.7, 0.08, mKursi, kx, 0.85, kz + s * 0.28);
    tabung(0.04, 0.04, 0.45, WARNA.gelap2, kx, 0.25, kz);
  }
  for (const dx of [-1.5, 0.8]) kotak(0.4, 0.02, 0.3, WARNA.krem, mx + dx, 0.86, mz - 0.3).rotation.y = dx;
  // layar presentasi di dinding kiri
  kotak(0.1, 1.8, 3.2, 0x0a0f22, r0.x0 + 0.15, 1.7, mz);
  kotak(0.02, 1.6, 3.0, mat(0x8fb3ff, { e: 0x3a7fd6, ei: 0.7 }), r0.x0 + 0.21, 1.7, mz, scene, false);
  tabung(0.3, 0.24, 0.55, 0xd9532b, r0.x1 - 0.5, 0.28, r0.z1 - 0.5);
  bola(0.45, 0x4f8a6b, r0.x1 - 0.5, 0.95, r0.z1 - 0.5);
  const lampuRapat = new THREE.PointLight(0xffd9a0, 2, 8, 1.6); lampuRapat.position.set(mx, 2.6, mz); scene.add(lampuRapat);

  // ---- pantry: meja bar dengan kursi tinggi, konter belakang, kulkas
  const px = -1, pz = 13.9;
  kotak(7, 0.95, 0.9, WARNA.gelap, px, 0.48, pz);
  kotak(7.2, 0.08, 1.1, mat(0xe8eef8, { r: 0.3 }), px, 1.0, pz);
  for (let i = 0; i < 5; i++) {
    const sx = px - 2.8 + i * 1.4;
    tabung(0.25, 0.25, 0.08, mat(0xff8f6b, { r: 0.8 }), sx, 0.75, pz - 0.8);
    tabung(0.04, 0.04, 0.7, WARNA.gelap2, sx, 0.37, pz - 0.8);
  }
  for (const [dx, w] of [[-2, 0xffcf7a], [0.6, 0x5ad1ff], [2.4, 0xff5d6c]]) tabung(0.07, 0.06, 0.13, w, px + dx, 1.11, pz);
  const bz = pz + 3.6;
  kotak(7, 0.95, 0.7, WARNA.krem, px - 0.6, 0.48, bz);
  kotak(7.1, 0.06, 0.8, 0x8a5a3c, px - 0.6, 0.98, bz);
  kotak(0.7, 0.04, 0.45, 0xb0b8c8, px - 2.5, 1.02, bz); // bak cuci
  kotak(0.9, 0.5, 0.5, 0x2a3242, px + 0.8, 1.26, bz); // microwave
  kotak(0.5, 0.3, 0.02, mat(0x6dff9a, { e: 0x6dff9a, ei: 0.3 }), px + 0.75, 1.28, bz - 0.26, scene, false);
  kotak(7, 0.7, 0.4, WARNA.gelap, px - 0.6, 2.4, bz + 0.15); // lemari gantung
  kotak(1.2, 2.2, 0.9, 0xd8dde8, px + 3.6, 1.1, bz); // kulkas
  kotak(0.05, 0.7, 0.05, 0x8a96c0, px + 3.1, 1.4, bz - 0.47);
  papanNama('PANTRY', 2.4, px, 3.2, bz + 0.37);
  for (const dx of [-2, 0, 2]) {
    tabung(0.015, 0.015, 1.4, WARNA.krem, px + dx, 3.7, pz);
    tabung(0.1, 0.3, 0.25, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.8 }), px + dx, 2.9, pz);
  }
  const lampuPantry = new THREE.PointLight(0xffa640, 2.2, 7, 1.6); lampuPantry.position.set(px, 2.6, pz); scene.add(lampuPantry);

  // ---- perpustakaan kecil: rak buku, karpet, dua kursi baca, lampu
  const lx = 18.75, lz = 10.6; // rak membelakangi sekat area departemen, buku menghadap depan
  kotak(7, 0.02, 5.5, 0x3a2a4a, lx, 0.025, lz + 2.6, scene, false).receiveShadow = true;
  kotak(6.4, 2.4, 0.5, mat(0x5a3a2a, { r: 0.8 }), lx, 1.2, lz);
  const warnaBuku = [0xff8f6b, 0x5ad1ff, 0xffcf7a, 0xc9b9e8, 0x7fd1b9, 0xd98fb0, 0xe8eef8];
  for (let rak = 0; rak < 4; rak++) {
    const y = 0.25 + rak * 0.55;
    kotak(6.2, 0.04, 0.05, 0x3a2418, lx, y - 0.02, lz + 0.26, scene, false);
    let bx = lx - 3.0, j = 0;
    while (bx < lx + 2.9) {
      const w = 0.1 + ((j * 7 + rak * 3) % 5) * 0.03, h = 0.32 + ((j * 5 + rak) % 4) * 0.04;
      if ((j + rak) % 9 !== 4) kotak(w, h, 0.05, warnaBuku[(j * 3 + rak) % warnaBuku.length], bx + w / 2, y + h / 2, lz + 0.27, scene, false);
      bx += w + 0.02; j++;
    }
  }
  papanNama('PERPUSTAKAAN', 3, lx, 2.75, lz + 0.27);
  const mKursiBaca = mat(0xb6c46a, { r: 0.95 });
  for (const dx of [-2.2, 2.2]) {
    const g = new THREE.Group(); g.position.set(lx + dx, 0, 13.6); g.rotation.y = Math.PI + (dx < 0 ? -0.5 : 0.5); scene.add(g);
    kotak(1.1, 0.45, 1.0, mKursiBaca, 0, 0.3, 0, g); kotak(1.1, 0.8, 0.25, mKursiBaca, 0, 0.75, -0.4, g);
    for (const s of [-1, 1]) kotak(0.2, 0.6, 1.0, mKursiBaca, s * 0.55, 0.45, 0, g);
  }
  kotak(0.8, 0.5, 0.8, WARNA.meja, lx, 0.25, 13.8);
  kotak(0.35, 0.06, 0.25, 0x5ad1ff, lx, 0.53, 13.8);
  tabung(0.02, 0.02, 1.6, WARNA.krem, lx + 3.2, 0.8, 13.6);
  tabung(0.12, 0.25, 0.25, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.8 }), lx + 3.2, 1.65, 13.6);
  const lampuBaca = new THREE.PointLight(0xffa640, 1.8, 6, 1.6); lampuBaca.position.set(lx, 2.2, 12.6); scene.add(lampuBaca);
}

// ---------------------------------------------------------------- ruang manajer
const posisi0 = (t, id) => t.meja.find((m) => m.id === id);

/**
 * Ruang manajer di sisi belakang lantai: dinding kaca rendah dengan rangka,
 * pintu kaca terbuka dengan papan nama, karpet, meja rapat bundar, rak buku,
 * tanaman, lampu gantung, dan lemari arsip.
 */
function bangunRuangManajer(r, meja) {
  const { x0, x1, z0, z1, pintu } = r;
  const T = 2.8; // tinggi dinding kaca, lebih rendah dari dinding luar supaya papan nama tetap terlihat
  const mRangka = mat(0x2a3242, { r: 0.5, m: 0.5 });
  const mKacaR = new THREE.MeshStandardMaterial({ color: 0xa9c8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const mGaris = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.22, depthWrite: false }); // pita kaca buram
  // lantai kayu yang lebih hangat
  kotak(x1 - x0 - 0.1, 0.03, z1 - z0 - 0.1, mat(0x3b2a3a, { r: 0.7 }), (x0 + x1) / 2, 0.02, (z0 + z1) / 2, scene, false).receiveShadow = true;
  for (let z = z0 + 0.4; z < z1; z += 0.55) kotak(x1 - x0 - 0.1, 0.005, 0.03, 0x2b1f2c, (x0 + x1) / 2, 0.04, z, scene, false);
  /** Satu bentang dinding kaca dari (ax, az) ke (bx, bz), sejajar sumbu. */
  function kaca(ax, az, bx, bz) {
    const panjang = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, sepanjangX = az === bz;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(panjang, T - 0.15), mKacaR);
    p.position.set(cx, (T - 0.15) / 2 + 0.08, cz); if (!sepanjangX) p.rotation.y = Math.PI / 2;
    p.renderOrder = 5; scene.add(p);
    const w = sepanjangX ? panjang : 0.08, d = sepanjangX ? 0.08 : panjang;
    kotak(w, 0.08, d, mRangka, cx, T, cz, scene, false); // ambang atas
    kotak(w, 0.12, d, mRangka, cx, 0.06, cz, scene, false); // ambang bawah
    kotak(sepanjangX ? panjang : 0.02, 0.3, sepanjangX ? 0.02 : panjang, mGaris, cx, 1.15, cz, scene, false).renderOrder = 6; // pita buram di kaca
    const n = Math.max(1, Math.round(panjang / 1.8));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      kotak(0.08, T, 0.08, mRangka, ax + (bx - ax) * f, T / 2, az + (bz - az) * f, scene, false);
    }
  }
  const lebarPintu = 1.0;
  kaca(x0 + 0.3, z1, pintu.x - lebarPintu / 2, z1); // dinding depan sampai pintu
  kaca(x1, z0 + 0.3, x1, z1); // dinding samping kanan
  kotak(x1 - (pintu.x + lebarPintu / 2) + 0.04, T, 0.08, mRangka, (x1 + pintu.x + lebarPintu / 2) / 2, T / 2, z1, scene, false); // tiang pojok
  kotak(lebarPintu, 0.3, 0.08, mRangka, pintu.x, T - 0.1, z1, scene, false); // kusen atas pintu
  // daun pintu kaca terbuka ke dalam
  const engsel = new THREE.Group(); engsel.position.set(pintu.x - lebarPintu / 2, 0, z1); engsel.rotation.y = 1.25; scene.add(engsel);
  const daun = new THREE.Mesh(new THREE.PlaneGeometry(lebarPintu - 0.05, T - 0.4), mKacaR);
  daun.position.set((lebarPintu - 0.05) / 2, (T - 0.4) / 2 + 0.05, 0); daun.renderOrder = 5; engsel.add(daun);
  kotak(0.04, T - 0.4, 0.05, mRangka, lebarPintu - 0.06, (T - 0.4) / 2 + 0.05, 0, engsel, false);
  kotak(0.04, 0.3, 0.06, WARNA.krem, lebarPintu - 0.18, 1.05, 0.04, engsel, false); // gagang
  // papan nama MANAJER di atas pintu, menghadap keluar
  const tx = teksturKanvas(512, 128, (c, w, h) => {
    c.fillStyle = '#141b36'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffcf7a'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#ffcf7a'; c.font = `800 64px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('MANAJER', w / 2, h / 2 + 3);
  });
  for (const s of [1, -1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: tx }));
    pl.position.set(pintu.x - 0.4, T + 0.28, z1 + s * 0.05); if (s < 0) pl.rotation.y = Math.PI; scene.add(pl);
  }
  kotak(1.55, 0.42, 0.06, mRangka, pintu.x - 0.4, T + 0.28, z1, scene, false);

  // karpet di bawah meja manajer
  kotak(8, 0.02, 6, 0x5b2f3a, meja.x, 0.05, meja.z - 0.3, scene, false).receiveShadow = true;
  kotak(7.4, 0.022, 5.4, 0x7a3f4c, meja.x, 0.055, meja.z - 0.3, scene, false).receiveShadow = true;
  // lampu gantung di atas meja
  tabung(0.015, 0.015, 1.6, WARNA.krem, meja.x, 4.2, meja.z, scene);
  tabung(0.12, 0.45, 0.35, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.8 }), meja.x, 3.3, meja.z);
  const lampuGantung = new THREE.PointLight(0xffb347, 5, 6, 1.5); lampuGantung.position.set(meja.x, 3.0, meja.z); scene.add(lampuGantung);

  // meja rapat bundar dengan empat kursi
  const mx = x0 + 6, mz = (z0 + z1) / 2 + 3;
  tabung(0.75, 0.75, 0.07, mat(WARNA.meja, { r: 0.5 }), mx, 0.78, mz);
  tabung(0.08, 0.2, 0.75, WARNA.gelap, mx, 0.38, mz);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, kx = mx + Math.sin(a) * 1.05, kz = mz + Math.cos(a) * 1.05;
    const g = new THREE.Group(); g.position.set(kx, 0, kz); g.rotation.y = a + Math.PI; scene.add(g);
    kotak(0.5, 0.07, 0.5, 0x5b3f7a, 0, 0.48, 0, g); kotak(0.5, 0.5, 0.07, 0x5b3f7a, 0, 0.75, -0.22, g);
    tabung(0.04, 0.04, 0.45, WARNA.gelap2, 0, 0.23, 0, g);
  }
  kotak(0.5, 0.02, 0.35, WARNA.krem, mx - 0.15, 0.83, mz + 0.1).rotation.y = 0.3; // berkas rapat
  tabung(0.06, 0.05, 0.11, 0xff8f6b, mx + 0.3, 0.87, mz - 0.2);

  // lemari arsip dan piala di samping pintu (dalam ruangan)
  const ax = x1 - 0.45, az = z0 + 1.0;
  kotak(0.7, 1.3, 1.4, WARNA.gelap, ax, 0.65, az);
  for (const dy of [0.35, 0.75, 1.1]) kotak(0.02, 0.28, 1.2, WARNA.gelap2, ax - 0.36, dy, az);
  tabung(0.1, 0.14, 0.12, 0xffcf7a, ax, 1.37, az - 0.3); // piala
  tabung(0.14, 0.06, 0.25, mat(0xffcf7a, { m: 0.8, r: 0.3 }), ax, 1.55, az - 0.3);
  kotak(0.3, 0.38, 0.05, 0xe8dcc0, ax, 1.5, az + 0.3).rotation.y = -0.4; // bingkai foto
  // sofa tamu di dinding belakang dengan meja samping dan lampu baca
  const fx = x1 - 3.2, fz = z0 + 0.75;
  const mSofaM = mat(0x7a3f4c, { r: 0.95 });
  kotak(2.4, 0.42, 0.85, mSofaM, fx, 0.3, fz);
  kotak(2.4, 0.7, 0.22, mSofaM, fx, 0.7, fz - 0.33);
  for (const s of [-1, 1]) kotak(0.22, 0.58, 0.85, mSofaM, fx + s * 1.2, 0.45, fz);
  kotak(0.45, 0.32, 0.12, 0xffcf7a, fx - 0.5, 0.66, fz - 0.15).rotation.x = -0.3;
  kotak(0.5, 0.5, 0.5, WARNA.meja, fx + 1.75, 0.25, fz);
  tabung(0.02, 0.02, 1.5, WARNA.krem, fx + 1.75, 1.25, fz);
  tabung(0.12, 0.22, 0.25, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.7 }), fx + 1.75, 2.0, fz);
  // tanaman besar di pojok
  tabung(0.3, 0.24, 0.55, 0xd9532b, x1 - 0.45, 0.28, z1 - 0.45);
  bola(0.45, 0x4f8a6b, x1 - 0.45, 0.95, z1 - 0.45); bola(0.3, 0x3f7a5e, x1 - 0.3, 1.3, z1 - 0.55);
}

// ---------------------------------------------------------------- meja + karakter
const target = []; // mesh yang bisa diklik

function bangunMeja(k, x, z, indeks) {
  const grup = new THREE.Group(); grup.position.set(x, 0, z); scene.add(grup);
  const besar = k.id === 'manajer';
  const lebar = besar ? 2.6 : 2.1;
  const baju = BAJU[k.id] || BAJU_LAIN[indeks % BAJU_LAIN.length];

  kotak(lebar, 0.1, 1.1, mat(WARNA.meja, { r: 0.5 }), 0, 1.0, 0, grup);
  for (const s of [-1, 1]) kotak(0.08, 0.95, 1.0, WARNA.gelap, s * (lebar / 2 - 0.06), 0.48, 0, grup);
  // monitor
  kotak(1.0, 0.62, 0.06, 0x0a0f22, -0.2, 1.5, 0.15, grup); kotak(0.08, 0.35, 0.08, 0x0a0f22, -0.2, 1.15, 0.2, grup);
  const mLayar = mat(0x1a2547, { e: 0x0a1128, ei: 0.2 });
  kotak(0.92, 0.54, 0.01, mLayar, -0.2, 1.5, 0.11, grup, false);
  const cahayaLayar = new THREE.PointLight(WARNA.layar, 0, 3.2, 1.5); cahayaLayar.position.set(-0.2, 1.6, -0.4); grup.add(cahayaLayar);
  // lampu meja sodium
  const lx = 0.75, lz = 0.1;
  tabung(0.14, 0.16, 0.04, WARNA.krem, lx, 1.07, lz, grup);
  kotak(0.03, 0.6, 0.03, WARNA.krem, lx, 1.38, lz, grup).rotation.z = 0.3;
  const mTudung = mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.15 });
  tabung(0.08, 0.2, 0.22, mTudung, lx - 0.12, 1.68, lz - 0.1, grup).rotation.z = 0.5;
  const cahayaLampu = new THREE.PointLight(0xffa640, 0, 4.5, 1.4); cahayaLampu.position.set(lx - 0.2, 1.55, lz - 0.2); grup.add(cahayaLampu);
  kotak(0.45, 0.03, 0.3, WARNA.krem, 0.35, 1.07, -0.2, grup);
  tabung(0.07, 0.07, 0.16, WARNA.sodium, -0.85, 1.13, -0.25, grup);
  if (k.id === 'maintenance') { // kotak perkakas di samping meja
    kotak(0.6, 0.32, 0.34, 0xd9532b, lebar / 2 + 0.45, 0.16, 0.1, grup);
    kotak(0.3, 0.06, 0.06, WARNA.krem, lebar / 2 + 0.45, 0.38, 0.1, grup);
    kotak(0.04, 0.42, 0.04, 0xb0b8c8, -0.55, 1.08, 0.25, grup).rotation.z = 1.2;
  }
  if (k.id === 'logikaku') { // server web kecil dengan lampu "hidup" hijau
    const sx = -(lebar / 2 + 0.4);
    kotak(0.46, 0.95, 0.5, 0x0a0f22, sx, 0.48, 0.1, grup);
    const mLed = mat(0x6dff9a, { e: 0x6dff9a, ei: 1.2 });
    for (let i = 0; i < 3; i++) {
      kotak(0.36, 0.03, 0.01, 0x22305a, sx, 0.75 - i * 0.22, 0.36, grup, false);
      kotak(0.05, 0.05, 0.01, mLed, sx + 0.13, 0.8 - i * 0.22, 0.36, grup, false);
    }
  }
  // kursi
  kotak(0.7, 0.08, 0.7, WARNA.gelap2, 0, 0.55, -0.95, grup); kotak(0.7, 0.9, 0.08, WARNA.gelap2, 0, 1.05, -1.3, grup);
  tabung(0.05, 0.05, 0.5, WARNA.gelap2, 0, 0.27, -0.95, grup);
  // tempat sampah kecil di samping kursi; isinya bertambah pelan-pelan
  const sisiTong = x > 3 ? -1 : 1, bx = sisiTong * (besar ? 1.6 : 1.25), bz = -1.2;
  const tong = new THREE.Group(); tong.position.set(bx, 0, bz); grup.add(tong);
  tabung(0.19, 0.15, 0.42, mat(0x6a7699, { r: 0.6, m: 0.3 }), 0, 0.21, 0, tong);
  tabung(0.2, 0.2, 0.03, 0x3a4566, 0, 0.43, 0, tong);
  const kertas = [[-0.06, 0.05], [0.07, -0.04], [0, 0.07]].map(([dx, dz], i) => {
    const b = bola(0.085, 0xf2efe6, dx, 0.44 + i * 0.05, dz, tong); b.scale.set(1, 0.8, 1.1); b.visible = false; return b;
  });
  tempatSampah.push({ id: k.id, x: x + bx, z: z + bz, isi: Math.random() * 0.8, laju: 0.008 + Math.random() * 0.012, kertas, manajer: besar });
  // karakter berhoodie: satu grup "orang" yang bisa berdiri, berjalan, dan menoleh.
  // Titik asal orang = pusat badan di lantai; saat duduk ia berada di kursi.
  const mBaju = mat(baju, { r: 0.9 });
  const KURSI = new THREE.Vector3(0, 0, -0.85);
  const orang = new THREE.Group(); orang.position.copy(KURSI); grup.add(orang);
  tabung(0.32, 0.4, 0.9, mBaju, 0, 1.05, 0, orang);
  const kepala = new THREE.Group(); kepala.position.set(0, 1.76, 0); orang.add(kepala);
  bola(0.27, WARNA.kulit, 0, 0, 0, kepala);
  bola(0.31, mBaju, 0, 0.06, -0.07, kepala).scale.set(1, 0.9, 1);
  const lengan = [-1, 1].map((s) => {
    const poros = new THREE.Group(); poros.position.set(s * 0.3, 1.32, 0.1); orang.add(poros);
    const l = kotak(0.14, 0.14, 0.62, mBaju, 0, 0, 0.3, poros); l.castShadow = true;
    return poros;
  });
  const mCelana = mat(0x1b2440, { r: 0.9 });
  const kaki = [-1, 1].map((s) => {
    const poros = new THREE.Group(); poros.position.set(s * 0.14, 0.62, 0); orang.add(poros);
    kotak(0.16, 0.62, 0.18, mCelana, 0, -0.31, 0, poros);
    kotak(0.17, 0.08, 0.26, 0x0a0f22, 0, -0.58, 0.05, poros);
    poros.visible = false; // saat duduk kaki tersembunyi di bawah meja
    return poros;
  });
  // cangkir kopi di tangan kanan (ujung lengan)
  const cangkir = tabung(0.07, 0.06, 0.13, WARNA.krem, 0, 0.02, 0.62, lengan[1]);
  cangkir.visible = false;

  // papan nama dan status
  const nama = papan(2.1); nama.position.set(0, besar ? 3.7 : 3.4, 0.2); grup.add(nama);
  const status = papan(1.8); status.position.set(0, 2.6, 0.2); grup.add(status);
  const ikon = papan(1.0); ikon.position.set(0.9, 2.55, -0.8); grup.add(ikon);

  grup.traverse((o) => { if (o.isMesh) { o.userData.id = k.id; target.push(o); } });

  let sekarang = 'kosong';
  function setStatus(s) {
    sekarang = s;
    const aktif = s !== 'kosong';
    nama.tulis(k.nama.toUpperCase(), { bg: 'rgba(10,17,40,.85)', fg: aktif ? '#ffcf7a' : '#7f93c9', garis: aktif ? '#ffb347' : '#3a4f8a', bulat: 8 });
    const lb = LABEL[s];
    status.visible = !!lb;
    if (lb) status.tulis(lb.teks, { bg: lb.bg, fg: '#0a1128', ukuran: 64 });
    ikon.visible = s === 'kosong' || s === 'butuh-input' || s === 'selesai';
    if (s === 'kosong') ikon.tulis('z z', { fg: '#7f93c9', ukuran: 60 });
    if (s === 'butuh-input') ikon.tulis('?', { fg: '#ffb347', ukuran: 96 });
    if (s === 'selesai') ikon.tulis('✓', { fg: '#e8dcc0', ukuran: 80 });
    const warnaLayar = s === 'gagal' ? WARNA.merah : WARNA.layar;
    mLayar.color.set(s === 'kosong' ? 0x1a2547 : warnaLayar);
    mLayar.emissive.set(s === 'kosong' ? 0x0a1128 : warnaLayar);
    cahayaLayar.color.set(warnaLayar);
    for (const p of lengan) p.rotation.x = 0;
    if (!menganggur(s) && gerak.mode !== 'duduk') pulang(); // ada tugas: kembali ke meja
  }

  // ---- perilaku acak: animasi di meja, jalan-jalan, dan ambil kopi
  const dunia = (v) => ({ x: v.x + x, z: v.z + z }); // lokal grup -> dunia
  const gerak = { mode: 'duduk', rute: [], i: 0, tunggu: 2 + Math.random() * 8, aksi: null, tujuan: null, waktu: 0, minum: 0 };
  const kursiDunia = dunia(KURSI);
  function mulaiJalan(tujuan, aksi) {
    gerak.rute = rencanaRute(kursiDunia, tujuan, k.id === 'manajer' ? tata.ruangManajer?.pintu : null).map((p) => ({ x: p.x - x, z: p.z - z }));
    gerak.i = 1; gerak.mode = 'pergi'; gerak.aksi = aksi; gerak.tujuan = tujuan;
    for (const kk of kaki) kk.visible = true;
  }
  function pulang() {
    if (gerak.mode === 'duduk' || gerak.mode === 'pulang') return;
    // balik lewat titik-titik yang sudah dilewati
    const sudah = gerak.mode === 'pergi' ? gerak.rute.slice(0, gerak.i) : gerak.rute;
    gerak.rute = [{ x: orang.position.x, z: orang.position.z }, ...sudah.reverse()];
    gerak.i = 1; gerak.mode = 'pulang';
  }
  function pilihKegiatan() {
    const r = Math.random();
    if (menganggur(sekarang) && !KURANGI_GERAK && r < 0.45) {
      if (Math.random() < 0.5 && kopi.titik) mulaiJalan(kopi.titik, 'kopi');
      else {
        const t = tempatJalan[Math.floor(Math.random() * tempatJalan.length)];
        mulaiJalan({ x: t.x + (Math.random() - 0.5) * 0.6, z: t.z + (Math.random() - 0.5) * 0.4, arah: t.arah }, 'lihat');
      }
      return;
    }
    // animasi kecil di meja
    gerak.aksi = ['meregang', 'menoleh', 'menoleh', 'bersandar'][Math.floor(Math.random() * 4)];
    gerak.waktu = 0; gerak.mode = 'gaya';
  }
  function langkah(dt, t) {
    const tgt = gerak.rute[gerak.i];
    const dx = tgt.x - orang.position.x, dz = tgt.z - orang.position.z, jarak = Math.hypot(dx, dz);
    const maju = Math.min(jarak, dt * 1.6);
    if (jarak > 1e-3) {
      orang.position.x += (dx / jarak) * maju; orang.position.z += (dz / jarak) * maju;
      const hadap = Math.atan2(dx, dz);
      let beda = hadap - orang.rotation.y; beda = Math.atan2(Math.sin(beda), Math.cos(beda));
      orang.rotation.y += beda * Math.min(1, dt * 10);
    }
    // ayunan langkah
    const a = Math.sin(t * 9) * 0.5;
    kaki[0].rotation.x = a; kaki[1].rotation.x = -a;
    lengan[0].rotation.x = 1.25 - a * 0.6;
    lengan[1].rotation.x = cangkir.visible ? 0.6 : 1.25 + a * 0.6;
    orang.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
    if (jarak - maju < 1e-3) gerak.i++;
    return gerak.i >= gerak.rute.length;
  }
  function duduk() {
    gerak.mode = 'duduk'; gerak.tunggu = 6 + Math.random() * 14;
    orang.position.copy(KURSI); orang.rotation.y = 0;
    for (const kk of kaki) { kk.visible = false; kk.rotation.x = 0; }
    for (const p of lengan) p.rotation.x = 0;
    if (cangkir.visible) gerak.minum = 18; // menyeruput kopi di meja
  }
  function perilaku(dt, t) {
    kepala.rotation.y *= 1 - Math.min(1, dt * 3);
    if (gerak.mode === 'duduk') {
      if (gerak.minum > 0) {
        gerak.minum -= dt;
        const seruput = Math.max(0, Math.sin(t * 0.9)) ** 6; // sesekali mengangkat cangkir
        lengan[1].rotation.x = -0.2 - seruput * 0.9;
        if (gerak.minum <= 0) { cangkir.visible = false; lengan[1].rotation.x = 0; }
      }
      gerak.tunggu -= dt;
      if (gerak.tunggu <= 0) pilihKegiatan();
      return;
    }
    if (gerak.mode === 'gaya') {
      gerak.waktu += dt;
      const f = Math.sin(Math.min(1, gerak.waktu / 2.4) * Math.PI); // naik lalu turun
      if (gerak.aksi === 'meregang') { lengan[0].rotation.x = lengan[1].rotation.x = -2.6 * f; }
      if (gerak.aksi === 'menoleh') kepala.rotation.y = Math.sin(gerak.waktu * 2.6) * 0.9 * f;
      if (gerak.aksi === 'bersandar') { orang.rotation.x = -0.18 * f; orang.position.z = KURSI.z - 0.12 * f; }
      if (gerak.waktu >= 2.4) { orang.rotation.x = 0; duduk(); }
      return;
    }
    if (gerak.mode === 'pergi') {
      if (langkah(dt, t)) {
        gerak.mode = 'di-tujuan'; gerak.waktu = 0; gerak.lama = gerak.aksi === 'kopi' ? 3.6 : 4 + Math.random() * 5;
        kaki[0].rotation.x = kaki[1].rotation.x = 0; orang.position.y = 0;
        if (gerak.tujuan.arah !== undefined) orang.rotation.y = gerak.tujuan.arah;
        if (gerak.aksi === 'kopi') kopi.uap = 3;
      }
      return;
    }
    if (gerak.mode === 'di-tujuan') {
      gerak.waktu += dt;
      if (gerak.aksi === 'kopi') {
        lengan[1].rotation.x = 0.5; lengan[0].rotation.x = 0.2;
        if (gerak.waktu > 2.6) cangkir.visible = true;
      } else {
        for (const p of lengan) p.rotation.x = 0.1;
        kepala.rotation.y = Math.sin(gerak.waktu * 0.8) * 0.5;
      }
      if (gerak.waktu > gerak.lama) pulang();
      return;
    }
    if (gerak.mode === 'pulang' && langkah(dt, t)) duduk();
  }

  function animasi(t, dt = 0) {
    perilaku(dt, t);
    const s = sekarang;
    let lampu = 0, layar = 0;
    if (s === 'dikerjakan') {
      lampu = 9; layar = 3.2;
      if (gerak.mode === 'duduk') { lengan[0].rotation.x = Math.sin(t * 14) * 0.08; lengan[1].rotation.x = Math.sin(t * 14 + 1.7) * 0.08; }
    } else if (s === 'butuh-input') {
      lampu = Math.sin(t * 2.4) > 0 ? 8 : 1.5; layar = 1.5;
    } else if (s === 'gagal') {
      layar = Math.sin(t * 9) > -0.3 ? 2.6 : 0.4; lampu = 1;
    } else if (s === 'selesai') {
      lampu = 2.5; layar = 0.8;
    }
    cahayaLampu.intensity = lampu; cahayaLayar.intensity = layar;
    mTudung.emissiveIntensity = lampu > 0 ? 0.3 + lampu / 8 : 0.15;
    mLayar.emissiveIntensity = s === 'kosong' ? 0.2 : 0.4 + layar / 3;
    ikon.position.y = 2.55 + Math.sin(t * 1.6 + indeks) * 0.08;
    ikon.visible = gerak.mode !== 'pergi' && gerak.mode !== 'pulang' && gerak.mode !== 'di-tujuan'
      && (s === 'kosong' || s === 'butuh-input' || s === 'selesai');
  }

  setStatus('kosong');
  return { setStatus, animasi };
}

// ---------------------------------------------------------------- petugas kebersihan
/**
 * Cleaning service: mangkal di troli kebersihan, berkeliling menyapu dan
 * mengosongkan tempat sampah yang paling penuh, lalu melapor ke pintu ruang
 * manajer ("Boleh dibuang?") sebelum membuang kantong sampah ke tong besar.
 */
function bangunPetugas(k, pos, indeks) {
  const rumah = { x: pos.x, z: pos.z };
  const pintuManajer = tata.ruangManajer?.pintu || null;
  const titikLapor = pintuManajer ? { x: pintuManajer.x, z: pintuManajer.z + 0.65 } : null;

  // ---- troli kebersihan dan tong sampah besar di dekat dinding kiri
  const troli = new THREE.Group(); troli.position.set(pos.x - 0.85, 0, pos.z); scene.add(troli);
  kotak(0.6, 0.08, 1.1, 0x2a3242, 0, 0.25, 0, troli);
  kotak(0.6, 0.08, 1.1, 0x2a3242, 0, 0.85, 0, troli);
  for (const [dx, dz] of [[-0.27, -0.5], [0.27, -0.5], [-0.27, 0.5], [0.27, 0.5]]) {
    kotak(0.05, 0.9, 0.05, 0xb0b8c8, dx, 0.5, dz, troli);
    bola(0.07, 0x10141f, dx, 0.07, dz, troli);
  }
  tabung(0.22, 0.18, 0.36, 0xffd23a, 0, 0.47, -0.25, troli); // ember kuning
  tabung(0.2, 0.2, 0.02, 0x7fd6ff, 0, 0.64, -0.25, troli);
  kotak(0.3, 0.22, 0.25, 0x5ad1ff, -0.05, 1.0, 0.3, troli); // botol-botol pembersih
  tabung(0.06, 0.06, 0.28, 0xff8f6b, 0.12, 1.03, -0.2, troli);
  tabung(0.06, 0.06, 0.24, 0x6dff9a, -0.12, 1.01, -0.3, troli);
  const pelGagang = tabung(0.025, 0.025, 1.6, 0x8a5a3c, 0.2, 1.0, 0.4, troli); pelGagang.rotation.x = -0.15; // gagang pel
  kotak(0.35, 0.1, 0.14, 0xe8eef8, 0.2, 0.2, 0.52, troli);
  // papan kuning "lantai basah" yang muncul saat mengepel
  const papanBasah = new THREE.Group(); papanBasah.visible = false; scene.add(papanBasah);
  for (const s of [-1, 1]) { const m = kotak(0.32, 0.55, 0.02, 0xffd23a, 0, 0.27, s * 0.09, papanBasah); m.rotation.x = s * 0.3; }
  const tongBesar = new THREE.Group(); tongBesar.position.set(pos.x - 0.85, 0, pos.z - 1.05); scene.add(tongBesar);
  tabung(0.3, 0.26, 0.75, 0x3f7a5e, 0, 0.38, 0, tongBesar);
  tabung(0.32, 0.32, 0.05, 0x2f5e48, 0, 0.77, 0, tongBesar);
  const tumpukan = bola(0.24, 0x141820, 0, 0.82, 0, tongBesar); tumpukan.scale.set(1, 0.6, 1); tumpukan.visible = false;

  // ---- tubuh petugas: seragam toska, topi kuning, celemek
  const orang = new THREE.Group(); orang.position.set(rumah.x, 0, rumah.z); orang.rotation.y = -Math.PI / 2; scene.add(orang);
  const mBaju = mat(BAJU[k.id] || BAJU_LAIN[indeks % BAJU_LAIN.length], { r: 0.9 });
  tabung(0.3, 0.38, 0.9, mBaju, 0, 1.05, 0, orang);
  kotak(0.5, 0.6, 0.05, 0xe8dcc0, 0, 0.95, 0.3, orang).rotation.x = -0.12; // celemek
  const kepala = new THREE.Group(); kepala.position.set(0, 1.76, 0); orang.add(kepala);
  bola(0.27, WARNA.kulit, 0, 0, 0, kepala);
  tabung(0.29, 0.29, 0.14, 0xffd23a, 0, 0.17, 0, kepala); // topi
  kotak(0.36, 0.04, 0.24, 0xffd23a, 0, 0.11, 0.3, kepala); // lidah topi
  const lengan = [-1, 1].map((s) => {
    const poros = new THREE.Group(); poros.position.set(s * 0.32, 1.32, 0.05); orang.add(poros);
    kotak(0.14, 0.14, 0.6, mBaju, 0, 0, 0.29, poros);
    bola(0.08, WARNA.kulit, 0, 0, 0.6, poros);
    return poros;
  });
  const mCelana = mat(0x1b2440, { r: 0.9 });
  const kaki = [-1, 1].map((s) => {
    const poros = new THREE.Group(); poros.position.set(s * 0.14, 0.62, 0); orang.add(poros);
    kotak(0.16, 0.62, 0.18, mCelana, 0, -0.31, 0, poros);
    kotak(0.17, 0.08, 0.26, 0x0a0f22, 0, -0.58, 0.05, poros);
    return poros;
  });
  // sapu di tangan kanan, kantong sampah di tangan kiri
  const sapu = new THREE.Group(); sapu.position.set(0, 0, 0.62); lengan[1].add(sapu);
  const gagang = tabung(0.025, 0.025, 1.4, 0x8a5a3c, 0, -0.45, 0.08, sapu); gagang.rotation.x = 0.15;
  kotak(0.5, 0.1, 0.12, 0x2a3242, 0, -1.12, 0.18, sapu);
  kotak(0.52, 0.14, 0.1, 0xd9b26b, 0, -1.22, 0.2, sapu);
  const kantong = bola(0.2, 0x141820, 0, -0.22, 0.62, lengan[0]); kantong.scale.set(1, 1.2, 1); kantong.visible = false;

  // papan nama, status, dan gelembung ucapan ikut bergerak bersama petugas
  const nama = papan(2.1); nama.position.set(0, 3.4, 0); orang.add(nama);
  const status = papan(1.8); status.position.set(0, 2.6, 0); orang.add(status);
  const ucap = papan(2.0); ucap.position.set(0, 4.25, 0); ucap.visible = false; orang.add(ucap);

  orang.traverse((o) => { if (o.isMesh) { o.userData.id = k.id; target.push(o); } });
  troli.traverse((o) => { if (o.isMesh) { o.userData.id = k.id; target.push(o); } });

  let sekarang = 'kosong';
  function setStatus(s) {
    sekarang = s;
    const aktif = s !== 'kosong';
    nama.tulis(k.nama.toUpperCase(), { bg: 'rgba(10,17,40,.85)', fg: aktif ? '#ffcf7a' : '#7f93c9', garis: aktif ? '#ffb347' : '#3a4f8a', bulat: 8 });
    const lb = LABEL[s];
    status.visible = !!lb;
    if (lb) status.tulis(lb.teks, { bg: lb.bg, fg: '#0a1128', ukuran: 64 });
  }
  const bicara = (teks, bg = '#e8dcc0') => { ucap.visible = !!teks; if (teks) ucap.tulis(teks, { bg, fg: '#0a1128', ukuran: 54 }); };

  // ---- perilaku: diam -> jalan ke tong -> sapu -> angkat -> lapor -> pulang -> buang
  const g = { mode: 'diam', waktu: 0, lama: 3, rute: [], i: 1, lanjut: null, tong: null, arah: 0 };
  const jalan = (rute, lanjut, arah) => { g.rute = rute; g.i = 1; g.mode = 'jalan'; g.lanjut = lanjut; g.arah = arah; };
  const mulai = (mode, lama) => { g.mode = mode; g.waktu = 0; g.lama = lama; };
  function pilih() {
    const t = sampahTerpenuh(tempatSampah, 0.34);
    if (!t) { // tidak ada yang penuh: mengepel lantai di dekat troli
      mulai('pel', 5 + Math.random() * 4);
      papanBasah.position.set(rumah.x + 0.5, 0, rumah.z - 0.9); papanBasah.visible = true;
      return;
    }
    g.tong = t;
    const berdiri = { x: t.x, z: t.z - 0.7 };
    g.ruteTong = ruteLorong(rumah, berdiri, t.manajer ? pintuManajer : null);
    jalan(g.ruteTong, 'sapu', 0);
  }
  function langkah(dt, t) {
    const tgt = g.rute[g.i];
    const dx = tgt.x - orang.position.x, dz = tgt.z - orang.position.z, jarak = Math.hypot(dx, dz);
    const maju = Math.min(jarak, dt * 1.4);
    if (jarak > 1e-3) {
      orang.position.x += (dx / jarak) * maju; orang.position.z += (dz / jarak) * maju;
      let beda = Math.atan2(dx, dz) - orang.rotation.y; beda = Math.atan2(Math.sin(beda), Math.cos(beda));
      orang.rotation.y += beda * Math.min(1, dt * 10);
    }
    const a = Math.sin(t * 8) * 0.45;
    kaki[0].rotation.x = a; kaki[1].rotation.x = -a;
    lengan[0].rotation.x = kantong.visible ? 1.45 : 1.3 - a * 0.5;
    lengan[1].rotation.x = 1.0; sapu.rotation.x = 0.55; // sapu dibawa tegak
    orang.position.y = Math.abs(Math.sin(t * 8)) * 0.04;
    if (jarak - maju < 1e-3) g.i++;
    return g.i >= g.rute.length;
  }
  const berdiriTegak = () => {
    for (const kk of kaki) kk.rotation.x = 0;
    orang.position.y = 0; orang.rotation.x = 0; sapu.rotation.set(0, 0, 0);
  };
  function perilaku(dt, t) {
    for (const tg of tempatSampah) { // sampah bertambah pelan-pelan
      tg.isi = Math.min(1, tg.isi + tg.laju * dt);
      const n = Math.floor(tg.isi * 3.2);
      tg.kertas.forEach((b, i) => { b.visible = i < n; });
    }
    kepala.rotation.y *= 1 - Math.min(1, dt * 3);
    if (g.mode === 'jalan') {
      if (langkah(dt, t)) {
        berdiriTegak(); orang.rotation.y = g.arah;
        const l = g.lanjut;
        if (l === 'sapu') mulai('sapu', 3.2);
        else if (l === 'lapor') { mulai('lapor', 4.2); bicara('Boleh dibuang?'); }
        else if (l === 'buang') mulai('buang', 1.8);
        else mulai('diam', 4 + Math.random() * 6);
      }
      return;
    }
    g.waktu += dt;
    const f = g.waktu / g.lama;
    if (g.mode === 'diam') {
      // bersandar pada sapu sambil melihat sekeliling
      lengan[1].rotation.x = 0.6; sapu.rotation.x = 0.9; lengan[0].rotation.x = 0.1;
      kepala.rotation.y = Math.sin(g.waktu * 0.7) * 0.6;
      if (g.waktu > g.lama && !KURANGI_GERAK) pilih();
    } else if (g.mode === 'pel') {
      // mengepel: badan maju-mundur, lengan mendorong
      const ay = Math.sin(g.waktu * 5);
      lengan[0].rotation.x = lengan[1].rotation.x = 1.0 + ay * 0.35;
      sapu.rotation.x = 0.5; sapu.rotation.z = ay * 0.3;
      orang.rotation.x = 0.12 + ay * 0.05;
      if (g.waktu > g.lama) { berdiriTegak(); papanBasah.visible = false; mulai('diam', 3 + Math.random() * 4); }
    } else if (g.mode === 'sapu') {
      // menyapu di sekitar tempat sampah: sapu diayun ke kiri-kanan
      const ay = Math.sin(g.waktu * 7);
      lengan[1].rotation.x = 0.9 + Math.abs(ay) * 0.2; lengan[0].rotation.x = 1.0;
      sapu.rotation.x = 0.25; sapu.rotation.z = ay * 0.55;
      orang.rotation.x = 0.1; kepala.rotation.y = ay * 0.15;
      if (g.waktu > g.lama) { berdiriTegak(); mulai('angkat', 1.6); }
    } else if (g.mode === 'angkat') {
      // membungkuk, mengangkat kantong dari tempat sampah
      const turun = Math.sin(Math.min(1, f) * Math.PI);
      orang.rotation.x = 0.45 * turun; lengan[0].rotation.x = 1.2 + 0.4 * turun;
      if (f > 0.5 && !kantong.visible) { kantong.visible = true; g.tong.isi = 0; }
      if (g.waktu > g.lama) {
        berdiriTegak();
        // kembali lewat jalan yang sama, lalu ke pintu ruang manajer untuk konfirmasi
        const balik = [...g.ruteTong].reverse();
        if (titikLapor) jalan([...balik, ...ruteLorong(rumah, titikLapor).slice(1)], 'lapor', Math.PI);
        else jalan(balik, 'buang', -Math.PI / 2);
      }
    } else if (g.mode === 'lapor') {
      // menunjuk kantong ke arah manajer, menunggu jawaban
      lengan[0].rotation.x = 1.1; lengan[1].rotation.x = 0.8; sapu.rotation.x = 0.7;
      kepala.rotation.y = Math.sin(g.waktu * 1.5) * 0.15;
      if (g.waktu > 2.4 && ucap.visible && g.oke !== true) { g.oke = true; bicara('OK, buang ✓', '#6dff9a'); }
      if (g.waktu > g.lama) {
        g.oke = false; bicara(null);
        jalan([...ruteLorong(rumah, titikLapor)].reverse(), 'buang', -Math.PI / 2);
      }
    } else if (g.mode === 'buang') {
      // melempar kantong ke tong besar
      lengan[0].rotation.x = 1.2 + Math.sin(Math.min(1, f) * Math.PI) * 1.2;
      if (f > 0.55 && kantong.visible) { kantong.visible = false; tumpukan.visible = true; }
      if (g.waktu > g.lama) { berdiriTegak(); mulai('diam', 4 + Math.random() * 6); }
    }
  }

  function animasi(t, dt = 0) {
    perilaku(dt, t);
    const s = sekarang;
    // status ikut terlihat dari warna topi saat sedang bertugas
    status.position.y = 2.6 + (s === 'butuh-input' ? Math.sin(t * 2.4) * 0.05 : 0);
  }
  setStatus('kosong');
  mulai('diam', 2 + Math.random() * 3);
  return { setStatus, animasi };
}

// ---------------------------------------------------------------- kamera
let tata = { lebar: 14, dalam: 10 };
function ukurUlang() {
  const W = innerWidth, H = innerHeight, asp = W / H;
  renderer.setSize(W, H, false);
  const butuh = (tata.lebar + tata.dalam) * 0.72; // lebar diagonal ruangan
  const vs = Math.max(tata.dalam * 0.78, butuh / asp / 2.1);
  kamera.left = -vs * asp; kamera.right = vs * asp; kamera.top = vs; kamera.bottom = -vs;
  kamera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- data + UI
const keadaan = { data: null, tanggal: hariIniWIB(), jam: SEHARI, putar: false, meja: {}, dipilih: null };

function segarkan() {
  const { data, tanggal, jam } = keadaan;
  const st = statusPada(data.laporan, data.karyawan.map((k) => k.id), tanggal, jam);
  for (const [id, m] of Object.entries(keadaan.meja)) m.setStatus(st[id].status);
  isiRingkas(ringkasHari(data.laporan, tanggal, jam));
  $('jam').value = String(jam);
  $('label-jam').textContent = jam >= SEHARI && !keadaan.putar ? 'sepanjang hari' : `${formatJam(jam)} WIB`;
  if (keadaan.dipilih) bukaPanelUntuk(keadaan.dipilih);
}

function bukaPanelUntuk(id) {
  const k = keadaan.data.karyawan.find((x) => x.id === id);
  if (!k) return;
  keadaan.dipilih = id;
  bukaPanel(k, laporanPada(keadaan.data.laporan, keadaan.tanggal, keadaan.jam).filter((l) => l.agen === id));
}

async function muat() {
  const r = await fetch('data.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`data.json: HTTP ${r.status}`);
  return r.json();
}

function pasangData(data) {
  const lama = keadaan.data;
  keadaan.data = data;
  isiInfo(data);
  const hariIni = hariIniWIB();
  isiTanggal(daftarTanggal(data.laporan, hariIni), keadaan.tanggal, hariIni);
  if (lama && JSON.stringify(lama.karyawan) !== JSON.stringify(data.karyawan)) { location.reload(); return; }
  segarkan();
}

async function mulai() {
  let data;
  try {
    data = await muat();
  } catch (e) {
    tampilGalat(`Laporan tidak bisa dimuat (${e.message}). Coba muat ulang halaman.`);
    data = { dibuat: null, karyawan: [], laporan: [] };
  }
  const p = new URLSearchParams(location.search);
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.get('tanggal') || '')) keadaan.tanggal = p.get('tanggal');
  if (/^\d+$/.test(p.get('jam') || '')) keadaan.jam = Math.min(SEHARI, +p.get('jam'));

  tata = tataMeja(data.karyawan);
  const animasiRuangan = bangunRuangan(tata.lebar, tata.dalam);
  if (tata.ruangManajer) bangunRuangManajer(tata.ruangManajer, posisi0(tata, 'manajer'));
  const posisi = Object.fromEntries(tata.meja.map((m) => [m.id, m]));
  data.karyawan.forEach((k, i) => {
    if (k.id !== PETUGAS && k.id !== 'manajer') bangunArea(k, posisi[k.id].x, posisi[k.id].z, i);
    if (k.id !== PETUGAS) keadaan.meja[k.id] = bangunMeja(k, posisi[k.id].x, posisi[k.id].z, i);
  });
  // petugas kebersihan dibangun terakhir, setelah semua tempat sampah ada
  data.karyawan.forEach((k, i) => {
    if (k.id === PETUGAS) keadaan.meja[k.id] = bangunPetugas(k, posisi[k.id], i);
  });

  kamera.position.set(66, 57, 66); // jauh, supaya gedung di sekitar tidak terpotong bidang dekat kamera
  kontrol.target.set(0, 0.6, 0.4);
  kontrol.update();
  ukurUlang();
  pasangData(data);
  if (p.get('pilih')) bukaPanelUntuk(p.get('pilih'));

  // ---- interaksi
  $('tanggal').addEventListener('change', (e) => { keadaan.tanggal = e.target.value; keadaan.jam = SEHARI; keadaan.putar = false; $('putar').textContent = '▶'; segarkan(); });
  $('jam').addEventListener('input', (e) => { keadaan.putar = false; $('putar').textContent = '▶'; keadaan.jam = +e.target.value; segarkan(); });
  $('putar').addEventListener('click', () => {
    keadaan.putar = !keadaan.putar;
    if (keadaan.putar && keadaan.jam >= SEHARI) keadaan.jam = 0;
    $('putar').textContent = keadaan.putar ? '❚❚' : '▶';
    $('putar').setAttribute('aria-label', keadaan.putar ? 'Jeda timelapse' : 'Putar timelapse');
    segarkan();
  });
  $('tutup').addEventListener('click', () => { keadaan.dipilih = null; tutupPanel(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { keadaan.dipilih = null; tutupPanel(); } });

  const ray = new THREE.Raycaster(), titik = new THREE.Vector2();
  const kena = (e) => {
    const b = kanvas.getBoundingClientRect();
    titik.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(titik, kamera);
    return ray.intersectObjects(target, false)[0]?.object.userData.id;
  };
  let awal = null;
  kanvas.addEventListener('pointerdown', (e) => { awal = [e.clientX, e.clientY]; });
  kanvas.addEventListener('pointerup', (e) => {
    if (!awal || Math.hypot(e.clientX - awal[0], e.clientY - awal[1]) > 6) return;
    const id = kena(e);
    if (id) { bukaPanelUntuk(id); $('petunjuk').style.opacity = 0; }
  });
  kanvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') kanvas.style.cursor = kena(e) ? 'pointer' : 'grab'; });
  addEventListener('resize', ukurUlang);

  // ---- tombol putar 45 derajat (berguna di trackpad dan HP)
  let sisaPutar = 0;
  const putarKamera = (arah) => { sisaPutar += arah * Math.PI / 4; };
  $('putar-kiri').addEventListener('click', () => putarKamera(-1));
  $('putar-kanan').addEventListener('click', () => putarKamera(1));
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, select')) return;
    if (e.key === 'ArrowLeft') putarKamera(-1);
    if (e.key === 'ArrowRight') putarKamera(1);
  });
  const sumbuY = new THREE.Vector3(0, 1, 0);
  const langkahPutar = (dt) => {
    if (Math.abs(sisaPutar) < 1e-4) { sisaPutar = 0; return; }
    const sudut = Math.sign(sisaPutar) * Math.min(Math.abs(sisaPutar), dt * 3.2);
    sisaPutar -= sudut;
    kamera.position.sub(kontrol.target).applyAxisAngle(sumbuY, sudut).add(kontrol.target);
  };

  // ---- muat ulang data setiap 60 detik
  setInterval(async () => { try { pasangData(await muat()); } catch { /* coba lagi nanti */ } }, 60000);

  // ---- putaran animasi
  const jam = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(jam.getDelta(), 0.1), t = jam.elapsedTime;
    if (keadaan.putar) {
      const lama = keadaan.jam;
      keadaan.jam = Math.min(SEHARI, keadaan.jam + (SEHARI / DURASI_TIMELAPSE) * dt);
      if (keadaan.jam >= SEHARI) { keadaan.putar = false; $('putar').textContent = '▶'; }
      if (Math.floor(lama / 60) !== Math.floor(keadaan.jam / 60) || !keadaan.putar) segarkan();
    }
    langkahPutar(dt);
    animasiRuangan(dt);
    for (const m of Object.values(keadaan.meja)) m.animasi(t, dt);
    kontrol.update();
    renderer.render(scene, kamera);
  });
  document.body.dataset.siap = '1';
}

mulai();
