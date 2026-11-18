// Versorgungsmedizinische Grundsätze (VersMedV, Anlage zu § 2): Gliederung, Abruf und Suche.
// Lädt data/versmedv.json. Kennungen: "VMG:B 3.7", "VMG:A 5d jj", Teil-Wurzeln "VMG:A" … "VMG:D".

import { readData } from "./data.mjs";
import { compact, fold, LookupError } from "./text.mjs";
import { alphabetTerms } from "./icd.mjs";

const data = readData("versmedv.json");
const nodes = data.nodes;
const order = Object.keys(nodes);
const position = new Map(order.map((id, i) => [id, i]));
export const VMG_VERSION = `${data.meta.titel}, ${data.meta.stand}`;

const ABWEICHUNG_HINWEIS =
  "Teil B nennt typische GdS-Werte; eine Abweichung ist nach Teil A Nr. 1.4 mit besonderer Begründung im Einzelfall möglich.";
const STICHWORT_HINWEIS = "Stichwörter stammen aus dem Stichwortverzeichnis der BMAS-Broschüre K710 (redaktionelle Beigabe, nicht Teil der Verordnung).";
const LEER_HINWEIS =
  "Keine Treffer. Mit anderem Wortstamm suchen (z. B. „depressiv“ statt „Depression“) oder die Gliederung mit vmg_list_structure durchgehen.";
const ICD_LEER_HINWEIS = "Keine Stichwörter über diesen ICD-Kode abgeleitet; mit query nach einem Wortstamm suchen.";
const ICD_HINWEIS = "abgeleitet über ICD-Titel und Alphabet-Begriffe, nicht amtlich";
const TEILE = ["A", "B", "C", "D"];
const MAX_ZEILEN = 5;
const MAX_ICD_STICHWOERTER = 10;

// ---------------------------------------------------------------------------
// Kennungen und Anzeige
// ---------------------------------------------------------------------------

const squash = (s) => s.replace(/\s+/g, "").toLowerCase();
const byLoose = new Map(order.map((id) => [squash(id.slice(4)), id]));

/** "b3.7", "B 3.7", "VMG:B 3.7", "A 5 d jj" → "VMG:B 3.7", "VMG:A 5d jj" (unbekannte Kennungen nur sauber formatiert). */
export function normalizeVmgId(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/^anlage\s+zu\s+§\s*2\s+versmedv\s*,?\s*/i, "")
    .replace(/^teil\s+([A-D])\b\s*(?:nr\.?\s*)?/i, "$1 ")
    .trim()
    .replace(/^vmg\s*:?\s*/i, "");
  const known = byLoose.get(squash(s));
  if (known) return known;
  const t = s.replace(/\s+/g, " ");
  return `VMG:${t.charAt(0).toUpperCase()}${t.slice(1).replace(/^(\d)/, " $1")}`.trimEnd();
}

function requireNode(raw) {
  if (String(raw ?? "").trim() === "") throw new LookupError("VersMedV-Kennung fehlt, z. B. B 3.7 (Neurosen), A 5d jj oder D 1e.");
  const id = normalizeVmgId(raw);
  if (nodes[id]) return nodes[id];
  const teil = id.charAt(4);
  const near = order.filter((k) => k.startsWith(`VMG:${teil} `) && k.startsWith(id.slice(0, Math.min(id.length, 8)))).slice(0, 10);
  throw new LookupError(
    `VersMedV-Kennung "${raw}" nicht gefunden.` + (near.length ? ` Ähnliche Kennungen: ${near.map((k) => k.slice(4)).join(", ")}` : " Gliederung mit vmg_list_structure.")
  );
}

function fundstelle(n) {
  return `Anlage zu § 2 VersMedV, Teil ${n.teil}` + (n.nummer ? ` Nr. ${n.nummer}` : "");
}

function shorten(text, max) {
  const t = String(text).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[\s,;:(]+$/, "") + " …";
}

/** Anzeigebezeichnung: amtlicher Titel, sonst erste GdS-Zeile bzw. erster Absatz (dann titel_abgeleitet). */
function label(n) {
  if (n.titel) return { titel: n.titel, bezeichnung: n.titel };
  const src = n.zeilen?.[0]?.text ?? n.absaetze?.[0];
  if (src) return { titel: null, bezeichnung: shorten(src, 80), titel_abgeleitet: true };
  return { titel: null, bezeichnung: n.status ? `(${n.status})` : null };
}

