# Fallprofil: Austauschformat und Prüfwerkzeuge

Stand: 20.11.2026 · Größe: Projekt (neues, modulübergreifendes Werkzeug) · Schritt 1 des Plans „Fallarbeit“

## Warum

Antragsberechtigte Personen sollen ihre Situation für GdB-Antrag, Pflegebegutachtung und
Eingliederungshilfe **einmal** strukturiert erfassen und in allen Abläufen weiterverwenden können.
Heute gibt es je Modul eine eigene Kodier-Schreibweise und ein eigenes Prüfwerkzeug, aber nichts, was die
Ergebnisse eines Falls zusammenhält. Andere Skills, MCP-Server, Chats und Agenten sollen das Ergebnis lesen
können, ohne den Kontext neu zu erfragen.

Das Fallprofil bildet das **biopsychosoziale Modell der ICF** ab: Gesundheitsproblem, Körperfunktionen und
-strukturen, Aktivitäten und Teilhabe, Umweltfaktoren und personbezogene Faktoren **sowie deren
Zusammenhänge**. Ein Bedarf wird erst durch diese Wechselwirkung nachvollziehbar, nicht durch eine
d-Kategorie allein.

## Zielgruppe und Grenzen (verbindlich)

- Nutzerinnen und Nutzer sind **antragsberechtigte Personen**, ggf. mit einer unterstützenden Person in
  ihrem Auftrag. Keine Fachkräfte- oder Leistungsträger-Perspektive.
- **Keine Rechtsberatung.** Das Fallprofil und seine Werkzeuge informieren und ordnen. Sie bewerten keine
  Erfolgsaussichten, empfehlen keinen Rechtsbehelf und beurteilen keine Rechtmäßigkeit.
- **Keine Interna.** Nur öffentliche Grundlagen (Gesetz, amtliche Klassifikationen, BRi, VersMedV).

## Ziele

1. **Ein Format** (`fallprofil` Version 1) mit JSON-Schema, das ICD-, ICF-, BI- und VersMedV-Einträge,
   personbezogene Faktoren, Zusammenhänge, Ziele und Verfahrensangaben bündelt. Jeder Eintrag kann
   Begründung, Belegverweis, Herkunft, O-Ton, Status und Dauer tragen.
2. **`fall_schema`**: liefert Schema, Feldbeschreibung und ein Beispielprofil, damit jeder Client und jeder
   Agent das Format ohne weitere Quelle erzeugen kann.
3. **`fall_pruefen`**: prüft ein Profil in einem Durchgang und gibt zurück:
   - Formfehler mit Pfad (z. B. `eintraege[3].kode`),
   - je Eintrag die Klartext-Übersetzung aus dem zuständigen Modul,
   - Prüfung der Zusammenhänge (Ziele existieren, Beziehungsart passt zu den Komponenten),
   - **Hinweise auf Lücken** (siehe unten),
   - Gruppierung der d-Einträge nach den neun Lebensbereichen (§ 118 Abs. 1 SGB IX = ICF-Kapitel d1–d9),
   - Querverweise ICF ↔ BI aus der kuratierten Zuordnung (gekennzeichnet als nicht amtlich),
   - je Herkunft mit BI-Einträgen eine Punkte- und Pflegegrad-Orientierung über die bestehende Berechnung.
4. **`fall_vergleichen`**: vergleicht zwei Fassungen eines Profils (z. B. vor einem Jahr und heute) und
   zeigt neu, weggefallen und verändert, je mit den Begründungen beider Fassungen; bei BI und VersMedV auch
   die Auswirkung auf Punkte bzw. Werte.

## Nicht-Ziele

- Keine Speicherung auf dem Server; das Profil liegt beim Nutzer (Chat, Datei).
- Keine Prompts in diesem Schritt (folgen ab Schritt 2), kein `bi_gegenueberstellen`, kein
  `vmg_spanne_pruefen`, keine Leistungshinweise.
- Kein vollständiger JSON-Schema-Validator; geprüft wird genau das, was das Schema beschreibt.
- Keine Anbindung an FHIR oder andere Austauschstandards.
- Keine Bewertung, ob ein Bedarf „anerkannt“ wird; Lückenhinweise sind Hinweise zur Vollständigkeit.

## Anti-Ziele

- Das Profil darf **keine Felder für Namen, Anschriften, Versicherungs- oder Aktennummern** haben; unbekannte
  Felder werden abgelehnt statt übernommen (Datensparsamkeit durch das Format selbst).
