#!/usr/bin/env python3
"""
bi_to_json.py – Wissensnetz zum Begutachtungsinstrument (BI) nach § 15 SGB XI.

Eingaben (nur Standardbibliothek, kein PDF-Paket nötig):
  source/bi_struktur.json     von Hand übertragene Struktur: Module, Kriterien, Skalen, Formularfelder F1–F9,
                              Bewertungsregeln, Alterstabellen für Kinder (jeweils mit Seitenangabe)
  source/bri_pflege_2026.txt  Textauszug der Begutachtungs-Richtlinien mit Fettdruck-Markierung
                              (erzeugt mit scripts/bri_extract.py)

Ausgabe: data/bi.json mit
  nodes      Knoten mit Kennung "BI:<Ziffer>" (Formular-Ziffern, z. B. BI:4.1.3, BI:5.4, BI:7.3.2)
  edges      Kanten mit Typ, Text und Herkunft (quelle: richtlinie | struktur)
  skalen, module, pflegegrade, abschnitte, meta

Aufruf: python3 scripts/bi_to_json.py [ZIELORDNER]
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STRUKTUR = ROOT / "source" / "bi_struktur.json"
TEXT = ROOT / "source" / "bri_pflege_2026.txt"
ZUORDNUNG = ROOT / "source" / "bi_icf_zuordnung.json"
ICF_DATA = ROOT / "data" / "icf_flat.json"

# Seitenbereiche der Erläuterungskapitel (Kapitel 5 Erwachsene, Kapitel 6 Kinder)
ERWACHSENE = range(39, 145)
KINDER = range(145, 221)
GRUNDLAGEN = range(11, 39)

LEVEL_MARKS = {
    "selbstaendigkeit": ["Selbständig", "Überwiegend selbständig", "Überwiegend unselbständig", "Unselbständig"],
    "faehigkeit": [
        "Fähigkeit vorhanden",
        "Fähigkeit größtenteils vorhanden",
        "Fähigkeit in geringem Maße vorhanden",
        "Fähigkeit nicht vorhanden",
    ],
    "sonde": [
        "Selbständig",
        "Nicht täglich, nicht auf Dauer",
        "Täglich, zusätzlich zu oraler Ernährung",
        "Ausschließlich oder nahezu ausschließlich",
    ],
}
LEVEL_MARKS["diaet"] = LEVEL_MARKS["selbstaendigkeit"]

# In der fetten Schrift des PDFs fehlen Bindestriche in der Textebene (z. B. "Greif, Steh und Gehfunktionen",
# "PortVersorgung", Silbentrennung "Men schen"). Diese Stellen werden hier wortgetreu nach dem gedruckten Text ergänzt.
KORREKTUREN = {
    "Men schen": "Menschen",
    "Beob achtungen": "Beobachtungen",
    "zu ver stehen": "zu verstehen",
    "Maß nahmen": "Maßnahmen",
    "Vor schrift": "Vorschrift",
    "ziel gerichtet": "zielgerichtet",
    "zielgerich tet": "zielgerichtet",
    "Sozialversicherungs trägern": "Sozialversicherungsträgern",
    "Hilfs mitteln": "Hilfsmitteln",
    "Pulverinha latoren": "Pulverinhalatoren",
    "Greif, Steh und Gehfunktionen": "Greif-, Steh- und Gehfunktionen",
    "Hals und Brustbereich": "Hals- und Brustbereich",
    "Dusch und Wannenbades": "Dusch- und Wannenbades",
    "TShirt": "T-Shirt",
    "an und ausziehen": "an- und ausziehen",
    "Blasen oder Darmentleerung": "Blasen- oder Darmentleerung",
    "Inkontinenz und Stomasysteme": "Inkontinenz- und Stomasysteme",
    "Augen, Ohren, oder Nasentropfen beziehungsweise spray": "Augen-, Ohren- oder Nasentropfen beziehungsweise -spray",
    "PortVersorgung": "Port-Versorgung",
    "Kälte und Wärmeanwendungen": "Kälte- und Wärmeanwendungen",
    "An oder Ablegen": "An- oder Ablegen",
    "zeit als auch technikintensiv": "zeit- als auch technikintensiv",
    "TagNachtRhythmus": "Tag-Nacht-Rhythmus",
    "Ruhe und Schlafphasen": "Ruhe- und Schlafphasen",
    "ein und auszusteigen": "ein- und auszusteigen",
    "unter schieden": "unterschieden",
    # Fettdruck S. 133–135, 212–214: "Hilfs- und Pflegehilfsmitteleinsatz", "Hilfs- und Pflegehilfsmitteln"
    "Hilfs und Pflegehilfsmittel": "Hilfs- und Pflegehilfsmittel",
    # Fettdruck S. 50, 88, 135, 194, 214 u. a.: "krankheits- oder therapiebedingt…"
    "krankheits oder therapie": "krankheits- oder therapie",
    # Ergänzungsstrich am Zeilenende (S. 135: "krankheits-" / "oder therapiebedingten") wurde als Trennstrich gelesen
    "krankheitsoder therapie": "krankheits- oder therapie",
}

ALTERSHINWEIS = re.compile(
    r"((?:Bei Kindern (?:unter|im Alter)[^.]*?(?:ist|sind) eine Beurteilung nicht erforderlich|Eine Beurteilung ist bei Kindern altersunabhängig immer erforderlich|(?:Dieses Modul )?[Ee]ntfällt bei Kindern[^.]*|Bei Kindern im Alter bis zu 18 Monaten werden die Kriterien[^.]*ersetzt)\.?)"
)


# Fett gesetzte Zwischenüberschriften, die keine Definition sind
ZWISCHENTITEL = {"Bewertung der Selbständigkeit", "Angaben zur Versorgung", "Bewertung", "Allgemeines"}


def korrigieren(text):
    for alt, neu in KORREKTUREN.items():
        text = text.replace(alt, neu)
    return text

RUNNING_HEADERS = (
    "Erläuterungen zum Gutachten",
    "Feststellung der Pflegebedürftigkeit bei Kindern",
    "Inhaltsverzeichnis",
    "Formulargutachten Erwachsene",
    "Formulargutachten Kinder",
)


def fold(text: str) -> str:
    text = text.lower().replace("ß", "ss")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", text)


def load_pages():
    pages, current = {}, None
    for line in TEXT.read_text(encoding="utf-8").splitlines():
        m = re.match(r"=====SEITE (\d+)=====", line)
        if m:
            current = int(m[1])
            pages[current] = []
            continue
        pages[current].append(line)
    for n, lines in pages.items():
        # Seitenzahl und Kopfzeilen entfernen
        cleaned = []
        for i, line in enumerate(lines):
            plain = line.replace("**", "").strip()
            if i < 3 and (plain == str(n) or any(plain.startswith(h) for h in RUNNING_HEADERS)):
                continue
            cleaned.append(line)
        pages[n] = cleaned
    return pages


def join_lines(lines):
    """Zeilen zu Fließtext verbinden; Trennstriche am Zeilenende auflösen."""
    out = ""
    for raw in lines:
        line = raw.replace("**", "")
        stripped = line.strip()
        if not stripped:
            continue
        if not out:
            out = stripped
            continue
        if re.search(r"\w ?-$", out) and not out.endswith("- ") and stripped[:1].islower():
            out = re.sub(r" ?-$", "", out) + stripped  # "Hilfsmit-" + "teln", "sons -" + "tigen"
        else:
            out = out.rstrip() + " " + stripped
        out = out.rstrip(" ") if not line.endswith("- ") else out
    out = re.sub(r"\s+", " ", out).strip()
    return korrigieren(out)


def paragraphs(lines):
    """Text in Absätze teilen: neuer Absatz bei Aufzählungszeichen oder wenn die Vorzeile mit Satzende kurz ist."""
    paras, cur = [], []
    for line in lines:
        plain = line.replace("**", "").strip()
        if not plain:
            continue
        starts_item = plain.startswith("→") or plain.startswith("•")
        prev = cur[-1].replace("**", "").rstrip() if cur else ""
        if cur and (starts_item or (prev.endswith((".", ":")) and len(prev) < 70)):
            paras.append(join_lines(cur))
            cur = []
        cur.append(line)
    if cur:
        paras.append(join_lines(cur))
    return [p for p in paras if p]


REF = re.compile(r"\b(K?F)\s?(\d+(?:\s?\.\s?(?:\d+|[A-Z]\b))+)")


def refs_in(text):
    found = []
    for m in REF.finditer(text):
        nr = re.sub(r"\s", "", m[2])
        if nr not in found:
            found.append(nr)
    return found


ABGRENZUNG = re.compile(
    r"(zu berücksichtigen|zu bewerten|zu erfassen|erfasst|berücksichtigt|abzugrenzen|nur dort|nur unter|gehört|zugeordnet)",
    re.I,
)


def sentences_with(text, nr):
    pattern = re.compile(r"K?F\s?" + r"\s?\.\s?".join(map(re.escape, nr.split("."))) + r"(?![\d])")
    parts = re.split(r"(?<=[.;])\s+(?=[A-ZÄÖÜ])", text)
    return [s for s in parts if pattern.search(s)]


# ---------------------------------------------------------------------------
# Blöcke mit Überschrift "[F x.y.z] Titel" bzw. "[KF x.y.z] Titel" einsammeln
# ---------------------------------------------------------------------------

BRACKET = re.compile(r"^(?:\d+(?:\.\d+)*\s+)?\[\s*(K?F)\s*([^\]]+?)\s*\]\s*(.*)$")


def chapter_headings(pages):
    """Kapitelnummern aus dem Inhaltsverzeichnis (S. 4–9)."""
    toc = {}
    for n in range(4, 10):
        text = " ".join(l.replace("**", "") for l in pages[n])
        for m in re.finditer(r"(?<![\d.])(\d\.\d+(?:\.\d+)?)\s+(?:\[\s*K?F[^\]]*\]\s*)?([A-ZÄÖÜ][^.\[]+?)\s*\.{3,}\s*(\d+)", text):
            toc[m[1]] = (re.sub(r"\s+", " ", m[2]).strip(), int(m[3]))
    return toc


def collect_blocks(pages, page_range, toc):
    blocks, cur = [], None
    chapter_re = re.compile(r"^(\d\.\d+(?:\.\d+)?)\s{1,3}(?!\[)([A-ZÄÖÜ].*)$")
    for n in page_range:
        for line in pages[n]:
            plain = line.replace("**", "").strip()
            m = BRACKET.match(plain)
            ch = chapter_re.match(plain)
            if m:
                variant = "kinder" if m[1] == "KF" else "erwachsene"
                nr = re.sub(r"\s", "", m[2])
                cur = {"variant": variant, "nr": nr, "seite": n, "lines": [], "header": line}
                blocks.append(cur)
            elif ch and ch[1] in toc and abs(toc[ch[1]][1] - n) <= 1:
                cur = {"variant": None, "chapter": ch[1], "nr": None, "seite": n, "lines": [], "header": line}
                blocks.append(cur)
            elif cur is not None:
                cur["lines"].append(line)
    return blocks


def strip_heading_continuation(header_line, lines, titles):
    """Mehrzeilige Kapitelüberschriften: Folgezeilen der Überschrift abtrennen.

    Nicht fett gesetzte Überschriften wie "5.5.2 [F 1.2] Pflegerelevante Vorgeschichte (Anamnese), medizini-" /
    "sche und pflegerische Angaben …" laufen über mehrere Zeilen. Die Folgezeilen gehören zur Überschrift,
    nicht zum ersten Absatz. Abgetrennt wird nur, wenn Kopfzeile und Folgezeilen zusammen genau einen der
    bekannten Titel (Inhaltsverzeichnis oder Struktur) ergeben.
    """
    raw = header_line.strip()
    plain = raw.replace("**", "").strip()
    m = BRACKET.match(plain)
    head = m[3] if m else re.sub(r"^\d+(?:\.\d+)*\s+", "", plain)
    targets = [fold(t) for t in titles if t]
    acc = fold(head)
    if not acc or not targets or acc in targets:
        return lines
    # Fett gesetzte Überschrift: unmittelbar folgende reine Fettzeilen gehören zur Überschrift
    if raw.startswith("**"):
        end = 0
        for i, line in enumerate(lines):
            st = line.strip()
            if st.startswith("**") and st.endswith("**") and st.count("**") == 2:
                end = i + 1
            else:
                break
        return lines[end:]
    # Normale Schrift: Folgezeilen, solange sie den Titel fortsetzen. Steht im Formular noch ein Zusatz
    # (z. B. "… Rehabilitation erforderlich"), reicht es, wenn der größte Teil des Titels erreicht ist.
    best = None
    for i, line in enumerate(lines[:4]):
        part = fold(line.replace("**", ""))
        if not part:
            continue
        acc += part
        if acc in targets:
            return lines[i + 1 :]
        if not any(t.startswith(acc) for t in targets):
            break
        if any(len(acc) >= 0.8 * len(t) for t in targets if t.startswith(acc)):
            best = i + 1
    return lines[best:] if best else lines


def chapter_number(header_line):
    m = re.match(r"^(\d\.\d+(?:\.\d+)?)\s", header_line.replace("**", "").strip())
    return m[1] if m else None


def split_title(header_line, lines, title):
    """Fett gedruckte Zeilen nach der Überschrift: Titel abtrennen, Rest ist die verbindliche Definition."""
    bold = []
    rest_start = 0
    head = BRACKET.match(header_line.replace("**", "").strip())[3]
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("**") and s.endswith("**") and s.count("**") == 2:
            bold.append(s[2:-2].strip())
            rest_start = i + 1
        elif not s:
            continue
        else:
            break
    combined = join_lines([head] + bold)
    # Titel (aus der Struktur) vom Anfang abschneiden – zeichenweise mit gefaltetem Vergleich
    for alt in (title, title.replace("3 Stunden", "drei Stunden"), title.replace(" sowie ", " oder ")):
        definition = _cut_title(combined, alt)
        if definition is not None:
            return definition, lines[rest_start:]
    return "", lines


def _cut_title(combined, title):
    target, i = fold(title), 0
    consumed = 0
    for j, c in enumerate(combined):
        if i >= len(target):
            break
        if fold(c) == "":
            consumed = j + 1
            continue
        if fold(c) == target[i : i + len(fold(c))]:
            i += len(fold(c))
            consumed = j + 1
        else:
            break
    if i < len(target):
        return None  # Titel stimmt nicht überein
    return re.sub(r"^[\s:–\-)?.]+", "", combined[consumed:]).strip()


def split_levels(lines, scale):
    marks = LEVEL_MARKS.get(scale)
    if not marks:
        return paragraphs(lines), {}
    pattern = re.compile(r"^\s*(" + "|".join(re.escape(m) for m in sorted(marks, key=len, reverse=True)) + r")(?:/unbeeinträchtigt)?\s*:\s*(.*)$")
    intro, levels, current = [], {}, None
    for line in lines:
        m = pattern.match(line.replace("**", ""))
        if m:
            current = marks.index(m[1])
            levels[current] = [m[2]] if m[2].strip() else []
            continue
        (levels[current] if current is not None else intro).append(line)
    return paragraphs(intro), {k: join_lines(v) for k, v in levels.items()}


# ---------------------------------------------------------------------------
# Aufbau
# ---------------------------------------------------------------------------


def option_tuple(o):
    key, label = o[0], o[1]
    nur = o[2] if len(o) > 2 else None
    relevant = o[3] if len(o) > 3 else None
    return key, label, nur, relevant


def build():
    s = json.loads(STRUKTUR.read_text(encoding="utf-8"))
    pages = load_pages()
    toc = chapter_headings(pages)
    nodes, edges = {}, []

    def add(node):
        nodes[node["id"]] = node
        parent = node.get("parent")
        if parent:
            nodes[parent].setdefault("children", []).append(node["id"])
        return node

    def edge(frm, to, typ, text=None, quelle="struktur", **extra):
        if frm == to:
            return
        e = {"from": frm, "to": to, "type": typ, "quelle": quelle}
        if text:
            e["text"] = text
        e.update(extra)
        edges.append(e)

    add({"id": "BI", "art": "instrument", "titel": s["meta"]["instrument"], "children": []})

    # Formularfelder (Kopf, F1–F3, Angaben in Modul 4/5, F5–F9)
    felder = s["formular"]["felder"]

    def parent_of(nr):
        if nr in ("K",) or re.fullmatch(r"\d", nr):
            return "BI"
        if nr.startswith("K."):
            return "BI:K"
        base = re.sub(r"\.[A-Z]\d?$", "", nr)  # 1.2.R → 1.2, 4.4.V2 → 4.4, 7.3.2.G → 7.3.2
        if base != nr:
            return "BI:" + base
        return "BI:" + nr.rsplit(".", 1)[0]

    # Module und Kriterien zuerst als Knoten vorbereiten, damit Formularfelder unter Modulen hängen können
    def add_field(f):
        node = {
            "id": "BI:" + f["nr"],
            "art": "abschnitt" if f["typ"] == "abschnitt" else ("kriterium" if f["typ"] == "kriterium" else "feld"),
            "titel": f["titel"],
            "parent": parent_of(f["nr"]),
            "typ": f["typ"],
            "quelle": {k: f[k] for k in ("seite", "seite_kinder", "seite_text") if k in f},
        }
        for k in ("titel_kinder", "zusatz", "nur", "skala", "steuert"):
            if k in f:
                node[k] = f[k]
        if "kinder" in f:
            node["hinweis_kinder"] = f["kinder"]
        if f["nr"].startswith("6."):
            node["punktrelevant"] = False
        if "optionen" in f:
            node["optionen"] = []
            for o in f["optionen"]:
                key, label, nur, relevant = option_tuple(o)
                opt = {"wert": key, "label": label}
                if nur:
                    opt["nur"] = nur
                if relevant is not None:
                    opt["kriterium_relevant"] = relevant
                node["optionen"].append(opt)
        add(node)

    module_after = {"4": []}
    for f in felder:
        if f["nr"] == "4":
            add_field(f)
            break
        add_field(f)

    # Module 1–6
    for m in s["module"]:
        mid = f"BI:4.{m['nr']}"
        add({
            "id": mid,
            "art": "modul",
            "modul": m["nr"],
            "titel": f"Modul {m['nr']}: {m['titel']}",
            "parent": "BI:4",
            "gewichtung_prozent": m["gewichtung"],
            "skala": m["skala"],
            "schwellen": [{"von": a, "bis": b, "gewichtete_punkte": w} for a, b, w in m["schwellen"]],
            "quelle": {"seite": m["seite"], "seite_kinder": m["seite_kinder"]},
            **{k: m[k] for k in ("hinweis_gewichtung", "besonderheit", "altersunabhaengig", "gruppen") if k in m},
        })
        for k in m["kriterien"]:
            node = {
                "id": f"BI:{k['nr']}",
                "art": "kriterium",
                "modul": m["nr"],
                "titel": k["titel"],
                "parent": mid,
                "skala": k.get("skala", m["skala"]),
                "punktrelevant": k.get("punktrelevant", True),
                "quelle": {kk: k[kk] for kk in ("seite", "seite_kinder") if kk in k},
            }
            for kk in ("faktor", "nur", "gruppe", "punkte_je", "punkte_ja", "sonderregel", "bedingung"):
                if kk in k:
                    node[kk] = k[kk]
            if "alter" in k or "beurteilung_ab_monaten" in k:
                node["kinder"] = {}
                if "beurteilung_ab_monaten" in k:
                    node["kinder"]["beurteilung_ab_monaten"] = k["beurteilung_ab_monaten"]
                if "alter" in k:
                    node["kinder"]["altersentsprechend"] = [{"ab_monaten": a, "stufe": st} for a, st in k["alter"]]
            add(node)

    for f in felder[felder.index(next(x for x in felder if x["nr"] == "4")) + 1 :]:
        add_field(f)

    # Angaben-Felder in Modul 4/5 steuern Kriterien
    for n in nodes.values():
        if n.get("steuert"):
            edge(n["id"], "BI:" + n["steuert"], "steuert",
                 "Die Angabe entscheidet, ob das Kriterium in die Summe des Moduls eingeht.", seite=n["quelle"].get("seite"))

    # Strukturkanten aus den Bewertungsregeln
    edge("BI:4.2", "BI:4.3", "hoeherer_wert", "Aus den Modulen 2 und 3 geht nur der höhere gewichtete Punktwert ein (§ 15 Absatz 3 Satz 2 SGB XI).", seite=96)
    edge("BI:4.3", "BI:4.2", "hoeherer_wert", "Aus den Modulen 2 und 3 geht nur der höhere gewichtete Punktwert ein (§ 15 Absatz 3 Satz 2 SGB XI).", seite=96)
    for i in range(1, 14):
        edge("BI:4.4.0", f"BI:4.4.{i}", "ersetzt", "Bei Kindern im Alter bis zu 18 Monaten ersetzt die Frage 4.4.0 die Kriterien 4.4.1 bis 4.4.13.", seite=268)
    edge("BI:4.1.B", "BI:5.1", "bestimmt", "Besondere Bedarfskonstellation führt unabhängig von den Gesamtpunkten zu Pflegegrad 5.", seite=98)
    for m in s["module"]:
        edge(f"BI:4.{m['nr']}", "BI:5.1", "bestimmt", f"Gewichtete Punkte von Modul {m['nr']} ({m['gewichtung']} %) gehen in die Gesamtpunkte ein.", seite=96)
    edge("BI:5.2", "BI:1.4", "uebernahme", "Übernahme aus 1.4 (Angaben zu Pflegepersonen).", seite=243)
    edge("BI:7.2", "BI:7.2.1", "weiter_mit", "Ja: weiter mit 7.2.1.", seite=248)
    edge("BI:7.3.1", "BI:7.3.2", "weiter_mit", "Ja: weiter mit 7.3.2.", seite=248)
    edge("BI:7.3.2", "BI:7.3.2.G", "weiter_mit", "Nein: Gründe für fehlende Rehabilitationsfähigkeit angeben.", seite=249)
    edge("BI:7.3.4", "BI:8.8", "verweis", "Beratung zur Umsetzung der empfohlenen Leistung zur medizinischen Rehabilitation.", seite=251)

    # Texte aus der Richtlinie zuordnen
    abschnitte = {}
    for prange in (GRUNDLAGEN, ERWACHSENE, KINDER):
        for b in collect_blocks(pages, prange, toc):
            if b.get("chapter"):
                ch = b["chapter"]
                title = toc[ch][0]
                text = paragraphs(strip_heading_continuation(b["header"], b["lines"], [title]))
                if ch in abschnitte:
                    abschnitte[ch]["absaetze"] += text
                else:
                    abschnitte[ch] = {"kapitel": ch, "titel": title, "seite": b["seite"], "absaetze": text}
                continue
            nid = "BI:" + b["nr"]
            node = nodes.get(nid)
            if node is None:
                continue
            variant = b["variant"]
            is_criterion = node["art"] == "kriterium"
            definition, rest = split_title(b["header"], b["lines"], node["titel"])
            if not is_criterion:
                # Abschnitte und Felder haben keine verbindliche Definition: Fettzeilen bleiben Hinweistext.
                # Folgezeilen einer mehrzeiligen Überschrift gehören nicht zum Hinweistext.
                ch = chapter_number(b["header"])
                titles = [node["titel"]] + ([toc[ch][0]] if ch in toc else [])
                lines = strip_heading_continuation(b["header"], b["lines"], titles)
                rest = lines if not definition or lines is not b["lines"] else [definition] + rest
                definition = ""
            alters = []
            if definition:
                alters += [m[1] for m in ALTERSHINWEIS.finditer(definition)]
                definition = ALTERSHINWEIS.sub("", definition).strip()
            if is_criterion and not definition:
                # Definition steht nicht direkt unter der Überschrift (z. B. 4.1.B): erste reine Fettzeilen im Block
                start = end = None
                for i, line in enumerate(rest):
                    st = line.strip()
                    full_bold = st.startswith("**") and st.endswith("**") and st.count("**") == 2
                    inner = st[2:-2].strip() if full_bold else ""
                    if full_bold and not ALTERSHINWEIS.fullmatch(inner) and inner not in ZWISCHENTITEL:
                        start = i if start is None else start
                        end = i + 1
                    elif start is not None and st:
                        break
                if start is not None:
                    definition = join_lines(rest[start:end])
                    rest = rest[:start] + rest[end:]
            intro, levels = split_levels(rest, node.get("skala"))
            hinweise = []
            for para in intro:
                alters += [m[1] for m in ALTERSHINWEIS.finditer(para)]
                para = ALTERSHINWEIS.sub("", para).strip()
                if para and not (definition and fold(para) == fold(definition)):
                    hinweise.append(para)
            texte = node.setdefault("texte", {}).setdefault(variant, {})
            if definition:
                texte["definition"] = definition
            if alters:
                texte.setdefault("hinweis_alter", [])
                texte["hinweis_alter"] += [a for a in alters if a not in texte["hinweis_alter"]]
            if hinweise:
                texte.setdefault("hinweise", []).extend(hinweise)
            if levels:
                texte["auspraegungen"] = {str(k): v for k, v in sorted(levels.items())}
            texte.setdefault("seite", b["seite"])

    # Verweise in den Texten → Kanten (Abgrenzung oder Verweis)
    def texts_of(node):
        for variant, t in node.get("texte", {}).items():
            for p in t.get("hinweise", []):
                yield variant, p
            if t.get("definition"):
                yield variant, t["definition"]
            for v in t.get("auspraegungen", {}).values():
                yield variant, v

    seen = set()
    for node in list(nodes.values()):
        for variant, text in texts_of(node):
            for nr in refs_in(text):
                target = "BI:" + nr
                if target not in nodes or target == node["id"]:
                    continue
                for sentence in sentences_with(text, nr) or [text]:
                    typ = "abgrenzung" if ABGRENZUNG.search(sentence) else "verweis"
                    key = (node["id"], target, typ, sentence)
                    if key in seen:
                        continue
                    seen.add(key)
                    edge(node["id"], target, typ, sentence, quelle="richtlinie", variante=variant,
                         seite=node["texte"][variant].get("seite"))

    # Kapitel-Abschnitte mit F-Knoten verbinden (über die Seitenangabe des Erläuterungstextes)
    for n in nodes.values():
        st = n.get("quelle", {}).get("seite_text")
        if st:
            hits = [k for k, a in abschnitte.items() if a["seite"] == st]
            if hits:
                n["abschnitte"] = hits

    # Kuratierte Zuordnung BI → ICF (eigene Kantenschicht, quelle "kuratiert"), gegen die ICF-Daten geprüft
    z = json.loads(ZUORDNUNG.read_text(encoding="utf-8"))
    icf = json.loads(ICF_DATA.read_text(encoding="utf-8"))
    icf_edges = 0
    for entry in z["zuordnungen"]:
        nid = "BI:" + entry["bi"]
        if nid not in nodes:
            raise SystemExit(f"Zuordnung: unbekanntes BI-Kriterium {entry['bi']}")
        for m in entry["icf"]:
            code = m["code"]
            if code not in icf:
                raise SystemExit(f"Zuordnung {entry['bi']}: ICF-Code {code} existiert nicht in der ICF 2005")
            if m["beziehung"] not in z["beziehungen"]:
                raise SystemExit(f"Zuordnung {entry['bi']}: unbekannte Beziehung {m['beziehung']}")
            edge(nid, "ICF:" + code, "icf_" + m["beziehung"], m["begruendung"], quelle="kuratiert",
                 icf_titel=icf[code]["preferred"])
            icf_edges += 1
    icf_meta = {k: z[k] for k in ("stand", "icf_fassung", "beziehungen", "beurteilungsmerkmale")}
    print(f"ICF-Zuordnungen: {icf_edges} Kanten zu {len({e['to'] for e in edges if e['to'].startswith('ICF:')})} ICF-Codes")

    # Zahlen fürs Protokoll
    crit = [n for n in nodes.values() if n["art"] == "kriterium" and n.get("modul")]
    with_def = [n for n in crit if any(t.get("definition") for t in n.get("texte", {}).values())]
    with_levels = [n for n in crit if any(t.get("auspraegungen") for t in n.get("texte", {}).values())]
    print(f"Knoten: {len(nodes)}, Kanten: {len(edges)}, Kapitelabschnitte: {len(abschnitte)}")
    print(f"Kriterien in Modulen: {len(crit)}, mit Definition: {len(with_def)}, mit Ausprägungstexten: {len(with_levels)}")

    return {
        "meta": s["meta"],
        "formular": {k: v for k, v in s["formular"].items() if k != "felder"},
        "skalen": s["skalen"],
        "pflegegrade": s["pflegegrade"],
        "nodes": nodes,
        "edges": edges,
        "abschnitte": abschnitte,
        "icf_zuordnung": icf_meta,
    }


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data"
    data = build()
    dest = out_dir / "bi.json"
    dest.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"→ {dest} ({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
