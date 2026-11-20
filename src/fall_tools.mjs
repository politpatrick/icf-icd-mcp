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
];