- Lückenhinweise dürfen nicht wie eine Bewertung des Falls klingen („Bedarf nicht begründet“), sondern
  sagen, was fehlt („Zu d450 ist noch keine Ursache verknüpft“).
- Kuratierte Querverweise dürfen nicht als amtliche Zuordnung erscheinen.
- Bestehende Tools ändern ihr Verhalten nicht.

## Rahmenbedingungen

- Keine npm-Abhängigkeiten, Node ≥ 18. Die Prüfung nutzt die vorhandenen Modulfunktionen
  (`icd.checkCode`, `icf.interpretCoding`, `bi.interpretCoding`, `bi.calculate`, `bi.biForIcf`,
  `vmg.get`/`vmg.normalizeVmgId`).
- Funktioniert auch, wenn BI oder VersMedV abgeschaltet sind (`ICF_MCP_BI=0`, `ICF_MCP_VMG=0`): Einträge
  dieser Arten werden dann nicht geprüft, sondern mit einem Hinweis versehen.
- Läuft über stdio und den öffentlichen Netlify-Endpunkt; Eingaben werden nicht protokolliert oder gespeichert.
  `fall_pruefen` gibt einmal je Aufruf einen kurzen Datenschutzhinweis aus (Pseudonym, keine Namen).
- Größenbegrenzung gegen Missbrauch: höchstens 500 Einträge, 1.000 Zusammenhänge, 2.000 Zeichen je Textfeld.

## Ansätze

| Ansatz | Vorteil | Nachteil |
| --- | --- | --- |
| **A: JSON-Profil beim Nutzer, zustandslose Prüfwerkzeuge** (gewählt) | Keine Falldaten auf dem Server, funktioniert in jedem Client, jeder Agent kann es lesen und schreiben | Das Profil muss bei jedem Aufruf mitgeschickt werden |
| B: Speicherung auf dem Server mit Fall-ID | Kleine Aufrufe | Gesundheitsdaten auf einem öffentlichen Server, Zustand, Löschpflichten; widerspricht dem Projektgrundsatz |
| C: Nur eine Text-Konvention ohne Prüfwerkzeug | Kein Code | Keine Konsistenz, jeder Agent schreibt es anders |

Entschieden für A.

## Das Format (Version 1)

Oberste Ebene:

```json
{
  "fallprofil": "1",
  "meta": { "pseudonym": "Fall A", "alter": { "jahre": 54 }, "antwortet": "person_mit_unterstuetzung",
            "zweck": ["gdb", "pflege", "teilhabe"], "stichtag": "2026-11-20", "fassung": 2 },
  "eintraege": [ … ],
  "zusammenhaenge": [ … ],
  "ziele": [ … ],
  "verfahren": [ … ]
}
```

**`meta`**
- `pseudonym` (Pflicht, max. 60 Zeichen) – frei gewählte Bezeichnung, **kein Klarname** (Hinweis im Schema).
- `alter` – `{ "jahre": n }` oder `{ "monate": n }` (für Kinder), kein Geburtsdatum.
- `antwortet` – `person` · `person_mit_unterstuetzung` · `unterstuetzende_person`.
- `zweck` – Teilmenge von `gdb`, `pflege`, `teilhabe`, `sonstiges`.
- `stichtag` (Pflicht, JJJJ-MM-TT), `fassung` (ganze Zahl ≥ 1).

**`eintraege[]`** – jedes Element:

| Feld | Pflicht | Inhalt |
| --- | --- | --- |
| `id` | ja | eindeutig im Profil, Muster `[a-z0-9_-]{1,40}` |
| `art` | ja | `icd` · `icf` · `bi` · `vmg` · `merkzeichen` · `personbezogen` |
| `kode` | außer `personbezogen` | in der Schreibweise des Moduls: `F20.0 G` · `d450.23` · `e310+3` · `BI:4.1.3=2` · `BI:4.5.1=3/Tag` · `VMG:B 3.7` · Merkzeichen `G`, `aG`, `B`, `H`, `Bl`, `Gl`, `RF`, `TBl` |
| `gdb` | nur bei `vmg`, optional | Einzel-GdB als Zehnerwert (wie in `vmg_gesamt_gdb`) |
| `text` | bei `personbezogen` Pflicht, sonst optional | Freitext |
| `begruendung` | nein | kurze Begründung |
| `beleg` | nein | `{ "quelle": "Befund Neurologie", "datum": "2026-10-03", "seite": "2" }` – Bezeichnungen, keine Dokumentinhalte |
| `herkunft` | ja | `selbstauskunft` · `interview` · `material` · `befund` · `gutachten` · `bescheid` |
| `verfahren` | nein | Verweis auf `verfahren[].id`, aus dem der Eintrag stammt (z. B. das Gutachten) |
| `o_ton` | nein | Aussage der Person in eigenen Worten |
| `status` | nein (Standard `geschildert`) | `belegt` · `geschildert` · `offen` |
| `dauer` | nein | `dauerhaft` · `voruebergehend` · `unbekannt` |
| `richtung` | nein, nur `icf` mit d-Kode | Orientierung `eingliederungshilfe` · `ueberschneidung` · `pflege` |