const row = (z) => ({ text: z.text, ...(z.gds !== undefined ? { gds: z.gds } : {}), pfad: z.pfad ?? [] });

const stichwoerterOf = {};
for (const s of data.stichwoerter) for (const id of s.ids) (stichwoerterOf[id] ??= []).push(s.wort);

// ---------------------------------------------------------------------------
// Gliederung und Abruf
// ---------------------------------------------------------------------------

/** Teilbaum mit `depth` Ebenen unter dem Knoten (Infinity = vollständig); gekappte Äste tragen `weitere_unterabschnitte`. */
function tree(n, depth) {
  const { bezeichnung, ...rest } = label(n);
  const kids = n.children ?? [];
  const out = { id: n.id, ...rest, ...(bezeichnung !== n.titel ? { bezeichnung } : {}), ...(n.status ? { status: n.status } : {}) };
  if (kids.length && depth > 0) out.children = kids.map((c) => tree(nodes[c], depth - 1));
  else if (kids.length) out.weitere_unterabschnitte = kids.length;
  return out;
}

export function listStructure({ kennung, tiefe } = {}) {
  const hasKennung = kennung !== undefined && String(kennung).trim() !== "";
  const roots = hasKennung ? [requireNode(kennung).id] : order.filter((id) => !nodes[id].parent);
  let depth;
  if (tiefe === undefined || tiefe === null || tiefe === "") depth = 1;
  else {
    const t = Math.trunc(Number(tiefe));
    if (!Number.isFinite(t) || t < 0) throw new LookupError("tiefe muss eine ganze Zahl ≥ 0 sein (0 = vollständige Gliederung).");
    depth = t === 0 ? Infinity : t;
  }
  return { version: VMG_VERSION, tiefe: depth === Infinity ? 0 : depth, knoten: roots.map((id) => tree(nodes[id], depth)) };
}

export function get({ kennung }) {
  const n = requireNode(kennung);
  return {
    version: VMG_VERSION,
    id: n.id,
    fundstelle: fundstelle(n),
    ...label(n),
    ...(n.status ? { status: n.status } : {}),
    ...(n.absaetze ? { absaetze: n.absaetze } : {}),
    ...(n.zeilen ? { zeilen: n.zeilen.map(row) } : {}),
    ...(n.tabellen ? { tabellen: n.tabellen } : {}),
    children: (n.children ?? []).map((c) => ({ id: c, ...label(nodes[c]) })),
    parent: n.parent ?? null,
    stichwoerter: stichwoerterOf[n.id] ?? [],
    ...(stichwoerterOf[n.id]?.length ? { stichwoerter_hinweis: STICHWORT_HINWEIS } : {}),
    ...(n.teil === "B" && n.nummer ? { hinweis: ABWEICHUNG_HINWEIS } : {}),
  };
}

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

const W_TITEL = 10, W_STICHWORT = 7, W_ZEILE = 4, W_TEXT = 2;

const index = order.map((id) => {
  const n = nodes[id];
  return {
    n,
    titel: compact(n.titel ?? ""),
    stichwoerter: (stichwoerterOf[id] ?? []).map((w) => ({ wort: w, c: compact(w) })),
    zeilen: (n.zeilen ?? []).map((z) => ({ z, c: compact(`${z.text} ${(z.pfad ?? []).join(" ")}`) })),
    absaetze: (n.absaetze ?? []).map((a) => ({ a, c: compact(a) })),
  };
});

function searchText(entry, tokens) {
  let score = 0;
  for (const t of tokens) {
    let best = 0;
    if (entry.titel.includes(t)) best = W_TITEL;
    else if (entry.stichwoerter.some((s) => s.c.includes(t))) best = W_STICHWORT;
    else if (entry.zeilen.some((r) => r.c.includes(t))) best = W_ZEILE;
    else if (entry.absaetze.some((a) => a.c.includes(t))) best = W_TEXT;
    if (!best) return 0;
    score += best;
  }
  return score;
}

