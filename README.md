# ICF-ICD-MCP

MCP-Server für zwei amtliche Klassifikationen in deutscher Fassung des BfArM, das Begutachtungsinstrument der Pflegeversicherung und die Versorgungsmedizinischen Grundsätze:

- **ICF**: Internationale Klassifikation der Funktionsfähigkeit, Behinderung und Gesundheit (WHO, Stand 2005)
- **ICD-10-GM 2026**: Internationale statistische Klassifikation der Krankheiten, German Modification
- **Begutachtungsinstrument nach § 15 SGB XI**: Module, Kriterien und Formulargutachten nach den Begutachtungs-Richtlinien 2026, mit Pflegegrad-Rechner
- **Versorgungsmedizinische Grundsätze (VersMedV)**: Anlage zu § 2 VersMedV mit GdS-Tabelle (Teil B), Merkzeichen und Hilflosigkeit, im amtlichen Wortlaut, mit Prüfhilfen zu Gesamt-GdB und Merkzeichen

Damit können Claude und andere MCP-Clients Diagnosen, ICF-Kategorien, Kriterien der Pflegebegutachtung und GdS-Werte suchen, nachschlagen und Kodierungen prüfen, etwa für Teilhabeplanung, Gesamtplanverfahren, Pflegegrad-Widersprüche oder Berichte.

- Keine Abhängigkeiten, nur Node.js ≥ 18
- Läuft lokal, sendet keine Daten nach außen
- ICF: 1.495 Kategorien (b, s, d, e) mit Beschreibungen, Ein-/Ausschlüssen und Beurteilungsmerkmalen
- ICD-10-GM: 17.177 Klassen, darunter alle über Subklassifikationen gebildeten Kodes (z. B. E11.90, G82.30), mit Kodierregeln nach §295/§301
- Alphabetisches Verzeichnis der ICD-10-GM: 89.304 Diagnosetexte mit Synonymen und Laienbegriffen (z. B. „Ziegenpeter“ → B26.9) und 309 Verweise, dazu aus der Datei Alpha-ID-SE 2027 weitere 267 Begriffe (überwiegend seltene Erkrankungen) und 19.473 Orpha-Kennnummern
- VersMedV: 356 Abschnitte (Teile A–D), 767 GdS-Zeilen mit Pfad und Fundstelle, 6 Sondertabellen und 330 Stichwörter aus dem Stichwortverzeichnis der BMAS-Broschüre K710 (redaktionelle Beigabe, nicht Teil der Verordnung)

## Tools

### ICF

| Tool | Zweck |
| --- | --- |
| `icf_search` | Volltextsuche in Titeln, Beschreibungen und Einschlüssen; Umlaute egal, Code-Präfixe möglich, optional auf b/s/d/e eingeschränkt |
| `icf_get_code` | Titel, Beschreibung, Ein-/Ausschlüsse (mit aufgelösten Codes), Hierarchiepfad, Unterkategorien |
| `icf_list_chapters` | Komponenten b/s/d/e mit ihren Kapiteln |
| `icf_get_related` | Ober-/Unterkategorien, Geschwister, eigene und geerbte Ausschlüsse, Rückverweise (wer schließt diesen Code aus) |
| `icf_compare` | Grenzt zwei Kategorien ab: Hierarchie, Ausschlüsse in beiden Richtungen, Verbindungsweg, Beschreibungen |
| `icf_get_qualifiers` | Notation und Werteskala der Beurteilungsmerkmale für einen Code |
| `icf_interpret_coding` | Prüft und übersetzt Kodierungen wie `d450.23`, `b1440.2`, `s7500.213`, `e310+3` |

### ICD-10-GM

| Tool | Zweck |
| --- | --- |
| `icd_search` | Suche in Titeln, Einschlussbegriffen und im Alphabetischen Verzeichnis (Synonyme, Laienbegriffe, Kreuz-Stern-Kombinationen, Verweise); Umlaute und Bindestriche egal, Kode-Präfixe möglich, Suche nach Orpha-Kennnummer (`ORPHA:173`), optional nach Kapitel oder nur endständige Kodes |
| `icd_get_code` | Titel, Hierarchiepfad, Ein-/Ausschlüsse mit Verweisen, Hinweise, Unterkodes, §295/§301, Kreuz/Stern/Ausrufezeichen, Alters- und Geschlechtsbezug |
| `icd_list_chapters` | Die 22 Kapitel mit Kodebereichen oder die Gruppen eines Kapitels |
| `icd_check_code` | Prüft Kodierbarkeit inkl. Zusatzkennzeichen für Diagnosesicherheit (G/V/Z/A) und Seite (R/L/B), z. B. `F32.1 G` |
| `icd_relations` | Alle amtlichen Beziehungen eines Kodes: geerbte Ausschlüsse, Rückverweise (auch über Bereiche wie J00-J22), Verweise, Kreuz-Stern-Partner |
| `icd_compare` | Grenzt zwei Kodes ab, z. B. F32.1 und F33.1: Hierarchie, Ausschlüsse und Verweise in beiden Richtungen, Verbindungsweg, Einschlüsse |

### Wissensnetz

Aus den amtlichen Daten wird beim Start ein Wissensnetz aufgebaut, ohne Sprachmodell und ohne erschlossene Beziehungen:

| Beziehung | ICD-10-GM | ICF |
| --- | --- | --- |
| Ober-/Unterklasse | 17.177 Klassen | 1.495 Kategorien |
| Ausschluss (Exklusivum) | 5.348 | 148 |
| Verweis in Einschlüssen und Titeln | 728 | – |
| Kreuz-Stern-Kombination (†/*) | 312 | – |
| Nennung in Kodierhinweisen, Anmerkungen, Definitionen (z. B. „zusätzlich U69.80–U69.82 kodieren“) | 293 | – |

Ausschlüsse einer Oberklasse gelten für alle untergeordneten Kodes. Deshalb zeigen `icd_relations` und `icd_compare` auch geerbte Ausschlüsse; F32.1 grenzt sich etwa über F32 von F33 ab. Verweisziele wie `J00-J22` werden als Bereich ausgewertet: Jede Grenze wird in ihrer eigenen Genauigkeit verglichen, und eine Kategorie zählt nur dann dazu, wenn alle ihre Unterkodes darin liegen. Verweise wie „E10-E14, vierte Stelle .1“ werden in die gemeinten Viersteller E10.1 … E14.1 aufgelöst. ICF-Ausschlüsse, die nur als Titel vorliegen, werden über Titel, Kapitelangaben, Ergänzungsstriche („Teilzeit- und Vollzeitbeschäftigung“) und Wortvergleich vollständig zugeordnet.

Eine amtliche Zuordnung zwischen ICD und ICF gibt es nicht. Das Netz verbindet daher nur Kodes innerhalb einer Klassifikation.

## Begutachtungsinstrument nach § 15 SGB XI

Ein drittes Wissensnetz bildet das Begutachtungsinstrument der Pflegebegutachtung ab, auf Grundlage der Begutachtungs-Richtlinien (BRi) des Medizinischen Dienstes Bund, gültig ab 01.10.2026. Es ist standardmäßig eingeschaltet. Wer nur ICF und ICD-10-GM braucht, schaltet es mit der Umgebungsvariable `ICF_MCP_BI=0` ab:

```bash
claude mcp add icf-icd -e ICF_MCP_BI=0 -- node ~/GitHub/icf-icd-mcp/src/server.mjs
```

**Kennungen** folgen den Ziffern des Formulargutachtens mit dem Präfix `BI:`, damit sie nicht mit ICF- oder ICD-Kodes kollidieren: `BI:4.1` bis `BI:4.6` sind die Module 1–6, `BI:4.1.3` ist das Kriterium „Umsetzen“, `BI:1.1` bis `BI:9` sind die übrigen Abschnitte und Felder (F1–F9). `F 4.1.3` und `KF 4.1.3` (Kinderfassung) werden ebenfalls verstanden. Der Formularkopf hat in den BRi keine Ziffern; dort sind die Kennungen `BI:K.1` bis `BI:K.6` vergeben.

**Kodierung** einer Ausprägung: `BI:4.1.3=2`. Der Wert ist immer die **Stufe** der Skala (0–3), nicht der Punktwert aus dem Formular. Bei Modul 3 ist `3` also „täglich“ (5 Punkte), bei 4.4.8 ist `3` „unselbständig“ (9 Punkte). Modul 5 wird als Häufigkeit kodiert (`BI:4.5.1=3/Tag`, `BI:4.5.13=1/Monat`, `=entfällt`), Formularfelder mit dem Optionsschlüssel (`BI:5.4=unfall`).

| Tool | Zweck |
| --- | --- |
| `bi_list_structure` | Gliederung: Formularkopf, Abschnitte 1–9, Module mit Gewichtung und Kriterien |
| `bi_get_item` | Verbindliche Definition (Fettdruck der BRi), Hinweise, Ausprägungen mit Einzelpunkten und Erläuterung, Altersangaben für Kinder, Abgrenzungen, Seiten |
| `bi_search` | Volltextsuche in Definitionen, Hinweisen und Ausprägungstexten |
| `bi_related` | Beziehungen einer Kennung: Hierarchie, Abgrenzungen und Verweise, Regelkanten |
| `bi_compare` | Grenzt zwei Kriterien ab, z. B. 4.3.2 und 4.6.2, mit den wörtlichen Abgrenzungen der BRi |
| `bi_interpret_coding` | Prüft Kodierungen und übersetzt sie in Klartext |
| `bi_calculate` | Summen, gewichtete Punkte, Gesamtpunkte und Pflegegrad nach Anlage 2 zu § 15 SGB XI, auch für Kinder (Altersvergleich, Sonderregel bis 18 Monate) |
| `bi_icf_mapping` | Kuratierte Zuordnung BI ↔ ICF in beide Richtungen, mit Beziehungsart und Begründung |
| `bi_scoring_rules` | Bewertungssystematik mit Schwellen, Modul-5-Regeln und Sonderregeln |
| `bi_gegenueberstellen` | Stellt ein Pflegegutachten der eigenen Einschätzung gegenüber: Gutachten als Grundlage, eigene Werte eingesetzt; je Unterschied Definition, Bedeutung beider Stufen wörtlich aus den BRi, Wirkung auf Punkte und Pflegegrad (auch allein), Hinweise und Abgrenzungen; Abstand zur nächsten Schwelle. Bewertet das Gutachten nicht |

Das Netz enthält 144 Knoten und 202 Kanten innerhalb des Instruments. Davon stammen 61 Abgrenzungen und 112 Verweise wörtlich aus dem Richtlinientext („… sind unter F 4.6.2 zu berücksichtigen“). Die übrigen Kanten bilden Regeln ab (4.4.0 ersetzt bei Kindern bis 18 Monate 4.4.1–4.4.13, aus Modul 2 und 3 zählt der höhere Wert, 4.1.B führt zu Pflegegrad 5). Jede Kante trägt ihre Herkunft (`quelle`: `richtlinie` oder `struktur`) und die Seite.

**Zuordnung zur ICF (kuratiert):** Eine amtliche Zuordnung zwischen BI und ICF gibt es nicht. Das Repo enthält deshalb eine eigene, fachlich kuratierte Kantenschicht (`source/bi_icf_zuordnung.json`, in `data/bi.json` mit `quelle: "kuratiert"`): alle 81 bewertbaren Kriterien (Module 1–6, Bereiche 6.1 und 6.2) mit 176 Kanten zu 105 ICF-Kategorien. Jede Kante nennt eine Beziehung und eine Begründung:

| Beziehung | Bedeutung |
| --- | --- |
| `entspricht` | Die ICF-Kategorie beschreibt im Kern dieselbe Aktivität oder Fähigkeit, z. B. 4.1.3 Umsetzen → d420 Sich verlagern |
| `teilweise` | Die ICF-Kategorie deckt einen Teil ab oder ist anders zugeschnitten, z. B. 4.4.7 → d550, weil die ICF das Schneiden der Nahrung zum Essen zählt |
| `funktion` | Zugrunde liegende Körperfunktion, z. B. 4.2.3 → b1140 Orientierung zur Zeit |
| `umwelt` | Umweltfaktor im Kriterium, z. B. 4.5.7 → e1151 Hilfsprodukte |

`bi_icf_mapping` fragt in beide Richtungen ab; von der ICF aus werden auch Ober- und Unterkategorien berücksichtigt (b1440 findet 4.2.4 über b144). `icf_get_related` nennt bei eingeschaltetem BI-Modul die zugeordneten Kriterien mit. BI-Stufen werden bewusst nicht in ICF-Beurteilungsmerkmale umgerechnet, weil beide Skalen Verschiedenes messen. Der Build prüft jede Kante gegen die ICF 2005; Kategorien aus späteren WHO-Updates (etwa d571 „Auf seine Sicherheit achten“) sind nicht verwendet.

Daten neu erzeugen (der Textauszug liegt bei; das PDF wird nicht versioniert und ist nur bei einer neuen BRi-Fassung nötig, dann mit `pypdf`):

```bash
python3 scripts/bri_extract.py source/bri_pflege_2026.pdf source/bri_pflege_2026.txt
```

```bash
python3 scripts/bi_to_json.py
```

`source/bi_struktur.json` enthält die von Hand übertragenen Teile (Skalen, Punkteregeln, Alterstabellen, Formularfelder und Optionen), jeweils mit Seitenangabe.

## Versorgungsmedizinische Grundsätze (VersMedV)

Ein viertes Modul gibt die Versorgungsmedizinischen Grundsätze (Anlage zu § 2 der Versorgungsmedizin-Verordnung) im amtlichen Wortlaut wieder: Teil A (gemeinsame Grundsätze), Teil B (GdS-Tabelle), Teil C (Begutachtung im Sozialen Entschädigungsrecht) und Teil D (Merkzeichen; Hilflosigkeit steht in Teil A Nr. 4 und 5). Stand der Fassung: „Zuletzt geändert durch Art. 1 V v. 29.9.2025 I Nr. 228“. Das Modul ist standardmäßig eingeschaltet und lässt sich mit der Umgebungsvariable `ICF_MCP_VMG=0` abschalten:

```bash
claude mcp add icf-icd -e ICF_MCP_VMG=0 -- node ~/GitHub/icf-icd-mcp/src/server.mjs
```

**Kennungen** tragen den Präfix `VMG:`: `VMG:A` ist Teil A, `VMG:B 3.7` der Abschnitt „Neurosen, Persönlichkeitsstörungen, Folgen psychischer Traumen“, `VMG:D 1` die Gehbehinderung (G). Buchstaben- und Doppelbuchstaben-Untergliederungen heißen etwa `A 4b` oder `A 5d jj`. Schreibweise und Präfix sind egal (`b3.7` genügt). Eine einzelne GdS-Zeile heißt `VMG:B 3.7 Z2` (zweite Zeile mit GdS-Wert im Abschnitt, gezählt ab 1); `vmg_get` zeigt die Kennung je Zeile. Abschnitte ohne amtliche Überschrift tragen eine abgeleitete Bezeichnung (`titel_abgeleitet`).

| Tool | Zweck |
| --- | --- |
| `vmg_list_structure` | Gliederung der Anlage (Standard: Teile A–D mit obersten Nummern), optional ab einer Kennung; `tiefe` steuert die Ebenen (0 = vollständig) |
| `vmg_get` | Abschnitt mit Wortlaut, GdS-Zeilen samt Pfad (Überschriften der Zeile), Sondertabellen, Unterabschnitten, darauf verweisenden Stichwörtern und Fundstelle |
| `vmg_search` | Suche in Überschriften, Stichwortverzeichnis, GdS-Zeilen und Fließtext, optional auf einen Teil beschränkt; mehrere Wörter werden UND-verknüpft. Mit `icd` (z. B. `E11.90`) werden passende Stichwörter über ICD-Titel und Alphabet-Begriffe abgeleitet, getrennt von den Treffern und als „nicht amtlich“ gekennzeichnet |
| `vmg_gesamt_gdb` | Prüfhilfe zu Teil A Nr. 3: Ausgangswert, Markierungen und die Regeln A 3.1–3.5 im Wortlaut |
| `vmg_merkzeichen` | Voraussetzungen von G, B, H, Bl und Gl im Wortlaut mit Fundstelle; für aG, RF und TBl ein Hinweis auf die maßgebliche Norm |
| `vmg_spanne_pruefen` | Prüft einen Einzel-GdB bzw. GdS gegen die Spanne einer GdS-Zeile (`kennung` wie `B 3.7 Z2`, `gdb`): innerhalb, unterhalb, oberhalb oder nicht bestimmbar, mit Zeilentext, Pfad, Fundstelle und dem Hinweis auf Teil A Nr. 1.4. „Wenigstens 80“ gilt als 80 bis 100. Wertet nicht |

Die Daten umfassen 356 Abschnitte (A 86, B 188, C 68, D 14), 767 GdS-Zeilen, 6 Sondertabellen und 330 Stichwörter. Ein GdS-Wert wird immer mit seinem Pfad und seiner Fundstelle ausgegeben; ohne diesen Kontext darf er nicht zitiert werden. Teil B nennt typische Werte, von denen nach Teil A Nr. 1.4 im Einzelfall mit Begründung abgewichen werden kann.

**Was das Modul nicht tut:**

- **Die Prüfhilfe berechnet keinen Gesamt-GdB.** Teil A Nr. 3 verbietet das Addieren und verlangt eine gutachterliche Gesamtschau. `vmg_gesamt_gdb` nennt den Ausgangswert (höchster Einzel-GdB), markiert Einzel-GdB von 10 und 20 (A 3.5) und Beeinträchtigungen im selben Funktionssystem (A 3.1, 3.2) und gibt die Regeln im Wortlaut aus, aber keinen Gesamtwert, auch keinen „voraussichtlichen“.
- **Funktionssysteme:** Jedes Kapitel B 2 bis B 17 gilt als ein Funktionssystem. Kapitel B 18 (Haltungs- und Bewegungsorgane) wird nach der verwaltungsüblichen Gliederung geteilt (B 18.9 und B 18.10 → Rumpf, B 18.13 → Arme, B 18.14 → Beine). Diese Aufteilung ist verwaltungsüblich, nicht amtlich, und in der Ausgabe so gekennzeichnet. Nicht zugeordnete Abschnitte von B 18 werden bei Arm, Bein oder Rumpf nur als „möglicherweise gleiches Funktionssystem – bitte angeben“ markiert. Ein ausdrücklich angegebenes Funktionssystem hat Vorrang.
- **Die ICD-Ableitung ist nicht amtlich.** Eine amtliche Zuordnung zwischen ICD und VersMedV gibt es nicht. `icd` vergleicht ICD-Titel und Alphabet-Begriffe per Teilstring mit dem Stichwortverzeichnis. Verneinungen („ohne …“) werden vor dem Abgleich herausgefiltert; die verbleibende Grenze sind lose Teilstring-Treffer (z. B. Gastroparese → Parese). Die Treffer sind Suchhilfen, keine Einstufung.
- **Merkzeichen außerhalb der VersMedV:** aG (§ 229 Abs. 3 SGB IX) und TBl (§ 3 Abs. 1 Nr. 8 SchwbAwV) sind als Normen geprüft. RF verweist auf § 4 Abs. 2 Nr. 1 bis 3 Rundfunkbeitragsstaatsvertrag (Landesrecht, an der amtlichen Landesrechtssammlung BRAVORS Brandenburg geprüft). Teil D Nr. 3 (früher aG) ist aufgehoben.
- **Stichwörter** stammen aus der redaktionellen Beigabe der BMAS-Broschüre K710, nicht aus der Verordnung. Ihre Seitenzahlen sind nicht übernommen.

Die Einstufung bleibt eine gutachterliche Entscheidung im Einzelfall.

**Daten neu erzeugen:** Das amtliche XML und der Textauszug des Stichwortverzeichnisses liegen bei (`source/versmedv_BJNR241200008.xml`, `source/k710_stichwortverzeichnis.txt`); `npm run build:data` erzeugt daraus `data/versmedv.json` (`scripts/versmedv_to_json.py`). Das K710-PDF wird nicht versioniert; nur bei einer neuen Broschüre wird der Auszug mit `pypdf` neu erzeugt:

```bash
python3 scripts/k710_extract.py source/k710-versorgungsmed-verordnung.pdf source/k710_stichwortverzeichnis.txt
```

## Fallprofil

Das **Fallprofil** ist ein versioniertes JSON-Format (Version 1), mit dem antragsberechtigte Personen ihre Situation für GdB-Antrag, Pflegebegutachtung und Eingliederungshilfe **einmal** strukturiert erfassen und in allen Abläufen, Skills und Agenten weiterverwenden können. Es bildet das biopsychosoziale Modell der ICF ab:

- **Einträge**: ICD-10-GM (`F20.0 G`), ICF b/s/d/e mit Beurteilungsmerkmal (`b160.2`, `d720.33`, `e310+3`), personbezogene Faktoren als Freitext, BI-Kodierungen (`BI:4.2.8=2`), VersMedV-Kennungen mit Einzel-GdB (`VMG:B 3.7`) und Merkzeichen. Je Eintrag möglich: Begründung, Belegverweis (Quelle, Datum, Seite), Herkunft (Selbstauskunft, Interview, Befund, Gutachten, Bescheid …), O-Ton, Status (belegt, geschildert, offen), Dauer und bei d-Einträgen eine Orientierung, an welche Stelle man sich wenden kann.
- **Zusammenhänge**: `verursacht` (Diagnose → ICF), `beeintraechtigt` (b/s → d), `foerdert`/`hemmt` (Umwelt- oder personbezogener Faktor → ICF), `entspricht` (zwischen ICF, BI und VersMedV).
- **Ziele** und gewünschte Unterstützung der Person, **Verfahren** (Antrag, Bescheid, Gutachten) mit Ergebnis.

Das Format hat **keine Felder für Namen, Anschriften, Versicherungs- oder Aktennummern**; unbekannte Felder werden abgelehnt. Das Profil bleibt beim Nutzer und wird vom Server nie gespeichert.

| Tool | Zweck |
| --- | --- |
| `fall_schema` | JSON-Schema, Feldbeschreibung und ein erfundenes Beispielprofil |
| `fall_pruefen` | Prüft Form und alle Kodes mit Klartext, prüft die Zusammenhänge, meldet Lücken (z. B. Bedarf ohne verknüpfte Ursache, Barriere ohne Bezug, doppelte Einträge, fehlende ICF-Komponente), ordnet d-Einträge den neun Lebensbereichen nach § 118 SGB IX zu, zeigt kuratierte Querverweise ICF ↔ BI und gibt je Herkunft eine Pflegegrad-Orientierung – **nur wenn alle Kriterien angegeben sind** |
| `fall_vergleichen` | Vergleicht zwei Fassungen: neue, weggefallene und veränderte Einträge, Zusammenhänge, Ziele, Verfahren, Einzel-GdB und Pflegepunkte – ohne Wertung |

Die Hinweise sagen, was noch fehlt, und bewerten den Fall nicht. Das Fallprofil ist **keine Rechtsberatung**. Schema und Beispiel liegen unter `data/fallprofil-1.schema.json` und `data/fallprofil-1.beispiel.json`. Gesamtplan der Fallarbeit und offene Punkte: [`docs/fallarbeit/`](docs/fallarbeit/).

## Teilhabe oder Pflege?

`abgrenzung_egh_pflege` zeigt zu ICF-Kategorien aus Aktivitäten und Teilhabe (`d510`, auch `d510.3`) den Lebensbereich nach § 118 SGB IX und eine **Orientierung**:

- `ueberschneidung`: Nach der kuratierten Zuordnung ist dem Bereich ein Kriterium des Begutachtungsinstruments zugeordnet (über eine Oberkategorie nur bei „entspricht“). Ausgegeben werden die BI-Kriterien, je Kriterium die getroffenen ICF-Kategorien, ob sie in den Pflegegrad eingehen (außerhäusliche Aktivitäten und Haushaltsführung gehen nicht ein), Kinderkriterien und Sonderregeln. Pflege (§ 36 SGB XI) und Eingliederungshilfe, etwa als Assistenz (§ 78 SGB IX), können nebeneinander in Betracht kommen.
- `teilhabe`: Kein BI-Kriterium zugeordnet; in Betracht kommen Leistungen zur Teilhabe.

Je Kategorie nennt die Erläuterung die Leistungsgruppe der Eingliederungshilfe: Bildung (d810–d839) § 112 SGB IX, Arbeit und Beschäftigung (d840–d859) § 111 SGB IX mit Hinweis auf vorrangige Rehabilitationsträger, sonst Soziale Teilhabe (§ 113 SGB IX). In besonderen Wohnformen umfasst die Eingliederungshilfe auch die Pflege (§ 103 SGB IX, § 43a SGB XI).

Eine Kennzeichnung „nur Pflege“ gibt es bewusst nicht: Die Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI, § 91 Abs. 3 SGB IX); es kommt auf den Zweck der Unterstützung an. Die Zuordnung baut auf der kuratierten Zuordnung von `bi_icf_mapping` auf und ist nicht amtlich. Das Werkzeug trifft **keine Zuständigkeitsentscheidung** und prüft keinen Anspruch. Mit `ICF_MCP_BI=0` entfällt es.

## Leistungen und Nachteilsausgleiche

`leistungshinweise` zeigt zu **festgestellten** Werten mögliche Leistungen und Nachteilsausgleiche. Eingaben: `gdb` (0–100), `merkzeichen` (G, aG, B, H, Bl, Gl, RF, TBl), `pflegegrad` (1–5) und optional `alter_monate`. Die Ausgabe enthält je Eintrag die Gruppe (`gdb`, `merkzeichen`, `pflege`, `schnittstelle`, `landesrecht`), das Signal, die Leistung, Normen mit Link auf gesetze-im-internet.de, die typische Stelle, den Rang (Vorrang/Nachrang), die Voraussetzung allgemein und einen nächsten Schritt; dazu die Herkunft und einen Beratungshinweis.

Der Katalog ist kuratiert (nicht amtlich); die Normen wurden an gesetze-im-internet.de geprüft. Das Werkzeug nennt **keine Beträge** und prüft weder Anspruch noch Einkommen oder Vermögen noch die Zuständigkeit im Einzelfall. Landesrecht (Blindengeld, Gehörlosengeld, Rundfunkbeitrag, Parkerleichterungen) erscheint nur als Hinweis „je Land verschieden“ ohne Normlink. Ein eigener Orientierungswert gehört nicht als festgestellter Wert hinein. Es ist **keine Rechtsberatung**.

## Verfahrenswege

`verfahren_info` erklärt **allgemein** und in einfacher Sprache, welche Wege es im Sozialrecht gibt: Widerspruch, Überprüfungsantrag (§ 44 SGB X), Neufeststellungs- bzw. Höherstufungsantrag (§ 48 SGB X), Akteneinsicht (§ 25 SGB X), Untätigkeitsklage (§ 88 SGG), Zuständigkeitsklärung bei Leistungen zur Teilhabe (§ 14 SGB IX) und Bekanntgabe eines Bescheids (§ 37 SGB X). Ohne Argument kommt eine Übersicht, mit `thema` ein Thema.

Je Thema: eine Erklärung (kuratiert, nicht amtlich), die Normen mit Link auf gesetze-im-internet.de und einem wörtlichen Auszug (amtlich), was man allgemein braucht, verwandte Themen und Besonderheiten (z. B. VwGO statt SGG in der Kinder- und Jugendhilfe, kürzere Rückwirkung im SGB II und SGB XII) sowie unabhängige Beratungsstellen (EUTB, Pflegeberatung nach § 7a SGB XI, Pflegestützpunkt, Sozialverbände).

Zur Frist verweist das Werkzeug nur auf die Rechtsbehelfsbelehrung des Bescheids; es **berechnet keine persönliche Frist** und empfiehlt keinen Weg im Einzelfall. Es ist **keine Rechtsberatung**.

## Prompts (geführte Abläufe)

Der Server bietet MCP-Prompts an, die Schritt für Schritt durch einen Fall führen. Clients wie Claude Desktop und Claude Code zeigen sie als auswählbare Vorlagen. Den Zustand trägt das Fallprofil im Gespräch; der Server speichert nichts. Die Abläufe richten sich an antragsberechtigte Personen und sind **keine Rechtsberatung**.

| Prompt | Zweck |
| --- | --- |
| `pflegegrad_interview` | Selbsteinschätzung vor einer Pflegebegutachtung: Modul für Modul in einfacher Sprache, mit Zwischenständen, Fallprofil, Orientierung zum Pflegegrad (nur bei vollständigen Angaben), Vorbereitungsliste und Vorlage für ein Pflegetagebuch. Argumente: `wer_antwortet`, `alter_monate` |
| `pflegegutachten_verstehen` | Ein Pflegegutachten verstehen: Einstufungen übernehmen, eigene Sicht zu zweifelhaften Kriterien erfragen, mit `bi_gegenueberstellen` jeden Unterschied erklären, Formulierungshilfen für eine eigene Darstellung, allgemeiner Hinweis auf Widerspruchsfrist laut Rechtsbehelfsbelehrung und unabhängige Beratung. Argument: `alter_monate` |
| `gdb_antrag_vorbereiten` | Antrag auf GdB und Merkzeichen vorbereiten: Diagnosen (ICD), Auswirkungen mit O-Ton, Befunde, eigene Orientierung an Zeilen der GdS-Tabelle mit `vmg_spanne_pruefen`, Merkzeichen im Wortlaut, Bitte um Befundberichte; kein Gesamt-GdB als Zahl, Nachteilsausgleiche nur allgemein. Argumente: `wer_antwortet`, `alter_monate` |
| `gdb_bescheid_verstehen` | GdB-Bescheid verstehen: Funktionsbeeinträchtigungen und Einzel-GdB Zeilen zuordnen und erklären, `vmg_gesamt_gdb` als Prüfhilfe, Unterschiede zur eigenen Sicht, Wege allgemein mit `verfahren_info`. Argument: `alter_monate` |
| `teilhabebedarf_erfassen` | Eigenen Teilhabebedarf beschreiben: Ziele und Wünsche, die neun Lebensbereiche nach § 118 SGB IX in Ich-Form mit O-Ton, ICF- und ICD-Kodes, Umweltfaktoren, Orientierung Pflege/Eingliederungshilfe, Zuständigkeit allgemein; bei Kindern § 35a SGB VIII. Argumente: `wer_antwortet`, `alter_monate` |
| `bedarfsfeststellung_verstehen` | Bedarfsermittlung, Gesamtplan bzw. Teilhabeplan oder Bescheid verstehen: kommen eigene Bedarfe, Wünsche und Ziele vor, wo fehlen Belege; Abgleich mit `fall_vergleichen`, Wege allgemein mit `verfahren_info`. Argument: `alter_monate` |
| `leistungen_finden` | Mögliche Leistungen und Nachteilsausgleiche zu festgestellten Werten finden: `leistungshinweise`, Einträge nach Lebenslage ordnen, nächster Schritt und typische Stelle allgemein, Landesrecht als „je Land verschieden“, Beratung (EUTB, § 7a SGB XI). Argument: `wer_antwortet` |
| `eigene_darstellung_vorbereiten` | Die eigene Situation sachlich aufschreiben: Tatsachen, Beobachtungen, Belege und O-Ton getrennt erfassen (auch aus dem Fallprofil), Lücken mit `fall_pruefen` finden, Wege allgemein mit `verfahren_info` erklären, Gliederung der eigenen Darstellung ohne rechtliche Begründung, Verweis auf unabhängige Beratung. Argumente: `wer_antwortet`, `bereich` (`gdb`, `pflege`, `teilhabe`) |

Mit `ICF_MCP_BI=0` entfallen beide Pflege-Prompts, mit `ICF_MCP_VMG=0` beide GdB-Prompts; die Teilhabe-Prompts, `leistungen_finden` und `eigene_darstellung_vorbereiten` bleiben und nennen dann keine Werkzeuge der abgeschalteten Module.

## Online-Konnektor (ohne Installation)

Der Server läuft öffentlich auf Netlify:

```
https://icf-icd-mcp.netlify.app/mcp
```

- **claude.ai und Claude Desktop:** *Einstellungen → Konnektoren → Benutzerdefinierten Konnektor hinzufügen*, Name z. B. „ICF & ICD-10-GM“, die URL oben eintragen, ohne OAuth. Der Konnektor steht dann auch in der Claude-App auf dem Handy zur Verfügung.
- **Claude Code:** `claude mcp add --transport http icf-icd https://icf-icd-mcp.netlify.app/mcp`

Der Endpunkt ist ohne Anmeldung erreichbar, nur lesend und auf 120 Anfragen pro Minute begrenzt. Abfragen werden nicht gespeichert; protokolliert wird nur, welches Tool aufgerufen wurde.

## Lokale Installation

Repository klonen:

```bash
git clone https://github.com/politpatrick/icf-icd-mcp.git ~/GitHub/icf-icd-mcp
```

### Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json` (oder über *Einstellungen → Entwickler → Konfiguration bearbeiten*):

```json
{
  "mcpServers": {
    "icf": {
      "command": "node",
      "args": ["/Users/<name>/GitHub/icf-icd-mcp/src/server.mjs"]
    }
  }
}
```

Danach Claude Desktop komplett beenden und neu starten. Falls `node` nicht gefunden wird, den vollen Pfad angeben (`which node`, z. B. `/opt/homebrew/bin/node`).

### Claude Code

```bash
claude mcp add --scope user icf -- node ~/GitHub/icf-icd-mcp/src/server.mjs
```

### Ohne Klon (direkt von GitHub)

```bash
claude mcp add --scope user icf -- npx -y github:politpatrick/icf-icd-mcp
```

## Projektstruktur

```
src/                 MCP-Server
  server.mjs         Einstieg (stdio)
  http.mjs           Einstieg über HTTP (Streamable HTTP, zustandslos)
  protocol.mjs       JSON-RPC/MCP-Protokoll und Tool-Definitionen
  icf.mjs            ICF: Datenzugriff und Abfragelogik
  icd.mjs            ICD-10-GM: Datenzugriff und Abfragelogik
  bi.mjs             Begutachtungsinstrument SGB XI: Wissensnetz, Kodierung, Pflegegrad-Rechner
  bi_tools.mjs       Tool-Definitionen für bi.mjs (abschaltbar mit ICF_MCP_BI=0)
  vmg.mjs            VersMedV: Gliederung, Abruf, Suche, ICD-Ableitung, Prüfhilfen
  vmg_tools.mjs      Tool-Definitionen für vmg.mjs (abschaltbar mit ICF_MCP_VMG=0)
  verfahren.mjs      Verfahrenswege: kuratierte Erklärungen und wörtliche Normauszüge
  verfahren_tools.mjs Tool-Definition für verfahren_info
  teilhabe.mjs       Orientierung Eingliederungshilfe/Pflege je ICF-d-Kategorie
  teilhabe_tools.mjs Tool-Definition für abgrenzung_egh_pflege (mit dem BI-Modul abschaltbar)
  leistungen.mjs     Leistungen und Nachteilsausgleiche: kuratierter Katalog, Auswahl nach GdB, Merkzeichen, Pflegegrad
  leistungen_tools.mjs Tool-Definition für leistungshinweise
  data.mjs           Lädt die JSON-Daten (lokal und in Netlify Functions)
  graph.mjs          Wissensnetz: Kanten, Rückverweise, Bereiche, kürzeste Wege
  text.mjs           Gemeinsame Hilfen (Suche, Fehler)
netlify/functions/   Netlify Function für den Online-Endpunkt /mcp
public/              Startseite des Online-Endpunkts
data/                Generierte Daten (icf_flat.json, qualifiers.json, icd10gm.json, bi.json, versmedv.json)
source/              ClaML-Quelldateien von ICF und ICD-10-GM; BRi-Textauszug und bi_struktur.json (PDF nur lokal), VersMedV-XML und K710-Stichwortverzeichnis (Textauszug)
scripts/             Konvertierung ClaML → JSON (icf_to_json.py, icd_to_json.py, build_data.sh),
                     BRi → JSON (bri_extract.py, bi_to_json.py)
                     VersMedV → JSON (versmedv_to_json.py, k710_extract.py)
                     und graphify-Export (export_graphify.mjs, build_graphify.sh)
test/                Tests
```

## Entwicklung

```bash
npm test             # Tests (node:test)
npm start            # Server auf stdio starten
npm run build:data   # data/ aus source/ neu erzeugen (Python 3.9+)
```

### Neue ICD-10-GM-Version oder Alpha-ID-SE

Die ICD-10-GM 2026 gilt nach Planung des BfArM bis Ende 2028; die nächste Version ist die ICD-10-GM 2029. Die Datei Alpha-ID-SE erscheint dagegen jährlich (im Herbst, für das Folgejahr) mit aktualisierten Orpha-Kennnummern und teils neuen Einträgen.

1. Beim BfArM herunterladen: bei einer neuen ICD-Version *ICD-10-GM … Systematik ClaML* und *Alphabet EDV-Fassung TXT*, jährlich *Alpha-ID-SE EDV-Fassung TXT*.
2. Die XML aus `Klassifikationsdateien/` bzw. die TXT-Dateien nach `source/` kopieren und die alten Versionen löschen.
3. `npm run build:data` und `npm test` ausführen. `build_data.sh` nimmt automatisch die neueste `icd10gm*syst_claml_*.xml`, `icd10gm*alpha_edvtxt_*.txt` und `*alphaidse*_edvtxt_*.txt`.
4. Die Versionsangaben und Zahlen in `QUELLEN.md` und hier anpassen.

### VersMedV aktualisieren

1. Von gesetze-im-internet.de `https://www.gesetze-im-internet.de/versmedv/xml.zip` herunterladen und die XML nach `source/versmedv_BJNR241200008.xml` entpacken.
2. `npm run build:data` und `npm test` ausführen. Die von Hand gepflegten Teile (Tabelle `OVERRIDES` in `scripts/versmedv_to_json.py`) brechen den Build mit einer Fehlermeldung ab, wenn der Wortlaut sich geändert hat; dann die Überschreibung am neuen Text prüfen und anpassen.
3. Bei einer neuen K710-Broschüre den Auszug mit `scripts/k710_extract.py` neu erzeugen.
4. Stand und Quellenangaben in `QUELLEN.md` anpassen.

### Wissensnetz in graphify

```bash
scripts/build_graphify.sh
```

Das Skript exportiert das Wissensnetz im Extraktionsformat von [graphify](https://github.com/Graphify-Labs/graphify) und baut damit `graphify-out/graph.json`, inklusive Themengruppen. Dafür wird kein Sprachmodell aufgerufen. Alle Kanten sind `EXTRACTED` mit Konfidenz 1,0 und tragen den Ausschlusstext als Quelle. Danach funktionieren die graphify-Befehle und der graphify-MCP-Server:

```bash
graphify path "F32.1 Mittelgradige depressive Episode" "F33.1 Rezidivierende depressive Störung, gegenwärtig mittelgradige Episode" --undirected
graphify explain "F33 Rezidivierende depressive Störung"
```

Beziehungen: `ist_teil_von`, `schliesst_aus`, `verweist_auf`, `kreuz_stern`, `nennt_im_hinweis` und `umfasst` (Bereichsknoten wie „Bereich J00-J22“ → enthaltene Gruppen und Kategorien). `graphify-out/` wird nicht versioniert.

### Online-Endpunkt aktualisieren

Das Netlify-Projekt `icf-icd-mcp` hat keinen Build-Schritt. `netlify.toml` liefert `public/` aus, die Function unter `netlify/functions/` und die Daten aus `data/` (per `included_files`). Ist das Projekt in Netlify mit diesem GitHub-Repo verknüpft, wird jeder Push auf `main` automatisch veröffentlicht; sonst mit `netlify deploy --prod`.

Manuell testen lässt sich der Server, indem man JSON-RPC-Zeilen auf stdin schickt:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"icf_interpret_coding","arguments":{"coding":"d450.23"}}}' | node src/server.mjs
```

## Hinweis zu den Daten

ICF und ICD-10-GM sind Klassifikationen der Weltgesundheitsorganisation (WHO) in der deutschen Fassung des Bundesinstituts für Arzneimittel und Medizinprodukte (BfArM). Sie werden unverändert und mit den vorgeschriebenen Quellenangaben weitergegeben, siehe [QUELLEN.md](QUELLEN.md). Verbindlich ist jeweils das PDF des Systematischen Verzeichnisses beim BfArM.

Die Tools liefern Klassifikationsinhalte, keine fachliche Bewertung im Einzelfall. Das gilt auch für `bi_calculate`: Es rechnet nach Anlage 2 zu § 15 SGB XI, ersetzt aber keine Begutachtung. Die VersMedV-Prüfhilfen (`vmg_gesamt_gdb`, `vmg_merkzeichen`) ersetzen keine gutachterliche Gesamtschau.
