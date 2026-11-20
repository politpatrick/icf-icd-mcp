// MCP-Protokoll (JSON-RPC 2.0) ohne externe Abhängigkeiten.
// Unabhängig vom Transport: handleMessage() wird von stdio- und HTTP-Einstieg genutzt.

import * as icf from "./icf.mjs";
import * as icd from "./icd.mjs";
import { LookupError } from "./text.mjs";
import { VMG_ENABLED, VMG_TOOLS, VMG_INSTRUCTIONS } from "./vmg_tools.mjs";
import { BI_ENABLED, BI_TOOLS, BI_INSTRUCTIONS, withBiForIcf } from "./bi_tools.mjs";
import { FALL_TOOLS, FALL_INSTRUCTIONS } from "./fall_tools.mjs";
import { listPrompts, getPrompt, PromptError } from "./prompts.mjs";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const SERVER_INFO = { name: "icf", title: "ICF, ICD-10-GM, Begutachtungsinstrument und VersMedV (Deutsch)", version: "1.8.0" };

const BASE_INSTRUCTIONS = `Zugriff auf die deutsche ICF (Internationale Klassifikation der Funktionsfähigkeit, Behinderung und Gesundheit, WHO/BfArM 2005)
und die ${icd.ICD_VERSION} (Diagnosen, Systematisches Verzeichnis des BfArM).

ICF – Komponenten: b = Körperfunktionen, s = Körperstrukturen, d = Aktivitäten und Partizipation, e = Umweltfaktoren.
Typischer Ablauf: icf_search findet passende Kategorien zu einer Beschreibung, icf_get_code liefert Definition, Ein-/Ausschlüsse und Unterkategorien,
icf_get_qualifiers erklärt die Beurteilungsmerkmale, icf_interpret_coding prüft und übersetzt eine vollständige Kodierung wie d450.23 oder e310+3.

ICD-10-GM – icd_search findet Diagnosen, icd_get_code liefert Titel, Ein-/Ausschlüsse, Hinweise und Kodierregeln (§295/§301, Alter, Geschlecht),
icd_check_code prüft einen Kode mit Zusatzkennzeichen (G/V/Z/A, R/L/B), icd_list_chapters zeigt Kapitel und Gruppen.
icd_search durchsucht auch das Alphabetische Verzeichnis (Synonyme, Laienbegriffe, Orpha-Kennnummern); maßgeblich bleibt das Systematische Verzeichnis.
Nur endständige Kodes sind (stationär) kodierbar; Stern-Kodes (*) nur zusammen mit einem Kreuz-Kode (†).

Wissensnetz – icd_relations und icf_get_related zeigen alle amtlichen Beziehungen eines Codes, auch Rückverweise und von Oberklassen
geerbte Ausschlüsse. icd_compare und icf_compare grenzen zwei Codes voneinander ab (Hierarchie, Ausschlüsse in beiden Richtungen,
Verbindungsweg). Für Abgrenzungsfragen ("F32 oder F33?", "d450 oder d420?") immer diese Tools nutzen. Alle Beziehungen stammen
aus den amtlichen Daten; es gibt keine amtliche Zuordnung zwischen ICD und ICF.

Codes immer mit icf_get_code bzw. icd_get_code verifizieren, bevor sie in Berichten verwendet werden.
Quellen: ICF und ICD-10-GM © WHO, deutsche Fassung herausgegeben vom BfArM; Quellenangaben unter https://github.com/politpatrick/icf-icd-mcp/blob/main/QUELLEN.md
Eine ICD-Diagnose sagt nichts über die Funktionsfähigkeit aus – ICF-Kategorien müssen im Einzelfall begründet werden.`;

const INSTRUCTIONS = [BASE_INSTRUCTIONS, BI_ENABLED && BI_INSTRUCTIONS, VMG_ENABLED && VMG_INSTRUCTIONS, FALL_INSTRUCTIONS].filter(Boolean).join("\n\n");

const codeParam = {
  type: "object",
  properties: { code: { type: "string", description: 'ICF-Code ohne Beurteilungsmerkmal, z. B. "d450", "b1440", "e310"' } },
  required: ["code"],
};

