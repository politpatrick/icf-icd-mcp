// ICF-Datenzugriff für den MCP-Server: lädt icf_flat.json und qualifiers.json
// aus ../data und stellt Abfrage-Funktionen für die Tools bereit.

import { readData } from "./data.mjs";
import { RelationGraph } from "./graph.mjs";
import { fold, LookupError } from "./text.mjs";

const codes = readData("icf_flat.json");
const qualifiers = readData("qualifiers.json");

const COMPONENTS = ["b", "s", "d", "e"];

const parentOf = {};
for (const entry of Object.values(codes)) {
  for (const child of entry.children) parentOf[child] = entry.code;
}

// Für die Auflösung von Exklusionen (die nur als Titel vorliegen) auf Codes
const byTitle = {};
for (const entry of Object.values(codes)) {
  (byTitle[fold(entry.preferred)] ??= []).push(entry.code);
}

function normalizeCode(code) {
  return String(code ?? "").trim().toLowerCase();
}

function summary(code) {
  const entry = codes[code];
  return entry ? { code, title: entry.preferred, kind: entry.kind } : { code };
}

function ancestors(code) {
  const chain = [];
  for (let c = parentOf[code]; c; c = parentOf[c]) chain.unshift(summary(c));
  return chain;
}

function componentOf(code) {
  return COMPONENTS.find((c) => code.startsWith(c));
}

function requireCode(raw) {
  const code = normalizeCode(raw);
  if (!codes[code]) {
    const suggestions = Object.keys(codes).filter((c) => c.startsWith(code.slice(0, 4))).slice(0, 10);
    throw new LookupError(
      `ICF-Code "${raw}" nicht gefunden.` +
        (suggestions.length ? ` Ähnliche Codes: ${suggestions.join(", ")}` : "")
    );
  }
  return code;
}

export function listChapters({ component } = {}) {
  const comps = component ? [requireCode(component)] : COMPONENTS;
  return comps.map((c) => ({
    ...summary(c),
    definitions: codes[c].definitions ?? [],
    chapters: codes[c].children.map(summary),
  }));
}

export function getCode({ code: raw }) {
  const code = requireCode(raw);
  const entry = codes[code];
  return {
    code,
    title: entry.preferred,
    kind: entry.kind,
    component: summary(componentOf(code)),
    path: ancestors(code),
    description: entry["coding-hints"] ?? [],
    definitions: entry.definitions ?? [],
    inclusions: entry.inclusions ?? [],
    exclusions: (entry.exclusions ?? []).map(resolveExclusion),
    children: entry.children.map(summary),
  };
}

function resolveExclusion(text) {
  // Exklusionen enden oft mit "(b130)" o. ä. oder entsprechen einem Kategorie-Titel
  const inline = [...text.matchAll(/\b([bsde]\d{1,5}(?:-[bsde]\d{1,5})?)\b/g)].map((m) => m[1]);
  const matched = inline.length ? inline : byTitle[fold(text.replace(/\s*\(.*?\)\s*$/, ""))] ?? [];
  return { text, codes: matched.filter((c) => codes[c]).map(summary) };
}

export function getRelated({ code: raw }) {
  const code = requireCode(raw);
  const parent = parentOf[code];
  return {
    code: summary(code),
    parent: parent ? summary(parent) : null,
    siblings: parent ? codes[parent].children.filter((c) => c !== code).map(summary) : [],
    children: codes[code].children.map(summary),
    exclusions: (codes[code].exclusions ?? []).map(resolveExclusion),
    inherited_exclusions: graph.inherited(code, "ausschluss").map(({ to, text, geerbt_von }) => ({
      text,
      code: summary(to),
      inherited_from: summary(geerbt_von),
    })),
    excluded_by: graph.incoming(code, "ausschluss").map(({ from, text, via, ueber }) => ({
      code: summary(from),
      text,
      via: via === "direkt" ? "direkt" : `über ${ueber}`,
    })),
  };
}

