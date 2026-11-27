// Kantor AI tahap 2: adegan 3D gaya "diorama tengah malam".
// Membaca data.json (dibuat tools/bangun_data.py) dan menampilkan status
// setiap karyawan menurut laporan terakhirnya pada tanggal dan jam yang dipilih.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import {
  SEHARI, daftarTanggal, formatJam, hariIniWIB, laporanPada, ringkasHari, statusPada, tataMeja,
} from './status.js';
import { bukaPanel, isiInfo, isiRingkas, isiTanggal, tampilGalat, tutupPanel } from './panel.js';

const $ = (id) => document.getElementById(id);
const WARNA = {
  malam: 0x0a1128, dinding: 0x1b2a4e, dinding2: 0x1f2f57, lantai: 0x22305a, lantaiGaris: 0x18244a,
  gelap: 0x121a33, gelap2: 0x0e1530, meja: 0x2c3e70, sodium: 0xffb347, layar: 0x5ad1ff,
  merah: 0xff5d6c, krem: 0xe8dcc0, redup: 0x7f93c9, kulit: 0xa8775a,
};
const BAJU = { manajer: '#c9b9e8', kuliah: '#e8dcc0', coding: '#3a4f8a', kerja: '#ff8f6b', maintenance: '#7fd1b9', logikaku: '#b6c46a' };
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
const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const kontrol = new OrbitControls(kamera, kanvas);
kontrol.enablePan = false;
kontrol.enableDamping = true;
kontrol.minZoom = 0.7;
kontrol.maxZoom = 2.6;
kontrol.minPolarAngle = 0.7;
kontrol.maxPolarAngle = 1.1;
kontrol.minAzimuthAngle = Math.PI / 4 - 0.6;
kontrol.maxAzimuthAngle = Math.PI / 4 + 0.6;

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
function papan(lebar = 2.1) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(lebar, lebar / 4, 1); s.renderOrder = 10;
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
  Object.assign(bulan.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  bulan.shadow.mapSize.set(2048, 2048); scene.add(bulan);
  const isi = new THREE.DirectionalLight(0x8fa8ff, 0.6); isi.position.set(14, 10, 14); scene.add(isi);
  const tepi = new THREE.DirectionalLight(0xb8c8ff, 0.9); tepi.position.set(-4, 8, -14); scene.add(tepi);

  // lempeng melayang
  kotak(lebar, 0.25, dalam, mat(WARNA.lantai, { r: 0.7 }), 0, -0.12, 0);
  kotak(lebar + 0.2, 1.4, dalam + 0.2, mat(WARNA.gelap, { r: 0.9 }), 0, -0.95, 0);
  kotak(lebar + 0.24, 0.06, dalam + 0.24, mat(WARNA.sodium, { e: WARNA.sodium, ei: 0.6 }), 0, -0.25, 0, scene, false);
  for (let z = -RZ + 0.35; z < RZ; z += 0.7) kotak(lebar, 0.02, 0.04, WARNA.lantaiGaris, 0, 0.01, z, scene, false);
  // dinding
  kotak(lebar, 5, 0.3, WARNA.dinding, 0, 2.5, -RZ - 0.15);
  kotak(0.3, 5, dalam, WARNA.dinding2, -RX - 0.15, 2.5, 0);

  // jendela dengan kota dan hujan
  const r = acak(27);
  const kota = teksturKanvas(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1430'); gr.addColorStop(1, '#26386b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = 20 + r() * 40, bh = 60 + r() * 150;
      g.fillStyle = '#0a1024'; g.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 8; yy < h - 6; yy += 12) for (let xx = x + 4; xx < x + bw - 4; xx += 9) {
        if (r() < 0.25) { g.fillStyle = r() < 0.5 ? '#ffcf7a' : '#7fd6ff'; g.fillRect(xx, yy, 4, 6); }
      }
      x += bw + 3;
    }
  });
  const jx = -1.2;
  const jendela = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.8), new THREE.MeshBasicMaterial({ map: kota }));
  jendela.position.set(jx, 3.0, -RZ + 0.02); scene.add(jendela);
  kotak(6.2, 0.12, 0.2, WARNA.gelap2, jx, 1.55, -RZ + 0.1); kotak(6.2, 0.12, 0.2, WARNA.gelap2, jx, 4.45, -RZ + 0.1);
  for (const dx of [-3.05, -1, 1, 3.05]) kotak(0.1, 2.9, 0.18, WARNA.gelap2, jx + dx, 3.0, -RZ + 0.1);
  // garis hujan di kaca (bergerak)
  const hujanKaca = [];
  const mHujan = new THREE.MeshBasicMaterial({ color: 0xc8d7ff, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.25), mHujan);
    m.position.set(jx - 2.9 + r() * 5.8, 1.7 + r() * 2.6, -RZ + 0.04); m.rotation.z = 0.2;
    scene.add(m); hujanKaca.push(m);
  }

  // rak buku
  const rakZ = -RZ + 3.5;
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
  nm.rotation.y = Math.PI / 2; nm.position.set(-RX + 0.02, 3.6, rakZ + 3.6); scene.add(nm);
  const lampuNeon = new THREE.PointLight(WARNA.sodium, 6, 6, 1.6); lampuNeon.position.set(-RX + 1, 3.6, rakZ + 3.6); scene.add(lampuNeon);
  // tanaman
  tabung(0.3, 0.25, 0.6, WARNA.gelap, RX - 0.8, 0.3, -RZ + 0.8);
  for (let i = 0; i < 6; i++) {
    const d = bola(0.3, 0x2d5a50, RX - 0.8 + Math.cos(i) * 0.2, 0.9 + i * 0.08, -RZ + 0.8 + Math.sin(i) * 0.2);
    d.scale.set(0.5, 1.5, 0.5); d.rotation.z = Math.cos(i * 2) * 0.6;
  }

  // hujan di luar lempeng
  const titik = [];
  for (let i = 0; i < 260; i++) {
    const x = (r() - 0.5) * 50, z = (r() - 0.5) * 50;
    if (Math.abs(x) < RX + 0.5 && Math.abs(z) < RZ + 0.5) continue;
    const y = r() * 24 - 8;
    titik.push(x, y, z, x - 0.05, y - 0.55, z);
  }
  const gHujan = new THREE.BufferGeometry();
  gHujan.setAttribute('position', new THREE.Float32BufferAttribute(titik, 3));
  const hujan = new THREE.LineSegments(gHujan, new THREE.LineBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.35 }));
  scene.add(hujan);

  return (dt) => {
    const p = gHujan.attributes.position.array;
    for (let i = 1; i < p.length; i += 6) {
      p[i] -= dt * 9; p[i + 3] -= dt * 9;
      if (p[i] < -8) { p[i] += 24; p[i + 3] += 24; }
    }
    gHujan.attributes.position.needsUpdate = true;
    for (const m of hujanKaca) { m.position.y -= dt * 1.2; if (m.position.y < 1.7) m.position.y += 2.6; }
  };
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
  // karakter berhoodie
  const mBaju = mat(baju, { r: 0.9 });
  tabung(0.32, 0.4, 0.9, mBaju, 0, 1.05, -0.85, grup);
  bola(0.27, WARNA.kulit, 0, 1.76, -0.85, grup);
  bola(0.31, mBaju, 0, 1.82, -0.92, grup).scale.set(1, 0.9, 1);
  const lengan = [-1, 1].map((s) => {
    const poros = new THREE.Group(); poros.position.set(s * 0.3, 1.32, -0.75); grup.add(poros);
    const l = kotak(0.14, 0.14, 0.62, mBaju, 0, 0, 0.3, poros); l.castShadow = true;
    return poros;
  });

  // papan nama dan status
  const nama = papan(2.1); nama.position.set(0, besar ? 3.0 : 2.75, 0.2); grup.add(nama);
  const status = papan(1.8); status.position.set(0, 2.3, 0.2); grup.add(status);
  const ikon = papan(1.0); ikon.position.set(0.5, 2.25, -0.8); grup.add(ikon);

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
  }

  function animasi(t) {
    const s = sekarang;
    let lampu = 0, layar = 0;
    if (s === 'dikerjakan') {
      lampu = 9; layar = 3.2;
      lengan[0].rotation.x = Math.sin(t * 14) * 0.08; lengan[1].rotation.x = Math.sin(t * 14 + 1.7) * 0.08;
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
    ikon.position.y = 2.25 + Math.sin(t * 1.6 + indeks) * 0.08;
  }

  setStatus('kosong');
  return { setStatus, animasi };
}

// ---------------------------------------------------------------- kamera
let tata = { lebar: 14, dalam: 10 };
function ukurUlang() {
  const W = innerWidth, H = innerHeight, asp = W / H;
  renderer.setSize(W, H, false);
  const butuh = (tata.lebar + tata.dalam) * 0.72; // lebar diagonal ruangan
  const vs = Math.max(tata.dalam * 0.95, butuh / asp / 1.85);
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
  const posisi = Object.fromEntries(tata.meja.map((m) => [m.id, m]));
  data.karyawan.forEach((k, i) => { keadaan.meja[k.id] = bangunMeja(k, posisi[k.id].x, posisi[k.id].z, i); });

  kamera.position.set(22, 19, 22);
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
    animasiRuangan(dt);
    for (const m of Object.values(keadaan.meja)) m.animasi(t);
    kontrol.update();
    renderer.render(scene, kamera);
  });
  document.body.dataset.siap = '1';
}

mulai();
