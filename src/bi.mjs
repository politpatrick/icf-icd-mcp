// Begutachtungsinstrument (BI) nach § 15 SGB XI: Wissensnetz aus den Begutachtungs-Richtlinien (BRi)
// und Bewertungssystematik (Anlage 2 zu § 15 SGB XI). Lädt data/bi.json.
//
// Kennungen: "BI:<Formularziffer>", z. B. BI:4.1.3 (Kriterium Umsetzen), BI:4.1 (Modul 1), BI:5.4 (Feld).
// Kodierung einer Ausprägung: "BI:4.1.3=2". Der Wert ist die Stufe der Skala (0–3), nicht der Punktwert.
// Modul 5: Häufigkeit, z. B. "BI:4.5.1=3/Tag", "BI:4.5.13=2/Monat", "BI:4.5.8=entfällt".
// Formularfelder: Schlüssel der Option, z. B. "BI:5.4=unfall".

import { readData } from "./data.mjs";
import { RelationGraph } from "./graph.mjs";
import { fold, LookupError } from "./text.mjs";

const data = readData("bi.json");
const nodes = data.nodes;
export const BI_VERSION = `${data.meta.kurz} (gültig ab ${data.meta.gueltig_ab.split("-").reverse().join(".")})`;

const VARIANTS = ["erwachsene", "kinder"];
const ADULT_FROM_MONTHS = data.pflegegrade.kinder_unter_11.ab_monaten_erwachsenensystematik; // 132
const INFANT_BELOW_MONTHS = 18;

const parentOf = {};
for (const n of Object.values(nodes)) for (const c of n.children ?? []) parentOf[c] = n.id;

export const graph = new RelationGraph({
  parentOf: (c) => parentOf[c],
  childrenOf: (c) => nodes[c]?.children ?? [],
  has: (c) => c in nodes,
  roots: ["BI"],
});
for (const e of data.edges) graph.addEdge(e.from, e.to, e.type, e.text);
const edgeMeta = new Map(data.edges.map((e) => [`${e.from}|${e.to}|${e.type}|${e.text}`, e]));
const meta = (e) => edgeMeta.get(`${e.from}|${e.to}|${e.type}|${e.text}`) ?? e;

const round4 = (x) => Math.round(x * 10000) / 10000;

// ---------------------------------------------------------------------------
// Kennungen
// ---------------------------------------------------------------------------

/** "BI:4.1.3", "bi 4.1.3", "F 4.1.3", "KF 4.1.3", "4.1.3" → { id, variante } */
function parseCode(raw) {
  let s = String(raw ?? "").trim();
  let variante;
  const prefix = s.match(/^(?:BI\s*:?\s*)?(KF|F)\s*(?=\d)/i);
  if (prefix) {
    variante = prefix[1].toUpperCase() === "KF" ? "kinder" : "erwachsene";
    s = s.slice(prefix[0].length);
  }
  s = s.replace(/^BI\s*:?\s*/i, "").replace(/\s+/g, "");
  // Groß-/Kleinschreibung bei Buchstaben-Ziffern (4.1.B, 4.5.K, K.1, 1.2.R) vereinheitlichen
  s = s.replace(/[a-z]/g, (c) => c.toUpperCase());
  const id = s ? `BI:${s}` : "BI";
  return { id, variante };
}

function requireNode(raw) {
  if (String(raw ?? "").trim() === "") {
    throw new LookupError("BI-Kennung fehlt, z. B. BI:4.1.3 (Umsetzen), BI:4.2 (Modul 2) oder BI:5.4.");
  }
  const { id, variante } = parseCode(raw);
  if (!nodes[id]) {
    const key = id.slice(3);
    const suggestions = Object.keys(nodes).filter((c) => c.slice(3).startsWith(key.slice(0, 3))).slice(0, 10);
    throw new LookupError(
      `BI-Kennung "${raw}" nicht gefunden. Kennungen folgen den Ziffern des Formulargutachtens, z. B. BI:4.1.3 (Umsetzen), BI:4.2 (Modul 2) oder BI:5.4.` +
        (suggestions.length ? ` Ähnliche: ${suggestions.join(", ")}` : "")
    );
  }
  return { id, variante };
}

function formularZiffer(node) {
  const nr = node.id.slice(3);
  if (!nr || nr.startsWith("K")) return null;
  const out = {};
  if (node.nur !== "kinder") out.erwachsene = `F ${nr}`;
  if (node.nur !== "erwachsene") out.kinder = `KF ${nr}`;
  return out;
}

function summary(id) {
  const n = nodes[id];
  return n ? { code: id, titel: n.titel, art: n.art } : { code: id };
}

function path(id) {
  const chain = [];
  for (let c = parentOf[id]; c; c = parentOf[c]) chain.unshift(summary(c));
  return chain;
}

