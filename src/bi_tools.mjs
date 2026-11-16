// Tool-Definitionen für das Begutachtungsinstrument (SGB XI). Standardmäßig abgeschaltet:
// Aktivieren mit der Umgebungsvariable ICF_MCP_BI=1. So bleibt der öffentliche Endpunkt unverändert,
// bis entschieden ist, ob das BI dauerhaft Teil dieses Servers wird.

export const BI_ENABLED = ["1", "true", "ja", "on"].includes(String(process.env.ICF_MCP_BI ?? "").toLowerCase());

const readOnly = { readOnlyHint: true, openWorldHint: false };

// Laden erst bei Aktivierung, damit der Server ohne data/bi.json startet
const bi = BI_ENABLED ? await import("./bi.mjs") : null;

const codeProp = {
  type: "string",
  description: 'Kennung nach Ziffer des Formulargutachtens, z. B. "BI:4.1.3" (Umsetzen), "4.2" (Modul 2), "F 5.4" oder "KF 4.4.0" (Kinder)',
};
const varianteProp = { type: "string", enum: ["erwachsene", "kinder"], description: "Optional: Texte für Erwachsene oder Kinder (KF-Ziffern)" };

export const BI_INSTRUCTIONS = `Begutachtungsinstrument nach § 15 SGB XI (Pflegebegutachtung) – Wissensnetz aus den Begutachtungs-Richtlinien${bi ? ` (${bi.BI_VERSION})` : ""}.
Kennungen folgen dem Formulargutachten: BI:4.1 bis BI:4.6 = Module 1–6, BI:4.1.3 = Kriterium, BI:1.1 … BI:9 = weitere Felder; KF-Ziffern sind die Kinderfassung.
Kodierung einer Ausprägung: "BI:4.1.3=2" (Stufe 0–3, nicht der Punktwert), Modul 5 als Häufigkeit "BI:4.5.1=3/Tag", Felder mit Optionsschlüssel "BI:5.4=unfall".
Typischer Ablauf: bi_search findet zu einer Beobachtung das passende Kriterium, bi_get_item liefert die verbindliche Definition, Hinweise und
Ausprägungen mit Erläuterung, bi_compare grenzt Kriterien ab (wörtliche Abgrenzungen der BRi), bi_interpret_coding prüft Kodierungen,
bi_calculate berechnet gewichtete Punkte und Pflegegrad nach Anlage 2 zu § 15 SGB XI (auch für Kinder mit Altersvergleich).
Eine amtliche Zuordnung zwischen BI und ICF gibt es nicht. Die Einstufung bleibt eine gutachterliche Entscheidung.`;

