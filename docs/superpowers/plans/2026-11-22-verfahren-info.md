# Verfahren (verfahren_info, eigene_darstellung_vorbereiten) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allgemeine Verfahrensinformationen als Werkzeug und ein geführter Ablauf für die eigene Darstellung.

**Architecture:** Kuratierte Themen in `src/verfahren.mjs` (Daten + `info()`), Tool-Definition in `src/verfahren_tools.mjs` nach dem Muster von `fall_tools.mjs`, Prompt in `src/prompts.mjs`.

**Tech Stack:** Node ≥ 18, `node:test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-22-verfahren-info-design.md`

## Global Constraints

- Keine Rechtsberatung: keine Fristberechnung, keine Empfehlung eines Wegs, keine Erfolgsaussichten.
- Normauszüge wörtlich wie auf gesetze-im-internet.de (geprüft 22.11.2026).
- Fehler als `LookupError` (Tool) bzw. `PromptError` → -32602 (Prompt).
- Version 1.9.0 in `package.json` und `SERVER_INFO`.

## Review Focus

- `thema` mit Großbuchstaben/Leerzeichen („ Widerspruch “) → wird normalisiert erkannt.
- `thema` kein Text (Zahl, Objekt) → `LookupError`, kein Absturz.
- Prompt mit `bereich` außerhalb der Liste → -32602.
- Prompt bei `ICF_MCP_BI=0` → nennt `bi_gegenueberstellen` nicht.
- Kein Text enthält eine konkrete Fristberechnung oder „Erfolgsaussicht“.

---

### Task 1: verfahren_info

**Files:** Create `src/verfahren.mjs`, `src/verfahren_tools.mjs`, `test/verfahren.test.mjs`; Modify `src/protocol.mjs` (Tools, Instructions).

**Interfaces:** Produces `THEMEN` (Array `{ id, titel, kurz, erklaerung, normen: [{ zitat, url, auszug }], was_man_braucht: [], verwandt: [], besonderheiten: [] }`), `info({ thema }) -> { herkunft, themen } | { herkunft, thema..., frist, beratung, hinweis }`, `VERFAHREN_TOOLS`, `VERFAHREN_INSTRUCTIONS`.

- [ ] Test: Übersicht listet die sieben Kennungen; jedes Thema hat mindestens eine Norm mit `https://www.gesetze-im-internet.de/`-URL und nicht leerem Auszug; `widerspruch` nennt § 84 SGG, § 66 SGG, VwGO; `frist` verweist auf „Rechtsbehelfsbelehrung“; `beratung` nennt EUTB, § 7a SGB XI, § 7c SGB XI; „ Widerspruch “ wird erkannt; unbekanntes/kein Text-Thema → `isError`; kein Text mit „Erfolgsaussicht“; über `tools/call` aufrufbar.
- [ ] RED beobachten, implementieren, GREEN, commit.

### Task 2: Prompt eigene_darstellung_vorbereiten

**Files:** Modify `src/prompts.mjs`, `test/prompts.test.mjs`.

- [ ] Test: in `prompts/list` mit Argumenten `wer_antwortet`, `bereich`; Text nennt `verfahren_info`, `fall_pruefen`, „O-Ton“, „Tatsachen“, „Belege“, EUTB, „keine Rechtsberatung“, „Rechtsbehelfsbelehrung“; `bereich: "pflege"` nennt `bi_gegenueberstellen`; ungültiger `bereich` → -32602; bei `ICF_MCP_BI=0` vorhanden, ohne `bi_gegenueberstellen`.
- [ ] RED, implementieren, GREEN, commit.

### Task 3: Doku und Version

- [ ] README (Tool-Abschnitt „Verfahren“, Prompt-Tabelle), QUELLEN (Abschnitt Gesetzesauszüge), `docs/fallarbeit/plan.md` Status, `offene-punkte.md` (Schema `verfahren.art`), Version 1.9.0; Tests grün; commit.
