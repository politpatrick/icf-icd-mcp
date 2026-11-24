// MCP-Prompts: geführte Abläufe für antragsberechtigte Personen. Ein Prompt liefert nur den Starttext;
// den Zustand trägt das Fallprofil im Gespräch. Keine Rechtsberatung, keine Interna.

import { BI_ENABLED } from "./bi_tools.mjs";
import { VMG_ENABLED } from "./vmg_tools.mjs";
import { ADULT_FROM_MONTHS, INFANT_BELOW_MONTHS } from "./bi.mjs";

/** Fehler in Prompt-Argumenten (wird als JSON-RPC-Fehler -32602 gemeldet). */
export class PromptError extends Error {}

const WER = {
  person: "Die Person selbst beantwortet die Fragen. Sprich sie direkt mit „Sie“ an.",
  person_mit_unterstuetzung: "Die Person antwortet mit Unterstützung (z. B. einer Angehörigen). Sprich die Person direkt an und frage die unterstützende Person ergänzend.",
  unterstuetzende_person: "Eine unterstützende Person antwortet im Auftrag der Person. Frage nach ihren Beobachtungen und kennzeichne die Antworten als Angaben der unterstützenden Person.",
};

function alterMonate(raw) {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 1560) throw new PromptError("alter_monate muss eine ganze Zahl von 0 bis 1560 sein (Alter in Monaten).");
  return n;
}

/** Beschreibung der Altersgruppe und ihrer Bewertungsregeln für den Prompt-Text. */
function altersText(monate, werkzeug) {
  if (monate === undefined) return "Es geht um eine erwachsene Person (Fassung für Erwachsene).";
  if (monate >= 18 * 12) return `Es geht um eine erwachsene Person (${monate} Monate); es gilt die Fassung für Erwachsene.`;
  const basis = `Es geht um ein Kind bzw. eine jugendliche Person (${monate} Monate). Verwende die Kinderfassung der Kriterien (bi_get_item mit variante "kinder") und übergib ${werkzeug} alter_monate ${monate}.`;
  if (monate < INFANT_BELOW_MONTHS) {
    return `${basis} Bis 18 Monate gilt eine Sonderregel: Statt Modul 4 wird nur die Frage 4.4.0 (gravierende Probleme bei der Nahrungsaufnahme) gestellt, die Module 1, 2 und 6 werden nicht bewertet, und es gilt eine eigene Tabelle der Pflegegrade.`;
  }
  if (monate < ADULT_FROM_MONTHS) return `${basis} Bis zum vollendeten 11. Lebensjahr werden Kinder mit gleichaltrigen Kindern ohne Beeinträchtigung verglichen.`;
  return `${basis} Ab dem vollendeten 11. Lebensjahr gilt die Punktesystematik für Erwachsene; die Texte der Kinderfassung beschreiben die Kriterien altersgerecht.`;
}

/** Bereichsbezogene Hinweise für eigene_darstellung_vorbereiten; Werkzeuge nur, wenn ihr Modul eingeschaltet ist. */
function bereichText(bereich) {
  switch (bereich) {
    case undefined:
    case "":
      return "Frag zu Beginn, worum es geht (z. B. GdB/Schwerbehinderung, Pflegegrad, Leistungen zur Teilhabe).";
    case "pflege":
      return `Es geht um die Pflegeversicherung (Pflegegrad).${BI_ENABLED ? " Liegt ein Pflegegutachten vor, kann bi_gegenueberstellen die Unterschiede zur eigenen Sicht je Kriterium zeigen; bi_get_item liefert die Definitionen der Begutachtungs-Richtlinien." : ""}`;
    case "gdb":
      return `Es geht um die Feststellung eines GdB bzw. von Merkzeichen.${VMG_ENABLED ? " Die Versorgungsmedizinischen Grundsätze (VersMedV) beschreiben, wonach beurteilt wird; vmg_search und vmg_get liefern den amtlichen Wortlaut." : " Grundlage der Beurteilung sind die Versorgungsmedizinischen Grundsätze (VersMedV)."}`;
    case "teilhabe":
      return "Es geht um Leistungen zur Teilhabe (z. B. Eingliederungshilfe). Zur Zuständigkeit und zu den Entscheidungsfristen nach § 14 SGB IX: verfahren_info mit Thema zustaendigkeit. Bei Leistungen nach SGB VIII (z. B. § 35a) gelten für Widerspruch und Klage die VwGO.";
    default:
      throw new PromptError("bereich muss einer dieser Werte sein: gdb, pflege, teilhabe.");
  }
}

/** Altershinweis für die GdB-Prompts (VersMedV Teil A Nr. 1.2 und Nr. 5). */
function gdbAltersText(monate) {
  if (monate === undefined || monate >= 18 * 12) return "";
  return `Es geht um ein Kind bzw. eine jugendliche Person (${monate} Monate). Maßstab ist die Abweichung von dem für das Lebensalter typischen Zustand (Teil A Nr. 1.2). Für das Merkzeichen H gelten die Besonderheiten bei Kindern und Jugendlichen in Teil A Nr. 5 (vmg_get mit kennung "A 5"); manche Zeilen in Teil B nennen eigene Werte für Kinder.\n`;
}

const GDB_GRENZEN = `- Die VersMedV-Werkzeuge liefern Wortlaut, Pfad und Fundstelle. Ein GdS-Wert wird nie ohne seine Zeile, ihren Pfad und die Fundstelle genannt. Teil B nennt Anhaltswerte; nach Teil A Nr. 1.4 kann mit besonderer Begründung abgewichen werden.
- Es gibt kein Gesamt-GdB als Zahl: Teil A Nr. 3 verbietet das Addieren und verlangt eine Gesamtschau. vmg_gesamt_gdb zeigt nur die Regeln und Markierungen. Die Einstufung bleibt eine gutachterliche Entscheidung.`;