**`zusammenhaenge[]`** – `{ "von": id, "nach": id, "art": …, "begruendung"? }`, Arten:
- `verursacht` – von `icd` zu `icf` (b/s/d)
- `beeintraechtigt` – von `icf` b/s zu `icf` d
- `foerdert` / `hemmt` – von `icf` e oder `personbezogen` zu `icf` d (oder b/s)
- `entspricht` – zwischen `icf` und `bi` bzw. `vmg` (gleicher Sachverhalt in anderem System)

**`ziele[]`** – `{ "id", "text", "eintraege": [ids], "gewuenschte_unterstuetzung"? }`: Ziele und Wünsche der Person.

**`verfahren[]`** – `{ "id", "art": "antrag|bescheid|gutachten|widerspruch|sonstiges", "bereich": "gdb|pflege|teilhabe|sonstiges", "datum"?, "ergebnis"? }`;
`ergebnis` je nach Bereich `{ "pflegegrad": 0–5 }`, `{ "gdb": n, "merkzeichen": [...] }` oder `{ "text": … }`.
Kein Aktenzeichen-Feld.

Unbekannte Felder werden auf jeder Ebene als Fehler gemeldet.

## Lückenhinweise in `fall_pruefen` (abschließende Liste für Version 1)

| Kennung | Bedingung | Hinweistext (sinngemäß) |
| --- | --- | --- |
| `d_ohne_ursache` | `icf`-d-Eintrag ohne eingehenden `verursacht`/`beeintraechtigt` | „Zu d450 (Gehen) ist noch keine Ursache (Gesundheitsproblem oder Körperfunktion) verknüpft.“ |
| `barriere_ohne_bezug` | `icf`-e-Eintrag mit Barriere (`.`-Merkmal) ohne ausgehenden `hemmt` | „Die Barriere e150 wirkt auf keinen Eintrag.“ |
| `foerderfaktor_ohne_bezug` | e mit `+` ohne ausgehenden `foerdert` | analog |
| `offen` | Eintrag mit `status: offen` | „Noch offen: …“ (Liste) |
| `ohne_beleg` | `status: belegt` ohne `beleg` | „Als belegt markiert, aber kein Beleg angegeben.“ |
| `komponente_fehlt` | `zweck` enthält `teilhabe` und eine der fünf Komponenten fehlt (icd, b/s, d, e, personbezogen) | „Für eine Bedarfsbeschreibung fehlen noch: Umweltfaktoren.“ |
| `doppelt` | gleicher Kode (ohne Beurteilungsmerkmal bzw. gleiche BI-Kennung) **und gleiche Herkunft** zweimal | „d450 ist zweimal aus der Selbstauskunft erfasst.“ Unterschiedliche Herkunft ist erlaubt (Gegenüberstellung). |
| `ziel_ohne_bezug` | Ziel ohne `eintraege` | „Ziel … ist noch keinem Eintrag zugeordnet.“ |
| `modul_aus` | Eintrag eines abgeschalteten Moduls | „VersMedV-Modul ist abgeschaltet; Eintrag nicht geprüft.“ |

Ungültige Kodes sind Fehler (nicht Hinweise) und enthalten die Meldung des Moduls, z. B. mit Vorschlägen.

## Antwort von `fall_pruefen` (Gliederung)

```text
{ fallprofil, gueltig, fehler[{pfad, meldung}], datenschutz,
  eintraege[{id, art, kode, klartext, warnungen[]}],
  zusammenhaenge[{von, nach, art, gueltig, meldung?}],
  hinweise[{kennung, eintraege[], text}],
  lebensbereiche[{nummer 1–9, titel, eintraege[]}],
  querverweise[{icf, bi_kriterien[], quelle: "kuratiert, nicht amtlich"}],
  pflege[{herkunft, gesamtpunkte, pflegegrad, hinweis}] }
```

