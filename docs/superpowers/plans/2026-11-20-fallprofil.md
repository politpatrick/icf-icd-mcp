# Fallprofil – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein versioniertes Austauschformat `fallprofil` (Version 1) mit den Tools `fall_schema`, `fall_pruefen` und `fall_vergleichen`, das ICD-, ICF-, BI- und VersMedV-Einträge eines Falls samt Zusammenhängen prüft, übersetzt und vergleicht.

**Architecture:** `src/fall.mjs` enthält Einlesen und Formprüfung (`parseProfil`), die fachliche Prüfung (`pruefen`) und den Vergleich (`vergleichen`). Es ruft für Kodes ausschließlich die vorhandenen Modulfunktionen auf. `src/fall_tools.mjs` definiert die drei Tools und den Instructions-Absatz. `src/protocol.mjs` bindet sie immer ein. Schema und Beispiel liegen als JSON unter `data/`.

**Tech Stack:** Node ≥ 18 ohne Abhängigkeiten, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-20-fallprofil-design.md`. Die Festlegungen 1–8 im Abschnitt „Festlegungen aus dem Builder-Check“ sind verbindlich.

## Global Constraints

- **Zielgruppe** sind antragsberechtigte Personen. Es findet **keine Rechtsberatung** statt, und es gibt keine Bewertung des Falls. Hinweistexte sagen, was fehlt, und nie, dass etwas „nicht begründet“ sei.
- **Keine Felder** für Namen, Anschriften, Versicherungs- oder Aktennummern. Unbekannte Felder sind auf jeder Ebene ein Fehler.
- **Keine Interna**, nur öffentliche Grundlagen.
- **Keine npm-Abhängigkeiten.** Bestehende Tools ändern ihr Verhalten nicht.
- **Kuratierte Querverweise** tragen `quelle: "kuratiert, nicht amtlich"`.
- **Limits:** höchstens 500 Einträge, 1.000 Zusammenhänge und 2.000 Zeichen je Textfeld.
- **Fehlerform:** Formfehler, nicht lesbare Eingaben und Limitverletzungen kommen als `fehler[]` mit `gueltig: false` zurück, nicht als `isError`. Unerwartete Ausnahmen in `pruefen` und `vergleichen` werden abgefangen und als `fehler` gemeldet.
- **Pflege-Orientierung** gibt es nur, wenn alle Kriterien kodiert sind (Festlegung 2).
- **Version** 1.7.0.

## Review Focus

1. Ein Profil kommt als JSON-String mit Formatierungsfehlern an (abgeschnittene Klammer). Erwartet: `gueltig: false` mit einer verständlichen Meldung, kein Protokollfehler (Test in Task 1).
2. Ein Eintrag verweist auf eine `verfahren`-Id, die es nicht gibt, oder ein Zusammenhang verweist auf eine fehlende Eintrags-Id. Erwartet: Fehler mit Pfad und keine Ausnahme in den späteren Schritten (Test in Task 1).
3. Ein BI-Eintrag mit Kinderfassung (`KF 4.4.0`) im Profil eines 30 Monate alten Kindes. Die Orientierung nutzt die Kinderregeln über `alter_monate` (Test in Task 2).
4. `fall_vergleichen` mit zwei Profilen, deren Ids sich völlig unterscheiden. Die Zuordnung läuft trotzdem über die Grundkodes (Test in Task 3).
5. `ICF_MCP_BI=0` und ein Profil mit BI-Einträgen. Erwartet: Hinweis `modul_aus`, keine Ausnahme, keine Pflege-Orientierung (Test in Task 2).

---

### Task 1: Format, Schema, Einlesen und Formprüfung, `fall_schema`

**Files:**
- Create: `data/fallprofil-1.schema.json`, `data/fallprofil-1.beispiel.json`, `src/fall.mjs`, `src/fall_tools.mjs`, `test/fall.test.mjs`
- Modify: `src/protocol.mjs` (Import und `...FALL_TOOLS` in `TOOLS`), `package.json` (`files` um beide JSON-Dateien), `test/icf.test.mjs` (Tool-Liste), `test/http.test.mjs` (Anzahl der Tools)

**Interfaces:**
- Produces (`src/fall.mjs`):
  - `export const FALLPROFIL_VERSION = "1"`
  - `export function schema() -> { version: "1", schema: object, beispiel: object, felder: string }`. `felder` ist eine kurze deutsche Feldbeschreibung mit dem Hinweis „Pseudonym, kein Klarname“.
  - `export function parseProfil(input: object|string) -> { profil: object|null, fehler: Array<{ pfad: string, meldung: string }> }`. Prüft JSON-Lesbarkeit, Pflichtfelder, Aufzählungswerte, Datumsformat JJJJ-MM-TT, unbekannte Felder, eindeutige Ids, alle Id-Verweise (`zusammenhaenge.von/nach`, `ziele.eintraege`, `eintraege.verfahren`), `ergebnis` gegen `bereich` (Festlegung 5), `gdb` 10–100 in Zehnern, die Limits und die Pflichtfelder je `art` (`kode` außer bei `personbezogen`, `text` bei `personbezogen`). Kodes werden hier **nicht** fachlich geprüft.
  - Pfade im Format `eintraege[3].kode`, `meta.stichtag`.
- Produces (`src/fall_tools.mjs`): `FALL_TOOLS` (hier zunächst nur `fall_schema` ohne Argumente) und `FALL_INSTRUCTIONS` (Absatz kommt in Task 4).

- [ ] **Step 1: Failing Tests in `test/fall.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";
import { parseProfil, schema } from "../src/fall.mjs";
let nextId = 1;
const call = (name, args) => { const r = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }).result; return r.isError ? { error: r.content[0].text } : JSON.parse(r.content[0].text); };
const minimal = () => ({ fallprofil: "1", meta: { pseudonym: "Fall A", stichtag: "2026-11-20" }, eintraege: [], zusammenhaenge: [], ziele: [], verfahren: [] });

