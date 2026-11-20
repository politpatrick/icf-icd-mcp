import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";
import { parseProfil, schema } from "../src/fall.mjs";

let nextId = 1;
const call = (name, args) => {
  const r = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }).result;
  return r.isError ? { error: r.content[0].text } : JSON.parse(r.content[0].text);
};
const minimal = () => ({ fallprofil: "1", meta: { pseudonym: "Fall A", stichtag: "2026-11-20" }, eintraege: [], zusammenhaenge: [], ziele: [], verfahren: [] });

test("fall_schema liefert Schema und gültiges Beispiel", () => {
  const r = call("fall_schema", {});
  assert.equal(r.version, "1");
  assert.deepEqual(parseProfil(r.beispiel).fehler, []);
  assert.match(r.felder, /Pseudonym/);
});

test("Beispiel enthält jede Art und jede Zusammenhangsart", () => {
  const b = schema().beispiel;
  for (const art of ["icd", "icf", "bi", "vmg", "merkzeichen", "personbezogen"]) assert.ok(b.eintraege.some((e) => e.art === art), art);
  for (const art of ["verursacht", "beeintraechtigt", "foerdert", "hemmt", "entspricht"]) assert.ok(b.zusammenhaenge.some((z) => z.art === art), art);
  assert.ok(b.ziele.length && b.verfahren.length);
});

test("Schema und Prüfcode kennen dieselben Felder und Werte", () => {
  const s = schema().schema;
  const props = (p) => Object.keys(p.properties).sort();
  assert.deepEqual(props(s.$defs.eintrag), ["art", "begruendung", "beleg", "dauer", "gdb", "herkunft", "id", "kode", "o_ton", "richtung", "status", "text", "verfahren"]);
  assert.deepEqual(s.$defs.eintrag.properties.art.enum, ["icd", "icf", "bi", "vmg", "merkzeichen", "personbezogen"]);
  assert.deepEqual(s.$defs.zusammenhang.properties.art.enum, ["verursacht", "beeintraechtigt", "foerdert", "hemmt", "entspricht"]);
});

test("Unbekannte Felder wie name werden abgelehnt", () => {
  const p = minimal();
  p.meta.name = "Erika Mustermann";
  assert.ok(parseProfil(p).fehler.some((f) => f.pfad === "meta.name"));
});

test("Kaputtes JSON und fehlende Verweise ergeben Fehler mit Pfad", () => {
  assert.ok(parseProfil('{"fallprofil": "1", "meta": {').fehler.length > 0);
  assert.equal(call("fall_schema", {}).version, "1"); // Server läuft weiter
  const p = minimal();
  p.eintraege.push({ id: "e1", art: "icd", kode: "F32.1 G", herkunft: "befund", verfahren: "v9" });
  p.zusammenhaenge.push({ von: "e1", nach: "e7", art: "verursacht" });
  const pf = parseProfil(p).fehler.map((f) => f.pfad);
  assert.ok(pf.includes("eintraege[0].verfahren") && pf.includes("zusammenhaenge[0].nach"), pf.join(", "));
});

test("Limits und Wertebereiche", () => {
  const p = minimal();
  p.eintraege = Array.from({ length: 501 }, (_, i) => ({ id: `e${i}`, art: "personbezogen", text: "x", herkunft: "selbstauskunft" }));
  assert.ok(parseProfil(p).fehler.some((f) => /500/.test(f.meldung)));
  const q = minimal();
  q.eintraege.push({ id: "v", art: "vmg", kode: "VMG:B 3.7", gdb: 35, herkunft: "bescheid" });
  assert.ok(parseProfil(q).fehler.some((f) => f.pfad === "eintraege[0].gdb"));
});

// --- fall_pruefen ---

const mit = (eintraege, zusammenhaenge = [], extra = {}) => ({ ...minimal(), eintraege, zusammenhaenge, ...extra });
const E = (id, art, kode, more = {}) => ({ id, art, ...(kode === undefined ? {} : { kode }), herkunft: "selbstauskunft", ...more });
const hinweise = (p) => call("fall_pruefen", { profil: p }).hinweise.map((h) => h.kennung);

/** Alle BI-Kriterien mit neutralem Wert (Stufe 0, Häufigkeit „entfällt“, ja/nein „nein“). */
async function alleBi(alter_monate) {
  const bi = await import("../src/bi.mjs");
  return bi.calculate(alter_monate ? { alter_monate } : {}).nicht_angegeben.map((id, i) => {
    const wert = /^BI:4\.5\./.test(id) ? "entfällt" : /\.(B|0)$/.test(id) ? "nein" : "0";
    return E(`bi${i}`, "bi", `${id}=${wert}`, { herkunft: "interview" });
  });
}

