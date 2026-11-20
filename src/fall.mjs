// Fallprofil: versioniertes Austauschformat für einen Fall (ICD-10-GM, ICF, Begutachtungsinstrument, VersMedV)
// nach dem biopsychosozialen Modell der ICF. Zustandslos: Profile werden nur geprüft, übersetzt und verglichen,
// nie gespeichert. Keine Rechtsberatung, keine Bewertung des Falls.

import { readData } from "./data.mjs";
import * as icd from "./icd.mjs";
import * as icf from "./icf.mjs";
import * as bi from "./bi.mjs";
import * as vmg from "./vmg.mjs";
import { BI_ENABLED } from "./bi_tools.mjs";
import { VMG_ENABLED } from "./vmg_tools.mjs";
import { LookupError, compact } from "./text.mjs";

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
      if (node.properties && Object.hasOwn(node.properties, key)) check(v, node.properties[key], join(pfad, key), fehler);
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
    (Array.isArray(z?.eintraege) ? z.eintraege : []).forEach((id, j) => { if (!ids.has(id)) add(`ziele[${i}].eintraege[${j}]`, `kein Eintrag mit der Id "${id}"`); });
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

// --- Fachliche Prüfung ---


/** Lebensbereiche nach § 118 Abs. 1 Satz 3 SGB IX (= Kapitel d1–d9 der ICF). */
const LEBENSBEREICHE = [
  "Lernen und Wissensanwendung",
  "Allgemeine Aufgaben und Anforderungen",
  "Kommunikation",
  "Mobilität",
  "Selbstversorgung",
  "häusliches Leben",
  "interpersonelle Interaktionen und Beziehungen",
  "bedeutende Lebensbereiche",
  "Gemeinschafts-, soziales und staatsbürgerliches Leben",
];

const MERKZEICHEN = {
  G: "erheblich beeinträchtigt in der Bewegungsfähigkeit im Straßenverkehr",
  aG: "außergewöhnlich gehbehindert",
  B: "Berechtigung für eine ständige Begleitung",
  H: "hilflos",
  Bl: "blind",
  Gl: "gehörlos",
  RF: "Ermäßigung des Rundfunkbeitrags",
  TBl: "taubblind",
};

const DATENSCHUTZ =
  "Das Fallprofil wird nur geprüft und nicht gespeichert. Bitte ein Pseudonym statt des Namens verwenden und keine Anschriften, Versicherungs- oder Aktennummern in Freitexte schreiben.";

const KURATIERT = "kuratiert, nicht amtlich";
const MAX_HINWEISTEXTE = 5;

/** ICF-Komponente (b, s, d, e) eines ICF-Eintrags. */
const komponente = (e) => (e.art === "icf" ? String(e.kode ?? "").trim()[0]?.toLowerCase() : null);

/** Grundkode für Doppelungen und Vergleich (ohne Beurteilungsmerkmal, Zusatzkennzeichen oder Wert). */
export function grundkode(e) {
  const kode = String(e.kode ?? "").trim();
  switch (e.art) {
    case "icd":
      return icd.normalizeIcdCode(kode.split(/\s+/)[0]);
    case "icf":
      return kode.split(/[.+]/)[0].toLowerCase();
    case "bi":
      try {
        const r = bi.interpretCoding({ coding: kode }).ergebnisse;
        if (r.length === 1 && r[0].gueltig) return r[0].code;
      } catch {
        // fällt auf die Schreibweise zurück
      }
      return kode.split("=")[0].replace(/^(BI:)?/i, "BI:").replace(/\s+/g, "");
    case "vmg":
      try {
        return vmg.normalizeVmgId(kode);
      } catch {
        return kode;
      }
    case "personbezogen":
      return compact(e.text ?? "").replace(/\s+/g, " ").trim();
    default:
      return kode;
  }
}

/** ICD-Zusatzkennzeichen (Diagnosesicherheit, Seite). */
const zusatz = (e) => String(e.kode ?? "").trim().split(/\s+/).slice(1).join(" ");