function resultFor(entry, tokens, score) {
  const { n } = entry;
  const hits = (c) => tokens.filter((t) => c.includes(t)).length;
  const zeilen = entry.zeilen
    .map((r, i) => ({ r, i, h: hits(r.c) }))
    .filter((x) => x.h > 0)
    .sort((a, b) => b.h - a.h || a.i - b.i)
    .slice(0, MAX_ZEILEN)
    .sort((a, b) => a.i - b.i)
    .map((x) => row(x.r.z));
  const sw = entry.stichwoerter.filter((s) => tokens.some((t) => s.c.includes(t))).sort((a, b) => hits(b.c) - hits(a.c))[0];
  let auszug;
  if (!n.titel && n.absaetze?.length) auszug = shorten(n.absaetze[0], 300);
  else if (!zeilen.length && !entry.titel && tokens.some((t) => entry.absaetze.some((a) => a.c.includes(t)))) {
    const sentences = n.absaetze.flatMap((a) => a.split(/(?<=[.;:])\s+/));
    const hit = sentences.find((s) => tokens.some((t) => compact(s).includes(t)));
    if (hit) auszug = shorten(hit, 300);
  }
  return {
    id: n.id,
    ...label(n),
    fundstelle: fundstelle(n),
    ...(zeilen.length ? { zeilen } : {}),
    ...(sw ? { stichwort: sw.wort } : {}),
    ...(auszug ? { auszug } : {}),
    _score: score,
  };
}

// Allgemeine Wörter aus ICD-Titeln, die keine Ableitung tragen.
const ICD_STOP = ["nicht naher bezeichnet", "nicht naher bezeichnete", "sonstige", "sonstiger", "sonstiges", "sonstigen", "nicht klassifiziert", "ohne angabe"];

function deriveFromIcd(raw) {
  const { code, title, begriffe } = alphabetTerms(raw);
  // Verneinte Teile („… ohne Adipositas“) tragen keine Ableitung: ab „ohne“ bis zum nächsten Komma, Semikolon, Doppelpunkt oder Satzende entfernen.
  const NEG = /\bohne\b[^,;:.]*/gi;
  let hay = [title, ...begriffe].map((t) => compact(t.replace(NEG, " ")));
  for (const s of ICD_STOP) hay = hay.map((h) => h.split(s).join(" "));
  const found = data.stichwoerter
    .map((s) => ({ wort: s.wort, ids: s.ids, c: compact(s.wort) }))
    .filter((s) => s.c.length >= 5 && hay.some((h) => h.includes(s.c)))
    .sort((a, b) => b.c.length - a.c.length)
    .slice(0, MAX_ICD_STICHWOERTER)
    .map(({ wort, ids }) => ({ wort, ids }));
  return { code, titel: title, stichwoerter: found, hinweis: ICD_HINWEIS };
}

export function search({ query, icd, teil, limit = 20 } = {}) {
  const hasQuery = query !== undefined && String(query).trim() !== "";
  const hasIcd = icd !== undefined && String(icd).trim() !== "";
  if (!hasQuery && !hasIcd) throw new LookupError("Bitte query oder icd angeben (Suchbegriff bzw. ICD-10-GM-Kode für die Ableitung von Stichwörtern).");
  let teilKey;
  if (teil !== undefined && teil !== null && String(teil).trim() !== "") {
    teilKey = String(teil).trim().toUpperCase();
    if (!TEILE.includes(teilKey)) throw new LookupError(`Teil "${teil}" unbekannt; erlaubt: A, B, C, D.`);
  }
  const max = Math.min(Math.max(Math.trunc(Number(limit)) || 20, 1), 100);
  const out = { version: VMG_VERSION };
  let results = [];
  if (hasQuery) {
    out.query = String(query);
    const tokens = fold(query).split(/\s+/).map((w) => compact(w)).filter(Boolean);
    for (const entry of index) {
      if (teilKey && entry.n.teil !== teilKey) continue;
      const score = searchText(entry, tokens);
      if (score) results.push(resultFor(entry, tokens, score));
    }
    results.sort((a, b) => b._score - a._score || position.get(a.id) - position.get(b.id));
  }
  out.total = results.length;
  out.results = results.slice(0, max).map(({ _score, ...r }) => r);
  if (hasQuery && !out.results.length) out.hinweis_leer = LEER_HINWEIS;
  if (hasIcd) {
    out.abgeleitet_icd = deriveFromIcd(icd);
    if (!out.abgeleitet_icd.stichwoerter.length) {
      out.abgeleitet_icd.hinweis_leer = ICD_LEER_HINWEIS;
      if (!hasQuery) out.hinweis_leer = LEER_HINWEIS;
    }
  }
  if (out.results.some((r) => r.stichwort)) out.stichwoerter_hinweis = STICHWORT_HINWEIS;
  return out;
}

