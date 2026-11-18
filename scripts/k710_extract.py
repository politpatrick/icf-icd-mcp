#!/usr/bin/env python3
"""
k710_extract.py – Stichwortverzeichnis aus dem PDF der Broschüre K710 "Versorgungsmedizin-Verordnung" (BMAS).

Das Verzeichnis (PDF-Seiten 132–141, gedruckt S. 131–140) ist zweispaltig gesetzt und mit Punktleitern
versehen. Der einfache Textauszug mischt beide Spalten in einer Zeile. Deshalb wird jedes Textstück anhand
seiner tatsächlichen x-Position der linken oder rechten Spalte zugeordnet; danach werden Folgezeilen
(Eintrag über zwei Zeilen) mit dem vorigen Eintrag verbunden.

Ergebnis: eine UTF-8-Textdatei mit einer Zeile je Stichwort: Begriff<TAB>Fundstellen.
Die Fundstellen stehen wörtlich wie gedruckt, mit "; " getrennt; Punktleitern und Buchstaben-
Zwischenüberschriften ("C C") entfallen.

Einzige Abhängigkeit: pypdf (nur für diesen einmaligen Schritt, nicht zur Laufzeit des Servers).
Der Spaltenzuordnung liegen die internen Textzustände von pypdf zugrunde (getestet mit pypdf 7.1.0).
Aufruf: python3 scripts/k710_extract.py source/k710-versorgungsmed-verordnung.pdf source/k710_stichwortverzeichnis.txt
"""
import re
import sys

from pypdf import PdfReader
from pypdf.generic import ContentStream
from pypdf._text_extraction._layout_mode import _fixed_width_page as fw
from pypdf._text_extraction._layout_mode._text_state_manager import TextStateManager

ERSTE_SEITE, LETZTE_SEITE = 132, 141  # 1-basiert, PDF-Seitenzählung
SPALTENGRENZE = 214.0  # x-Position (pt), ab der ein Textstück zur rechten Spalte gehört

LEITER = re.compile(r"\s*(?:\.{2,}|\s\.(?=[A-D] ?\d))\s*")
BUCHSTABE_PAAR = re.compile(r"^([A-ZÄÖÜ])\1?$")
FUND = re.compile(r"^[A-D] ?\d")


def clean(text: str) -> str:
    return text.replace(" ", " ").replace("­", "")


def text_stuecke(reader: PdfReader, page):
    """Liefert (x, y, text) je Textoperator mit der tatsächlichen Startposition."""
    fonts = page._layout_mode_fonts()
    ops = iter(ContentStream(page["/Contents"].get_object(), reader, "bytes").operations)
    state, tjs = TextStateManager(), []
    for operands, op in ops:
        if op in (b"BT", b"q"):
            _, tj = fw.recurse_to_target_op(ops, state, b"ET" if op == b"BT" else b"Q", fonts)
            tjs.extend(tj)
        elif op == b"Tf":
            fw.set_font_operation(state, fonts, operands)
        else:
            state.set_state_param(op, operands)
    # pypdf meldet tx nur bis zum nächsten Tm/Td; die Schreibmarke läuft innerhalb eines Laufs weiter
    # pypdf rechnet die Schreibmarke nur innerhalb eines TJ-Feldes weiter; nach Tj bleibt tx stehen.
    # Ein neuer Lauf (Tm/Td) liegt vor, wenn tx weder gleich bleibt noch um die Breite des Vorgängers wächst.
    out, prev, pen = [], None, 0.0
    for t in tjs:
        if (
            prev is None
            or round(t.ty) != round(prev.ty)
            or (abs(t.tx - prev.tx) > 0.6 and abs(t.tx - prev.tx - (prev.displaced_tx - prev.tx)) > 0.6)
        ):
            pen = t.tx
        out.append((pen, round(t.ty), clean(t.text)))
        pen += t.displaced_tx - t.tx
        prev = t
    return out


def spalte(x: float, hat_rechten_leiter: bool, linker_text: bool) -> int:
    """Spalte eines Textstücks. Vereinzelt beginnt ein Stichwort der rechten Spalte links der Grenze
    (Einrückung im Satz); dann entscheidet die Punktleiter, die immer rechts der Grenze liegt."""
    if hat_rechten_leiter and not linker_text:
        return 1
    return 1 if x >= SPALTENGRENZE else 0


def zeilen(stuecke):
    """Je Spalte und Zeile (y) der zusammengesetzte Text, in Lesereihenfolge links, dann rechts."""
    nach_y = {}
    for x, y, text in stuecke:
        if text.strip():
            nach_y.setdefault(y, []).append((x, text))
    spalten = {0: {}, 1: {}}
    for y, teile in nach_y.items():
        leiter = [x for x, t in teile if set(t.strip()) == {"."}]
        rechts = len(leiter) == 1 and leiter[0] >= SPALTENGRENZE
        links = any(x < 150 for x, _ in teile)
        for x, text in teile:
            spalten[spalte(x, rechts, links)].setdefault(y, []).append((x, text))
    result = []
    for col in (0, 1):
        for y in sorted(spalten[col], reverse=True):
            line = "".join(t for _, t in sorted(spalten[col][y], key=lambda p: p[0]))
            result.append(re.sub(r"\s+", " ", line).strip())
    return result


def eintraege(lines):
    """Fasst die Spaltenzeilen zu (Begriff, Fundstellen) zusammen."""
    result, vorsatz, offen = [], [], False
    gestartet = False
    for line in lines:
        # Kopf der ersten Seite und Seitenzahlen überspringen, Buchstaben-Zwischenüberschriften ("C C") ebenso
        if not gestartet:
            gestartet = bool(BUCHSTABE_PAAR.match(line))
            continue
        if re.fullmatch(r"\d+", line) or BUCHSTABE_PAAR.match(line):
            continue
        m = LEITER.search(line)
        if m:
            begriff = " ".join(vorsatz + [line[: m.start()].strip()])
            fund = line[m.end():].strip()
            vorsatz = []
            result.append([begriff, fund])
            offen = fund.endswith((";", ","))
        elif offen and FUND.match(line):
            result[-1][1] += " " + line
            offen = line.endswith((";", ","))
        else:
            vorsatz.append(line)
    if vorsatz:
        raise SystemExit(f"Nicht zugeordnete Zeile: {vorsatz}")
    return [(b, re.sub(r"\s*;\s*", "; ", f).strip().rstrip(";").strip()) for b, f in result]


def main(src: str, dest: str) -> None:
    reader = PdfReader(src)
    lines = []
    for n in range(ERSTE_SEITE, LETZTE_SEITE + 1):
        page = reader.pages[n - 1]
        lines.extend(zeilen(text_stuecke(reader, page)))
    rows = eintraege(lines)
    with open(dest, "w", encoding="utf-8") as f:
        for begriff, fund in rows:
            f.write(f"{begriff}\t{fund}\n")
    print(f"{len(rows)} Einträge → {dest}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
