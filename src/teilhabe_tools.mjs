// Tool-Definition für die Orientierung Eingliederungshilfe/Pflege. Nur bei eingeschaltetem BI-Modul.

import { BI_ENABLED } from "./bi_tools.mjs";
import { abgrenzung } from "./teilhabe.mjs";

export const TEILHABE_INSTRUCTIONS = `Teilhabe – abgrenzung_egh_pflege zeigt je ICF-d-Kategorie den Lebensbereich nach § 118 SGB IX und eine Orientierung: ueberschneidung (das Begutachtungsinstrument erfasst den Bereich; Pflege und Eingliederungshilfe können nebeneinander in Betracht kommen) oder teilhabe (im BI nicht erfasst; Leistungen zur Teilhabe). Keine Zuständigkeitsentscheidung; Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI).
Geführte Abläufe als Prompts: teilhabebedarf_erfassen und bedarfsfeststellung_verstehen.`;

export const TEILHABE_TOOLS = !BI_ENABLED
  ? []
  : [
      {
        name: "abgrenzung_egh_pflege",
        title: "Teilhabe oder Pflege? Orientierung je ICF-d-Kategorie",
        description:
          "Zeigt zu ICF-Kategorien aus Aktivitäten und Teilhabe (d1–d9, auch mit Beurteilungsmerkmal wie d510.3) den Lebensbereich nach § 118 SGB IX und eine Orientierung: ueberschneidung, wenn das Begutachtungsinstrument der Pflegeversicherung den Bereich erfasst (mit den zugeordneten BI-Kriterien und ob sie in den Pflegegrad eingehen), sonst teilhabe (Leistungen zur Teilhabe, mit Hinweis auf die Leistungsgruppe). Die Zuordnung ist kuratiert (bi_icf_mapping), nicht amtlich. Keine Zuständigkeits- oder Anspruchsprüfung; Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI).",
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
