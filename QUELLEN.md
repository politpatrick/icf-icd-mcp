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

## ICD-10-GM Version 2026, Alphabetisches Verzeichnis und Datei Alpha-ID-SE

- Dateien: `source/icd10gm2026alpha_edvtxt_20250926.txt` (Alphabetisches Verzeichnis, EDV-Fassung TXT, OID 1.2.276.0.76.5.554)
  und `source/icd10gm2026_alphaidse_edvtxt_20250926.txt` (Datei Alpha-ID-SE, OID 1.2.276.0.76.5.556), jeweils Stand 26.09.2025
- Herausgegeben vom BfArM im Auftrag des Bundesministeriums für Gesundheit (BMG), das Alphabetische Verzeichnis in Kooperation
  mit dem Zentralinstitut für die kassenärztliche Versorgung in der Bundesrepublik Deutschland (Zi)
- Es gelten dieselben Downloadbedingungen und Quellenangaben wie für die ICD-10-GM (siehe oben).
- Die Orpha-Kennnummern (ORPHAcodes) in der Datei Alpha-ID-SE stammen aus der Datenbank für Seltene Erkrankungen Orphanet;
  Referenz für die Version 2026 ist das Orphanet Nomenclature Pack 07/2025.

`scripts/icd_alpha_to_json.py` übernimmt Kodes und Texte unverändert und verknüpft beide Dateien über die laufende Nummer
(Alphabet `109254` = Alpha-ID `I109254`). Nicht übernommen werden das Druckkennzeichen und die gestrichenen (ungültigen)
Alpha-IDs. Bei Unstimmigkeiten zwischen Systematischem und Alphabetischem Verzeichnis ist das Systematische Verzeichnis
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
