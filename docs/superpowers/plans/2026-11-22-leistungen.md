# Leistungen (leistungshinweise, leistungen_finden) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kuratierter Katalog möglicher Leistungen und Nachteilsausgleiche zu GdB, Merkzeichen und Pflegegrad als Tool und geführter Ablauf.

**Architecture:** Katalog und Auswahl in `src/leistungen.mjs` (Muster: `src/verfahren.mjs`), Tool in `src/leistungen_tools.mjs` (Muster: `src/verfahren_tools.mjs`), registriert in `src/protocol.mjs` (TOOLS und INSTRUCTIONS); Prompt in `src/prompts.mjs`.

**Tech Stack:** Node ≥ 18, `node:test`, keine Abhängigkeiten. Fehler als `LookupError` aus `src/text.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-22-leistungen-design.md`

## Global Constraints

- Zielgruppe: antragsberechtigte Personen. **Keine Rechtsberatung**: keine Beträge, keine Einkommens-/Vermögensprüfung, keine Aussage, ob ein Anspruch besteht oder welche Stelle im Einzelfall zuständig ist; Texte im Konjunktiv der Möglichkeit („kann in Betracht kommen“).
- Nur öffentliche Quellen. Jede Bundesnorm an `https://www.gesetze-im-internet.de/<gesetz>/__<nr>.html` mit `curl -4 -s` prüfen (ohne `-4` hängt der Abruf). Weicht die Quelle von der Liste unten ab, gilt die Quelle; Abweichung im Report nennen.
- Herkunft: Erklärungen „kuratiert (nicht amtlich)“; Landesrecht nur als Hinweis ohne URL.
- Sprache: Deutsch, einfache Sprache, keine Beträge in Euro und keine Prozentangaben (z. B. bei der Kfz-Steuer nur „Ermäßigung“).
- Version 1.12.0 (`package.json`, `SERVER_INFO` in `src/protocol.mjs`).
- Tests laufen mit `node --test test/<datei>.test.mjs`; die ganze Suite `npm test` ist langsam (bis 3 Min.).

## Review Focus

- `gdb` als Text „50“ oder 55 → angenommen (ganzzahlig 0–100); 110, -1, „abc“ → Fehler.
- Merkzeichen in anderer Schreibweise („bl“, „AG“, „ BL “) → erkannt; „X“ → Fehler mit Liste.
- Nur `pflegegrad` angegeben → keine GdB-Einträge; nur `merkzeichen` ohne `gdb` → Merkzeichen-Einträge trotzdem (Merkzeichen setzen GdB 50 voraus, Hinweis).
- Kein Text enthält „Euro“, „€“ oder eine Zahl mit Prozentzeichen.
- Jeder Eintrag hat `stelle`, `rang`, `naechster_schritt`; jede URL ist `https://www.gesetze-im-internet.de/…/__N.html`.

---

### Task 1: Katalog, Auswahl und Tool `leistungshinweise`

**Files:**
- Create: `src/leistungen.mjs`, `src/leistungen_tools.mjs`, `test/leistungen.test.mjs`
- Modify: `src/protocol.mjs` (Import, `...LEISTUNGEN_TOOLS` nach `...TEILHABE_TOOLS`, `LEISTUNGEN_INSTRUCTIONS` in INSTRUCTIONS), Zähltests `test/http.test.mjs` (34 → 35, Kommentar „+ 1 Leistungen“) und `test/icf.test.mjs` (Liste um `"leistungshinweise"` ergänzen)

