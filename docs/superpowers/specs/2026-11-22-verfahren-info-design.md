# Verfahren: verfahren_info und Prompt eigene_darstellung_vorbereiten

Stand: 22.11.2026 · Größe: kleine Erweiterung · Schritt 3 des Plans „Fallarbeit“ · vom Nutzer freigegeben

## Warum

Antragsberechtigte Personen stoßen nach einem Bescheid oder Gutachten auf Begriffe wie Widerspruch,
Überprüfungsantrag oder Akteneinsicht. Sie sollen diese Wege **allgemein** verstehen und ihre eigene Situation
sachlich aufschreiben können. Keine Rechtsberatung: keine Fristberechnung, keine Empfehlung, welcher Weg im
Einzelfall passt, keine Erfolgsaussichten.

## Ziele

1. **`verfahren_info`** (immer eingeschaltet), Daten in `src/verfahren.mjs`, Werkzeug in `src/verfahren_tools.mjs`.
   - Ohne Argument: Übersicht aller Themen (Kennung, Titel, ein Satz).
   - Mit `thema`: `widerspruch`, `ueberpruefungsantrag` (§ 44 SGB X), `neufeststellungsantrag` (§ 48 SGB X, auch
     Höherstufungsantrag), `akteneinsicht` (§ 25 SGB X), `untaetigkeitsklage` (§ 88 SGG), `zustaendigkeit`
     (§ 14 SGB IX), `bekanntgabe` (§ 37 SGB X).
   - Je Thema: Erklärung in einfacher Sprache (kuratiert), Normen mit Zitat, Link auf gesetze-im-internet.de und
     kurzem wörtlichem Auszug (amtlich), was man allgemein braucht, verwandte Themen, Besonderheiten.
   - Frist nur als Verweis auf die Rechtsbehelfsbelehrung des Bescheids (dazu § 66 SGG allgemein); **keine
     persönliche Fristberechnung**.
   - Besonderheit Jugendhilfe (SGB VIII, auch § 35a): Widerspruch und Untätigkeitsklage nach VwGO (§§ 70, 75).
   - Beratung: EUTB (§ 32 SGB IX), Pflegeberatung (§ 7a SGB XI), Pflegestützpunkt (§ 7c SGB XI), Sozialverbände.
   - Unbekanntes Thema: `LookupError` mit der Liste der Themen.
2. **Prompt `eigene_darstellung_vorbereiten`** (Argumente `wer_antwortet`, optional `bereich` = gdb | pflege |
   teilhabe), nicht an das BI-Modul gebunden; `bi_gegenueberstellen` wird nur bei eingeschaltetem BI-Modul genannt.
   Ablauf: Anlass klären → Tatsachen, Beobachtungen, Belege, O-Ton (aus dem Fallprofil) getrennt erfassen →
   `fall_pruefen` → Wege allgemein mit `verfahren_info` → Gliederung der eigenen Darstellung ohne rechtliche
   Begründung, Verweis auf Beratung.
3. Version 1.9.0, README, QUELLEN, Instructions-Satz, Status in `docs/fallarbeit/plan.md`.

## Nicht-Ziele

- Keine Fristberechnung, keine Wegempfehlung, keine Bewertung von Bescheid oder Gutachten.
- Keine Änderung des Fallprofil-Schemas (`verfahren.art` kennt keine Überprüfungs- oder Neufeststellungsanträge;
  als offener Punkt notiert).
- Skill `eigenes_schreiben`: nur Entwurf außerhalb des Repos.

## Ansätze

| Ansatz | Bewertung |
| --- | --- |
| **Kuratierte Daten als JS-Modul** (gewählt) | wenig Text, kein Build-Schritt, testbar |
| JSON-Datei unter `data/` | kein Build-Schritt vorhanden, kein Gewinn |
| Parameter `bereich` im Werkzeug | Besonderheiten passen als Hinweise in die Themen; weniger Oberfläche |

## Festlegungen

- Normtexte am 22.11.2026 an gesetze-im-internet.de geprüft; Auszüge wörtlich, Stand in `QUELLEN.md`.
- Herkunft je Teil: `erklaerung` kuratiert, `normen[].auszug` amtlich.