test("fall_schema liefert Schema und gültiges Beispiel", () => {
  const r = call("fall_schema", {});
  assert.equal(r.version, "1");
  assert.deepEqual(parseProfil(r.beispiel).fehler, []);
  assert.match(r.felder, /Pseudonym/);
});

test("Beispiel enthält jede Art und jede Zusammenhangsart", () => {
  const b = schema().beispiel;
  for (const art of ["icd", "icf", "bi", "vmg", "merkzeichen", "personbezogen"]) assert.ok(b.eintraege.some((e) => e.art === art), art);
  for (const art of ["verursacht", "beeintraechtigt", "foerdert", "hemmt", "entspricht"]) assert.ok(b.zusammenhaenge.some((z) => z.art === art), art);
  assert.ok(b.ziele.length && b.verfahren.length);
});

test("Schema und Prüfcode kennen dieselben Felder und Werte", () => {
  const s = schema().schema;
  const props = (p) => Object.keys(p.properties).sort();
  assert.deepEqual(props(s.$defs.eintrag), ["art", "beleg", "begruendung", "dauer", "gdb", "herkunft", "id", "kode", "o_ton", "richtung", "status", "text", "verfahren"]);
  assert.deepEqual(s.$defs.eintrag.properties.art.enum, ["icd", "icf", "bi", "vmg", "merkzeichen", "personbezogen"]);
  assert.deepEqual(s.$defs.zusammenhang.properties.art.enum, ["verursacht", "beeintraechtigt", "foerdert", "hemmt", "entspricht"]);
});

test("Unbekannte Felder wie name werden abgelehnt", () => {
  const p = minimal(); p.meta.name = "Erika Mustermann";
  assert.ok(parseProfil(p).fehler.some((f) => f.pfad === "meta.name"));
});

