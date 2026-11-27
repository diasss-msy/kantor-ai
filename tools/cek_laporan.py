"""Pemeriksa karyawan.json dan laporan Kantor AI.

Hanya memakai pustaka standar Python.
CLI: python tools/cek_laporan.py [root]
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

FIELD_KARYAWAN = ("id", "nama", "departemen", "tugas", "jam_kerja")
FIELD_LAPORAN = ("waktu", "agen", "tugas", "dipesan_oleh", "status", "ringkasan", "hasil")
STATUS = {"dikerjakan", "selesai", "gagal", "butuh-input"}
PEMESAN_LUAR = {"syahrial"}

RE_NAMA_FILE = re.compile(r"^(\d{6})-([a-z]+)-([a-z0-9-]+)\.json$")
RE_TANGGAL = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RE_OFFSET = re.compile(r"\+07:00$")


def muat_id_karyawan(path: Path) -> set[str]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("karyawan.json harus berupa list")
    ids: set[str] = set()
    for i, entri in enumerate(data):
        if not isinstance(entri, dict):
            raise ValueError(f"entri ke-{i} bukan objek")
        hilang = [f for f in FIELD_KARYAWAN if f not in entri]
        if hilang:
            raise ValueError(f"entri ke-{i} tidak punya field: {', '.join(hilang)}")
        if entri["id"] in ids:
            raise ValueError(f"id ganda: {entri['id']}")
        ids.add(entri["id"])
    return ids


def _teks_terisi(nilai) -> bool:
    return isinstance(nilai, str) and nilai.strip() != ""


def cek_laporan(path: Path, id_karyawan: set[str]) -> list[str]:
    path = Path(path)
    galat: list[str] = []

    m = RE_NAMA_FILE.match(path.name)
    if not m:
        galat.append("nama file harus HHMMSS-<agen>-<slug>.json (huruf kecil, dengan detik)")
    folder = path.parent.name
    if not RE_TANGGAL.match(folder):
        galat.append(f"folder '{folder}' harus bernama YYYY-MM-DD")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return [f"JSON tidak valid: {e}"]
    if not isinstance(data, dict):
        return galat + ["isi laporan harus berupa objek JSON"]

    for f in FIELD_LAPORAN:
        if f not in data:
            galat.append(f"field '{f}' tidak ada")

    for f in ("tugas", "ringkasan"):
        if f in data and not _teks_terisi(data[f]):
            galat.append(f"field '{f}' harus berupa teks yang terisi")

    agen = data.get("agen")
    if "agen" in data and agen not in id_karyawan:
        galat.append(f"agen '{agen}' tidak ada di karyawan.json")
    pemesan = data.get("dipesan_oleh")
    if "dipesan_oleh" in data and pemesan not in id_karyawan | PEMESAN_LUAR:
        galat.append(f"dipesan_oleh '{pemesan}' tidak dikenal")

    status = data.get("status")
    if "status" in data and status not in STATUS:
        galat.append(f"status '{status}' tidak dikenal (pilih: {', '.join(sorted(STATUS))})")

    hasil = data.get("hasil")
    if "hasil" in data:
        if not isinstance(hasil, list) or not all(_teks_terisi(h) for h in hasil):
            galat.append("field 'hasil' harus berupa list teks")
        elif status == "selesai" and not hasil:
            galat.append("status 'selesai' wajib punya minimal satu 'hasil'")

    waktu = data.get("waktu")
    if "waktu" in data:
        dt = None
        if not isinstance(waktu, str) or not RE_OFFSET.search(waktu):
            galat.append("waktu harus ISO 8601 dengan offset +07:00")
        else:
            try:
                dt = datetime.fromisoformat(waktu)
            except ValueError:
                galat.append(f"waktu '{waktu}' bukan ISO 8601 yang valid")
        if dt is not None:
            if RE_TANGGAL.match(folder) and dt.strftime("%Y-%m-%d") != folder:
                galat.append(f"tanggal waktu ({dt:%Y-%m-%d}) tidak sama dengan folder ({folder})")
            if m and dt.strftime("%H%M%S") != m.group(1):
                galat.append(f"jam di nama file ({m.group(1)}) tidak sama dengan waktu ({dt:%H%M%S})")

    if m and isinstance(agen, str) and m.group(2) != agen:
        galat.append(f"agen di nama file ({m.group(2)}) tidak sama dengan field agen ({agen})")

    return galat


def main(root: Path) -> int:
    root = Path(root)
    try:
        ids = muat_id_karyawan(root / "karyawan.json")
    except (OSError, ValueError) as e:
        print(f"karyawan.json: {e}")
        return 1
    ada_galat = False
    for p in sorted((root / "laporan").glob("**/*.json")):
        for pesan in cek_laporan(p, ids):
            print(f"{p.relative_to(root)}: {pesan}")
            ada_galat = True
    return 1 if ada_galat else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")))