**Interfaces:**
- Produces: `export const KATALOG` (Array der Einträge), `export function hinweise({ gdb, merkzeichen, pflegegrad, alter_monate } = {})` → `{ eingaben: { gdb?, merkzeichen?, pflegegrad?, alter_monate? }, eintraege: [...], landesrecht: [...], hinweis: string, herkunft: string, beratung: string[] }`; `export const LEISTUNGEN_TOOLS`, `export const LEISTUNGEN_INSTRUCTIONS`.
- Eintrag: `{ id, gruppe, wenn: [ { gdb_ab?, gdb_bis?, merkzeichen?: string[], pflegegrad_ab?, kind?: true } ], leistung, normen: [{ zitat, url }], stelle, rang, naechster_schritt, voraussetzung, alter_hinweis? }`. Ausgabe ohne `wenn`, dafür `signal` (aus `wenn` erzeugt, z. B. „GdB ab 50“, „Merkzeichen G oder H“, „Pflegegrad ab 2“, „GdB ab 70 und Merkzeichen G“).
- Auswahl: Eintrag passt, wenn eine Alternative in `wenn` vollständig erfüllt ist. `gdb_ab`/`gdb_bis` nur prüfbar, wenn `gdb` angegeben; `merkzeichen` = mindestens eines angegeben; `kind` = `alter_monate` angegeben und < 216. Landesrecht-Einträge (`gruppe: "landesrecht"`, `normen: []`) gehen in `landesrecht`, alle anderen in `eintraege`, in Katalogreihenfolge.
- Merkzeichen-Normalisierung: Schreibweise egal, kanonisch `G, aG, B, H, Bl, Gl, RF, TBl`.

**Katalog (Ids, Bedingung, Normen; Texte formuliert der Implementer, Normen an der Quelle prüfen):**

| id | gruppe | wenn | Normen |
| --- | --- | --- | --- |
| `feststellung_gdb` | gdb | gdb_ab 20 | § 152 SGB IX (Hinweis Neufeststellung/Merkzeichen) |
| `pauschbetrag` | gdb | gdb_ab 20 | § 33b EStG |
| `gleichstellung` | gdb | gdb_ab 30, gdb_bis 40 | § 2 Abs. 3, § 151 SGB IX |
| `ausweis` | gdb | gdb_ab 50 | § 152 Abs. 5 SGB IX |
| `zusatzurlaub` | gdb | gdb_ab 50 | § 208 SGB IX |
| `kuendigungsschutz` | gdb | gdb_ab 50 (Hinweis: gilt auch für Gleichgestellte) | § 168 SGB IX |
| `begleitende_hilfe` | gdb | gdb_ab 50; gdb_ab 30 + gdb_bis 40 | § 185 SGB IX |
| `altersrente` | gdb | gdb_ab 50 | § 37 SGB VI (Wartezeit, Rentenversicherung) |
| `befoerderung` | merkzeichen | G, aG, H, Bl, Gl, TBl | § 228 SGB IX |
| `begleitperson` | merkzeichen | B | § 228 Abs. 6 SGB IX |
| `kfz_befreiung` | merkzeichen | H, Bl, aG | § 3a Abs. 1 KraftStG |
| `kfz_ermaessigung` | merkzeichen | G, Gl | § 3a Abs. 2 KraftStG (nicht neben unentgeltlicher Beförderung) |
| `fahrtkosten` | merkzeichen | gdb_ab 80; gdb_ab 70 + G; aG, Bl, TBl, H | § 33 Abs. 2a EStG |
| `pauschbetrag_erhoeht` | merkzeichen | H, Bl, TBl | § 33b Abs. 3 EStG |
| `mehrbedarf_g` | merkzeichen | G, aG | § 30 Abs. 1 SGB XII (nur bei Altersgrenze oder voller Erwerbsminderung, Bezug von Grundsicherung/Sozialhilfe) |
| `pflegeberatung` | pflege | pflegegrad_ab 1 | § 7a SGB XI |
| `entlastungsbetrag` | pflege | pflegegrad_ab 1 | § 45b SGB XI |
| `pflegehilfsmittel` | pflege | pflegegrad_ab 1 | § 40 SGB XI |
| `pflegegeld` | pflege | pflegegrad_ab 2 | § 37 SGB XI (Beratungsbesuch § 37 Abs. 3) |
| `pflegesachleistung` | pflege | pflegegrad_ab 2 | § 36, § 38 SGB XI |
| `tagespflege` | pflege | pflegegrad_ab 2 | § 41 SGB XI |
| `jahresbetrag` | pflege | pflegegrad_ab 2 | § 42a, § 39, § 42 SGB XI |
| `pflegeperson` | pflege | pflegegrad_ab 2 | § 44 SGB XI |
| `pflege_pauschbetrag` | pflege | pflegegrad_ab 2 | § 33b Abs. 6 EStG |
| `besondere_wohnform` | schnittstelle | pflegegrad_ab 2 | § 103 SGB IX, § 43a SGB XI |
| `hilfe_zur_pflege` | schnittstelle | pflegegrad_ab 1 | § 61 SGB XII, § 13 Abs. 3 SGB XI (nachrangig) |
| `persoenliches_budget` | schnittstelle | gdb_ab 20; pflegegrad_ab 1 | § 29 SGB IX |
| `kinder_35a` | schnittstelle | kind | § 35a SGB VIII, § 10 Abs. 4 SGB VIII |
| `blindengeld` | landesrecht | Bl, TBl | – (Hinweis: zusätzlich Blindenhilfe § 72 SGB XII als bundesrechtliche, nachrangige Leistung erwähnen, ohne Link-Pflicht) |
| `gehoerlosengeld` | landesrecht | Gl, TBl | – |
| `rundfunkbeitrag` | landesrecht | RF, TBl, Bl | – (Rundfunkbeitragsstaatsvertrag) |
| `parkerleichterung` | landesrecht | aG, Bl, G | – (bundesweit für aG und Bl über die StVO, darüber hinaus je Land; ohne Normlink) |

