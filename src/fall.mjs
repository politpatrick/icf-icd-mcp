// Fallprofil: versioniertes Austauschformat für einen Fall (ICD-10-GM, ICF, Begutachtungsinstrument, VersMedV)
// nach dem biopsychosozialen Modell der ICF. Zustandslos: Profile werden nur geprüft, übersetzt und verglichen,
// nie gespeichert. Keine Rechtsberatung, keine Bewertung des Falls.

import { readData } from "./data.mjs";

export const FALLPROFIL_VERSION = "1";

const SCHEMA = readData("fallprofil-1.schema.json");
const BEISPIEL = readData("fallprofil-1.beispiel.json");

const FELDER = `Fallprofil Version 1 (JSON). Pflicht: fallprofil "1", meta.pseudonym (Pseudonym: frei gewählte Bezeichnung, kein Klarname), meta.stichtag (JJJJ-MM-TT).
eintraege[]: id, art (icd | icf | bi | vmg | merkzeichen | personbezogen), kode in der Schreibweise des Moduls (F20.0 G, d450.23, e310+3, BI:4.1.3=2, VMG:B 3.7, Merkzeichen G/aG/B/H/Bl/Gl/RF/TBl; bei personbezogen stattdessen text), herkunft (selbstauskunft | interview | material | befund | gutachten | bescheid); optional begruendung, beleg {quelle, datum, seite}, o_ton, status (belegt | geschildert | offen), dauer, richtung (nur ICF-d), gdb (nur vmg), verfahren (Verweis).
zusammenhaenge[]: von, nach, art (verursacht: icd → icf; beeintraechtigt: icf b/s → icf d; foerdert/hemmt: icf e oder personbezogen → icf; entspricht: zwischen icf, bi, vmg).
ziele[]: id, text, eintraege[], gewuenschte_unterstuetzung. verfahren[]: id, art, bereich, datum, ergebnis.
Keine Felder für Namen, Anschriften, Versicherungs- oder Aktennummern; unbekannte Felder werden abgelehnt.`;

/** Format, Feldbeschreibung und Beispielprofil. */
export function schema() {
  return { version: FALLPROFIL_VERSION, schema: SCHEMA, beispiel: BEISPIEL, felder: FELDER };
}

// --- Formprüfung nach dem Schema (genau die Schlüsselwörter, die das Schema verwendet) ---

