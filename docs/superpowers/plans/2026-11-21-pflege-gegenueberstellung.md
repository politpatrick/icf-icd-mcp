# Pflege-Gegenüberstellung und Prompts – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `bi_gegenueberstellen` und die ersten MCP-Prompts (`pflegegrad_interview`, `pflegegutachten_verstehen`).

**Architecture:** `src/bi_gegenueberstellung.mjs` nutzt `bi.interpretCoding`, `bi.getItem`, `bi.related`, `bi.calculate` und `fall.parseProfil`; das Tool wird in `src/bi_tools.mjs` registriert. `src/prompts.mjs` hält Prompt-Definitionen; `src/protocol.mjs` beantwortet `prompts/list` und `prompts/get`.

**Spec:** `docs/superpowers/specs/2026-11-21-pflege-gegenueberstellung-design.md`

## Global Constraints

- Keine Rechtsberatung, keine Bewertung des Gutachtens; Texte wörtlich aus den BRi, wo zitiert.
- Grad nur bei vollständigem Gutachten.
- Fehler als `LookupError` (Tool-Fehler), nie als Protokollfehler.
- BI-Tool und Pflege-Prompts nur bei `BI_ENABLED`.
- Version 1.8.0.

## Review Focus

1. Eigene Kodierung mit Kriterium, das im Gutachten fehlt → wird eingesetzt, als Unterschied geführt (Test Task 1).
2. Modul-3-Unterschied, wenn Modul 2 höher gewichtet → Wirkung 0, Hinweis „Modul zählt nicht“ (Test Task 1).
3. Kinder: `alter_monate: 30` → Kinderdefinition und Kinderregeln (Test Task 1).
4. `prompts/get` mit unbekanntem Namen oder ungültigem Alter → JSON-RPC-Fehler -32602 mit Meldung (Test Task 2).
5. Profil-Eingabe ohne Einträge der angegebenen Herkunft → verständlicher Fehler (Test Task 1).

---

### Task 1: `bi_gegenueberstellen`

**Files:** Create `src/bi_gegenueberstellung.mjs`, `test/bi_gegenueberstellung.test.mjs`; Modify `src/bi_tools.mjs`, `test/icf.test.mjs`, `test/http.test.mjs`

**Interfaces:** `export function gegenueberstellen({ gutachten?, eigene?, profil?, herkunft_gutachten = "gutachten", herkunft_eigene?, alter_monate? }) -> { richtlinie, systematik, gutachten: { vollstaendig, gesamtpunkte?, pflegegrad?, fehlende_kriterien? }, mit_eigenen_werten: { gesamtpunkte?, pflegegrad?, naechste_schwelle?: { punkte, pflegegrad, abstand } }, bestaetigt: number, unterschiede: [{ code, titel, modul, definition, gutachten: { kodierung, label, erlaeuterung, einzelpunkte }, eigene: {…}, wirkung: { modul_vorher, modul_nachher, gewichtet_vorher, gewichtet_nachher, modul_zaehlt, pflegegrad_allein?, aendert_grad_allein? }, hinweise: string[], abgrenzungen: [{ code, titel, text }] }], hinweis }`

- [ ] **Step 1: Failing Tests** (über `tools/call`):
  - Gutachten vollständig (alle Kriterien neutral, Hilfsfunktion wie in `test/fall.test.mjs`, dazu `4.1.3=1`), eigene `4.1.3=3` → ein Unterschied `BI:4.1.3`, `gutachten.label` „überwiegend selbständig“, `eigene.label` „unselbständig“, `definition` beginnt mit „Von einer üblich hohen Sitzgelegenheit“, `wirkung.gewichtet_nachher > wirkung.gewichtet_vorher`, `bestaetigt` = 0 (nur ein eigener Wert).
  - Unterschied in Modul 3 bei höherem Modul 2 → `wirkung.modul_zaehlt === false`.
  - Unvollständiges Gutachten → `gutachten.vollstaendig === false`, kein `pflegegrad`, `fehlende_kriterien.length > 0`, Unterschiede trotzdem mit Texten.
  - Kinder `alter_monate: 30` → `definition` aus der Kinderfassung, `systematik` enthält „Kinder“.
  - Profil-Eingabe mit `gutachten`- und `interview`-Einträgen → gleiches Ergebnis wie Text-Eingabe; Profil ohne Einträge der Herkunft → `error`.
  - Sortierung: zwei Unterschiede, der mit größerer gewichteter Differenz zuerst.
  - Schwelle: `naechste_schwelle.abstand` = Schwellenwert − Gesamtpunkte (gerundet auf 2 Stellen).
- [ ] **Step 2:** `node --test test/bi_gegenueberstellung.test.mjs` → FAIL.
- [ ] **Step 3:** Umsetzen und als `bi_gegenueberstellen` in `BI_TOOLS` registrieren (Beschreibung: Gegenüberstellung, keine Bewertung des Gutachtens, keine Rechtsberatung). Tool-Listen-Tests anpassen.
- [ ] **Step 4:** `npm test` → PASS. **Step 5:** Commit „bi_gegenueberstellen: Gutachten und eigene Einschätzung gegenüberstellen“.

### Task 2: Prompts im Protokoll

**Files:** Create `src/prompts.mjs`; Modify `src/protocol.mjs`; Test `test/prompts.test.mjs`

**Interfaces:** `export const PROMPTS: Array<{ name, title, description, arguments: [{ name, description, required }], render(args) -> string }>`; Protokoll: `prompts/list` → `{ prompts: [{name, title, description, arguments}] }`, `prompts/get {name, arguments}` → `{ description, messages: [{ role: "user", content: { type: "text", text } }] }`; unbekannter Name oder ungültiges Argument → `error { code: -32602, message }`; `initialize.capabilities.prompts = { listChanged: false }`.

- [ ] **Step 1: Failing Tests:** `prompts/list` enthält beide Namen (bei BI an), Kindprozess mit `ICF_MCP_BI=0` → keine Pflege-Prompts; `prompts/get pflegegrad_interview {wer_antwortet:"person", alter_monate:"30"}` → Text nennt `bi_get_item`, `bi_calculate`, `fall_pruefen`, „Kinder“ und „keine Rechtsberatung“; `pflegegutachten_verstehen` nennt `bi_gegenueberstellen`, „Rechtsbehelfsbelehrung“, „EUTB“ und enthält nicht „Erfolgsaussicht“; unbekannter Name → -32602; `alter_monate: "abc"` → -32602; `initialize` meldet `prompts`.
- [ ] **Step 2:** FAIL. **Step 3:** Prompt-Texte nach Spec (einfache Sprache, Schritt für Schritt, Gesprächsregeln: Pausen, Scham, wer antwortet; Herkunft kennzeichnen) und Protokoll umsetzen. **Step 4:** `npm test` → PASS. **Step 5:** Commit „MCP-Prompts: pflegegrad_interview und pflegegutachten_verstehen“.

### Task 3: Doku und Version

**Files:** `README.md` (Tool-Zeile, Abschnitt Prompts), `public/index.html`, `src/bi_tools.mjs` (Instructions-Satz zu `bi_gegenueberstellen`), `package.json`, `src/protocol.mjs` (1.8.0)

- [ ] Test: Instructions nennen `bi_gegenueberstellen` → FAIL → Texte und Version → `npm test` PASS → Commit „Pflege-Gegenüberstellung und Prompts dokumentieren (Version 1.8.0)“.
