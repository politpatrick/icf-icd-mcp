import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";
import { readFileSync } from "node:fs";
import { graph as icdGraph, getCode as icdGetCode } from "../src/icd.mjs";
import { graph as icfGraph, getCode as icfGetCode } from "../src/icf.mjs";

let nextId = 1;
function call(name, args) {
  const reply = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } });
  return reply.result.isError ? { error: reply.result.content[0].text } : JSON.parse(reply.result.content[0].text);
}

test("Bereiche werden exakt aufgelöst, auch auf Unterkode-Ebene", () => {
  assert.equal(icdGraph.covers("J00-J22", "J06.9").via, "bereich");
  assert.equal(icdGraph.covers("A00.0-Q99.9", "A00").via, "bereich"); // alle Unterkodes enthalten
  assert.equal(icdGraph.covers("T80-T88.6", "T88"), null); // nur teilweise enthalten
  assert.equal(icdGraph.covers("T80-T88.6", "T88.6").via, "bereich");
  assert.equal(icdGraph.covers("T80-T88.6", "T88.7"), null);
  assert.equal(icdGraph.covers("V01-Y84", "XVIII"), null); // römische Kapitelnummer ist kein Kode
  assert.equal(icdGraph.covers("F33", "F33.1").via, "oberklasse");
});

test("Kanten stammen aus den amtlichen Daten", () => {
  const types = new Set(icdGraph.edges.map((e) => e.type));
  assert.deepEqual([...types].sort(), ["ausschluss", "hinweis", "kreuz_stern", "verweis"]);
  assert.ok(icdGraph.edges.length > 5000);
  assert.ok(icfGraph.edges.every((e) => e.type === "ausschluss"));
});

test("icd_relations zeigt Rückverweise, geerbte Ausschlüsse und Kreuz-Stern-Partner", () => {
  const f33 = call("icd_relations", { code: "F33" });
  assert.ok(f33.wird_ausgeschlossen_bei.some((e) => e.von.code === "F32" && e.trifft === "diesen Kode direkt"));
  assert.ok(f33.wird_ausgeschlossen_bei.some((e) => e.trifft.includes("F30-F39")));

  const f321 = call("icd_relations", { code: "F32.1" });
  assert.equal(f321.ausschluesse.length, 0);
  assert.ok(f321.geerbte_ausschluesse.some((e) => e.geerbt_von.code === "F32" && e.ziel.code === "F33"));

  const f000 = call("icd_relations", { code: "F00.0" }).kreuz_stern;
  assert.ok(f000.some((e) => e.partner.code === "G30.0†"));
  // Jeder Partner nur einmal, auch wenn beide Seiten aufeinander verweisen
  const partners = call("icd_relations", { code: "G30.0" }).kreuz_stern.map((e) => e.partner.code);
  assert.deepEqual(partners, [...new Set(partners)]);
  assert.ok(partners.includes("F00.0*") && partners.includes("F00*"));
});

test("icd_compare grenzt F32.1 und F33.1 über den geerbten Ausschluss ab", () => {
  const c = call("icd_compare", { code_a: "F32.1", code_b: "F33.1" });
  assert.equal(c.hierarchie.gemeinsame_oberklasse.code, "F30-F39");
  const fromA = c["F32.1_zu_F33.1"];
  assert.equal(fromA[0].art, "ausschluss");
  assert.equal(fromA[0].geerbt_von.code, "F32");
  assert.match(c.abgrenzung, /amtlichen Ausschluss/);
  assert.deepEqual(c.pfad.map((s) => s.typ), ["oberklasse", "ausschluss", "unterklasse"]);

  const none = call("icd_compare", { code_a: "F32.1", code_b: "E11.90" });
  assert.match(none.abgrenzung, /Kein amtlicher Ausschluss/);
  assert.equal(none.hierarchie.beziehung, "verschiedene Kapitel, keine gemeinsame Oberklasse");
});

test("icf_compare und icf_get_related nutzen das Netz", () => {
  const c = call("icf_compare", { code_a: "d450", code_b: "d4200" });
  assert.equal(c.d450_schliesst_aus[0].trifft, "Oberklasse d420");
  assert.deepEqual(c.pfad.map((s) => s.typ), ["ausschluss", "unterklasse"]);
  const related = call("icf_get_related", { code: "d420" });
  assert.ok(related.excluded_by.some((e) => e.code.code === "d450"));
  assert.match(call("icf_compare", { code_a: "d450", code_b: "x1" }).error, /nicht gefunden/);
});

// ---------------------------------------------------------------------------
// Regressionstests für Verweisformen, die früher falsch ausgewertet wurden