function resolve(node) {
  while (node?.$ref) {
    const extra = { ...node };
    delete extra.$ref;
    node = { ...node.$ref.replace(/^#\//, "").split("/").reduce((n, k) => n[k], SCHEMA), ...extra };
  }
  return node;
}

const typeOf = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);

function check(value, node, pfad, fehler) {
  node = resolve(node);
  const add = (meldung) => fehler.push({ pfad: pfad || "(Profil)", meldung });
  if ("const" in node && value !== node.const) return add(`muss "${node.const}" sein`);
  if (node.enum && !node.enum.includes(value)) return add(`unzulässiger Wert ${JSON.stringify(value)}; erlaubt: ${node.enum.join(", ")}`);
  const t = typeOf(value);
  if (node.type && !(node.type === t || (node.type === "number" && t === "integer"))) {
    return add(`erwartet ${{ object: "ein Objekt", array: "eine Liste", string: "einen Text", integer: "eine ganze Zahl" }[node.type] ?? node.type}`);
  }
  if (t === "string") {
    if (node.minLength && value.length < node.minLength) add("darf nicht leer sein");
    if (node.maxLength && value.length > node.maxLength) add(`höchstens ${node.maxLength} Zeichen`);
    if (node.pattern && !new RegExp(node.pattern).test(value)) add(pfad.endsWith("datum") || pfad.endsWith("stichtag") ? "Datum im Format JJJJ-MM-TT" : `ungültiges Format (${node.pattern})`);
  }
  if (t === "integer") {
    if (node.minimum !== undefined && value < node.minimum) add(`mindestens ${node.minimum}`);
    if (node.maximum !== undefined && value > node.maximum) add(`höchstens ${node.maximum}`);
    if (node.multipleOf && value % node.multipleOf !== 0) add(`muss ein Vielfaches von ${node.multipleOf} sein`);
  }
  if (t === "array") {
    if (node.maxItems && value.length > node.maxItems) return add(`höchstens ${node.maxItems} Elemente`);
    value.forEach((item, i) => check(item, node.items, `${pfad}[${i}]`, fehler));
  }
  if (t === "object") {
    for (const key of node.required ?? []) if (!(key in value)) fehler.push({ pfad: join(pfad, key), meldung: "Pflichtfeld fehlt" });
    for (const [key, v] of Object.entries(value)) {
      if (node.properties?.[key]) check(v, node.properties[key], join(pfad, key), fehler);
      else if (node.additionalProperties === false) fehler.push({ pfad: join(pfad, key), meldung: "unbekanntes Feld (nicht zulässig)" });
    }
  }
}

const join = (pfad, key) => (pfad ? `${pfad}.${key}` : key);

// --- Inhaltliche Formregeln, die ein JSON-Schema nicht ausdrückt ---

function semantics(p, fehler) {
  const add = (pfad, meldung) => fehler.push({ pfad, meldung });
  const eintraege = Array.isArray(p.eintraege) ? p.eintraege : [];
  const ids = new Map();
  eintraege.forEach((e, i) => {
    if (!e || typeof e !== "object") return;
    if (ids.has(e.id)) add(`eintraege[${i}].id`, `Id "${e.id}" ist doppelt vergeben`);
    else ids.set(e.id, e);
    if (e.art === "personbezogen") {
      if (!e.text) add(`eintraege[${i}].text`, "bei personbezogenen Faktoren Pflicht");
    } else if (e.art && !e.kode) add(`eintraege[${i}].kode`, "Pflichtfeld fehlt");
    if (e.gdb !== undefined && e.art !== "vmg") add(`eintraege[${i}].gdb`, "nur bei Einträgen der Art vmg zulässig");
    if (e.richtung !== undefined && !(e.art === "icf" && /^d/i.test(e.kode ?? ""))) add(`eintraege[${i}].richtung`, "nur bei ICF-Einträgen der Komponente d zulässig");
  });
  const verfahrenIds = new Set((Array.isArray(p.verfahren) ? p.verfahren : []).map((v) => v?.id));
  eintraege.forEach((e, i) => {
    if (e?.verfahren !== undefined && !verfahrenIds.has(e.verfahren)) add(`eintraege[${i}].verfahren`, `kein Verfahren mit der Id "${e.verfahren}"`);
  });
  (Array.isArray(p.zusammenhaenge) ? p.zusammenhaenge : []).forEach((z, i) => {
    for (const end of ["von", "nach"]) if (z?.[end] !== undefined && !ids.has(z[end])) add(`zusammenhaenge[${i}].${end}`, `kein Eintrag mit der Id "${z[end]}"`);
  });
  (Array.isArray(p.ziele) ? p.ziele : []).forEach((z, i) => {
    (z?.eintraege ?? []).forEach((id, j) => { if (!ids.has(id)) add(`ziele[${i}].eintraege[${j}]`, `kein Eintrag mit der Id "${id}"`); });
  });
  (Array.isArray(p.verfahren) ? p.verfahren : []).forEach((v, i) => {
    const erg = v?.ergebnis ?? {};
    if (erg.pflegegrad !== undefined && v.bereich !== "pflege") add(`verfahren[${i}].ergebnis.pflegegrad`, "nur bei bereich pflege");
    for (const k of ["gdb", "merkzeichen"]) if (erg[k] !== undefined && v.bereich !== "gdb") add(`verfahren[${i}].ergebnis.${k}`, "nur bei bereich gdb");
  });
}

/**
 * Liest ein Fallprofil (Objekt oder JSON-Text) und prüft die Form.
 * Kodes werden hier nicht fachlich geprüft (siehe pruefen).
 */
export function parseProfil(input) {
  let profil = input;
  if (typeof input === "string") {
    try {
      profil = JSON.parse(input);
    } catch (err) {
      return { profil: null, fehler: [{ pfad: "(Profil)", meldung: `kein gültiges JSON: ${err.message}` }] };
    }
  }
  if (!profil || typeof profil !== "object" || Array.isArray(profil)) {
    return { profil: null, fehler: [{ pfad: "(Profil)", meldung: "Das Fallprofil muss ein JSON-Objekt sein" }] };
  }
  const fehler = [];
  check(profil, SCHEMA, "", fehler);
  semantics(profil, fehler);
  return { profil, fehler };
}