function scaleOf(node) {
  return node.skala ? data.skalen[node.skala] : null;
}

/** Einzelpunkte einer Stufe bei Erwachsenen (Faktor bei 4.4.8–4.4.10, Punkte bei M3 und 4.4.13). */
function pointsFor(node, stufe) {
  const scale = scaleOf(node);
  const level = scale?.stufen?.find((s) => s.wert === stufe);
  if (!level) return null;
  if (level.punkte !== undefined) return level.punkte;
  if (node.punktrelevant === false || node.modul === undefined) return null;
  return stufe * (node.faktor ?? 1);
}

function texteFor(node, variante) {
  const t = node.texte ?? {};
  if (variante) return t[variante] ?? null;
  return t.erwachsene ?? t.kinder ?? null;
}

function auspraegungen(node, variante) {
  const scale = scaleOf(node);
  if (!scale?.stufen) return undefined;
  const texte = texteFor(node, variante) ?? {};
  return scale.stufen.map((s) => {
    const entry = { kodierung: `${node.id}=${s.wert}`, wert: s.wert, label: s.label };
    const p = pointsFor(node, s.wert);
    if (p !== null && node.punktrelevant !== false) entry.einzelpunkte = p;
    const text = texte.auspraegungen?.[String(s.wert)];
    if (text) entry.erlaeuterung = text;
    return entry;
  });
}

