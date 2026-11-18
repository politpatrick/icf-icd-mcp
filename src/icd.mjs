// ICD-10-GM-Datenzugriff für den MCP-Server: lädt icd10gm.json aus ../data
// und stellt Abfrage-Funktionen für die Tools bereit.

import { readData } from "./data.mjs";
import { RelationGraph } from "./graph.mjs";
import { fold, compact, LookupError } from "./text.mjs";

const { meta: VERSION, codes } = readData("icd10gm.json");

export const ICD_VERSION = `ICD-10-GM ${VERSION.version}`;

const USAGE = {
  dagger: { mark: "†", meaning: "Kreuz-Kode (Ätiologie); kann mit einem Stern-Kode kombiniert werden" },
  aster: { mark: "*", meaning: "Stern-Kode (Manifestation); nur zusammen mit einem Kreuz-Kode (†) verwenden" },
  optional: { mark: "!", meaning: "Ausrufezeichen-Kode; nur als Zusatz zu einem anderen Kode verwenden" },
};

const PARA = {
  P: "zur Primärverschlüsselung zugelassen",
  O: "nur als Stern-Kode zugelassen",
  Z: "nur als Ausrufezeichen-Kode zugelassen",
  V: "nicht zur Verschlüsselung zugelassen",
};

const CERTAINTY = {
  G: "gesicherte Diagnose",
  V: "Verdachtsdiagnose",
  Z: "Zustand nach der Diagnose",
  A: "ausgeschlossene Diagnose",
};

const SIDE = { R: "rechts", L: "links", B: "beidseitig" };

// Vollständiger Titel kombinierter Kodes, z. B. E11.90 → "Diabetes mellitus, Typ 2: Ohne Komplikationen: Nicht als entgleist bezeichnet"
function fullTitle(entry) {
  return entry.combined ? `${fullTitle(codes[entry.parent])}: ${entry.title}` : entry.title;
}

// Alphabetisches Verzeichnis: Einträge hängen am Primärkode, reine Zusatzkodierungen (Art 5) am Zusatzkode.
const ALPHABET = readData("icd10gm_alpha.json");
const ALPHABET_HINT = "Alphabet-Treffer stammen aus dem Alphabetischen Verzeichnis; maßgeblich ist das Systematische Verzeichnis.";
const alphabetOf = {};
const byOrpha = {};
for (const item of ALPHABET.entries) {
  item.folded = compact(item.t);
  (alphabetOf[item.art === 5 ? item.z : item.p] ??= []).push(item);
  if (item.o) (byOrpha[item.o] ??= []).push(item);
}
const verweise = ALPHABET.verweise.map((text) => ({ text, folded: compact(text) }));

const chapterOf = {};
const searchIndex = [];
for (const entry of Object.values(codes)) {
  entry.fullTitle = fullTitle(entry);
  chapterOf[entry.code] = entry.kind === "chapter" ? entry.code : chapterOf[entry.parent];
  if (entry.kind === "category") {
    searchIndex.push({
      entry,
      title: compact(entry.fullTitle + " " + (entry.title_long ?? "")),
      inclusions: compact((entry.inclusions ?? []).map(textOf).join(" ")),
      alphabet: (alphabetOf[entry.code] ?? []).map((a) => a.folded).join(" | "),
    });
  }
}

function textOf(item) {
  return typeof item === "string" ? item : item.text;
}

function isTerminal(entry) {
  return entry.kind === "category" && entry.children.length === 0;
}

function displayCode(entry) {
  return entry.code + (USAGE[entry.usage]?.mark ?? "");
}

function summary(code) {
  const entry = codes[code];
  if (!entry) return code.includes("-") ? { code, kind: "bereich" } : { code };
  return {
    code: displayCode(entry),
    title: entry.fullTitle,
    kind: entry.kind,
    ...(entry.kind === "category" ? { terminal: isTerminal(entry) } : {}),
  };
}

function chapterRange(entry) {
  const first = codes[entry.children[0]]?.code.split("-")[0];
  const last = codes[entry.children.at(-1)]?.code.split("-").at(-1);
  return first && last ? `${first}-${last}` : undefined;
}

function ancestors(code) {
  const chain = [];
  for (let c = codes[code].parent; c; c = codes[c].parent) chain.unshift(summary(c));
  return chain;
}

