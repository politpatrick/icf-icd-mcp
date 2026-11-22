import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";

let nextId = 1;
const call = (args) => handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: "leistungshinweise", arguments: args } }).result;
const ok = (args) => {
  const r = call(args);
  assert.ok(!r.isError, r.content[0].text);
  return r.structuredContent;
};
const ids = (args) => ok(args).eintraege.map((e) => e.id);
const alle = (args) => {
  const r = ok(args);
  return [...r.eintraege, ...r.landesrecht].map((e) => e.id);
};

test("tools/list enthält leistungshinweise mit allen Eingaben", () => {
  const { tools } = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/list" }).result;
  const t = tools.find((x) => x.name === "leistungshinweise");
  assert.ok(t);
  for (const p of ["gdb", "merkzeichen", "pflegegrad", "alter_monate"]) assert.ok(t.inputSchema.properties[p], p);
  assert.deepEqual(t.annotations, { readOnlyHint: true, openWorldHint: false });
});

test("GdB 50: Schwerbehinderung, keine Gleichstellung, keine Pflege", () => {
  const r = ok({ gdb: 50 });
  const i = r.eintraege.map((e) => e.id);
  for (const id of ["ausweis", "zusatzurlaub", "kuendigungsschutz", "altersrente", "pauschbetrag"]) assert.ok(i.includes(id), id);
  assert.ok(!i.includes("gleichstellung"));
  assert.ok(!r.eintraege.some((e) => e.gruppe === "pflege"));
  assert.deepEqual(r.eingaben, { gdb: 50 });
});

test("GdB 30: Gleichstellung und begleitende Hilfe, kein Ausweis", () => {
  const i = ids({ gdb: 30 });
  assert.ok(i.includes("gleichstellung"));
  assert.ok(i.includes("begleitende_hilfe"));
  assert.ok(!i.includes("ausweis"));
});

test("GdB 70 mit G, ohne G und GdB 80: Fahrtkostenpauschale", () => {
  const i = ids({ gdb: 70, merkzeichen: ["g"] });
  for (const id of ["fahrtkosten", "befoerderung", "kfz_ermaessigung", "mehrbedarf_g"]) assert.ok(i.includes(id), id);
  assert.ok(!ids({ gdb: 70 }).includes("fahrtkosten"));
  assert.ok(ids({ gdb: 80 }).includes("fahrtkosten"));
  assert.equal(ok({ gdb: 70, merkzeichen: ["g"] }).eintraege.find((e) => e.id === "fahrtkosten").signal, "GdB ab 70 und Merkzeichen G");
});

test("Merkzeichen H allein", () => {
  const r = ok({ merkzeichen: ["H"] });
  const i = r.eintraege.map((e) => e.id);
  for (const id of ["kfz_befreiung", "pauschbetrag_erhoeht", "fahrtkosten", "befoerderung"]) assert.ok(i.includes(id), id);
  assert.ok(!i.includes("ausweis"));
  assert.match(r.hinweis, /Schwerbehinderung/);
});

test("Beförderung nach § 228 SGB IX: Bl ja, aG allein nein", () => {
  assert.ok(!ids({ merkzeichen: ["aG"] }).includes("befoerderung"));
  assert.ok(ids({ merkzeichen: ["Bl"] }).includes("befoerderung"));
  assert.ok(ids({ merkzeichen: ["TBl"] }).includes("befoerderung"));
  assert.match(ok({ merkzeichen: ["Bl"] }).eintraege.find((e) => e.id === "befoerderung").voraussetzung, /§ 228 Abs\. 4 Nr\. 1/);
});

test("Merkzeichen Bl: Landesrecht ohne Normen", () => {
  const r = ok({ merkzeichen: ["Bl"] });
  assert.ok(r.landesrecht.some((e) => e.id === "blindengeld"));
  assert.ok(!r.eintraege.some((e) => e.gruppe === "landesrecht"));
  for (const e of r.landesrecht) {
    assert.deepEqual(e.normen, [], e.id);
    assert.match(JSON.stringify(e), /Landesrecht/, e.id);
  }
  assert.match(r.landesrecht.find((e) => e.id === "blindengeld").voraussetzung, /§ 72 SGB XII/);
});

