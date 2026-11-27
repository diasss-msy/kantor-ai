# Repo kantor-ai: aturan menulis laporan

Setiap thread Kantor AI (Kuliah, Coding, Kerja, dan Manajer) wajib menulis **satu file laporan per tugas** di repo ini sebelum selesai, termasuk kalau tugasnya gagal atau butuh input.

## Lokasi dan nama file

```
laporan/YYYY-MM-DD/HHMMSS-<agen>-<slug>.json
```

- `YYYY-MM-DD` dan `HHMMSS` memakai waktu WIB (+07:00) dan harus sama dengan field `waktu`.
- Detik wajib ada, supaya dua thread yang melapor di menit yang sama tidak bentrok.
- `<agen>` sama dengan field `agen`.
- `<slug>` berisi huruf kecil, angka, dan tanda `-` saja, misalnya `login-jwt`.

## Isi file

| Field | Isi |
|---|---|
| `waktu` | ISO 8601 dengan offset `+07:00`, misalnya `2026-11-27T09:12:00+07:00`. Jangan memakai `Z` atau UTC. |
| `agen` | id di `karyawan.json`: `manajer`, `kuliah`, `coding`, atau `kerja` (huruf kecil). |
| `tugas` | Tugas yang diterima, satu kalimat. |
| `dipesan_oleh` | id karyawan yang memesan, atau `syahrial` kalau perintahnya langsung dari Syahrial. |
| `status` | `dikerjakan`, `selesai`, `gagal`, atau `butuh-input`. |
| `ringkasan` | Apa yang terjadi, apa adanya. Kalau gagal, tulis kenapa. |
| `hasil` | List teks berisi bukti: link PR, nama file di Library, link desain. Status `selesai` wajib punya minimal satu hasil. |

Contoh `laporan/2026-11-27/091200-coding-login-jwt.json`:

```json
{
  "waktu": "2026-11-27T09:12:00+07:00",
  "agen": "coding",
  "tugas": "Tambah login JWT di proyek perpustakaan",
  "dipesan_oleh": "kuliah",
  "status": "selesai",
  "ringkasan": "Login JWT jalan, 6 tes lulus",
  "hasil": ["PR #12 di repo perpustakaan"]
}
```

## Cara commit

1. Jalankan pemeriksa dulu: `python tools/cek_laporan.py`. Harus keluar tanpa pesan galat (kode 0).
2. Commit **langsung ke `main`**. Ini hanya berlaku untuk file di folder `laporan/`. Perubahan lain di repo ini tetap lewat PR.
3. Pesan commit: `laporan: <agen> <slug>`, misalnya `laporan: coding login-jwt`.
4. Kalau push ditolak karena ada commit baru, jalankan `git pull --rebase` lalu push lagi. Jangan memakai force push.

## Laporan bersifat publik

Laporan ditampilkan di kantor 3D lewat GitHub Pages, jadi anggap setiap laporan bisa dibaca siapa saja. Jangan menulis password, token, isi `.env`, kunci API, atau data pribadi orang lain di laporan. Tulis "kredensial tidak ikut" kalau perlu menyebutnya, bukan isinya.

Jangan mengubah atau menghapus laporan milik thread lain.
