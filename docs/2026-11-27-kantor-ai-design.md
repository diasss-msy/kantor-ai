# Kantor AI — Dokumen Desain

Tanggal: 27 November 2026
Status: draf v2 (pindah ke fitur Proyek Claude), menunggu persetujuan

## 1. Maksud dan alasan

Syahrial ingin punya satu "kantor" berisi tim agen AI yang bisa diberi tugas kuliah dan tugas kerja lewat satu pintu. Tim ini dibagi per departemen dengan peran yang jelas, dan setiap tugas meninggalkan laporan. Laporan itu nantinya ditampilkan di kantor 3D sebagai "wajah", seperti di video TikTok "Kantor AI" (@malikifsaputra).

Prinsip dari video itu tetap dipakai: **agennya dibuat dulu, kantornya belakangan.** Kantor 3D hanya menampilkan apa yang sudah dikerjakan agen.

## 2. Sasaran, bukan sasaran, dan anti-sasaran

**Sasaran**
- Satu pintu: Syahrial cukup memberi perintah ke Manajer, lalu Manajer membagi tugas ke departemen.
- Tiga departemen dengan batas tugas yang jelas: Kuliah, Coding, dan Kerja.
- Bisa dipakai dari laptop maupun HP, dan pekerjaan tetap berjalan saat laptop ditutup.
- Setiap tugas menghasilkan laporan yang rapi dan bisa dibaca mesin.
- Tahap 2: kantor 3D yang membaca daftar karyawan dan laporan.

**Bukan sasaran**
- Materi visual seperti poster dan konten media sosial.
- Agen yang bekerja sendiri sesuai jadwal tanpa diperintah. Jam kerja hanya untuk tampilan; jadwal otomatis bisa ditambahkan nanti.

**Anti-sasaran (gagal meskipun "jalan")**
- Kode ditulis di dua tempat. Hanya departemen Coding yang menulis kode.
- Riset atau laporan yang mengarang: sumber fiktif, atau klaim "selesai/lulus tes" padahal tidak.
- Agen yang menghapus atau menimpa file proyek tanpa bertanya dulu.
- Kuota paket Pro habis karena terlalu banyak thread berjalan bersamaan.
- Kantor 3D menjadi pekerjaan utama, sementara agennya setengah jadi.

## 3. Batasan

- Dibangun di **Proyek (beta)** di tab Code aplikasi Claude desktop, dengan paket **Pro**.
- Thread berjalan di cloud secara default. Thread cloud **tidak** memuat agen atau command di `.claude/`, sehingga departemen didefinisikan di **instruksi proyek** (maksimal 16.000 karakter).
- Kode yang dikerjakan thread cloud harus ada di GitHub dengan Claude GitHub App terpasang. Syahrial sudah punya akun GitHub.
- Proyek yang butuh alat di Mac (misalnya Laravel dengan MariaDB dari XAMPP) dikerjakan sebagai **thread lokal** lewat menu *Work locally*. Untuk itu, Remote Control harus aktif di Settings > Claude Code, dan folder proyeknya sudah ditambahkan.
- Connector akun claude.ai (Figma, Google Drive, dan lainnya) bisa dipakai thread cloud. Percakapan proyek sendiri tidak punya connector.
- Laporan kuliah diserahkan dalam **dua format, .docx dan .pdf**, dengan header berisi nama dan NIM: Muhammad Syahrial Alfadiaz, 255150600111027.

## 4. Pendekatan yang dipertimbangkan

