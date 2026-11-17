// Tool-Definitionen für die Versorgungsmedizinischen Grundsätze (VersMedV). Standardmäßig eingeschaltet;
// abschalten lässt es sich mit der Umgebungsvariable ICF_MCP_VMG=0.

import * as vmgModule from "./vmg.mjs";

export const VMG_ENABLED = !["0", "false", "nein", "off"].includes(String(process.env.ICF_MCP_VMG ?? "").toLowerCase());

const readOnly = { readOnlyHint: true, openWorldHint: false };

const vmg = VMG_ENABLED ? vmgModule : null;

const kennungProp = {
  type: "string",
  description: 'Kennung der Anlage zu § 2 VersMedV, z. B. "B 3.7" (Neurosen), "A 5d jj" oder "D 1e"; "VMG:" und Schreibweise (b3.7) egal',
};

export const VMG_INSTRUCTIONS = `Versorgungsmedizinische Grundsätze (VersMedV, Anlage zu § 2)${vmg ? `: ${vmg.VMG_VERSION}` : ""}. Amtlicher Wortlaut für GdS/GdB und Hilflosigkeit.
Kennungen: VMG:A = Teil A (gemeinsame Grundsätze), VMG:B = Teil B (GdS-Tabelle, z. B. VMG:B 3.7), VMG:C = Teil C (Merkzeichen), VMG:D = Teil D (Hilflosigkeit u. a.).
GdS-Werte stehen immer mit ihrem Pfad (Überschriften der Zeile) und der Fundstelle; ein Wert ohne diesen Kontext darf nicht zitiert werden.
Teil B nennt typische Werte; Abweichung ist nach Teil A Nr. 1.4 mit Begründung im Einzelfall möglich. Abschnitte ohne amtliche Überschrift tragen eine abgeleitete Bezeichnung (titel_abgeleitet).
Ablauf: vmg_search findet Abschnitte über Wortlaut und Stichwörter (oder leitet über icd="E11.90" Stichwörter ab, nicht amtlich), vmg_get liefert den Abschnitt, vmg_list_structure die Gliederung.`;

export const VMG_TOOLS = !vmg
  ? []
  : [
      {
        name: "vmg_list_structure",
        title: "VersMedV: Gliederung",
        description:
          "Gliederung der Versorgungsmedizinischen Grundsätze (Anlage zu § 2 VersMedV): Teile A–D mit allen Abschnitten. Optional nur der Teilbaum einer Kennung. Abschnitte ohne amtliche Überschrift zeigen eine abgeleitete Bezeichnung.",
        inputSchema: { type: "object", properties: { kennung: { ...kennungProp, description: "Optional: Teilbaum ab dieser Kennung, z. B. \"B 3\" oder \"A\"" } } },
        annotations: readOnly,
        run: vmg.listStructure,
      },
      {
        name: "vmg_get",
        title: "VersMedV: Abschnitt abrufen",
        description:
          "Wortlaut eines Abschnitts der Versorgungsmedizinischen Grundsätze: Absätze, GdS-Zeilen mit Wert und Pfad (Überschriften), Tabellen, Unterabschnitte, Stichwörter und Fundstelle. Bei Teil B mit Hinweis auf die Abweichungsmöglichkeit nach Teil A Nr. 1.4.",
        inputSchema: { type: "object", properties: { kennung: kennungProp }, required: ["kennung"] },
        annotations: readOnly,
        run: vmg.get,
      },
      {
        name: "vmg_search",
        title: "VersMedV durchsuchen",
        description:
          "Sucht in den Versorgungsmedizinischen Grundsätzen (Überschriften, amtliches Stichwortverzeichnis, GdS-Zeilen, Fließtext); mehrere Wörter werden UND-verknüpft, Umlaute egal. Mit icd (ICD-10-GM-Kode) werden passende Stichwörter über ICD-Titel und Alphabet-Begriffe abgeleitet (nicht amtlich, getrennt von den Treffern ausgewiesen). Mindestens query oder icd angeben.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: 'Suchbegriff(e), z. B. "Drogenabhängigkeit" oder "Hilflosigkeit Diabetes"' },
            icd: { type: "string", description: 'ICD-10-GM-Kode, z. B. "E11.90": liefert abgeleitete Stichwörter mit Fundstellen' },
            teil: { type: "string", enum: ["A", "B", "C", "D"], description: "Optional: nur dieser Teil" },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
        annotations: readOnly,
        run: vmg.search,
      },
    ];
