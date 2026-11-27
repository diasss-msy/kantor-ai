# kantor-ai

Arsip laporan dan aturan Kantor AI: Manajer membagi tugas ke departemen Kuliah, Coding, dan Kerja, dan setiap tugas meninggalkan satu file laporan di sini.

| File | Isi |
|---|---|
| `CLAUDE.md` | Aturan menulis laporan (dibaca setiap thread) |
| `karyawan.json` | Daftar karyawan |
| `instruksi-proyek.md` | Teks untuk Proyek > Project instructions |
| `laporan/` | Laporan, satu file per tugas |
| `tools/cek_laporan.py` | Pemeriksa `karyawan.json` dan laporan |
| `docs/` | Dokumen desain |

## Menjalankan pemeriksa

Butuh Python 3.11 atau lebih baru. Pemeriksa hanya memakai pustaka standar; tes memakai pytest.

```bash
python tools/cek_laporan.py      # kode keluar 0 berarti semua laporan valid
pip install pytest
python -m pytest -q
```

GitHub Actions (`.github/workflows/cek.yml`) menjalankan keduanya di setiap push dan pull request.