`gueltig` ist `false`, sobald ein Formfehler oder ungültiger Kode vorliegt; die übrigen Teile werden für alle
gültigen Einträge trotzdem geliefert.

## `fall_vergleichen`

- Eingabe `alt`, `neu` (zwei Profile). Beide werden zuerst wie in `fall_pruefen` auf Form geprüft; bei
  Formfehlern Abbruch mit Fehlerliste.
- Zuordnung von Einträgen über `(art, Grundkode, herkunft)`; Grundkode ohne Beurteilungsmerkmal bzw. BI-Kennung
  ohne Wert, VMG-Kennung, Merkzeichen. Ids müssen zwischen Fassungen nicht übereinstimmen.
- Ausgabe: `neu[]`, `weggefallen[]`, `veraendert[{vorher, nachher, begruendung_vorher, begruendung_nachher}]`
  (geändertes Merkmal, Stufe, Häufigkeit, GdB oder Status), `unveraendert` (Anzahl);
  bei BI je Herkunft die Punkte und den Pflegegrad beider Fassungen; Stichtage beider Fassungen.
- Keine Wertung („verschlechtert“) – nur die Veränderung und bei BI die Punktdifferenz.

## Festgelegtes Vorgehen

- Neues Modul `src/fall.mjs` (Validierung, Prüfung, Vergleich) und `src/fall_tools.mjs` (drei Tools
  `fall_schema`, `fall_pruefen`, `fall_vergleichen`), eingebunden in `src/protocol.mjs` ohne Schalter
  (immer an; nutzt BI/VMG nur, wenn eingeschaltet).
- Schema als Datei `data/fallprofil-1.schema.json` (JSON Schema 2020-12) plus `data/fallprofil-1.beispiel.json`
  (unter `data/`, damit `readData` und `included_files = ["data/*.json"]` sie ohne Änderung finden);
  `fall_schema` liefert beide und eine kurze Feldbeschreibung. Die Dateien kommen in `package.json` (`files`). Ein Test stellt sicher, dass das Beispiel gültig ist und dass Schema
  und Prüfcode dieselben Feldnamen und Aufzählungswerte kennen.
- Namen der neun Lebensbereiche wörtlich nach § 118 Abs. 1 SGB IX (vom Builder an gesetze-im-internet.de
  zu verifizieren).
- Server-Instructions: ein Absatz zum Fallprofil (Zweck, kein Klarname, keine Rechtsberatung).
- README-Abschnitt, Version 1.7.0.
- Tests mindestens: Beispiel gültig; unbekanntes Feld `name` wird abgelehnt; ungültiger Kode mit Pfad;
  alle Lückenhinweise je einmal ausgelöst; Doppelung nur bei gleicher Herkunft; Lebensbereiche d1–d9;
  BI-Orientierung je Herkunft; Größenlimits; `fall_vergleichen` mit neu/weggefallen/verändert;
  Verhalten mit `ICF_MCP_VMG=0`.

## Festlegungen aus dem Builder-Check (Entscheidungen des Designers)

1. **Fehler oder Warnung bei Kodes.**
   - **Fehler** (`gueltig: false`): Kodes, die das Modul nicht auflösen kann (unbekannt, falsch geschrieben,
     unbekannte BI- oder VMG-Kennung, VMG-Kennung, die `vmg.get` nicht findet).
   - **Warnung** am Eintrag (`warnungen[]`, Profil bleibt gültig): fehlendes ICF-Beurteilungsmerkmal,
     ICF-Kapitel statt Kategorie (`d4`, „zu allgemein“), nicht endständiger ICD-Kode (`F20`), Hinweise des
     ICD-Moduls zu Stern-/Kreuz-Kodes. Entwürfe mit `status: offen` sollen ohne Merkmal möglich sein.
   - e-Kodes ohne Merkmal lösen statt `barriere_ohne_bezug`/`foerderfaktor_ohne_bezug` den Hinweis
     `umweltfaktor_ohne_merkmal` aus („Ist e150 Barriere oder Förderfaktor?“).
2. **Pflege-Orientierung nur bei vollständigen Angaben.** Je Herkunft wird Gesamtpunkte und Pflegegrad nur
   ausgegeben, wenn **alle** Kriterien der Module 1–6 (für das Alter zutreffende Fassung) kodiert sind. Sonst
   `pflege[]` mit `vollstaendig: false`, Anzahl und Liste der fehlenden Kriterien und **ohne** Punkte und Grad
   (Begründung: ein unvollständiger Wert sieht aus wie ein Ergebnis und weckt falsche Erwartungen).
   - Alter: maßgeblich zum `stichtag`; `monate` direkt, `jahre` × 12. Bei Kindern unter 11 Jahren empfiehlt
     das Schema `monate` (Grenzen 18 Monate und 11 Jahre). Ohne `alter` gilt die Erwachsenenfassung, mit
     Hinweis `alter_fehlt`, sobald BI-Einträge vorhanden sind.
