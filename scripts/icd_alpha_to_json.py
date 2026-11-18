#!/usr/bin/env python3
"""icd_alpha_to_json.py

Export des Alphabetischen Verzeichnisses der ICD-10-GM (EDV-Fassung TXT, BfArM) nach JSON für den MCP-Server,
ergänzt um die Orpha-Kennnummern aus der Datei Alpha-ID-SE:
  icd10gm_alpha.json – Einträge mit Kodes (ohne Kennzeichen †/*/!), bei Kombinationen zusätzlich die Kodefolge
                       mit den Kennzeichen des Alphabets (k, + als †), Text und ggf. Orpha-Kennnummer,
                       dazu die reinen Verweissätze (Art 0) als Text.

Beide Dateien sind |-getrennt mit 8 Feldern (siehe Liesmich-Dateien des BfArM). Verknüpft wird über die
laufende Nummer: Alphabet-Feld 2 "109254" entspricht der Alpha-ID "I109254". Gestrichene Alpha-IDs
(Gültigkeit 0) und das Druckkennzeichen werden nicht übernommen, Texte unverändert.
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


def build(alpha_txt: Path, alphase_txt: Path, known: set) -> dict:
    orpha: Dict[str, int] = {}
    for valid, alpha_id, *_codes, orpha_nr, _text in records(alphase_txt):
        if valid == "1" and orpha_nr:
            orpha[alpha_id.removeprefix("I")] = int(orpha_nr)

    entries, verweise, unknown = [], [], []
    for art, nr, _druck, p, s, z, p2, text in records(alpha_txt):
        if art == "0":
            verweise.append(text)
            continue
        entry = {"id": int(nr), "art": int(art)}
        for key, value in (("p", p), ("s", s), ("z", z), ("p2", p2)):
            if value:
                entry[key] = plain(value)
        codes = [entry[k] for k in ("p", "s", "z", "p2") if k in entry]
        missing = [c for c in codes if c not in known]
        if missing or not codes:
            unknown.append(f"{nr}: {text} ({', '.join(missing) or 'ohne Kode'})")
            continue
        if art in COMBINED_ART:
            entry["k"] = " ".join(v.strip().replace("+", "†") for v in (p, s, z, p2) if v)
        if nr in orpha:
            entry["o"] = orpha[nr]
        entry["t"] = text
        entries.append(entry)

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
        },
        "entries": entries,
        "verweise": verweise,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Alphabetisches Verzeichnis + Alpha-ID-SE nach JSON")
    parser.add_argument("alphabet", type=Path, help="icd10gm…alpha_edvtxt_….txt")
    parser.add_argument("alphaidse", type=Path, help="icd10gm…_alphaidse_edvtxt_….txt")
    parser.add_argument("target_dir", type=Path, help="Zielordner mit icd10gm.json")
    args = parser.parse_args()

    known = set(json.loads((args.target_dir / "icd10gm.json").read_text(encoding="utf-8"))["codes"])
    out = build(args.alphabet, args.alphaidse, known)
    (args.target_dir / "icd10gm_alpha.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    with_orpha = sum(1 for e in out["entries"] if "o" in e)
    print(f"{len(out['entries'])} Einträge, {len(out['verweise'])} Verweise, {with_orpha} mit Orpha nach {args.target_dir} exportiert")


if __name__ == "__main__":
    main()