test("Kaputtes JSON und fehlende Verweise ergeben Fehler mit Pfad", () => {
  assert.ok(parseProfil('{"fallprofil": "1", "meta": {').fehler.length > 0);
  const p = minimal();
  p.eintraege.push({ id: "e1", art: "icd", kode: "F32.1 G", herkunft: "befund", verfahren: "v9" });
  p.zusammenhaenge.push({ von: "e1", nach: "e7", art: "verursacht" });
  const pf = parseProfil(p).fehler.map((f) => f.pfad);
  assert.ok(pf.includes("eintraege[0].verfahren") && pf.includes("zusammenhaenge[0].nach"));
});

test("Limits und Wertebereiche", () => {
  const p = minimal();
  p.eintraege = Array.from({ length: 501 }, (_, i) => ({ id: `e${i}`, art: "personbezogen", text: "x", herkunft: "selbstauskunft" }));
  assert.ok(parseProfil(p).fehler.some((f) => /500/.test(f.meldung)));
  const q = minimal(); q.eintraege.push({ id: "v", art: "vmg", kode: "VMG:B 3.7", gdb: 35, herkunft: "bescheid" });
  assert.ok(parseProfil(q).fehler.some((f) => f.pfad === "eintraege[0].gdb"));
});
```

- [ ] **Step 2:** Run: `node --test test/fall.test.mjs`. Expected: FAIL (Modul fehlt oder `Unknown tool`).
- [ ] **Step 3:** Schema und Beispiel anlegen, genau wie in der Spec („Das Format“, Festlegungen 3, 5, 6).
  - Das Beispiel ist ein erfundener Fall „Fall A“ ohne realen Bezug. Es enthält mindestens `F20.0 G`, `b160.2`, `d720.33`, `e310+3`, einen personbezogenen Eintrag, `BI:4.2.1=2`, `VMG:B 3.7` mit `gdb` 50, das Merkzeichen `B`, ein Ziel und ein Verfahren (Art `gutachten`, Bereich `pflege`).
  - Danach `parseProfil` und `schema()` in `src/fall.mjs` (Dateien über `readData` laden) und `fall_schema` in `src/fall_tools.mjs` umsetzen und in `protocol.mjs` einbinden. Tool-Liste und Toolanzahl in den bestehenden Tests anpassen.
- [ ] **Step 4:** Run: `npm test`. Expected: alles PASS.
- [ ] **Step 5:** Committen mit der Nachricht „Fallprofil: Format, Schema und Formprüfung (fall_schema)“.

### Task 2: `fall_pruefen`

**Files:** Modify `src/fall.mjs`, `src/fall_tools.mjs`, `test/icf.test.mjs`, `test/http.test.mjs`; Test `test/fall.test.mjs`

**Interfaces:**
- Consumes: `parseProfil`; `icd.checkCode({code})`, `icf.interpretCoding({coding})`, `bi.interpretCoding({coding})`, `bi.calculate({kodierung, alter_monate})` (über `nicht_angegeben` wird die Vollständigkeit geprüft), `bi.biForIcf(code)`, `vmg.get({kennung})`, `BI_ENABLED`, `VMG_ENABLED`.
- Produces:
  - `export function pruefen({ profil }) -> { fallprofil, gueltig, fehler[], datenschutz: string, eintraege[{id, art, kode, klartext, richtung?, warnungen[]}], zusammenhaenge[{von, nach, art, gueltig, meldung?}], hinweise[{kennung, eintraege[], text}], lebensbereiche[{nummer, titel, eintraege[{id, kode, richtung?}]}], querverweise[{icf, bi_kriterien[], quelle}], pflege[{herkunft, vollstaendig, gesamtpunkte?, pflegegrad?, fehlende_kriterien?, hinweis}] }`
  - `export function grundkode(eintrag) -> string`, auch für Task 3. ICD ohne Zusatzkennzeichen, ICF ohne Merkmal, BI-Kennung ohne Wert, VMG kanonisch, Merkzeichen unverändert, `personbezogen` → normalisierter Text.
- Feste Werte:
  - Hinweiskennungen genau: `d_ohne_ursache`, `barriere_ohne_bezug`, `foerderfaktor_ohne_bezug`, `umweltfaktor_ohne_merkmal`, `offen`, `ohne_beleg`, `komponente_fehlt`, `doppelt`, `ziel_ohne_bezug`, `modul_aus`, `alter_fehlt`.
  - Lebensbereichstitel nach § 118 Abs. 1 SGB IX, vom Executor an gesetze-im-internet.de zu verifizieren und wörtlich zu übernehmen: 1 Lernen und Wissensanwendung, 2 Allgemeine Aufgaben und Anforderungen, 3 Kommunikation, 4 Mobilität, 5 Selbstversorgung, 6 häusliches Leben, 7 interpersonelle Interaktionen und Beziehungen, 8 bedeutende Lebensbereiche, 9 Gemeinschafts-, soziales und staatsbürgerliches Leben.

- [ ] **Step 1: Failing Tests** mit kleinen Profilen über das Tool `fall_pruefen`:

```js
const mit = (eintraege, zusammenhaenge = [], extra = {}) => ({ ...minimal(), eintraege, zusammenhaenge, ...extra });
const E = (id, art, kode, more = {}) => ({ id, art, kode, herkunft: "selbstauskunft", ...more });
const hinweise = (p) => call("fall_pruefen", { profil: p }).hinweise.map((h) => h.kennung);

