# Versorgungsmedizinische Grundsätze (VersMedV) als viertes Wissensnetz

Stand: 17.11.2026 · Größe: Projekt (neues Modul nach dem Muster des Begutachtungsinstruments)

## Warum

In der Praxis (Teilhabeplanung, Betreuung, Widersprüche) geht es oft um die Schwerbehinderung:

- Ist ein GdB-Bescheid plausibel?
- Wie begründet man einen Widerspruch oder einen Antrag?
- Welche Merkzeichen kommen in Betracht?

Maßstab dafür sind die Versorgungsmedizinischen Grundsätze (Anlage zu § 2 VersMedV). Der Server kennt bisher ICD, ICF und das Begutachtungsinstrument der Pflege, aber nicht diesen Maßstab.

Alle Aspekte sind gewünscht:

- GdS-Werte nachschlagen (Teil B)
- die Bildung des Gesamt-GdB nachvollziehen (Teil A 3)
- die Merkzeichen prüfen (Teil D, dazu H und Bl aus Teil A)
- die Grundsätze in Teil C durchsuchen

## Ziele

- **Teil B:** Jede Tabellenzeile ist mit ihrem GdS-Wert und ihrem Gliederungspfad abrufbar. Ein Wert wie „30–40“ erscheint nie ohne den Zusammenhang, also etwa „3.7 Neurosen … → Stärker behindernde Störungen → mit wesentlicher Einschränkung der Erlebnis- und Gestaltungsfähigkeit → (z. B. …)“.
- **Suche:** Sie läuft über den Wortlaut aller Teile und über das Stichwortverzeichnis der BMAS-Broschüre K710 (z. B. „Diabetes mellitus → A 5d jj; B 15.1; D 1e“).
- **Prüfhilfe Gesamt-GdB:** Zu einer Liste von Einzel-GdB zeigt sie den Ausgangswert (höchster Einzel-GdB) und die einschlägigen Regeln aus Teil A Nr. 3 im Wortlaut. Sie markiert Einzel-GdB von 10 (A 3.5) und Funktionsbeeinträchtigungen im selben Funktionssystem (A 3.1, 3.2).
- **Merkzeichen:** G, B und Gl (Teil D) sowie H (Teil A 4 und 5) und Bl (Teil A 6) mit ihren Voraussetzungen im Wortlaut.
- **Verbindung zur ICD:** Ein ICD-Kode als Suchbegriff führt über Titel und Alphabet-Begriffe des Kodes zu passenden Stichwörtern und Abschnitten. Diese Treffer sind als abgeleitet gekennzeichnet.

## Nicht-Ziele

- Kein Gesamt-GdB als Zahl. Teil A 3 verbietet das Addieren und verlangt eine gutachterliche Gesamtschau.
- Keine kuratierte Zuordnung VersMedV ↔ ICD oder ICF in diesem Schritt. Das kann später nach dem Muster `bi_icf_mapping` folgen.
- Keine Merkzeichen außerhalb der VersMedV im Wortlaut. Für aG, RF und TBl gibt das Tool nur einen Hinweis auf die maßgebliche Norm.
- Kein eigenes Tool für Teil C. Teil C ist über Suche und Abruf erreichbar.
- Die Seitenzahlen der Broschüre K710 werden nicht übernommen.

## Anti-Ziele

- Die Prüfhilfe darf nicht wie ein Rechner wirken. Sie liefert keinen Gesamtwert, auch keinen „voraussichtlichen“.
- Ein GdS-Wert darf nie ohne seinen Gliederungspfad und ohne seine Fundstelle (z. B. „Teil B Nr. 3.7“) ausgegeben werden.
- Stichwörter und ICD-Ableitungen dürfen nicht als amtliche Zuordnung erscheinen.
- Die bestehenden Tools (ICF, ICD, BI) ändern ihr Verhalten nicht.

## Rahmenbedingungen

- **Amtlicher Text:** Grundlage ist das XML von gesetze-im-internet.de, `BJNR241200008.xml` aus `versmedv/xml.zip`, zuletzt geändert durch Art. 1 V v. 29.9.2025 (BGBl. I Nr. 228), builddate 06.05.2026.
  - Als amtliches Werk nach § 5 Abs. 1 UrhG ist es frei.
  - Die Texte werden unverändert übernommen.
