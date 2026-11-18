#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build_data.sh
# Erzeugt data/ aus den ClaML-Quelldateien in source/:
#   icf_flat.json, qualifiers.json  (ICF)
#   icd10gm.json                    (ICD-10-GM)
#   icd10gm_alpha.json              (Alphabetisches Verzeichnis + Alpha-ID-SE, TXT aus source/)
#   bi.json                         (Begutachtungsinstrument SGB XI, aus source/bri_pflege_2026.txt)
#   versmedv.json                   (Versorgungsmedizinische Grundsätze, amtliches XML + Stichwörter K710)
# Aufruf aus beliebigem Ordner: scripts/build_data.sh [ZIEL] [PYTHON]
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

OUT_DIR="${1:-$ROOT_DIR/data}"
PY_CMD="${2:-python3}"
ICF_XML="$ROOT_DIR/source/icf2005syst_claml_20120619.xml"
ICD_XML="$(ls "$ROOT_DIR"/source/icd10gm*syst_claml_*.xml | sort | tail -1)"
ALPHA_TXT="$(ls "$ROOT_DIR"/source/icd10gm*alpha_edvtxt_*.txt | sort | tail -1)"
ALPHASE_TXT="$(ls "$ROOT_DIR"/source/icd10gm*_alphaidse_edvtxt_*.txt | sort | tail -1)"
VMG_XML="$ROOT_DIR/source/versmedv_BJNR241200008.xml"
VMG_TXT="$ROOT_DIR/source/k710_stichwortverzeichnis.txt"

if ! command -v "$PY_CMD" &>/dev/null; then
  echo "❌ Python-Interpreter '$PY_CMD' nicht gefunden." >&2
  exit 1
fi
for f in "$ICF_XML" "$ICD_XML" "$ALPHA_TXT" "$ALPHASE_TXT" "$VMG_XML" "$VMG_TXT"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Quelldatei '$f' nicht gefunden." >&2
    exit 1
  fi
done

printf "ICF: %s\nICD: %s\nZiel: %s\n\n" "$ICF_XML" "$ICD_XML" "$OUT_DIR"
"$PY_CMD" "$SCRIPT_DIR/icf_to_json.py" "$ICF_XML" "$OUT_DIR" --lang de
"$PY_CMD" "$SCRIPT_DIR/icd_to_json.py" "$ICD_XML" "$OUT_DIR"
"$PY_CMD" "$SCRIPT_DIR/icd_alpha_to_json.py" "$ALPHA_TXT" "$ALPHASE_TXT" "$OUT_DIR"
# Begutachtungsinstrument (SGB XI) aus Textauszug und Struktur der BRi; nur Standardbibliothek
"$PY_CMD" "$SCRIPT_DIR/bi_to_json.py" "$OUT_DIR"
# Versorgungsmedizinische Grundsätze (Anlage zu § 2 VersMedV) mit Stichwortverzeichnis K710
"$PY_CMD" "$SCRIPT_DIR/versmedv_to_json.py" "$VMG_XML" "$VMG_TXT" "$OUT_DIR"