/** "f32.1", "F321", "F32.1 G", "M07.0-*", "G30.0†" → "F32.1" usw. */
export function normalizeIcdCode(raw) {
  let code = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "").replace(/[*†!+]/g, "").replace(/\.?-$/, "");
  if (/^[A-Z]\d{3,}$/.test(code)) code = `${code.slice(0, 3)}.${code.slice(3)}`;
  return code;
}

/** Titel und Alphabet-Begriffe eines Kodes (für die Ableitung von VersMedV-Stichwörtern). */
export function alphabetTerms(raw) {
  const code = requireCode(raw);
  return { code, title: codes[code].fullTitle, begriffe: (alphabetOf[code] ?? []).map((a) => a.t) };
}

function requireCode(raw) {
  const code = normalizeIcdCode(raw);
  if (codes[code]) return code;
  const suggestions = Object.keys(codes).filter((c) => code.length >= 3 && c.startsWith(code.slice(0, 3))).slice(0, 10);
  throw new LookupError(
    `ICD-10-GM-Kode "${raw}" nicht gefunden.` + (suggestions.length ? ` Ähnliche Kodes: ${suggestions.join(", ")}` : "")
  );
}

function age(value, direction) {
  if (!value || value === "9999") return null;
  const n = Number(value.slice(1));
  const unit = value[0] === "t" ? (n === 1 ? "Lebenstag" : "Lebenstagen") : n === 1 ? "Lebensjahr" : "Lebensjahren";
  return `${direction} ${n} vollendeten ${unit}`;
}

function restrictions(m = {}) {
  const out = [];
  if (m.SexCode === "M") out.push(`nur bei männlichem Geschlecht${m.SexReject === "K" ? " (Kann-Fehler)" : ""}`);
  if (m.SexCode === "W") out.push(`nur bei weiblichem Geschlecht${m.SexReject === "K" ? " (Kann-Fehler)" : ""}`);
  const low = age(m.AgeLow, "ab");
  const high = age(m.AgeHigh, "bis");
  if (low || high) {
    const kind = { M: " (Muss-Fehler)", K: " (Kann-Fehler)" }[m.AgeReject] ?? "";
    out.push(`Altersgrenze: ${[low, high].filter(Boolean).join(", ")}${kind}`);
  }
  if (m.Exotic === "J") out.push("in Mitteleuropa sehr selten (Kann-Fehler)");
  if (m.Content === "N") out.push("Schlüsselnummer ohne Inhalt (Kann-Fehler)");
  if (m.Infectious === "J") out.push("Meldepflicht nach Infektionsschutzgesetz beachten");
  return out;
}

function withRefs(items = []) {
  return items.map((item) =>
    typeof item === "string" ? { text: item, codes: [] } : { text: item.text, codes: item.refs.map(summary) }
  );
}

export function listChapters({ chapter } = {}) {
  if (chapter) {
    const code = requireCode(String(chapter).toUpperCase());
    const entry = codes[code];
    if (entry.kind !== "chapter") throw new LookupError(`"${chapter}" ist kein Kapitel (Kapitel sind I bis XXII).`);
    return { version: ICD_VERSION, ...summary(code), range: chapterRange(entry), groups: entry.children.map(summary) };
  }
  return {
    version: ICD_VERSION,
    chapters: VERSION.chapters.map((c) => ({ ...summary(c), range: chapterRange(codes[c]) })),
  };
}

export function getCode({ code: raw }) {
  const code = requireCode(raw);
  const entry = codes[code];
  const m = entry.meta;
  return {
    version: ICD_VERSION,
    code: displayCode(entry),
    title: entry.fullTitle,
    ...(entry.title_long ? { title_long: entry.title_long } : {}),
    kind: entry.kind,
    chapter: summary(chapterOf[code]),
    path: ancestors(code),
    ...(entry.kind === "category"
      ? {
          terminal: isTerminal(entry),
          usage: entry.usage ? `${USAGE[entry.usage].mark} ${USAGE[entry.usage].meaning}` : null,
          para295: m ? `${m.Para295} – ${PARA[m.Para295]} (ambulant)` : null,
          para301: m ? `${m.Para301} – ${PARA[m.Para301]} (stationär)` : null,
          restrictions: restrictions(m),
        }
      : {}),
    definitions: (entry.definitions ?? []).map(textOf),
    inclusions: withRefs(entry.inclusions),
    exclusions: withRefs(entry.exclusions),
    notes: [...(entry.notes ?? []), ...(entry.coding_hints ?? []), ...(entry.modifier_notes ?? [])].map(textOf),
    children: entry.children.map(summary),
  };
}

const MAX_ALPHABET_PER_CODE = 3;
const MAX_VERWEISE = 5;