- **Stichwortverzeichnis:** Es stammt aus der Broschüre K710 des BMAS (Stand Januar 2026, S. 131–140). Es gehört nicht zur Verordnung, sondern ist eine redaktionelle Beigabe.
  - Einordnung als anderes amtliches Werk nach § 5 Abs. 2 UrhG, weil das BMAS es zur allgemeinen Kenntnisnahme veröffentlicht. Damit gelten Änderungsverbot und Quellenangabe (§§ 62, 63 UrhG).
  - Es wird wie bei den BRi nur der Textauszug versioniert, nicht das PDF (Gestaltung ggf. geschützt).
  - Quellenangabe nach dem Wunsch im Impressum: Herausgeber, Titel, Stand.
- **Technik wie bisher:** keine npm-Abhängigkeiten, Node ≥ 18, Build in Python mit Standardbibliothek. Einzige Ausnahme ist `pypdf` für den einmaligen Auszug aus dem PDF, wie `scripts/bri_extract.py`.
- **Abschaltbar** wie das BI-Modul über die Umgebungsvariable `ICF_MCP_VMG=0`. Standardmäßig ist es eingeschaltet.
- **Netlify:** Die neue Datei unter `data/` wird über `included_files = ["data/*.json"]` schon mitgeliefert. In `package.json` (`files`) muss sie ergänzt werden.

## Ansätze

| Ansatz | Vorteil | Nachteil |
| --- | --- | --- |
| **A: XML für alle Texte, Stichwortverzeichnis aus K710 als Suchhilfe** (gewählt) | Amtlicher Wortlaut, Tabellen sauber strukturiert, die Suche findet auch über Stichwörter | Urheberrechtliche Einordnung des Stichwortverzeichnisses ist eine Abwägung; zwei Quellen |
| B: nur XML | Rechtlich eindeutig, eine Quelle | Die Suche geht nur über den Wortlaut der Grundsätze |
| C: nur PDF der Broschüre | Seitenzahlen wie im Buch | Tabellen kommen zerrissen aus dem PDF und müssten von Hand nachgebaut werden |

Gewählt wurde A.

## Was die Quellen hergeben (Erkundung)

- **Struktur der Anlage im XML:**
  - Teil A und Teil C liegen als `<P>`- und `<DL>`-Absätze vor, nummeriert („3.5 …“, „4. Hilflosigkeit a) … b) …“; Teil A 5 mit Unterpunkten bis „jj)“).
  - Teil B besteht aus 31 Tabellen mit 2.269 Zeilen:
    - 779 zweispaltige Zeilen (Text + GdS)
    - 675 einspaltige Zeilen (Abschnittsüberschrift, Zwischenstufe oder Fließtext)
    - 713 leere Zeilen
    - einige Sondertabellen mit vielen Spalten (Hörverlust nach Röser, Sehschärfe-Tabellen)
  - Die Überschriften der Teil-B-Abschnitte stehen als einspaltige Zeile mit Nummer, z. B. „3.1.1 Grundsätze der Gesamtbewertung von Hirnschäden“.
- **Inhaltsverzeichnis der Anlage:**
  - Teil A Nr. 1–7 (4 Hilflosigkeit, 5 Hilflosigkeit bei Kindern, 6 Blindheit, 7 Wesentliche Änderung)
  - Teil B Nr. 1 (weggefallen) bis 18
  - Teil C Nr. 1–10
  - Teil D Nr. 1 G, Nr. 2 B, Nr. 3 (aufgehoben, früher aG), Nr. 4 Gl
- **Merkzeichen:** In der VersMedV geregelt sind G, B, Gl, H und Bl. Nicht geregelt sind:
  - aG: § 229 Abs. 3 SGB IX
  - RF: Rundfunkbeitragsstaatsvertrag
  - TBl: Schwerbehindertenausweisverordnung

  Die genauen Normzitate prüft der Builder an der Quelle.
