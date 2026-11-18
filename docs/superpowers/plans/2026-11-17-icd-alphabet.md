# Alphabetisches Verzeichnis in `icd_search` – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `icd_search` findet ICD-10-GM-Kodes auch über die rund 89.000 Begriffe des Alphabetischen Verzeichnisses, mit Kombinationen, Verweisen und Orpha-Kennnummern.

**Architecture:** Ein Python-Skript wandelt Alphabet und Alpha-ID-SE (BfArM, `|`-getrennt) in `data/icd10gm_alpha.json` um. `src/icd.mjs` lädt die Datei, hängt die Alphabet-Texte an die Kodes der Systematik und bezieht sie in die bestehende Suche ein. Es gibt kein neues Tool.

**Tech Stack:** Node ≥ 18 ohne Abhängigkeiten (`node --test`), Python 3 nur mit Standardbibliothek.

**Spec:** `docs/superpowers/specs/2026-11-17-icd-alphabet-design.md`

## Global Constraints

- Texte des BfArM bleiben unverändert (§ 62 UrhG), die Quelle wird angegeben (§ 63 UrhG).
- Keine npm-Abhängigkeiten, Python nur mit Standardbibliothek.
- Maßgeblich ist das Systematische Verzeichnis. Alphabet-Treffer erzeugen keine eigenen Kodes.
- Treffer aus Titeln der Systematik ranken vor Alphabet-Treffern, diese vor Einschlüssen.
- Gestrichene Alpha-IDs (Gültigkeit 0) bleiben draußen.
- `fold()` in `src/text.mjs` bleibt unverändert. Es wird auch für die ICF-Titelzuordnung genutzt, bei der Bindestriche eine Rolle spielen („Teilzeit- und Vollzeit…“).
- Version 1.5.0.

## Review Focus

1. Kode-Präfixsuche („F32“) darf nicht von Alphabet-Treffern überflutet werden. F32 bleibt Treffer 1 (Test in Task 2).
2. `chapter` und `codable_only` gelten auch für Treffer, die nur über das Alphabet gefunden wurden (Test in Task 2).
3. Eine Suche, die nur einen Verweis trifft („Clavicula“), ist kein Fehler: `results` kann leer sein, `verweise` ist gefüllt (Test in Task 2).
4. Eine unbekannte Orpha-Nummer liefert `total: 0` und keinen Fehler (Test in Task 2).
5. Einträge, die nur als Zusatzkode kodierbar sind (Art 5, z. B. T-Helferzellen → U61.2), hängen am Zusatzkode (Test in Task 2).

---

### Task 1: Quellen und Datenexport

**Files:**
- Copy: `~/Downloads/icd10gm2026alpha-txt/icd10gm2026alpha_edvtxt_20250926.txt` → `source/`
- Copy: `~/Downloads/alphaidse2026/icd10gm2026_alphaidse_edvtxt_20250926.txt` → `source/`
- Create: `scripts/icd_alpha_to_json.py`
- Modify: `scripts/build_data.sh` (Aufruf nach `icd_to_json.py`, Kopfkommentar)
- Modify: `package.json` (`files` um `data/icd10gm_alpha.json` ergänzen)
- Modify: `QUELLEN.md` (neuer Abschnitt)
- Generate: `data/icd10gm_alpha.json`
- Add: `docs/superpowers/specs/2026-11-17-icd-alphabet-design.md`, dieser Plan

`netlify.toml` braucht keine Änderung, denn `included_files = ["data/*.json"]` erfasst die neue Datei schon.

**Interfaces:**
- Produces: `data/icd10gm_alpha.json` mit diesem Aufbau:

```json
{
  "meta": { "version": "2026", "stand": "26.09.2025", "quellen": ["icd10gm2026alpha_edvtxt_20250926.txt", "icd10gm2026_alphaidse_edvtxt_20250926.txt"] },
  "entries": [ { "id": 14708, "art": 1, "p": "B26.9", "t": "Ziegenpeter" },
               { "id": 21309, "art": 2, "p": "A01.0", "s": "G01", "t": "Typhus-Meningitis" },
               { "id": 90016, "art": 1, "p": "A00.0", "o": 173, "t": "Cholera durch Vibrio cholerae O:1, Biovar cholerae" } ],
  "verweise": ["Abnorm - s. Art der Krankheit", "Clavicula - s. Klavikula"]
}
```

  Die Schlüssel `p`, `s`, `z`, `p2` sind Primärkode, Stern-, Zusatz- und zweiter Primärkode, jeweils **ohne** Zeichen (`+`, `*`, `!` entfernt). Leere Felder werden weggelassen. `o` ist die Orpha-Kennnummer als Zahl, `t` der Text unverändert. Art-0-Sätze kommen nur als Text in `verweise`.

- [ ] **Step 1: Quelldateien nach `source/` kopieren und Spec und Plan committen**