test("Pflegegrad 1 und 3", () => {
  const eins = ids({ pflegegrad: 1 });
  for (const id of ["pflegeberatung", "entlastungsbetrag", "pflegehilfsmittel", "hilfe_zur_pflege"]) assert.ok(eins.includes(id), id);
  assert.ok(!eins.includes("pflegegeld"));
  const drei = ids({ pflegegrad: 3 });
  for (const id of ["pflegeberatung", "pflegegeld", "jahresbetrag", "besondere_wohnform"]) assert.ok(drei.includes(id), id);
});

test("Kinder: § 35a SGB VIII nur mit Alter unter 18", () => {
  assert.ok(ids({ alter_monate: "120", gdb: 50 }).includes("kinder_35a"));
  assert.ok(!ids({ gdb: 50 }).includes("kinder_35a"));
  assert.ok(!ids({ alter_monate: 216, gdb: 50 }).includes("kinder_35a"));
  assert.deepEqual(ok({ alter_monate: "120", gdb: 50 }).eingaben, { gdb: 50, alter_monate: 120 });
});

test("Merkzeichen werden normalisiert, Reihenfolge folgt dem Katalog", () => {
  assert.deepEqual(ok({ merkzeichen: ["bl", " AG ", "tbl", "rf"] }).eingaben.merkzeichen, ["Bl", "aG", "TBl", "RF"]);
  assert.deepEqual(alle({ merkzeichen: ["AG"] }), alle({ merkzeichen: ["aG"] }));
});

const KOMBIS = [
  { gdb: 20 }, { gdb: 30 }, { gdb: 50 }, { gdb: 80 }, { gdb: 100, merkzeichen: ["G", "aG", "B", "H", "Bl", "Gl", "RF", "TBl"] },
  { merkzeichen: ["TBl"] }, { pflegegrad: 1 }, { pflegegrad: 5 }, { gdb: 60, pflegegrad: 2, alter_monate: 30 },
];
const GII = /^https:\/\/www\.gesetze-im-internet\.de\/[a-z0-9_]+\/__\d+[a-z]?\.html$/;

test("jeder Eintrag vollständig, Links geprüft, keine Beträge, kein wenn", () => {
  for (const k of KOMBIS) {
    const r = ok(k);
    assert.doesNotMatch(JSON.stringify(r), /Euro|€|\d\s*%/, JSON.stringify(k));
    assert.doesNotMatch(JSON.stringify(r), /"wenn"/);
    for (const e of [...r.eintraege, ...r.landesrecht]) {
      for (const f of ["signal", "leistung", "stelle", "rang", "naechster_schritt", "voraussetzung"]) assert.ok(typeof e[f] === "string" && e[f].trim(), `${e.id}.${f}`);
      for (const n of e.normen) {
        assert.match(n.url, GII, `${e.id} ${n.zitat}`);
        assert.match(n.zitat, /^§ \d+[a-z]? /);
      }
      if (e.gruppe !== "landesrecht") assert.ok(e.normen.length >= 1, e.id);
    }
  }
});

test("Gesamthinweis, Herkunft und Beratung", () => {
  const r = ok({ gdb: 50 });
  assert.match(r.hinweis, /keine Anspruchsprüfung/);
  assert.match(r.hinweis, /prüft die Stelle/);
  assert.match(r.herkunft, /kuratiert/);
  const b = r.beratung.join(" ");
  for (const w of ["EUTB", "§ 7a SGB XI", "Pflegestützpunkt", "Sozialverb", "Integrationsfachdienst"]) assert.ok(b.includes(w), w);
});

test("Fehler bei ungültigen Eingaben", () => {
  for (const a of [{}, { gdb: 110 }, { gdb: "abc" }, { gdb: 5.5 }, { pflegegrad: 6 }, { pflegegrad: 0 }, { merkzeichen: ["X"] }, { merkzeichen: "G" }, { merkzeichen: [] }, { alter_monate: -1, gdb: 50 }, { alter_monate: 2000, gdb: 50 }]) {
    const r = call(a);
    assert.ok(r.isError, JSON.stringify(a));
    assert.ok(r.content[0].text.length > 10);
  }
});
