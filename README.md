# kantor-ai

Arsip laporan dan aturan Kantor AI: Manajer membagi tugas ke departemen Kuliah, Coding, dan Kerja, dan setiap tugas meninggalkan satu file laporan di sini.

| File | Isi |
|---|---|
| `CLAUDE.md` | Aturan menulis laporan (dibaca setiap thread) |
| `karyawan.json` | Daftar karyawan |
| `instruksi-proyek.md` | Teks untuk Proyek > Project instructions |
| `laporan/` | Laporan, satu file per tugas |
| `tools/cek_laporan.py` | Pemeriksa `karyawan.json` dan laporan |
| `tools/bangun_data.py` | Penggabung `karyawan.json` dan laporan menjadi `data.json` untuk kantor 3D |
| `kantor/` | Kantor 3D (Three.js), diterbitkan ke GitHub Pages |
| `docs/` | Dokumen desain dan rencana |

## Menjalankan pemeriksa

Butuh Python 3.11 atau lebih baru. Pemeriksa hanya memakai pustaka standar; tes memakai pytest.

```bash
python tools/cek_laporan.py      # kode keluar 0 berarti semua laporan valid
pip install pytest
python -m pytest -q
```

GitHub Actions (`.github/workflows/cek.yml`) menjalankan keduanya di setiap push dan pull request.

## Kantor 3D

Halaman statis di `kantor/` (tanpa build tool). Three.js r160 disimpan di `kantor/vendor/`.

```bash
python tools/bangun_data.py . kantor/data.json   # data.json tidak di-commit
python -m http.server -d kantor 8000             # buka http://localhost:8000
node --test kantor/status.test.mjs               # tes logika status
```

Parameter URL untuk melihat keadaan tertentu: `?tanggal=2026-11-27&jam=45000&pilih=coding` (`jam` dalam detik sejak 00:00 WIB).

Workflow `.github/workflows/pages.yml` menerbitkan kantor ke GitHub Pages di setiap push ke `main`. Workflow ini baru jalan setelah repo publik dan Settings > Pages > Source diatur ke GitHub Actions.
