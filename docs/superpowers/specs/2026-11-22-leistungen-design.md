# Leistungen: leistungshinweise und Prompt leistungen_finden

Stand: 22.11.2026 · Größe: Erweiterung mit kuratiertem Katalog · Schritt 6 des Plans „Fallarbeit“ · vom Nutzer freigegeben

## Warum

Antragsberechtigte wissen oft nicht, welche Leistungen und Nachteilsausgleiche an GdB, Merkzeichen und Pflegegrad
anknüpfen und wo man sie beantragt. Ein kuratierter Katalog zeigt mögliche Leistungen mit Norm, Stelle, Rang und
nächstem Schritt – ohne Beträge (sie ändern sich laufend) und ohne Anspruchsprüfung.

## Ziele

1. **`leistungshinweise`** (immer eingeschaltet), Daten und Logik in `src/leistungen.mjs`, Tool in
   `src/leistungen_tools.mjs`. Eingaben (mindestens eine): `gdb` (0–100), `merkzeichen` (Liste aus G, aG, B, H,
   Bl, Gl, RF, TBl), `pflegegrad` (1–5), optional `alter_monate`.
   - Je passender Eintrag: `id`, `gruppe` (gdb | merkzeichen | pflege | schnittstelle | landesrecht), `signal`
     (lesbar, z. B. „GdB ab 50“), `leistung`, `normen` [{zitat, url}] (leer bei Landesrecht), `stelle`, `rang`,
     `naechster_schritt`, `voraussetzung` (allgemein, z. B. weitere Bedingungen), optional `alter_hinweis`.
   - Gesamthinweis: kuratiert, keine Beträge, keine Anspruchsprüfung; „Ob ein Anspruch besteht, prüft die Stelle“;
     Beratung (EUTB, Pflegeberatung § 7a SGB XI, Pflegestützpunkt, Sozialverbände, Integrationsamt/-fachdienst).
   - **Landesrecht** (Blindengeld, Gehörlosengeld, Rundfunkbeitrag RF, Parkerleichterungen über aG hinaus) nur als
     gekennzeichneter Hinweis „Landesrecht, je Land verschieden“, ohne Normlink (Nutzerentscheidung).
   - Fehler (`LookupError`): keine Eingabe, Werte außerhalb des Bereichs, unbekanntes Merkzeichen.
2. **Prompt `leistungen_finden`** (`wer_antwortet`): Angaben aus Fallprofil/Bescheiden übernehmen,
   `leistungshinweise` aufrufen, je Eintrag den nächsten Schritt, Prioritäten der Person erfragen, Beratung.
3. Version 1.12.0, README, Startseite, QUELLEN (Normliste, Prüfdatum), Plan, offene Punkte.

## Nicht-Ziele

- Keine Beträge, keine Einkommens- oder Vermögensprüfung, keine Anspruchs- oder Zuständigkeitsentscheidung.
- Keine vollständige Liste aller Nachteilsausgleiche; Auswahl der wichtigsten bundesrechtlichen.

## Ansätze

| Ansatz | Bewertung |
| --- | --- |
| **Kuratiertes JS-Modul wie `verfahren.mjs`** (gewählt) | kein Build-Schritt, testbar, Normen geprüft |
| JSON unter `data/` | kein Gewinn ohne Build |
| freie Modellantwort ohne Katalog | nicht prüfbar, Gefahr veralteter Werte |

## Festlegungen

- Bedingungen als Liste von Alternativen (ODER) aus Bedingungsgruppen (UND): `gdb_ab`, `gdb_bis`,
  `merkzeichen` (eines davon), `pflegegrad_ab`, `kind` (nur bei `alter_monate` < 216).
- Jede Norm wird an gesetze-im-internet.de geprüft (`curl -4`); weicht die Quelle von der Planliste ab, gilt die Quelle.
