// Mögliche Leistungen und Nachteilsausgleiche zu GdB, Merkzeichen und Pflegegrad für antragsberechtigte Personen.
// Katalog kuratiert (nicht amtlich); Normen an gesetze-im-internet.de geprüft (22.11.2026).
// Keine Beträge, keine Anspruchs- oder Zuständigkeitsprüfung, keine Einkommens- oder Vermögensprüfung.

import { LookupError } from "./text.mjs";

const GII = "https://www.gesetze-im-internet.de";
const norm = (zitat, pfad) => ({ zitat, url: `${GII}/${pfad}.html` });

const LANDESRECHT = "Landesrecht, je Land verschieden";
const PFLEGEKASSE_VOR = "Leistung der Pflegeversicherung; sie geht der Hilfe zur Pflege nach dem SGB XII vor (§ 13 Abs. 3 SGB XI).";
const STEUER = "Steuerlicher Nachteilsausgleich; steht neben Sozialleistungen.";
const SCHWERBEHINDERT = "Nachteilsausgleich für schwerbehinderte Menschen; steht neben anderen Leistungen.";

/** Kanonische Merkzeichen; Schreibweise der Eingabe egal ("BI" wie im KraftStG gilt als Bl). */
export const MERKZEICHEN = ["G", "aG", "B", "H", "Bl", "Gl", "RF", "TBl"];
const MZ_ALIAS = Object.fromEntries([...MERKZEICHEN.map((m) => [m.toLowerCase(), m]), ["bi", "Bl"], ["tbi", "TBl"]]);