const readOnly = { readOnlyHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: "icf_search",
    title: "ICF durchsuchen",
    description:
      "Volltextsuche in Titeln, Beschreibungen und Einschlüssen der ICF-Kategorien. Mehrere Wörter werden UND-verknüpft; Umlaute und Groß-/Kleinschreibung sind egal. Auch Code-Präfixe (z. B. \"d45\") funktionieren.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Suchbegriff(e), z. B. "Treppen steigen" oder "Gedächtnis"' },
        component: { type: "string", enum: ["b", "s", "d", "e"], description: "Optional: auf eine Komponente einschränken" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      required: ["query"],
    },
    annotations: readOnly,
    run: icf.search,
  },
  {
    name: "icf_get_code",
    title: "ICF-Code abrufen",
    description:
      "Vollständige Angaben zu einem ICF-Code: Titel, Beschreibung, Definitionen, Ein- und Ausschlüsse (mit aufgelösten Codes), Pfad in der Hierarchie und Unterkategorien.",
    inputSchema: codeParam,
    annotations: readOnly,
    run: icf.getCode,
  },
  {
    name: "icf_list_chapters",
    title: "ICF-Kapitel auflisten",
    description: "Listet die vier ICF-Komponenten (b, s, d, e) mit ihren Kapiteln, oder nur die Kapitel einer Komponente.",
    inputSchema: {
      type: "object",
      properties: { component: { type: "string", enum: ["b", "s", "d", "e"], description: "Optional: nur diese Komponente" } },
    },
    annotations: readOnly,
    run: icf.listChapters,
  },
  {
    name: "icf_get_related",
    title: "Verwandte ICF-Codes",
    description:
      "Beziehungen eines ICF-Codes im amtlichen Wissensnetz: Ober- und Unterkategorien, Geschwister, eigene und von Oberkategorien geerbte Ausschlüsse sowie Rückverweise (welche Kategorien diesen Code ausschließen)." +
      (BI_ENABLED ? " Zusätzlich: zugeordnete Kriterien des Begutachtungsinstruments (kuratiert, nicht amtlich)." : ""),
    inputSchema: codeParam,
    annotations: readOnly,
    run: withBiForIcf(icf.getRelated),
  },
  {
    name: "icf_get_qualifiers",
    title: "Beurteilungsmerkmale",
    description:
      "Erklärt die Beurteilungsmerkmale (Qualifier) für einen ICF-Code: Notation, Bedeutung der Stellen und Werteskala (0–4, 8, 9 bzw. Art/Lokalisation bei s-Codes).",
    inputSchema: codeParam,
    annotations: readOnly,
    run: icf.getQualifiers,
  },
  {
    name: "icf_interpret_coding",
    title: "ICF-Kodierung prüfen",
    description:
      "Prüft und übersetzt eine vollständige ICF-Kodierung mit Beurteilungsmerkmalen in Klartext, z. B. \"d450.23\", \"b1440.2\", \"s7500.213\", \"e310+3\" oder \"e150.2\". Meldet ungültige Codes und Werte.",
    inputSchema: {
      type: "object",
      properties: { coding: { type: "string", description: 'Kodierung, z. B. "d450.23" oder "e310+3"' } },
      required: ["coding"],
    },
    annotations: readOnly,
    run: icf.interpretCoding,
  },
  {
    name: "icd_search",
    title: "ICD-10-GM durchsuchen",
    description:
      "Sucht Diagnosen in der ICD-10-GM nach Titel, Einschlussbegriffen und in rund 89.000 Begriffen des Alphabetischen Verzeichnisses (Synonyme, Laienbegriffe wie \"Zuckerkrankheit\", Kreuz-Stern-Kombinationen, Orpha-Kennnummern; Suche auch mit \"ORPHA:173\"). Mehrere Wörter werden UND-verknüpft; Umlaute, Bindestriche und Groß-/Kleinschreibung sind egal. Auch Kode-Präfixe (z. B. \"F32\") funktionieren. Liefert Kode, vollständigen Titel und ob der Kode endständig (kodierbar) ist, bei Alphabet-Treffern die passenden Alphabet-Texte sowie Verweise.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Suchbegriff(e), z. B. "depressive Episode" oder "Diabetes Typ 2 Fuß"' },
        chapter: { type: "string", description: 'Optional: auf ein Kapitel einschränken, römisch, z. B. "V" für psychische Störungen' },
        codable_only: { type: "boolean", default: false, description: "Nur endständige (kodierbare) Kodes" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      required: ["query"],
    },
    annotations: readOnly,
    run: icd.search,
  },
  {
    name: "icd_get_code",
    title: "ICD-10-GM-Kode abrufen",
    description:
      "Vollständige Angaben zu einem ICD-10-GM-Kode, einer Gruppe (z. B. \"F30-F39\") oder einem Kapitel (z. B. \"V\"): Titel, Hierarchiepfad, Ein- und Ausschlüsse mit verwiesenen Kodes, Hinweise, Definitionen, Unterkodes sowie Kodierregeln (§295 ambulant, §301 stationär, Kreuz/Stern/Ausrufezeichen, Alters- und Geschlechtsbezug).",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: 'ICD-10-GM-Kode, z. B. "F32.1", "E11.90", "F30-F39" oder "V"' } },
      required: ["code"],
    },
    annotations: readOnly,
    run: icd.getCode,
  },
  {
    name: "icd_list_chapters",
    title: "ICD-10-GM-Kapitel auflisten",
    description: "Listet die 22 Kapitel der ICD-10-GM mit Kodebereichen, oder die Gruppen eines Kapitels.",
    inputSchema: {
      type: "object",
      properties: { chapter: { type: "string", description: 'Optional: Kapitel römisch, z. B. "V"' } },
    },
    annotations: readOnly,
    run: icd.listChapters,
  },
  {
    name: "icd_check_code",
    title: "ICD-10-GM-Kode prüfen",
    description:
      "Prüft einen ICD-10-GM-Kode auf Kodierbarkeit: existiert er, ist er endständig, ist er ambulant (§295) bzw. stationär (§301) zugelassen, gelten Kreuz-/Stern-/Ausrufezeichen-Regeln oder Alters-/Geschlechtsgrenzen. Versteht Zusatzkennzeichen für Diagnosesicherheit (G, V, Z, A) und Seite (R, L, B), z. B. \"F32.1 G\" oder \"M17.1 R G\".",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: 'Kode mit optionalen Zusatzkennzeichen, z. B. "F32.1 G"' } },
      required: ["code"],
    },
    annotations: readOnly,
    run: icd.checkCode,
  },
  {
    name: "icd_relations",
    title: "ICD-10-GM-Beziehungen",
    description:
      "Alle amtlichen Beziehungen eines ICD-10-GM-Kodes im Wissensnetz: Ober- und Unterklassen, eigene und von Oberklassen geerbte Ausschlüsse, Rückverweise (bei welchen Kodes dieser Kode als Ausschluss genannt wird, auch über Oberklassen und Bereiche wie J00-J22), Verweise, Kreuz-Stern-Partner (†/*) sowie Kodes, die in Kodierhinweisen, Anmerkungen oder Definitionen genannt werden (z. B. \"zusätzlich U69.80-U69.82 kodieren\") – und wo dieser Kode selbst in Hinweisen genannt wird.",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: 'ICD-10-GM-Kode, Gruppe oder Kapitel, z. B. "F33", "F30-F39"' } },
      required: ["code"],
    },
    annotations: readOnly,
    run: icd.relations,
  },
  {
    name: "icd_compare",
    title: "ICD-10-GM-Kodes abgrenzen",
    description:
      "Grenzt zwei ICD-10-GM-Kodes voneinander ab: Beziehung in der Hierarchie, amtliche Ausschlüsse und Verweise in beiden Richtungen (auch von Oberklassen geerbt), kürzester Verbindungsweg im Wissensnetz sowie Einschlüsse und Definitionen beider Kodes zum Vergleich. Für Fragen wie \"F32.1 oder F33.1?\".",
    inputSchema: {
      type: "object",
      properties: {
        code_a: { type: "string", description: 'Erster Kode, z. B. "F32.1"' },
        code_b: { type: "string", description: 'Zweiter Kode, z. B. "F33.1"' },
      },
      required: ["code_a", "code_b"],
    },
    annotations: readOnly,
    run: icd.compare,
  },
  {
    name: "icf_compare",
    title: "ICF-Codes abgrenzen",
    description:
      "Grenzt zwei ICF-Kategorien voneinander ab: Beziehung in der Hierarchie, amtliche Ausschlüsse in beiden Richtungen (auch von Oberkategorien geerbt), kürzester Verbindungsweg im Wissensnetz sowie Beschreibungen und Einschlüsse beider Kategorien. Für Fragen wie \"d450 Gehen oder d420 Sich verlagern?\".",
    inputSchema: {
      type: "object",
      properties: {
        code_a: { type: "string", description: 'Erste ICF-Kategorie, z. B. "d450"' },
        code_b: { type: "string", description: 'Zweite ICF-Kategorie, z. B. "d420"' },
      },
      required: ["code_a", "code_b"],
    },
    annotations: readOnly,
    run: icf.compare,
  },
  ...(BI_ENABLED ? BI_TOOLS : []),
  ...(VMG_ENABLED ? VMG_TOOLS : []),
  ...FALL_TOOLS,
];