const icdData = JSON.parse(readFileSync(new URL("../data/icd10gm.json", import.meta.url), "utf-8")).codes;
const icfData = JSON.parse(readFileSync(new URL("../data/icf_flat.json", import.meta.url), "utf-8"));

test('"vierte Stelle"-Verweise treffen nur die genannten Viersteller', () => {
  const azidose = icdData["E87.2"].exclusions.find((x) => x.text.includes("vierte Stelle .1"));
  assert.deepEqual(azidose.refs, ["E10.1", "E11.1", "E12.1", "E13.1", "E14.1"]);
  assert.match(call("icd_compare", { code_a: "E87.2", code_b: "E11.90" }).abgrenzung, /Kein amtlicher Ausschluss/);
  assert.match(call("icd_compare", { code_a: "E87.2", code_b: "E11.1" }).abgrenzung, /amtlichen Ausschluss/);
  // "F19 mit vierter Stelle .2" (ein Kode) und "F10-F19 mit vierter Stelle .2"
  const allRefs = Object.values(icdData).flatMap((e) =>
    ["exclusions", "inclusions", "notes", "coding_hints", "definitions"].flatMap((k) => (e[k] ?? []).flatMap((x) => x.refs ?? []))
  );
  assert.ok(allRefs.every((r) => /^[A-Z]\d{2}(\.\d{1,2})?(-[A-Z]\d{2}(\.\d{1,2})?)?$/.test(r)), "nur Kodes und Bereiche als Ziele");
  assert.ok(allRefs.filter((r) => !r.includes("-")).every((r) => r in icdData), "jedes Einzelziel existiert");
});

test('Verweise mit "und" werden getrennt: "C95.0-C95.7- und C95.9-"', () => {
  const note = icdData.C95.notes.find((x) => typeof x === "object");
  assert.deepEqual(note.refs, ["C95.0-C95.7", "C95.9"]);
});

test("Bereichsgrenzen werden in ihrer eigenen Genauigkeit verglichen", () => {
  assert.equal(icdGraph.covers("C41.02-C41.1", "C41.1").via, "bereich");
  assert.equal(icdGraph.covers("C41.02-C41.1", "C41.0"), null); // C41.01 liegt außerhalb
  assert.equal(icdGraph.covers("C41.02-C41.1", "C41.2"), null);
  assert.equal(icdGraph.covers("D16.42-D16.5", "D16.5").via, "bereich");
  assert.equal(icdGraph.covers("D16.42-D16.5", "D16.41"), null);
});

test("Verweise aus Kodierhinweisen, Anmerkungen und Definitionen sind im Netz", () => {
  const a021 = call("icd_relations", { code: "A02.1" });
  assert.ok(a021.hinweise.some((h) => h.ziel.code === "U69.80-U69.82"));
  const u6981 = call("icd_relations", { code: "U69.81" }).in_hinweisen_genannt_bei;
  assert.ok((Array.isArray(u6981) ? u6981.length : u6981.anzahl) > 10);
  assert.ok(call("icd_relations", { code: "F31.5" }).hinweise.some((h) => h.ziel.code === "F32.3"));
  // Texte werden weiterhin als Text ausgegeben
  assert.ok(icdGetCode({ code: "A02.1" }).notes.every((n) => typeof n === "string"));
  assert.ok(icdGetCode({ code: "F31.5" }).definitions.every((d) => typeof d === "string"));
});

test("ICF-Ausschlüsse werden vollständig und eindeutig aufgelöst", () => {
  for (const entry of Object.values(icfData)) {
    for (const text of entry.exclusions ?? []) {
      assert.ok(icfGraph.out(entry.code, "ausschluss").some((e) => e.text === text), `${entry.code}: ${text}`);
    }
  }
  const target = (code, start) => icfGetCode({ code }).exclusions.find((x) => x.text.startsWith(start)).codes.map((c) => c.code);
  assert.deepEqual(target("b215", "Funktionen des Sehens"), ["b210"]); // Titel mit Klammerzusatz
  assert.deepEqual(target("b740", "Funktionen der kardio"), ["b455"]); // Beugung
  assert.deepEqual(target("d855", "Kapitel 6"), ["d6"]);
  assert.deepEqual(target("d8500", "Teilzeit"), ["d8501", "d8502"]); // Ergänzungsstrich
  assert.deepEqual(target("e5200", "Entwurf"), ["e150"]); // gekürzter Text
  assert.deepEqual(target("b220", "Schmerz"), ["b280"]); // Kategorie vor gleichnamiger Gruppe
});
