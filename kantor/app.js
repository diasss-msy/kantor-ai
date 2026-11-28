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
let grupDinding = null; // dinding luar (belakang, kiri, depan, kanan) untuk menempel hiasan dinding
const dindingDalam = []; // fungsi pemotong tembok dalam, dipanggil tiap frame
// Tempat sampah di samping setiap meja; dikosongkan petugas kebersihan.
const tempatSampah = [];

// Acak dengan benih tetap, supaya tata letak dan hujan di kaca selalu sama.
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
function bangunRuangan(lebar, dalam) {
  const RX = lebar / 2, RZ = dalam / 2;
  scene.add(new THREE.HemisphereLight(0x6f8fe8, 0x1b2a4e, 1.1));
  const bulan = new THREE.DirectionalLight(0x7fa0ff, 0.55);
  bulan.position.set(-10, 14, -8); bulan.castShadow = true;
  Object.assign(bulan.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36 });
  bulan.shadow.mapSize.set(2048, 2048); scene.add(bulan);
  const isi = new THREE.DirectionalLight(0x8fa8ff, 0.6); isi.position.set(14, 10, 14); scene.add(isi);
  const tepi = new THREE.DirectionalLight(0xb8c8ff, 0.9); tepi.position.set(-4, 8, -14); scene.add(tepi);

  // lempeng melayang (diorama tanpa kota di sekitarnya)
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
  grupDinding = { dBelakang, dKiri, dDepan, dKanan };
  scene.add(dBelakang, dKiri, dDepan, dKanan, ...Object.values(pendek));
  const LW = lebar + 0.6, TP = 0.55; // lebar dinding depan/belakang (menutup sudut), tinggi tembok pendek
  // dinding belakang dan depan berlubang jendela (kaca tembus pandang ke langit malam)
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

  // ---- dinding kanan: ruang lift (menjorok ke dalam), papan tulis, jam dinding
  const pz = 3.6; // tengah ruang lift (sumbu z)
  const mBaja = mat(0xb8c2d8, { r: 0.25, m: 0.85 }), mBajaGelap = mat(0x6a7699, { r: 0.3, m: 0.8 });
  const mInti = mat(0x323a6a, { r: 0.85 }), mEmas = mat(0xffcf7a, { r: 0.4, m: 0.6 });
  const HL = 4.6, LX0 = RX - 2.7, LX1 = RX - 2.1; // tinggi inti lift, muka depan inti, dan muka pintu (ceruk 0,6)
  for (const s of [-1, 1]) {
    kotak(RX - LX0, HL, 0.5, mInti, (LX0 + RX) / 2, HL / 2, pz + s * 1.35); // dinding samping inti lift
    kotak(LX1 - LX0, 2.9, 0.04, mBajaGelap, (LX0 + LX1) / 2, 1.45, pz + s * 1.08, scene, false); // pelapis baja ceruk
  }
  kotak(RX - LX1, HL, 2.2, mInti, (LX1 + RX) / 2, HL / 2, pz); // ruang luncur di balik pintu
  kotak(LX1 - LX0, HL - 2.9, 2.2, mInti, (LX0 + LX1) / 2, (HL + 2.9) / 2, pz); // ambang atas ceruk
  kotak(RX - LX0 + 0.04, 0.1, 3.24, mEmas, (LX0 + RX) / 2, HL + 0.05, pz, scene, false); // list emas di atas inti
  for (const s of [-1, 1]) kotak(0.06, 2.75, 1.04, mBaja, LX1 - 0.04, 1.4, pz + s * 0.53); // dua daun pintu baja
  kotak(0.07, 2.75, 0.03, 0x2a3242, LX1 - 0.07, 1.4, pz, scene, false); // celah tengah pintu
  kotak(0.08, 0.1, 2.2, mBajaGelap, LX1 - 0.04, 2.83, pz, scene, false); // kusen atas pintu
  kotak(LX1 - LX0, 0.03, 2.2, mBajaGelap, (LX0 + LX1) / 2, 0.02, pz, scene, false); // ambang lantai ceruk
  // panel tombol panggil di muka inti, di samping ceruk
  kotak(0.05, 0.5, 0.24, 0x2a3242, LX0 - 0.03, 1.25, pz - 1.35);
  const mTombol = mat(0xffcf7a, { e: 0xffb347, ei: 1.2 });
  for (const dy of [0.1, -0.1]) bola(0.045, mTombol, LX0 - 0.07, 1.25 + dy, pz - 1.35);
  // penunjuk lantai di atas ceruk
  const lantaiTx = teksturKanvas(256, 96, (g, w, h) => {
    g.fillStyle = '#0a0f22'; g.fillRect(0, 0, w, h);
    g.shadowColor = '#ffb347'; g.shadowBlur = 14; g.fillStyle = '#ffcf7a';
    g.font = `800 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('▲ 24', w / 2, h / 2 + 2);
  });
  const tLift = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.38), new THREE.MeshBasicMaterial({ map: lantaiTx }));
  tLift.rotation.y = -Math.PI / 2; tLift.position.set(LX0 - 0.02, 3.4, pz); scene.add(tLift);
  papanNama('LIFT', 1.4, LX0 - 0.02, 4.0, pz, -Math.PI / 2);
  const lampuLift = new THREE.PointLight(0xffd9a0, 1.6, 4, 2); lampuLift.position.set(LX0 + 0.2, 2.6, pz); scene.add(lampuLift);
  kotak(1.0, 0.02, 2.6, 0x3a4566, LX0 - 0.5, 0.02, pz, scene, false); // lantai pendaratan lift
  kotak(0.06, 0.025, 2.6, 0xffcf7a, LX0 - 1.0, 0.03, pz, scene, false);

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

  // ---- ruang santai di depan (bertukar tempat dengan area departemen): karpet, sofa L, TV, bean bag
  const lx0 = 11, lz0 = 6;
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
  for (const [tx, tz, s] of [[RX - 0.6, -1.5, 1], [RX - 0.6, 18.2, 1.0], [-1, RZ - 0.7, 1], [-RX + 0.6, 11, 1.1], [1.5, -RZ + 1.2, 0.9], [RX - 9, -RZ + 1.2, 1]]) {
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

  // ---- dispenser air di samping pantry
  const dx0 = -7.3, dz0 = 21.5;
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
  kopi.titik = { x: RX - 1.3, z: kz - 0.3, arah: Math.PI / 2 };

  // tempat yang didatangi pegawai yang sedang jalan-jalan (arah = hadap tubuh, radian)
  tempatJalan = [
    { x: 2.2, z: RZ - 0.8, arah: 0 }, // jendela depan
    { x: 1.0, z: -13.3, arah: -Math.PI / 2 }, // menengok ke pintu ruang manajer
    { x: 15.5, z: 8.4, arah: Math.PI }, // menonton TV di ruang santai
    { x: -7.0, z: 20.7, arah: 0 }, // dispenser di samping pantry
    { x: RX - 2.6, z: 7.8, arah: Math.PI / 2 }, // ke toilet pria
    { x: RX - 2.6, z: 13, arah: Math.PI / 2 }, // ke toilet wanita
    { x: 12.4, z: -1.8, arah: Math.PI }, // mengambil berkas di ruang arsip
    { x: LORONG_X, z: 1.6, arah: Math.PI / 2 }, // papan tulis dari jauh
    { x: -13, z: 14.8, arah: 0 }, // ngemil di meja bar pantry
    { x: -23.4, z: 23.2, arah: -Math.PI / 2 }, // memilih buku di perpustakaan
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

  return (dt) => {
    const cz = kamera.position.z > kontrol.target.z, cx = kamera.position.x > kontrol.target.x;
    dBelakang.visible = cz; pendek.belakang.visible = !cz;
    dDepan.visible = !cz; pendek.depan.visible = cz;
    dKiri.visible = cx; pendek.kiri.visible = !cx;
    dKanan.visible = !cx; pendek.kanan.visible = cx;
    gambarJam();
    for (const f of dindingDalam) f();
    for (const m of hujanKaca) { m.position.y -= dt * 1.2; if (m.position.y < 1.7) m.position.y += 2.6; }
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

const WARNA_BUKU = [0xff8f6b, 0x5ad1ff, 0xffcf7a, 0xc9b9e8, 0x7fd1b9, 0xd98fb0, 0xe8eef8];
/**
 * Rak buku penuh. sepanjangZ: rak berdiri sepanjang sumbu z (buku menghadap +x
 * kalau muka = 1, -x kalau -1); selain itu sepanjang sumbu x (buku menghadap +z/-z).
 */
function rakBuku(cx, cz, panjang, sepanjangZ, muka, tingkatan = 4, warnaRak = 0x5a3a2a) {
  const w = sepanjangZ ? 0.5 : panjang, d = sepanjangZ ? panjang : 0.5, H = 0.35 + tingkatan * 0.6;
  kotak(w, H, d, mat(warnaRak, { r: 0.8 }), cx, H / 2, cz);
  for (let tingkat = 0; tingkat < tingkatan; tingkat++) {
    const y = 0.25 + tingkat * 0.6;
    let u = -panjang / 2 + 0.1, j = 0;
    while (u < panjang / 2 - 0.15) {
      const lb = 0.1 + ((j * 7 + tingkat * 3) % 5) * 0.03, h = 0.34 + ((j * 5 + tingkat) % 4) * 0.04;
      if ((j + tingkat) % 9 !== 4) {
        const warna = WARNA_BUKU[(j * 3 + tingkat) % WARNA_BUKU.length];
        if (sepanjangZ) kotak(0.05, h, lb, warna, cx + muka * 0.27, y + h / 2, cz + u + lb / 2, scene, false);
        else kotak(lb, h, 0.05, warna, cx + u + lb / 2, y + h / 2, cz + muka * 0.27, scene, false);
      }
      u += lb + 0.02; j++;
    }
  }
}

/**
 * Pasangan grup {penuh, pendek} yang ikut dipotong seperti tembok di bidang
 * sumbu = nilai: versi pendek tampil saat kamera ada di sisi luar (arah tanda).
 */
function grupPotong(sumbu, nilai, tanda) {
  const penuh = new THREE.Group(), pendek = new THREE.Group(); scene.add(penuh, pendek);
  dindingDalam.push(() => {
    const c = sumbu === 'x' ? kamera.position.x : kamera.position.z;
    const p = (c - nilai) * tanda > 0; penuh.visible = !p; pendek.visible = p;
  });
  return { penuh, pendek };
}

/**
 * Ruangan bertembok: setiap bentang [ax, az, bx, bz, tanda?] (sejajar sumbu)
 * dibangun dua versi, penuh dan pendek. Setiap tembok dipotong pendek sendiri-sendiri
 * saat kamera ada di sisi luarnya (sisi yang menjauhi pusat ruangan, atau arah tanda),
 * sama seperti dinding luar gedung, jadi isi ruangan selalu terlihat.
 */
function ruangBertembok(bentang, pusat, T = 3.2, TP = 0.9, warna = 0x2b3360) {
  const mTembok = mat(warna, { r: 0.9 }), mList = mat(0xffcf7a, { r: 0.5 });
  for (const [ax, az, bx, bz, tanda] of bentang) {
    const panjang = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, sepanjangX = az === bz;
    const sumbu = sepanjangX ? 'z' : 'x', nilai = sepanjangX ? az : ax;
    const g = grupPotong(sumbu, nilai, tanda ?? Math.sign(nilai - (sepanjangX ? pusat.z : pusat.x)));
    const w = sepanjangX ? panjang : 0.2, d = sepanjangX ? 0.2 : panjang;
    for (const [grup, h] of [[g.penuh, T], [g.pendek, TP]]) {
      kotak(w, h, d, mTembok, cx, h / 2, cz, grup);
      kotak(w + (sepanjangX ? 0 : 0.04), 0.08, d + (sepanjangX ? 0.04 : 0), mList, cx, h + 0.04, cz, grup, false);
    }
  }
  return { mTembok, T, TP };
}

/** Lukisan abstrak berbingkai, menghadap arah rotY. */
function lukisan(benih, w, h, x, y, z, rotY, induk = scene) {
  const r = acak(benih);
  const tx = teksturKanvas(256, 192, (c, cw, ch) => {
    const latar = ['#1b2a4e', '#3b2a3a', '#14303a'][benih % 3];
    c.fillStyle = latar; c.fillRect(0, 0, cw, ch);
    const warna = ['#ffcf7a', '#ff8f6b', '#5ad1ff', '#c9b9e8', '#7fd1b9', '#d98fb0'];
    for (let i = 0; i < 7; i++) {
      c.fillStyle = warna[Math.floor(r() * warna.length)]; c.globalAlpha = 0.55 + r() * 0.4;
      if (r() < 0.5) { c.beginPath(); c.arc(r() * cw, r() * ch, 12 + r() * 50, 0, Math.PI * 2); c.fill(); }
      else c.fillRect(r() * cw, r() * ch, 20 + r() * 110, 8 + r() * 40);
    }
    c.globalAlpha = 1;
  });
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; induk.add(g);
  kotak(w + 0.16, h + 0.16, 0.06, 0xb08a3c, 0, 0, 0, g, false);
  const kanvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 }));
  kanvas.position.z = 0.04; g.add(kanvas);
  return g;
}

/** Tanaman besar dalam pot. */
function tanamanBesar(x, z, s = 1, warnaPot = 0xd9532b) {
  tabung(0.35 * s, 0.28 * s, 0.6 * s, warnaPot, x, 0.3 * s, z);
  bola(0.55 * s, 0x4f8a6b, x, 1.05 * s, z); bola(0.38 * s, 0x3f7a5e, x + 0.2 * s, 1.5 * s, z - 0.1 * s);
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

/**
 * Ruang rapat kaca yang menempel di depan ruang manajer, pantry kaca di kiri
 * depan, dan perpustakaan di pojok kiri depan yang menempel ke dinding.
 */
function bangunFasilitas(RX, RZ) {
  // ---- ruang rapat: dinding belakangnya = dinding depan ruang manajer
  const r0 = { x0: -RX, x1: -4, z0: 0, z1: 9 }; // menempel ke tembok ruang manajer dan dinding kiri gedung
  kotak(r0.x1 - r0.x0 - 0.1, 0.03, r0.z1 - r0.z0 - 0.1, mat(0x24304f, { r: 0.8 }), (r0.x0 + r0.x1) / 2, 0.02, (r0.z0 + r0.z1) / 2, scene, false).receiveShadow = true;
  dindingKaca(r0.x0, r0.z1, r0.x1, r0.z1);
  dindingKaca(r0.x1, r0.z0 + 0.15, r0.x1, r0.z1 - 1.6); // celah pintu di ujung depan dinding kanan
  papanNama('RUANG RAPAT', 3.2, (r0.x0 + r0.x1) / 2, 3.05, r0.z1);
  const mx = (r0.x0 + r0.x1) / 2 + 1.2, mz = (r0.z0 + r0.z1) / 2 + 0.3;
  kotak(8.4, 0.1, 2.2, mat(WARNA.meja, { r: 0.4 }), mx, 0.8, mz);
  for (const dx of [-3.2, 3.2]) kotak(0.2, 0.75, 1.6, WARNA.gelap, mx + dx, 0.38, mz);
  const mKursi = mat(0x3a4f8a, { r: 0.9 });
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    const kx = mx - 3.4 + i * 1.7, kz = mz + s * 1.55;
    kotak(0.6, 0.08, 0.6, mKursi, kx, 0.5, kz); kotak(0.6, 0.7, 0.08, mKursi, kx, 0.85, kz + s * 0.28);
    tabung(0.04, 0.04, 0.45, WARNA.gelap2, kx, 0.25, kz);
  }
  for (const dx of [-2.5, -0.4, 1.8]) kotak(0.4, 0.02, 0.3, WARNA.krem, mx + dx, 0.86, mz - 0.3).rotation.y = dx;
  // layar presentasi di dinding kiri gedung
  kotak(0.1, 1.9, 3.6, 0x0a0f22, r0.x0 + 0.1, 2.0, mz, grupDinding.dKiri);
  kotak(0.02, 1.7, 3.4, mat(0x8fb3ff, { e: 0x3a7fd6, ei: 0.7 }), r0.x0 + 0.16, 2.0, mz, grupDinding.dKiri, false);
  tabung(0.3, 0.24, 0.55, 0xd9532b, r0.x1 - 0.5, 0.28, r0.z0 + 0.6);
  bola(0.45, 0x4f8a6b, r0.x1 - 0.5, 0.95, r0.z0 + 0.6);
  const lampuRapat = new THREE.PointLight(0xffd9a0, 2.2, 9, 1.6); lampuRapat.position.set(mx, 2.6, mz); scene.add(lampuRapat);

  // ---- pantry terbuka (bekas tempat ruang rapat)
  const p0 = { x0: -19, x1: -8, z0: 14, z1: 22 };
  kotak(p0.x1 - p0.x0 - 0.1, 0.03, p0.z1 - p0.z0 - 0.1, mat(0x2e2a44, { r: 0.6 }), (p0.x0 + p0.x1) / 2, 0.02, (p0.z0 + p0.z1) / 2, scene, false).receiveShadow = true;
  for (let x = p0.x0 + 0.5; x < p0.x1; x += 1) for (let z = p0.z0 + 0.5; z < p0.z1; z += 1) {
    if ((Math.round(x - 0.5) + Math.round(z - 0.5)) % 2) kotak(0.98, 0.005, 0.98, 0x3a3554, x, 0.04, z, scene, false); // ubin catur
  }
  // pantry terbuka tanpa dinding; papan nama digantung di atas meja bar
  papanNama('PANTRY', 2.4, (p0.x0 + p0.x1) / 2, 3.0, 16.6);
  for (const s of [-1, 1]) tabung(0.012, 0.012, 1.4, WARNA.krem, (p0.x0 + p0.x1) / 2 + s * 1.0, 3.95, 16.6);
  const px = (p0.x0 + p0.x1) / 2, pz = 16.6;
  kotak(7, 0.95, 0.9, WARNA.gelap, px, 0.48, pz);
  kotak(7.2, 0.08, 1.1, mat(0xe8eef8, { r: 0.3 }), px, 1.0, pz);
  for (let i = 0; i < 5; i++) {
    const sx = px - 2.8 + i * 1.4;
    tabung(0.25, 0.25, 0.08, mat(0xff8f6b, { r: 0.8 }), sx, 0.75, pz - 0.8);
    tabung(0.04, 0.04, 0.7, WARNA.gelap2, sx, 0.37, pz - 0.8);
  }
  for (const [dx, w] of [[-2, 0xffcf7a], [0.6, 0x5ad1ff], [2.4, 0xff5d6c]]) tabung(0.07, 0.06, 0.13, w, px + dx, 1.11, pz);
  const bz = p0.z1 - 0.6;
  kotak(7.4, 0.95, 0.7, WARNA.krem, px - 1, 0.48, bz);
  kotak(7.5, 0.06, 0.8, 0x8a5a3c, px - 1, 0.98, bz);
  kotak(0.7, 0.04, 0.45, 0xb0b8c8, px - 3, 1.02, bz); // bak cuci
  kotak(0.9, 0.5, 0.5, 0x2a3242, px + 0.6, 1.26, bz); // microwave
  kotak(0.5, 0.3, 0.02, mat(0x6dff9a, { e: 0x6dff9a, ei: 0.3 }), px + 0.55, 1.28, bz - 0.26, scene, false);
  kotak(1.6, 0.4, 0.4, 0x5b3f7a, px - 2, 1.2, bz); // rak roti dan kopi
  kotak(1.2, 2.2, 0.9, 0xd8dde8, p0.x1 - 1.0, 1.1, bz - 0.1); // kulkas
  kotak(0.05, 0.7, 0.05, 0x8a96c0, p0.x1 - 1.5, 1.4, bz - 0.57);
  for (const dx of [-2, 0, 2]) {
    tabung(0.015, 0.015, 1.0, WARNA.krem, px + dx, 2.6, pz);
    tabung(0.1, 0.3, 0.25, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.8 }), px + dx, 2.0, pz);
  }
  const lampuPantry = new THREE.PointLight(0xffa640, 2.4, 8, 1.6); lampuPantry.position.set(px, 2.3, pz); scene.add(lampuPantry);

  // ---- perpustakaan di pojok kiri depan: rak buku menempel dinding kiri dan depan
  rakBuku(-RX + 0.3, 18.5, 11, true, 1);
  rakBuku(-RX + 3.1, RZ - 0.3, 5, false, -1);
  papanNama('PERPUSTAKAAN', 3, -RX + 0.58, 2.95, 18.5, Math.PI / 2);
  kotak(4.6, 0.02, 9, 0x3a2a4a, -RX + 3.2, 0.025, 17.5, scene, false).receiveShadow = true;
  const mKursiBaca = mat(0xb6c46a, { r: 0.95 });
  for (const kz of [15.2, 19.6]) {
    const g = new THREE.Group(); g.position.set(-RX + 3.6, 0, kz); g.rotation.y = -Math.PI / 2; scene.add(g); // menghadap rak
    kotak(1.1, 0.45, 1.0, mKursiBaca, 0, 0.3, 0, g); kotak(1.1, 0.8, 0.25, mKursiBaca, 0, 0.75, -0.4, g);
    for (const s of [-1, 1]) kotak(0.2, 0.6, 1.0, mKursiBaca, s * 0.55, 0.45, 0, g);
  }
  kotak(0.8, 0.5, 0.8, WARNA.meja, -RX + 3.6, 0.25, 17.4);
  kotak(0.35, 0.06, 0.25, 0x5ad1ff, -RX + 3.6, 0.53, 17.4);
  tabung(0.02, 0.02, 1.6, WARNA.krem, -RX + 4.6, 0.8, 17.4);
  tabung(0.12, 0.25, 0.25, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.8 }), -RX + 4.6, 1.65, 17.4);
  const lampuBaca = new THREE.PointLight(0xffa640, 2, 7, 1.6); lampuBaca.position.set(-RX + 3, 2.2, 18); scene.add(lampuBaca);

  // ---- ruang kebersihan di pojok kanan depan: tembok, pintu, rak perlengkapan, bak cuci
  const k0 = { x0: RX - 3.2, x1: RX, z0: RZ - 6, z1: RZ }, kp = RZ - 3; // kp = tengah pintu (sumbu z)
  kotak(k0.x1 - k0.x0 - 0.1, 0.03, k0.z1 - k0.z0 - 0.1, mat(0x2f4a52, { r: 0.6 }), (k0.x0 + k0.x1) / 2, 0.02, (k0.z0 + k0.z1) / 2, scene, false).receiveShadow = true;
  const rk = ruangBertembok([
    [k0.x0, k0.z0, k0.x0, kp - 0.7], [k0.x0, kp + 0.7, k0.x0, k0.z1], [k0.x0, k0.z0, k0.x1, k0.z0],
  ], { x: (k0.x0 + k0.x1) / 2, z: (k0.z0 + k0.z1) / 2 }, 3.2, 0.9, 0x2f5e5a);
  Object.assign(rk, grupPotong('x', k0.x0, -1)); // pintu ikut tembok kiri ruangan
  kotak(0.24, 0.7, 1.5, rk.mTembok, k0.x0, 2.85, kp, rk.penuh); // ambang atas pintu
  const daunK = new THREE.Group(); daunK.position.set(k0.x0, 0, kp - 0.7); daunK.rotation.y = -(Math.PI - 0.15); rk.penuh.add(daunK);
  kotak(0.06, 2.4, 1.36, 0x8a5a3c, 0, 1.2, 0.68, daunK); // daun pintu terbuka ke luar, terlipat rapat ke tembok
  for (const [grup, y] of [[rk.penuh, 2.85], [rk.pendek, 1.45]]) {
    const pl = papanNama('KEBERSIHAN', 1.6, k0.x0 - 0.13, y, kp, -Math.PI / 2, '#7fd1b9'); scene.remove(pl); grup.add(pl);
  }
  // rak perlengkapan di dinding depan: botol pembersih, kain lap, tisu
  kotak(2.6, 2.0, 0.45, WARNA.gelap, (k0.x0 + k0.x1) / 2 + 0.2, 1.0, k0.z1 - 0.3);
  for (let t = 0; t < 3; t++) for (let i = 0; i < 6; i++) {
    const warna = [0x5ad1ff, 0xff8f6b, 0x6dff9a, 0xffd23a, 0xe8eef8][(i + t) % 5];
    tabung(0.08, 0.08, 0.28, warna, k0.x0 + 0.65 + i * 0.4, 0.4 + t * 0.62, k0.z1 - 0.5);
  }
  // bak cuci pel dan ember di dinding kanan
  kotak(0.7, 0.6, 1.1, 0xd8dde8, k0.x1 - 0.4, 0.3, k0.z0 + 1.0);
  kotak(0.5, 0.05, 0.9, 0x8a96c0, k0.x1 - 0.4, 0.61, k0.z0 + 1.0);
  tabung(0.03, 0.03, 0.35, 0xb0b8c8, k0.x1 - 0.2, 0.85, k0.z0 + 1.0);
  for (const dz of [2.0, 2.5]) tabung(0.2, 0.17, 0.35, 0xffd23a, k0.x1 - 0.35, 0.18, k0.z0 + dz);
  // gantungan seragam dan sapu cadangan
  kotak(0.06, 0.06, 1.2, 0xb0b8c8, k0.x1 - 0.15, 2.0, k0.z0 + 3.1);
  for (const dz of [-0.35, 0.05, 0.4]) kotak(0.1, 0.8, 0.45, 0x3fa69a, k0.x1 - 0.2, 1.55, k0.z0 + 3.1 + dz);
  for (const dz of [0.0, 0.25]) { const sp = tabung(0.02, 0.02, 1.6, 0x8a5a3c, k0.x0 + 0.35, 0.8, k0.z0 + 0.4 + dz); sp.rotation.z = 0.12; }
  const lampuK = new THREE.PointLight(0xbff0ff, 1.6, 6, 1.6); lampuK.position.set((k0.x0 + k0.x1) / 2, 2.6, (k0.z0 + k0.z1) / 2); scene.add(lampuK);

  // ---- toilet pria dan wanita di dinding kanan, di antara ruang lift dan ruang kebersihan
  const t0 = { x0: RX - 3.2, x1: RX, z0: 6.5, z1: 17 }, tm = (t0.z0 + t0.z1) / 2;
  const pintuT = [{ z: 7.8, nama: 'TOILET PRIA', warna: '#5ad1ff' }, { z: 13, nama: 'TOILET WANITA', warna: '#ff8fb0' }];
  kotak(t0.x1 - t0.x0 - 0.1, 0.03, t0.z1 - t0.z0 - 0.1, mat(0xc8d2e6, { r: 0.4 }), (t0.x0 + t0.x1) / 2, 0.02, tm, scene, false).receiveShadow = true;
  for (let x = t0.x0 + 0.5; x < t0.x1; x += 0.8) kotak(0.02, 0.006, t0.z1 - t0.z0 - 0.2, 0x9aa6c0, x, 0.04, tm, scene, false); // nat ubin
  for (let z = t0.z0 + 0.5; z < t0.z1; z += 0.8) kotak(t0.x1 - t0.x0 - 0.2, 0.006, 0.02, 0x9aa6c0, (t0.x0 + t0.x1) / 2, 0.04, z, scene, false);
  ruangBertembok([
    [t0.x0, t0.z0, t0.x1, t0.z0], [t0.x0, t0.z1, t0.x1, t0.z1], [t0.x0, tm, t0.x1, tm, 1],
    [t0.x0, t0.z0, t0.x0, pintuT[0].z - 0.6], [t0.x0, pintuT[0].z + 0.6, t0.x0, pintuT[1].z - 0.6], [t0.x0, pintuT[1].z + 0.6, t0.x0, t0.z1],
  ], { x: (t0.x0 + t0.x1) / 2, z: tm }, 3.2, 0.9, 0x3a5f8a);
  const gt = grupPotong('x', t0.x0, -1);
  for (const pt of pintuT) for (const [grup, y] of [[gt.penuh, 2.85], [gt.pendek, 1.45]]) {
    const pl = papanNama(pt.nama, 1.7, t0.x0 - 0.13, y, pt.z, -Math.PI / 2, pt.warna); scene.remove(pl); grup.add(pl);
  }
  const mPorselen = mat(0xf2f5fb, { r: 0.25 }), mKrom = mat(0xd8dde8, { r: 0.2, m: 0.9 });
  const mCermin = mat(0xbfe6ff, { e: 0x7fb7ff, ei: 0.35, r: 0.05, m: 0.6 });
  /** Kloset duduk menghadap -x dengan tangki di dinding kanan. */
  function kloset(x, z) {
    kotak(0.3, 0.5, 0.6, mPorselen, x + 0.3, 0.75, z); // tangki
    tabung(0.2, 0.16, 0.4, mPorselen, x - 0.1, 0.2, z);
    tabung(0.24, 0.24, 0.06, mPorselen, x - 0.12, 0.42, z);
  }
  /** Bilik toilet: sekat di sisi -z dan +z, pintu terbuka sedikit di sisi -x. */
  function bilik(za, zb) {
    const mSekat = mat(0x5a7fb0, { r: 0.6 });
    for (const zz of [za, zb]) kotak(1.6, 2.0, 0.05, mSekat, t0.x1 - 0.85, 1.15, zz);
    const daun = new THREE.Group(); daun.position.set(t0.x1 - 1.65, 0, za); daun.rotation.y = -0.5; scene.add(daun);
    kotak(0.05, 1.9, zb - za - 0.05, mSekat, 0, 1.1, (zb - za) / 2, daun);
    kloset(t0.x1 - 0.55, (za + zb) / 2);
    tabung(0.07, 0.07, 0.12, 0xe8eef8, t0.x1 - 0.1, 1.0, (za + zb) / 2 - 0.45).rotation.z = Math.PI / 2; // tisu
  }
  /** Meja wastafel menempel tembok sejajar sumbu x di z = zw (tanda: arah muka). */
  function wastafel(zw, tanda, n) {
    const zc = zw + tanda * 0.35;
    kotak(2.2, 0.12, 0.6, mat(0x2a3242, { r: 0.4 }), t0.x0 + 1.7, 0.92, zc);
    kotak(2.2, 0.8, 0.5, mat(0x3a4566, { r: 0.7 }), t0.x0 + 1.7, 0.45, zc - tanda * 0.05);
    for (let i = 0; i < n; i++) {
      const sx = t0.x0 + 1.15 + i * 1.1;
      tabung(0.2, 0.15, 0.12, mPorselen, sx, 0.99, zc);
      tabung(0.025, 0.025, 0.25, mKrom, sx, 1.1, zw + tanda * 0.12);
      kotak(0.8, 1.0, 0.03, mCermin, sx, 1.85, zw + tanda * 0.12, scene, false); // cermin
    }
    kotak(0.25, 0.35, 0.15, mKrom, t0.x0 + 3.0, 1.5, zw + tanda * 0.14); // pengering tangan
  }
  // pria: wastafel di dinding belakang, dua urinoir di dinding kanan, satu bilik
  wastafel(t0.z0 + 0.1, 1, 2);
  for (const uz of [8.7, 9.6]) {
    kotak(0.3, 0.7, 0.45, mPorselen, t0.x1 - 0.25, 0.9, uz);
    kotak(0.03, 0.7, 0.05, mat(0x5a7fb0), t0.x1 - 0.35, 1.1, uz + 0.42); // sekat urinoir
  }
  bilik(10.15, tm - 0.1);
  // wanita: wastafel di dinding pemisah, dua bilik di ujung depan
  wastafel(tm + 0.1, 1, 2);
  bilik(14.0, 15.5);
  bilik(15.5, t0.z1 - 0.1);
  for (const pt of pintuT) { const lt = new THREE.PointLight(0xe8f4ff, 1.4, 5, 1.6); lt.position.set(t0.x0 + 1.6, 2.6, pt.z + 1.2); scene.add(lt); }
  tanamanBesar(t0.x0 + 0.45, t0.z1 - 0.5, 0.6);

  // ---- ruang arsip di antara area departemen dan ruang santai
  const a0 = { x0: 2, x1: 16, z0: -5.8, z1: -0.8 }, ap = -1.8; // ap = tengah pintu di tembok kanan
  kotak(a0.x1 - a0.x0 - 0.1, 0.03, a0.z1 - a0.z0 - 0.1, mat(0x2a2f48, { r: 0.8 }), (a0.x0 + a0.x1) / 2, 0.02, (a0.z0 + a0.z1) / 2, scene, false).receiveShadow = true;
  ruangBertembok([
    [a0.x0, a0.z0, a0.x1, a0.z0], [a0.x0, a0.z1, a0.x1 + 0.1, a0.z1], [a0.x0, a0.z0, a0.x0, a0.z1],
    [a0.x1, a0.z0, a0.x1, ap - 0.6], [a0.x1, ap + 0.6, a0.x1, a0.z1],
  ], { x: (a0.x0 + a0.x1) / 2, z: (a0.z0 + a0.z1) / 2 }, 3.2, 0.9, 0x4a3f66);
  const ga = grupPotong('x', a0.x1, 1);
  for (const [grup, y] of [[ga.penuh, 2.85], [ga.pendek, 1.45]]) {
    const pl = papanNama('ARSIP', 1.4, a0.x1 + 0.13, y, ap, Math.PI / 2, '#c9b9e8'); scene.remove(pl); grup.add(pl);
  }
  // rak arsip bergerak (roll o pack) berjajar, berisi map dan kotak arsip
  const warnaMap = [0xd9532b, 0x3a4f8a, 0xffcf7a, 0x3f9a5e, 0xc9b9e8, 0xe8dcc0];
  for (let i = 0; i < 6; i++) {
    const rx = a0.x0 + 0.9 + i * 1.6;
    kotak(0.7, 2.4, 3.2, mat(0x6a7699, { r: 0.5, m: 0.5 }), rx, 1.2, a0.z0 + 1.85);
    kotak(0.74, 0.12, 3.24, 0x2a3242, rx, 0.06, a0.z0 + 1.85, scene, false); // rel
    tabung(0.12, 0.12, 0.05, 0x2a3242, rx + 0.38, 1.3, a0.z1 - 1.6).rotation.z = Math.PI / 2; // roda putar
    for (let t = 0; t < 4; t++) for (let k = 0; k < 6; k++) {
      kotak(0.08, 0.38, 0.42, warnaMap[(i + t + k) % warnaMap.length], rx + 0.36, 0.35 + t * 0.55, a0.z0 + 0.6 + k * 0.5, scene, false);
    }
  }
  // lemari arsip besi berlaci dan meja pemindai
  for (let i = 0; i < 3; i++) {
    const lx = a0.x1 - 3.8 + i * 0.9;
    kotak(0.8, 1.4, 0.7, mat(0x8a96c0, { r: 0.4, m: 0.6 }), lx, 0.7, a0.z0 + 0.45);
    for (const dy of [0.3, 0.65, 1.0, 1.3]) kotak(0.6, 0.04, 0.02, 0x2a3242, lx, dy, a0.z0 + 0.81, scene, false);
  }
  kotak(1.6, 0.08, 0.8, WARNA.meja, a0.x1 - 1.3, 0.85, a0.z0 + 1.4);
  for (const dx of [-0.7, 0.7]) kotak(0.06, 0.8, 0.7, WARNA.gelap, a0.x1 - 1.3 + dx, 0.42, a0.z0 + 1.4);
  kotak(0.6, 0.15, 0.4, 0x2a3242, a0.x1 - 1.5, 0.97, a0.z0 + 1.4); // pemindai
  for (let i = 0; i < 4; i++) kotak(0.5, 0.3, 0.35, 0xc8a878, a0.x1 - 2.8 + (i % 2) * 0.55, 0.15 + Math.floor(i / 2) * 0.3, a0.z0 + 2.4); // kardus arsip
  const lampuArsip = new THREE.PointLight(0xffe8c0, 1.6, 9, 1.6); lampuArsip.position.set((a0.x0 + a0.x1) / 2, 2.8, (a0.z0 + a0.z1) / 2); scene.add(lampuArsip);
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
  const mRangka = mat(0x2a3242, { r: 0.5, m: 0.5 });
  // lantai kayu yang lebih hangat
  kotak(x1 - x0 - 0.1, 0.03, z1 - z0 - 0.1, mat(0x3b2a3a, { r: 0.7 }), (x0 + x1) / 2, 0.02, (z0 + z1) / 2, scene, false).receiveShadow = true;
  for (let z = z0 + 0.4; z < z1; z += 0.55) kotak(x1 - x0 - 0.1, 0.005, 0.03, 0x2b1f2c, (x0 + x1) / 2, 0.04, z, scene, false);
  // tembok depan utuh (ruang rapat menempel di baliknya), tembok kanan dengan pintu ganda di tengah
  const LP = 2.0; // lebar bukaan pintu ganda
  const rm = ruangBertembok([
    [x0, z1, x1 + 0.1, z1], [x1, z0, x1, pintu.z - LP / 2], [x1, pintu.z + LP / 2, x1, z1],
  ], { x: (x0 + x1) / 2, z: (z0 + z1) / 2 });
  const { T, TP } = rm;
  const { penuh, pendek } = grupPotong('x', x1, 1); // pintu, papan nama, dan piagam ikut tembok kanan
  kotak(0.24, T - 2.5, LP + 0.1, rm.mTembok, x1, 2.5 + (T - 2.5) / 2, pintu.z, penuh); // ambang atas pintu
  for (const s of [-1, 1]) kotak(0.26, 2.5, 0.1, mRangka, x1, 1.25, pintu.z + s * (LP / 2 + 0.03), penuh, false); // kusen
  // dua daun pintu kayu, terbuka ke dalam dan terlipat rapat ke tembok supaya jalan tetap lapang
  const mDaun = mat(0x8a5a3c, { r: 0.6 });
  for (const s of [-1, 1]) {
    const engsel = new THREE.Group(); engsel.position.set(x1 - 0.14, 0, pintu.z + s * LP / 2);
    engsel.rotation.y = s * (Math.PI - 0.15); penuh.add(engsel);
    const d = -s; // daun menjulur dari engsel ke arah tengah pintu sebelum diputar
    kotak(0.06, 2.4, LP / 2 - 0.04, mDaun, 0, 1.2, d * (LP / 4), engsel);
    kotak(0.02, 0.9, LP / 2 - 0.3, 0x6a4430, -0.04, 1.75, d * (LP / 4), engsel, false); // panel ukir
    kotak(0.04, 0.35, 0.05, mat(0xffcf7a, { m: 0.8, r: 0.3 }), -0.06, 1.1, d * (LP / 2 - 0.15), engsel, false); // gagang emas
  }
  kotak(0.9, 0.02, LP + 0.4, 0x5b2f3a, x1 + 0.55, 0.03, pintu.z, scene, false); // keset di depan pintu
  // papan nama MANAJER di atas pintu, menghadap keluar
  for (const [grup, y] of [[penuh, 2.85], [pendek, TP + 0.55]]) {
    const pl = papanNama('MANAJER', 1.8, x1 + 0.13, y, pintu.z, Math.PI / 2); scene.remove(pl); grup.add(pl);
  }

  // ---- dekorasi ruang manajer
  const { dBelakang, dKiri } = grupDinding;
  // lukisan di kiri dan kanan jendela belakang, dan di dinding kiri
  lukisan(3, 2.4, 1.6, -19.6, 2.6, z0 + 0.08, 0, dBelakang);
  lukisan(8, 2.4, 1.6, -5.4, 2.6, z0 + 0.08, 0, dBelakang);
  lukisan(5, 1.8, 1.3, x0 + 0.08, 2.7, -6.5, Math.PI / 2, dKiri);
  // tirai di kedua sisi jendela belakang
  const mTirai = mat(0x7a2f3c, { r: 1 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) kotak(0.22, 3.4, 0.14, mTirai, -12.5 + s * (3.35 + i * 0.2), 2.4, z0 + 0.25 + (i % 2) * 0.06, dBelakang);
  }
  kotak(7.8, 0.1, 0.1, mat(0xffcf7a, { m: 0.8, r: 0.3 }), -12.5, 4.2, z0 + 0.3, dBelakang); // rel tirai
  // rak buku besar di dinding kiri, berisi buku dan piala
  rakBuku(x0 + 0.3, -15, 8, true, 1, 4, 0x4a2e22);
  for (const dz of [-2.5, 0, 2.5]) {
    tabung(0.1, 0.14, 0.12, 0xffcf7a, x0 + 0.4, 2.73, -15 + dz);
    tabung(0.14, 0.06, 0.25, mat(0xffcf7a, { m: 0.8, r: 0.3 }), x0 + 0.4, 2.92, -15 + dz);
  }
  // akuarium di atas lemari rendah, menyala biru
  kotak(0.8, 0.8, 2.4, WARNA.gelap, x0 + 0.5, 0.4, -9.2);
  const mAir = mat(0x3fb7ff, { e: 0x1a6fd6, ei: 0.7, t: true, op: 0.55 });
  kotak(0.7, 0.9, 2.3, mAir, x0 + 0.5, 1.26, -9.2, scene, false);
  for (let i = 0; i < 6; i++) bola(0.06, [0xff8f6b, 0xffd23a, 0xc9b9e8][i % 3], x0 + 0.5, 1.0 + (i % 3) * 0.2, -10.1 + i * 0.35).scale.set(0.6, 0.7, 1.6);
  const lampuAkuarium = new THREE.PointLight(0x3fb7ff, 1.8, 4, 1.8); lampuAkuarium.position.set(x0 + 1.2, 1.4, -9.2); scene.add(lampuAkuarium);
  // globe di atas tiang di samping meja
  tabung(0.2, 0.25, 0.05, WARNA.gelap, -16.6, 0.03, -21.5);
  tabung(0.03, 0.03, 0.9, 0xb08a3c, -16.6, 0.5, -21.5);
  bola(0.32, mat(0x3f8ad6, { r: 0.5 }), -16.6, 1.15, -21.5);
  bola(0.322, mat(0x6dbb7a, { r: 0.6, t: true, op: 0.6 }), -16.55, 1.17, -21.45).scale.set(0.8, 0.9, 0.7);
  // bendera merah putih di tiang
  tabung(0.15, 0.18, 0.06, WARNA.gelap, -14.9, 0.03, -23.2);
  tabung(0.025, 0.025, 2.6, 0xd8dde8, -14.9, 1.3, -23.2);
  bola(0.05, 0xffcf7a, -14.9, 2.63, -23.2);
  kotak(0.9, 0.3, 0.02, 0xd9332b, -14.45, 2.35, -23.2, scene, false);
  kotak(0.9, 0.3, 0.02, 0xf2efe6, -14.45, 2.05, -23.2, scene, false);
  // lemari pajangan (credenza) dengan teko dan buku
  kotak(3, 0.8, 0.6, mat(0x4a2e22, { r: 0.7 }), -7.6, 0.4, z0 + 0.45);
  kotak(3.04, 0.05, 0.64, 0xb08a3c, -7.6, 0.82, z0 + 0.45);
  tabung(0.14, 0.18, 0.4, mat(0xc9b9e8, { t: true, op: 0.7, r: 0.1 }), -8.6, 1.05, z0 + 0.45);
  for (let i = 0; i < 4; i++) kotak(0.1, 0.36, 0.28, WARNA_BUKU[i], -7.2 + i * 0.12, 1.02, z0 + 0.45);
  bola(0.16, mat(0xffcf7a, { m: 0.8, r: 0.2 }), -6.4, 1.0, z0 + 0.45);
  // sudut tamu: dua kursi berlengan, meja kopi, karpet bundar, lampu berdiri
  const tx0 = -6.5, tz0 = -6.5;
  const karpetBundar = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), mat(0x5b3f7a, { r: 1 }));
  karpetBundar.rotation.x = -Math.PI / 2; karpetBundar.position.set(tx0, 0.05, tz0); karpetBundar.receiveShadow = true; scene.add(karpetBundar);
  const mKursiTamu = mat(0xc9b9e8, { r: 0.95 });
  for (const [dx, rot] of [[-1.3, Math.PI / 2], [1.3, -Math.PI / 2]]) {
    const g = new THREE.Group(); g.position.set(tx0 + dx, 0, tz0); g.rotation.y = rot; scene.add(g);
    kotak(1.0, 0.42, 0.95, mKursiTamu, 0, 0.3, 0, g); kotak(1.0, 0.75, 0.22, mKursiTamu, 0, 0.72, -0.38, g);
    for (const s of [-1, 1]) kotak(0.18, 0.55, 0.95, mKursiTamu, s * 0.5, 0.45, 0, g);
  }
  tabung(0.55, 0.55, 0.06, mat(0x8a5a3c, { r: 0.5 }), tx0, 0.45, tz0);
  tabung(0.07, 0.12, 0.42, WARNA.gelap, tx0, 0.22, tz0);
  tabung(0.08, 0.07, 0.14, WARNA.krem, tx0 + 0.2, 0.55, tz0 - 0.1);
  kotak(0.35, 0.04, 0.25, 0x5ad1ff, tx0 - 0.2, 0.5, tz0 + 0.1).rotation.y = 0.4;
  tabung(0.02, 0.02, 1.7, WARNA.krem, tx0 + 2.2, 0.85, tz0 - 1.2);
  tabung(0.14, 0.28, 0.3, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.8 }), tx0 + 2.2, 1.75, tz0 - 1.2);
  const lampuTamu = new THREE.PointLight(0xffa640, 1.8, 5, 1.6); lampuTamu.position.set(tx0 + 2, 1.9, tz0 - 1); scene.add(lampuTamu);
  // karpet golf mini dengan bendera
  kotak(1.2, 0.025, 4.2, mat(0x3f8a5a, { r: 1 }), -20.5, 0.04, -3.4, scene, false);
  tabung(0.06, 0.06, 0.01, 0x0a0f22, -20.5, 0.06, -4.9, scene);
  tabung(0.012, 0.012, 0.8, 0xe8eef8, -20.5, 0.45, -4.9);
  kotak(0.3, 0.18, 0.01, 0xff5d6c, -20.35, 0.75, -4.9, scene, false);
  bola(0.05, 0xffffff, -20.4, 0.08, -2.2);
  // piagam dan jam di sisi dalam tembok kanan (ikut terpotong bersama tembok)
  for (const dz of [-20, -17.5]) {
    kotak(0.04, 0.8, 1.1, 0xb08a3c, x1 - 0.12, 2.2, dz, penuh, false);
    kotak(0.02, 0.66, 0.96, 0xf2efe6, x1 - 0.15, 2.2, dz, penuh, false);
  }
  // tanaman besar di sudut-sudut
  for (const [px, pz, sk] of [[x0 + 0.8, z1 - 0.8, 1.2], [-9.5, z1 - 0.7, 1], [-1.4, -3.5, 0.9], [-3.4, -9.6, 0.9]]) tanamanBesar(px, pz, sk);

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
  const titikLapor = pintuManajer ? { x: pintuManajer.x + 0.65, z: pintuManajer.z } : null;

  // ---- troli kebersihan dan tong sampah besar di dekat dinding terdekat
  const sisi = pos.x >= 0 ? 1 : -1;
  const troli = new THREE.Group(); troli.position.set(pos.x + sisi * 0.85, 0, pos.z); scene.add(troli);
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
  const tongBesar = new THREE.Group(); tongBesar.position.set(pos.x + sisi * 0.85, 0, pos.z - 1.05); scene.add(tongBesar);
  tabung(0.3, 0.26, 0.75, 0x3f7a5e, 0, 0.38, 0, tongBesar);
  tabung(0.32, 0.32, 0.05, 0x2f5e48, 0, 0.77, 0, tongBesar);
  const tumpukan = bola(0.24, 0x141820, 0, 0.82, 0, tongBesar); tumpukan.scale.set(1, 0.6, 1); tumpukan.visible = false;

  // ---- tubuh petugas: seragam toska, topi kuning, celemek
  const orang = new THREE.Group(); orang.position.set(rumah.x, 0, rumah.z); orang.rotation.y = sisi * Math.PI / 2; scene.add(orang);
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
      papanBasah.position.set(rumah.x - sisi * 0.5, 0, rumah.z - 0.9); papanBasah.visible = true;
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
        if (titikLapor) jalan([...balik, ...ruteLorong(rumah, titikLapor).slice(1)], 'lapor', -Math.PI / 2);
        else jalan(balik, 'buang', sisi * Math.PI / 2);
      }
    } else if (g.mode === 'lapor') {
      // menunjuk kantong ke arah manajer, menunggu jawaban
      lengan[0].rotation.x = 1.1; lengan[1].rotation.x = 0.8; sapu.rotation.x = 0.7;
      kepala.rotation.y = Math.sin(g.waktu * 1.5) * 0.15;
      if (g.waktu > 2.4 && ucap.visible && g.oke !== true) { g.oke = true; bicara('OK, buang ✓', '#6dff9a'); }
      if (g.waktu > g.lama) {
        g.oke = false; bicara(null);
        jalan([...ruteLorong(rumah, titikLapor)].reverse(), 'buang', sisi * Math.PI / 2);
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
