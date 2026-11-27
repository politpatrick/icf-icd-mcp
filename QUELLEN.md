# Quellenangaben

Dieses Repository enthält maschinenlesbare Fassungen zweier amtlicher Klassifikationen des
Bundesinstituts für Arzneimittel und Medizinprodukte (BfArM). Sie werden nach den
[Downloadbedingungen des BfArM](https://www.bfarm.de/DE/Kodiersysteme/Services/Downloads/_node.html)
(Stand 01.08.2025) weitergegeben: Die Inhalte bleiben unverändert (§ 62 UrhG), die Quellen werden angegeben
(§ 63 UrhG), und das Repository enthält keine kommerzielle Werbung.

Die Umwandlung von ClaML/XML in JSON ändert nur das Format. Kodes, Titel und Texte werden
unverändert übernommen. Verbindliche Referenzfassung ist jeweils das PDF des Systematischen
Verzeichnisses beim BfArM.

## ICD-10-GM Version 2026, Systematisches Verzeichnis

- Datei: `source/icd10gm2026syst_claml_20250912.xml` (Stand der Klassifikation: 12.09.2025, OID 1.2.276.0.76.5.554)
- Grundlage: die vollständige amtliche Fassung der *International Statistical Classification of Diseases and Related
  Health Problems, Tenth Revision* (WHO, Genf, Vol. 1, 1992) sowie die australische *ICD-10-AM, First Edition*
  (National Centre for Classification in Health, 1998)
- © zu ICD-10: Weltgesundheitsorganisation (WHO) 1992
- © zu ICD-10-AM: Commonwealth of Australia 1998
- Die Übersetzungsrechte für die deutschsprachige Ausgabe hat die WHO bzw. das Commonwealth of Australia an das BfArM
  vergeben, das für die Übersetzung allein verantwortlich ist.
- Herausgegeben vom BfArM im Auftrag des Bundesministeriums für Gesundheit (BMG)
- Die Erstellung erfolgt unter Verwendung der maschinenlesbaren Fassung des BfArM.

## ICD-10-GM Version 2026, Alphabetisches Verzeichnis und Datei Alpha-ID-SE Version 2027

- Dateien: `source/icd10gm2026alpha_edvtxt_20250926.txt` (Alphabetisches Verzeichnis, EDV-Fassung TXT, OID 1.2.276.0.76.5.554,
  Stand 26.09.2025) und `source/alphaidse2027_edvtxt_20260925.txt` (Datei Alpha-ID-SE Version 2027, OID 1.2.276.0.76.5.560,
  Stand 25.09.2026, auf der Basis des Alphabetischen Verzeichnisses zur ICD-10-GM 2026)
- Die ICD-10-GM 2026 gilt nach Planung des BfArM bis Ende 2028 (Vorschlagsverfahren im Dreijahresturnus); die Datei Alpha-ID-SE
  erscheint weiterhin jährlich mit aktualisierten Orpha-Kennnummern.
- Herausgegeben vom BfArM im Auftrag des Bundesministeriums für Gesundheit (BMG), das Alphabetische Verzeichnis in Kooperation
  mit dem Zentralinstitut für die kassenärztliche Versorgung in der Bundesrepublik Deutschland (Zi)
- Es gelten dieselben Downloadbedingungen und Quellenangaben wie für die ICD-10-GM (siehe oben).
- Die Orpha-Kennnummern (ORPHAcodes) in der Datei Alpha-ID-SE stammen aus der Datenbank für Seltene Erkrankungen Orphanet;
  Referenz für die Version 2027 ist das Orphanet Nomenclature Pack 07/2026.

`scripts/icd_alpha_to_json.py` übernimmt Kodes und Texte unverändert und verknüpft beide Dateien über die laufende Nummer
(Alphabet `109254` = Alpha-ID `I109254`). Texte und Kodes kommen aus dem Alphabetischen Verzeichnis, die Orpha-Kennnummern aus der
Datei Alpha-ID-SE. Gültige Einträge der Alpha-ID-SE, die das Alphabetische Verzeichnis 2026 noch nicht enthält (Version 2027: 267,
überwiegend seltene Erkrankungen), werden mit ihren Kodes und Texten unverändert ergänzt und in `icd_search` mit
„quelle: Alpha-ID-SE 2027“ gekennzeichnet. Nicht übernommen werden das Druckkennzeichen und die gestrichenen (ungültigen)
Alpha-IDs; Einträge des Alphabets, die die Alpha-ID-SE 2027 für ungültig erklärt (17), bleiben als Teil des amtlichen Alphabets 2026
erhalten, aber ohne Orpha-Kennnummer. Bei Unstimmigkeiten zwischen Systematischem und Alphabetischem Verzeichnis ist das Systematische Verzeichnis
maßgeblich; verbindliche Referenzfassung ist dessen PDF.

## ICF, Stand Oktober 2005

- Datei: `source/icf2005syst_claml_20120619.xml`
- Englische Originalausgabe: *International Classification of Functioning, Disability and Health* (WHO, 2001)
- © World Health Organization (WHO) 2001
- Die Übersetzungs-, Veröffentlichungs- und Verwertungsrechte für die deutschsprachige Ausgabe hat die WHO an das BfArM
  vergeben, das für die Übersetzung allein verantwortlich ist.
- ICF-Kodes, -Begriffe und -Texte © WHO, übersetzt und herausgegeben durch das BfArM
- Herausgegeben vom BfArM
- Die Erstellung erfolgt unter Verwendung der maschinenlesbaren Fassung des BfArM.

Für die ICF gilt außerdem: Nach den Vorgaben der WHO ist sie für die Nutzung in Deutschland bestimmt. Die
Beurteilungsmerkmale sind nach Anhang 2 der ICF anzuwenden, und ihre Skalen und Prozentbereiche dürfen nicht
verändert werden. Sie werden hier so ausgegeben, wie sie in der Klassifikation stehen.

Der genaue Wortlaut der vorgeschriebenen Quellenangaben steht im Anhang der Downloadbedingungen, die jedem
Download des BfArM beiliegen (`downloadbedingungen-2025.pdf`).

## Begutachtungs-Richtlinien (BRi) 2026 – Modul `bi` (abschaltbar)

- Datei: `source/bri_pflege_2026.pdf` mit dem Textauszug `source/bri_pflege_2026.txt`
- *Richtlinien zur pflegefachlichen Konkretisierung der Inhalte des Begutachtungsinstruments nach § 15 SGB XI sowie zum
  Verfahren der Feststellung der Pflegebedürftigkeit nach den §§ 18 bis 18c SGB XI gemäß § 53d Absatz 3 Satz 1 Nummer 1
  i. V. m. § 17 Absatz 1 SGB XI*, erlassen am 26.08.2026, genehmigt durch das Bundesministerium für Gesundheit am 28.09.2026,
  in Kraft seit 01.10.2026
- Herausgeber: Medizinischer Dienst Bund (KöR), Essen, www.md-bund.de
- Bewertungssystematik: Anlage 1 und 2 zu § 15 SGB XI

Die Texte werden aus dem PDF übernommen. Eine Änderung gibt es nur an einer Stelle: In der fetten Schrift des PDFs
fehlen in der Textebene die Bindestriche. Sie werden in `scripts/bi_to_json.py` (`KORREKTUREN`) nach dem gedruckten
Wortlaut ergänzt. Skalen, Formularfelder und Alterstabellen sind von Hand in `source/bi_struktur.json` übertragen, jeweils
mit Seitenangabe. Verbindlich ist das PDF der BRi.

**Rechtsstellung:** Die BRi sind Richtlinien nach § 17 Absatz 1 und § 53d Absatz 3 SGB XI, vom Medizinischen Dienst Bund
als Körperschaft des öffentlichen Rechts erlassen und vom Bundesministerium für Gesundheit genehmigt. Als amtliches Werk
nach § 5 UrhG genießen ihre Inhalte (Texte, Kriterien, Tabellen, Formulargutachten) keinen urheberrechtlichen Schutz.
Soweit § 5 Absatz 2 UrhG greift, gelten das Änderungsverbot und die Pflicht zur Quellenangabe (§§ 62, 63 UrhG): Die Texte
werden unverändert übernommen (bis auf die oben beschriebene Ergänzung fehlender Bindestriche nach dem gedruckten
Wortlaut), die Quelle ist angegeben.

Geschützt sein kann die Gestaltung der Veröffentlichung, etwa das Titelfoto (© Medizinischer Dienst) und Umschlag und
Satz (fountain studio). Deshalb wird nur der Textauszug weitergegeben, nicht das PDF. Es ist beim Medizinischen Dienst
Bund erhältlich (www.md-bund.de) und wird nur gebraucht, um bei einer neuen Fassung den Textauszug neu zu erzeugen
(`scripts/bri_extract.py`); dafür unter `source/bri_pflege_2026.pdf` ablegen.

### Zuordnung Begutachtungsinstrument ↔ ICF

`source/bi_icf_zuordnung.json` ist eine eigene, fachlich kuratierte Arbeitshilfe dieses Projekts (Stand 16.11.2026). Sie ist
keine amtliche Zuordnung: Weder das BfArM noch der Medizinische Dienst Bund haben eine Zuordnung zwischen Begutachtungsinstrument
und ICF veröffentlicht. Jede Kante ist begründet und verweist nur auf Kategorien der ICF-Fassung 2005.

## Versorgungsmedizinische Grundsätze (VersMedV) – Modul `vmg` (abschaltbar)

- Datei: `source/versmedv_BJNR241200008.xml` (`versmedv/xml.zip` von gesetze-im-internet.de, nur die Norm „Anlage zu § 2“)
- *Versorgungsmedizin-Verordnung (VersMedV)*, Anlage zu § 2: Versorgungsmedizinische Grundsätze, Stand: „Zuletzt geändert durch
  Art. 1 V v. 29.9.2025 I Nr. 228“, Build-Datum des XML 06.05.2026
- Herausgeber des Rechtsinformationsportals: Bundesministerium der Justiz in Zusammenarbeit mit der juris GmbH

**Rechtsstellung:** Die Verordnung ist ein amtliches Werk nach § 5 Absatz 1 UrhG und genießt keinen urheberrechtlichen Schutz.
Die Texte werden unverändert übernommen.

### Stichwortverzeichnis (K710)

- Datei: `source/k710_stichwortverzeichnis.txt` (Textauszug)
- Herausgeber: Bundesministerium für Arbeit und Soziales (BMAS)
- Titel: *Versorgungsmedizin-Verordnung – VersMedV – Versorgungsmedizinische Grundsätze*, Stand Januar 2026 (K710)
- Das Stichwortverzeichnis gehört nicht zur Verordnung, sondern ist eine redaktionelle Beigabe der Broschüre.

Die Broschüre ist als anderes amtliches Werk nach § 5 Absatz 2 UrhG einzuordnen: Es gelten das Änderungsverbot und die Pflicht
zur Quellenangabe (§§ 62, 63 UrhG). Begriffe und Fundstellen werden unverändert übernommen. Nur der Textauszug wird weitergegeben,
nicht das PDF (Gestaltung und Satz können geschützt sein); es wird nur gebraucht, um bei einer neuen Broschüre den Auszug neu
zu erzeugen (`scripts/k710_extract.py`, mit `pypdf`). Die Seitenzahlen der Broschüre werden nicht übernommen.

### Kuratierte Teile (nicht amtlich)

- **Pfade in Teil B:** `scripts/versmedv_to_json.py` enthält Überschreibungen (`OVERRIDES`) für die Pfade (Überschriften) einzelner GdS-Zeilen.
  Sie verwenden nur Text, der im Quelltext der Verordnung wörtlich steht; bei Abweichung bricht der Build ab.
- **Funktionssysteme für `vmg_gesamt_gdb`:** Jedes Kapitel B 2 bis B 17 ist ein Funktionssystem. Die Aufteilung von B 18 in
  Rumpf, Arme und Beine folgt der verwaltungsüblichen Gliederung und ist nicht amtlich.
- **ICD-Ableitung (`vmg_search` mit `icd`):** Die Verbindung von ICD-Kodes zu Stichwörtern der VersMedV ist eine Suchhilfe dieses
  Projekts (Teilstring-Vergleich von ICD-Titeln und Alphabet-Begriffen mit dem Stichwortverzeichnis). Es gibt keine amtliche
  Zuordnung zwischen ICD-10-GM und VersMedV.
- **Normhinweise zu aG, RF und TBl:** aG: § 229 Absatz 3 SGB IX; TBl: § 3 Absatz 1 Nummer 8 Schwerbehindertenausweisverordnung
  (SchwbAwV); RF: § 4 Absatz 2 Nummer 1 bis 3 Rundfunkbeitragsstaatsvertrag, geprüft am 27.11.2026 an der amtlichen
  Landesrechtssammlung Brandenburg (BRAVORS, https://bravors.brandenburg.de/vertraege/rbstv/4).

## Gesetzesauszüge für `verfahren_info`

- Quelle: Rechtsinformationsportal gesetze-im-internet.de (Bundesministerium der Justiz in Zusammenarbeit mit der juris GmbH),
  am 22.11.2026 abgerufen und geprüft: § 16 SGB I; § 14 SGB IX; §§ 25, 37, 44, 48 SGB X; §§ 66, 67, 78, 84, 88 SGG;
  §§ 70, 75 VwGO; für die Hinweise außerdem § 32 SGB IX, §§ 7a, 7c SGB XI, § 40 SGB II, § 116a SGB XII, § 33 SGB XI, § 83 SGB X und §§ 58, 60 VwGO.
- Gesetze sind amtliche Werke nach § 5 Absatz 1 UrhG. Die Auszüge in `src/verfahren.mjs` sind wörtlich; Auslassungen sind mit „[…]“
  gekennzeichnet. Die Erklärungen in einfacher Sprache sind kuratiert (nicht amtlich) und keine Rechtsberatung.
- Bei Gesetzesänderungen die Auszüge mit dem aktuellen Wortlaut abgleichen (wöchentliche Prüfung).

## Normen für `leistungshinweise`

- Quelle: Rechtsinformationsportal gesetze-im-internet.de (Bundesministerium der Justiz in Zusammenarbeit mit der juris GmbH),
  am 22.11.2026 abgerufen und geprüft: § 2, § 29, § 32, § 103, § 151, § 152, § 168, § 185, § 192, § 208, § 228 SGB IX; §§ 7a, 7c, 13, 36, 37, 38, 39, 40, 41, 42, 42a, 43a, 44, 45b SGB XI;
  §§ 30, 61, 72 SGB XII; § 37 SGB VI; § 35a, § 10 und § 41 SGB VIII; §§ 33, 33b EStG; § 3a KraftStG.
- Der Katalog in `src/leistungen.mjs` ist kuratiert (nicht amtlich): Die Auswahl, die Erklärungen, die Rangangaben und die nächsten Schritte stammen nicht aus den Gesetzen.
  Gesetzestexte werden nicht wiedergegeben, die Normen sind verlinkt. Landesrecht (Blindengeld, Gehörlosengeld, Rundfunkbeitrag, Parkerleichterungen) ist nur als Hinweis ohne Norm enthalten.
- Bei Gesetzesänderungen den Katalog mit dem aktuellen Wortlaut abgleichen. Keine Beträge, keine Rechtsberatung.