test("fall_pruefen: Beispiel gültig, Klartext, Lebensbereiche, Querverweise, Datenschutz", () => {
  const r = call("fall_pruefen", { profil: schema().beispiel });
  assert.equal(r.gueltig, true, JSON.stringify(r.fehler));
  assert.ok(r.eintraege.every((e) => e.klartext), JSON.stringify(r.eintraege.filter((e) => !e.klartext)));
  assert.ok(r.lebensbereiche.find((l) => l.nummer === 7).eintraege.some((e) => e.kode.startsWith("d720")));
  assert.equal(r.lebensbereiche.find((l) => l.nummer === 9).titel, "Gemeinschafts-, soziales und staatsbürgerliches Leben");
  assert.ok(r.querverweise.length > 0 && r.querverweise.every((q) => q.quelle === "kuratiert, nicht amtlich"));
  assert.match(r.datenschutz, /Pseudonym/);
});

test("fall_pruefen nimmt das Profil auch als JSON-Text", () => {
  assert.equal(call("fall_pruefen", { profil: JSON.stringify(schema().beispiel) }).gueltig, true);
  const kaputt = call("fall_pruefen", { profil: '{"fallprofil":' });
  assert.equal(kaputt.gueltig, false);
  assert.ok(kaputt.fehler.length > 0);
});

test("Kodes: Fehler gegen Warnung", () => {
  const r = call("fall_pruefen", { profil: mit([E("a", "icf", "d450"), E("b", "icd", "F20"), E("c", "icf", "x999.9"), E("v", "vmg", "VMG:B 99")]) });
  assert.equal(r.gueltig, false);
  assert.ok(r.fehler.some((f) => f.pfad === "eintraege[2].kode"));
  assert.ok(r.fehler.some((f) => f.pfad === "eintraege[3].kode"));
  assert.ok(r.eintraege.find((e) => e.id === "a").warnungen.length > 0);
  assert.ok(r.eintraege.find((e) => e.id === "b").warnungen.length > 0);
});

test("Zusammenhänge: erlaubte und unerlaubte Paare", () => {
  const r = call("fall_pruefen", {
    profil: mit([E("i", "icd", "F20.0 G"), E("b", "icf", "b160.2"), E("d", "icf", "d720.33")], [
      { von: "d", nach: "b", art: "beeintraechtigt" },
      { von: "b", nach: "d", art: "beeintraechtigt" },
      { von: "i", nach: "b", art: "verursacht" },
    ]),
  });
  assert.equal(r.zusammenhaenge[0].gueltig, false);
  assert.ok(r.zusammenhaenge[0].meldung);
  assert.equal(r.zusammenhaenge[1].gueltig, true);
  assert.equal(r.zusammenhaenge[2].gueltig, true);
});

test("Alle Lückenhinweise werden ausgelöst", () => {
  assert.ok(hinweise(mit([E("d", "icf", "d450.22")])).includes("d_ohne_ursache"));
  assert.ok(hinweise(mit([E("e", "icf", "e150.2")])).includes("barriere_ohne_bezug"));
  assert.ok(hinweise(mit([E("e", "icf", "e310+2")])).includes("foerderfaktor_ohne_bezug"));
  assert.ok(hinweise(mit([E("e", "icf", "e150")])).includes("umweltfaktor_ohne_merkmal"));
  assert.ok(hinweise(mit([E("o", "icf", "d450", { status: "offen" })])).includes("offen"));
  assert.ok(hinweise(mit([E("x", "icf", "d450.22", { status: "belegt" })])).includes("ohne_beleg"));
  const t = minimal();
  t.meta.zweck = ["teilhabe"];
  t.eintraege = [E("d", "icf", "d450.22")];
  assert.ok(hinweise(t).includes("komponente_fehlt"));
  const doppelt = call("fall_pruefen", { profil: mit([E("a", "icd", "F20.0 G"), E("b", "icd", "F20.0 V")]) }).hinweise.find((h) => h.kennung === "doppelt");
  assert.match(doppelt.text, /widersprüchliche Diagnosesicherheit/);
  assert.ok(hinweise(mit([E("a", "icf", "e310+3"), E("b", "icf", "e310.2")])).includes("doppelt"));
  assert.ok(!hinweise(mit([E("a", "icd", "F20.0 G"), E("b", "icd", "F20.0 G", { herkunft: "gutachten" })])).includes("doppelt"));
  assert.ok(hinweise(mit([], [], { ziele: [{ id: "z", text: "Allein einkaufen", eintraege: [] }] })).includes("ziel_ohne_bezug"));
  assert.ok(hinweise(mit([E("b", "bi", "BI:4.1.3=2")])).includes("alter_fehlt"));
});

test("Hinweistexte bewerten nicht", () => {
  const r = call("fall_pruefen", { profil: mit([E("d", "icf", "d450.22"), E("e", "icf", "e150.2")]) });
  assert.ok(r.hinweise.every((h) => !/nicht begründet|unbegründet|abgelehnt|kein Anspruch/i.test(h.text)));
});