3. **Zusammenhänge: feste Liste erlaubter Paare.** Erlaubt (gerichtet `von → nach`):

   | Art | von | nach |
   | --- | --- | --- |
   | `verursacht` | icd | icf (b, s, d) |
   | `beeintraechtigt` | icf b/s | icf d |
   | `foerdert`, `hemmt` | icf e, personbezogen | icf b/s/d |
   | `entspricht` (ungerichtet) | icf, bi, vmg | icf, bi, vmg (verschiedene Arten) |

   Andere Paare sind **Fehler** am Zusammenhang (`gueltig: false` für den Zusammenhang, nicht für das ganze
   Profil). `d_ohne_ursache` zählt nur eingehende `verursacht` und `beeintraechtigt`.
4. **`fall_vergleichen`.**
   - `personbezogen` wird über den normalisierten `text` zugeordnet; kommt ein Schlüssel in einer Fassung
     mehrfach vor, werden die Einträge in Reihenfolge zugeordnet und der Vergleich trägt den Hinweis
     `mehrdeutig`.
   - Verglichen werden auch `zusammenhaenge` (über die aufgelösten Grundkodes beider Enden), `ziele` (über
     den Text) und `verfahren` (über Art, Bereich, Datum).
   - Als „verändert“ zählen Merkmal, Stufe, Häufigkeit, GdB, Status, Dauer, Richtung sowie bei ICD die
     Zusatzkennzeichen. Begründung, Beleg und O-Ton werden mit ausgegeben, zählen aber nicht als Veränderung.
5. **Weitergereichte Felder.**
   - `richtung` erscheint in `eintraege[]` und in `lebensbereiche[]` je Eintrag.
   - `verfahren`-Verweise in Einträgen werden geprüft (Fehler, wenn die Id fehlt).
   - `ergebnis` wird gegen `bereich` geprüft: `pflegegrad` 0–5, `gdb` 20–100 in Zehnern, `merkzeichen` aus der
     Liste.
6. **VersMedV und Merkzeichen.**
   - `vmg`-Kennungen müssen über `vmg.get` auflösbar sein.
   - `gdb` ist eine Angabe der Person oder des Bescheids (10–100 in Zehnern). Ein Abgleich mit der
     Teil-B-Spanne folgt erst mit `vmg_spanne_pruefen` (Schritt 4).
   - `fall_vergleichen` zeigt nur die Differenz der `gdb`-Werte und ruft `vmg_gesamt_gdb` nicht auf.
   - `merkzeichen` wird nur gegen die Liste geprüft und ist vom Schalter `ICF_MCP_VMG` unabhängig.
7. **Grundkode für `doppelt` und Vergleich.**
   - ICD ohne Zusatzkennzeichen: `F20.0 G` und `F20.0 V` sind derselbe Grundkode. Bei gleicher Herkunft ist
     das ein Hinweis `doppelt` mit dem Zusatz „widersprüchliche Diagnosesicherheit“.
   - ICF ohne Beurteilungsmerkmal: `e310+3` und `e310.2` sind derselbe Grundkode, also `doppelt`.
8. **Eingabe und Fehlerform.**
   - Profile werden als Objekt **oder** als JSON-String angenommen.
   - Nicht lesbare Eingaben, Formfehler und Größenverletzungen kommen als `fehler[]` mit `gueltig: false`
     zurück, nicht als Protokollfehler. Unerwartete Ausnahmen werden abgefangen und als verständlicher Fehler
     gemeldet.
   - Gegen Namen in Freitexten gibt es keine Erkennung, nur den Datenschutzhinweis in der Antwort und die
     Beschreibung im Schema.

## Dem Builder überlassen

- Struktur der internen Validierungsfunktionen und Fehlermeldungstexte (deutsch, laienverständlich).
- Wie die Klartext-Übersetzung je Eintrag gekürzt wird (kein vollständiger Modul-Output, sondern Titel,
  Merkmalsbedeutung bzw. Stufe/Label).
- Ob `fall_schema` das Schema als Objekt oder als String liefert.
- Reihenfolge und Sortierung der Ausgabelisten.
