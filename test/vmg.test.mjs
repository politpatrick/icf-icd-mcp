import { test } from "node:test";
import assert from "node:assert/strict";
import { readData } from "../src/data.mjs";

const data = readData("versmedv.json");
const row = (id, text) => data.nodes[id].zeilen.find((z) => z.text.startsWith(text));

test("Teil B: GdS-Zeilen mit Wert und Pfad", () => {
  assert.equal(row("VMG:B 3.7", "Leichtere psychovegetative oder psychische Störungen").gds, "0-20");
  const r = data.nodes["VMG:B 3.7"].zeilen.find((z) => z.gds === "30-40");
  assert.match(r.text, /^\(z\. B\. ausgeprägtere depressive/);
  assert.deepEqual(r.pfad, ["Stärker behindernde Störungen", "mit wesentlicher Einschränkung der Erlebnis- und Gestaltungsfähigkeit"]);
  assert.equal(row("VMG:B 3.1.1", "Hirnschäden mit geringer Leistungsbeeinträchtigung").gds, "30-40");
});

test("Gliederung der Anlage vollständig", () => {
  for (const id of ["VMG:A 3.5", "VMG:A 4", "VMG:A 6", "VMG:B 18.13", "VMG:B 18.14", "VMG:C 1", "VMG:D 1", "VMG:D 2", "VMG:D 4"]) assert.ok(data.nodes[id], id);
  assert.equal(data.nodes["VMG:B 1"].status, "weggefallen");
  assert.equal(data.nodes["VMG:D 3"].status, "aufgehoben");
  assert.match(data.nodes["VMG:A 3.5"].absaetze.join(" "), /GdB von 10/);
});

test("Stichwörter sind vollständig aufgelöst", () => {
  const diab = data.stichwoerter.find((s) => s.wort === "Diabetes mellitus");
  assert.deepEqual(diab.fundstellen, ["A 5d jj", "B 15.1", "D 1e"]);
  assert.ok(diab.ids.includes("VMG:B 15.1"));
  assert.deepEqual(data.stichwoerter.find((s) => s.wort === "Eierstock").ids, ["VMG:B 14.3", "VMG:B 14.4"]);
  assert.ok(data.stichwoerter.every((s) => s.ids.length > 0 && s.ids.every((id) => data.nodes[id])));
});
