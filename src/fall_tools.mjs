// Tool-Definitionen für das Fallprofil. Immer eingeschaltet; nutzt BI und VersMedV nur, wenn diese aktiv sind.

import * as fall from "./fall.mjs";

const readOnly = { readOnlyHint: true, openWorldHint: false };

export const FALL_INSTRUCTIONS = "";

export const FALL_TOOLS = [
  {
    name: "fall_schema",
    title: "Fallprofil: Format und Beispiel",
    description:
      "Liefert das Austauschformat Fallprofil (Version 1) als JSON-Schema, eine kurze Feldbeschreibung und ein erfundenes Beispielprofil. Das Fallprofil bündelt ICD-, ICF-, BI- und VersMedV-Einträge eines Falls mit Begründungen, Belegverweisen, Zusammenhängen, Zielen und Verfahrensangaben. Pseudonym statt Klarname; keine Rechtsberatung.",
    inputSchema: { type: "object", properties: {} },
    annotations: readOnly,
    run: () => fall.schema(),
  },
  {
    name: "fall_pruefen",
    title: "Fallprofil prüfen",
    description:
      "Prüft ein Fallprofil in einem Durchgang: Form, alle Kodes (ICD, ICF, BI, VersMedV, Merkzeichen) mit Klartext, Zusammenhänge, Hinweise auf Lücken (z. B. Bedarf ohne verknüpfte Ursache, Barriere ohne Bezug, doppelte Einträge), Zuordnung der d-Einträge zu den neun Lebensbereichen nach § 118 SGB IX, kuratierte Querverweise ICF ↔ BI und – nur wenn alle Kriterien angegeben sind – eine Pflegegrad-Orientierung je Herkunft. Bewertet den Fall nicht und ist keine Rechtsberatung. Das Profil wird nicht gespeichert.",
    inputSchema: {
      type: "object",
      properties: { profil: { type: ["object", "string"], description: "Fallprofil als Objekt oder JSON-Text (Format siehe fall_schema)" } },
      required: ["profil"],
    },
    annotations: readOnly,
    run: (args) => fall.pruefen(args),
  },
];