- [ ] **Step 1: Tests schreiben** (`test/leistungen.test.mjs`, Muster `test/verfahren.test.mjs`, Aufruf über `handleMessage` `tools/call`):
  - `tools/list` enthält `leistungshinweise`; Schema hat `gdb`, `merkzeichen`, `pflegegrad`, `alter_monate`.
  - `gdb: 50` → Ids enthalten `ausweis`, `zusatzurlaub`, `kuendigungsschutz`, `altersrente`, `pauschbetrag`; nicht `gleichstellung`, keine `pflege`-Gruppe.
  - `gdb: 30` → `gleichstellung`, `begleitende_hilfe`, nicht `ausweis`.
  - `gdb: 70, merkzeichen: ["g"]` → `fahrtkosten`, `befoerderung`, `kfz_ermaessigung`, `mehrbedarf_g`; `gdb: 70` ohne Merkzeichen → nicht `fahrtkosten`; `gdb: 80` → `fahrtkosten`.
  - `merkzeichen: ["H"]` → `kfz_befreiung`, `pauschbetrag_erhoeht`, `fahrtkosten`, `befoerderung`.
  - `merkzeichen: ["Bl"]` → `landesrecht` enthält `blindengeld`, alle Landesrecht-Einträge haben `normen: []` und einen Text mit „Landesrecht“.
  - `pflegegrad: 1` → `pflegeberatung`, `entlastungsbetrag`, `pflegehilfsmittel`, `hilfe_zur_pflege`; nicht `pflegegeld`. `pflegegrad: 3` → zusätzlich `pflegegeld`, `jahresbetrag`, `besondere_wohnform`.
  - `alter_monate: "120", gdb: 50` → `kinder_35a`; ohne Alter → nicht.
  - Jeder Eintrag aller Kombinationen: `signal`, `leistung`, `stelle`, `rang`, `naechster_schritt` nicht leer; jede URL passt auf `/^https:\/\/www\.gesetze-im-internet\.de\/[a-z0-9_]+\/__\d+[a-z]?\.html$/`; kein Text enthält `/Euro|€|\d\s*%/`; Ausgabe enthält kein `wenn`.
  - `hinweis` enthält „keine Anspruchsprüfung“ bzw. „prüft die Stelle“; `herkunft` enthält „kuratiert“; `beratung` nennt EUTB und § 7a SGB XI.
  - Fehler (`isError`): `{}`, `gdb: 110`, `gdb: "abc"`, `pflegegrad: 6`, `merkzeichen: ["X"]`, `merkzeichen: "G"` (kein Array).
