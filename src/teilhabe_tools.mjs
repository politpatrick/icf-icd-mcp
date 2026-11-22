// Tool-Definition für die Orientierung Eingliederungshilfe/Pflege. Nur bei eingeschaltetem BI-Modul.

import { BI_ENABLED } from "./bi_tools.mjs";
import { abgrenzung } from "./teilhabe.mjs";

export const TEILHABE_PROMPTS_INSTRUCTIONS = "Teilhabe – geführte Abläufe als Prompts: teilhabebedarf_erfassen und bedarfsfeststellung_verstehen.";

export const TEILHABE_INSTRUCTIONS = `abgrenzung_egh_pflege zeigt je ICF-d-Kategorie den Lebensbereich nach § 118 SGB IX und eine Orientierung: ueberschneidung (nach der kuratierten Zuordnung ist dem Bereich ein BI-Kriterium zugeordnet; Pflege und Eingliederungshilfe können nebeneinander in Betracht kommen) oder teilhabe (kein BI-Kriterium zugeordnet; Leistungen zur Teilhabe). Keine Zuständigkeitsentscheidung; Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI).`;

export const TEILHABE_TOOLS = !BI_ENABLED
  ? []
  : [
      {
        name: "abgrenzung_egh_pflege",
        title: "Teilhabe oder Pflege? Orientierung je ICF-d-Kategorie",
        description:
          "Zeigt zu ICF-Kategorien aus Aktivitäten und Teilhabe (d1–d9, auch mit Beurteilungsmerkmal wie d510.3) den Lebensbereich nach § 118 SGB IX und eine Orientierung: ueberschneidung, wenn dem Bereich nach der kuratierten Zuordnung ein Kriterium des Begutachtungsinstruments zugeordnet ist (mit den BI-Kriterien, ob sie in den Pflegegrad eingehen, Kinderkriterien und Sonderregeln), sonst teilhabe (Leistungen zur Teilhabe, mit Hinweis auf die Leistungsgruppe). Die Zuordnung ist kuratiert (bi_icf_mapping), nicht amtlich. Keine Zuständigkeits- oder Anspruchsprüfung; Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI).",
        inputSchema: {
          type: "object",
          properties: {
            codes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100, description: 'ICF-d-Kodes, z. B. ["d510.3", "d920", "d845"]' },
          },
          required: ["codes"],
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
        run: (args) => abgrenzung(args),
      },
    ];
