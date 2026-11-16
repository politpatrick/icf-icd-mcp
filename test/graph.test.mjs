import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";
import { graph as icdGraph } from "../src/icd.mjs";
import { graph as icfGraph } from "../src/icf.mjs";

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
  assert.deepEqual([...types].sort(), ["ausschluss", "kreuz_stern", "verweis"]);
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

  assert.ok(call("icd_relations", { code: "F00.0" }).kreuz_stern.some((e) => e.ziel?.code === "G30.0†"));
  assert.ok(call("icd_relations", { code: "G30.0" }).kreuz_stern.some((e) => e.ziel?.code === "F00.0*"));
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
