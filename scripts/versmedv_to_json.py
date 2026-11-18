#!/usr/bin/env python3
"""versmedv_to_json.py

Export der Versorgungsmedizinischen Grundsätze (Anlage zu § 2 VersMedV) nach JSON für den MCP-Server:
  versmedv.json – Gliederung der Anlage (Teil A–D) als Knoten mit Kennung "VMG:<Teil> <Nummer>",
                  für Teil B die GdS-Zeilen (Text, Wert wie gedruckt, Pfad der übergeordneten Zeilen)
                  und Sondertabellen, dazu das Stichwortverzeichnis der BMAS-Broschüre K710 mit
                  aufgelösten Kennungen.

Quellen: das amtliche XML von gesetze-im-internet.de (nur die Norm mit <enbez>Anlage</enbez>) und
source/k710_stichwortverzeichnis.txt (Begriff<TAB>Fundstellen, Fundstellen wie gedruckt).

Gliederung:
  - Teil A: nummerierte <P>-Absätze ("1.1 …") und die DL-Liste ab Nr. 4; Buchstaben a), b) … und
    Doppelbuchstaben aa), bb) … werden eigene Knoten ("VMG:A 4b", "VMG:A 5d jj").
  - Teil C und D: DL-Listen mit Nummern ("2.1", "1.") und Buchstaben wie in Teil A.
  - Teil B: Kapitel aus der DL-Liste ("2." Kopf und Gesicht), Abschnitte aus den <U>-Nummern ("2.1").
    Tabellenzeilen werden so eingeordnet:
      * Leerzeile: keine Zelle mit Text.
      * GdS-Zeile: Text und ein Wert, der allein in der letzten Spalte steht.
      * Fließtext: Text, dessen Zelle bis in die letzte Spalte reicht (volle Breite); Text außerhalb
        von Tabellen ebenso.
      * Zwischenstufe: Text ohne Wert, der nicht die volle Breite einnimmt. Die Einrückung ist die erste
        Spalte mit Text. Eine Zwischenstufe gehört in den Pfad der folgenden GdS-Zeilen, bis sie von einer
        Zeile gleicher oder geringerer Einrückung nach einer Leerzeile oder GdS-Zeile abgelöst wird
        (folgt eine Zeile direkt auf eine Zwischenstufe, bleibt diese bei gleicher Einrückung stehen).
        Abschnittsüberschrift und Fließtext beenden alle Pfade. Eine Zwischenstufe, die nie in einen Pfad
        eingegangen ist, wird als Fließtext übernommen.
      * Eine Zeile in voller Breite ohne Wert ist dennoch Überschrift, wenn die nächste nichtleere Zeile eine
        tiefer eingerückte Wertzeile oder selbst eine solche Überschrift ist (kein Satz mit Schlusspunkt,
        keine Einleitung mit Doppelpunkt, kein Klammerhinweis).
      * Eine GdS-Zeile ist Pfad für direkt folgende tiefer eingerückte GdS-Zeilen (bis zur nächsten Leerzeile).
      * Zwei unbenutzte Zwischenstufen gleicher Einrückung über eine Leerzeile hinweg werden gestapelt.
      * Fälle ohne Merkmal im XML regelt die kuratierte Tabelle OVERRIDES.
    Tabellen mit mehr als vier Spalten oder ohne Spaltenbreiten sind Sondertabellen (Zellen-Arrays).
  - Titel: kurze Überschriften (bis 160 Zeichen, kein Satzende) werden Titel; nummerierte Sätze bleiben
    ohne Titel und stehen als Absatz.

Stichwort-Fundstellen: Leerzeichen sind beliebig ("A5dii" = "A 5d ii"), "," und ";" trennen, "+" ersetzt
die letzten Stellen ("B 14.3+4" → B 14.3, B 14.4), "-" bildet einen Bereich in der letzten Stelle.
Fehlt der genaue Knoten, gilt der tiefste vorhandene Vorfahr (gemeldet); fehlt schon Teil mit erster
Nummer, wird die Fundstelle auf stderr gemeldet und nicht übernommen. Texte bleiben wörtlich
(nur Leerraum normalisiert).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Tuple

TITEL = "Versorgungsmedizinische Grundsätze (Anlage zu § 2 VersMedV)"
K710 = "BMAS, Versorgungsmedizin-Verordnung – VersMedV – Versorgungsmedizinische Grundsätze, Stand Januar 2026"
SKIP = {"FnR", "FnArea", "kommentar", "IMG", "Footnotes"}
STATUS = {"(weggefallen)": "weggefallen", "(aufgehoben)": "aufgehoben"}
NUM_P = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
LETTER = re.compile(r"^([a-z]{1,2})\)$")


# Kuratierte Zuordnung, weil das XML keine unterscheidenden Merkmale trägt (Einrückung, Spaltenverbund und
# Attribute sind bei diesen Zeilen gleich wie bei Geschwisterzeilen). Schlüssel ist die Abschnittsnummer in
# Teil B, "text" ist der wörtliche Anfang einer Zeile dieses Abschnitts aus dem XML. Wirkung:
#   "until": t   – die Zeile bleibt Pfad aller folgenden GdS-Zeilen bis einschließlich der GdS-Zeile, die
#                  wörtlich mit t beginnt (None: bis zum Abschnittsende)
#   "indent": n  – die Zeile gilt als auf Einrückung n stehend (ersetzt so ihre Geschwister-Überschrift)
#   "split": t   – die verschmolzene Zelle endet auf den wörtlichen Text t. Bei einer Zwischenzeile wird t
#                  eigener, tieferer Pfadeintrag (ein "until" gilt dann für t); bei einer GdS-Zeile wird der
#                  Anfang der Zelle Pfadeintrag und t der Zeilentext (ein "until" gilt dann für den Anfang).
# Jeder "text" und jedes "until" muss im Abschnitt genau einmal gefunden werden, sonst bricht der Build ab
# (geänderte Quelle prüfen).
OVERRIDES: Dict[str, List[dict]] = {
    "3.6": [{"text": "Nach dem Abklingen lang dauernder psychotischer Episoden", "until": "sonst"}],
    "4.5": [
        {"text": "Binasale Hemianopsie", "until": "bei Verlust des beidäugigen Sehens"},
        {"text": "Allseitige Einengung binokular", "indent": 1},
        {"text": "Unregelmäßige Gesichtsfeldausfälle, Skotome", "indent": 0},
    ],
    "8.4": [{"text": "GdS während dieser Zeit", "until": None}],
    "9.1.1": [{"text": "3. Leistungsbeeinträchtigung bereits bei alltäglicher leichter Belastung",
               "until": "mit gelegentlich auftretenden, vorübergehend schweren Dekompensationserscheinungen"}],
    "9.2.3": [{"text": "an einer Gliedmaße", "until": "bei Gebrauchsunfähigkeit der ganzen Gliedmaße"}],
    "12.1.4": [
        {"text": "GdS während einer Heilungsbewährung von fünf Jahren nach Entfernung eines Nierenzellkarzinoms",
         "split": "nach Entfernung eines Nierenzellkarzinoms (Hypernephrom)"},
    ],
    "13.1": [
        {"text": "Nach Entfernung eines malignen Penistumors",
         "split": "nach Entfernung im Frühstadium (T1 bis T2) N0 M0",
         "until": "mit vollständiger Entfernung der Corpora cavernosa"},
    ],
    "14.2": [
        {"text": "GdS während einer Heilungsbewährung von zwei Jahren nach Entfernung eines Zervixtumors",
         "split": "nach Entfernung eines Zervixtumors (Mikrokarzinom) im Stadium T1a N0 M0",
         "until": "nach Entfernung eines Korpustumors im Frühstadium"},
        {"text": "GdS während einer Heilungsbewährung von fünf Jahren", "until": None},
    ],
    "16.10": [{"text": "mittelschwere Form - mit 1-5 % AHG",
               "until": "mit häufigen (mehrfach jährlich) ausgeprägten Blutungen"}],
    "17.12": [{"text": "an Händen und/oder Gesicht", "until": "ausgedehnter"}],
    "18.13": [
        {"text": "Extremitätenverlust", "until": "Verlust der ganzen Hand"},
        {"text": "Nervenausfälle (vollständig)", "until": None},
    ],
    "18.14": [{"text": "Ausgeprägte Knorpelschäden der Kniegelenke", "indent": 0}],
}
END = "\x00Abschnittsende"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def events(el: ET.Element) -> List[tuple]:
    """Linearisiert den Mischinhalt eines Elements in Ereignisse (Dokumentreihenfolge).

    ("text", t) Absatz · ("bold", t) hervorgehobener Absatzbeginn (B/SP) · ("U", nr) Abschnittsnummer ·
    ("dt", label) / ("/dd",) Listenpunkt · ("table", element).
    """
    out: List[tuple] = []
    buf: List[str] = []

    def flush() -> None:
        t = norm("".join(buf))
        buf.clear()
        if t:
            out.append(("text", t))

    if el.text:
        buf.append(el.text)
    for c in el:
        tag = c.tag
        if tag in SKIP:
            pass
        elif tag == "BR":
            flush()
        elif tag == "U":
            flush()
            out.append(("U", norm("".join(c.itertext()))))
        elif tag in ("B", "SP") and not norm("".join(buf)):
            out.append(("bold", norm("".join(c.itertext()))))
        elif tag == "DL":
            flush()
            for x in c:
                if x.tag == "DT":
                    out.append(("dt", norm("".join(x.itertext()))))
                elif x.tag == "DD":
                    out.extend(events(x))
                    out.append(("/dd",))
        elif tag == "table":
            flush()
            out.append(("table", c))
        elif tag in ("LA", "P", "DD", "Content", "entry"):
            flush()
            out.extend(events(c))
        else:
            buf.append("".join(c.itertext()))
        if c.tail:
            buf.append(c.tail)
    flush()
    return out


def paragraphs(evs: List[tuple]) -> List[str]:
    """Ereignisse einer Tabellenzelle als Absätze; Listenpunkte erhalten ihr Zeichen ("– …", "a) …")."""
    out: List[str] = []
    prefix = ""
    for ev in evs:
        if ev[0] == "dt":
            prefix = ev[1] + " " if ev[1] else ""
        elif ev[0] in ("text", "bold"):
            out.append(prefix + ev[1])
            prefix = ""
        elif ev[0] == "U":
            out.append(ev[1])
    return out


ABBR = ("z. B.", "u. a.", "d. h.", "einschl.", "sog.", "ggf.", "bzw.", "evtl.", "ca.", "u.", "s.")
FUNCTION_WORDS = {"und", "oder", "und/oder", "der", "die", "das", "des", "dem", "den", "mit", "ohne", "bei",
                  "nach", "von", "vom", "im", "in", "zu", "zur", "zum", "für", "auf", "je", "sowie", "bzw.", "nicht"}


def is_title(t: str) -> bool:
    """Kurze Überschrift ohne Satzende (Abkürzungen wie "z. B." zählen nicht als Satzende)."""
    u = t
    for ab in ABBR:
        u = u.replace(ab, "#")
    return len(t) <= 160 and not u.endswith(".") and not re.search(r"[.!?]\s+[A-ZÄÖÜ]", u)


def open_end(t: str) -> bool:
    """Zeile bricht mitten im Satz um: endet mit Komma oder kleingeschriebenem Wort."""
    last = t.split()[-1] if t.split() else ""
    return t.endswith(",") or bool(re.fullmatch(r"[a-zäöüß][\w/-]*", last))


def is_note(t: str) -> bool:
    """Eingeklammerter Hinweis wie "(bei Begutachtungen im sozialen Entschädigungsrecht …)": keine Überschrift."""
    return t.startswith("(") and t.endswith(")")


def deep_wrap(t: str) -> bool:
    """Überschrift, die in einer tiefer eingerückten Zeile weiterläuft: endet mit Funktionswort oder
    deutscher Flexions-/Adverbendung (z. B. "verbundenen", "einschließlich"), nicht mit Fachbegriff ("vulgaris")."""
    last = t.split()[-1]
    return wrapped(t) or bool(re.fullmatch(r"[a-zäöüß]+(en|er|es|em|lich)", last))


def wrapped(t: str) -> bool:
    """Zwischenzeile, die erkennbar in der nächsten Zeile weiterläuft (Komma oder Funktionswort am Ende)."""
    last = t.split()[-1] if t.split() else ""
    return t.endswith(",") or last in FUNCTION_WORDS


class Builder:
    def __init__(self) -> None:
        self.nodes: Dict[str, dict] = {}
        self.gds_rows = 0
        self.problems: List[str] = []
        self.joins: List[str] = []  # zusammengeführte Umbrüche (Ausgabe mit --verbose)
        self.override_hits: Dict[Tuple[str, str], int] = {}

    # --- Knoten -------------------------------------------------------------------------------
    def add(self, teil: str, nummer: Optional[str], parent: Optional[str], titel: Optional[str] = None) -> dict:
        nid = f"VMG:{teil}" if nummer is None else f"VMG:{teil} {nummer}"
        if nid in self.nodes:
            self.problems.append(f"doppelte Kennung {nid}")
            return self.nodes[nid]
        node = {"id": nid, "teil": teil, "nummer": nummer, "titel": titel, "parent": parent, "children": []}
        self.nodes[nid] = node
        if parent:
            self.nodes[parent]["children"].append(nid)
        return node

    def numbered_parent(self, teil: str, nummer: str) -> str:
        parts = nummer.split(".")
        while len(parts) > 1:
            parts.pop()
            pid = f"VMG:{teil} {'.'.join(parts)}"
            if pid in self.nodes:
                return pid
        return f"VMG:{teil}"

    def add_numbered(self, teil: str, nummer: str) -> dict:
        return self.add(teil, nummer, self.numbered_parent(teil, nummer))

    @staticmethod
    def absatz(node: dict, text: str) -> None:
        if text in STATUS and not node.get("absaetze") and not node.get("status"):
            node["status"] = STATUS[text]
            return
        node.setdefault("absaetze", []).append(text)

    def set_head(self, node: dict, text: str) -> None:
        """Erster Text eines nummerierten Knotens: Titel, Status oder Absatz."""
        if text in STATUS:
            node["status"] = STATUS[text]
        elif is_title(text):
            node["titel"] = text
        else:
            self.absatz(node, text)

    # --- Teil A, C, D -------------------------------------------------------------------------
    def build_acd(self, teil: str, root: dict, blocks: List[ET.Element]) -> None:
        cur = root  # Ziel für Text außerhalb von Listen (Teil A: zuletzt nummerierter Absatz)
        stack: List[dict] = []  # Knoten der offenen Listenpunkte
        head: Optional[dict] = None  # Knoten, dessen Titel noch aussteht
        for block in blocks:
            for ev in events(block):
                kind = ev[0]
                target = stack[-1] if stack else cur
                if kind == "dt":
                    label = ev[1]
                    m = LETTER.match(label)
                    if re.fullmatch(r"\d+(?:\.\d+)*\.?", label):
                        node = self.add_numbered(teil, label.rstrip("."))
                        head = node
                    elif m:
                        letters = m.group(1)
                        sep = " " if len(letters) == 2 else ""
                        node = self.add(teil, f"{target['nummer']}{sep}{letters}", target["id"])
                        head = None
                    else:  # leerer Listenpunkt: Fortsetzung
                        node = target
                        head = None
                    stack.append(node)
                elif kind == "/dd":
                    stack.pop()
                    head = None
                elif kind == "bold" and head is not None:
                    self.set_head(head, ev[1])
                    head = None
                elif kind in ("text", "bold"):
                    text = ev[1]
                    m = NUM_P.match(text) if teil == "A" and not stack else None
                    if m and re.fullmatch(r"\d+(?:\.\d+)*", m.group(1)):
                        cur = self.add_numbered(teil, m.group(1))
                        self.set_head(cur, m.group(2))
                    elif head is not None and kind == "text" and not head.get("titel") and head is target and text in STATUS:
                        self.set_head(head, text)
                    else:
                        self.absatz(target, text)
                    head = None
                elif kind == "table":
                    target.setdefault("tabellen", []).append(special_rows(ev[1]))
                else:
                    self.problems.append(f"Teil {teil}: unerwartetes Ereignis {ev[0]}")

    # --- Teil B -------------------------------------------------------------------------------
    def build_b(self, root: dict, blocks: List[ET.Element]) -> None:
        st = {"cur": root, "head": None, "prefix": "", "pending_u": None}
        self.pfad: List[list] = []  # siehe end_pfad
        self.prev = "other"
        self.pending_head = None
        for block in blocks:
            for ev in events(block):
                kind = ev[0]
                if kind == "dt":
                    label = ev[1]
                    if re.fullmatch(r"\d+\.", label):
                        self.end_pfad(st["cur"])
                        st["cur"] = self.add("B", label.rstrip("."), root["id"])
                        st["head"] = st["cur"]
                    elif label:
                        st["prefix"] = label + " "
                elif kind == "/dd":
                    st["head"] = None
                    st["prefix"] = ""
                elif kind == "bold" and st["head"] is not None:
                    self.set_head(st["head"], ev[1])
                    st["head"] = None
                elif kind == "U":
                    self.end_pfad(st["cur"])
                    st["cur"] = self.add_numbered("B", ev[1])
                    st["pending_u"] = st["cur"]
                elif kind in ("text", "bold"):
                    if st["pending_u"] is not None:
                        self.set_head(st["pending_u"], ev[1])
                        st["pending_u"] = None
                    else:
                        self.end_pfad(st["cur"], keep_sticky=True)
                        self.absatz(st["cur"], st["prefix"] + ev[1])
                    st["prefix"] = ""
                    st["head"] = None
                elif kind == "table":
                    st["pending_u"] = None
                    st["cur"] = self.table_b(st["cur"], ev[1])
        self.end_pfad(st["cur"])

    # Pfadstapel: Einträge [Einrückung, Text, benutzt, Art ("zw"/"gds"), Halten, nach_wert]
    # Halten None = normaler Eintrag; sonst (nur über OVERRIDES gesetzt) bleibt der Eintrag stehen bis zur
    # GdS-Zeile, die mit diesem Text beginnt, bzw. bei END bis zum Abschnittsende.
    def end_pfad(self, node: dict, keep_sticky: bool = False) -> None:
        if keep_sticky:
            self.pop_pfad(node, lambda e: True)
        else:
            for e in reversed(self.pfad):
                if not e[2]:
                    self.absatz(node, e[1])
            self.pfad = []
        self.prev = "other"

    def pop_pfad(self, node: dict, cond) -> None:
        """Entfernt von oben alle Einträge, die cond erfüllen; gehaltene Einträge werden übersprungen."""
        keep_top: List[list] = []
        while self.pfad:
            e = self.pfad[-1]
            if e[4] is not None:
                keep_top.append(self.pfad.pop())
            elif cond(e):
                self.pfad.pop()
                if not e[2]:
                    self.absatz(node, e[1])
            else:
                break
        self.pfad.extend(reversed(keep_top))

    def push(self, indent: int, text: str, kind: str, used: bool = False) -> list:
        e = [indent, text, used, kind, None, self.prev == "gds"]
        self.pfad.append(e)
        return e

    def override(self, cur: dict, text: str) -> Optional[dict]:
        for o in OVERRIDES.get(cur.get("nummer") or "", []):
            if text.startswith(o["text"]):
                self.override_hits[(cur["nummer"], o["text"])] = self.override_hits.get((cur["nummer"], o["text"]), 0) + 1
                return o
        return None

    @staticmethod
    def rows_b(tg: ET.Element, names: List[str], last: int) -> List[dict]:
        rows = []
        for row in tg.iter("row"):
            cells = []  # (start, end, entry)
            pos = 0
            for e in row.findall("entry"):
                st = e.get("namest") or e.get("colname")
                start = names.index(st) if st in names else pos
                en = e.get("nameend")
                end = names.index(en) if en in names else start
                cells.append((start, end, e))
                pos = end + 1
            r = {"gds": "", "texts": [], "full": False}
            for start, end, e in cells:
                paras = paragraphs(events(e))
                if start == last and end == last:
                    r["gds"] = " ".join(paras)
                elif paras:
                    r["texts"].append((start, paras, e))
                    if end == last:
                        r["full"] = True
            r["u"] = next((x for c in cells for x in c[2].iter("U")), None)
            if r["texts"]:
                r["indent"] = min(t[0] for t in r["texts"])
                r["text"] = " ".join(p for _, ps, _ in r["texts"] for p in ps)
            rows.append(r)
        # Vorausschau: Textzeile ohne Wert (auch in voller Breite) ist Überschrift, wenn die nächste nichtleere
        # Zeile eine tiefer eingerückte Wertzeile oder selbst eine solche Überschrift auf gleicher oder tieferer
        # Einrückung ist; Sätze mit Schlusspunkt, Einleitungen mit Doppelpunkt und Klammerhinweise bleiben
        # Fließtext.
        nxt = None
        for r in reversed(rows):
            if r["u"] is not None:
                r["head"] = False
                nxt = None
                continue
            if not r["texts"] and not r["gds"]:
                continue
            r["head"] = bool(
                not r["gds"] and not r["text"].endswith((".", ":")) and not is_note(r["text"]) and nxt is not None and (
                    (nxt["gds"] and nxt["indent"] > r["indent"])
                    or (not nxt["gds"] and nxt["indent"] >= r["indent"] and nxt["head"])
                )
            )
            nxt = r if r["texts"] else None
        return rows

    def table_b(self, cur: dict, table: ET.Element) -> dict:
        tg = table.find("tgroup")
        specs = tg.findall("colspec")
        ncols = int(tg.get("cols"))
        if ncols not in (3, 4) or any(s.get("colwidth") is None for s in specs):
            self.end_pfad(cur, keep_sticky=True)
            cur.setdefault("tabellen", []).append(special_rows(table))
            return cur
        names = [s.get("colname") for s in specs]
        last = ncols - 1
        for r in self.rows_b(tg, names, last):
            gds, texts, full, u = r["gds"], r["texts"], r["full"], r["u"]
            if u is not None:
                self.end_pfad(cur)
                nummer = norm("".join(u.itertext()))
                cur = self.add_numbered("B", nummer)
                paras = [p for _, ps, _ in texts for p in ps]
                if paras and paras[0].startswith(nummer):
                    paras[0] = norm(paras[0][len(nummer):])
                    if not paras[0]:
                        paras.pop(0)
                if paras:
                    if gds:
                        # die nummerierte Zeile trägt einen Wert: sie ist GdS-Zeile, kein Titel
                        cur["titel"] = None
                    else:
                        self.set_head(cur, paras[0])
                    for p in paras[1:]:
                        self.absatz(cur, p)
                    if not gds and len(paras) == 1 and cur.get("titel") and open_end(paras[0]):
                        self.pending_head = (cur, min(t[0] for t in texts), paras[0])
                if gds:
                    if not paras:
                        self.problems.append(f"B {nummer}: Wert {gds!r} ohne Text")
                    else:
                        self.zeile(cur, paras[0], gds, [])
                    self.prev = "gds"
                continue
            pending, self.pending_head = self.pending_head, None
            if not texts and not gds:
                # Leerzeile: Wertzeilen als Elternteil gelten nur für direkt folgende tiefere Wertzeilen
                self.pop_pfad(cur, lambda e: e[3] == "gds")
                self.prev = "blank"
                continue
            if not texts:
                self.problems.append(f"{cur['id']}: Wert {gds!r} ohne Text")
                continue
            indent, text = r["indent"], r["text"]
            ov = self.override(cur, text)
            if ov and "indent" in ov:
                indent = ov["indent"]
            if gds and pending and (indent == pending[1] or (indent > pending[1] and deep_wrap(pending[2]))):
                # Überschrift läuft in dieser Zeile weiter (z. B. B 4.1, B 6.2): Titel und Zeile zusammenführen
                # Die Überschrift ist in Wahrheit die erste GdS-Zeile: kein Titel.
                node = pending[0]
                joined = f"{node['titel']} {text}"
                node["titel"] = None
                self.joins.append(f"{node['id']}: Überschrift läuft in GdS-Zeile weiter → {joined!r}")
                self.zeile(cur, joined, gds, [])
                self.push(indent, joined, "gds", used=True)
                self.prev = "gds"
                continue
            if gds and self.prev == "nogds" and self.pfad and self.pfad[-1][0] == indent \
                    and not self.pfad[-1][2] and self.pfad[-1][4] is None and re.match(r"[a-zäöü]", text) \
                    and (wrapped(self.pfad[-1][1]) or re.match(r"(und|oder|und/oder) ", text)):
                # umbrochene Zeile: die Zwischenzeile ist der Anfang dieser GdS-Zeile
                head = self.pfad.pop()[1]
                text = f"{head} {text}"
                self.joins.append(f"{cur['id']}: Zeile fortgesetzt → {text!r}")
            if gds:
                if self.prev == "nogds":
                    self.pop_pfad(cur, lambda e: e[0] > indent)
                else:
                    self.pop_pfad(cur, lambda e: e[0] >= indent)
                head_entry = None
                if ov and "split" in ov:
                    if text.endswith(" " + ov["split"]):
                        # verschmolzene Zelle: Anfang ist Überschrift, Rest der eigentliche Zeilentext
                        head_entry = self.push(indent, text[: -len(ov["split"])].strip(), "zw", used=True)
                        text = ov["split"]
                    else:
                        self.problems.append(f"{cur['id']}: Teilung {ov['split']!r} passt nicht zu {text!r}")
                        self.override_hits[(cur["nummer"], ov["text"])] = 99
                for e in self.pfad:
                    e[2] = True
                self.zeile(cur, text, gds, [e[1] for e in self.pfad])
                self.release(cur, text)
                entry = self.push(indent, text, "gds", used=True)  # Elternteil tieferer Wertzeilen
                if head_entry is not None:
                    entry = head_entry
                self.prev = "gds"
            elif full and not r["head"] and not ov:  # eine kuratierte Zeile ist nie Fließtext
                self.end_pfad(cur, keep_sticky=True)
                for _, ps, _ in texts:
                    for p in ps:
                        self.absatz(cur, p)
                continue
            else:
                if self.prev == "nogds":
                    self.pop_pfad(cur, lambda e: e[0] > indent)
                else:
                    top = self.pfad[-1] if self.pfad else None
                    if top and top[0] == indent and top[3] == "zw" and not top[2] and not top[5] \
                            and not top[1].endswith((".", ":")) and not is_note(top[1]):
                        # zwei noch unbenutzte Zwischenstufen gleicher Einrückung über eine Leerzeile hinweg
                        # (z. B. B 3.1.2 "Epileptische Anfälle" / "je nach Art …"): stapeln statt ersetzen
                        self.pop_pfad(cur, lambda e: e[0] > indent)
                    else:
                        self.pop_pfad(cur, lambda e: e[0] >= indent)
                if ov and "split" in ov:
                    if not text.endswith(" " + ov["split"]):
                        self.problems.append(f"{cur['id']}: Teilung {ov['split']!r} passt nicht zu {text!r}")
                        self.override_hits[(cur["nummer"], ov["text"])] = 99
                        entry = self.push(indent, text, "zw")
                    else:
                        self.push(indent, text[: -len(ov["split"])].strip(), "zw")
                        self.prev = "nogds"
                        entry = self.push(indent + 1, ov["split"], "zw")
                else:
                    entry = self.push(indent, text, "zw")
                self.prev = "nogds"
            if ov and "until" in ov:
                entry[4] = END if ov["until"] is None else ov["until"]
                entry[2] = True
        return cur

    def release(self, node: dict, text: str) -> None:
        """Gehaltene Einträge, deren "until" diese GdS-Zeile ist, nach der Zeile entfernen."""
        keep = []
        for e in self.pfad:
            if e[4] is not None and e[4] != END and text.startswith(e[4]):
                key = (node.get("nummer"), "until", e[4])
                self.override_hits[key] = self.override_hits.get(key, 0) + 1
            else:
                keep.append(e)
        self.pfad = keep

    def zeile(self, node: dict, text: str, gds: str, pfad: List[str]) -> None:
        z = {"text": text, "gds": gds}
        if pfad:
            z["pfad"] = pfad
        node.setdefault("zeilen", []).append(z)
        self.gds_rows += 1


def special_rows(table: ET.Element) -> List[List[str]]:
    """Sondertabelle als Zeilen mit einer Zelle je Spalte; verbundene Zellen stehen in ihrer ersten Spalte,
    die übrigen überdeckten Spalten (auch über morerows) bleiben leer."""
    tg = table.find("tgroup")
    names = [c.get("colname") for c in tg.findall("colspec")]
    ncols = int(tg.get("cols"))
    covered: Dict[Tuple[int, int], bool] = {}
    rows = []
    for r, row in enumerate(tg.iter("row")):
        cells = [""] * ncols
        pos = 0
        for e in row.findall("entry"):
            while covered.get((r, pos)):
                pos += 1
            st, en = e.get("namest") or e.get("colname"), e.get("nameend")
            start = names.index(st) if st in names else pos
            end = names.index(en) if en in names else start
            if start < ncols:
                cells[start] = " ".join(paragraphs(events(e)))
            for k in range(1, int(e.get("morerows", "0")) + 1):
                for c in range(start, end + 1):
                    covered[(r + k, c)] = True
            pos = end + 1
        while cells and not cells[-1]:
            cells.pop()
        if cells:
            rows.append(cells)
    return rows


# --- Stichwörter ------------------------------------------------------------------------------
PART = re.compile(r"^([A-D])(.+)$")


def comps(s: str) -> List[str]:
    """Komponenten einer Fundstelle: 5dii → 5, d, ii; 14.3 → 14, 3; gg → gg; 3.1.a → 3, 1, a."""
    m = re.fullmatch(r"(\d+(?:\.\d+)*)?\.?([a-z])?([a-z]{2})?", s)
    if not m or not s:
        raise ValueError(s)
    nums, letter, double = m.groups()
    out = nums.split(".") if nums else []
    return out + [x for x in (letter, double) if x]


def ref_id(teil: str, cs: List[str]) -> str:
    nums = [c for c in cs if c.isdigit()]
    lets = [c for c in cs if not c.isdigit()]
    # Eine Ziffer nach einem Buchstaben (z. B. "3.1.a+2") ersetzt den Buchstaben: Nummernfolge bleibt vorn.
    out = ".".join(nums)
    for le in lets:
        out += (" " + le) if len(le) == 2 else le
    return f"VMG:{teil} {out}"


def expand(part: str) -> List[Tuple[str, List[str]]]:
    """Eine Fundstelle (ohne ; und ,) in Teil + Komponenten zerlegen, + und - auflösen."""
    compact = part.replace(" ", "")
    m = PART.match(compact)
    if not m:
        raise ValueError(part)
    teil, rest = m.groups()
    pieces = re.split(r"([+-])", rest)
    base = comps(pieces[0])
    out = [base]
    for op, x in zip(pieces[1::2], pieces[2::2]):
        xs = comps(x)
        if not xs or len(xs) > len(base):
            raise ValueError(part)
        new = base[: len(base) - len(xs)] + xs
        if op == "+":
            out.append(new)
        else:
            a, b = out[-1][-1], new[-1]
            if not (a.isdigit() and b.isdigit()) or out[-1][:-1] != new[:-1]:
                raise ValueError(part)
            out.extend(new[:-1] + [str(i)] for i in range(int(a) + 1, int(b) + 1))
    return [(teil, cs) for cs in out]


def resolve(teil: str, cs: List[str], nodes: Dict[str, dict]) -> Tuple[Optional[str], bool]:
    """(Kennung, Rückfall) – tiefster vorhandener Knoten, None wenn schon Teil + erste Nummer fehlen."""
    cs = list(cs)
    first = True
    while cs:
        nid = ref_id(teil, cs)
        if nid in nodes:
            return nid, not first
        cs.pop()
        first = False
    return None, True


def stichwoerter(path: Path, nodes: Dict[str, dict], err) -> Tuple[List[dict], int, int]:
    out = []
    fallbacks = unresolved = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        wort, fund = line.split("\t")
        fundstellen = [f.strip() for f in fund.split(";") if f.strip()]
        ids: List[str] = []
        for f in fundstellen:
            for part in (p.strip() for p in f.split(",") if p.strip()):
                try:
                    refs = expand(part)
                except ValueError:
                    err(f"Stichwort {wort!r}: Fundstelle {part!r} nicht lesbar")
                    unresolved += 1
                    continue
                for teil, cs in refs:
                    nid, fb = resolve(teil, cs, nodes)
                    want = ref_id(teil, cs)
                    if nid is None:
                        err(f"Stichwort {wort!r}: Fundstelle {f!r} ({want}) nicht auflösbar")
                        unresolved += 1
                        continue
                    if fb:
                        err(f"Stichwort {wort!r}: Fundstelle {f!r} ({want}) → Vorfahr {nid}")
                        fallbacks += 1
                    if nid not in ids:
                        ids.append(nid)
        out.append({"wort": wort, "fundstellen": fundstellen, "ids": ids})
    return out, fallbacks, unresolved


# --- Ablauf -----------------------------------------------------------------------------------
def build(xml_path: Path, txt_path: Path) -> Tuple[dict, dict]:
    tree = ET.parse(xml_path)
    doc = tree.getroot()
    norms = doc.findall("norm")
    anlage = next(n for n in norms if (n.findtext("metadaten/enbez") or "") == "Anlage")
    stand = norm(doc.findtext("norm/metadaten/standangabe/standkommentar") or "")
    bd = doc.get("builddate", "")
    builddate = f"{bd[:4]}-{bd[4:6]}-{bd[6:8]}" if len(bd) >= 8 else bd

    content = anlage.find("textdaten/text/Content")
    parts: List[Tuple[str, str, List[ET.Element]]] = []
    for c in content:
        if c.tag == "Title":
            t = norm("".join(c.itertext()))
            m = re.match(r"Teil ([A-D]): (.+)$", t)
            parts.append((m.group(1), m.group(2), []))
        elif parts and c.tag in ("P", "DL", "table"):
            parts[-1][2].append(c)

    b = Builder()
    for teil, titel, blocks in parts:
        root = b.add(teil, None, None, titel)
        if teil == "B":
            b.build_b(root, blocks)
        else:
            b.build_acd(teil, root, blocks)

    problems = list(b.problems)
    override_errors = [
        f"Kuratierte Zuordnung B {nr} {o['text']!r}: {b.override_hits.get((nr, o['text']), 0)}-mal gefunden (erwartet 1)"
        for nr, entries in OVERRIDES.items() for o in entries if b.override_hits.get((nr, o["text"]), 0) != 1
    ]
    for nr, entries in OVERRIDES.items():
        rows = (b.nodes.get(f"VMG:B {nr}") or {}).get("zeilen", [])
        for o in entries:
            if o.get("until") is None:
                continue
            n = sum(1 for z in rows if z["text"].startswith(o["until"]))
            released = b.override_hits.get((nr, "until", o["until"]), 0)
            if n != 1 or released != 1:
                override_errors.append(
                    f"Kuratierte Zuordnung B {nr} {o['text']!r}: Ende {o['until']!r} {n}-mal als GdS-Zeile "
                    f"gefunden, {released}-mal als Ende erreicht (erwartet je 1)")
    sw, fallbacks, unresolved = stichwoerter(txt_path, b.nodes, problems.append)
    data = {
        "meta": {"titel": TITEL, "stand": stand, "builddate": builddate, "k710": K710},
        "nodes": b.nodes,
        "stichwoerter": sw,
    }
    stats = {"override_errors": override_errors, "joins": b.joins, "gds": b.gds_rows, "fallbacks": fallbacks, "unresolved": unresolved, "problems": problems}
    return data, stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Versorgungsmedizinische Grundsätze (VersMedV-Anlage) nach JSON")
    parser.add_argument("xml", type=Path, help="versmedv_BJNR241200008.xml (gesetze-im-internet.de)")
    parser.add_argument("stichworte", type=Path, help="k710_stichwortverzeichnis.txt")
    parser.add_argument("target_dir", type=Path, help="Zielordner")
    parser.add_argument("--verbose", action="store_true", help="zusammengeführte Zeilenumbrüche auf stderr")
    args = parser.parse_args()

    data, stats = build(args.xml, args.stichworte)
    for p in stats["problems"]:
        print(p, file=sys.stderr)
    if args.verbose:
        for j in stats["joins"]:
            print(j, file=sys.stderr)
    if stats["override_errors"]:
        for p in stats["override_errors"]:
            print(f"FEHLER: {p}", file=sys.stderr)
        sys.exit(1)
    args.target_dir.mkdir(parents=True, exist_ok=True)
    (args.target_dir / "versmedv.json").write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(
        f"{len(data['nodes'])} Knoten, {stats['gds']} GdS-Zeilen, {len(data['stichwoerter'])} Stichwörter "
        f"({stats['fallbacks']} Rückfälle auf einen Vorfahren, {stats['unresolved']} nicht auflösbar) "
        f"nach {args.target_dir} exportiert"
    )


if __name__ == "__main__":
    main()