function alphabetHit(item) {
  return {
    text: item.t,
    ...(item.k ? { kombination: item.k } : {}),
    ...(item.o ? { orpha: item.o } : {}),
  };
}

/** Alphabet-Texte eines Kodes, die zur Suche passen, die mit den meisten Suchwörtern zuerst. */
function matchingAlphabet(items, terms) {
  return items
    .map((a) => ({ a, n: terms.filter((t) => a.folded.includes(t)).length }))
    .filter(({ n }) => n > 0)
    .sort((x, y) => y.n - x.n)
    .slice(0, MAX_ALPHABET_PER_CODE)
    .map(({ a }) => alphabetHit(a));
}

function searchResult(query, scored, limit, extra = {}) {
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, Math.min(limit, 100)).map(({ entry, alphabet }) => ({
    ...summary(entry.code),
    ...(alphabet?.length ? { alphabet } : {}),
  }));
  return {
    version: ICD_VERSION,
    query,
    total: scored.length,
    results,
    ...extra,
    ...(results.some((r) => r.alphabet) ? { hinweis: ALPHABET_HINT } : {}),
  };
}

function searchOrpha(query, orpha, accept, limit) {
  const items = byOrpha[orpha] ?? [];
  const byCode = new Map();
  for (const item of items) {
    const entry = codes[item.art === 5 ? item.z : item.p];
    if (!accept(entry)) continue;
    if (!byCode.has(entry.code)) byCode.set(entry.code, { entry, score: -entry.code.length * 0.1, alphabet: [] });
    const hit = byCode.get(entry.code);
    if (hit.alphabet.length < MAX_ALPHABET_PER_CODE) hit.alphabet.push(alphabetHit(item));
  }
  return searchResult(query, [...byCode.values()], limit);
}

export function search({ query, chapter, codable_only = false, limit = 20 }) {
  const chap = chapter ? requireCode(String(chapter).toUpperCase()) : null;
  const accept = (entry) => !(chap && chapterOf[entry.code] !== chap) && !(codable_only && !isTerminal(entry));
  const orpha = String(query ?? "").match(/^\s*orpha\s*[:\-]?\s*(\d+)\s*$/i);
  if (orpha) return searchOrpha(query, Number(orpha[1]), accept, limit);

  const words = fold(query).split(/\s+/).filter((w) => w.replace(/-/g, ""));
  if (!words.length) throw new LookupError("Suchbegriff fehlt.");
  const terms = words.map((w) => w.replace(/-/g, ""));
  const codeTerms = words.map((w) => normalizeIcdCode(w));
  const results = [];
  for (const item of searchIndex) {
    const { entry } = item;
    if (!accept(entry)) continue;
    let score = 0;
    let allFound = true;
    let alphabetUsed = false;
    const needAlphabet = [];
    terms.forEach((term, i) => {
      const codeHit = entry.code === codeTerms[i] ? 100 : entry.code.startsWith(codeTerms[i]) ? 20 : 0;
      const inTitle = item.title.includes(term);
      const inInclusions = item.inclusions.includes(term);
      const inAlphabet = item.alphabet.includes(term);
      // Jedes Suchwort zählt nur mit seinem besten Fundort: Titel vor Alphabet vor Einschlüssen
      const hit = inTitle ? 10 : inAlphabet ? 6 : inInclusions ? 2 : 0;
      if (!hit && !codeHit) allFound = false;
      if (inAlphabet) alphabetUsed = true;
      if (!inTitle && !inInclusions && !codeHit) needAlphabet.push(term);
      score += hit + codeHit;
    });
    // Suchwörter, die nur im Alphabet stehen, müssen gemeinsam in einem Alphabet-Text stehen
    if (allFound && needAlphabet.length > 1) {
      allFound = alphabetOf[entry.code].some((a) => needAlphabet.every((t) => a.folded.includes(t)));
    }
    if (allFound) {
      const alphabet = alphabetUsed ? matchingAlphabet(alphabetOf[entry.code], terms) : undefined;
      results.push({ score: score - entry.code.length * 0.1, entry, alphabet });
    }
  }
  const refs = verweise.filter((v) => terms.every((t) => v.folded.includes(t))).slice(0, MAX_VERWEISE).map((v) => v.text);
  return searchResult(query, results, limit, refs.length ? { verweise: refs } : {});
}

