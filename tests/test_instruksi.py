from pathlib import Path

INSTRUKSI = Path(__file__).resolve().parent.parent / "instruksi-proyek.md"


def baca() -> str:
    return INSTRUKSI.read_text(encoding="utf-8")


def test_panjang_maksimal():
    assert len(baca()) <= 16000


def test_memuat_aturan_penting():
    teks = baca()
    for wajib in ["[Kuliah]", "[Coding]", "[Kerja]", "255150600111027", ".docx",
                  ".pdf", "2 thread", "kantor-ai", "Work locally", "publik", "[Maintenance]",
                  "[LogikaKu]", "[Kebersihan]"]:
        assert wajib in teks, wajib