function relationsOf(id) {
  const out = graph.out(id).map(meta).filter((e) => !e.to.startsWith("ICF:"));
  const inc = graph.incoming(id).filter((e) => e.via === "direkt").map(meta);
  const fmt = (e, other) => ({
    typ: e.type,
    code: other,
    titel: nodes[other]?.titel,
    ...(e.text ? { text: e.text } : {}),
    ...(e.variante ? { variante: e.variante } : {}),
    ...(e.seite ? { seite: e.seite } : {}),
    quelle: e.quelle,
  });
  const dedupe = (list) => {
    const seen = new Set();
    return list.filter((x) => {
      const k = `${x.typ}|${x.code}|${x.text}`;
      return seen.has(k) ? false : seen.add(k);
    });
  };
  return {
    ausgehend: dedupe(out.map((e) => fmt(e, e.to))),
    eingehend: dedupe(inc.map((e) => fmt(e, e.from))),
  };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function listStructure({ code } = {}) {
  const root = code ? requireNode(code).id : "BI";
  const walk = (id, depth) => {
    const n = nodes[id];
    const entry = { code: id, titel: n.titel, art: n.art };
    if (n.gewichtung_prozent) entry.gewichtung_prozent = n.gewichtung_prozent;
    if (n.nur) entry.nur = n.nur;
    if (n.children?.length && depth > 0) entry.children = n.children.map((c) => walk(c, depth - 1));
    else if (n.children?.length) entry.anzahl_unterknoten = n.children.length;
    return entry;
  };
  return {
    instrument: data.meta.instrument,
    richtlinie: BI_VERSION,
    hinweis: data.formular.hinweis,
    struktur: walk(root, code ? 2 : 3),
  };
}

export function getItem({ code, variante }) {
  const parsed = requireNode(code);
  const node = nodes[parsed.id];
  const v = variante ?? parsed.variante;
  const out = {
    code: node.id,
    titel: node.titel,
    ...(node.titel_kinder ? { titel_kinder: node.titel_kinder } : {}),
    art: node.art,
    formular_ziffer: formularZiffer(node),
    pfad: path(node.id),
  };
  if (node.modul) out.modul = node.modul;
  if (node.nur) out.nur = node.nur;
  if (node.punktrelevant === false) out.punktrelevant = false;
  if (node.gewichtung_prozent) {
    out.gewichtung_prozent = node.gewichtung_prozent;
    out.schwellen = node.schwellen;
  }
  for (const k of ["hinweis_gewichtung", "besonderheit", "sonderregel", "zusatz", "hinweis_kinder", "gruppe", "punkte_je", "punkte_ja", "faktor"]) {
    if (node[k] !== undefined) out[k] = node[k];
  }
  const variants = v ? [v] : VARIANTS.filter((x) => node.texte?.[x]);
  const texte = {};
  for (const x of variants) {
    const t = node.texte?.[x];
    if (!t) continue;
    texte[x] = {
      ...(t.definition ? { definition: t.definition, definition_verbindlich: node.art === "kriterium" && node.modul !== 3 } : {}),
      ...(t.hinweis_alter ? { hinweis_alter: t.hinweis_alter } : {}),
      ...(t.hinweise ? { hinweise: t.hinweise } : {}),
      seite: t.seite,
    };
  }
  if (Object.keys(texte).length) out.texte = texte;
  const scale = scaleOf(node);
  if (scale) {
    out.skala = { name: node.skala, titel: scale.titel, ...(scale.notation ? { notation: scale.notation } : {}), ...(scale.regel ? { regel: scale.regel } : {}) };
    const a = auspraegungen(node, v ?? (node.nur === "kinder" ? "kinder" : "erwachsene"));
    if (a) out.auspraegungen = a;
  }
  if (node.optionen) out.optionen = node.optionen.map((o) => ({ kodierung: `${node.id}=${o.wert}`, ...o }));
  if (node.kinder) out.kinder = node.kinder;
  if (node.children?.length) out.unterknoten = node.children.map(summary);
  const rel = relationsOf(node.id);
  if (rel.ausgehend.length || rel.eingehend.length) out.beziehungen = rel;
  const icfMap = icfOf(node.id);
  if (icfMap.length) {
    out.icf_zuordnung = icfMap;
    out.icf_hinweis = ICF_HINWEIS;
  }
  if (node.abschnitte) out.richtlinien_abschnitte = node.abschnitte.map((k) => ({ kapitel: k, titel: data.abschnitte[k].titel, seite: data.abschnitte[k].seite }));
  out.quelle = { richtlinie: BI_VERSION, ...node.quelle };
  return out;
}

export function search({ query, limit = 20, nur_kriterien = false, variante }) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) throw new LookupError("Leere Suchanfrage.");
  const hits = [];
  for (const node of Object.values(nodes)) {
    if (node.id === "BI") continue;
    if (nur_kriterien && node.art !== "kriterium") continue;
    if (variante && node.nur && node.nur !== variante) continue;
    const fields = [
      [3, node.titel + " " + (node.titel_kinder ?? "") + " " + node.id.slice(3)],
      ...VARIANTS.filter((x) => !variante || x === variante).flatMap((x) => {
        const t = node.texte?.[x] ?? {};
        return [
          [2, t.definition ?? ""],
          [1, [...(t.hinweise ?? []), ...Object.values(t.auspraegungen ?? {})].join(" ")],
        ];
      }),
      [1, (node.optionen ?? []).map((o) => o.label).join(" ") + " " + (node.zusatz ?? "") + " " + (node.sonderregel ?? "")],
    ];
    const folded = fields.map(([w, text]) => [w, fold(text)]);
    if (!terms.every((t) => folded.some(([, text]) => text.includes(t)))) continue;
    const score = terms.reduce((sum, t) => sum + Math.max(...folded.map(([w, text]) => (text.includes(t) ? w : 0))), 0);
    let snippet;
    for (const x of VARIANTS) {
      const t = node.texte?.[x];
      const pool = [t?.definition, ...(t?.hinweise ?? []), ...Object.values(t?.auspraegungen ?? {})].filter(Boolean);
      snippet = pool.find((p) => terms.some((term) => fold(p).includes(term)));
      if (snippet) break;
    }
    hits.push({
      score,
      code: node.id,
      titel: node.titel,
      art: node.art,
      ...(node.modul ? { modul: node.modul } : {}),
      ...(node.nur ? { nur: node.nur } : {}),
      ...(snippet ? { fundstelle: snippet.length > 280 ? snippet.slice(0, 277) + "…" : snippet } : {}),
    });
  }
  hits.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code, "de", { numeric: true }));
  return hits.slice(0, limit).map(({ score, ...h }) => h);
}

export function related({ code }) {
  const { id } = requireNode(code);
  const n = nodes[id];
  const siblings = (nodes[parentOf[id]]?.children ?? []).filter((c) => c !== id).map(summary);
  return {
    code: id,
    titel: n.titel,
    oberknoten: parentOf[id] ? summary(parentOf[id]) : null,
    unterknoten: (n.children ?? []).map(summary),
    geschwister: siblings,
    ...relationsOf(id),
  };
}

