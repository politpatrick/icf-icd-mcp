# Alphabetisches Verzeichnis der ICD-10-GM in `icd_search`

Stand: 17.11.2026 · Größe: kleine Erweiterung eines bestehenden Tools

## Warum

`icd_search` findet nur Titel und Einschlüsse der Systematik. Viele Begriffe aus der Praxis kommen dort
nicht vor: „Ziegenpeter“, „Zuckerkrankheit“, „Burnout“ und „Wochenbettdepression“ liefern heute 0 Treffer.
Das Alphabetische Verzeichnis des BfArM enthält rund 89.000 Diagnosetexte mit Synonymen und Kode.
Mit ihm findet die Suche auch Alltags- und Laienbegriffe. Alpha-ID-SE ergänzt dazu die
Orpha-Kennnummern für seltene Erkrankungen.

## Ziele

- `icd_search` findet Kodes auch über Alphabet-Begriffe und zeigt, über welchen Begriff ein Treffer
  gefunden wurde.
- Kombinationen aus dem Alphabet (Kreuz/Stern, Zusatzkode mit !, zwei Primärkodes) werden vollständig
  angezeigt, z. B. „Typhus-Meningitis → A01.0† G01*“.
- Verweise („Zuckerkrankheit – s.a. Diabetes mellitus“, „Clavicula – s. Klavikula“) erscheinen als Hinweis
  neben den Treffern.
- Treffer zeigen ihre Orpha-Kennnummer, wenn es eine gibt, und man kann nach einer Orpha-Nummer suchen
  (z. B. „ORPHA:173“).

## Nicht-Ziele

- Kein neues Tool, nur `icd_search` wird erweitert.
- Keine Entschlüsselung alter oder gestrichener Alpha-IDs. Die 1.594 ungültigen Einträge aus Alpha-ID-SE
  bleiben draußen.
- Keine Suche nach Alpha-ID und keine Orpha-Liste in `icd_get_code` (ließe sich später ergänzen).
- Keine Änderung an ICF oder BI.

## Anti-Ziele

- Ein Alphabet-Treffer darf nie wie ein eigener Kode aussehen oder die Systematik überstimmen. Maßgeblich ist
  das Systematische Verzeichnis, und die Ergebnisse sagen das.
- Treffer aus Titeln der Systematik dürfen nicht hinter Alphabet-Treffern verschwinden. Was heute gut
  gefunden wird, bleibt mindestens so gut.

## Rahmenbedingungen

- BfArM-Downloadbedingungen wie bei der Systematik: Texte unverändert (§ 62 UrhG), Quelle angeben (§ 63 UrhG).
  QUELLEN.md bekommt einen Abschnitt für beide Dateien, mit OID (Alphabet 1.2.276.0.76.5.554,
  Alpha-ID-SE 1.2.276.0.76.5.556) und dem Hinweis auf die Orphanet-Herkunft der Orpha-Kennnummern.
- Keine Abhängigkeiten, Node ≥ 18, Build-Skript in Python mit Standardbibliothek wie die bestehenden.
- Die Daten laufen auch in der Netlify-Function, deshalb gehört die neue Datei in `package.json` (`files`) und in
  `netlify.toml` (`included_files`).

## Ansätze

| Ansatz | Vorteil | Nachteil |
| --- | --- | --- |
| **A: Alphabet als Grundlage, Orpha aus Alpha-ID-SE dazu** (gewählt) | Alle Verweise bleiben erhalten (309 reine Verweissätze, 590 Verweise im Text), dazu Orpha | Zwei Quelldateien |
| B: nur Alpha-ID-SE | Eine Datei, Orpha dabei | Alle Verweise fehlen, gerade die helfen bei Laienbegriffen und Schreibweisen |
| C: nur Alphabet | Eine Datei | Keine Orpha-Nummern, obwohl die Verknüpfung trivial ist |

Entschieden für A. Die Verknüpfung läuft über die laufende Nummer: Alphabet-Feld 2 `109254` entspricht der
Alpha-ID `I109254`. Alle 89.304 gültigen Alpha-IDs haben einen Alphabet-Eintrag. Nur die 309 reinen
Verweissätze haben keine Alpha-ID.

## Festgelegtes Vorgehen

- **Quellen** liegen versioniert unter `source/`, wie die ClaML-Dateien:
  `icd10gm2026alpha_edvtxt_20250926.txt` und `icd10gm2026_alphaidse_edvtxt_20250926.txt` (UTF-8, CRLF,
  `|`-getrennt, Feldbeschreibung in den Liesmich-Dateien des BfArM).
- **Build:** Ein neues Skript `scripts/icd_alpha_to_json.py` erzeugt `data/icd10gm_alpha.json`.
  `build_data.sh` ruft es auf. Pro Eintrag werden Nummer, Art der Kodierung, Primärkode, Stern-, Zusatz- und
  zweiter Primärkode, Text und Orpha-Nummer gespeichert. Das Druckkennzeichen fällt weg.
- **Suche:** Die Ergebnisse bleiben eine Liste von Kodes wie heute, ohne doppelte Kodes. Ein Kode wird auch
  gefunden, wenn alle Suchwörter in einem seiner Alphabet-Texte stehen. Der Treffer bekommt dann die
  passenden Alphabet-Texte mit, gekürzt auf wenige pro Kode. Die Rangfolge ist: Treffer im Titel vor Treffer
  im Alphabet vor Treffer in den Einschlüssen.
- **Kombinationen** hängen am Primärkode und werden mit allen beteiligten Kodes angezeigt.
- **Verweise** (Art 0 und Texte mit „– s.“ oder „– s.a.“) kommen in ein eigenes Feld neben den Ergebnissen,
  nicht in die Ergebnisliste.
- **Bindestriche** werden beim Vergleich ignoriert, damit „Burnout“ auch „Burn-out-Syndrom“ findet.
- **Tests:** Ziegenpeter → B26.9, Burnout → Z73, Zuckerkrankheit zeigt den Verweis auf Diabetes mellitus,
  Typhus-Meningitis zeigt A01.0† G01*, ORPHA:173 → A00.0. Die bestehenden Suchtests bleiben grün.
- **Version** 1.5.0, README (Tool-Beschreibung, Zahlen) und die Server-Instructions werden angepasst.

## Dem Builder überlassen

- Das genaue Feldformat in `icd10gm_alpha.json` und die Zahlen für die Gewichtung.
- Wie viele Alphabet-Texte pro Kode angezeigt werden und wie viele Verweise höchstens.
- Ob die Bindestrich-Behandlung in `fold()` wandert, dann gilt sie auch für ICF und ICD-Titel, oder nur in der
  ICD-Suche bleibt. Das muss mit den bestehenden Tests geprüft werden.
- Wie mit Alphabet-Kodes umzugehen ist, die es in der Systematik nicht gibt. Das ist nicht zu erwarten. Sie
  werden ausgelassen, und das Build-Skript meldet sie.