export function checkCode({ code: raw }) {
  const input = String(raw ?? "").trim();
  // Zusatzkennzeichen: Diagnosesicherheit (G/V/Z/A) und Seitenlokalisation (R/L/B), z. B. "M17.1 R G" oder "F32.1G"
  const match = input.toUpperCase().match(/^(.*?\d[*†!+]?-?)\s*([GVZARLB](?:\s*[GVZARLB])?)?$/);
  const codePart = match ? match[1] : input;
  const suffixes = match?.[2]?.replace(/\s+/g, "").split("") ?? [];
  const code = requireCode(codePart);
  const entry = codes[code];
  const warnings = [];
  const result = { version: ICD_VERSION, input, ...summary(code), valid: true, warnings };

  if (entry.kind !== "category") {
    result.valid = false;
    warnings.push(`${entry.kind === "chapter" ? "Kapitel" : "Gruppe"} – nicht kodierbar, bitte eine Kategorie wählen.`);
    return result;
  }
  if (!isTerminal(entry)) {
    result.valid = entry.meta?.Para295 !== "V";
    warnings.push(
      `Nicht endständig – bitte spezifischer kodieren: ${entry.children.map((c) => displayCode(codes[c])).join(", ")}` +
        (entry.meta?.Para295 !== "V" ? " (ambulant als Viersteller zulässig, stationär nicht)." : ".")
    );
  }
  result.para295 = `${entry.meta.Para295} – ${PARA[entry.meta.Para295]} (ambulant)`;
  result.para301 = `${entry.meta.Para301} – ${PARA[entry.meta.Para301]} (stationär)`;
  if (entry.usage) warnings.push(`${USAGE[entry.usage].mark}: ${USAGE[entry.usage].meaning}.`);
  result.restrictions = restrictions(entry.meta);

  const certainty = suffixes.filter((s) => "GVZA".includes(s));
  const side = suffixes.filter((s) => "RLB".includes(s));
  if (certainty.length) result.certainty = `${certainty[0]} – ${CERTAINTY[certainty[0]]}`;
  if (side.length) result.side = `${side[0]} – ${SIDE[side[0]]}`;
  if (certainty.length > 1 || side.length > 1) warnings.push("Pro Kode nur ein Kennzeichen für Diagnosesicherheit und eines für die Seite.");
  return result;
}

// ---------------------------------------------------------------------------
// Wissensnetz: Ausschlüsse, Verweise und Kreuz-Stern-Kombinationen aus den amtlichen Daten

const isDaggerAster = (a, b) =>
  (a?.usage === "dagger" && b?.usage === "aster") || (a?.usage === "aster" && b?.usage === "dagger");

export const graph = new RelationGraph({
  parentOf: (code) => codes[code]?.parent,
  childrenOf: (code) => codes[code]?.children ?? [],
  has: (code) => code in codes,
  roots: VERSION.chapters,
});

for (const entry of Object.values(codes)) {
  for (const item of entry.exclusions ?? []) {
    for (const ref of item.refs ?? []) graph.addEdge(entry.code, ref, "ausschluss", item.text);
  }
  const refs = [
    ...(entry.inclusions ?? []).flatMap((item) => (item.refs ?? []).map((ref) => [ref, item.text])),
    ...(entry.title_refs ?? []).map((ref) => [ref, entry.title]),
  ];
  for (const [ref, text] of refs) {
    const target = codes[graph.resolve(ref)];
    graph.addEdge(entry.code, ref, isDaggerAster(entry, target) ? "kreuz_stern" : "verweis", text);
  }
  // Verweise in Kodierhinweisen, Anmerkungen und Definitionen, z. B. "Benutze eine zusätzliche Schlüsselnummer (U69.80-U69.82)"
  for (const key of ["coding_hints", "notes", "definitions", "modifier_notes"]) {
    for (const item of entry[key] ?? []) {
      for (const ref of item.refs ?? []) graph.addEdge(entry.code, ref, "hinweis", item.text);
    }
  }
}

const LIST_LIMIT = 50;

function limited(items) {
  return items.length > LIST_LIMIT ? { anzahl: items.length, eintraege: items.slice(0, LIST_LIMIT) } : items;
}

function edgeOut({ to, text, geerbt_von }) {
  return { ziel: summary(to), text, ...(geerbt_von ? { geerbt_von: summary(geerbt_von) } : {}) };
}

function edgeIn({ from, text, via, ueber }) {
  return {
    von: summary(from),
    text,
    trifft: via === "direkt" ? "diesen Kode direkt" : via === "oberklasse" ? `die Oberklasse ${ueber}` : `den Bereich ${ueber}`,
  };
}

