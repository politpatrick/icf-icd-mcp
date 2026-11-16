#!/usr/bin/env python3
"""
bri_extract.py – Textauszug aus dem PDF der Begutachtungs-Richtlinien (BRi) mit Fettdruck-Markierung.

Die BRi legt fest, dass die fett gedruckten Definitionen unter jedem Kriterium verbindlich sind.
Deshalb wird Fettdruck als **…** markiert. Ergebnis: eine Textdatei mit Seitenmarken
"=====SEITE n=====", die bi_to_json.py ohne PDF-Bibliothek weiterverarbeitet.

Einzige Abhängigkeit: pypdf (nur für diesen einmaligen Schritt, nicht zur Laufzeit des Servers).
Aufruf: python3 scripts/bri_extract.py source/bri_pflege_2026.pdf source/bri_pflege_2026.txt
"""
import sys

from pypdf import PdfReader


def clean(text: str) -> str:
    # geschützte Leerzeichen und weiche Trennstriche vereinheitlichen
    return text.replace(" ", " ").replace("­", "")


def page_text(page) -> str:
    parts = []

    def visit(text, cm, tm, font, size):
        if not text:
            return
        bold = "Bold" in str((font or {}).get("/BaseFont", ""))
        parts.append((bold, clean(text)))

    page.extract_text(visitor_text=visit)
    out, open_bold = [], False
    for bold, text in parts:
        # Fettdruck zeilenweise markieren, damit Zeilenumbrüche nicht in der Markierung liegen
        for i, line in enumerate(text.split("\n")):
            if i:
                if open_bold:
                    out.append("**")
                    open_bold = False
                out.append("\n")
            if not line.strip():
                out.append(line)
                continue
            if bold and not open_bold:
                out.append("**")
                open_bold = True
            elif not bold and open_bold:
                out.append("**")
                open_bold = False
            out.append(line)
    if open_bold:
        out.append("**")
    return "".join(out).replace("****", "")


def main(src: str, dest: str) -> None:
    reader = PdfReader(src)
    with open(dest, "w", encoding="utf-8") as f:
        for n, page in enumerate(reader.pages, 1):
            f.write(f"=====SEITE {n}=====\n")
            f.write(page_text(page).rstrip() + "\n")
    print(f"{len(reader.pages)} Seiten → {dest}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
