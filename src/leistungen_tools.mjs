// Tool-Definition für mögliche Leistungen und Nachteilsausgleiche. Immer eingeschaltet.

import { MERKZEICHEN, hinweise } from "./leistungen.mjs";

export const LEISTUNGEN_INSTRUCTIONS = `Leistungen – leistungshinweise zeigt zu GdB, Merkzeichen und Pflegegrad (optional Alter in Monaten) mögliche Leistungen und Nachteilsausgleiche aus einem kuratierten Katalog: je Eintrag Signal, Leistung, Norm mit Link, typische Stelle, Rang (Vorrang/Nachrang) und nächster Schritt; Landesrecht (Blindengeld, Gehörlosengeld, Rundfunkbeitrag, Parkerleichterungen) nur als Hinweis ohne Normlink.
Keine Beträge, keine Anspruchsprüfung, keine Einkommens- oder Vermögensprüfung, keine Zuständigkeitsentscheidung im Einzelfall; formulieren als „kann in Betracht kommen“, auf Beratung verweisen.`;

const zahl = (beschreibung) => ({ type: ["integer", "string"], description: beschreibung });

export const LEISTUNGEN_TOOLS = [
  {
    name: "leistungshinweise",
    title: "Mögliche Leistungen zu GdB, Merkzeichen und Pflegegrad",
    description:
      "Zeigt aus einem kuratierten Katalog mögliche Leistungen und Nachteilsausgleiche, die bei einem GdB, bestimmten Merkzeichen oder einem Pflegegrad in Betracht kommen können (Steuer, Arbeitsleben, Mobilität, Pflegeversicherung, Schnittstellen zu Eingliederungshilfe, Sozialhilfe und Jugendhilfe). Je Eintrag: Signal (welche Angabe passt), Leistung, Normen mit Link zu gesetze-im-internet.de, typische Stelle, Rang (Vorrang/Nachrang), allgemeine Voraussetzung und nächster Schritt. Landesrechtliche Leistungen (Blindengeld, Gehörlosengeld, Rundfunkbeitrag, Parkerleichterungen) getrennt als Hinweis ohne Normlink. Mindestens eine Angabe aus gdb, merkzeichen oder pflegegrad. Keine Beträge, keine Anspruchsprüfung, keine Einkommens- oder Vermögensprüfung, keine Rechtsberatung.",
    inputSchema: {
      type: "object",
      properties: {
        gdb: zahl("Grad der Behinderung, 0 bis 100"),
        merkzeichen: { type: "array", items: { type: "string" }, description: `Merkzeichen aus ${MERKZEICHEN.join(", ")}, z. B. ["G", "B"]; Schreibweise egal` },
        pflegegrad: zahl("Pflegegrad 1 bis 5"),
        alter_monate: zahl("Optional: Alter in Monaten (0 bis 1560), z. B. für Hinweise zu Kindern und Jugendlichen"),
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (args) => hinweise(args),
  },
];