- **Stichwortverzeichnis (K710, S. 131–140):** zweispaltiges Layout, Einträge der Form „Begriff ..... A 5d jj; B 17.1“.
  - Die Fundstellen passen zur Nummerierung im XML, z. B. „jj)“ in Teil A 5d.
  - Formen der Fundstellen: `A 5d jj`, `A 5 d cc`, `B 10.2.2`, `B 14.3+4`, `D 1e`. Manche Einträge laufen über zwei Zeilen, z. B. „Dermatomyositis ... A 5d pp;“ und darunter „B 17.5; B 18.2.2“.

## Festgelegtes Vorgehen

**Kennungen**

- Präfix `VMG:`, damit es keine Kollision mit ICF-, ICD- oder BI-Kodes gibt.
- Aufbau: Teil + Nummer, z. B. `VMG:B 3.7`, `VMG:A 3.5`, `VMG:A 5d jj`, `VMG:D 1`.
- Eingaben ohne Präfix und mit abweichenden Leerzeichen werden verstanden („B3.7“, „A 5 d jj“).

**Quellen unter `source/`**

- `versmedv_BJNR241200008.xml`
- `k710_stichwortverzeichnis.txt`, erzeugt mit `scripts/k710_extract.py` aus dem PDF. Das PDF selbst steht in `.gitignore`.

**Build**

- `scripts/versmedv_to_json.py` erzeugt `data/versmedv.json`. `build_data.sh` ruft es auf.
- Inhalt:
  - Knoten je nummerierter Einheit mit Teil, Nummer, Titel, Absätzen, Unterknoten und Elternknoten
  - für Teil B die GdS-Zeilen mit Text, Wert (Zeichenkette wie im Original, z. B. „30-40“, „0“, „100“) und Pfad der übergeordneten einspaltigen Zeilen innerhalb des Abschnitts
  - Sondertabellen als Zeilen-Arrays am Abschnitt
  - Stichwörter mit ihren aufgelösten Kennungen
- Fundstellen, die sich keinem Knoten zuordnen lassen, meldet das Skript.

**Tools** (Präfix `vmg_`, alle read-only)

| Tool | Zweck |
| --- | --- |
| `vmg_list_structure` | Gliederung der Anlage (Teile A–D mit Nummern und Titeln), optional ab einer Kennung |
| `vmg_get` | Abschnitt mit Wortlaut, GdS-Zeilen samt Pfad, Sondertabellen, Unterabschnitten, darauf verweisenden Stichwörtern und Fundstelle |
| `vmg_search` | Suche in Wortlaut, GdS-Zeilen und Stichwörtern, optional auf einen Teil beschränkt. Die ICD-Ableitung läuft nur über einen eigenen Parameter `icd` (z. B. `icd: "E11.90"`), nie über `query`. Grund: Eingaben wie „B15“ wären sonst mehrdeutig (ICD Hepatitis A oder VersMedV B 15). Treffer aus der Ableitung stehen in einem eigenen Feld und sind als „abgeleitet über ICD, nicht amtlich“ gekennzeichnet *(Entscheidung des Designers)* |
| `vmg_gesamt_gdb` | Prüfhilfe: Eingabe sind Einzel-GdB mit Bezeichnung und optional Funktionssystem bzw. Kennung aus Teil B. Ausgabe sind der Ausgangswert, Markierungen (10er-Werte, gleiches Funktionssystem) und die Regeln A 3.1–3.5 im Wortlaut, mit dem festen Hinweis, dass kein Gesamt-GdB berechnet wird |
| `vmg_merkzeichen` | Voraussetzungen eines oder aller Merkzeichen im Wortlaut mit Fundstelle. Für aG, RF und TBl kommt ein Hinweis auf die maßgebliche Norm außerhalb der VersMedV |

**Funktionssysteme in `vmg_gesamt_gdb`** (entschieden: Kapitel, B 18 geteilt):

- Gibt die Eingabe ein Funktionssystem als Text an, gilt diese Angabe.
- Sonst wird das Funktionssystem aus der Teil-B-Kennung abgeleitet: Jedes Kapitel B 2 bis B 17 ist ein Funktionssystem mit dem Kapiteltitel als Namen.
- Kapitel B 18 wird nach der verwaltungsüblichen Gliederung geteilt:
  - B 18.9 (Wirbelsäule) und B 18.10 (Becken) → „Rumpf“
  - B 18.13 → „Arme“
  - B 18.14 → „Beine“