```bash
cp ~/Downloads/icd10gm2026alpha-txt/icd10gm2026alpha_edvtxt_20250926.txt ~/Downloads/alphaidse2026/icd10gm2026_alphaidse_edvtxt_20250926.txt source/
git add source/icd10gm2026*_edvtxt_20250926.txt docs/superpowers
git commit -m "Alphabet und Alpha-ID-SE 2026 als Quellen, Design und Plan"
```

- [ ] **Step 2: `scripts/icd_alpha_to_json.py` schreiben**

CLI: `icd_alpha_to_json.py ALPHABET_TXT ALPHAIDSE_TXT OUT_DIR`. Dateien als `utf-8-sig` lesen, Zeilen ohne `\r`, Trennung über `split("|")` mit genau 8 Feldern, sonst Abbruch mit Zeilennummer.
- Alphabet-Felder: Art, Nr, Druck, Primär 1, Stern, Zusatz, Primär 2, Text.
- Alpha-ID-SE-Felder: Gültig, `I`+Nr, Primär 1, Stern, Zusatz, Primär 2, Orpha, Text.
- Orpha über Nr aus gültigen SE-Sätzen übernehmen.
- Alle Kodes gegen die Schlüssel von `OUT_DIR/icd10gm.json` (`codes`) prüfen. Unbekannte Einträge auslassen und mit Anzahl und Beispielen auf stderr melden. Erwartet sind 0.
- Am Ende auf stdout ausgeben: Einträge, Verweise, mit Orpha.

- [ ] **Step 3: In `build_data.sh` einbinden und Daten erzeugen**

`ALPHA_TXT` und `ALPHASE_TXT` werden wie `ICD_XML` per `ls … | sort | tail -1` gefunden (`icd10gm*alpha_edvtxt_*.txt` und `icd10gm*_alphaidse_edvtxt_*.txt`). Der Aufruf kommt direkt nach `icd_to_json.py`.

Run: `scripts/build_data.sh`
Expected: Ausgabe `89304 Einträge, 309 Verweise, 19352 mit Orpha`, keine Meldung über unbekannte Kodes. `git status` zeigt nur die neue `data/icd10gm_alpha.json`, die übrigen Dateien in `data/` bleiben unverändert.

- [ ] **Step 4: `package.json` (`files`) und `QUELLEN.md` ergänzen**

Der Abschnitt „ICD-10-GM Version 2026, Alphabetisches Verzeichnis und Alpha-ID-SE“ enthält beide Dateinamen, den Stand 26.09.2025 und die OIDs 1.2.276.0.76.5.554 und 1.2.276.0.76.5.556. Dazu kommen der Hinweis „Bei Unstimmigkeiten ist das Systematische Verzeichnis maßgeblich“ und die Herkunft der Orpha-Kennnummern (Orphanet, Nomenclature Pack 07/2025). Ausdrücklich zu vermerken ist, dass gestrichene Alpha-IDs und das Druckkennzeichen nicht übernommen werden und die Texte unverändert sind.

- [ ] **Step 5: Bestehende Tests laufen und committen**

Run: `npm test`
Expected: alle Tests PASS

```bash
git add scripts/icd_alpha_to_json.py scripts/build_data.sh package.json QUELLEN.md data/icd10gm_alpha.json
git commit -m "Alphabetisches Verzeichnis und Alpha-ID-SE nach JSON exportieren"
```

### Task 2: Alphabet in `icd_search`

**Files:**
- Modify: `src/icd.mjs` (Laden, Index, `search`)
- Modify: `src/protocol.mjs` (Beschreibung von `icd_search`, Absatz ICD-10-GM in `BASE_INSTRUCTIONS`)
- Modify: `README.md` (Tool-Tabelle, Zahlen, Quellen), `package.json` (`version` 1.5.0)
- Test: `test/icd.test.mjs`

**Interfaces:**
- Consumes: `data/icd10gm_alpha.json` aus Task 1, geladen über `readData("icd10gm_alpha.json")`.
- Produces: `icd.search({ query, chapter, codable_only, limit })` liefert wie bisher `{ version, query, total, results }`. Neu sind:
  - je Ergebnis optional `alphabet: [{ text, kombination?, orpha? }]` (höchstens 3, bevorzugt Texte, die alle Suchwörter enthalten);
  - `kombination` ist die Kodefolge mit Zeichen über `displayCode`, getrennt durch Leerzeichen, z. B. `"A01.0† G01*"`, und nur bei Art 2, 3, 4 und 6 gesetzt;
  - auf oberster Ebene optional `verweise: string[]` (höchstens 5) und `hinweis: "Alphabet-Treffer stammen aus dem Alphabetischen Verzeichnis; maßgeblich ist das Systematische Verzeichnis."`, sobald ein Ergebnis `alphabet` hat.

- [ ] **Step 1: Failing Tests schreiben (`test/icd.test.mjs`)**