// ---------------------------------------------------------------------------
// Prüfhilfe Gesamt-GdB (rechnet nichts; zeigt Regeln, Funktionssysteme und Markierungen)
// ---------------------------------------------------------------------------

const GESAMT_HINWEIS =
  "Es wird kein Gesamt-GdB berechnet. Nach Teil A Nr. 3 ist der Gesamt-GdB aus einer gutachterlichen Gesamtschau zu bilden; Einzel-GdB dürfen nicht addiert werden.";
const REGEL_IDS = ["VMG:A 3.1", "VMG:A 3.2", "VMG:A 3.3", "VMG:A 3.3.1", "VMG:A 3.3.2", "VMG:A 3.3.3", "VMG:A 3.3.4", "VMG:A 3.4", "VMG:A 3.5"];
const textOf = (id) => nodes[id].absaetze.join(" ");

// Zuordnung innerhalb von Teil B Nr. 18 (Haltungs- und Bewegungsorgane): verwaltungsübliche Gliederung, nicht amtlich.
const B18_SYSTEME = { "18.9": "Rumpf", "18.10": "Rumpf", "18.13": "Arme", "18.14": "Beine" };
const B18_OFFEN = "Haltungs- und Bewegungsorgane, nicht näher zugeordnet";
const B18_ZUGEORDNET = new Set(Object.values(B18_SYSTEME));

/** Funktionssystem zu einer Kennung: { funktionssystem, quelle } oder { funktionssystem: null, hinweis }. */
function systemOf(n) {
  if (n.teil !== "B") return { funktionssystem: null, hinweis: "Funktionssystem nicht bestimmbar (Kennung liegt außerhalb von Teil B)" };
  let k = n;
  while (k.parent && k.parent !== "VMG:B") k = nodes[k.parent];
  if (k.parent !== "VMG:B") return { funktionssystem: null, hinweis: "Funktionssystem nicht bestimmbar (kein Kapitel von Teil B)" };
  if (k.nummer !== "18") {
    if (k.status || !k.titel) return { funktionssystem: null, hinweis: `Funktionssystem nicht bestimmbar (Kapitel B ${k.nummer}: ${k.status ?? "ohne Titel"})` };
    return { funktionssystem: k.titel, quelle: "teil_b" };
  }
  let u = n;
  while (u.parent && u.parent !== "VMG:B 18") u = nodes[u.parent];
  const sys = u.parent === "VMG:B 18" ? B18_SYSTEME[u.nummer] : undefined;
  return { funktionssystem: sys ?? B18_OFFEN, quelle: "verwaltungsueblich" };
}