test("fall_pruefen: Beispiel gültig, Klartext, Lebensbereiche, Querverweise, Datenschutz", () => {
  const r = call("fall_pruefen", { profil: schema().beispiel });
  assert.equal(r.gueltig, true);
  assert.ok(r.eintraege.every((e) => e.klartext));
  assert.ok(r.lebensbereiche.find((l) => l.nummer === 7).eintraege.some((e) => e.kode.startsWith("d720")));
  assert.ok(r.querverweise.every((q) => q.quelle === "kuratiert, nicht amtlich"));
  assert.match(r.datenschutz, /Pseudonym/);
});

test("Kodes: Fehler gegen Warnung", () => {
  const r = call("fall_pruefen", { profil: mit([E("a", "icf", "d450"), E("b", "icd", "F20"), E("c", "icf", "x999.9")]) });
  assert.equal(r.gueltig, false);
  assert.ok(r.fehler.some((f) => f.pfad === "eintraege[2].kode"));
  assert.ok(r.eintraege.find((e) => e.id === "a").warnungen.length > 0);
  assert.ok(r.eintraege.find((e) => e.id === "b").warnungen.length > 0);
});

test("Zusammenhänge: erlaubte und unerlaubte Paare", () => {
  const r = call("fall_pruefen", { profil: mit([E("i", "icd", "F20.0 G"), E("b", "icf", "b160.2"), E("d", "icf", "d720.33")], [{ von: "d", nach: "b", art: "beeintraechtigt" }, { von: "b", nach: "d", art: "beeintraechtigt" }]) });
  assert.equal(r.zusammenhaenge[0].gueltig, false);
  assert.equal(r.zusammenhaenge[1].gueltig, true);
});

test("Alle Lückenhinweise werden ausgelöst", () => {
  assert.ok(hinweise(mit([E("d", "icf", "d450.22")])).includes("d_ohne_ursache"));
  assert.ok(hinweise(mit([E("e", "icf", "e150.2")])).includes("barriere_ohne_bezug"));
  assert.ok(hinweise(mit([E("e", "icf", "e310+2")])).includes("foerderfaktor_ohne_bezug"));
  assert.ok(hinweise(mit([E("e", "icf", "e150")])).includes("umweltfaktor_ohne_merkmal"));
  assert.ok(hinweise(mit([E("o", "icf", "d450", { status: "offen" })])).includes("offen"));
  assert.ok(hinweise(mit([E("x", "icf", "d450.22", { status: "belegt" })])).includes("ohne_beleg"));
  const t = minimal(); t.meta.zweck = ["teilhabe"]; t.eintraege = [E("d", "icf", "d450.22")];
  assert.ok(hinweise(t).includes("komponente_fehlt"));
  assert.ok(hinweise(mit([E("a", "icd", "F20.0 G"), E("b", "icd", "F20.0 V")])).includes("doppelt"));
  assert.ok(!hinweise(mit([E("a", "icd", "F20.0 G"), E("b", "icd", "F20.0 G", { herkunft: "gutachten" })])).includes("doppelt"));
  assert.ok(hinweise(mit([], [], { ziele: [{ id: "z", text: "Allein einkaufen", eintraege: [] }] })).includes("ziel_ohne_bezug"));
  assert.ok(hinweise(mit([E("b", "bi", "BI:4.1.3=2")])).includes("alter_fehlt"));
});