const ERLAUBT = {
  verursacht: (v, n) => v.art === "icd" && ["b", "s", "d"].includes(komponente(n)),
  beeintraechtigt: (v, n) => ["b", "s"].includes(komponente(v)) && komponente(n) === "d",
  foerdert: (v, n) => (komponente(v) === "e" || v.art === "personbezogen") && ["b", "s", "d"].includes(komponente(n)),
  hemmt: (v, n) => (komponente(v) === "e" || v.art === "personbezogen") && ["b", "s", "d"].includes(komponente(n)),
  entspricht: (v, n) => ["icf", "bi", "vmg"].includes(v.art) && ["icf", "bi", "vmg"].includes(n.art) && v.art !== n.art,
};

const REGEL = {
  verursacht: "„verursacht“ verbindet eine Diagnose (icd) mit einer ICF-Kategorie aus b, s oder d",
  beeintraechtigt: "„beeintraechtigt“ führt von einer Körperfunktion oder -struktur (b, s) zu Aktivität und Teilhabe (d)",
  foerdert: "„foerdert“ führt von einem Umweltfaktor (e) oder personbezogenen Faktor zu b, s oder d",
  hemmt: "„hemmt“ führt von einem Umweltfaktor (e) oder personbezogenen Faktor zu b, s oder d",
  entspricht: "„entspricht“ verbindet Einträge verschiedener Systeme (icf, bi, vmg)",
};

/** Prüft einen Eintrag fachlich; liefert Klartext und Warnungen oder wirft LookupError. */
function pruefeEintrag(e) {
  switch (e.art) {
    case "icd": {
      const r = icd.checkCode({ code: e.kode });
      return { klartext: `${r.code} ${r.title}${r.certainty ? ` (${r.certainty})` : ""}`, warnungen: r.warnings ?? [] };
    }
    case "icf": {
      const r = icf.interpretCoding({ coding: e.kode });
      const warnungen = [...(r.warnings ?? [])];
      if (r.kind === "chapter") warnungen.push("Kapitel statt Kategorie – zu allgemein für eine Beschreibung.");
      const merkmale = (r.qualifiers ?? []).map((q) => `${q.position}: ${q.meaning}`).join("; ");
      return { klartext: `${r.code} ${r.title}${merkmale ? ` – ${merkmale}` : ""}`, warnungen };
    }
    case "bi": {
      const ergebnisse = bi.interpretCoding({ coding: e.kode }).ergebnisse;
      if (ergebnisse.length !== 1) throw new LookupError("Ein BI-Eintrag darf genau eine Kodierung enthalten, z. B. BI:4.1.3=2. Mehrere Kriterien bitte als eigene Einträge erfassen.");
      const r = ergebnisse[0];
      if (!r.gueltig) throw new LookupError(r.fehler);
      const wert = r.label ?? (r.anzahl !== undefined ? `${r.anzahl}× je ${r.je}` : r.wert ?? r.art);
      return { klartext: `${r.code} ${r.titel}: ${wert}`, warnungen: [], kodierung: r.kodierung };
    }
    case "vmg": {
      const r = vmg.get({ kennung: e.kode });
      const titel = r.titel ?? r.bezeichnung ?? "";
      return { klartext: `${r.fundstelle}${titel ? ` – ${titel}` : ""}${e.gdb ? `; angegebener Einzel-GdB ${e.gdb}` : ""}`, warnungen: [] };
    }
    case "merkzeichen": {
      if (!Object.hasOwn(MERKZEICHEN, e.kode)) throw new LookupError(`Unbekanntes Merkzeichen "${e.kode}". Erlaubt: ${Object.keys(MERKZEICHEN).join(", ")}.`);
      return { klartext: `Merkzeichen ${e.kode}: ${MERKZEICHEN[e.kode]}`, warnungen: [] };
    }
    case "personbezogen":
      return { klartext: `Personbezogener Faktor: ${e.text}`, warnungen: [] };
    default:
      return { klartext: "", warnungen: [] };
  }
}

const modulAus = (e) => (e.art === "bi" && !BI_ENABLED) || (e.art === "vmg" && !VMG_ENABLED);

