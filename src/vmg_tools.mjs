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
Kennungen: VMG:A = Teil A (gemeinsame Grundsätze), VMG:B = Teil B (GdS-Tabelle, z. B. VMG:B 3.7), VMG:C = Teil C (Begutachtung im Sozialen Entschädigungsrecht), VMG:D = Teil D (Merkzeichen); Hilflosigkeit steht in Teil A Nr. 4 und 5.
GdS-Werte stehen immer mit ihrem Pfad (Überschriften der Zeile) und der Fundstelle; ein Wert ohne diesen Kontext darf nicht zitiert werden.
Teil B nennt typische Werte; Abweichung ist nach Teil A Nr. 1.4 mit Begründung im Einzelfall möglich. Abschnitte ohne amtliche Überschrift tragen eine abgeleitete Bezeichnung (titel_abgeleitet).
Der GdB bleibt eine gutachterliche Entscheidung; die Tools liefern Wortlaut und Fundstellen, keine Einstufung.
vmg_gesamt_gdb ist eine Prüfhilfe zu Teil A Nr. 3 (zeigt Regeln, Funktionssysteme und Markierungen, bildet keinen Gesamt-GdB); vmg_merkzeichen nennt die Fundstellen der Merkzeichen (G, aG, B, H, Bl, Gl, RF, TBl).
Ablauf: vmg_search findet Abschnitte über Wortlaut und Stichwörter (oder leitet über icd="E11.90" Stichwörter ab, nicht amtlich), vmg_get liefert den Abschnitt, vmg_list_structure die Gliederung.
Zeilenkennungen wie VMG:B 3.7 Z2 bezeichnen eine GdS-Zeile (vmg_get zeigt sie); vmg_spanne_pruefen prüft einen Einzel-GdB gegen die Spanne dieser Zeile, ohne Wertung.
Geführte Abläufe als Prompts: gdb_antrag_vorbereiten und gdb_bescheid_verstehen.`;

export const VMG_TOOLS = !vmg
  ? []
  : [
      {
        name: "vmg_list_structure",
        title: "VersMedV: Gliederung",
        description:
          "Gliederung der Versorgungsmedizinischen Grundsätze (Anlage zu § 2 VersMedV): Teile A–D. Standardmäßig Teile mit den obersten Nummern (tiefe 1); mit kennung die direkten Unterabschnitte; mit tiefe mehr Ebenen, tiefe 0 = vollständig (sehr umfangreich). Gekappte Äste zeigen weitere_unterabschnitte. Abschnitte ohne amtliche Überschrift zeigen eine abgeleitete Bezeichnung.",
        inputSchema: {
          type: "object",
          properties: {
            kennung: { ...kennungProp, description: "Optional: Teilbaum ab dieser Kennung, z. B. \"B 18\" oder \"A\"" },
            tiefe: { type: "integer", minimum: 0, default: 1, description: "Anzahl Ebenen unter dem Ausgangsknoten (Standard 1); 0 = vollständig" },
          },
        },
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
          "Sucht in den Versorgungsmedizinischen Grundsätzen (Überschriften, Stichwortverzeichnis der BMAS-Broschüre K710 (redaktionelle Beigabe, nicht Teil der Verordnung), GdS-Zeilen, Fließtext); mehrere Wörter werden UND-verknüpft, Umlaute egal. Mit icd (ICD-10-GM-Kode) werden passende Stichwörter über ICD-Titel und Alphabet-Begriffe abgeleitet (nicht amtlich, getrennt von den Treffern ausgewiesen). Mindestens query oder icd angeben.",
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
      {
        name: "vmg_gesamt_gdb",
        title: "VersMedV: Prüfhilfe Gesamt-GdB",
        description:
          "Prüfhilfe zur Bildung des Gesamt-GdB nach Teil A Nr. 3 VersMedV; es wird kein Gesamt-GdB berechnet. Nimmt Einzel-GdB (je bezeichnung, gdb, optional kennung aus Teil B und funktionssystem) und liefert den höchsten Einzel-GdB als Ausgangswert, das Funktionssystem je Eintrag, Paare im selben bzw. möglicherweise selben Funktionssystem, Markierungen (z. B. leichte Beeinträchtigungen nach A 3.5) und den Wortlaut von A 3.1 bis 3.5. Die Zuordnung innerhalb von Teil B Nr. 18 ist verwaltungsüblich, nicht amtlich.",
        inputSchema: {
          type: "object",
          properties: {
            einzel: {
              type: "array",
              minItems: 1,
              description: "Einzel-GdB der festgestellten Funktionsbeeinträchtigungen",
              items: {
                type: "object",
                properties: {
                  bezeichnung: { type: "string", description: "Bezeichnung der Funktionsbeeinträchtigung" },
                  gdb: { type: "integer", minimum: 10, maximum: 100, multipleOf: 10, description: "Einzel-GdB in Zehnerschritten" },
                  kennung: { ...kennungProp, description: 'Optional: Kennung in Teil B, z. B. "B 3.7"; daraus wird das Funktionssystem abgeleitet' },
                  funktionssystem: { type: "string", description: "Optional: Funktionssystem, überschreibt die Ableitung aus der Kennung" },
                },
                required: ["bezeichnung", "gdb"],
              },
            },
          },
          required: ["einzel"],
        },
        annotations: readOnly,
        run: vmg.gesamtGdb,
      },
      {
        name: "vmg_merkzeichen",
        title: "VersMedV: Merkzeichen",
        description:
          "Fundstellen der Merkzeichen G, aG, B, H, Bl, Gl, RF und TBl: VersMedV-Abschnitte mit Wortlaut bzw. bei aG, RF und TBl die Norm außerhalb der VersMedV. Ohne Angabe alle acht Merkzeichen; die Schreibweise (g, AG, tbl) ist egal.",
        inputSchema: { type: "object", properties: { merkzeichen: { type: "string", description: "Optional: G, aG, B, H, Bl, Gl, RF oder TBl" } } },
        annotations: readOnly,
        run: vmg.merkzeichen,
      },
      {
        name: "vmg_spanne_pruefen",
        title: "VersMedV: Einzel-GdB gegen eine GdS-Zeile prüfen",
        description:
          "Prüft, ob ein Einzel-GdB bzw. GdS in der Spanne einer Zeile der GdS-Tabelle (Teil B) liegt: innerhalb, unterhalb, oberhalb oder nicht bestimmbar. Liefert Zeilentext, Pfad (Überschriften), Fundstelle, Spanne und den Hinweis auf Teil A Nr. 1.4. Zeilenkennungen wie \"B 3.7 Z2\" zeigt vmg_get. Bewertet nicht, ob die Zeile passt oder ein Bescheid richtig ist.",
        inputSchema: {
          type: "object",
          properties: {
            kennung: { type: "string", description: 'Zeilenkennung: Abschnitt + Z + Nummer der GdS-Zeile, z. B. "B 3.7 Z2"' },
            gdb: { type: "integer", minimum: 0, maximum: 100, description: "Einzel-GdB bzw. GdS, z. B. 40" },
          },
          required: ["kennung", "gdb"],
        },
        annotations: readOnly,
        run: vmg.spannePruefen,
      },
    ];