| Pendekatan | Kelebihan | Kekurangan | Keputusan |
|---|---|---|---|
| A. Satu folder Claude Code di laptop | Sederhana, dekat dengan kode | Hanya bisa dipakai di laptop, Manajer harus dibangun sendiri | Diganti |
| B. Plugin Claude + kantor 3D online | Bisa diakses dari mana saja | Banyak bagian yang harus disambungkan | Diganti |
| C. Aplikasi web sendiri dengan API Claude | Paling "terlihat" seperti kantor | Butuh API key dan biaya, lama dibangun | Tidak dipakai |
| **P. Proyek Claude (beta)** | Manajer sudah tersedia, bisa dari HP, tetap jalan saat laptop ditutup, connector langsung terpakai | Kuota lebih cepat habis, fitur masih beta, kode di cloud harus lewat GitHub | **Dipilih**, menggantikan urutan A lalu B |

## 5. Bagian-bagian kantor

| Bagian kantor | Wujudnya di Proyek |
|---|---|
| Manajer | Percakapan proyek (koordinator) |
| Aturan kantor dan peran departemen | Instruksi proyek |
| Ingatan kantor (keputusan, kesalahan yang tidak boleh terulang) | Memori proyek |
| Karyawan yang sedang bekerja | Thread. Nama thread diawali departemennya, misalnya `[Kuliah] Riset bab 2 PPD` |
| Hasil kerja (laporan, desain, dokumen) | Tab Library. Kode masuk ke GitHub sebagai PR |
| Arsip laporan dan kantor 3D | Repo GitHub `kantor-ai` |

## 6. Alur kerja

```
Syahrial ──perintah──► Manajer (percakapan proyek)
                         │ pilih departemen, pecah tugas,
                         │ buka thread "[Departemen] tugas"
          ┌──────────────┼──────────────┐
       [Kuliah]        [Kerja]       [Coding]
       thread cloud   thread cloud   thread cloud (repo GitHub)
          │              │           atau thread lokal (Mac)
          └─"butuh kode"─┴──► Manajer ──► thread [Coding] baru
                         │
       tiap thread menulis 1 file laporan ke repo kantor-ai
                         │
             Manajer merangkum hasil ke Syahrial
```

- Perintah bisa umum ("kerjakan tugas PPD bab 3") atau langsung menyebut departemennya ("Kuliah: ...").
- Kalau perintahnya ambigu, atau berisiko merusak sesuatu (hapus file, reset database), thread bertanya dulu dan muncul di daftar *Waiting on you*.
- Kalau Kuliah atau Kerja butuh kode, thread tersebut menulis kebutuhannya di hasilnya. Manajer lalu membuka thread [Coding] untuk mengerjakannya.
- Paling banyak **2 thread berjalan bersamaan**, kecuali Syahrial meminta lebih, supaya kuota Pro tidak cepat habis.

## 7. Departemen (isi instruksi proyek)

**Manajer**
- Memilih departemen, memberi nama thread sesuai departemennya, meneruskan pesanan kode ke Coding, dan merangkum hasil.
- Tidak mengerjakan sendiri pekerjaan departemen.

**Kuliah** (thread cloud)
- Riset dengan pencarian web. Setiap klaim penting disertai sumber nyata, dan agen tidak boleh mengarang sumber.
- Menulis laporan, artikel, dan ringkasan. Hasil akhirnya dalam bentuk **.docx dan .pdf** dengan header nama dan NIM, disimpan di Library.
- Kalau tugas butuh program, Kuliah memesan ke Coding dan menulis bagian laporannya sendiri.

**Coding** (thread cloud untuk repo GitHub, thread lokal untuk proyek yang butuh XAMPP atau alat lain di Mac)
- Satu-satunya departemen yang menulis dan mengubah kode, untuk kebutuhan Kuliah, Kerja, maupun perintah langsung.
- Menjalankan aplikasi atau tes sebelum melapor "selesai", dan melaporkan apa adanya kalau gagal.
- Mengirim perubahan sebagai PR, bukan langsung ke branch utama, kecuali diminta.
- Bertanya dulu sebelum menghapus file, menjalankan migrasi yang menghapus data, atau melakukan perubahan besar.