function gdbEntry(e, i) {
  const pos = `einzel[${i}]`;
  if (!e || typeof e !== "object") throw new LookupError(`${pos}: Objekt mit bezeichnung und gdb erwartet.`);
  if (typeof e.bezeichnung !== "string" || e.bezeichnung.trim() === "") throw new LookupError(`${pos}: bezeichnung fehlt oder ist leer.`);
  if (!Number.isInteger(e.gdb) || e.gdb <= 0 || e.gdb > 100 || e.gdb % 10 !== 0)
    throw new LookupError(`${pos} (${e.bezeichnung}): gdb muss eine ganze Zahl von 10 bis 100 in Zehnerschritten sein (erhalten: ${JSON.stringify(e.gdb)}). Nach Teil A Nr. 1.1 wird der GdB in Zehnergraden festgestellt; Teil B nennt teils Zwischenwerte (z. B. 25), die für die Prüfhilfe auf einen Zehnergrad zu bringen sind.`);
  return e;
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

export function gesamtGdb({ einzel } = {}) {
  if (!Array.isArray(einzel) || einzel.length === 0) throw new LookupError("einzel muss eine nichtleere Liste mit Einträgen {bezeichnung, gdb, kennung?, funktionssystem?} sein.");
  const eintraege = einzel.map((raw, i) => {
    const e = gdbEntry(raw, i);
    let sys = { funktionssystem: null, quelle: null };
    let hinweis;
    if (e.kennung !== undefined && String(e.kennung).trim() !== "") {
      const s = systemOf(requireNode(e.kennung));
      sys = { funktionssystem: s.funktionssystem, quelle: s.quelle ?? null };
      hinweis = s.hinweis;
    }
    if (typeof e.funktionssystem === "string" && e.funktionssystem.trim() !== "") sys = { funktionssystem: e.funktionssystem.trim(), quelle: "angabe" };
    if (!sys.funktionssystem) hinweis ??= "Funktionssystem nicht bestimmbar";
    return {
      index: i,
      bezeichnung: e.bezeichnung.trim(),
      gdb: e.gdb,
      ...(e.kennung !== undefined && String(e.kennung).trim() !== "" ? { kennung: normalizeVmgId(e.kennung) } : {}),
      funktionssystem: sys.funktionssystem,
      funktionssystem_quelle: sys.quelle,
      ...(hinweis ? { hinweis } : {}),
      markierungen: [],
    };
  });

  const paare = [];
  for (let i = 0; i < eintraege.length; i++)
    for (let j = i + 1; j < eintraege.length; j++) {
      const a = eintraege[i], b = eintraege[j];
      if (!a.funktionssystem || !b.funktionssystem) continue;
      const offenA = same(a.funktionssystem, B18_OFFEN), offenB = same(b.funktionssystem, B18_OFFEN);
      const zugeordnet = (x) => [...B18_ZUGEORDNET].some((s) => same(s, x));
      let beziehung, grund;
      if (offenA && offenB) {
        beziehung = "moeglicherweise_gleich";
        grund = "Beide Einträge sind Teil B Nr. 18 ohne nähere Zuordnung; ob dasselbe Funktionssystem betroffen ist, ist im Einzelfall zu prüfen.";
      } else if ((offenA && zugeordnet(b.funktionssystem)) || (offenB && zugeordnet(a.funktionssystem))) {
        beziehung = "moeglicherweise_gleich";
        grund = `Ein Eintrag ist Teil B Nr. 18 ohne nähere Zuordnung, der andere ${offenA ? b.funktionssystem : a.funktionssystem} (verwaltungsübliche Gliederung, nicht amtlich); Zusammenhang im Einzelfall zu prüfen.`;
      } else if (same(a.funktionssystem, b.funktionssystem)) {
        beziehung = "gleich";
        grund = `Beide Einträge gehören zum Funktionssystem „${a.funktionssystem}“ (Teil A Nr. 3.1: GdB für das Funktionssystem in seiner Gesamtheit).`;
      } else continue;
      paare.push({ a: a.bezeichnung, b: b.bezeichnung, a_index: i, b_index: j, beziehung, grund });
    }

  const textA35 = textOf("VMG:A 3.5");
  const inPaar = new Set(paare.flatMap((p) => [p.a_index, p.b_index]));
  for (const e of eintraege) {
    if (e.gdb === 10 || e.gdb === 20) e.markierungen.push({ regel: "VMG:A 3.5", text: textA35 });
    if (inPaar.has(e.index))
      for (const id of ["VMG:A 3.1", "VMG:A 3.2"]) e.markierungen.push({ regel: id, text: textOf(id) });
  }

  const max = eintraege.reduce((m, e) => (e.gdb > m.gdb ? e : m));
  return {
    version: VMG_VERSION,
    ausgangswert: max.gdb,
    ausgangseintrag: max.bezeichnung,
    eintraege,
    paare,
    regeln: REGEL_IDS.map((id) => ({ id, text: textOf(id) })),
    hinweis: GESAMT_HINWEIS,
  };
}

// ---------------------------------------------------------------------------
// Merkzeichen
// ---------------------------------------------------------------------------

// Fundstellen in der VersMedV; Merkzeichen ohne Regelung dort verweisen auf die Norm (am Quelltext gesetze-im-internet.de geprüft).
const MERKZEICHEN = [
  { zeichen: "G", bezeichnung: "Erhebliche Beeinträchtigung der Bewegungsfähigkeit im Straßenverkehr", ids: ["VMG:D 1"] },
  {
    zeichen: "aG", bezeichnung: "Außergewöhnliche Gehbehinderung",
    norm: "§ 229 Abs. 3 SGB IX",
    hinweis: "Erheblich mobilitätsbezogene Teilhabebeeinträchtigung, die einem GdB von mindestens 80 entspricht; dauernd nur mit fremder Hilfe oder mit großer Anstrengung außerhalb des Kraftfahrzeugs fortbewegbar (sinngemäß nach § 229 Abs. 3 SGB IX; maßgeblich ist der Gesetzeswortlaut). Die VersMedV enthält dazu keine eigene Nummer.",
  },
  { zeichen: "B", bezeichnung: "Berechtigung für eine ständige Begleitung", ids: ["VMG:D 2"] },
  { zeichen: "H", bezeichnung: "Hilflosigkeit", ids: ["VMG:A 4", "VMG:A 5"] },
  { zeichen: "Bl", bezeichnung: "Blindheit und hochgradige Sehbehinderung", ids: ["VMG:A 6"] },
  { zeichen: "Gl", bezeichnung: "Gehörlosigkeit", ids: ["VMG:D 4"] },
  {
    zeichen: "RF", bezeichnung: "Ermäßigung beim Rundfunkbeitrag",
    norm: "Rundfunkbeitragsstaatsvertrag (Landesrecht), Ermäßigung nach § 4",
    hinweis: "Die gesundheitlichen Voraussetzungen sind landesrechtlich festgelegt (§ 3 Abs. 1 Nr. 5 Schwerbehindertenausweisverordnung). Die genaue Fundstelle im Rundfunkbeitragsstaatsvertrag (§ 4) wurde nicht an einer amtlichen Landesrechtsquelle geprüft; die VersMedV enthält dazu keine eigene Nummer.",
  },
  {
    zeichen: "TBl", bezeichnung: "Taubblindheit",
    norm: "§ 3 Abs. 1 Nr. 8 Schwerbehindertenausweisverordnung",
    hinweis: "Mindestens GdB 70 wegen einer Störung der Hörfunktion und GdB 100 wegen einer Störung des Sehvermögens (sinngemäß nach § 3 Abs. 1 Nr. 8 SchwbAwV; maßgeblich ist der Gesetzeswortlaut). Die VersMedV enthält dazu keine eigene Nummer.",
  },
];

/** Alle Nachfahren in Dokumentreihenfolge, mit Wortlaut (Absätze, GdS-Zeilen, Tabellen). */
function descendants(n) {
  return (n.children ?? []).flatMap((c) => {
    const k = nodes[c];
    return [
      {
        id: k.id,
        fundstelle: fundstelle(k),
        ...label(k),
        ...(k.status ? { status: k.status } : {}),
        absaetze: k.absaetze ?? [],
        ...(k.zeilen ? { zeilen: k.zeilen.map(row) } : {}),
        ...(k.tabellen ? { tabellen: k.tabellen } : {}),
      },
      ...descendants(k),
    ];
  });
}

export function merkzeichen({ merkzeichen: wanted } = {}) {
  let list = MERKZEICHEN;
  if (wanted !== undefined && wanted !== null && String(wanted).trim() !== "") {
    const key = String(wanted).trim().toLowerCase();
    list = MERKZEICHEN.filter((m) => m.zeichen.toLowerCase() === key);
    if (!list.length) throw new LookupError(`Merkzeichen "${wanted}" unbekannt; erlaubt: ${MERKZEICHEN.map((m) => m.zeichen).join(", ")}.`);
  }
  return {
    version: VMG_VERSION,
    merkzeichen: list.map((m) =>
      m.ids
        ? {
            zeichen: m.zeichen,
            bezeichnung: m.bezeichnung,
            fundstellen: m.ids.map((id) => ({
              id,
              fundstelle: fundstelle(nodes[id]),
              absaetze: nodes[id].absaetze ?? [],
              ...(nodes[id].children?.length ? { unterabschnitte: descendants(nodes[id]) } : {}),
            })),
          }
        : { zeichen: m.zeichen, bezeichnung: m.bezeichnung, norm: m.norm, hinweis: m.hinweis }
    ),
  };
}