- Die übrigen Abschnitte von B 18 (18.1–18.8, 18.11, 18.12 Endoprothesen) gelten als „Haltungs- und Bewegungsorgane, nicht näher zugeordnet“. Trifft ein solcher Eintrag auf Arme, Beine oder Rumpf, markiert das Tool das als „möglicherweise gleiches Funktionssystem – bitte angeben“ und nicht als „gleich“.
- Die Aufteilung von B 18 ist in der Ausgabe als „verwaltungsübliche Gliederung, nicht amtlich“ gekennzeichnet. Sie liegt als kleine Tabelle im Code oder in den Daten, nicht verstreut.
- Ohne Funktionssystem und ohne Kennung bleibt der Eintrag unmarkiert, mit dem Hinweis, dass sich ein gleiches Funktionssystem nicht prüfen ließ.
- Test: [B 18.9 mit 30, B 18.14 mit 20] wird nicht markiert. [B 18.9, B 18.9] wird als gleich markiert. [B 18.12, B 18.14] wird als „möglicherweise gleich“ markiert.

**Server-Instructions** erhalten einen Absatz wie beim BI-Modul. Er enthält den Hinweis, dass der GdB eine gutachterliche Entscheidung bleibt und Teil B typische Werte nennt, von denen nach A 1.4 begründet abgewichen werden kann.

**Tests** decken mindestens ab:

- B 3.7 enthält die Zeile „Leichtere psychovegetative oder psychische Störungen“ mit „0-20“.
- Die Zeile mit „30-40“ in B 3.7 trägt den Pfad „Stärker behindernde Störungen“ › „mit wesentlicher Einschränkung …“.
- Das Stichwort „Diabetes mellitus“ führt zu A 5d jj, B 15.1 und D 1e.
- `vmg_gesamt_gdb` mit [50, 30, 10] liefert den Ausgangswert 50, markiert die 10 mit A 3.5 und liefert keine Gesamtzahl.
- `vmg_merkzeichen` „G“ liefert Teil D 1, „aG“ den Normhinweis.
- Kennungen in verschiedenen Schreibweisen werden verstanden.
- Unbekannte Kennungen ergeben einen verständlichen Fehler mit Vorschlägen.

**Dokumentation**

- README (Tool-Tabelle, Abschalten)
- QUELLEN.md (XML mit Stand, K710 mit Herausgeber, Titel und Stand, Einordnung nach § 5 UrhG, Hinweis auf nicht übernommene Seitenzahlen)
- Version 1.6.0

## Dem Builder überlassen

- **Erkennung der Teil-B-Zeilen:** wann eine einspaltige Zeile Abschnittsüberschrift ist (beginnt mit Nummer), wann Zwischenstufe (gefolgt von eingerückten Wertzeilen) und wann Fließtext. Die Regeln sind an Stichproben in mehreren Abschnitten zu prüfen, mindestens 3.7, 5.2, 9.1, 18.13.
- **Wann ein Pfad endet:** Leerzeile, nächste Überschrift oder Zeile mit eigenem Wert.
- **Gliederung von Teil A, C und D:** wie tief Unterpunkte (a), b), aa) …) eigene Knoten werden. Mindestens so tief, dass jede Fundstelle des Stichwortverzeichnisses aufgelöst wird.
- **Gewichtung in `vmg_search`:** Überschrift vor GdS-Zeile vor Fließtext, Stichworttreffer hoch. Umlaute und Bindestriche werden wie in der ICD-Suche behandelt.
- **ICD-Ableitung:** welche Wörter aus Titel und Alphabet-Begriffen eines ICD-Kodes verwendet werden. Stoppwörter wie „nicht näher bezeichnet“ oder „sonstige“ bleiben draußen.
- **Branch:** Ist PR #12 (Alphabet) noch nicht gemergt, baut die VersMedV darauf auf, weil die ICD-Ableitung das Alphabet nutzt.