**Kerja** (thread cloud)
- Mengurus semua jenis pekerjaan: proyek klien, pekerjaan di tempat kerja, dan proyek pribadi.
- Mendesain tampilan aplikasi/web lewat connector Figma, atau mockup HTML kalau Figma tidak tersedia.
- Mengatur proyek: kebutuhan, daftar tugas, dan catatan per proyek, disimpan di Library.
- Menyerahkan desain dan spesifikasi ke Coding lewat Manajer, dan tidak ngoding sendiri.

## 8. Repo `kantor-ai` dan format laporan

```
kantor-ai/
├── CLAUDE.md               ← cara menulis laporan di repo ini
├── karyawan.json           ← nama, departemen, tugas, jam kerja
├── laporan/
│   └── 2026-11-27/
│       └── 0912-coding-login-jwt.json   ← satu file per tugas
├── kantor/                 ← tahap 2: kantor 3D (Three.js)
└── docs/
    └── 2026-11-27-kantor-ai-design.md
```

- **Satu file per tugas, bukan satu file per hari.** Thread berjalan paralel, dan kalau semuanya menulis ke file yang sama, perubahannya akan bentrok.
- File laporan di-commit **langsung ke `main`**, khusus folder `laporan/`, supaya kantor 3D langsung bisa membacanya tanpa perlu menyetujui PR.
- Thread lokal menulis laporan ke clone `kantor-ai` di Mac lalu melakukan push.

Isi file laporan:
```json
{ "waktu": "2026-11-27T09:12:00+07:00", "agen": "coding",
  "tugas": "Tambah login JWT di proyek perpustakaan",
  "dipesan_oleh": "kuliah", "status": "selesai",
  "ringkasan": "Login JWT jalan, 6 tes lulus",
  "hasil": ["PR #12 di repo perpustakaan"] }
```
Nilai `status`: `dikerjakan`, `selesai`, `gagal`, atau `butuh-input`.

Isi `karyawan.json`, satu entri per agen:
```json
{ "id": "kuliah", "nama": "…", "departemen": "Kuliah",
  "tugas": "Riset dan menulis laporan kuliah", "jam_kerja": "08:00–16:00" }
```

## 9. Tahap 2: kantor 3D (gambaran awal)

- Halaman Three.js di `kantor-ai/kantor/` yang membaca `karyawan.json` dan `laporan/`.
- Satu meja atau area untuk setiap departemen, ditambah meja Manajer. Karakter terlihat "bekerja" kalau statusnya `dikerjakan` hari ini. Klik karakter untuk melihat laporannya, dan ada pilihan timelapse satu hari.
- Cara membukanya online dibahas saat tahap 2. Pilihannya antara lain GitHub Pages (yang membuat repo dan laporannya publik) atau artefak Claude yang privat.
- Tampilan detail (gaya, warna, isi ruangan) juga dibahas tersendiri.

## 10. Diserahkan ke pembangun

- Kata-kata persis instruksi proyek, asalkan mengikuti peran dan aturan di atas.
- Nama file laporan dan cara commit-nya, asalkan tetap sesuai bagian 8.
- Cara membuat .docx dan .pdf di sandbox thread, misalnya dengan skill docx/pdf yang aktif di akun claude.ai.

## 11. Keputusan yang diambil Claude (bisa dikoreksi)

1. Departemen ditulis di instruksi proyek, karena thread cloud tidak memuat file agen.
2. Nama thread diawali departemennya supaya terlihat siapa mengerjakan apa.
3. Paling banyak 2 thread berjalan bersamaan, untuk menjaga kuota Pro.
4. Laporan disimpan satu file per tugas, di-commit langsung ke `main` di repo `kantor-ai`.
5. Jam kerja hanya untuk tampilan.
6. Proyek kode yang sudah ada tetap di repo atau folder aslinya.

## 12. Masih terbuka (tidak menghalangi tahap 1)

- Nama-nama karyawan: ditentukan sebelum kantor 3D dibuat.
- Cara membuka kantor 3D secara online: dibahas di tahap 2.