test("Pflege-Orientierung nur bei vollständigen Angaben, Kinder über Monate", async () => {
  const teil = call("fall_pruefen", { profil: mit([E("b", "bi", "BI:4.1.3=2")]) }).pflege[0];
  assert.equal(teil.vollstaendig, false);
  assert.equal(teil.pflegegrad, undefined);
  assert.equal(teil.gesamtpunkte, undefined);
  assert.ok(teil.fehlende_kriterien.length > 0);

  const voll = mit(await alleBi());
  voll.meta.alter = { jahre: 46 };
  const p = call("fall_pruefen", { profil: voll }).pflege.find((x) => x.herkunft === "interview");
  assert.equal(p.vollstaendig, true, JSON.stringify(p.fehlende_kriterien));
  assert.equal(p.gesamtpunkte, 0);
  assert.equal(typeof p.pflegegrad, "number");

  const kind = mit(await alleBi(30));
  kind.meta.alter = { monate: 30 };
  const k = call("fall_pruefen", { profil: kind }).pflege.find((x) => x.herkunft === "interview");
  assert.equal(k.vollstaendig, true, JSON.stringify(k.fehlende_kriterien));
  assert.match(k.hinweis, /Kinder/);
});

test("ICF_MCP_BI=0: Hinweis modul_aus, keine Pflege-Orientierung", async () => {
  const { spawnSync } = await import("node:child_process");
  const profil = mit([E("b", "bi", "BI:4.1.3=2"), E("d", "icf", "d450.22")]);
  const out = spawnSync(process.execPath, ["src/server.mjs"], {
    input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "fall_pruefen", arguments: { profil } } }) + "\n",
    env: { ...process.env, ICF_MCP_BI: "0" },
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf-8",
  }).stdout;
  const r = JSON.parse(JSON.parse(out).result.content[0].text);
  assert.ok(r.hinweise.some((h) => h.kennung === "modul_aus"));
  assert.deepEqual(r.pflege, []);
});

// --- fall_vergleichen ---

test("fall_vergleichen: neu, weggefallen, verändert über Grundkode trotz anderer Ids", () => {
  const alt = mit([E("a", "icf", "d450.12"), E("b", "icd", "F20.0 V"), E("c", "personbezogen", undefined, { text: "Mag Musik" })]);
  const neu = mit([E("x", "icf", "d450.23"), E("y", "icd", "F20.0 G"), E("z", "icf", "d920.2")]);
  neu.meta.stichtag = "2027-11-20";
  const r = call("fall_vergleichen", { alt, neu });
  assert.equal(r.gueltig, true, JSON.stringify(r.fehler));
  assert.deepEqual(r.stichtage, { alt: "2026-11-20", neu: "2027-11-20" });
  assert.ok(r.eintraege.veraendert.some((v) => v.schluessel.includes("d450")));
  assert.ok(r.eintraege.veraendert.some((v) => v.schluessel.includes("F20.0")));
  assert.ok(r.eintraege.neu.some((e) => e.kode.startsWith("d920")));
  assert.ok(r.eintraege.weggefallen.some((e) => e.art === "personbezogen"));
  assert.ok(!/verschlecht|verbesser/i.test(JSON.stringify(r)));
});

test("fall_vergleichen: Zusammenhänge, GdB und Formfehler", () => {
  const alt = mit([E("i", "icd", "F20.0 G"), E("d", "icf", "d720.22"), E("v", "vmg", "VMG:B 3.7", { gdb: 40 })]);
  const neu = mit([E("i2", "icd", "F20.0 G"), E("d2", "icf", "d720.22"), E("v2", "vmg", "VMG:B 3.7", { gdb: 50 })], [{ von: "i2", nach: "d2", art: "verursacht" }]);
  const r = call("fall_vergleichen", { alt, neu });
  assert.equal(r.zusammenhaenge.neu.length, 1);
  assert.equal(r.zusammenhaenge.weggefallen.length, 0);
  assert.deepEqual(r.gdb.map(({ kennung, alt: a, neu: n }) => [kennung, a, n]), [["VMG:B 3.7", 40, 50]]);
  assert.equal(r.eintraege.unveraendert, 2);

  const kaputt = minimal();
  kaputt.meta.name = "Erika";
  const f = call("fall_vergleichen", { alt: kaputt, neu });
  assert.equal(f.gueltig, false);
  assert.ok(f.fehler.some((x) => x.pfad === "alt.meta.name"));
});

test("fall_vergleichen: Pflegepunkte je Herkunft und mehrdeutige Schlüssel", async () => {
  const altBi = await alleBi();
  const neuBi = altBi.map((e) => (e.kode.startsWith("BI:4.1.3=") ? { ...e, kode: "BI:4.1.3=3" } : e));
  const alt = mit(altBi), neu = mit(neuBi);
  alt.meta.alter = neu.meta.alter = { jahre: 46 };
  const r = call("fall_vergleichen", { alt, neu });
  const p = r.pflege.find((x) => x.herkunft === "interview");
  assert.ok(p.differenz > 0);
  const m = call("fall_vergleichen", { alt: mit([E("a", "icf", "d450.1"), E("b", "icf", "d450.2")]), neu: mit([E("c", "icf", "d450.3")]) });
  assert.ok(m.hinweise.some((h) => h.kennung === "mehrdeutig"));
});

test("Instructions beschreiben das Fallprofil", () => {
  const init = handleMessage({ jsonrpc: "2.0", id: 99, method: "initialize", params: {} }).result;
  assert.match(init.instructions, /Fallprofil/);
  assert.match(init.instructions, /Pseudonym/);
  assert.match(init.instructions, /keine Rechtsberatung/);
});