- [ ] **Step 2: RED beobachten** — `node --test test/leistungen.test.mjs` schlägt fehl (Tool fehlt).
- [ ] **Step 3: Implementieren** — `src/leistungen.mjs`, `src/leistungen_tools.mjs`, Registrierung; jede Norm mit `curl -4` prüfen und die geprüften Normen samt Abweichungen im Report auflisten.
- [ ] **Step 4: GREEN** — `node --test test/leistungen.test.mjs test/http.test.mjs test/icf.test.mjs` grün, danach `npm test` grün.
- [ ] **Step 5: Commit** — `git commit -m "leistungshinweise: kuratierte Leistungen zu GdB, Merkzeichen und Pflegegrad"` mit Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 2: Prompt `leistungen_finden`, Doku, Version

**Files:** Modify `src/prompts.mjs`, `test/prompts.test.mjs`, `README.md`, `QUELLEN.md`, `public/index.html`, `docs/fallarbeit/plan.md`, `docs/fallarbeit/offene-punkte.md`, `package.json`, `src/protocol.mjs` (Version).

**Interfaces:** Consumes `leistungshinweise` (Task 1). Prompt-Muster: `eigene_darstellung_vorbereiten` in `src/prompts.mjs` (`WER`, `GRUNDSAETZE`, `PromptError`).

- [ ] **Step 1: Tests** in `test/prompts.test.mjs`: `leistungen_finden` in `prompts/list` mit Argument `wer_antwortet` (optional); Text nennt `leistungshinweise`, `fall_pruefen`, „Bescheid“, „nächste Schritt“ (oder „nächsten Schritt“), „Landesrecht“, EUTB, „§ 7a SGB XI“, „keine Rechtsberatung“, „keine Beträge“; enthält nicht „Erfolgsaussicht“; `wer_antwortet: "nachbar"` → -32602.
- [ ] **Step 2: RED**, **Step 3: Prompt implementieren** (Ablauf: Angaben aus Fallprofil bzw. GdB-/Pflegebescheid übernehmen – nur festgestellte Werte, eigene Orientierungswerte nicht als festgestellt verwenden; `leistungshinweise` aufrufen; Einträge nach Lebenslage ordnen (Arbeit, Mobilität, Steuern, Pflege zu Hause, Wohnen); Prioritäten der Person erfragen; je gewünschtem Eintrag nächsten Schritt und zuständige Stelle allgemein; Landesrecht als „je Land verschieden“; Beratung), **Step 4: GREEN**.
- [ ] **Step 5: Doku**: README Abschnitt „Leistungen und Nachteilsausgleiche“ (Tool, Eingaben, Gruppen, keine Beträge, Landesrecht als Hinweis) und Prompt-Zeile; `public/index.html` Tool- und Prompt-Liste; `QUELLEN.md` Abschnitt „Normen für `leistungshinweise`“ (geprüft 22.11.2026, Liste der Normen, kuratiert); `plan.md` Zeilen `leistungshinweise` und `leistungen_finden` auf „✅ 1.12.0“, Reihenfolge Schritt 6 mit ✅; `offene-punkte.md` Abschnitt „Leistungen (Version 1.12.0)“ mit zurückgestellten Punkten aus dem Report; Version 1.12.0.
- [ ] **Step 6: `npm test` grün, Commit** `"leistungen_finden und Doku (Version 1.12.0)"` mit Co-Authored-By-Zeile.