/** Katalog in Ausgabereihenfolge. `wenn`: Alternativen (ODER), jede Alternative eine UND-Gruppe. */
export const KATALOG = [
  {
    id: "feststellung_gdb",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 20 }],
    leistung: "Feststellung von GdB und Merkzeichen; bei wesentlicher Verschlechterung Neufeststellung",
    normen: [norm("§ 152 SGB IX", "sgb_9_2018/__152")],
    stelle: "Versorgungsamt bzw. die nach Landesrecht zuständige Stelle",
    rang: "Grundlage für viele Nachteilsausgleiche; Merkzeichen werden im selben Verfahren festgestellt (§ 152 Abs. 4 SGB IX).",
    naechster_schritt: "Bescheid prüfen: Sind alle Beeinträchtigungen und möglichen Merkzeichen berücksichtigt? Hat sich etwas wesentlich verschlechtert, kann ein Neufeststellungsantrag in Betracht kommen.",
    voraussetzung: "Feststellung auf Antrag; eine Neufeststellung kann auch zu einem niedrigeren Ergebnis führen.",
  },
  {
    id: "pauschbetrag",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 20 }],
    leistung: "Behinderten-Pauschbetrag in der Einkommensteuer",
    normen: [norm("§ 33b EStG", "estg/__33b")],
    stelle: "Finanzamt (Steuererklärung oder Lohnsteuerermäßigung)",
    rang: STEUER,
    naechster_schritt: "Feststellungsbescheid bzw. Ausweis bereithalten und den Pauschbetrag in der Steuererklärung angeben.",
    voraussetzung: "Die Höhe richtet sich nach dem dauernden GdB; wirkt nur, soweit Einkommensteuer anfällt.",
  },
  {
    id: "gleichstellung",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 30, gdb_bis: 40 }],
    leistung: "Gleichstellung mit schwerbehinderten Menschen (Schutz im Arbeitsleben)",
    normen: [norm("§ 2 SGB IX", "sgb_9_2018/__2"), norm("§ 151 SGB IX", "sgb_9_2018/__151")],
    stelle: "Agentur für Arbeit",
    rang: "Arbeitsrechtlicher Schutz; Gleichgestellte erhalten die besonderen Regelungen für schwerbehinderte Menschen außer Zusatzurlaub und unentgeltlicher Beförderung (§ 151 Abs. 3 SGB IX).",
    naechster_schritt: "Antrag auf Gleichstellung bei der Agentur für Arbeit stellen; sie wirkt ab Eingang des Antrags.",
    voraussetzung: "GdB von weniger als 50, aber wenigstens 30, und ohne Gleichstellung kann ein geeigneter Arbeitsplatz nicht erlangt oder nicht behalten werden (§ 2 Abs. 3 SGB IX).",
  },
  {
    id: "ausweis",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 50 }],
    leistung: "Schwerbehindertenausweis als Nachweis für Nachteilsausgleiche",
    normen: [norm("§ 152 SGB IX", "sgb_9_2018/__152")],
    stelle: "Versorgungsamt bzw. die nach Landesrecht zuständige Stelle",
    rang: "Nachweis; die Merkzeichen im Ausweis öffnen weitere Nachteilsausgleiche.",
    naechster_schritt: "Ausweis beantragen, falls noch nicht vorhanden; auf Gültigkeitsdauer und eingetragene Merkzeichen achten.",
    voraussetzung: "Ausstellung auf Antrag auf Grund der Feststellung (§ 152 Abs. 5 SGB IX).",
  },
  {
    id: "zusatzurlaub",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 50 }],
    leistung: "Zusatzurlaub für schwerbehinderte Beschäftigte",
    normen: [norm("§ 208 SGB IX", "sgb_9_2018/__208")],
    stelle: "Arbeitgeber",
    rang: "Arbeitsrechtlicher Nachteilsausgleich; gilt nicht für Gleichgestellte (§ 151 Abs. 3 SGB IX).",
    naechster_schritt: "Den Arbeitgeber über die Schwerbehinderung informieren und den Zusatzurlaub geltend machen.",
    voraussetzung: "Beschäftigungsverhältnis; der Umfang richtet sich nach der Verteilung der Arbeitstage.",
  },
  {
    id: "kuendigungsschutz",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 50 }, { gdb_ab: 30, gdb_bis: 40 }],
    leistung: "Besonderer Kündigungsschutz: Kündigung durch den Arbeitgeber nur mit vorheriger Zustimmung des Integrationsamts",
    normen: [norm("§ 168 SGB IX", "sgb_9_2018/__168")],
    stelle: "Integrationsamt; im Betrieb auch die Schwerbehindertenvertretung",
    rang: SCHWERBEHINDERT,
    naechster_schritt: "Bei drohender Kündigung frühzeitig Integrationsamt, Schwerbehindertenvertretung oder Beratung einbeziehen.",
    voraussetzung: "Gilt auch für Gleichgestellte (§ 151 Abs. 3 SGB IX); bei GdB 30 oder 40 erst nach erfolgter Gleichstellung; weitere Voraussetzungen und Ausnahmen prüft das Integrationsamt.",
  },
  {
    id: "begleitende_hilfe",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 50 }, { gdb_ab: 30, gdb_bis: 40 }],
    leistung: "Begleitende Hilfe im Arbeitsleben (z. B. Beratung, Hilfen zur Arbeitsplatzgestaltung)",
    normen: [norm("§ 185 SGB IX", "sgb_9_2018/__185")],
    stelle: "Integrationsamt, Integrationsfachdienst",
    rang: SCHWERBEHINDERT,
    naechster_schritt: "Beim Integrationsamt oder Integrationsfachdienst nach Beratung und Hilfen für den Arbeitsplatz fragen.",
    voraussetzung: "Schwerbehinderung oder Gleichstellung (§ 151 Abs. 1 SGB IX); bei GdB 30 oder 40 erst nach erfolgter Gleichstellung.",
  },
  {
    id: "altersrente",
    gruppe: "gdb",
    wenn: [{ gdb_ab: 50 }],
    leistung: "Altersrente für schwerbehinderte Menschen",
    normen: [norm("§ 37 SGB VI", "sgb_6/__37")],
    stelle: "Deutsche Rentenversicherung",
    rang: "Rentenversicherungsleistung; eine frühere Inanspruchnahme kann mit Abschlägen verbunden sein.",
    naechster_schritt: "Bei der Rentenversicherung eine Rentenauskunft bzw. Beratung zu Beginn und Wartezeit erfragen.",
    voraussetzung: "Anerkennung als schwerbehinderter Mensch bei Rentenbeginn, Erfüllung der Wartezeit und Erreichen der Altersgrenze.",
    alter_hinweis: "Kommt erst mit Erreichen der Altersgrenze in Betracht; Altersgrenze und Wartezeit prüft die Rentenversicherung.",
  },
  {
    id: "befoerderung",
    gruppe: "merkzeichen",
    wenn: [{ merkzeichen: ["G", "H", "Gl", "Bl", "TBl"] }],
    leistung: "Unentgeltliche Beförderung im öffentlichen Nahverkehr mit Wertmarke",
    normen: [norm("§ 228 SGB IX", "sgb_9_2018/__228")],
    stelle: "Versorgungsamt bzw. die nach Landesrecht zuständige Stelle (Wertmarke)",
    rang: "Nachteilsausgleich; schließt die Kraftfahrzeugsteuer-Ermäßigung für denselben Zeitraum aus (§ 3a Abs. 2 KraftStG).",
    naechster_schritt: "Wertmarke beantragen; ob sie eigenbeteiligungsfrei ausgegeben wird (z. B. bei Blindheit, Hilflosigkeit oder bestimmten Sozialleistungen), sagt die Stelle.",
    voraussetzung: "Ausweis mit orangefarbenem Flächenaufdruck; § 228 Abs. 1 SGB IX nennt erhebliche Beeinträchtigung der Bewegungsfähigkeit im Straßenverkehr (G), Hilflosigkeit (H) oder Gehörlosigkeit (Gl). Blinde Menschen (Bl, TBl) sind über § 228 Abs. 4 Nr. 1 SGB IX erfasst (Wertmarke ohne Eigenbeteiligung).",
  },
  {
    id: "begleitperson",
    gruppe: "merkzeichen",
    wenn: [{ merkzeichen: ["B"] }],
    leistung: "Unentgeltliche Beförderung einer Begleitperson im Nah- und Fernverkehr",
    normen: [norm("§ 228 SGB IX", "sgb_9_2018/__228")],
    stelle: "Verkehrsunternehmen; Nachweis durch das Merkzeichen B im Ausweis",
    rang: "Nachteilsausgleich; steht neben anderen Leistungen.",
    naechster_schritt: "Ausweis mit eingetragenem Merkzeichen B bei der Fahrt mitführen; Fragen zu einzelnen Verbindungen klärt das Verkehrsunternehmen.",
    voraussetzung: "Berechtigung zur Mitnahme einer Begleitperson ist im Ausweis eingetragen (§ 228 Abs. 6 SGB IX).",
  },
  {
    id: "kfz_befreiung",
    gruppe: "merkzeichen",
    wenn: [{ merkzeichen: ["H", "Bl", "aG"] }],
    leistung: "Befreiung von der Kraftfahrzeugsteuer",
    normen: [norm("§ 3a KraftStG", "kraftstg/__3a")],
    stelle: "Hauptzollamt",
    rang: STEUER,
    naechster_schritt: "Schriftlichen Antrag beim Hauptzollamt stellen; Ausweis und Fahrzeugdaten bereithalten.",
    voraussetzung: "Fahrzeug ist für die schwerbehinderte Person zugelassen; nur für ein Fahrzeug, Nutzungsbeschränkungen beachten (§ 3a Abs. 1 und 3 KraftStG).",
  },
  {
    id: "kfz_ermaessigung",
    gruppe: "merkzeichen",
    wenn: [{ merkzeichen: ["G", "Gl"] }],
    leistung: "Ermäßigung der Kraftfahrzeugsteuer",
    normen: [norm("§ 3a KraftStG", "kraftstg/__3a")],
    stelle: "Hauptzollamt",
    rang: "Steuerlicher Nachteilsausgleich; nicht solange die unentgeltliche Beförderung in Anspruch genommen wird (§ 3a Abs. 2 KraftStG).",
    naechster_schritt: "Abwägen, ob Wertmarke oder Steuerermäßigung im Alltag mehr hilft; dann den schriftlichen Antrag beim Hauptzollamt stellen.",
    voraussetzung: "Ausweis mit orangefarbenem Flächenaufdruck und Voraussetzungen des § 228 Abs. 1 Satz 1 SGB IX; Fahrzeug für die Person zugelassen.",
  },
  {
    id: "fahrtkosten",
    gruppe: "merkzeichen",
    wenn: [{ gdb_ab: 80 }, { gdb_ab: 70, merkzeichen: ["G"] }, { merkzeichen: ["aG", "Bl", "TBl", "H"] }],
    leistung: "Behinderungsbedingte Fahrtkostenpauschale in der Einkommensteuer",
    normen: [norm("§ 33 EStG", "estg/__33")],
    stelle: "Finanzamt (Steuererklärung)",
    rang: "Steuerlicher Nachteilsausgleich; daneben werden keine weiteren behinderungsbedingten Fahrtkosten berücksichtigt (§ 33 Abs. 2a EStG).",
    naechster_schritt: "Die Pauschale in der Steuererklärung angeben; Feststellungsbescheid bzw. Ausweis bereithalten.",
    voraussetzung: "GdB ab 80, oder GdB ab 70 mit Merkzeichen G, oder Merkzeichen aG, Bl, TBl oder H (§ 33 Abs. 2a EStG); die Höhe unterscheidet sich je Gruppe.",
  },
  {
    id: "pauschbetrag_erhoeht",
    gruppe: "merkzeichen",
    wenn: [{ merkzeichen: ["H", "Bl", "TBl"] }],
    leistung: "Erhöhter Behinderten-Pauschbetrag für hilflose, blinde und taubblinde Menschen",
    normen: [norm("§ 33b EStG", "estg/__33b")],
    stelle: "Finanzamt (Steuererklärung oder Lohnsteuerermäßigung)",
    rang: "Steuerlicher Nachteilsausgleich; tritt an die Stelle des Pauschbetrags nach dem GdB (§ 33b Abs. 3 Satz 3 EStG).",
    naechster_schritt: "Den erhöhten Pauschbetrag in der Steuererklärung angeben; Ausweis bzw. Bescheid mit Merkzeichen bereithalten.",
    voraussetzung: "Hilflosigkeit (Merkzeichen H), Blindheit (Bl) oder Taubblindheit (TBl).",
  },
  {
    id: "mehrbedarf_g",
    gruppe: "merkzeichen",
    wenn: [{ merkzeichen: ["G"] }],
    leistung: "Mehrbedarf bei Merkzeichen G in der Grundsicherung im Alter und bei Erwerbsminderung bzw. Sozialhilfe",
    normen: [norm("§ 30 SGB XII", "sgb_12/__30")],
    stelle: "Sozialamt (Träger der Sozialhilfe)",
    rang: "Nachrangig: Teil der Grundsicherung bzw. Sozialhilfe; deren Voraussetzungen prüft das Sozialamt.",
    naechster_schritt: "Bei Bezug von Grundsicherung oder Sozialhilfe den Bescheid mit Merkzeichen G beim Sozialamt vorlegen.",
    voraussetzung: "Nachweis des Merkzeichens G durch Bescheid oder Ausweis und Erreichen der Altersgrenze oder volle Erwerbsminderung (§ 30 Abs. 1 SGB XII).",
  },
  {
    id: "pflegeberatung",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 1 }],
    leistung: "Individuelle Pflegeberatung",
    normen: [norm("§ 7a SGB XI", "sgb_11/__7a")],
    stelle: "Pflegekasse; vielerorts auch Pflegestützpunkt",
    rang: "Beratungsleistung der Pflegeversicherung; hilft bei der Auswahl auch anderer Sozialleistungen.",
    naechster_schritt: "Bei der Pflegekasse eine Pflegeberatung anfragen, auch zu Hause.",
    voraussetzung: "Bezug oder Beantragung von Leistungen der Pflegeversicherung.",
  },
  {
    id: "entlastungsbetrag",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 1 }],
    leistung: "Entlastungsbetrag für Angebote zur Unterstützung im Alltag",
    normen: [norm("§ 45b SGB XI", "sgb_11/__45b")],
    stelle: "Pflegekasse",
    rang: PFLEGEKASSE_VOR,
    naechster_schritt: "Bei der Pflegekasse nach anerkannten Angeboten fragen und Rechnungen zur Erstattung einreichen.",
    voraussetzung: "Häusliche Pflege; zweckgebunden für qualitätsgesicherte Entlastungsangebote.",
  },
  {
    id: "pflegehilfsmittel",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 1 }],
    leistung: "Pflegehilfsmittel und Zuschüsse für wohnumfeldverbessernde Maßnahmen",
    normen: [norm("§ 40 SGB XI", "sgb_11/__40")],
    stelle: "Pflegekasse",
    rang: "Nachrangig gegenüber Hilfsmitteln der Krankenversicherung und anderer Träger (§ 40 Abs. 1 SGB XI).",
    naechster_schritt: "Bei der Pflegekasse Pflegehilfsmittel bzw. einen Zuschuss für Umbauten möglichst vor Beginn beantragen.",
    voraussetzung: "Die Hilfsmittel erleichtern die Pflege, lindern Beschwerden oder ermöglichen eine selbständigere Lebensführung.",
  },
  {
    id: "pflegegeld",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 2 }],
    leistung: "Pflegegeld für selbst beschaffte Pflegehilfen",
    normen: [norm("§ 37 SGB XI", "sgb_11/__37")],
    stelle: "Pflegekasse",
    rang: PFLEGEKASSE_VOR,
    naechster_schritt: "Pflegegeld bei der Pflegekasse beantragen; regelmäßige Beratungsbesuche nach § 37 Abs. 3 SGB XI einplanen.",
    voraussetzung: "Die Pflege zu Hause wird selbst sichergestellt, z. B. durch Angehörige; bei Bezug sind Beratungsbesuche abzurufen (§ 37 Abs. 3 SGB XI).",
  },
  {
    id: "pflegesachleistung",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 2 }],
    leistung: "Pflegesachleistung durch einen Pflegedienst, auch kombiniert mit Pflegegeld",
    normen: [norm("§ 36 SGB XI", "sgb_11/__36"), norm("§ 38 SGB XI", "sgb_11/__38")],
    stelle: "Pflegekasse",
    rang: PFLEGEKASSE_VOR,
    naechster_schritt: "Einen zugelassenen Pflegedienst suchen und die Sachleistung bzw. Kombinationsleistung bei der Pflegekasse beantragen.",
    voraussetzung: "Häusliche Pflege durch zugelassene Pflegedienste; an die gewählte Aufteilung bei der Kombinationsleistung ist man eine Zeit lang gebunden (§ 38 SGB XI).",
  },
  {
    id: "tagespflege",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 2 }],
    leistung: "Tages- und Nachtpflege",
    normen: [norm("§ 41 SGB XI", "sgb_11/__41")],
    stelle: "Pflegekasse",
    rang: PFLEGEKASSE_VOR,
    naechster_schritt: "Einrichtungen in der Nähe ansehen und die teilstationäre Pflege bei der Pflegekasse beantragen.",
    voraussetzung: "Häusliche Pflege ist nicht in ausreichendem Umfang sichergestellt oder soll ergänzt bzw. gestärkt werden.",
  },
  {
    id: "jahresbetrag",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 2 }],
    leistung: "Gemeinsamer Jahresbetrag für Verhinderungspflege und Kurzzeitpflege",
    normen: [norm("§ 42a SGB XI", "sgb_11/__42a"), norm("§ 39 SGB XI", "sgb_11/__39"), norm("§ 42 SGB XI", "sgb_11/__42")],
    stelle: "Pflegekasse",
    rang: PFLEGEKASSE_VOR,
    naechster_schritt: "Bei Urlaub, Krankheit der Pflegeperson oder in Krisen die Ersatz- bzw. Kurzzeitpflege planen und die Erstattung bei der Pflegekasse beantragen.",
    voraussetzung: "Pflegeperson ist verhindert (Verhinderungspflege) oder häusliche Pflege ist vorübergehend nicht ausreichend möglich (Kurzzeitpflege).",
  },
  {
    id: "pflegeperson",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 2 }],
    leistung: "Soziale Sicherung der Pflegeperson (Rentenversicherungsbeiträge, Unfallversicherung)",
    normen: [norm("§ 44 SGB XI", "sgb_11/__44")],
    stelle: "Pflegekasse",
    rang: "Leistung für die pflegende Person; steht neben den Leistungen für die pflegebedürftige Person.",
    naechster_schritt: "Die Pflegeperson im Antrag bzw. bei der Pflegekasse angeben und den Pflegeumfang beschreiben.",
    voraussetzung: "Nicht erwerbsmäßige Pflege in einem Mindestumfang je Woche; die Pflegeperson arbeitet daneben nur begrenzt (§ 44 Abs. 1 SGB XI).",
  },
  {
    id: "pflege_pauschbetrag",
    gruppe: "pflege",
    wenn: [{ pflegegrad_ab: 2 }, { merkzeichen: ["H"] }],
    leistung: "Pflege-Pauschbetrag in der Einkommensteuer der pflegenden Person",
    normen: [norm("§ 33b EStG", "estg/__33b")],
    stelle: "Finanzamt der pflegenden Person",
    rang: "Steuerlicher Nachteilsausgleich für die pflegende Person.",
    naechster_schritt: "Die pflegende Person gibt den Pflege-Pauschbetrag in ihrer Steuererklärung an.",
    voraussetzung: "Persönliche, unentgeltliche Pflege in der eigenen Wohnung oder der Wohnung der pflegebedürftigen Person (§ 33b Abs. 6 EStG); die gepflegte Person hat mindestens Pflegegrad 2 oder ist hilflos (Merkzeichen H, § 33b Abs. 6 Satz 4 EStG).",
  },
  {
    id: "besondere_wohnform",
    gruppe: "schnittstelle",
    wenn: [{ pflegegrad_ab: 2 }],
    leistung: "Pflege in besonderen Wohnformen der Eingliederungshilfe",
    normen: [norm("§ 103 SGB IX", "sgb_9_2018/__103"), norm("§ 43a SGB XI", "sgb_11/__43a")],
    stelle: "Träger der Eingliederungshilfe und Pflegekasse",
    rang: "Die Pflegeleistungen sind in der Einrichtung Teil der Eingliederungshilfe (§ 103 SGB IX); die Pflegekasse beteiligt sich pauschal (§ 43a SGB XI).",
    naechster_schritt: "Bei Leben in einer besonderen Wohnform bei Einrichtung, Träger der Eingliederungshilfe und Pflegekasse nachfragen, wie die Pflege abgedeckt ist.",
    voraussetzung: "Leben in einer Einrichtung oder Räumlichkeit im Sinne des § 43a SGB XI.",
  },
  {
    id: "hilfe_zur_pflege",
    gruppe: "schnittstelle",
    wenn: [{ pflegegrad_ab: 1 }],
    leistung: "Hilfe zur Pflege, wenn die Leistungen der Pflegeversicherung nicht ausreichen",
    normen: [norm("§ 61 SGB XII", "sgb_12/__61"), norm("§ 13 SGB XI", "sgb_11/__13")],
    stelle: "Sozialamt (Träger der Sozialhilfe)",
    rang: "Nachrangig gegenüber der Pflegeversicherung (§ 13 Abs. 3 SGB XI); Einkommen und Vermögen prüft das Sozialamt.",
    naechster_schritt: "Reichen die Leistungen der Pflegekasse nicht, frühzeitig beim Sozialamt einen Antrag stellen bzw. sich beraten lassen.",
    voraussetzung: "Pflegebedürftigkeit; die Mittel können nicht selbst aufgebracht werden (§ 61 SGB XII).",
  },
  {
    id: "persoenliches_budget",
    gruppe: "schnittstelle",
    wenn: [{ gdb_ab: 20 }, { pflegegrad_ab: 1 }],
    leistung: "Persönliches Budget: Leistungen zur Teilhabe als Geldleistung in eigener Verantwortung, auch trägerübergreifend",
    normen: [norm("§ 29 SGB IX", "sgb_9_2018/__29")],
    stelle: "Ein beteiligter Rehabilitationsträger, die Pflegekasse oder das Integrationsamt; das Verfahren führt der leistende Rehabilitationsträger (§ 29 Abs. 3 SGB IX)",
    rang: "Leistungsform, keine eigene Leistung: es ändert sich, wie Leistungen ausgeführt werden, nicht ob sie zustehen.",
    naechster_schritt: "Überlegen, welche Unterstützung selbst organisiert werden soll, und das Persönliche Budget beim Antrag ausdrücklich nennen.",
    voraussetzung: "Ein Anspruch auf budgetfähige Leistungen zur Teilhabe oder Pflege; Zielvereinbarung mit dem Träger.",
  },
  {
    id: "kinder_35a",
    gruppe: "schnittstelle",
    wenn: [{ kind: true }],
    leistung: "Eingliederungshilfe für Kinder und Jugendliche mit (drohender) seelischer Behinderung",
    normen: [norm("§ 35a SGB VIII", "sgb_8/__35a"), norm("§ 10 SGB VIII", "sgb_8/__10")],
    stelle: "Jugendamt",
    rang: "Bei seelischer Behinderung geht die Jugendhilfe der Eingliederungshilfe nach dem SGB IX vor; bei körperlicher oder geistiger Behinderung ist es umgekehrt (§ 10 Abs. 4 SGB VIII).",
    naechster_schritt: "Beim Jugendamt beraten lassen bzw. einen Antrag stellen; bei körperlicher oder geistiger Behinderung ist in der Regel der Träger der Eingliederungshilfe anzusprechen.",
    voraussetzung: "Die seelische Gesundheit weicht mit hoher Wahrscheinlichkeit länger als sechs Monate vom alterstypischen Zustand ab und die Teilhabe ist dadurch beeinträchtigt oder bedroht (§ 35a Abs. 1 SGB VIII).",
    alter_hinweis: "Für Kinder und Jugendliche; für junge Volljährige kann Hilfe nach § 41 SGB VIII in Betracht kommen.",
  },
  {
    id: "blindengeld",
    gruppe: "landesrecht",
    wenn: [{ merkzeichen: ["Bl", "TBl"] }],
    leistung: "Blindengeld",
    normen: [],
    stelle: `Nach ${LANDESRECHT} (z. B. Versorgungsamt, Landschaftsverband oder Kommune)`,
    rang: `${LANDESRECHT}; Blindenhilfe nach dem SGB XII ist demgegenüber nachrangig.`,
    naechster_schritt: "Bei der im Land zuständigen Stelle nach Blindengeld fragen.",
    voraussetzung: "Blindheit nach den Regeln des Landes; reicht das Landesblindengeld nicht, kann zusätzlich die nachrangige Blindenhilfe nach § 72 SGB XII (Bundesrecht) in Betracht kommen.",
  },
  {
    id: "gehoerlosengeld",
    gruppe: "landesrecht",
    wenn: [{ merkzeichen: ["Gl", "TBl"] }],
    leistung: "Gehörlosengeld (nicht in allen Ländern)",
    normen: [],
    stelle: `Nach ${LANDESRECHT} (z. B. Versorgungsamt oder Kommune)`,
    rang: LANDESRECHT,
    naechster_schritt: "Bei der im Land zuständigen Stelle oder einer Beratung fragen, ob es im eigenen Land Gehörlosengeld gibt.",
    voraussetzung: "Gehörlosigkeit nach den Regeln des Landes; gibt es nur in einigen Ländern.",
  },
  {
    id: "rundfunkbeitrag",
    gruppe: "landesrecht",
    wenn: [{ merkzeichen: ["RF", "TBl", "Bl"] }],
    leistung: "Ermäßigung oder Befreiung beim Rundfunkbeitrag",
    normen: [],
    stelle: "Beitragsservice von ARD, ZDF und Deutschlandradio",
    rang: `${LANDESRECHT} (Rundfunkbeitragsstaatsvertrag der Länder).`,
    naechster_schritt: "Antrag beim Beitragsservice mit Nachweis (Ausweis bzw. Bescheid) stellen.",
    voraussetzung: "Landesrecht: Merkzeichen RF oder Blindheit bzw. Taubblindheit; ob Ermäßigung oder Befreiung, richtet sich nach dem Staatsvertrag.",
  },
  {
    id: "parkerleichterung",
    gruppe: "landesrecht",
    wenn: [{ merkzeichen: ["aG", "Bl", "G"] }],
    leistung: "Parkerleichterungen (z. B. Behindertenparkplätze, blauer bzw. orangefarbener Parkausweis)",
    normen: [],
    stelle: "Straßenverkehrsbehörde der Kommune",
    rang: "Parkerleichterungen sind Ausnahmegenehmigungen nach dem Straßenverkehrsrecht; welche Ausnahmen über aG und Bl hinaus gelten, regeln die Länder unterschiedlich.",
    naechster_schritt: "Bei der Straßenverkehrsbehörde einen Parkausweis beantragen und nach den Regeln im eigenen Land fragen.",
    voraussetzung: "Ausnahmegenehmigung der Straßenverkehrsbehörde; weitere Regeln nach Landesrecht.",
  },
];