const alterMonate = (meta) => (meta?.alter?.monate ?? (meta?.alter?.jahre !== undefined ? meta.alter.jahre * 12 : undefined));

/**
 * Prüft ein Fallprofil fachlich: Kodes, Zusammenhänge, Lücken, Lebensbereiche, Querverweise und
 * (nur bei vollständigen Angaben) eine Pflegegrad-Orientierung je Herkunft. Bewertet den Fall nicht.
 */
function pruefenIntern({ profil: input } = {}) {
  const { profil, fehler } = parseProfil(input);
  const leer = { fallprofil: FALLPROFIL_VERSION, gueltig: false, fehler, datenschutz: DATENSCHUTZ, eintraege: [], zusammenhaenge: [], hinweise: [], lebensbereiche: [], querverweise: [], pflege: [] };
  if (!profil) return leer;

  const eintraege = Array.isArray(profil.eintraege) ? profil.eintraege.filter((e) => e && typeof e === "object") : [];
  const ok = new Map(); // id → Eintrag, fachlich gültig
  const ausgabe = [];
  const hinweise = new Map();
  const hinweis = (kennung, id, text) => {
    if (!hinweise.has(kennung)) hinweise.set(kennung, { kennung, eintraege: [], texte: [] });
    const h = hinweise.get(kennung);
    if (id) h.eintraege.push(id);
    h.texte.push(text);
  };

  eintraege.forEach((e, i) => {
    if (modulAus(e)) {
      hinweis("modul_aus", e.id, `${e.art === "bi" ? "Das Modul Begutachtungsinstrument" : "Das Modul VersMedV"} ist abgeschaltet; ${e.kode} wurde nicht geprüft.`);
      ausgabe.push({ id: e.id, art: e.art, kode: e.kode, klartext: `${e.kode} (nicht geprüft, Modul abgeschaltet)`, warnungen: [] });
      return;
    }
    if (e.art !== "personbezogen" && !e.kode) return;
    try {
      const { klartext, warnungen, kodierung } = pruefeEintrag(e);
      ok.set(e.id, kodierung ? { ...e, _kodierung: kodierung } : e);
      ausgabe.push({ id: e.id, art: e.art, kode: e.kode, klartext, ...(e.richtung ? { richtung: e.richtung } : {}), warnungen });
    } catch (err) {
      const meldung = err instanceof LookupError ? err.message : "Dieser Eintrag konnte wegen eines internen Fehlers nicht geprüft werden.";
      fehler.push({ pfad: `eintraege[${i}].kode`, meldung });
      ausgabe.push({ id: e.id, art: e.art, kode: e.kode, klartext: "", warnungen: [meldung] });
    }
  });

  const zusammenhaenge = (Array.isArray(profil.zusammenhaenge) ? profil.zusammenhaenge : []).map((z) => {
    const v = ok.get(z?.von);
    const n = ok.get(z?.nach);
    if (!v || !n) return { von: z?.von, nach: z?.nach, art: z?.art, gueltig: false, meldung: "Mindestens ein Ende ist kein gültiger Eintrag." };
    if (!Object.hasOwn(ERLAUBT, z.art) || !ERLAUBT[z.art](v, n)) return { von: z.von, nach: z.nach, art: z.art, gueltig: false, meldung: `Diese Verbindung passt nicht: ${Object.hasOwn(REGEL, z.art) ? REGEL[z.art] : "unbekannte Art"}.` };
    return { von: z.von, nach: z.nach, art: z.art, gueltig: true };
  });
  const gueltigeZ = zusammenhaenge.filter((z) => z.gueltig);
  const eingehend = (id, arten) => gueltigeZ.some((z) => z.nach === id && arten.includes(z.art));
  const ausgehend = (id, art) => gueltigeZ.some((z) => z.von === id && z.art === art);

  for (const e of ok.values()) {
    const k = komponente(e);
    if (k === "d" && !eingehend(e.id, ["verursacht", "beeintraechtigt"])) {
      hinweis("d_ohne_ursache", e.id, `Zu ${grundkode(e)} ist noch keine Ursache (Gesundheitsproblem oder Körperfunktion/-struktur) verknüpft.`);
    }
    if (k === "e") {
      const kode = String(e.kode);
      if (kode.includes("+")) {
        if (!ausgehend(e.id, "foerdert")) hinweis("foerderfaktor_ohne_bezug", e.id, `Der Förderfaktor ${grundkode(e)} wirkt noch auf keinen Eintrag.`);
      } else if (kode.includes(".")) {
        if (!ausgehend(e.id, "hemmt")) hinweis("barriere_ohne_bezug", e.id, `Die Barriere ${grundkode(e)} wirkt noch auf keinen Eintrag.`);
      } else {
        hinweis("umweltfaktor_ohne_merkmal", e.id, `Ist ${grundkode(e)} eine Barriere (z. B. ${grundkode(e)}.2) oder ein Förderfaktor (z. B. ${grundkode(e)}+2)?`);
      }
    }
  }
  for (const e of eintraege) {
    if (e.status === "offen") hinweis("offen", e.id, `Noch offen: ${e.kode ?? e.text}.`);
    if (e.status === "belegt" && !e.beleg) hinweis("ohne_beleg", e.id, `${e.kode ?? e.text} ist als belegt markiert, aber ohne Beleg angegeben.`);
  }
  if (Array.isArray(profil.meta?.zweck) && profil.meta.zweck.includes("teilhabe")) {
    const da = (pred) => [...ok.values()].some(pred);
    const fehlt = [
      ["Gesundheitsproblem (ICD)", (e) => e.art === "icd"],
      ["Körperfunktionen oder -strukturen (b, s)", (e) => ["b", "s"].includes(komponente(e))],
      ["Aktivitäten und Teilhabe (d)", (e) => komponente(e) === "d"],
      ["Umweltfaktoren (e)", (e) => komponente(e) === "e"],
      ["personbezogene Faktoren", (e) => e.art === "personbezogen"],
    ].filter(([, pred]) => !da(pred)).map(([name]) => name);
    if (fehlt.length) hinweis("komponente_fehlt", null, `Für eine Bedarfsbeschreibung fehlen noch: ${fehlt.join(", ")}.`);
  }
  const gruppen = new Map();
  for (const e of ok.values()) {
    const key = `${e.art}|${grundkode(e)}|${e.herkunft}`;
    (gruppen.get(key) ?? gruppen.set(key, []).get(key)).push(e);
  }
  for (const gruppe of gruppen.values()) {
    if (gruppe.length < 2) continue;
    const widerspruch = gruppe[0].art === "icd" && new Set(gruppe.map(zusatz)).size > 1;
    hinweis("doppelt", null, `${grundkode(gruppe[0])} ist ${gruppe.length}-mal aus derselben Herkunft (${gruppe[0].herkunft}) erfasst${widerspruch ? " – widersprüchliche Diagnosesicherheit" : ""}.`);
    hinweise.get("doppelt").eintraege.push(...gruppe.map((e) => e.id));
  }
  for (const z of Array.isArray(profil.ziele) ? profil.ziele : []) {
    if (!z?.eintraege?.length) hinweis("ziel_ohne_bezug", null, `Das Ziel „${z?.text}“ ist noch keinem Eintrag zugeordnet.`);
  }
  const biEintraege = [...ok.values()].filter((e) => e.art === "bi");
  if (biEintraege.length && !profil.meta?.alter) hinweis("alter_fehlt", null, "Ohne Altersangabe wird die Fassung für Erwachsene verwendet; bei Kindern bitte das Alter in Monaten angeben.");

  const lebensbereiche = LEBENSBEREICHE.map((titel, i) => ({
    nummer: i + 1,
    titel,
    eintraege: [...ok.values()]
      .filter((e) => komponente(e) === "d" && String(e.kode).trim()[1] === String(i + 1))
      .map((e) => ({ id: e.id, kode: e.kode, ...(e.richtung ? { richtung: e.richtung } : {}) })),
  }));

  const querverweise = [];
  if (BI_ENABLED) {
    for (const e of ok.values()) {
      if (e.art !== "icf") continue;
      const treffer = bi.biForIcf(grundkode(e));
      if (treffer.length) querverweise.push({ icf: grundkode(e), bi_kriterien: treffer.map((t) => ({ bi: t.bi, titel: t.titel, beziehung: t.beziehung })), quelle: KURATIERT });
    }
  }

  const pflege = [];
  const alterFehlerhaft = fehler.some((f) => f.pfad.startsWith("meta.alter"));
  if (BI_ENABLED && biEintraege.length && !alterFehlerhaft) {
    const nachHerkunft = new Map();
    for (const e of biEintraege) (nachHerkunft.get(e.herkunft) ?? nachHerkunft.set(e.herkunft, []).get(e.herkunft)).push(e);
    for (const [herkunft, liste] of nachHerkunft) {
      const stufen = new Map();
      for (const e of liste) (stufen.get(grundkode(e)) ?? stufen.set(grundkode(e), new Set()).get(grundkode(e))).add(e._kodierung);
      const widerspruch = [...stufen].filter(([, werte]) => werte.size > 1).map(([kennung]) => kennung);
      if (widerspruch.length) {
        pflege.push({ herkunft, vollstaendig: false, hinweis: `${widerspruch.join(", ")} ist mehrfach mit unterschiedlichen Werten angegeben; bitte einen Wert festlegen.` });
        continue;
      }
      let r;
      try {
        r = bi.calculate({ kodierung: liste.map((e) => e._kodierung).join("; "), ...(alterMonate(profil.meta) !== undefined ? { alter_monate: alterMonate(profil.meta) } : {}) });
      } catch (err) {
        pflege.push({ herkunft, vollstaendig: false, hinweis: err instanceof LookupError ? err.message : "Die Orientierung konnte nicht berechnet werden." });
        continue;
      }
      const fehlend = r.nicht_angegeben ?? [];
      pflege.push(
        fehlend.length
          ? { herkunft, vollstaendig: false, fehlende_kriterien: fehlend, hinweis: `Noch ${fehlend.length} Kriterien ohne Angabe; eine Orientierung zum Pflegegrad ist erst mit vollständigen Angaben sinnvoll.` }
          : { herkunft, vollstaendig: true, gesamtpunkte: r.gesamtpunkte, pflegegrad: r.pflegegrad, hinweis: `${r.systematik}. Orientierung nach Anlage 2 zu § 15 SGB XI, keine Begutachtung.` }
      );
    }
  }

  return {
    fallprofil: FALLPROFIL_VERSION,
    gueltig: fehler.length === 0,
    fehler,
    datenschutz: DATENSCHUTZ,
    eintraege: ausgabe,
    zusammenhaenge,
    hinweise: [...hinweise.values()].map(({ kennung, eintraege: ids, texte }) => ({
      kennung,
      eintraege: [...new Set(ids)],
      text: texte.slice(0, MAX_HINWEISTEXTE).join(" ") + (texte.length > MAX_HINWEISTEXTE ? ` … und ${texte.length - MAX_HINWEISTEXTE} weitere.` : ""),
    })),
    lebensbereiche,
    querverweise,
    pflege,
  };
}