/** Altershinweis für die Teilhabe-Prompts (§ 35a SGB VIII, § 99 SGB IX). */
function teilhabeAltersText(monate) {
  if (monate === undefined || monate >= 18 * 12) return "";
  return `Es geht um ein Kind bzw. eine jugendliche Person (${monate} Monate). Maßstab ist der für das Lebensalter typische Zustand. Bei (drohender) seelischer Behinderung leistet die Eingliederungshilfe das Jugendamt (§ 35a SGB VIII, für junge Volljährige § 41 SGB VIII); für Rechtsbehelfe gelten dort die VwGO und die Verwaltungsgerichte, das Nähere steht in der Rechtsbehelfsbelehrung. Bei körperlicher oder geistiger Behinderung ist es die Eingliederungshilfe nach dem SGB IX; liegt sie zusätzlich zu einer seelischen Behinderung vor, geht die Eingliederungshilfe nach dem SGB IX vor (§ 10 Abs. 4 SGB VIII). Die Zuordnung klären die Träger; das Gespräch nimmt sie nicht vorweg.\n`;
}

const ABGRENZUNG_SCHRITT = () =>
  BI_ENABLED
    ? "Mit abgrenzung_egh_pflege je d-Kategorie zeigen, ob das Begutachtungsinstrument der Pflegeversicherung den Bereich erfasst (ueberschneidung) oder nicht (teilhabe). Erklären, dass Pflege und Eingliederungshilfe nebeneinander stehen und es auf den Zweck der Unterstützung ankommt (§ 13 Abs. 3 SGB XI); das ist eine Orientierung, keine Zuständigkeitsentscheidung."
    : "Erklären, dass Pflege und Eingliederungshilfe nebeneinander stehen und es auf den Zweck der Unterstützung ankommt (§ 13 Abs. 3 SGB XI): Pflege versorgt, Eingliederungshilfe befähigt und begleitet (§§ 78, 113 SGB IX); beides kann denselben Lebensbereich betreffen. Das ist eine Orientierung, keine Zuständigkeitsentscheidung.";

const GRUNDSAETZE = `Grundsätze für das ganze Gespräch:
- Du hilfst einer antragsberechtigten Person, ihre Situation zu ordnen. Es findet keine Rechtsberatung statt: keine Einschätzung, ob ein Antrag oder Widerspruch Erfolg hat, keine Empfehlung eines Rechtswegs, keine Aussage, ob ein Gutachten oder Bescheid rechtmäßig ist. Bei Rechtsfragen auf unabhängige Beratung verweisen (Pflegeberatung nach § 7a SGB XI, Pflegestützpunkt, EUTB, Sozialverbände).
- Einfache, freundliche Sprache. Höchstens drei Fragen auf einmal. Pausen anbieten; man kann jederzeit unterbrechen und später mit dem Fallprofil weitermachen.
- Behutsam bei schambesetzten Themen (z. B. Ausscheidung, Verhalten, psychische Probleme): kurz erklären, warum gefragt wird.
- Aussagen nicht ausschmücken: die Worte der Person als O-Ton festhalten. Kennzeichne in Ergebnissen, was aus den Begutachtungs-Richtlinien stammt (amtlich), was kuratiert ist und was deine Einschätzung ist.
- Ergebnisse im Fallprofil festhalten (Format mit fall_schema, Prüfung mit fall_pruefen). Ein Pseudonym statt des Namens verwenden, keine Anschriften oder Nummern.`;

