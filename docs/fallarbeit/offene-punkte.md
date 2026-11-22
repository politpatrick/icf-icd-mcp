# Offene Punkte

Stand: 22.11.2026. Zurückgestellte Kleinigkeiten aus den Reviews, nach Modul geordnet. Jeder Punkt ist einzeln als
kleiner PR umsetzbar (Test zuerst). Erledigte Punkte im selben PR **streichen** (Zeile entfernen und im PR nennen),
damit die Liste aktuell bleibt. Neue zurückgestellte Punkte hier ergänzen.

Kennzeichnung: **Aufwand** klein (< 1 Std.) · mittel (halber Tag).

## ICD-10-GM und Alphabet (`src/icd.mjs`, Version 1.5.0/1.6.1)

- [ ] Verweise werden gegen den ganzen Satz abgeglichen; „Krankheit“ liefert allgemeine Verweise („Abnorm – s. Art der Krankheit“). Nur den Leitbegriff vor „ – s.“ abgleichen. *klein*
- [ ] Kein `hinweis` zum Vorrang des Systematischen Verzeichnisses, wenn nur Verweise zurückkommen. *klein*
- [ ] Alphabet-Texte liegen doppelt normalisiert im Speicher (rund 90 MB RSS, 130 ms Start). Nur Indexstring plus Offsets halten. *mittel*

## VersMedV (`src/vmg.mjs`, `scripts/versmedv_to_json.py`, `scripts/k710_extract.py`)

- [ ] `vmg_merkzeichen` ohne Argument liefert rund 44 KB (H allein 25 KB); Kurzmodus mit Fundstellen und ersten Sätzen. *mittel*
- [ ] `vmg_search`: bei Punktgleichstand Teil B vor Teil A/C ordnen. *klein*
- [ ] ICD-Ableitung in `vmg_search`: lose Teilstring-Treffer (z. B. „Gastroparese“ → „Parese“, G81.9 → „Niere“); Abgleich an Wortgrenzen. *mittel*
- [ ] Nicht zusammengeführte Zeilenumbrüche in Teil-B-Pfaden (B 4.4, B 12.2.3, B 13.4, B 18.13); langer verschmolzener Pfadeintrag in B 3.4.1; Notiz „ehemals: …“ als Pfadeintrag in B 10.3.1. *mittel*
- [ ] VersMedV-Daten werden auch bei `ICF_MCP_VMG=0` geladen (statischer Import). *klein*
- [ ] `scripts/k710_extract.py`: private pypdf-Schnittstellen ohne Endprüfung (erwartete Zeilenzahl 330), Spaltengrenze fest 214 pt, Ausgabe nicht alphabetisch sortiert. *klein*
- [ ] `versmedv_to_json.py`: `until`-Anker prüfen nur Existenz, nicht Richtigkeit (abgesichert über Tests); Zustand außerhalb von `__init__`; stille Umordnung in `ref_id` („B 3.1.a+2“) ohne Meldung. *klein*
- [ ] `vmg_get` gibt die Kennung normalisiert statt wie eingegeben zurück (bewusst, nur dokumentieren). *klein*
- [ ] Merkzeichen RF: genaue Vorschrift im Rundfunkbeitragsstaatsvertrag (Landesrecht) nicht amtlich bestätigt; Tool weist darauf hin. Bei amtlicher Quelle Fundstelle ergänzen. *klein*

## Fallprofil (`src/fall.mjs`, Version 1.7.0)

- [ ] Unterschiede nur in Groß-/Kleinschreibung oder Leerzeichen (`F20.0 G` / `f20.0 g`, `BI:4.1.3 = 2`, `3 / tag`) gelten in `fall_vergleichen` als Veränderung bzw. als widersprüchliche Diagnosesicherheit; normalisiert vergleichen. *klein*
- [ ] `fall_vergleichen`: `gdb`-Liste unterscheidet nicht nach Herkunft (letzter Wert gewinnt; unter `eintraege.veraendert` korrekt). *klein*
- [ ] Formprüfung: doppelte Ids in `ziele` und `verfahren` nicht gemeldet; Datumsmuster akzeptiert z. B. 2026-13-45; Pseudonym nur aus Leerzeichen erlaubt; Fehlermeldung zum Id-Format zeigt den Regex; Ids mit Großbuchstaben abgelehnt; `richtung`-Prüfung scheitert bei führendem Leerzeichen im Kode. *klein*
- [ ] `fall_pruefen`: `e310.0` bzw. `e310+0` („nicht vorhanden“) lösen Barriere-/Förderfaktor-Hinweise aus; `entspricht`-Zusammenhang auf einen Eintrag eines abgeschalteten Moduls meldet „kein gültiger Eintrag“ statt Modulhinweis; nicht-Text-`kode` wird doppelt gemeldet. *klein*

## Pflege-Gegenüberstellung und Prompts (`src/bi_gegenueberstellung.mjs`, `src/prompts.mjs`, Version 1.8.0)

- [ ] Doppelte Kennungen in einer Kodierung („4.1.3=3; 4.1.3=1“): der letzte Wert gewinnt ohne Hinweis. *klein*
- [ ] Kein Hinweis für Kriterien, die bei Säuglingen nicht bewertet werden (Module 1, 2, 6 und Modul 4 außer 4.4.0), und für Felder ohne Modul (z. B. `4.4.V2`: `modul` leer, Wirkung nur Nullen). *klein*
- [ ] Fehlermeldung bei Profil-Eingabe nennt nur eine Standard-Herkunft, wenn weder `interview` noch `selbstauskunft` vorkommt. *klein*
- [ ] Gleiche Werte in anderer Schreibweise (`7/Woche` gegen `1/Tag`) gelten als Unterschied (mit Wirkung 0). *klein*
- [ ] `bi_gegenueberstellen` nimmt `alter_monate` nicht als Text an (`bi_calculate` schon). *klein*

## Verfahren (`src/verfahren.mjs`, `src/prompts.mjs`, Version 1.9.0)

- [ ] Fallprofil: `verfahren.art` kennt keinen Überprüfungs-, Neufeststellungs- oder Höherstufungsantrag und keine Akteneinsicht; Schema-Erweiterung (Version 1 abwärtskompatibel) prüfen. *mittel*
- [ ] Normauszüge werden nicht automatisch gegen gesetze-im-internet.de geprüft; Prüfskript für die wöchentliche Prüfung (Abruf mit `curl -4`, Vergleich jedes Auszugs mit dem Normtext). *mittel*
