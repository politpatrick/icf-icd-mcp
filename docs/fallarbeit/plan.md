# Fallarbeit: Gesamtplan

Stand: 22.11.2026 · Pflege: bei jedem abgeschlossenen Schritt Status und PR-Link nachtragen.
Offene Kleinigkeiten stehen in [offene-punkte.md](offene-punkte.md); Designs und Umsetzungspläne der einzelnen
Schritte unter [`docs/superpowers/`](../superpowers/).

## Ziel

Antragsberechtigte Personen erfassen ihre Situation für **GdB-Antrag, Pflegebegutachtung und Eingliederungshilfe**
einmal strukturiert (Fallprofil) und werden in geführten Abläufen (MCP-Prompts) Schritt für Schritt begleitet:
Anträge vorbereiten, Bescheide und Gutachten verstehen, die eigene Sicht darstellen. Kodierte Ergebnisse lassen sich
an andere Skills, MCP-Server, Chats und Agenten weitergeben.

## Grundsätze (verbindlich)

- **Zielgruppe** sind antragsberechtigte Personen, ggf. mit einer unterstützenden Person in ihrem Auftrag. Keine
  Fachkräfte- oder Leistungsträger-Perspektive.
- **Keine Rechtsberatung**: informieren, ordnen, die eigene Darstellung unterstützen. Keine Einschätzung von
  Erfolgsaussichten, keine Empfehlung eines Rechtsbehelfs im Einzelfall, keine Aussage zur Rechtmäßigkeit oder
  „Richtigkeit“ eines Bescheids oder Gutachtens. An passenden Stellen Verweis auf unabhängige Beratung (EUTB,
  Pflegeberatung nach § 7a SGB XI, Pflegestützpunkt, Sozialverbände).
- **Keine Interna**: nur öffentliche Grundlagen (Gesetze, amtliche Klassifikationen, BRi, VersMedV,
  veröffentlichte Instrumente und Formulare).
- **Herkunft kennzeichnen**: amtlich, kuratiert (nicht amtlich) oder Einschätzung des Modells.
- **Unsicherheit zeigen**: fehlen Angaben oder Befunde, zuerst die Lücken nennen statt eines Ergebnisses
  (Pflegegrad nur bei vollständigen Angaben, kein Gesamt-GdB als Zahl).
- **Datenschutz**: Pseudonym statt Name, keine Anschriften oder Nummern; der Server speichert nichts.
- **Altersweiche**: Kinderfassung des BI, Säuglingsregel bis 18 Monate, Altersvergleich bis 11 Jahre,
  Hilflosigkeit bei Kindern (VersMedV Teil A 5), Eingliederungshilfe nach § 35a SGB VIII.
- **Gesprächsregeln** in allen Abläufen: einfache Sprache, Pausen, behutsam bei schambesetzten Themen, O-Ton vor
  geglätteten Formulierungen, kenntlich machen, wer antwortet.

## Aufbau

| Ebene | Aufgabe |
| --- | --- |
| MCP-Server (öffentlich, zustandslos) | Fachwissen, feste Prüf- und Rechenschritte, Fallprofil-Format, Prompts |
| Chat bzw. Modell | Gespräch, Dokumente lesen, Begründungen formulieren |
| Lokale Skills | Ausgabe als Word/PDF, regional gebundene Formulare |

## Bausteine und Stand

### Werkzeuge

