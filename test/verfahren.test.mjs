import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";

let nextId = 1;
const call = (args) => handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: "verfahren_info", arguments: args } }).result;
const ok = (args) => {
  const r = call(args);
  assert.ok(!r.isError, r.content[0].text);
  return r.structuredContent;
};

const IDS = ["widerspruch", "ueberpruefungsantrag", "neufeststellungsantrag", "akteneinsicht", "untaetigkeitsklage", "zustaendigkeit", "bekanntgabe"];

test("tools/list enthält verfahren_info", () => {
  const { tools } = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/list" }).result;
  const t = tools.find((x) => x.name === "verfahren_info");
  assert.ok(t);
  assert.deepEqual(t.inputSchema.properties.thema.enum, IDS);
  assert.ok(!t.inputSchema.required);
});

test("Übersicht ohne Argument: alle Themen, Frist- und Beratungshinweis", () => {
  const r = ok({});
  assert.deepEqual(r.themen.map((t) => t.id), IDS);
  for (const t of r.themen) assert.ok(t.titel && t.kurz, t.id);
  assert.match(r.frist, /Rechtsbehelfsbelehrung/);
  assert.match(r.hinweis, /keine Rechtsberatung/);
});

test("jedes Thema: Erklärung, amtliche Normen mit Link und Auszug, Beratung", () => {
  for (const id of IDS) {
    const r = ok({ thema: id });
    assert.equal(r.id, id);
    assert.ok(r.erklaerung.length > 50, id);
    assert.ok(r.normen.length >= 1, id);
    for (const n of r.normen) {
      assert.match(n.url, /^https:\/\/www\.gesetze-im-internet\.de\/[a-z0-9_]+\/__\d+[a-z]?\.html$/, `${id} ${n.zitat}`);
      assert.ok(n.auszug.length > 20, `${id} ${n.zitat}`);
      assert.match(n.zitat, /^§ \d+[a-z]? /);
    }
    assert.ok(r.was_man_braucht.length >= 1, id);
    for (const v of r.verwandt) assert.ok(IDS.includes(v), `${id} → ${v}`);
    assert.equal(r.herkunft.erklaerung, "kuratiert (nicht amtlich)");
    assert.match(r.herkunft.normen, /amtlich/);
    const b = r.beratung.join(" ");
    for (const w of ["EUTB", "§ 7a SGB XI", "§ 7c SGB XI", "Sozialverb"]) assert.ok(b.includes(w), `${id}: ${w}`);
    assert.match(r.frist, /Rechtsbehelfsbelehrung/);
  }
});

test("Normzitate je Thema wie im Design", () => {
  const zitate = (id) => ok({ thema: id }).normen.map((n) => n.zitat);
  assert.ok(zitate("ueberpruefungsantrag").includes("§ 44 SGB X"));
  assert.ok(zitate("neufeststellungsantrag").includes("§ 48 SGB X"));
  assert.ok(zitate("akteneinsicht").includes("§ 25 SGB X"));
  assert.ok(zitate("untaetigkeitsklage").includes("§ 88 SGG"));
  assert.ok(zitate("zustaendigkeit").includes("§ 14 SGB IX"));
  assert.ok(zitate("bekanntgabe").includes("§ 37 SGB X"));
  const w = zitate("widerspruch");
  for (const z of ["§ 84 SGG", "§ 66 SGG", "§ 70 VwGO"]) assert.ok(w.includes(z), z);
  assert.ok(zitate("untaetigkeitsklage").includes("§ 75 VwGO"));
});

test("Auszüge wörtlich: Stichproben", () => {
  const auszug = (id, z) => ok({ thema: id }).normen.find((n) => n.zitat === z).auszug;
  assert.match(auszug("widerspruch", "§ 84 SGG"), /binnen eines Monats, nachdem der Verwaltungsakt dem Beschwerten bekanntgegeben worden ist/);
  assert.match(auszug("bekanntgabe", "§ 37 SGB X"), /am vierten Tag nach der Aufgabe zur Post als bekannt gegeben/);
  assert.match(auszug("untaetigkeitsklage", "§ 88 SGG"), /nicht vor Ablauf von sechs Monaten/);
});

test("Jugendhilfe: Besonderheit VwGO bei Widerspruch und Untätigkeitsklage", () => {
  for (const id of ["widerspruch", "untaetigkeitsklage"]) assert.match(ok({ thema: id }).besonderheiten.join(" "), /SGB VIII.*VwGO/, id);
});

test("Thema wird normalisiert erkannt", () => {
  assert.equal(ok({ thema: "  Widerspruch " }).id, "widerspruch");
  assert.equal(ok({ thema: "ÜBERPRÜFUNGSANTRAG" }).id, "ueberpruefungsantrag");
});

test("Fehler: unbekanntes Thema und kein Text", () => {
  for (const thema of ["klage", 3, { a: 1 }]) {
    const r = call({ thema });
    assert.equal(r.isError, true, String(thema));
    assert.match(r.content[0].text, /widerspruch/);
  }
});

test("keine Rechtsberatung: keine Erfolgsaussichten, keine Fristberechnung", () => {
  const alles = JSON.stringify([ok({}), ...IDS.map((id) => ok({ thema: id }))]);
  assert.ok(!/Erfolgsaussicht|empfehlen wir|sollten Sie Widerspruch/i.test(alles));
  assert.match(ok({}).frist, /keine.*Berechnung|nicht berechnet/i);
});
