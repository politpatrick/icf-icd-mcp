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