export function compare({ code_a, code_b }) {
  const a = requireNode(code_a).id;
  const b = requireNode(code_b).id;
  const between = (x, y) =>
    graph
      .out(x)
      .filter((e) => e.to === y)
      .map(meta)
      .map((e) => ({ typ: e.type, text: e.text, ...(e.variante ? { variante: e.variante } : {}), ...(e.seite ? { seite: e.seite } : {}), quelle: e.quelle }));
  const brief = (id) => {
    const n = nodes[id];
    const t = n.texte?.erwachsene ?? n.texte?.kinder ?? {};
    return { code: id, titel: n.titel, art: n.art, ...(n.modul ? { modul: n.modul } : {}), ...(t.definition ? { definition: t.definition } : {}), ...(t.hinweise ? { hinweise: t.hinweise } : {}) };
  };
  const common = graph.commonAncestor(a, b);
  const ab = between(a, b);
  const ba = between(b, a);
  // Hinweise eines Oberknotens, die beide Kriterien im selben Satz nennen (z. B. Einleitung von Modul 3)
  const shared = [];
  for (const anc of new Set([...graph.ancestors(a), ...graph.ancestors(b)])) {
    const toA = graph.out(anc).filter((e) => e.to === a).map(meta);
    for (const e of toA) {
      if (graph.out(anc).some((f) => f.to === b && f.text === e.text) && !shared.some((s) => s.text === e.text)) {
        shared.push({ von: anc, typ: e.type, text: e.text, ...(meta(e).variante ? { variante: meta(e).variante } : {}), ...(meta(e).seite ? { seite: meta(e).seite } : {}) });
      }
    }
  }
  return {
    a: brief(a),
    b: brief(b),
    gemeinsamer_oberknoten: common ? summary(common) : null,
    gleiches_modul: nodes[a].modul !== undefined && nodes[a].modul === nodes[b].modul,
    [`${a} → ${b}`]: ab,
    [`${b} → ${a}`]: ba,
    ...(shared.length ? { gemeinsame_hinweise: shared } : {}),
    abgrenzung_vorhanden: [...ab, ...ba, ...shared].some((e) => e.typ === "abgrenzung"),
    verbindungsweg: graph.path(a, b),
    hinweis:
      "Abgrenzungen stammen wörtlich aus den Begutachtungs-Richtlinien. Ein Sachverhalt wird nur einmal gewertet; in Modul 4 und 6 ist es nach den BRi aber unerheblich, ob Teilaspekte bereits in anderen Modulen berücksichtigt worden sind.",
  };
}

// ---------------------------------------------------------------------------
// Kuratierte Zuordnung BI ↔ ICF
// ---------------------------------------------------------------------------

const ICF_HINWEIS =
  "Kuratierte Zuordnung (keine amtliche Zuordnung zwischen BI und ICF). Beziehungen: entspricht, teilweise, funktion (zugrunde liegende Körperfunktion), umwelt (Kontextfaktor). BI-Stufen werden nicht in ICF-Beurteilungsmerkmale umgerechnet.";

const icfCodes = readData("icf_flat.json");
const icfParent = {};
for (const e of Object.values(icfCodes)) for (const c of e.children ?? []) icfParent[c] = e.code;
const icfAncestors = (code) => {
  const chain = [];
  for (let c = icfParent[code]; c; c = icfParent[c]) chain.push(c);
  return chain;
};

const icfEdges = data.edges.filter((e) => e.quelle === "kuratiert" && e.to.startsWith("ICF:"));
const ORDER = { entspricht: 0, teilweise: 1, funktion: 2, umwelt: 3 };

function icfOf(id) {
  return icfEdges
    .filter((e) => e.from === id)
    .map((e) => ({ icf: e.to.slice(4), titel: e.icf_titel, beziehung: e.type.slice(4), begruendung: e.text }))
    .sort((a, b) => ORDER[a.beziehung] - ORDER[b.beziehung]);
}

/** BI-Kriterien, die einem ICF-Code zugeordnet sind – direkt, über eine Oberkategorie oder eine Unterkategorie. */
export function biForIcf(icfCode) {
  const code = String(icfCode).trim().toLowerCase();
  const ancestors = new Set(icfAncestors(code));
  const hits = [];
  for (const e of icfEdges) {
    const target = e.to.slice(4);
    let via;
    if (target === code) via = "direkt";
    else if (ancestors.has(target)) via = "oberkategorie";
    else if (icfAncestors(target).includes(code)) via = "unterkategorie";
    else continue;
    const n = nodes[e.from];
    hits.push({
      bi: e.from,
      titel: n.titel,
      ...(n.modul ? { modul: n.modul } : {}),
      icf: target,
      icf_titel: e.icf_titel,
      beziehung: e.type.slice(4),
      ueber: via,
      begruendung: e.text,
    });
  }
  const rank = { direkt: 0, unterkategorie: 1, oberkategorie: 2 };
  return hits.sort((a, b) => rank[a.ueber] - rank[b.ueber] || ORDER[a.beziehung] - ORDER[b.beziehung] || a.bi.localeCompare(b.bi, "de", { numeric: true }));
}

const looksLikeIcf = (s) => /^[bdes]\d/i.test(String(s).trim());