export const BI_TOOLS = !bi
  ? []
  : [
      {
        name: "bi_list_structure",
        title: "Begutachtungsinstrument: Gliederung",
        description:
          "Gliederung des Formulargutachtens zur Pflegebegutachtung (SGB XI): Formularkopf, Abschnitte 1–9, Module 1–6 mit Gewichtung und Kriterien. Optional nur der Teilbaum einer Kennung.",
        inputSchema: { type: "object", properties: { code: { ...codeProp, description: "Optional: Teilbaum ab dieser Kennung" } } },
        annotations: readOnly,
        run: bi.listStructure,
      },
      {
        name: "bi_get_item",
        title: "Begutachtungsinstrument: Kriterium oder Feld",
        description:
          "Vollständige Angaben zu einem Kriterium, Modul oder Feld des Begutachtungsinstruments: verbindliche Definition (Fettdruck der BRi), Hinweise, Ausprägungen mit Kodierung, Einzelpunkten und Erläuterung, Altersangaben für Kinder, Abgrenzungen zu anderen Kriterien und Seitenangaben.",
        inputSchema: { type: "object", properties: { code: codeProp, variante: varianteProp }, required: ["code"] },
        annotations: readOnly,
        run: bi.getItem,
      },
      {
        name: "bi_search",
        title: "Begutachtungsinstrument durchsuchen",
        description:
          "Volltextsuche in Titeln, Definitionen, Hinweisen und Ausprägungstexten der Begutachtungs-Richtlinien. Mehrere Wörter werden UND-verknüpft; Umlaute egal. Für Fragen wie \"Wo wird nächtliches Umherirren gewertet?\".",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: 'Suchbegriff(e), z. B. "Kompressionsstrümpfe" oder "Insulin"' },
            nur_kriterien: { type: "boolean", default: false, description: "Nur bewertbare Kriterien" },
            variante: varianteProp,
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          required: ["query"],
        },
        annotations: readOnly,
        run: bi.search,
      },
      {
        name: "bi_related",
        title: "Begutachtungsinstrument: Beziehungen",
        description:
          "Beziehungen einer Kennung im Wissensnetz: Ober-/Unterknoten, Geschwister, Abgrenzungen und Verweise aus dem Richtlinientext (ausgehend und eingehend) sowie Regelkanten (z. B. 4.4.0 ersetzt 4.4.1–4.4.13, Modul 2/3 höherer Wert).",
        inputSchema: { type: "object", properties: { code: codeProp }, required: ["code"] },
        annotations: readOnly,
        run: bi.related,
      },
      {
        name: "bi_compare",
        title: "Begutachtungsinstrument: Kriterien abgrenzen",
        description:
          "Grenzt zwei Kriterien ab, z. B. \"4.1.1 oder 4.6.2?\" oder \"4.3.2 oder 4.3.10?\": Definitionen, wörtliche Abgrenzungen der BRi in beiden Richtungen, gemeinsamer Oberknoten und Verbindungsweg.",
        inputSchema: {
          type: "object",
          properties: { code_a: codeProp, code_b: codeProp },
          required: ["code_a", "code_b"],
        },
        annotations: readOnly,
        run: bi.compare,
      },
      {
        name: "bi_interpret_coding",
        title: "Begutachtungsinstrument: Kodierung prüfen",
        description:
          "Prüft und übersetzt Kodierungen, mehrere durch Semikolon getrennt: \"BI:4.1.3=2; BI:4.3.2=3; BI:4.5.1=3/Tag; BI:5.4=unfall\". Liefert Klartext, Einzelpunkte (Erwachsene) und die Erläuterung der Ausprägung aus der BRi.",
        inputSchema: {
          type: "object",
          properties: { coding: { type: "string", description: "Kodierung(en)" }, variante: varianteProp },
          required: ["coding"],
        },
        annotations: readOnly,
        run: bi.interpretCoding,
      },
      {
        name: "bi_calculate",
        title: "Pflegegrad berechnen",
        description:
          "Berechnet Summen, gewichtete Punkte je Modul, Gesamtpunkte und Pflegegrad nach Anlage 2 zu § 15 SGB XI. Eingabe als Kodierung (\"4.1.1=2; 4.1.2=1; …; 4.5.1=3/Tag\") oder Objekt werte {\"4.1.1\": 2, \"4.5.1\": \"3/Tag\", \"4.1.B\": \"nein\"}. Bei Kindern Alter angeben: dann Altersvergleich (unter 11 Jahren) bzw. Sonderregel bis 18 Monate. Nicht angegebene Kriterien zählen 0.",
        inputSchema: {
          type: "object",
          properties: {
            kodierung: { type: "string", description: "Kodierungen, durch Semikolon getrennt" },
            werte: { type: "object", description: 'Kennung → Wert, z. B. {"4.1.3": 2, "4.5.13": "1/Monat"}', additionalProperties: { type: ["string", "number", "boolean"] } },
            alter_monate: { type: "number", description: "Alter am Tag der Begutachtung in Monaten (nur bei Kindern nötig)" },
            geburtsdatum: { type: "string", description: "Alternativ: Geburtsdatum JJJJ-MM-TT" },
            begutachtungsdatum: { type: "string", description: "Datum der Begutachtung JJJJ-MM-TT (Standard: heute)" },
          },
        },
        annotations: readOnly,
        run: bi.calculate,
      },
      {
        name: "bi_scoring_rules",
        title: "Bewertungssystematik",
        description: "Gewichtung, Punktbereiche je Modul, Regeln für Modul 5, Pflegegrad-Schwellen und Sonderregeln für Kinder (Anlage 2 zu § 15 SGB XI, BRi Kapitel 5.10 und 6.6).",
        inputSchema: { type: "object", properties: {} },
        annotations: readOnly,
        run: bi.getScoringRules,
      },
    ];