const PROMPTS_ALLE = [
  {
    name: "pflegegrad_interview",
    title: "Pflegebegutachtung vorbereiten: Selbsteinschätzung im Interview",
    description:
      "Geführtes Interview zur Vorbereitung auf eine Pflegebegutachtung: Modul für Modul des Begutachtungsinstruments, in einfacher Sprache, mit Zwischenständen. Ergebnis: Fallprofil mit BI-Einträgen, Orientierung zum Pflegegrad, Vorbereitungsliste und Vorlage für ein Pflegetagebuch. Keine Rechtsberatung.",
    arguments: [
      { name: "wer_antwortet", description: "person | person_mit_unterstuetzung | unterstuetzende_person", required: false },
      { name: "alter_monate", description: "Bei Kindern und Jugendlichen: Alter in Monaten", required: false },
    ],
    bi: true,
    render(args) {
      const wer = args.wer_antwortet ?? "person";
      if (typeof wer !== "string" || !Object.hasOwn(WER, wer)) throw new PromptError(`wer_antwortet muss einer dieser Werte sein: ${Object.keys(WER).join(", ")}.`);
      const monate = alterMonate(args.alter_monate);
      return `Führe mit mir ein Interview zur Vorbereitung auf eine Pflegebegutachtung nach dem Begutachtungsinstrument (§ 15 SGB XI).

${WER[wer]}
${altersText(monate, "bi_calculate")}

${GRUNDSAETZE}

Ablauf:
1. Kurz erklären, was das Interview leistet: eine eigene Einschätzung zur Vorbereitung, keine Begutachtung und keine Vorhersage des Ergebnisses. Fragen, ob schon ein Fallprofil vorliegt; wenn ja, daran anknüpfen.
2. Modul für Modul vorgehen, in der Reihenfolge 1 Mobilität, 2 Kognitive und kommunikative Fähigkeiten, 3 Verhaltensweisen und psychische Problemlagen, 4 Selbstversorgung, 5 Umgang mit krankheits- und therapiebedingten Anforderungen, 6 Gestaltung des Alltagslebens und sozialer Kontakte. Die Liste der Kriterien liefert bi_list_structure.
3. Vor jedem Kriterium bi_get_item aufrufen. Aus Definition und Stufen eine Frage in einfacher Sprache bilden, die nach dem Alltag fragt („Wie klappt es, wenn Sie vom Sessel aufstehen und sich auf einen Stuhl setzen?“). Ist die Antwort zwischen zwei Stufen, gezielt nach dem fragen, was die Stufen unterscheidet (die Erläuterungen der Stufen aus bi_get_item).
4. Je Kriterium festhalten: Stufe als BI-Kodierung (z. B. BI:4.1.3=2, in Modul 5 als Häufigkeit wie BI:4.5.1=3/Tag) mit Herkunft "interview", O-Ton und Status (geschildert oder offen, wenn unklar).
5. Nach jedem Modul den Zwischenstand mit bi_calculate zeigen und fragen, ob eine Pause gewünscht ist.
6. Am Ende das Fallprofil mit fall_pruefen prüfen und ausgeben.

Ergebnis:
- Das Fallprofil (JSON) zum Weiterverwenden.
- Eine Orientierung zum Pflegegrad – nur wenn alle Kriterien beantwortet sind – mit dem Hinweis, dass die Begutachtung zu einem anderen Ergebnis kommen kann.
- Eine Vorbereitungsliste für den Termin: Was sollte angesprochen oder gezeigt werden (Hilfsmittel, Medikamentenplan, Befunde)?
- Eine Vorlage für ein Pflegetagebuch zu den Kriterien, die unklar geblieben sind (Datum, Uhrzeit, Tätigkeit, welche Hilfe, wie lange).`;
    },
  },
  {
    name: "pflegegutachten_verstehen",
    title: "Pflegegutachten verstehen und mit der eigenen Sicht vergleichen",
    description:
      "Geführter Ablauf, um ein Pflegegutachten zu verstehen: Einstufungen übernehmen, die eigene Sicht zu zweifelhaften Kriterien erfragen, mit bi_gegenueberstellen jeden Unterschied erklären (Definition, Bedeutung der Stufen, Wirkung, Abgrenzungen) und Formulierungshilfen für eine eigene Darstellung geben. Keine Rechtsberatung.",
    arguments: [{ name: "alter_monate", description: "Bei Kindern und Jugendlichen: Alter am Tag der Begutachtung in Monaten", required: false }],
    bi: true,
    render(args) {
      const monate = alterMonate(args.alter_monate);
      return `Hilf mir, ein Pflegegutachten zu verstehen und mit meiner eigenen Sicht zu vergleichen.
${monate !== undefined ? altersText(monate, "bi_calculate und bi_gegenueberstellen") : ""}

${GRUNDSAETZE}

Ablauf:
1. Das Gutachten übernehmen: Ich lade es hoch oder nenne die Einstufungen. Lies je Kriterium die Einstufung und die Begründung der Gutachterin bzw. des Gutachters heraus und schreibe sie als BI-Kodierung (z. B. 4.1.3=1; Modul 5 als Häufigkeit). Fehlen Angaben, sag welche.
2. Erkläre kurz, wie das Ergebnis zustande kommt (bi_calculate mit den Werten aus dem Gutachten): Punkte je Modul, Gewichtung, Pflegegrad.
3. Frag mich, bei welchen Kriterien ich etwas anders erlebe. Hole dazu bi_get_item, erkläre die Stufen in einfacher Sprache und halte meine Einschätzung mit O-Ton fest. Ich muss nicht alle Kriterien neu einschätzen.
4. Rufe bi_gegenueberstellen auf (gutachten und eigene, oder ein Fallprofil mit den Herkünften "gutachten" und "interview").
5. Erkläre jeden Unterschied in vier Teilen: worum es bei dem Kriterium geht, was die beiden Stufen nach den Begutachtungs-Richtlinien bedeuten (wörtlich zitieren), was der Unterschied bei den Punkten bewirkt und ob er allein den Pflegegrad ändert, und welche Hinweise und Abgrenzungen für die Einstufung wichtig sind. Bewerte nicht, ob das Gutachten falsch ist.
6. Zeige, welche Unterschiede den Pflegegrad berühren und welche nicht, und den Abstand zur nächsten Schwelle.

Ergebnis:
- Eine Übersicht der Unterschiede in einfacher Sprache.
- Formulierungshilfen für eine eigene Darstellung in meinen Worten: was ich im Alltag erlebe, mit Beispielen und Belegen (Befunde, Pflegetagebuch). Keine rechtliche Begründung.
- Den allgemeinen Hinweis, dass gegen einen Bescheid Widerspruch möglich ist und die Frist in der Rechtsbehelfsbelehrung des Bescheids steht, sowie den Verweis auf unabhängige Beratung (Pflegeberatung nach § 7a SGB XI, Pflegestützpunkt, EUTB, Sozialverbände).
- Auf Wunsch das Fallprofil mit den Einträgen aus Gutachten und eigener Sicht (fall_pruefen).`;
    },
  },
  {
    name: "eigene_darstellung_vorbereiten",
    title: "Eigene Situation sachlich aufschreiben",
    description:
      "Geführter Ablauf, um die eigene Situation zu einem Antrag, Bescheid oder Gutachten sachlich aufzuschreiben: Tatsachen, Beobachtungen, Belege und O-Ton getrennt erfassen (auch aus einem Fallprofil), mit fall_pruefen Lücken finden, Verfahrenswege allgemein mit verfahren_info erklären und eine Gliederung der eigenen Darstellung erstellen. Keine Rechtsberatung, keine Fristberechnung, keine Empfehlung eines Wegs.",
    arguments: [
      { name: "wer_antwortet", description: "person | person_mit_unterstuetzung | unterstuetzende_person", required: false },
      { name: "bereich", description: "gdb | pflege | teilhabe", required: false },
    ],
    render(args) {
      const wer = args.wer_antwortet ?? "person";
      if (typeof wer !== "string" || !Object.hasOwn(WER, wer)) throw new PromptError(`wer_antwortet muss einer dieser Werte sein: ${Object.keys(WER).join(", ")}.`);
      return `Hilf mir, meine Situation sachlich aufzuschreiben – zum Beispiel für einen Antrag, als Reaktion auf einen Bescheid oder ein Gutachten oder für ein Beratungsgespräch.

${WER[wer]}
${bereichText(args.bereich)}

${GRUNDSAETZE}
- Du schreibst keine rechtliche Begründung, berechnest keine Fristen und empfiehlst keinen Weg. Ob ein Widerspruch, ein Überprüfungsantrag oder ein neuer Antrag im Einzelfall passt, klärt die Person mit einer Beratungsstelle.

Ablauf:
1. Anlass klären: Was liegt vor (Antrag, Bescheid, Gutachten, Untätigkeit der Behörde)? Mit welchem Datum, und wann ist es angekommen? Gibt es schon ein Fallprofil? Wenn ja, daran anknüpfen und den O-Ton daraus übernehmen.
2. Liegt ein Bescheid vor: Weise darauf hin, dass Frist und Stelle für einen Rechtsbehelf in der Rechtsbehelfsbelehrung am Ende des Bescheids stehen, und bitte darum, sie selbst nachzulesen. Rechne keine Frist aus.
3. Die eigene Sicht in vier getrennten Teilen erfassen und nicht vermischen:
   - Tatsachen: was nachprüfbar ist (Diagnosen, Hilfsmittel, Termine, wer wann hilft).
   - Beobachtungen: was die Person bzw. Angehörige im Alltag erleben, mit konkreten Beispielen (wann, wie oft, wie lange, was passiert ohne Hilfe).
   - Belege: welche Unterlagen das stützen (Befunde, Arztberichte, Pflegetagebuch, Bescheinigungen) und welche noch fehlen.
   - O-Ton: die eigenen Worte der Person, unverändert.
   Wenn ein Bescheid oder Gutachten vorliegt: Stelle gegenüber, was dort steht und was die Person anders erlebt – ohne zu bewerten, ob der Bescheid richtig ist.
4. Die Angaben im Fallprofil festhalten oder ergänzen (Format mit fall_schema) und mit fall_pruefen auf Lücken prüfen; fehlende Belege benennen.
5. Die möglichen Wege allgemein erklären, ohne einen zu empfehlen: verfahren_info liefert Widerspruch, Überprüfungsantrag, Neufeststellungs- bzw. Höherstufungsantrag, Akteneinsicht, Untätigkeitsklage, Zuständigkeitsklärung und Bekanntgabe mit den Normen. Kennzeichne die Erklärungen als kuratiert und die Normauszüge als amtlich.
6. Eine Gliederung der eigenen Darstellung erstellen und auf Wunsch ausformulieren – in der Ich-Form bzw. aus Sicht der unterstützenden Person, sachlich, mit Beispielen und Verweisen auf die Belege.

Ergebnis:
- Die eigene Darstellung (Gliederung oder Text) mit Tatsachen, Beobachtungen, Belegen und O-Ton, ohne rechtliche Begründung.
- Eine Liste der Belege, die vorliegen, und der Belege, die noch fehlen.
- Den allgemeinen Hinweis auf die Rechtsbehelfsbelehrung des Bescheids und auf unabhängige Beratung: EUTB (§ 32 SGB IX), Pflegeberatung nach § 7a SGB XI, Pflegestützpunkt, Sozialverbände.
- Auf Wunsch das aktualisierte Fallprofil (fall_pruefen).`;
    },
  },
  {
    name: "gdb_antrag_vorbereiten",
    title: "GdB-Antrag vorbereiten",
    description:
      "Geführter Ablauf zur Vorbereitung eines Antrags auf Feststellung eines GdB und von Merkzeichen: Diagnosen (ICD), Auswirkungen im Alltag mit O-Ton, vorhandene und fehlende Befunde, Orientierung an passenden Zeilen der GdS-Tabelle (Teil B) mit vmg_spanne_pruefen, Merkzeichen, eine Bitte um Befundberichte an Ärztinnen und Ärzte. Kein Gesamt-GdB als Zahl, keine Rechtsberatung.",
    arguments: [
      { name: "wer_antwortet", description: "person | person_mit_unterstuetzung | unterstuetzende_person", required: false },
      { name: "alter_monate", description: "Bei Kindern und Jugendlichen: Alter in Monaten", required: false },
    ],
    vmg: true,
    render(args) {
      const wer = args.wer_antwortet ?? "person";
      if (typeof wer !== "string" || !Object.hasOwn(WER, wer)) throw new PromptError(`wer_antwortet muss einer dieser Werte sein: ${Object.keys(WER).join(", ")}.`);
      const monate = alterMonate(args.alter_monate);
      return `Hilf mir, einen Antrag auf Feststellung eines Grades der Behinderung (GdB) und gegebenenfalls von Merkzeichen vorzubereiten. Maßstab sind die Versorgungsmedizinischen Grundsätze (Anlage zu § 2 VersMedV).

${WER[wer]}
${gdbAltersText(monate)}
${GRUNDSAETZE}
${GDB_GRENZEN}

Ablauf:
1. Kurz erklären, was der Ablauf leistet: eine geordnete Vorbereitung, keine Vorhersage des GdB. Fragen, ob schon ein Fallprofil vorliegt; wenn ja, daran anknüpfen.
2. Gesundheitsstörungen sammeln: Diagnosen mit icd_search bzw. icd_get_code als ICD-10-GM-Kode festhalten (nur, was ärztlich festgestellt ist; sonst als geschildert kennzeichnen). Eine Diagnose allein sagt nichts über den GdB – es kommt auf die Auswirkungen an.
3. Je Gesundheitsstörung die Auswirkungen im Alltag erfragen, mit Beispielen (was geht nicht mehr, wie oft, wie lange, welche Hilfe, welche Hilfsmittel). O-Ton festhalten.
4. Befunde ordnen: Welche Arztberichte, Klinikberichte, Therapieberichte liegen vor (Datum, Stelle)? Welche fehlen oder beschreiben den heutigen Stand nicht mehr?
5. Orientierung an Teil B: Mit vmg_search den passenden Abschnitt finden, mit vmg_get die Zeilen mit Pfad zeigen und in einfacher Sprache erklären, wonach die Zeilen unterscheiden. Ordnet die Person ihre Situation selbst einer Zeile zu, die Zeilenkennung (z. B. VMG:B 3.7 Z2) und einen möglichen Wert mit vmg_spanne_pruefen prüfen. Kennzeichnen, dass das eine eigene Orientierung ist, keine Einstufung.
6. Merkzeichen: Mit vmg_merkzeichen die Voraussetzungen der in Betracht kommenden Merkzeichen zeigen – für G, B, H, Bl und Gl im Wortlaut; für aG, RF und TBl nennt das Werkzeug nur die maßgebliche Norm, dann keinen Wortlaut ergänzen. Die Person fragen, was davon im Alltag zutrifft. Nicht entscheiden, ob ein Merkzeichen zusteht.
7. Alles im Fallprofil festhalten und mit fall_pruefen prüfen: Diagnosen als art icd (herkunft "befund", wenn ärztlich belegt), Merkzeichen als art merkzeichen. Eine eigene Orientierung an einer Zeile als art vmg mit Zeilenkennung und gdb immer mit herkunft "interview" und status "geschildert" und in begruendung „eigene Orientierung“ – nie als Befund, damit sie nicht wie ein festgestellter Wert wirkt.

Ergebnis:
- Das Fallprofil (JSON) zum Weiterverwenden.
- Eine Übersicht je Gesundheitsstörung: Auswirkungen in den Worten der Person, vorhandene Belege, in Betracht kommende Zeile(n) aus Teil B mit Pfad und Fundstelle – ohne Gesamt-GdB, kein Gesamt-GdB als Zahl.
- Eine kurze, höfliche Bitte an die behandelnden Ärztinnen und Ärzte um einen aktuellen Befundbericht, der die Auswirkungen im Alltag beschreibt (Funktionseinschränkungen, Verlauf, Therapie), ohne Formulierungsvorgaben für die Ärztin bzw. den Arzt.
- Eine Liste, was dem Antrag beiliegen sollte und wo der Antrag gestellt wird (Versorgungsamt bzw. die nach Landesrecht zuständige Stelle; Anträge können nach § 16 SGB I auch bei anderen Leistungsträgern oder der Gemeinde gestellt werden und werden dann weitergeleitet).
- Den allgemeinen Hinweis, dass mit GdB und Merkzeichen Nachteilsausgleiche verbunden sein können, ohne Aufzählung oder Beträge, und den Verweis auf unabhängige Beratung (EUTB, Sozialverbände).`;
    },
  },
  {
    name: "gdb_bescheid_verstehen",
    title: "GdB-Bescheid verstehen und mit der eigenen Sicht vergleichen",
    description:
      "Geführter Ablauf, um einen Bescheid über GdB und Merkzeichen zu verstehen: festgestellte Funktionsbeeinträchtigungen und Einzel-GdB den Zeilen der GdS-Tabelle zuordnen und in einfacher Sprache erklären, vmg_gesamt_gdb als Prüfhilfe zu Teil A Nr. 3, Unterschiede zur eigenen Sicht festhalten, Verfahrenswege allgemein mit verfahren_info. Keine Bewertung des Bescheids, keine Rechtsberatung.",
    arguments: [{ name: "alter_monate", description: "Bei Kindern und Jugendlichen: Alter in Monaten", required: false }],
    vmg: true,
    render(args) {
      const monate = alterMonate(args.alter_monate);
      return `Hilf mir, einen Bescheid über den Grad der Behinderung (GdB) und Merkzeichen zu verstehen und mit meiner eigenen Sicht zu vergleichen.
${gdbAltersText(monate)}
${GRUNDSAETZE}
${GDB_GRENZEN}
- Bewerte nicht, ob der Bescheid richtig oder rechtmäßig ist; zeige, was dort steht, was die Werte bedeuten und wo meine Sicht abweicht.

Ablauf:
1. Den Bescheid übernehmen: Ich lade ihn hoch oder nenne die Angaben. Lies heraus: festgestellter GdB, Merkzeichen, die aufgeführten Funktionsbeeinträchtigungen und – falls genannt, z. B. in der versorgungsärztlichen Stellungnahme aus der Akte – die Einzel-GdB. Datum des Bescheids und die Rechtsbehelfsbelehrung notieren; die Frist nicht berechnen.
2. Jede Funktionsbeeinträchtigung einem Abschnitt in Teil B zuordnen (vmg_search, vmg_get) und alle Zeilen des Abschnitts mit ihren Werten und Pfaden in einfacher Sprache erklären. Welcher Zeile die Person ihre Situation zuordnet, ist ihre eigene Orientierung, nicht die des Versorgungsamts; dessen Zuordnung steht ggf. in der versorgungsärztlichen Stellungnahme (Akteneinsicht, verfahren_info). Ist ein Einzel-GdB genannt, kann vmg_spanne_pruefen zeigen, wie er zur gewählten Zeile liegt. „Außerhalb“ heißt nicht „falsch“ (Teil A Nr. 1.4).
3. Wie aus den Einzel-GdB der Gesamt-GdB gebildet wird, mit vmg_gesamt_gdb und den Regeln aus Teil A Nr. 3 in einfacher Sprache erklären (kein Addieren, Ausgangspunkt ist der höchste Einzel-GdB, Einzel-GdB von 10 erhöhen in der Regel nicht). Kein Gesamt-GdB als Zahl berechnen.
4. Merkzeichen: Was festgestellt oder abgelehnt wurde, mit vmg_merkzeichen erklären – für G, B, H, Bl und Gl im Wortlaut der Voraussetzungen; für aG, RF und TBl nennt das Werkzeug nur die maßgebliche Norm, dann keinen Wortlaut ergänzen.
5. Fragen, was ich anders erlebe oder was fehlt (Gesundheitsstörungen, die nicht berücksichtigt sind; Auswirkungen, die stärker sind; neuere Befunde). Mit O-Ton und Belegen im Fallprofil festhalten (herkunft "bescheid" für die Angaben aus dem Bescheid, "interview" mit status "geschildert" für meine Sicht) und mit fall_pruefen prüfen; bei einer früheren Fassung fall_vergleichen.
6. Die möglichen Wege allgemein mit verfahren_info erklären (Widerspruch, Überprüfungsantrag, Neufeststellungsantrag bei Verschlechterung, Akteneinsicht), ohne einen zu empfehlen.

Ergebnis:
- Den Bescheid in einfacher Sprache: was festgestellt wurde und was die Werte bedeuten, je Funktionsbeeinträchtigung mit Zeile, Pfad und Fundstelle.
- Eine Übersicht der Unterschiede zur eigenen Sicht mit Belegen, die vorliegen oder fehlen.
- Den allgemeinen Hinweis auf die Rechtsbehelfsbelehrung des Bescheids und auf unabhängige Beratung (EUTB, Sozialverbände). Auf Wunsch weiter mit eigene_darstellung_vorbereiten.`;
    },
  },
  {
    name: "teilhabebedarf_erfassen",
    title: "Teilhabebedarf erfassen",
    description:
      "Geführter Ablauf, um den eigenen Bedarf an Leistungen zur Teilhabe (z. B. Eingliederungshilfe) zu beschreiben: nach den neun Lebensbereichen des § 118 SGB IX, in Ich-Form mit O-Ton, ICF-strukturiert und mit Diagnosen (ICD), mit Umweltfaktoren, Wünschen und Zielen. Orientierung Pflege/Eingliederungshilfe und Zuständigkeit allgemein. Ergebnis: Fallprofil und eine Darstellung für das Gesamtplan- bzw. Teilhabeplanverfahren. Keine Rechtsberatung.",
    arguments: [
      { name: "wer_antwortet", description: "person | person_mit_unterstuetzung | unterstuetzende_person", required: false },
      { name: "alter_monate", description: "Bei Kindern und Jugendlichen: Alter in Monaten", required: false },
    ],
    render(args) {
      const wer = args.wer_antwortet ?? "person";
      if (typeof wer !== "string" || !Object.hasOwn(WER, wer)) throw new PromptError(`wer_antwortet muss einer dieser Werte sein: ${Object.keys(WER).join(", ")}.`);
      const monate = alterMonate(args.alter_monate);
      return `Hilf mir, meinen Bedarf an Unterstützung zur Teilhabe zu beschreiben – zum Beispiel für einen Antrag auf Eingliederungshilfe oder für das Gesamtplan- bzw. Teilhabeplanverfahren.

${WER[wer]}
${teilhabeAltersText(monate)}
${GRUNDSAETZE}
- Es geht um die Sicht der Person: was sie im Alltag erlebt, was sie sich wünscht und welche Ziele sie hat. Das Gespräch nimmt keine Bedarfsfeststellung des Trägers vorweg und sagt nicht, welche Leistung zusteht.
- Herkunft kennzeichnen: Die Lebensbereiche nach § 118 SGB IX und die ICF-Kategorien sind amtlich, die Zuordnung zu Pflege und Teilhabe ist kuratiert, Zusammenfassungen sind deine Einschätzung.

Ablauf:
1. Kurz erklären, was der Ablauf leistet, und fragen, ob schon ein Fallprofil vorliegt; wenn ja, daran anknüpfen. Erwähnen, dass man zum Gesamtplanverfahren eine Person des Vertrauens mitbringen kann (§ 117 Abs. 2 SGB IX).
2. Ziele und Wünsche zuerst: Wie möchte die Person wohnen, arbeiten oder lernen, ihre Freizeit verbringen, Kontakte pflegen? Was soll sich ändern? Wünsche zur Gestaltung der Unterstützung festhalten (§ 104 Abs. 2 SGB IX).
3. Die neun Lebensbereiche nach § 118 SGB IX nacheinander durchgehen (Lernen und Wissensanwendung, Allgemeine Aufgaben und Anforderungen, Kommunikation, Mobilität, Selbstversorgung, häusliches Leben, interpersonelle Interaktionen und Beziehungen, bedeutende Lebensbereiche, Gemeinschafts-, soziales und staatsbürgerliches Leben). Je Bereich: Was klappt, was nicht, welche Unterstützung gibt es heute, welche fehlt? In Ich-Form mit O-Ton festhalten; Bereiche ohne Bedarf kurz bestätigen.
4. Die Schilderungen ICF-strukturiert festhalten: passende d-Kategorien mit icf_search finden und mit icf_get_code prüfen (Beurteilungsmerkmal nur, wenn die Person die Schwere selbst einschätzt); Ursachen als Diagnosen mit icd_search; Körperfunktionen (b) nur, wenn sie zur Erklärung nötig sind. Umweltfaktoren (e) als Barrieren oder Förderfaktoren festhalten (z. B. Wohnung, Hilfsmittel, Unterstützung durch Angehörige).
5. ${ABGRENZUNG_SCHRITT()}
6. Zuständigkeit allgemein: Der Träger, bei dem der Antrag eingeht, klärt sie (verfahren_info mit Thema zustaendigkeit). Keine Aussage, welcher Träger im Einzelfall zuständig ist.
7. Alles im Fallprofil festhalten (Einträge mit Herkunft "interview", Zusammenhänge verursacht/beeintraechtigt/foerdert/hemmt, ziele mit gewuenschter Unterstützung) und mit fall_pruefen prüfen; die Lebensbereiche und Lücken aus fall_pruefen besprechen.

Ergebnis:
- Das Fallprofil (JSON) zum Weiterverwenden.
- Eine Darstellung „Mein Unterstützungsbedarf“ in Ich-Form: Ziele und Wünsche, je Lebensbereich Situation, Unterstützung heute und gewünschte Unterstützung, mit O-Ton und Belegen.
- Eine Liste der Belege, die vorliegen oder noch fehlen (Befunde, Berichte von Schule, Werkstatt oder Diensten).
- Den Verweis auf unabhängige Beratung (EUTB nach § 32 SGB IX, Sozialverbände); auf Wunsch weiter mit eigene_darstellung_vorbereiten.`;
    },
  },
  {
    name: "bedarfsfeststellung_verstehen",
    title: "Bedarfsfeststellung oder Gesamtplan verstehen",
    description:
      "Geführter Ablauf, um eine Bedarfsermittlung, einen Gesamtplan (§ 121 SGB IX) oder Teilhabeplan bzw. einen Bescheid über Leistungen zur Teilhabe zu verstehen: Kommen die eigenen Bedarfe, Wünsche und Ziele vor, wo weicht die eigene Sicht ab, wo fehlen Belege? Abgleich mit dem Fallprofil (fall_vergleichen), Wege allgemein mit verfahren_info. Keine Bewertung, keine Rechtsberatung.",
    arguments: [{ name: "alter_monate", description: "Bei Kindern und Jugendlichen: Alter in Monaten", required: false }],
    render(args) {
      const monate = alterMonate(args.alter_monate);
      return `Hilf mir, eine Bedarfsermittlung, einen Gesamtplan (§ 121 SGB IX) bzw. Teilhabeplan oder einen Bescheid über Leistungen zur Teilhabe zu verstehen und mit meiner eigenen Sicht abzugleichen.
${teilhabeAltersText(monate)}
${GRUNDSAETZE}
- Bewerte nicht, ob die Feststellung oder der Bescheid richtig ist. Zeige, was dort steht, und wo meine Sicht abweicht oder Belege fehlen.

Ablauf:
1. Das Dokument übernehmen: Ich lade es hoch oder nenne die Angaben. Lies heraus: festgestellte Bedarfe je Lebensbereich, Ziele, Wünsche, Leistungen nach Inhalt, Umfang und Dauer, Überprüfungszeitpunkt, beteiligte Träger. Bei einem Bescheid Datum und Rechtsbehelfsbelehrung notieren; die Frist nicht berechnen.
2. In einfacher Sprache erklären, was dort steht. Kennzeichnen, was aus dem Dokument stammt und was deine Erklärung ist.
3. Mit meiner Sicht abgleichen: Liegt ein Fallprofil vor (z. B. aus teilhabebedarf_erfassen), die Angaben aus dem Dokument als zweite Fassung mit herkunft "bescheid" bzw. "material" festhalten und mit fall_vergleichen gegenüberstellen; sonst meine Sicht mit O-Ton erfragen.
4. Für jeden Lebensbereich zeigen: Kommen meine Bedarfe vor? Kommen meine Wünsche und Ziele vor (das Gesamtplanverfahren sieht die Dokumentation der Wünsche zu Ziel und Art der Leistungen vor, § 117 Abs. 1 Nr. 2 SGB IX)? Wo fehlen Belege, die meine Sicht stützen?
5. ${ABGRENZUNG_SCHRITT()}
6. Die möglichen Wege allgemein mit verfahren_info erklären (z. B. Widerspruch, Akteneinsicht, Überprüfungsantrag, neuer Antrag bei veränderter Situation), ohne einen zu empfehlen.

Ergebnis:
- Das Dokument in einfacher Sprache.
- Eine Übersicht je Lebensbereich: was festgestellt ist, was ich anders sehe, welche Belege vorliegen oder fehlen.
- Den allgemeinen Hinweis auf die Rechtsbehelfsbelehrung und auf unabhängige Beratung (EUTB nach § 32 SGB IX, Sozialverbände); auf Wunsch weiter mit eigene_darstellung_vorbereiten.`;
    },
  },
  {
    name: "leistungen_finden",
    title: "Mögliche Leistungen und Nachteilsausgleiche finden",
    description:
      "Geführter Ablauf, um zu den festgestellten Werten (GdB, Merkzeichen, Pflegegrad) mögliche Leistungen und Nachteilsausgleiche zu finden: leistungshinweise aufrufen, die Einträge nach Lebenslage ordnen, den nächsten Schritt und die typische Stelle je gewünschtem Eintrag allgemein erklären, Landesrecht als je Land verschieden kennzeichnen. Keine Beträge, keine Anspruchsprüfung, keine Rechtsberatung.",
    arguments: [{ name: "wer_antwortet", description: "person | person_mit_unterstuetzung | unterstuetzende_person", required: false }],
    render(args) {
      const wer = args.wer_antwortet ?? "person";
      if (typeof wer !== "string" || !Object.hasOwn(WER, wer)) throw new PromptError(`wer_antwortet muss einer dieser Werte sein: ${Object.keys(WER).join(", ")}.`);
      return `Hilf mir herauszufinden, welche Leistungen und Nachteilsausgleiche zu meinem GdB, meinen Merkzeichen und meinem Pflegegrad in Betracht kommen können.

${WER[wer]}
${GRUNDSAETZE}
- Das Werkzeug leistungshinweise zeigt Hinweise aus einem kuratierten Katalog, keine Prüfung meines Anspruchs: keine Beträge, keine Einkommens- oder Vermögensprüfung, keine Entscheidung, welche Stelle im Einzelfall zuständig ist, keine Fristen. Formuliere „kann in Betracht kommen“, nie „steht zu“.
- Nur festgestellte Werte aus einem Bescheid gehen als Eingabe in leistungshinweise. Ein eigener Orientierungswert (z. B. ${VMG_ENABLED ? "aus gdb_antrag_vorbereiten oder " : "aus einer eigenen Einschätzung oder "}ein Fallprofil-Eintrag mit herkunft "interview" und status "geschildert") ist nicht festgestellt. Ihn nur ausdrücklich als „was wäre, wenn“ verwenden und die Ausgabe dann so kennzeichnen.

Ablauf:
1. Fragen, ob ein Fallprofil vorliegt; wenn ja, mit fall_pruefen prüfen und die festgestellten Werte aus verfahren mit art "bescheid" übernehmen: ergebnis.gdb, ergebnis.merkzeichen und bei bereich "pflege" ergebnis.pflegegrad. Merkzeichen-Einträge (art "merkzeichen") nur mit herkunft "bescheid" verwenden. Gutachten und eigene Orientierung (z. B. Einträge mit gdb und herkunft "interview") gelten nicht als festgestellt; einen Pflegegrad 0 („kein Pflegegrad“) nicht übergeben. Sonst frage nach dem GdB und den Merkzeichen im Feststellungsbescheid (G, aG, B, H, Bl, Gl, RF, TBl) und nach dem Pflegegrad im Bescheid der Pflegekasse. Bei einem Kind nach dem Alter in Monaten fragen. Fehlt ein Bescheid, nicht raten: dann gibt es dafür keinen festgestellten Wert.
2. leistungshinweise mit gdb, merkzeichen, pflegegrad (und ggf. alter_monate) aufrufen.
3. Die Einträge nach meiner Lebenslage ordnen, etwa Arbeit, Mobilität, Steuern, Pflege zu Hause, Wohnen. Je Eintrag kurz in einfacher Sprache sagen, was es ist und warum der Hinweis erscheint (signal), mit Norm und Link. Vorrang und Nachrang (rang) erklären.
4. Fragen, was mir davon am wichtigsten ist, und die Einträge dazu auswählen.
5. Je gewünschtem Eintrag den nächsten Schritt und die typische Stelle allgemein erklären (naechster_schritt, stelle, voraussetzung); die Voraussetzungen als „worauf es ankommt“, nicht als Ergebnis für mich. Welche Unterlagen helfen, aus dem Fallprofil und den Bescheiden ableiten.
6. Landesrecht (z. B. Blindengeld, Gehörlosengeld, Rundfunkbeitrag, Parkerleichterungen) als „je Land verschieden“ kennzeichnen: das Werkzeug liefert dazu keine Norm. Ich soll die Regelung meines Bundeslandes bei der zuständigen Stelle erfragen.
7. alter_hinweis immer wiedergeben; ist kein Alter bekannt, als offene Frage kennzeichnen. Ist unklar, ob ein Eintrag zum Alter passt, offen sagen.

Ergebnis:
- Eine Übersicht nach Lebenslage: Leistung, warum sie erscheint, Norm mit Link, typische Stelle, nächster Schritt.
- Eine Liste der Hinweise, die ich weiterverfolgen möchte, mit den Unterlagen, die dafür helfen können.
- Den Hinweis, dass dies keine Rechtsberatung und keine Anspruchsprüfung ist, und den Verweis auf unabhängige Beratung: EUTB (§ 32 SGB IX), Sozialverbände, bei Pflege die Pflegeberatung nach § 7a SGB XI.`;
    },
  },
];

export const PROMPTS = PROMPTS_ALLE.filter((p) => (!p.bi || BI_ENABLED) && (!p.vmg || VMG_ENABLED));

/** prompts/list */
export function listPrompts() {
  return { prompts: PROMPTS.map(({ name, title, description, arguments: args }) => ({ name, title, description, arguments: args })) };
}

/** prompts/get */
export function getPrompt({ name, arguments: args = {} } = {}) {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) throw new PromptError(`Unbekannter Prompt "${name}". Verfügbar: ${PROMPTS.map((p) => p.name).join(", ")}.`);
  return { description: prompt.description, messages: [{ role: "user", content: { type: "text", text: prompt.render(args ?? {}) } }] };
}