const toolsByName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

function callTool({ name, arguments: args = {} }) {
  const tool = toolsByName[name];
  if (!tool) return { error: { code: -32602, message: `Unbekanntes Tool: ${name}` } };
  try {
    const data = tool.run(args);
    return {
      result: {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: Array.isArray(data) ? { items: data } : data,
      },
    };
  } catch (err) {
    if (!(err instanceof LookupError)) throw err;
    return { result: { content: [{ type: "text", text: err.message }], isError: true } };
  }
}

/** Verarbeitet eine JSON-RPC-Nachricht. Gibt die Antwort zurück oder null bei Notifications. */
export function handleMessage(msg) {
  const { id, method, params = {} } = msg ?? {};
  const isRequest = id !== undefined && id !== null;
  let outcome;

  switch (method) {
    case "initialize": {
      const requested = params.protocolVersion;
      outcome = {
        result: {
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
      break;
    }
    case "ping":
      outcome = { result: {} };
      break;
    case "tools/list":
      outcome = { result: { tools: TOOLS.map(({ run, ...def }) => def) } };
      break;
    case "tools/call":
      outcome = callTool(params);
      break;
    case "prompts/list":
      outcome = { result: listPrompts() };
      break;
    case "prompts/get":
      try {
        outcome = { result: getPrompt(params) };
      } catch (err) {
        if (!(err instanceof PromptError)) throw err;
        outcome = { error: { code: -32602, message: err.message } };
      }
      break;
    default:
      if (!isRequest) return null; // z. B. notifications/initialized
      outcome = { error: { code: -32601, message: `Methode nicht unterstützt: ${method}` } };
  }
  return isRequest ? { jsonrpc: "2.0", id, ...outcome } : null;
}