export function search({ query, component, limit = 20 }) {
  const terms = fold(String(query ?? "")).split(/\s+/).filter(Boolean);
  if (!terms.length) throw new LookupError("Suchbegriff fehlt.");
  const comp = component ? normalizeCode(component) : null;
  const results = [];
  for (const entry of Object.values(codes)) {
    if (comp && !entry.code.startsWith(comp)) continue;
    const fields = [
      [fold(entry.preferred), 10],
      [fold((entry["coding-hints"] ?? []).join(" ")), 3],
      [fold((entry.inclusions ?? []).join(" ")), 2],
    ];
    let score = 0;
    let allFound = true;
    for (const term of terms) {
      if (entry.code === term) score += 100;
      else if (entry.code.startsWith(term)) score += 20;
      const hit = fields.reduce((s, [text, w]) => (text.includes(term) ? s + w : s), 0);
      if (!hit && !entry.code.startsWith(term)) allFound = false;
      score += hit;
    }
    if (allFound) {
      score -= entry.code.length * 0.1; // allgemeinere Kategorien leicht bevorzugen
      results.push({ score, entry });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return {
    query,
    total: results.length,
    results: results.slice(0, Math.min(limit, 100)).map(({ entry }) => ({
      ...summary(entry.code),
      snippet: (entry["coding-hints"] ?? [])[0]?.slice(0, 240) ?? "",
    })),
  };
}

function modifierInfo(code) {
  const mod = qualifiers.modifiers[code];
  return {
    name: mod.preferred,
    definitions: mod.definitions,
    values: Object.fromEntries(mod.values.map((v) => [v.value, v.preferred])),
  };
}

// Bedeutung der Beurteilungsmerkmal-Positionen nach ICF-Kodierungskonvention
const POSITIONS = {
  b: [{ label: "Ausmaß der Schädigung", modifier: "Q_Ausmaß_der_Schädigung" }],
  s: [
    { label: "Ausmaß der Schädigung", modifier: "Q_Ausmaß_der_Schädigung-s" },
    { label: "Art der Veränderung", modifier: "Q_Art_oder_Veränderung_in_der_entsprechenden_Körperstruktur" },
    { label: "Lokalisation", modifier: "Q_Anatomische_Lokalisation" },
  ],
  d: [
    { label: "Leistung (Performance, im üblichen Umfeld)", modifier: "Q_Leistungsfähigkeit_und_Leistung" },
    { label: "Leistungsfähigkeit (Capacity, ohne Assistenz)", modifier: "Q_Leistungsfähigkeit_und_Leistung" },
    { label: "Leistungsfähigkeit mit Assistenz", modifier: "Q_Leistungsfähigkeit_und_Leistung" },
    { label: "Leistung ohne Assistenz", modifier: "Q_Leistungsfähigkeit_und_Leistung" },
  ],
  e: [{ label: "Barriere (.) bzw. Förderfaktor (+)", modifier: null }],
};

export function getQualifiers({ code: raw }) {
  const code = requireCode(raw);
  const comp = componentOf(code);
  return {
    code: summary(code),
    notation:
      {
        b: "b-Code.X (z. B. b1440.2)",
        s: "s-Code.XYZ (z. B. s7500.213: Ausmaß, Art, Lokalisation)",
        d: "d-Code.PC (z. B. d450.23: 1. Stelle Leistung, 2. Stelle Leistungsfähigkeit)",
        e: "e-Code.X für Barrieren, e-Code+X für Förderfaktoren (z. B. e310+3, e150.2)",
      }[comp],
    positions: POSITIONS[comp].map((p) => p.label),
    qualifiers: qualifiers.components[comp].map(modifierInfo),
  };
}

export function interpretCoding({ coding }) {
  const match = String(coding ?? "").trim().toLowerCase().match(/^([bsde][\d]*)(?:([.+])([\d]*))?$/);
  if (!match) {
    throw new LookupError(`"${coding}" ist keine gültige ICF-Kodierung (Beispiele: d450.23, b1440.2, e310+3, s7500.213).`);
  }
  const [, rawCode, sep, digits = ""] = match;
  const code = requireCode(rawCode);
  const comp = componentOf(code);
  const result = { coding, ...summary(code), qualifiers: [], warnings: [] };

  if (!sep) {
    result.warnings.push("Kein Beurteilungsmerkmal angegeben – ohne Beurteilungsmerkmal hat ein ICF-Code keine Aussagekraft.");
    return result;
  }
  if (sep === "+" && comp !== "e") {
    result.warnings.push('"+" ist nur bei Umweltfaktoren (e) für Förderfaktoren zulässig.');
  }

  if (comp === "e") {
    const mod = modifierInfo(sep === "+" ? "Q_Förderfaktoren" : "Q_Barrieren");
    const value = digits[0];
    result.qualifiers.push({ position: mod.name, value, meaning: mod.values[value] ?? "ungültiger Wert" });
    if (digits.length > 1) result.warnings.push("Umweltfaktoren haben nur ein Beurteilungsmerkmal.");
    return result;
  }

  const positions = POSITIONS[comp];
  [...digits].forEach((value, i) => {
    const pos = positions[i];
    if (!pos) {
      result.warnings.push(`Überzählige Stelle "${value}" – ${comp}-Codes haben höchstens ${positions.length} Beurteilungsmerkmal(e).`);
      return;
    }
    const meaning = modifierInfo(pos.modifier).values[value];
    result.qualifiers.push({ position: pos.label, value, meaning: meaning ?? "ungültiger Wert" });
    if (!meaning) result.warnings.push(`Wert "${value}" ist für "${pos.label}" nicht definiert.`);
  });
  if (!digits) result.warnings.push("Nach dem Trennzeichen fehlt das Beurteilungsmerkmal.");
  return result;
}

// ---------------------------------------------------------------------------
// Wissensnetz: Hierarchie und Ausschlüsse aus den amtlichen Daten

export const graph = new RelationGraph({
  parentOf: (code) => parentOf[code],
  childrenOf: (code) => codes[code]?.children ?? [],
  has: (code) => code in codes,
  roots: COMPONENTS,
});

for (const entry of Object.values(codes)) {
  for (const text of entry.exclusions ?? []) {
    for (const target of resolveExclusion(text).codes) graph.addEdge(entry.code, target.code, "ausschluss", text);
  }
}

export function compare({ code_a, code_b }) {
  const a = requireCode(code_a);
  const b = requireCode(code_b);
  const common = graph.commonAncestor(a, b);
  const between = (from, to) =>
    graph.edgesBetween(from, to, "ausschluss").map(({ text, geerbt_von, via, ueber }) => ({
      text,
      ...(geerbt_von ? { geerbt_von: summary(geerbt_von) } : {}),
      trifft: via === "direkt" ? to : `Oberklasse ${ueber}`,
    }));
  const fromA = between(a, b);
  const fromB = between(b, a);
  const steps = graph.path(a, b);
  const features = (code) => ({
    beschreibung: codes[code]["coding-hints"] ?? [],
    einschluesse: codes[code].inclusions ?? [],
  });
  return {
    a: summary(a),
    b: summary(b),
    hierarchie:
      a === b ? "gleicher Code"
      : common === a ? `${a} ist Oberkategorie von ${b}`
      : common === b ? `${b} ist Oberkategorie von ${a}`
      : common ? { gemeinsame_oberkategorie: summary(common), geschwister: parentOf[a] === parentOf[b] }
      : "verschiedene Komponenten",
    [`${a}_schliesst_aus`]: fromA,
    [`${b}_schliesst_aus`]: fromB,
    abgrenzung: fromA.length || fromB.length
      ? "Es gibt einen amtlichen Ausschluss: Der genannte Inhalt wird mit der jeweils anderen Kategorie kodiert."
      : "Kein amtlicher Ausschluss zwischen den Kategorien (auch nicht über Oberkategorien).",
    pfad: steps
      ? steps.map((s) => ({ ...s, von: summary(s.von), nach: summary(s.nach) }))
      : "Kein Weg über amtliche Beziehungen (höchstens 8 Schritte).",
    merkmale: { [a]: features(a), [b]: features(b) },
  };
}