// --- Vergleich zweier Fassungen ---

/** Merkmal-, Stufen- oder Zusatzteil eines Kodes (alles nach dem Grundkode). */
function auspraegung(e) {
  const kode = String(e.kode ?? "").trim();
  if (e.art === "icf") return kode.slice(kode.split(/[.+]/)[0].length);
  if (e.art === "bi") return kode.split("=")[1] ?? "";
  if (e.art === "icd") return zusatz(e);
  return "";
}

const FELDNAME = { icf: "merkmal", bi: "stufe", icd: "zusatzkennzeichen" };

function veraenderteFelder(a, b) {
  const felder = [];
  if (auspraegung(a) !== auspraegung(b)) felder.push(FELDNAME[a.art] ?? "kode");
  for (const f of ["gdb", "dauer", "richtung"]) if (a[f] !== b[f]) felder.push(f);
  if ((a.status ?? "geschildert") !== (b.status ?? "geschildert")) felder.push("status");
  return felder;
}

const kurz = (e) => ({ id: e.id, art: e.art, ...(e.kode ? { kode: e.kode } : {}), ...(e.text ? { text: e.text } : {}), herkunft: e.herkunft });

/** Ordnet Elemente zweier Listen über einen Schlüssel zu; Mehrfachschlüssel werden in Reihenfolge gepaart. */
function zuordnen(alt, neu, schluessel) {
  const gruppe = (liste) => {
    const m = new Map();
    for (const x of liste) (m.get(schluessel(x)) ?? m.set(schluessel(x), []).get(schluessel(x))).push(x);
    return m;
  };
  const ga = gruppe(alt);
  const gn = gruppe(neu);
  const paare = [], nurAlt = [], nurNeu = [], mehrdeutig = [];
  for (const key of new Set([...ga.keys(), ...gn.keys()])) {
    const a = ga.get(key) ?? [];
    const n = gn.get(key) ?? [];
    if (a.length > 1 || n.length > 1) mehrdeutig.push(key);
    for (let i = 0; i < Math.max(a.length, n.length); i++) {
      if (a[i] && n[i]) paare.push([a[i], n[i], key]);
      else if (a[i]) nurAlt.push(a[i]);
      else nurNeu.push(n[i]);
    }
  }
  return { paare, nurAlt, nurNeu, mehrdeutig };
}