test("Pflege-Orientierung nur vollständig; Kinder über Monate", () => {
  const teil = call("fall_pruefen", { profil: mit([E("b", "bi", "BI:4.1.3=2")]) }).pflege[0];
  assert.equal(teil.vollstaendig, false);
  assert.equal(teil.pflegegrad, undefined);
  assert.ok(teil.fehlende_kriterien.length > 0);
  // vollständig: alle Kriterien aus bi.calculate({}).nicht_angegeben mit dem jeweils neutralen Wert kodieren (Stufe 0, Häufigkeit "entfällt", ja/nein "nein")
  // Kinderprofil: meta.alter {monate: 30} → pflege[0] wird mit Kinderregeln berechnet (Systematik „Kinder unter 11 Jahren“)
});

test("ICF_MCP_BI=0: Hinweis modul_aus, keine Pflege-Orientierung", () => { /* Kindprozess wie test/bi.test.mjs:168 mit ICF_MCP_BI=0, fall_pruefen mit BI-Eintrag */ });
```

Die beiden Kommentar-Platzhalter sind als vollständige Tests auszuschreiben: Vollständigkeit und Kinderfall im vorletzten Test, der Kindprozess mit `ICF_MCP_BI=0` im letzten. Zusätzlich gehört ein Test für einen Eintrag `vmg` mit einer unbekannten Kennung dazu (Fehler am Pfad).

- [ ] **Step 2:** Run: `node --test test/fall.test.mjs`. Expected: Die neuen Tests schlagen fehl.
- [ ] **Step 3:** `pruefen` und `grundkode` umsetzen und `fall_pruefen` registrieren.
  - **Eingabe:** `profil` als Objekt oder String.
  - **Ablauf:** zuerst `parseProfil`. Bei Formfehlern `gueltig: false`, die Prüfung der übrigen Einträge läuft trotzdem weiter.
  - **Klartext je Art:**
    - ICF: Titel und Merkmal-Bedeutungen
    - ICD: Titel und Diagnosesicherheit
    - BI: Titel und Label
    - VMG: Fundstelle und Bezeichnung
    - Merkzeichen: Bezeichnung
  - **Pflege-Orientierung:** je Herkunft, `alter_monate` aus `meta.alter` (Jahre × 12).
  - **Ausnahmen:** Unerwartete Ausnahmen je Eintrag werden zu einer Fehlermeldung am Eintrag.
- [ ] **Step 4:** Run: `npm test`. Expected: PASS.
- [ ] **Step 5:** Committen mit der Nachricht „Fallprofil: fall_pruefen mit Lückenhinweisen, Lebensbereichen und Pflege-Orientierung“.

### Task 3: `fall_vergleichen`

**Files:** Modify `src/fall.mjs`, `src/fall_tools.mjs`, Tool-Listen-Tests; Test `test/fall.test.mjs`

**Interfaces:**
- Consumes: `parseProfil`, `grundkode`, die Pflege-Orientierung aus Task 2 (vollständig je Herkunft)
- Produces: `export function vergleichen({ alt, neu }) -> { gueltig, fehler[], stichtage: {alt, neu}, eintraege: { neu[], weggefallen[], veraendert[{schluessel, vorher, nachher, felder[], begruendung_vorher?, begruendung_nachher?}], unveraendert: number }, zusammenhaenge: {neu[], weggefallen[]}, ziele: {neu[], weggefallen[]}, verfahren: {neu[], weggefallen[]}, pflege[{herkunft, alt?, neu?, differenz?}], gdb[{kennung, alt?, neu?}], hinweise[] }`
- Schlüssel: `(art, grundkode, herkunft)`. Als veränderte Felder zählen Merkmal, Stufe, Häufigkeit, `gdb`, `status`, `dauer`, `richtung` und ICD-Zusatzkennzeichen. Mehrfache Schlüssel werden in Reihenfolge zugeordnet und mit dem Hinweis `mehrdeutig` versehen. Keine wertenden Wörter wie „verschlechtert“ oder „verbessert“.

- [ ] **Step 1: Failing Tests**

```js
test("fall_vergleichen: neu, weggefallen, verändert über Grundkode trotz anderer Ids", () => {
  const alt = mit([E("a", "icf", "d450.12"), E("b", "icd", "F20.0 V"), E("c", "personbezogen", undefined, { text: "Mag Musik" })]);
  const neu = mit([E("x", "icf", "d450.23"), E("y", "icd", "F20.0 G"), E("z", "icf", "d920.2")]);
  neu.meta.stichtag = "2027-11-20";
  const r = call("fall_vergleichen", { alt, neu });
  assert.equal(r.gueltig, true);
  assert.ok(r.eintraege.veraendert.some((v) => v.schluessel.includes("d450")));
  assert.ok(r.eintraege.veraendert.some((v) => v.schluessel.includes("F20.0")));
  assert.ok(r.eintraege.neu.some((e) => e.kode.startsWith("d920")));
  assert.ok(r.eintraege.weggefallen.some((e) => e.art === "personbezogen"));
  assert.ok(!/verschlecht|verbesser/i.test(JSON.stringify(r)));
});