const HERKUNFT =
  "Katalog kuratiert (nicht amtlich), Auswahl der wichtigsten bundesrechtlichen Leistungen und Nachteilsausgleiche mit Landesrecht-Hinweisen; Normen geprüft an gesetze-im-internet.de (Stand der Prüfung 22.11.2026).";

const HINWEIS =
  "Mögliche Leistungen, die bei diesen Angaben in Betracht kommen können – keine Anspruchsprüfung und keine Rechtsberatung. Ob ein Anspruch besteht, prüft die Stelle, bei der der Antrag gestellt wird; welche Stelle im Einzelfall zuständig ist, klärt eine Beratung. Beträge sind bewusst nicht genannt, weil sie sich regelmäßig ändern.";

const HINWEIS_MERKZEICHEN =
  "Merkzeichen werden im Feststellungsverfahren nach § 152 SGB IX festgestellt; viele Nachteilsausgleiche setzen zusätzlich eine festgestellte Schwerbehinderung (GdB ab 50) und einen Ausweis voraus.";

const BERATUNG = [
  "Ergänzende unabhängige Teilhabeberatung (EUTB, § 32 SGB IX) – kostenlos, unabhängig von Leistungsträgern",
  "Pflegeberatung nach § 7a SGB XI über die Pflegekasse",
  "Pflegestützpunkt (§ 7c SGB XI), soweit im Land eingerichtet",
  "Sozialverbände (z. B. VdK, SoVD) und Behindertenverbände",
  "Integrationsamt und Integrationsfachdienst (§ 192 SGB IX) bei Fragen zum Arbeitsleben",
];

