// Tool-Definition für allgemeine Verfahrensinformationen. Immer eingeschaltet.

import { THEMEN, info } from "./verfahren.mjs";

export const VERFAHREN_INSTRUCTIONS = `Verfahren – verfahren_info erklärt allgemein Widerspruch, Überprüfungsantrag (§ 44 SGB X), Neufeststellungs- bzw. Höherstufungsantrag (§ 48 SGB X), Akteneinsicht (§ 25 SGB X), Untätigkeitsklage (§ 88 SGG), Zuständigkeitsklärung (§ 14 SGB IX) und Bekanntgabe (§ 37 SGB X) mit wörtlichen Normauszügen.
Keine Rechtsberatung: keine persönliche Fristberechnung (Frist laut Rechtsbehelfsbelehrung des Bescheids), keine Empfehlung, welcher Weg im Einzelfall passt; auf unabhängige Beratung verweisen.
Geführter Ablauf als Prompt: eigene_darstellung_vorbereiten.`;

export const VERFAHREN_TOOLS = [
  {
    name: "verfahren_info",
    title: "Verfahrenswege allgemein erklärt",
    description:
      "Erklärt allgemein und in einfacher Sprache Verfahrenswege im Sozialrecht: Widerspruch, Überprüfungsantrag (§ 44 SGB X), Neufeststellungs- bzw. Höherstufungsantrag (§ 48 SGB X), Akteneinsicht (§ 25 SGB X), Untätigkeitsklage (§ 88 SGG), Zuständigkeitsklärung bei Teilhabeleistungen (§ 14 SGB IX) und Bekanntgabe (§ 37 SGB X). Je Thema: Erklärung (kuratiert), Normen mit Link und wörtlichem Auszug (amtlich), was man allgemein braucht, Besonderheiten (z. B. VwGO in der Jugendhilfe), Beratungsstellen. Ohne Argument eine Übersicht. Zur Frist nur der Verweis auf die Rechtsbehelfsbelehrung des Bescheids; keine Fristberechnung, keine Empfehlung im Einzelfall, keine Rechtsberatung.",
    inputSchema: {
      type: "object",
      properties: { thema: { type: "string", enum: THEMEN.map((t) => t.id), description: "Optional: ein Thema; ohne Angabe eine Übersicht" } },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (args) => info(args),
  },
];
