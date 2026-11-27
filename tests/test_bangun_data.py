import json
from datetime import datetime, timedelta, timezone

import pytest

from tools.bangun_data import bangun, main
from tests.test_cek_laporan import laporan, tulis

KARYAWAN = [
    {"id": i, "nama": i.title(), "departemen": i.title(), "tugas": "x", "jam_kerja": "08:00–16:00"}
    for i in ("manajer", "kuliah", "coding", "kerja")
]
SEKARANG = datetime(2026, 11, 27, 5, 0, tzinfo=timezone.utc)


@pytest.fixture
def root(tmp_path):
    tulis(tmp_path, "karyawan.json", KARYAWAN)
    (tmp_path / "laporan").mkdir()
    return tmp_path


def test_folder_laporan_kosong(root):
    data = bangun(root, SEKARANG)
    assert data["laporan"] == []
    assert [k["id"] for k in data["karyawan"]] == ["manajer", "kuliah", "coding", "kerja"]
    assert data["dibuat"] == "2026-11-27T12:00:00+07:00"


def test_urut_menurut_waktu_dan_punya_field_file(root):
    tulis(root, "laporan/2026-11-28/080000-kerja-b.json",
          laporan(waktu="2026-11-28T08:00:00+07:00", agen="kerja"))
    tulis(root, "laporan/2026-11-27/091200-coding-a.json", laporan())
    tulis(root, "laporan/2026-11-27/150000-kuliah-c.json",
          laporan(waktu="2026-11-27T15:00:00+07:00", agen="kuliah", status="dikerjakan", hasil=[]))
    data = bangun(root, SEKARANG)
    assert [d["file"] for d in data["laporan"]] == [
        "laporan/2026-11-27/091200-coding-a.json",
        "laporan/2026-11-27/150000-kuliah-c.json",
        "laporan/2026-11-28/080000-kerja-b.json",
    ]
    assert data["laporan"][0]["hasil"] == ["PR #12"]
    assert set(data["laporan"][0]) == {"file", "waktu", "agen", "tugas", "dipesan_oleh",
                                       "status", "ringkasan", "hasil"}


def test_field_tambahan_tidak_ikut(root):
    tulis(root, "laporan/2026-11-27/091200-coding-a.json", laporan(rahasia="jangan"))
    assert "rahasia" not in bangun(root, SEKARANG)["laporan"][0]


def test_laporan_tidak_valid_membuat_gagal(root, capsys):
    tulis(root, "laporan/2026-11-27/091200-coding-a.json", laporan(status="beres"))
    with pytest.raises(ValueError, match="beres"):
        bangun(root, SEKARANG)
    assert main(root, root / "_site/data.json") == 1
    assert not (root / "_site/data.json").exists()


def test_main_menulis_file(root):
    tulis(root, "laporan/2026-11-27/091200-coding-a.json", laporan())
    assert main(root, root / "_site/data.json") == 0
    data = json.loads((root / "_site/data.json").read_text(encoding="utf-8"))
    assert len(data["laporan"]) == 1