const leer = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

function ganzzahl(name, v, min, max) {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d{1,4}\s*$/.test(v) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new LookupError(`${name} muss eine ganze Zahl von ${min} bis ${max} sein, erhalten: ${JSON.stringify(v)}.`);
  return n;
}

function merkzeichenLesen(v) {
  if (!Array.isArray(v)) throw new LookupError(`merkzeichen muss eine Liste sein, z. B. ["G", "B"]; erhalten: ${JSON.stringify(v)}.`);
  const aus = [];
  for (const m of v) {
    const k = typeof m === "string" ? MZ_ALIAS[m.trim().toLowerCase()] : undefined;
    if (!k) throw new LookupError(`Unbekanntes Merkzeichen ${JSON.stringify(m)}. Bekannt: ${MERKZEICHEN.join(", ")}.`);
    if (!aus.includes(k)) aus.push(k);
  }
  return aus;
}

function eingabenLesen(args = {}) {
  const e = {};
  if (!leer(args.gdb)) e.gdb = ganzzahl("gdb", args.gdb, 0, 100);
  if (!leer(args.merkzeichen)) {
    const mz = merkzeichenLesen(args.merkzeichen);
    if (mz.length) e.merkzeichen = mz;
  }
  if (!leer(args.pflegegrad)) e.pflegegrad = ganzzahl("pflegegrad", args.pflegegrad, 1, 5);
  if (!leer(args.alter_monate)) e.alter_monate = ganzzahl("alter_monate", args.alter_monate, 0, 1560);
  if (e.gdb === undefined && !e.merkzeichen && e.pflegegrad === undefined) {
    throw new LookupError("Bitte mindestens eine Angabe machen: gdb (0–100), merkzeichen (z. B. [\"G\"]) oder pflegegrad (1–5); alter_monate ist nur ergänzend.");
  }
  return e;
}

