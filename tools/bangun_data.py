"""Membangun data.json untuk kantor 3D dari karyawan.json dan laporan/.

Hanya memakai pustaka standar Python. Gagal (kode 1) kalau ada laporan
yang tidak lolos pemeriksa, supaya kantor tidak menampilkan data rusak.
CLI: python tools/bangun_data.py [root] [keluar]
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.cek_laporan import cek_laporan, muat_id_karyawan  # noqa: E402

WIB = timezone(timedelta(hours=7))


def bangun(root: Path, sekarang: datetime | None = None) -> dict:
    root = Path(root)
    ids = muat_id_karyawan(root / "karyawan.json")
    karyawan = json.loads((root / "karyawan.json").read_text(encoding="utf-8"))

    laporan = []
    galat = []
    for p in sorted((root / "laporan").glob("**/*.json")):
        rel = p.relative_to(root).as_posix()
        masalah = cek_laporan(p, ids)
        if masalah:
            galat.extend(f"{rel}: {m}" for m in masalah)
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        laporan.append({"file": rel, **{k: data[k] for k in
                        ("waktu", "agen", "tugas", "dipesan_oleh", "status", "ringkasan", "hasil")}})
    if galat:
        raise ValueError("\n".join(galat))

    laporan.sort(key=lambda d: (datetime.fromisoformat(d["waktu"]), d["file"]))
    sekarang = (sekarang or datetime.now(WIB)).astimezone(WIB).replace(microsecond=0)
    return {"dibuat": sekarang.isoformat(), "karyawan": karyawan, "laporan": laporan}


def main(root: Path, keluar: Path) -> int:
    try:
        data = bangun(root)
    except (OSError, ValueError) as e:
        print(e)
        return 1
    keluar = Path(keluar)
    keluar.parent.mkdir(parents=True, exist_ok=True)
    keluar.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{keluar}: {len(data['karyawan'])} karyawan, {len(data['laporan'])} laporan")
    return 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(main(Path(a[0]) if a else Path("."), Path(a[1]) if len(a) > 1 else Path("_site/data.json")))
