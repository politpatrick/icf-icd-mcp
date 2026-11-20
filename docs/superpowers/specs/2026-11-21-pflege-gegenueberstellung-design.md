# Pflege: Gutachten verstehen und Selbsteinschätzung (bi_gegenueberstellen, Prompts)

Stand: 21.11.2026 · Größe: kleine Erweiterung · Schritt 2 des Plans „Fallarbeit“ · vom Nutzer freigegeben

## Warum

Antragsberechtigte Personen sollen ein Pflegegutachten verstehen und ihrer eigenen Sicht gegenüberstellen
können und sich vor einer Begutachtung in einem geführten Interview selbst einschätzen. Jeder Unterschied wird
so beschrieben, dass klar wird, was gemeint ist – als Grundlage für eine eigene Darstellung. Keine
Rechtsberatung, keine Bewertung, ob das Gutachten „falsch“ ist.

## Ziele

1. **`bi_gegenueberstellen`** (BI-Modul, mit `ICF_MCP_BI=0` abgeschaltet)
   - Eingabe: `gutachten` und `eigene` als Kodierung (wie `bi_calculate`) **oder** `profil` (Fallprofil) mit
     `herkunft_gutachten` (Standard `gutachten`) und `herkunft_eigene` (Standard `interview`, sonst
     `selbstauskunft`); optional `alter_monate` (Vorrang vor `meta.alter` des Profils).
   - **Gutachten ist die Grundlage**, eigene Werte werden eingesetzt; die eigene Einschätzung darf unvollständig sein.
   - Je Unterschied vier Teile: (1) Definition des Kriteriums (Erwachsene bzw. Kinderfassung nach Alter),
     (2) Bedeutung beider Stufen – Label und Erläuterung der BRi wörtlich, (3) Wirkung – Einzelpunkte, Modulsumme
     und gewichtete Punkte vorher/nachher, bei Modul 2/3 ob das Modul zählt, und ob **dieser Unterschied allein**
     den Pflegegrad ändert, (4) Hinweise und Abgrenzungen der BRi zum Kriterium (Hinweistexte der Variante und
     Kanten aus dem Wissensnetz).
   - Gesamt: Punkte und Grad nach Gutachten und mit allen eigenen Werten, Unterschiede nach Wirkung sortiert
     (gewichtete Punktdifferenz), Abstand zur nächsten Schwelle.
   - Unvollständiges Gutachten: kein Grad, Liste der fehlenden Kriterien.
2. **MCP-Prompts im Protokoll**: `prompts/list`, `prompts/get`, Fähigkeit `prompts` in `initialize`.
3. **Prompt `pflegegrad_interview`** (Argumente `wer_antwortet`, optional `alter_monate`) und
   **`pflegegutachten_verstehen`** (optional `alter_monate`) mit Ablauf wie im freigegebenen Entwurf; beide nur
   bei eingeschaltetem BI-Modul.

## Nicht-Ziele und Grenzen

- Keine Aussage, ob das Gutachten fehlerhaft ist; keine Empfehlung eines Rechtsbehelfs; allgemeiner Hinweis auf
  Widerspruchsmöglichkeit und Frist laut Rechtsbehelfsbelehrung, Verweis auf Pflegeberatung (§ 7a SGB XI) und EUTB.
- Das Gutachten-PDF liest der Client.
- Keine Speicherung, keine Interna.

## Ansätze

| Ansatz | Bewertung |
| --- | --- |
| **Gutachten als Grundlage, eigene Werte einsetzen** (gewählt) | Unvollständige eigene Einschätzung genügt; Wirkung jedes Unterschieds direkt messbar |
| Zwei vollständige Einschätzungen vergleichen | Zwingt die Person, alle 64 Kriterien neu einzuschätzen |
| Nur Punktvergleich ohne Texte | Erklärt nicht, was gemeint ist |

## Festlegungen

- Wirkung „allein“: Gutachten mit genau diesem eigenen Wert eingesetzt, sonst unverändert.
- Abstand zur Schwelle: Gesamtpunkte mit allen eigenen Werten gegen die Schwellen 12,5 / 27 / 47,5 / 70 / 90.
- Unterschiede nur, wo der eigene Wert vom Gutachten abweicht; gleiche Werte zählen als „bestätigt“ (Anzahl).
- Prompt-Texte in `src/prompts.mjs`; Argumente als Strings (MCP-Vorgabe), Alter wird geprüft.
- Version 1.8.0, README-Abschnitte, Instructions-Satz.
