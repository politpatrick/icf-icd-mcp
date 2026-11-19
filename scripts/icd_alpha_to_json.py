#!/usr/bin/env python3
"""icd_alpha_to_json.py

Export des Alphabetischen Verzeichnisses der ICD-10-GM (EDV-Fassung TXT, BfArM) nach JSON für den MCP-Server,
ergänzt um die Orpha-Kennnummern aus der Datei Alpha-ID-SE:
  icd10gm_alpha.json – Einträge mit Kodes (ohne Kennzeichen †/*/!), bei Kombinationen zusätzlich die Kodefolge
                       mit den Kennzeichen des Alphabets (k, + als †), Text und ggf. Orpha-Kennnummer,
                       dazu die reinen Verweissätze (Art 0) als Text.

Beide Dateien sind |-getrennt mit 8 Feldern (siehe Liesmich-Dateien des BfArM). Verknüpft wird über die
laufende Nummer: Alphabet-Feld 2 "109254" entspricht der Alpha-ID "I109254". Gestrichene Alpha-IDs
(Gültigkeit 0) und das Druckkennzeichen werden nicht übernommen, Texte unverändert. Gültige Einträge der Alpha-ID-SE,
die das Alphabet nicht enthält, werden ergänzt und mit "q": 1 gekennzeichnet.
Alle Kodes werden gegen icd10gm.json (Systematik) geprüft; unbekannte Einträge werden ausgelassen und gemeldet.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List

MARKS = re.compile(r"[+*!†]$")
COMBINED_ART = {"2", "3", "4", "6"}  # Kreuz-Stern, mit Zusatzkode, zwei Primärkodes
STAND = re.compile(r"_(\d{4})(\d{2})(\d{2})\.txt$")


def records(path: Path) -> List[List[str]]:
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        fields = line.split("|")
        if len(fields) != 8:
            sys.exit(f"❌ {path.name}, Zeile {number}: {len(fields)} statt 8 Felder")
        rows.append(fields)
    return rows


def plain(code: str) -> str:
    return MARKS.sub("", code.strip())


def art_of(p: str, s: str, z: str, p2: str) -> str:
    """Art der Kodierung nach der Datensatzbeschreibung des Alphabets (1–6) aus den belegten Kodefeldern."""
    if p2:
        return "6"
    if s and z:
        return "4"
    if s:
        return "2"
    if p and z:
        return "3"
    if z:
        return "5"
    return "1"


def build(alpha_txt: Path, alphase_txt: Path, known: set) -> dict:
    orpha: Dict[str, int] = {}
    se_valid: Dict[str, List[str]] = {}
    for valid, alpha_id, p, s, z, p2, orpha_nr, text in records(alphase_txt):
        if valid != "1":
            continue
        nr = alpha_id.removeprefix("I")
        se_valid[nr] = [p, s, z, p2, text]
        if orpha_nr:
            orpha[nr] = int(orpha_nr)

    entries, verweise, unknown = [], [], []
    alphabet_ids = set()

    def add(nr: str, art: str, p: str, s: str, z: str, p2: str, text: str, from_se: bool) -> None:
        entry = {"id": int(nr), "art": int(art)}
        for key, value in (("p", p), ("s", s), ("z", z), ("p2", p2)):
            if value:
                entry[key] = plain(value)
        codes = [entry[k] for k in ("p", "s", "z", "p2") if k in entry]
        missing = [c for c in codes if c not in known]
        if missing or not codes:
            unknown.append(f"{nr}: {text} ({', '.join(missing) or 'ohne Kode'})")
            return
        if art in COMBINED_ART:
            entry["k"] = " ".join(v.strip().replace("+", "†") for v in (p, s, z, p2) if v)
        if nr in orpha:
            entry["o"] = orpha[nr]
        if from_se:
            entry["q"] = 1  # nur in der Datei Alpha-ID-SE, nicht im Alphabetischen Verzeichnis
        entry["t"] = text
        entries.append(entry)

    for art, nr, _druck, p, s, z, p2, text in records(alpha_txt):
        if art == "0":
            verweise.append(text)
            continue
        alphabet_ids.add(nr)
        add(nr, art, p, s, z, p2, text, False)

    # Gültige Einträge der Alpha-ID-SE, die das Alphabetische Verzeichnis (noch) nicht enthält.
    # Die Art der Kodierung wird aus den belegten Feldern bestimmt (Feldbeschreibung wie im Alphabet).
    for nr, (p, s, z, p2, text) in se_valid.items():
        if nr not in alphabet_ids:
            add(nr, art_of(p, s, z, p2), p, s, z, p2, text, True)

    if unknown:
        print(f"⚠️  {len(unknown)} Alphabet-Einträge mit unbekanntem Kode ausgelassen, z. B.:", file=sys.stderr)
        for line in unknown[:10]:
            print(f"   {line}", file=sys.stderr)

    match = STAND.search(alpha_txt.name)
    return {
        "meta": {
            "version": re.search(r"icd10gm(\d{4})", alpha_txt.name).group(1),
            "stand": f"{match.group(3)}.{match.group(2)}.{match.group(1)}" if match else None,
            "quellen": [alpha_txt.name, alphase_txt.name],
            "alphaidse": f"Alpha-ID-SE {re.search(r'(\d{4})', alphase_txt.name).group(1)}",
        },
        "entries": entries,
        "verweise": verweise,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Alphabetisches Verzeichnis + Alpha-ID-SE nach JSON")
    parser.add_argument("alphabet", type=Path, help="icd10gm…alpha_edvtxt_….txt")
    parser.add_argument("alphaidse", type=Path, help="…alphaidse…_edvtxt_….txt")
    parser.add_argument("target_dir", type=Path, help="Zielordner mit icd10gm.json")
    args = parser.parse_args()

    known = set(json.loads((args.target_dir / "icd10gm.json").read_text(encoding="utf-8"))["codes"])
    out = build(args.alphabet, args.alphaidse, known)
    (args.target_dir / "icd10gm_alpha.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    with_orpha = sum(1 for e in out["entries"] if "o" in e)
    from_se = sum(1 for e in out["entries"] if e.get("q"))
    print(f"{len(out['entries'])} Einträge (davon {from_se} nur aus der Alpha-ID-SE), {len(out['verweise'])} Verweise, {with_orpha} mit Orpha nach {args.target_dir} exportiert")


if __name__ == "__main__":
    main()