// Kreuz-Stern-Verweise stehen oft auf beiden Seiten (G30.0† nennt F00.0*, F00.0* nennt G30.0†):
// je Partner ein Eintrag mit allen Fundstellen
function crossPartners(code) {
  const partners = new Map();
  const add = (target, text, ueber) => {
    const key = graph.resolve(target) ?? target;
    if (!partners.has(key)) partners.set(key, { partner: summary(key), texte: [], ...(ueber ? { ueber } : {}) });
    const entry = partners.get(key);
    if (!entry.texte.includes(text)) entry.texte.push(text);
  };
  for (const edge of graph.out(code, "kreuz_stern")) add(edge.to, edge.text);
  for (const edge of graph.incoming(code, "kreuz_stern")) {
    add(edge.from, edge.text, edge.via === "direkt" ? undefined : `über ${edge.ueber}`);
  }
  return [...partners.values()];
}

export function relations({ code: raw }) {
  const code = requireCode(raw);
  return {
    version: ICD_VERSION,
    ...summary(code),
    oberklassen: graph.ancestors(code).reverse().map(summary),
    unterklassen: codes[code].children.map(summary),
    ausschluesse: graph.out(code, "ausschluss").map(edgeOut),
    geerbte_ausschluesse: limited(graph.inherited(code, "ausschluss").map(edgeOut)),
    wird_ausgeschlossen_bei: limited(graph.incoming(code, "ausschluss").map(edgeIn)),
    verweise: graph.out(code, "verweis").map(edgeOut),
    rueckverweise: limited(graph.incoming(code, "verweis").map(edgeIn)),
    hinweise: graph.out(code, "hinweis").map(edgeOut),
    in_hinweisen_genannt_bei: limited(graph.incoming(code, "hinweis").map(edgeIn)),
    kreuz_stern: crossPartners(code),
    hinweis:
      "Ausschlüsse (Exklusiva) geben an, unter welchem Kode ein Zustand stattdessen klassifiziert wird. Ausschlüsse einer Oberklasse gelten für alle untergeordneten Kodes.",
  };
}

function hierarchy(a, b) {
  const common = graph.commonAncestor(a, b);
  if (a === b) return { beziehung: "gleicher Kode" };
  if (common === a) return { beziehung: `${a} ist Oberklasse von ${b}` };
  if (common === b) return { beziehung: `${b} ist Oberklasse von ${a}` };
  if (!common) return { beziehung: "verschiedene Kapitel, keine gemeinsame Oberklasse" };
  const sameParent = codes[a].parent === codes[b].parent;
  return { beziehung: sameParent ? "Geschwister (gleiche Oberklasse)" : "gemeinsame Oberklasse", gemeinsame_oberklasse: summary(common) };
}

function between(from, to) {
  return graph.edgesBetween(from, to).map(({ type, text, geerbt_von, via, ueber }) => ({
    art: type,
    text,
    ...(geerbt_von ? { geerbt_von: summary(geerbt_von) } : {}),
    trifft: via === "direkt" ? to : via === "oberklasse" ? `Oberklasse ${ueber}` : `Bereich ${ueber}`,
  }));
}

export function compare({ code_a, code_b }) {
  const a = requireCode(code_a);
  const b = requireCode(code_b);
  const fromA = between(a, b);
  const fromB = between(b, a);
  const pfad = graph.path(a, b);
  const merkmale = (code) => ({
    einschluesse: (codes[code].inclusions ?? []).map(textOf),
    definitionen: (codes[code].definitions ?? []).map(textOf),
  });
  return {
    version: ICD_VERSION,
    a: summary(a),
    b: summary(b),
    hierarchie: hierarchy(a, b),
    [`${a}_zu_${b}`]: fromA,
    [`${b}_zu_${a}`]: fromB,
    abgrenzung: fromA.some((e) => e.art === "ausschluss") || fromB.some((e) => e.art === "ausschluss")
      ? "Es gibt einen amtlichen Ausschluss zwischen den Kodes: Der dort genannte Zustand wird unter dem anderen Kode klassifiziert."
      : "Kein amtlicher Ausschluss zwischen den Kodes (auch nicht über Oberklassen).",
    pfad: pfad ? pfad.map((s) => ({ ...s, von: summary(s.von), nach: summary(s.nach) })) : "Kein Weg über amtliche Beziehungen (höchstens 8 Schritte).",
    merkmale: { [a]: merkmale(a), [b]: merkmale(b) },
  };
}