export function icfMapping({ code, beziehung }) {
  const filter = (list) => (beziehung ? list.filter((x) => x.beziehung === beziehung) : list);
  if (looksLikeIcf(code)) {
    const icf = String(code).trim().toLowerCase();
    if (!icfCodes[icf]) throw new LookupError(`ICF-Code "${code}" nicht gefunden.`);
    return {
      richtung: "ICF → BI",
      icf,
      titel: icfCodes[icf].preferred,
      bi_kriterien: filter(biForIcf(icf)),
      hinweis: ICF_HINWEIS,
      stand: data.icf_zuordnung.stand,
    };
  }
  const { id } = requireNode(code);
  const n = nodes[id];
  const ids = n.art === "kriterium" ? [id] : (n.children ?? []).filter((c) => nodes[c].art === "kriterium");
  const result = ids.map((c) => ({ bi: c, titel: nodes[c].titel, icf: filter(icfOf(c)) })).filter((x) => x.icf.length);
  if (!result.length) throw new LookupError(`Für ${id} (${n.titel}) gibt es keine ICF-Zuordnung. Zugeordnet sind die Kriterien der Module 1–6 und der Bereiche 6.1/6.2.`);
  return {
    richtung: "BI → ICF",
    code: id,
    titel: n.titel,
    zuordnungen: result,
    beziehungen: data.icf_zuordnung.beziehungen,
    beurteilungsmerkmale: data.icf_zuordnung.beurteilungsmerkmale,
    icf_fassung: data.icf_zuordnung.icf_fassung,
    stand: data.icf_zuordnung.stand,
  };
}

// ---------------------------------------------------------------------------
// Kodierungen
// ---------------------------------------------------------------------------

const M5_RE = /^(\d+(?:[.,]\d+)?)\s*(?:x|mal)?\s*(?:\/|pro|je)?\s*(tag|taglich|t|woche|wochentlich|w|monat|monatlich|m)$/;

function parseFrequency(raw) {
  const s = fold(String(raw).trim()).replace(/\s+/g, " ");
  if (["entfallt", "entfaellt", "-", ""].includes(s)) return { art: "entfällt" };
  if (["selbstandig", "selbststandig", "s"].includes(s)) return { art: "selbständig" };
  if (s === "0") return { art: "entfällt" };
  const m = s.replace(/\s/g, "").match(M5_RE);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const unit = m[2].startsWith("t") ? "Tag" : m[2].startsWith("w") ? "Woche" : "Monat";
  return { art: "häufigkeit", anzahl: n, je: unit };
}

function parseValue(node, raw) {
  if (node.skala === "haeufigkeit_m5") {
    const f = parseFrequency(raw);
    if (!f) throw new LookupError(`Ungültige Häufigkeit "${raw}" für ${node.id}. Erlaubt: "entfällt", "selbständig" oder z. B. "3/Tag", "2/Woche", "1/Monat".`);
    if (f.art === "häufigkeit" && !Number.isInteger(f.anzahl)) {
      f.hinweis = "Nach den BRi ist die Häufigkeit als volle Zahl pro Tag, Woche oder Monat anzugeben (S. 83).";
    }
    return f;
  }
  if (node.optionen && !node.skala) {
    const key = String(raw).trim();
    const opt = node.optionen.find((o) => o.wert === key || fold(o.wert) === fold(key) || fold(o.label) === fold(key));
    if (!opt) throw new LookupError(`Unbekannte Option "${raw}" für ${node.id}. Erlaubt: ${node.optionen.map((o) => o.wert).join(", ")}`);
    return { art: "option", wert: opt.wert, label: opt.label };
  }
  const scale = scaleOf(node);
  if (!scale?.stufen) throw new LookupError(`${node.id} (${node.titel}) hat keine kodierbaren Ausprägungen.`);
  let v = String(raw).trim().toLowerCase();
  if (node.skala === "ja_nein") v = { ja: "1", nein: "0", true: "1", false: "0" }[v] ?? v;
  if (node.skala === "selbstaendig_nicht") v = { selbstandig: "0", selbständig: "0", "nicht selbständig": "1", "nicht selbstandig": "1" }[v] ?? v;
  if (node.skala === "diaet" && fold(v).startsWith("entf")) v = "0";
  const stufe = Number(v);
  const level = scale.stufen.find((s) => s.wert === stufe);
  if (!level) {
    throw new LookupError(
      `Ungültiger Wert "${raw}" für ${node.id}. Erlaubt sind die Stufen ${scale.stufen.map((s) => `${s.wert} = ${s.label}`).join("; ")}.` +
        (node.skala === "haeufigkeit_m3" || node.faktor ? " Kodiert wird die Stufe, nicht der Punktwert aus dem Formular." : "")
    );
  }
  return { art: "stufe", wert: stufe, label: level.label };
}

// "BI:4.1.3=2", "F 4.1.3 = 2", "4.5.1: 3/Tag" (Doppelpunkt nur, wenn kein "=" vorkommt und er nicht zu "BI:" gehört)
function matchPair(part) {
  if (part.includes("=")) return part.match(/^(.+?)\s*=\s*(.+)$/);
  return part.replace(/^BI\s*:/i, "BI ").match(/^(.+?)\s*:\s*(.+)$/) ?? part.match(/^(.+?)\s+(\S+)$/);
}