test("fall_vergleichen: Zusammenhänge, GdB und Formfehler", () => {
  // Profil mit verursacht F20.0→d720 nur in neu → zusammenhaenge.neu hat einen Eintrag
  // VMG:B 3.7 gdb 40 → 50 → gdb[0] {alt: 40, neu: 50}
  // alt mit unbekanntem Feld → gueltig false, fehler mit Pfad, kein Vergleich
});
```

Der zweite Test ist mit den drei Fällen im Kommentar vollständig auszuschreiben.

- [ ] **Step 2:** Run: `node --test test/fall.test.mjs`. Expected: Die neuen Tests schlagen fehl.
- [ ] **Step 3:** `vergleichen` umsetzen und `fall_vergleichen` registrieren.
- [ ] **Step 4:** Run: `npm test`. Expected: PASS.
- [ ] **Step 5:** Committen mit der Nachricht „Fallprofil: fall_vergleichen“.

### Task 4: Instructions, Dokumentation, Version

**Files:** `src/fall_tools.mjs` (`FALL_INSTRUCTIONS`), `src/protocol.mjs` (Instructions anhängen, `SERVER_INFO.version` 1.7.0), `package.json` (Version 1.7.0), `README.md` (Abschnitt „Fallprofil“ mit Format, den drei Tools, Lückenhinweisen und Grenzen), `public/index.html` (Tool-Liste), `test/fall.test.mjs`

- [ ] **Step 1: Failing Test:** Die `initialize`-Instructions enthalten „Fallprofil“, „Pseudonym“ und „keine Rechtsberatung“.
- [ ] **Step 2:** Run: `node --test test/fall.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Texte ergänzen.
  - Der Instructions-Absatz soll höchstens sechs Zeilen haben: Zweck, kein Klarname, keine Rechtsberatung und die Reihenfolge `fall_schema` → Profil aufbauen → `fall_pruefen` → bei einer neuen Fassung `fall_vergleichen`.
  - Die README nennt ausdrücklich: Speicherung nur beim Nutzer, keine Bewertung des Falls, Pflege-Orientierung nur bei vollständigen Angaben.
- [ ] **Step 4:** Run: `npm test`. Expected: PASS.
- [ ] **Step 5:** Committen mit der Nachricht „Fallprofil dokumentieren (Version 1.7.0)“.
