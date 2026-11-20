// Tool-Definitionen für das Fallprofil. Immer eingeschaltet; nutzt BI und VersMedV nur, wenn diese aktiv sind.

import * as fall from "./fall.mjs";

const readOnly = { readOnlyHint: true, openWorldHint: false };

export const FALL_INSTRUCTIONS = `Fallprofil – Austauschformat für einen Fall nach dem biopsychosozialen Modell der ICF (ICD, ICF b/s/d/e, personbezogene Faktoren, BI, VersMedV, Zusammenhänge, Ziele, Verfahren).
Ablauf: fall_schema (Format und Beispiel) → Profil aus den Angaben der Person aufbauen, mit Begründung, Beleg und O-Ton → fall_pruefen (Kodes, Lücken, Lebensbereiche nach § 118 SGB IX) → bei einer neuen Fassung fall_vergleichen.
Immer ein Pseudonym statt des Namens verwenden, keine Anschriften oder Nummern. Das Profil bleibt beim Nutzer und wird nicht gespeichert.
Das Fallprofil hilft antragsberechtigten Personen, ihre Situation zu ordnen; es ist keine Rechtsberatung und bewertet den Fall nicht.`;

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
  {
    name: "fall_vergleichen",
    title: "Zwei Fassungen eines Fallprofils vergleichen",
    description:
      "Vergleicht zwei Fassungen eines Fallprofils (z. B. vor einem Jahr und heute): neue, weggefallene und veränderte Einträge (Beurteilungsmerkmal, BI-Stufe, Diagnosesicherheit, GdB, Status, Dauer), dazu Zusammenhänge, Ziele und Verfahren, angegebene Einzel-GdB und – bei vollständigen Angaben – die Pflegepunkte je Herkunft. Die Zuordnung erfolgt über die Kodes, nicht über die Ids. Wertet die Veränderung nicht.",
    inputSchema: {
      type: "object",
      properties: {
        alt: { type: ["object", "string"], description: "Frühere Fassung des Fallprofils" },
        neu: { type: ["object", "string"], description: "Neuere Fassung des Fallprofils" },
      },
      required: ["alt", "neu"],
    },
    annotations: readOnly,
    run: (args) => fall.vergleichen(args),
  },
];