/**
 * Vergleicht zwei Fassungen eines Fallprofils: neue, weggefallene und veränderte Einträge, Zusammenhänge,
 * Ziele, Verfahren, angegebene Einzel-GdB und (bei vollständigen Angaben) die Pflegepunkte je Herkunft.
 * Wertet die Veränderung nicht.
 */
function vergleichenIntern({ alt: altInput, neu: neuInput } = {}) {
  const a = parseProfil(altInput);
  const n = parseProfil(neuInput);
  const fehler = [
    ...a.fehler.map((f) => ({ pfad: `alt.${f.pfad}`, meldung: f.meldung })),
    ...n.fehler.map((f) => ({ pfad: `neu.${f.pfad}`, meldung: f.meldung })),
  ];
  if (fehler.length) return { gueltig: false, fehler };
  const alt = a.profil;
  const neu = n.profil;
  const liste = (p, k) => (Array.isArray(p[k]) ? p[k] : []);
  const hinweise = [];

  const key = (e) => `${e.art}|${grundkode(e)}|${e.herkunft}`;
  const ein = zuordnen(liste(alt, "eintraege"), liste(neu, "eintraege"), key);
  if (ein.mehrdeutig.length) {
    hinweise.push({ kennung: "mehrdeutig", text: `Mehrfach vorhandene Einträge wurden in ihrer Reihenfolge zugeordnet: ${ein.mehrdeutig.map((k) => k.split("|")[1]).join(", ")}.` });
  }
  const veraendert = [];
  let unveraendert = 0;
  for (const [x, y, schluessel] of ein.paare) {
    const felder = veraenderteFelder(x, y);
    if (!felder.length) {
      unveraendert++;
      continue;
    }
    veraendert.push({
      schluessel: schluessel.split("|").slice(0, 2).join(" "),
      vorher: kurz(x),
      nachher: kurz(y),
      felder,
      ...(x.begruendung ? { begruendung_vorher: x.begruendung } : {}),
      ...(y.begruendung ? { begruendung_nachher: y.begruendung } : {}),
    });
  }

  const zKey = (p) => {
    const byId = new Map(liste(p, "eintraege").map((e) => [e.id, e]));
    return (z) => `${z.art}|${byId.get(z.von) ? grundkode(byId.get(z.von)) : z.von}|${byId.get(z.nach) ? grundkode(byId.get(z.nach)) : z.nach}`;
  };
  const zA = liste(alt, "zusammenhaenge").map((z) => ({ ...z, _k: zKey(alt)(z) }));
  const zN = liste(neu, "zusammenhaenge").map((z) => ({ ...z, _k: zKey(neu)(z) }));
  const zus = zuordnen(zA, zN, (z) => z._k);
  const zOut = (z) => {
    const [art, von, nach] = z._k.split("|");
    return { art, von, nach };
  };
  const ziele = zuordnen(liste(alt, "ziele"), liste(neu, "ziele"), (z) => compact(z.text ?? ""));
  const verf = zuordnen(liste(alt, "verfahren"), liste(neu, "verfahren"), (v) => `${v.art}|${v.bereich}|${v.datum ?? ""}`);

  const gdbWerte = (p) => new Map(liste(p, "eintraege").filter((e) => e.art === "vmg" && e.gdb !== undefined).map((e) => [grundkode(e), e.gdb]));
  const gA = gdbWerte(alt);
  const gN = gdbWerte(neu);
  const gdb = [...new Set([...gA.keys(), ...gN.keys()])]
    .filter((k) => gA.get(k) !== gN.get(k))
    .map((kennung) => ({ kennung, ...(gA.has(kennung) ? { alt: gA.get(kennung) } : {}), ...(gN.has(kennung) ? { neu: gN.get(kennung) } : {}) }));

  const pA = pruefenIntern({ profil: alt }).pflege;
  const pN = pruefenIntern({ profil: neu }).pflege;
  const pflege = [...new Set([...pA, ...pN].map((p) => p.herkunft))].map((herkunft) => {
    const x = pA.find((p) => p.herkunft === herkunft);
    const y = pN.find((p) => p.herkunft === herkunft);
    const werte = (p) => (p?.vollstaendig ? { gesamtpunkte: p.gesamtpunkte, pflegegrad: p.pflegegrad } : p ? { vollstaendig: false } : undefined);
    return {
      herkunft,
      ...(x ? { alt: werte(x) } : {}),
      ...(y ? { neu: werte(y) } : {}),
      ...(x?.vollstaendig && y?.vollstaendig ? { differenz: Math.round((y.gesamtpunkte - x.gesamtpunkte) * 100) / 100 } : {}),
    };
  });

  return {
    gueltig: true,
    fehler: [],
    stichtage: { alt: alt.meta?.stichtag, neu: neu.meta?.stichtag },
    eintraege: { neu: ein.nurNeu.map(kurz), weggefallen: ein.nurAlt.map(kurz), veraendert, unveraendert },
    zusammenhaenge: { neu: zus.nurNeu.map(zOut), weggefallen: zus.nurAlt.map(zOut) },
    ziele: { neu: ziele.nurNeu.map((z) => z.text), weggefallen: ziele.nurAlt.map((z) => z.text) },
    verfahren: { neu: verf.nurNeu, weggefallen: verf.nurAlt },
    pflege,
    gdb,
    hinweise,
  };
}

const INTERN = "Das Fallprofil konnte wegen eines unerwarteten Fehlers nicht vollständig geprüft werden. Bitte die Form mit fall_schema vergleichen.";

/** Prüft ein Fallprofil; unerwartete Fehler werden als Fehlermeldung zurückgegeben, nie als Protokollfehler. */
export function pruefen(args = {}) {
  try {
    return pruefenIntern(args);
  } catch (err) {
    return { fallprofil: FALLPROFIL_VERSION, gueltig: false, fehler: [{ pfad: "(Profil)", meldung: err instanceof LookupError ? err.message : INTERN }], datenschutz: DATENSCHUTZ, eintraege: [], zusammenhaenge: [], hinweise: [], lebensbereiche: [], querverweise: [], pflege: [] };
  }
}

/** Vergleicht zwei Fassungen; unerwartete Fehler werden als Fehlermeldung zurückgegeben. */
export function vergleichen(args = {}) {
  try {
    return vergleichenIntern(args);
  } catch (err) {
    return { gueltig: false, fehler: [{ pfad: "(Profil)", meldung: err instanceof LookupError ? err.message : INTERN }] };
  }
}