function splitCoding(text) {
  return String(text ?? "")
    .split(/[;\n]+|,(?=\s*(?:BI|K?F|\d))/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function interpretCoding({ coding, variante }) {
  const parts = splitCoding(coding);
  if (!parts.length) throw new LookupError("Keine Kodierung angegeben, z. B. \"BI:4.1.3=2\" oder \"BI:4.5.1=3/Tag; BI:5.4=unfall\".");
  const results = parts.map((part) => {
    const m = matchPair(part);
    if (!m) return { eingabe: part, gueltig: false, fehler: 'Format "<Kennung>=<Wert>", z. B. "BI:4.1.3=2".' };
    try {
      const { id, variante: v0 } = requireNode(m[1]);
      const node = nodes[id];
      const v = variante ?? v0 ?? (node.nur === "kinder" ? "kinder" : "erwachsene");
      const value = parseValue(node, m[2]);
      const out = { eingabe: part, gueltig: true, code: id, titel: node.titel, ...(node.modul ? { modul: node.modul } : {}), ...value };
      if (value.art === "stufe") {
        out.kodierung = `${id}=${value.wert}`;
        const p = pointsFor(node, value.wert);
        if (p !== null && node.punktrelevant !== false) out.einzelpunkte_erwachsene = p;
        const text = node.texte?.[v]?.auspraegungen?.[String(value.wert)];
        if (text) out.erlaeuterung = text;
        if (node.punktrelevant === false && node.modul === undefined) out.hinweis = "Geht nicht in die Ermittlung des Pflegegrades ein.";
        if (node.nur && node.nur !== v) out.hinweis = `Kriterium gilt nur für ${node.nur}.`;
      } else if (value.art === "option") {
        out.kodierung = `${id}=${value.wert}`;
      } else {
        out.kodierung = `${id}=${value.art === "häufigkeit" ? `${value.anzahl}/${value.je}` : value.art}`;
      }
      return out;
    } catch (err) {
      if (!(err instanceof LookupError)) throw err;
      return { eingabe: part, gueltig: false, fehler: err.message };
    }
  });
  return { richtlinie: BI_VERSION, ergebnisse: results };
}

// ---------------------------------------------------------------------------
// Bewertungssystematik
// ---------------------------------------------------------------------------

function weighted(modulNode, sum) {
  const band = modulNode.schwellen.find((s) => sum >= s.von && sum <= s.bis) ?? modulNode.schwellen[modulNode.schwellen.length - 1];
  return band.gewichtete_punkte;
}

function expectedLevel(node, months) {
  const table = node.kinder?.altersentsprechend;
  if (!table) return 0;
  let level = table[0].stufe;
  for (const row of table) if (months >= row.ab_monaten) level = row.stufe;
  return level;
}

function m5Group(groupId, entries, hinweise) {
  const group = nodes["BI:4.5"].gruppen.find((g) => g.id === groupId);
  if (group.art === "pro_tag") {
    let perDay = 0;
    const detail = [];
    for (const [id, f] of entries) {
      if (f.art !== "häufigkeit") continue;
      const v = round4(f.je === "Tag" ? f.anzahl : f.je === "Woche" ? f.anzahl / 7 : f.anzahl / 30);
      perDay = round4(perDay + v);
      detail.push({ code: id, je_tag: v });
    }
    let punkte;
    if (groupId === "A") punkte = perDay < 1 ? 0 : perDay <= 3 ? 1 : perDay <= 8 ? 2 : 3;
    else punkte = perDay < round4(1 / 7) ? 0 : perDay < 1 ? 1 : perDay < 3 ? 2 : 3;
    return { gruppe: groupId, kriterien: group.kriterien, massnahmen_pro_tag: perDay, einzelpunkte: punkte, detail };
  }
  // Gruppe C: Punkte pro Monat
  let sum = 0;
  const detail = [];
  for (const [id, f] of entries) {
    if (f.art !== "häufigkeit") continue;
    const je = nodes[id].punkte_je;
    let p;
    if (f.je === "Tag") {
      if (je.Tag !== undefined) p = je.Tag;
      else {
        p = round4(f.anzahl * 7 * je.Woche);
        hinweise.push(`${id}: Tägliche Häufigkeit ist nur bei 4.5.12 vorgesehen; zur Berechnung als ${f.anzahl * 7}/Woche gewertet.`);
      }
    } else p = round4(f.anzahl * je[f.je]);
    sum = round4(sum + p);
    detail.push({ code: id, punkte: p });
  }
  const punkte = sum < 4.3 ? 0 : sum < 8.6 ? 1 : sum < 12.9 ? 2 : sum < 60 ? 3 : 6;
  return { gruppe: groupId, kriterien: group.kriterien, zwischensumme: sum, einzelpunkte: punkte, detail };
}

function collectValues({ kodierung, werte }) {
  const values = {};
  const add = (key, raw) => {
    const { id } = requireNode(key);
    values[id] = parseValue(nodes[id], raw);
  };
  if (kodierung) {
    for (const part of splitCoding(kodierung)) {
      const m = matchPair(part);
      if (!m) throw new LookupError(`Kodierung "${part}" nicht verstanden. Format: "BI:4.1.3=2".`);
      add(m[1], m[2]);
    }
  }
  for (const [k, v] of Object.entries(werte ?? {})) add(k, v);
  return values;
}

function monthsFrom({ alter_monate, geburtsdatum, begutachtungsdatum }) {
  if (alter_monate !== undefined && alter_monate !== null && alter_monate !== "") {
    const months = Number(alter_monate);
    if (!Number.isFinite(months) || months < 0) throw new LookupError(`Alter "${alter_monate}" ist ungültig; bitte das Alter in Monaten als Zahl ab 0 angeben.`);
    return months;
  }
  if (!geburtsdatum) return null;
  const b = new Date(geburtsdatum);
  const d = begutachtungsdatum ? new Date(begutachtungsdatum) : new Date();
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) throw new LookupError("Datum nicht lesbar; bitte im Format JJJJ-MM-TT angeben.");
  let months = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  let days = d.getDate() - b.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(d.getFullYear(), d.getMonth(), 0).getDate();
  }
  if (months < 0) throw new LookupError("Das Geburtsdatum liegt nach dem Datum der Begutachtung.");
  return months + days / 30;
}