| Werkzeug | Zweck | Stand |
| --- | --- | --- |
| `fall_schema`, `fall_pruefen`, `fall_vergleichen` | Fallprofil: Format, Prüfung mit Lückenhinweisen und Lebensbereichen nach § 118 SGB IX, Vergleich zweier Fassungen | ✅ 1.7.0 ([#15](https://github.com/politpatrick/icf-icd-mcp/pull/15)) |
| `bi_gegenueberstellen` | Pflegegutachten und eigene Einschätzung gegenüberstellen | ✅ 1.8.0 ([#16](https://github.com/politpatrick/icf-icd-mcp/pull/16)) |
| `verfahren_info` | Allgemeine Erklärung von Widerspruch, Überprüfungs-, Neufeststellungs- und Höherstufungsantrag, Akteneinsicht; Frist nur mit Verweis auf die Rechtsbehelfsbelehrung, **keine** persönliche Fristberechnung | ✅ 1.9.0 ([#18](https://github.com/politpatrick/icf-icd-mcp/pull/18)) |
| GdS-Zeilen-Kennungen + `vmg_spanne_pruefen` | Einzel-GdB gegen die Spanne der Teil-B-Zeile prüfen, mit Pfad und Fundstelle | ✅ 1.10.0 ([#19](https://github.com/politpatrick/icf-icd-mcp/pull/19)) |
| `abgrenzung_egh_pflege` | ICF-d-Kategorien → BI-Kriterien mit Orientierung Überschneidung/Teilhabe (bewusst ohne „nur Pflege“, § 13 Abs. 3 SGB XI); kuratiert, auf `bi_icf_mapping` aufbauend | ✅ 1.11.0 |
| `leistungshinweise` | Signal → mögliche Leistung → Träger → Rang → nächster Schritt; Nachteilsausgleiche je GdB, Merkzeichen, Pflegegrad; Schnittstellen (§ 103 SGB IX, § 43a SGB XI, SGB XII, § 29 SGB IX, § 35a SGB VIII); kuratiert, ohne Beträge, keine Anspruchsprüfung | offen |

### Prompts (geführte Abläufe)

| Prompt | Zweck | Stand |
| --- | --- | --- |
| `pflegegrad_interview` | Selbsteinschätzung vor der Pflegebegutachtung | ✅ 1.8.0 |
| `pflegegutachten_verstehen` | Gutachten verstehen und mit der eigenen Sicht vergleichen | ✅ 1.8.0 |
| `gdb_antrag_vorbereiten` | Diagnosen, Auswirkungen, Befunde; Orientierung aus Teil B; Merkzeichen; Nachteilsausgleiche; Befundanforderung an die Ärztin | ✅ 1.10.0 ([#19](https://github.com/politpatrick/icf-icd-mcp/pull/19)) |
| `gdb_bescheid_verstehen` | Was festgestellt wurde, was die Werte bedeuten, wo die eigene Situation abweicht; Bescheid in einfacher Sprache | ✅ 1.10.0 ([#19](https://github.com/politpatrick/icf-icd-mcp/pull/19)) |
| `teilhabebedarf_erfassen` | Bedarfe ICF-strukturiert und ICD-fundiert in Ich-Form mit O-Ton, Lebensbereiche, Orientierung zur Zuständigkeit | ✅ 1.11.0 |
| `bedarfsfeststellung_verstehen` | Kommen eigene Bedarfe, Wünsche und Ziele vor, wo fehlen Belege | ✅ 1.11.0 |
| `eigene_darstellung_vorbereiten` | Eigene Situation sachlich aufschreiben (Tatsachen, Beobachtungen, Belege); Wege allgemein erklären | ✅ 1.9.0 ([#18](https://github.com/politpatrick/icf-icd-mcp/pull/18)) |
| `leistungen_finden` | Mögliche weitere und vorrangige Leistungen und Nachteilsausgleiche, Zuständigkeit, Beratungsstellen | offen |

### Lokale Skills (nicht im öffentlichen Server)

| Skill | Zweck | Stand |
| --- | --- | --- |
| `eigenes_schreiben` | Brief der Person mit ihrer Sachdarstellung als Word-Datei; allgemeine Vorlagen für Vollmacht, Schweigepflichtentbindung und Akteneinsicht; keine rechtliche Begründung | ✅ lokal unter `~/.claude/skills/eigenes-schreiben/` (nicht im Repo) |
| `lwl-formulare` | EGH-Antrag und „Persönliche Sicht“ (öffentliche LWL-Formulare) als PDF aus dem Fallprofil; fachliche Stellungnahme wird nie ausgefüllt | offen |

## Reihenfolge

1. ✅ Fallprofil (`fall_*`) – [#15](https://github.com/politpatrick/icf-icd-mcp/pull/15)
2. ✅ Pflege: `bi_gegenueberstellen`, Prompts `pflegegrad_interview`, `pflegegutachten_verstehen` – [#16](https://github.com/politpatrick/icf-icd-mcp/pull/16)
3. ✅ Verfahren: `verfahren_info`, Prompt `eigene_darstellung_vorbereiten` (1.9.0) – [#18](https://github.com/politpatrick/icf-icd-mcp/pull/18); Skill `eigenes_schreiben` als Entwurf außerhalb des Repos
4. ✅ GdB: Kennungen der GdS-Zeilen, `vmg_spanne_pruefen`, Prompts `gdb_antrag_vorbereiten`, `gdb_bescheid_verstehen` (1.10.0) – [#19](https://github.com/politpatrick/icf-icd-mcp/pull/19)
5. ✅ Teilhabe: `abgrenzung_egh_pflege`, Prompts `teilhabebedarf_erfassen`, `bedarfsfeststellung_verstehen` (1.11.0)
6. Leistungen: `leistungshinweise`, Prompt `leistungen_finden`
7. Skill `lwl-formulare`

## Grenzen

- Prompts haben kein Gedächtnis; den Zustand trägt das Fallprofil. Lange Interviews modulweise mit Pausen.
- Prompt-Unterstützung ist je Client verschieden; Werkzeuge und Fallprofil funktionieren überall.
- Dokumente (Bescheide, Gutachten, Befunde) liest der Client.
- Kein Gesamt-GdB als Zahl aus einem Werkzeug; Pflegegrad nur bei vollständigen Angaben.
- Kuratierte Teile sind nicht amtlich und werden in der wöchentlichen Prüfung mitgepflegt; keine Beträge oder
  jährlich wechselnden Werte.
- Landesspezifische Bedarfsermittlungsinstrumente sind nicht abgebildet.

## Ideen, die geprüft und zurückgestellt oder verworfen wurden

| Idee | Entscheidung |
| --- | --- |
| Kuratiertes Mapping ICD ↔ ICF | verworfen (Nutzer, 18.11.2026): eine Diagnose sagt nichts über die Funktionsfähigkeit im Einzelfall |
| ICD-10-GM 2027 und Versionsvergleich | entfällt: Dreijahresturnus, ICD-10-GM 2026 gilt voraussichtlich bis Ende 2028; nächste Version 2029 |
| SGB IX § 118 mit Bedarfsermittlungsinstrumenten der Länder | zurückgestellt: Lizenz je Land prüfen |
| Heilmittel-Richtlinie Anlage 2 (langfristiger Heilmittelbedarf) | zurückgestellt |
| ICF Core Sets, ICF-CY | nicht möglich: urheberrechtlich geschützt |
| Hilfsmittelverzeichnis des GKV-Spitzenverbands | zurückgestellt: Nutzungsbedingungen unklar, sehr umfangreich |
| OPS | nicht relevant für die Zielgruppe |
| Leistungsträger-Perspektive (Entscheidung vorbereiten, Fachleistungsstunden, Vermerke) | verworfen: Zielgruppe sind Antragsberechtigte; Interna ausgeschlossen |