```js
test("icd_search findet Begriffe aus dem Alphabetischen Verzeichnis", () => {
  const r = call("icd_search", { query: "Ziegenpeter" });
  assert.equal(r.results[0].code, "B26.9");
  assert.ok(r.results[0].alphabet.some((a) => a.text === "Ziegenpeter"));
  assert.match(r.hinweis, /Systematische Verzeichnis/);
});

test("icd_search ignoriert Bindestriche", () => {
  assert.ok(call("icd_search", { query: "Burnout" }).results.slice(0, 3).some((x) => x.code.startsWith("Z73")));
});

test("icd_search zeigt Kombinationen und Verweise aus dem Alphabet", () => {
  const typhus = call("icd_search", { query: "Typhus-Meningitis" }).results.find((x) => x.code.startsWith("A01.0"));
  assert.ok(typhus.alphabet.some((a) => a.kombination === "A01.0† G01*"));
  const zucker = call("icd_search", { query: "Zuckerkrankheit" });
  assert.ok(zucker.results.some((x) => x.alphabet?.some((a) => /s\.a\. Diabetes mellitus/.test(a.text))));
  const clav = call("icd_search", { query: "Clavicula" });
  assert.ok(clav.verweise.includes("Clavicula - s. Klavikula"));
});

test("icd_search sucht nach Orpha-Kennnummer", () => {
  const r = call("icd_search", { query: "ORPHA:173" });
  assert.ok(r.results.some((x) => x.code === "A00.0" && x.alphabet.some((a) => a.orpha === 173)));
  assert.equal(call("icd_search", { query: "Orpha 999999999" }).total, 0);
});

test("Alphabet verdrängt keine Kodetreffer und beachtet Filter", () => {
  assert.equal(call("icd_search", { query: "F32" }).results[0].code, "F32");
  assert.ok(call("icd_search", { query: "Ziegenpeter", chapter: "V" }).results.length === 0);
  assert.ok(call("icd_search", { query: "T-Helferzellen" }).results.some((x) => x.code.startsWith("U61.2")));
  assert.ok(call("icd_search", { query: "Zuckerkrankheit", codable_only: true }).results.every((x) => x.terminal));
});
```

- [ ] **Step 2: Tests laufen lassen und Fehlschlag prüfen**

Run: `node --test test/icd.test.mjs`
Expected: Die neuen Tests schlagen fehl (z. B. `Cannot read properties of undefined` bei `results[0]` für Ziegenpeter). Die alten Tests bestehen.

- [ ] **Step 3: Alphabet in `src/icd.mjs` einbauen**

- Lokale Hilfe `compact(text) = fold(text).replace(/-/g, "")`. Sie wird für die Felder `title`, `inclusions` und das neue `alphabet` im `searchIndex` und für die Suchwörter genutzt. `fold` bleibt unverändert.
- Beim Laden jeden Eintrag dem Zielkode zuordnen: `p`, bei Art 5 `z`. Pro Kode werden die Einträge gesammelt (`alphabetOf[code]`) und das Indexfeld `alphabet` gebildet, also die mit `compact` normalisierten Texte, mit Leerzeichen verbunden. Eine Map `byOrpha[o] → entries` kommt dazu.
- Gewichtung je Suchwort: Titel 10, Alphabet 6, Einschlüsse 2. Kode-Treffer bleiben wie bisher (100/20).
- Orpha-Anfrage `/^\s*orpha\s*[:\-]?\s*(\d+)\s*$/i`: Die Wortsuche wird umgangen. Ergebnisse sind die Kodes aus `byOrpha`, mit denselben Filtern (`chapter`, `codable_only`). `alphabet` zeigt die Einträge mit dieser Orpha-Nummer.
- `verweise`: die Texte aus `verweise`, die alle Suchwörter enthalten (verglichen mit `compact`). Kein Fehler, wenn `results` leer ist.

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test`
Expected: alle Tests PASS, auch die bestehenden ICD-, ICF-, BI-, Graph- und HTTP-Tests.

- [ ] **Step 5: Beschreibungen, README und Version anpassen**

Die `icd_search`-Beschreibung bekommt den Zusatz „… sowie in rund 89.000 Begriffen des Alphabetischen Verzeichnisses (Synonyme, Laienbegriffe, Kreuz-Stern-Kombinationen, Orpha-Kennnummern; Suche auch mit "ORPHA:173")“. In `BASE_INSTRUCTIONS` kommt derselbe Hinweis mit einem Satz in den ICD-Absatz. In der README werden die `icd_search`-Zeile und die Aufzählung der Daten angepasst, in `package.json` die Version auf 1.5.0 gesetzt.

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/icd.mjs src/protocol.mjs README.md package.json test/icd.test.mjs
git commit -m "icd_search durchsucht das Alphabetische Verzeichnis (Version 1.5.0)"
```