export function calculate(args) {
  const values = collectValues(args);
  const months = monthsFrom(args);
  const hinweise = [];
  const fehlend = [];
  const child = months !== null && months < ADULT_FROM_MONTHS;
  const infant = months !== null && months < INFANT_BELOW_MONTHS;
  const variante = months !== null && months < 18 * 12 ? "kinder" : "erwachsene";

  const stufe = (id) => (values[id]?.art === "stufe" ? values[id].wert : undefined);
  const module = {};

  // Bedingung für 4.4.11/4.4.12 aus den Angaben zur Versorgung
  const condition = { harn: "BI:4.4.V2", stuhl: "BI:4.4.V3" };
  const conditionMet = (key) => {
    const field = values[condition[key]];
    if (!field) return null;
    const opt = nodes[condition[key]].optionen.find((o) => o.wert === field.wert);
    return opt?.kriterium_relevant ?? null;
  };

  for (const m of [1, 2, 3, 4, 6]) {
    const modulNode = nodes[`BI:4.${m}`];
    const crits = modulNode.children.map((c) => nodes[c]).filter((n) => n.art === "kriterium" && n.punktrelevant !== false);
    const detail = [];
    let sum = 0;
    if (infant && m !== 3) {
      if (m === 4) {
        const v = stufe("BI:4.4.0");
        const p = v === 1 ? nodes["BI:4.4.0"].punkte_ja : 0;
        if (v === undefined) fehlend.push("BI:4.4.0");
        sum = p;
        detail.push({ code: "BI:4.4.0", wert: v ?? null, einzelpunkte: p });
      }
      module[m] = { modul: m, titel: modulNode.titel, summe_einzelpunkte: sum, gewichtete_punkte: weighted(modulNode, sum), detail, ...(m !== 4 ? { hinweis: "Bei Kindern im Alter bis zu 18 Monaten nicht bewertet." } : { hinweis: "Bei Kindern im Alter bis zu 18 Monaten ersetzt 4.4.0 das Modul 4." }) };
      continue;
    }
    for (const n of crits) {
      if (n.nur === "kinder") continue; // 4.4.0 nur bis 18 Monate
      const v = stufe(n.id);
      if (v === undefined) {
        fehlend.push(n.id);
        continue;
      }
      if (n.bedingung) {
        const met = conditionMet(n.bedingung);
        if (met === false) {
          detail.push({ code: n.id, wert: v, einzelpunkte: 0, hinweis: "Entfällt laut Angaben zur Versorgung (kontinent)." });
          continue;
        }
        if (met === null) hinweise.push(`${n.id} wurde gewertet. Es zählt nur bei überwiegender/kompletter Inkontinenz oder künstlicher Ableitung; zur Prüfung ${condition[n.bedingung]} angeben.`);
      }
      let p;
      if (child && m !== 3 && n.skala !== "sonde") {
        const expected = expectedLevel(n, months);
        p = Math.max(0, v - expected) * (n.faktor ?? 1);
        detail.push({ code: n.id, wert: v, altersentsprechend: expected, einzelpunkte: p });
      } else {
        p = pointsFor(n, v);
        detail.push({ code: n.id, wert: v, einzelpunkte: p });
      }
      sum += p;
    }
    module[m] = { modul: m, titel: modulNode.titel, summe_einzelpunkte: sum, gewichtete_punkte: weighted(modulNode, sum), detail };
  }

  // Modul 5
  {
    const modulNode = nodes["BI:4.5"];
    const entries = {};
    for (const id of modulNode.children) {
      const n = nodes[id];
      if (n.art !== "kriterium") continue;
      if (n.nur === "kinder" && !child) continue;
      const v = values[id];
      if (v === undefined) {
        if (n.nur !== "kinder") fehlend.push(id);
        continue;
      }
      (entries[n.gruppe] ??= []).push([id, v]);
    }
    const groups = ["A", "B", "C"].map((g) => m5Group(g, entries[g] ?? [], hinweise));
    const diaet = entries.D?.[0]?.[1];
    const d = diaet?.art === "stufe" ? diaet.wert : 0;
    const sum = groups.reduce((s, g) => s + g.einzelpunkte, 0) + d;
    module[5] = {
      modul: 5,
      titel: modulNode.titel,
      summe_einzelpunkte: sum,
      gewichtete_punkte: weighted(modulNode, sum),
      gruppen: [...groups, { gruppe: "D", kriterien: ["4.5.16"], einzelpunkte: d }],
    };
    for (const [, f] of Object.values(entries).flat()) if (f.hinweis && !hinweise.includes(f.hinweis)) hinweise.push(f.hinweis);
  }

  const m23 = Math.max(module[2].gewichtete_punkte, module[3].gewichtete_punkte);
  module[2].geht_ein = module[2].gewichtete_punkte >= module[3].gewichtete_punkte;
  module[3].geht_ein = !module[2].geht_ein;
  const total = round4(module[1].gewichtete_punkte + m23 + module[4].gewichtete_punkte + module[5].gewichtete_punkte + module[6].gewichtete_punkte);

  const bbk = stufe("BI:4.1.B") === 1;
  if (stufe("BI:4.1.B") === undefined) fehlend.push("BI:4.1.B");
  const table = infant ? data.pflegegrade.kinder_bis_18_monate.stufen : data.pflegegrade.stufen;
  let grad = 0;
  for (const s of table) if (total >= s.ab) grad = s.grad;
  const nachPunkten = grad;
  if (bbk) grad = 5;
  if (infant) hinweise.push(data.pflegegrade.kinder_bis_18_monate.regel);
  else if (child) hinweise.push(data.pflegegrade.kinder_unter_11.regel);

  return {
    richtlinie: BI_VERSION,
    systematik: infant ? "Kinder bis 18 Monate" : child ? "Kinder unter 11 Jahren (altersentsprechender Vergleich)" : "Erwachsene und Kinder ab 11 Jahren",
    ...(months !== null ? { alter_monate: Math.round(months * 100) / 100, formular: variante } : {}),
    module: [1, 2, 3, 4, 5, 6].map((m) => module[m]),
    gewichtete_punkte_modul_2_oder_3: m23,
    gesamtpunkte: total,
    besondere_bedarfskonstellation: bbk,
    pflegegrad: grad,
    pflegegrad_nach_punkten: nachPunkten,
    pflegegrad_text: grad === 0 ? "kein Pflegegrad" : `Pflegegrad ${grad}`,
    ...(fehlend.length ? { nicht_angegeben: [...new Set(fehlend)], hinweis_fehlend: "Nicht angegebene Kriterien wurden mit 0 Punkten gewertet." } : {}),
    ...(hinweise.length ? { hinweise } : {}),
    haftung:
      "Rechenhilfe nach Anlage 2 zu § 15 SGB XI und den BRi. Die Einstufung trifft die Pflegekasse auf Grundlage des Gutachtens; das Ergebnis ersetzt keine Begutachtung.",
  };
}

export function getScoringRules() {
  return {
    richtlinie: BI_VERSION,
    module: [1, 2, 3, 4, 5, 6].map((m) => {
      const n = nodes[`BI:4.${m}`];
      return {
        modul: m,
        titel: n.titel,
        gewichtung_prozent: n.gewichtung_prozent,
        schwellen: n.schwellen,
        ...(n.hinweis_gewichtung ? { hinweis: n.hinweis_gewichtung } : {}),
        ...(n.gruppen ? { gruppen_modul_5: n.gruppen } : {}),
      };
    }),
    pflegegrade: data.pflegegrade,
    skalen: data.skalen,
  };
}
