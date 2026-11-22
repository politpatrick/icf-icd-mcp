# GdB: Zeilenkennungen, vmg_spanne_pruefen und Prompts

Stand: 22.11.2026 · Größe: kleine Erweiterung · Schritt 4 des Plans „Fallarbeit“ · vom Nutzer freigegeben

## Warum

Antragsberechtigte sollen einen GdB-Antrag vorbereiten und einen GdB-Bescheid verstehen können. Dafür muss ein
Einzel-GdB einer bestimmten Zeile in Teil B zugeordnet und gegen deren Wert bzw. Spanne geprüft werden können –
immer mit Pfad und Fundstelle, ohne Wertung und ohne Gesamt-GdB als Zahl.

## Ziele

1. **Zeilenkennung `VMG:B 3.7 Z2`**: Z*n* = *n*-te Zeile mit GdS-Wert im Abschnitt (ab 1). Alle 767 Zeilen liegen
   in 120 untersten Abschnitten.
   - `normalizeVmgId` versteht „b3.7 z2“, „B 3.7 Z 2“.
   - `vmg_get` zeigt je Zeile die `id`; mit Zeilenkennung liefert es genau diese Zeile (Text, GdS, Pfad,
     Fundstelle, Abschnitt).
   - Fallprofil: Zeilenkennung als `kode` bei `art: vmg` erlaubt.
2. **`vmg_spanne_pruefen`** (`kennung` = Zeile, `gdb` = ganze Zahl 0–100): Ergebnis `innerhalb`, `unterhalb`,
   `oberhalb` oder `nicht_bestimmbar` mit Zeile, Pfad, Fundstelle, Spanne (`von`, `bis`, `bis` = 100 bei
   „wenigstens/mindestens“) und Hinweis auf Teil A Nr. 1.4. Abschnittskennung statt Zeile: Fehler mit Liste der
   Zeilen des Abschnitts.
3. **`fall_pruefen`**: Eintrag `vmg` mit Zeilenkennung und `gdb` außerhalb der Spanne → Warnung am Eintrag.
4. **Prompts** (nur bei eingeschaltetem VersMedV-Modul):
   - `gdb_antrag_vorbereiten` (`wer_antwortet`, `alter_monate`): Diagnosen (ICD), Auswirkungen mit O-Ton, Befunde,
     Orientierung an Teil-B-Zeilen mit `vmg_spanne_pruefen`, Merkzeichen (`vmg_merkzeichen`), Befundanforderung an
     behandelnde Ärztinnen und Ärzte, Nachteilsausgleiche nur allgemein mit Verweis auf Beratung; kein Gesamt-GdB
     als Zahl; bei Kindern Hilflosigkeit nach Teil A Nr. 5.
   - `gdb_bescheid_verstehen` (`alter_monate`): festgestellte Funktionsbeeinträchtigungen und Einzel-GdB (falls
     im Bescheid bzw. in der Akte genannt) Zeilen zuordnen und erklären, `vmg_gesamt_gdb` als Prüfhilfe,
     Unterschiede zur eigenen Sicht, `verfahren_info`, Rechtsbehelfsbelehrung, Beratung.
5. Version 1.10.0, README, Startseite, Plan-Status, offene Punkte.

## Nicht-Ziele

- Keine Wertung („außerhalb“ heißt nicht „falsch“), kein Gesamt-GdB, keine Nachteilsausgleichsliste (Schritt 6).
- Keine Kennungen für Zeilen der Sondertabellen (Hörverlust, Sehschärfe).

## Ansätze

| Ansatz | Bewertung |
| --- | --- |
| **Zählkennung je Abschnitt** (gewählt) | lesbar, kurz; Zählung kann sich bei Änderung der Verordnung verschieben → Test/Wochenprüfung |
| Hash des Zeilentexts | stabil, aber nicht lesbar |
| Prüfung über Zeilentext | mehrdeutig |

## Festlegungen

- Kennung wird zur Laufzeit aus `data/versmedv.json` abgeleitet (kein Build-Schritt).
- „siehe oben“ → `nicht_bestimmbar`. Werte wie „25“ sind Einzelwerte.
- `gdb` außerhalb 0–100 oder nicht ganzzahlig → `LookupError`.
