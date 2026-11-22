# Teilhabe: abgrenzung_egh_pflege und Prompts

Stand: 22.11.2026 · Größe: kleine Erweiterung · Schritt 5 des Plans „Fallarbeit“ · vom Nutzer freigegeben

## Warum

Antragsberechtigte sollen ihren Teilhabebedarf ICF-strukturiert erfassen und eine Bedarfsfeststellung bzw. einen
Gesamtplan verstehen können. Dazu gehört eine Orientierung, ob ein Bedarf (auch) von der Pflegeversicherung erfasst
wird oder nur über Leistungen zur Teilhabe abgedeckt werden kann – ohne Zuständigkeitsentscheidung.

## Rechtslage (geprüft an gesetze-im-internet.de, 22.11.2026)

- § 13 Abs. 3 Satz 3 SGB XI: Eingliederungshilfe ist im Verhältnis zur Pflegeversicherung **nicht nachrangig**;
  § 91 Abs. 3 SGB IX verweist darauf. Daher **kein Etikett „nur Pflege“** (Abweichung vom Plan, vom Nutzer freigegeben).
- Abgrenzung nach dem Zweck: Pflege (§ 36 SGB XI: Bereiche des § 14 Abs. 2, auch Hilfen bei der Haushaltsführung)
  bzw. Befähigung und Teilhabe (§ 78 Abs. 2, § 113 SGB IX).
- § 118 SGB IX (neun Lebensbereiche), § 117 Abs. 2 (Vertrauensperson), § 104 Abs. 2 (Wünsche), § 121 (Gesamtplan),
  § 14 SGB IX (Zuständigkeit), § 35a SGB VIII (Kinder mit seelischer Behinderung).

## Ziele

1. **`abgrenzung_egh_pflege`** (nur bei eingeschaltetem BI-Modul), Eingabe `codes`: Liste von ICF-d-Kodes, auch mit
   Beurteilungsmerkmal (`d510.3`). Je Kode: Titel, Lebensbereich nach § 118 SGB IX, `orientierung`:
   - `ueberschneidung`: d-Kategorie (direkt, über Ober- oder Unterkategorie) einem BI-Kriterium zugeordnet; BI-Kriterien
     mit Beziehung, Begründung und `pflegegrad_relevant` (Kriterium eines Moduls 1–6 bzw. nicht, Bereiche 6.1/6.2).
   - `teilhabe`: im BI nicht erfasst; Hinweis auf die Leistungsgruppe der Eingliederungshilfe nach Kapitel
     (d8: Teilhabe an Bildung § 112, Beschäftigung § 111, vorrangig ggf. andere Rehabilitationsträger § 6, § 91 Abs. 1;
     sonst Soziale Teilhabe § 113 mit Assistenz § 78).
   - Gesamthinweis: Orientierung, keine Zuständigkeitsentscheidung; § 13 Abs. 3 SGB XI; § 14 SGB IX; Herkunft kuratiert.
   - Fehler (`LookupError`): leere Liste, mehr als 100 Kodes, Kode nicht aus Komponente d, unbekannter Kode.
2. **Prompt `teilhabebedarf_erfassen`** (`wer_antwortet`, `alter_monate`).
3. **Prompt `bedarfsfeststellung_verstehen`** (`alter_monate`).
4. Version 1.11.0, README, Startseite, Plan, offene Punkte.

## Nicht-Ziele

- Keine Zuständigkeits- oder Anspruchsprüfung, keine Leistungsliste (Schritt 6), keine landesspezifischen Instrumente.

## Ansätze

| Ansatz | Bewertung |
| --- | --- |
| **Zur Laufzeit aus `bi_icf_mapping` ableiten** (gewählt) | keine neue Datei, eine Quelle der Wahrheit |
| eigene kuratierte Tabelle je d-Kategorie | doppelte Pflege, Gefahr von Widersprüchen |
| drei Kennzeichnungen inkl. „Pflege“ | widerspricht § 13 Abs. 3 Satz 3 SGB XI |