function erfuellt(b, e) {
  if (b.gdb_ab !== undefined && !(e.gdb !== undefined && e.gdb >= b.gdb_ab)) return false;
  if (b.gdb_bis !== undefined && !(e.gdb !== undefined && e.gdb <= b.gdb_bis)) return false;
  if (b.merkzeichen && !b.merkzeichen.some((m) => e.merkzeichen?.includes(m))) return false;
  if (b.pflegegrad_ab !== undefined && !(e.pflegegrad !== undefined && e.pflegegrad >= b.pflegegrad_ab)) return false;
  if (b.kind && !(e.alter_monate !== undefined && e.alter_monate < 216)) return false;
  return true;
}

// Signal aus der erfüllten Alternative; bei Merkzeichen nur die angegebenen, die passen.
function signalText(b, e) {
  const teile = [];
  if (b.gdb_ab !== undefined && b.gdb_bis !== undefined) teile.push(`GdB ${b.gdb_ab} bis ${b.gdb_bis}`);
  else if (b.gdb_ab !== undefined) teile.push(`GdB ab ${b.gdb_ab}`);
  if (b.merkzeichen) teile.push(`Merkzeichen ${b.merkzeichen.filter((m) => e.merkzeichen.includes(m)).join(", ")}`);
  if (b.pflegegrad_ab !== undefined) teile.push(`Pflegegrad ab ${b.pflegegrad_ab}`);
  if (b.kind) teile.push("Kind oder Jugendliche bzw. Jugendlicher unter 18");
  return teile.join(" und ");
}

/** leistungshinweise: passende Katalogeinträge zu GdB, Merkzeichen, Pflegegrad und Alter. */
export function hinweise(args = {}) {
  const eingaben = eingabenLesen(args ?? {});
  const eintraege = [];
  const landesrecht = [];
  for (const { wenn, ...rest } of KATALOG) {
    const passend = wenn.filter((b) => erfuellt(b, eingaben));
    if (!passend.length) continue;
    const { id, gruppe, ...inhalt } = rest;
    const aus = { id, gruppe, signal: passend.map((b) => signalText(b, eingaben)).join("; "), ...inhalt };
    (gruppe === "landesrecht" ? landesrecht : eintraege).push(aus);
  }
  return {
    eingaben,
    eintraege,
    landesrecht,
    hinweis: eingaben.merkzeichen ? `${HINWEIS} ${HINWEIS_MERKZEICHEN}` : HINWEIS,
    herkunft: HERKUNFT,
    beratung: BERATUNG,
  };
}
