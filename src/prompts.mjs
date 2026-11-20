// MCP-Prompts: geführte Abläufe für antragsberechtigte Personen. Ein Prompt liefert nur den Starttext;
// den Zustand trägt das Fallprofil im Gespräch. Keine Rechtsberatung, keine Interna.

import { BI_ENABLED } from "./bi_tools.mjs";

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
      if (!WER[wer]) throw new PromptError(`wer_antwortet muss einer dieser Werte sein: ${Object.keys(WER).join(", ")}.`);
      const monate = alterMonate(args.alter_monate);
      const kind = monate !== undefined && monate < 18 * 12;
      return `Führe mit mir ein Interview zur Vorbereitung auf eine Pflegebegutachtung nach dem Begutachtungsinstrument (§ 15 SGB XI).

${WER[wer]}
${kind ? `Es geht um ein Kind bzw. eine jugendliche Person (${monate} Monate). Verwende die Kinderfassung der Kriterien (bi_get_item mit variante "kinder") und bei der Berechnung alter_monate ${monate}. Kinder werden mit gleichaltrigen Kindern ohne Beeinträchtigung verglichen.` : "Es geht um eine erwachsene Person (Fassung für Erwachsene)."}

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
${monate !== undefined ? `Es geht um ein Kind bzw. eine jugendliche Person (${monate} Monate am Tag der Begutachtung); übergib alter_monate ${monate}.` : ""}

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
];

export const PROMPTS = PROMPTS_ALLE.filter((p) => !p.bi || BI_ENABLED);

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
