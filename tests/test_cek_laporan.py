import json
from pathlib import Path

import pytest

from tools.cek_laporan import cek_laporan, main, muat_id_karyawan

ID = {"manajer", "kuliah", "coding", "kerja"}


def tulis(root: Path, relpath: str, data) -> Path:
    p = root / relpath
    p.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        p.write_text(data, encoding="utf-8")
    else:
        p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return p


def laporan(**ubah):
    data = {
        "waktu": "2026-11-27T09:12:00+07:00",
        "agen": "coding",
        "tugas": "Tambah login JWT di proyek perpustakaan",
        "dipesan_oleh": "kuliah",
        "status": "selesai",
        "ringkasan": "Login JWT jalan, 6 tes lulus",
        "hasil": ["PR #12"],
    }
    data.update(ubah)
    return data


@pytest.fixture
def root(tmp_path):
    tulis(
        tmp_path,
        "karyawan.json",
        [
            {"id": i, "nama": i.title(), "departemen": i.title(),
             "tugas": "x", "jam_kerja": "08:00–16:00"}
            for i in sorted(ID)
        ],
    )
    return tmp_path


VALID = "laporan/2026-11-27/091200-coding-login-jwt.json"


def test_laporan_valid(root):
    p = tulis(root, VALID, laporan())
    assert cek_laporan(p, ID) == []


def test_field_hilang(root):
    data = laporan()
    del data["ringkasan"]
    galat = cek_laporan(tulis(root, VALID, data), ID)
    assert any("ringkasan" in g for g in galat)


def test_status_tidak_dikenal(root):
    assert cek_laporan(tulis(root, VALID, laporan(status="beres")), ID)


def test_selesai_tanpa_hasil(root):
    assert cek_laporan(tulis(root, VALID, laporan(hasil=[])), ID)
    p = tulis(root, VALID, laporan(status="dikerjakan", hasil=[]))
    assert cek_laporan(p, ID) == []


def test_waktu_tanpa_offset(root):
    p = tulis(root, VALID, laporan(waktu="2026-11-27T09:12:00"))
    assert cek_laporan(p, ID)


def test_waktu_utc(root):
    p = tulis(root, VALID, laporan(waktu="2026-11-27T02:12:00Z"))
    assert cek_laporan(p, ID)


def test_tanggal_folder_tidak_cocok(root):
    p = tulis(root, "laporan/2026-11-28/091200-coding-login-jwt.json", laporan())
    assert cek_laporan(p, ID)


def test_nama_file_tanpa_detik(root):
    p = tulis(root, "laporan/2026-11-27/0912-coding-x.json", laporan())
    assert cek_laporan(p, ID)
    p = tulis(root, "laporan/2026-11-27/101500-coding-login-jwt.json", laporan())
    assert cek_laporan(p, ID)


def test_agen_di_nama_file_beda(root):
    p = tulis(root, "laporan/2026-11-27/091200-kerja-login-jwt.json", laporan())
    assert cek_laporan(p, ID)


def test_agen_tidak_dikenal(root):
    p = tulis(root, "laporan/2026-11-27/091200-coding-a.json", laporan(agen="Coding"))
    assert cek_laporan(p, ID)
    p = tulis(root, VALID, laporan(dipesan_oleh="kampus"))
    assert cek_laporan(p, ID)
    p = tulis(root, VALID, laporan(dipesan_oleh="syahrial"))
    assert cek_laporan(p, ID) == []


def test_json_rusak(root):
    galat = cek_laporan(tulis(root, VALID, "{"), ID)
    assert len(galat) == 1


def test_karyawan_id_ganda(tmp_path):
    entri = {"id": "kuliah", "nama": "K", "departemen": "Kuliah",
             "tugas": "x", "jam_kerja": "08:00–16:00"}
    p = tulis(tmp_path, "karyawan.json", [entri, dict(entri)])
    with pytest.raises(ValueError):
        muat_id_karyawan(p)


def test_karyawan_field_hilang(tmp_path):
    p = tulis(tmp_path, "karyawan.json", [{"id": "kuliah", "nama": "K"}])
    with pytest.raises(ValueError):
        muat_id_karyawan(p)


def test_main_kode_keluar(root, capsys):
    tulis(root, VALID, laporan())
    assert main(root) == 0
    tulis(root, "laporan/2026-11-27/091300-coding-rusak.json", "{")
    assert main(root) == 1
    assert "091300-coding-rusak.json" in capsys.readouterr().out


def test_karyawan_repo_memuat_semua_departemen():
    ids = muat_id_karyawan(Path(__file__).resolve().parents[1] / "karyawan.json")
    assert ids == {"manajer", "kuliah", "coding", "kerja", "maintenance", "logikaku", "kebersihan"}


def test_laporan_logikaku_valid(tmp_path):
    ids = ID | {"logikaku"}
    p = tulis(tmp_path, "laporan/2026-11-27/091200-logikaku-cek-uptime.json",
              laporan(agen="logikaku", dipesan_oleh="syahrial"))
    assert cek_laporan(p, ids) == []
