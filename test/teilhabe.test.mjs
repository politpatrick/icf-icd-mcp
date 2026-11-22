import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";

let nextId = 1;
const call = (args) => {
  const r = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: "abgrenzung_egh_pflege", arguments: args } }).result;
  return r.isError ? { error: r.content[0].text } : r.structuredContent;
};

test("tools/list enthält abgrenzung_egh_pflege", () => {
  const { tools } = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/list" }).result;
  const t = tools.find((x) => x.name === "abgrenzung_egh_pflege");
  assert.deepEqual(t.inputSchema.required, ["codes"]);
});

test("Überschneidung: d510 mit BI-Kriterien aus Modul 4, pflegegradrelevant", () => {
  const r = call({ codes: ["d510.3"] });
  const k = r.kategorien[0];
  assert.equal(k.code, "d510");
  assert.deepEqual(k.eingaben, ["d510.3"]);
  assert.equal(k.titel, "Sich waschen");
  assert.equal(k.lebensbereich, "Selbstversorgung");
  assert.equal(k.orientierung, "ueberschneidung");
  assert.ok(k.bi_kriterien.some((b) => b.bi === "BI:4.4.1" && b.pflegegrad_relevant === true));
  assert.match(k.erlaeuterung, /§ 36 SGB XI.*§ 78|§ 78.*§ 36 SGB XI/);
});

test("Überschneidung ohne Pflegegrad: Haushalt (Bereich 6.2)", () => {
  const k = call({ codes: ["d620"] }).kategorien[0];
  assert.equal(k.orientierung, "ueberschneidung");
  assert.ok(k.bi_kriterien.length && k.bi_kriterien.every((b) => b.pflegegrad_relevant === false));
  assert.match(k.erlaeuterung, /nicht in den Pflegegrad/);
});

test("Teilhabe: Arbeit suchen (d845) ohne BI-Zuordnung", () => {
  const d8 = call({ codes: ["d845"] }).kategorien[0];
  assert.equal(d8.orientierung, "teilhabe");
  assert.deepEqual(d8.bi_kriterien, []);
  assert.match(d8.erlaeuterung, /§ 111 SGB IX.*§ 6 SGB IX/);
  assert.equal(d8.lebensbereich, "bedeutende Lebensbereiche");
  const d3 = call({ codes: ["d345"] }).kategorien[0];
  assert.equal(d3.orientierung, "teilhabe");
  assert.match(d3.erlaeuterung, /§ 113 SGB IX/);
});

test("Gesamthinweis: Orientierung, § 13 Abs. 3 SGB XI, § 14 SGB IX, kuratiert", () => {
  const r = call({ codes: ["d510"] });
  assert.match(r.hinweis, /keine Zuständigkeitsentscheidung/);
  assert.match(r.hinweis, /§ 13 Abs\. 3 SGB XI/);
  assert.match(r.hinweis, /§ 14 SGB IX/);
  assert.match(r.herkunft, /kuratiert/);
  assert.ok(!JSON.stringify(r).includes('"orientierung":"pflege"'));
});

test("Schreibweisen, Kapitel, Doppelte", () => {
  const r = call({ codes: [" D510 ", "d510.2", "d5"] });
  assert.deepEqual(r.kategorien.map((k) => k.code), ["d510", "d5"]);
  assert.equal(r.kategorien[1].orientierung, "ueberschneidung");
});

test("Fehler: leere Liste, falsche Komponente, unbekannt, zu viele", () => {
  assert.match(call({ codes: [] }).error, /codes/);
  assert.match(call({}).error, /codes/);
  assert.match(call({ codes: ["b130"] }).error, /b130.*Aktivitäten und Teilhabe|d-Kategorie/);
  assert.match(call({ codes: ["e310"] }).error, /e310/);
  assert.match(call({ codes: ["d077"] }).error, /d077/);
  assert.match(call({ codes: [42] }).error, /42/);
  assert.match(call({ codes: Array.from({ length: 101 }, () => "d510") }).error, /100/);
});

// --- Review (1.11.0) ---

test("Review: d8 – Zusatz je Block unabhängig von der Orientierung", () => {
  const [arbeit, schule, geld] = call({ codes: ["d850", "d820", "d870"] }).kategorien;
  assert.match(arbeit.erlaeuterung, /§ 111 SGB IX.*§ 6 SGB IX/);
  assert.match(schule.erlaeuterung, /§ 112 SGB IX/);
  assert.ok(!/§ 111|§ 112/.test(geld.erlaeuterung));
  assert.match(geld.erlaeuterung, /§ 113 SGB IX/);
});

test("Review: Oberkategorie nur bei „entspricht“; Formulierung kuratiert", () => {
  const k = call({ codes: ["d4101"] }).kategorien[0];
  assert.ok(k.bi_kriterien.every((b) => b.ueber !== "oberkategorie" || b.icf.some((i) => i.beziehung === "entspricht")), JSON.stringify(k.bi_kriterien));
  const all = call({ codes: ["d510", "d345"] }).kategorien;
  assert.match(all[0].erlaeuterung, /kuratierten Zuordnung/);
  assert.match(all[1].erlaeuterung, /kuratierten Zuordnung/);
  assert.ok(!/Die Pflegeversicherung erfasst diesen Bereich/.test(JSON.stringify(all)));
});

test("Review: pflegegrad_relevant aus punktrelevant, Kinderkriterien und Sonderregel gekennzeichnet", () => {
  const ess = call({ codes: ["d550"] }).kategorien[0].bi_kriterien;
  const b440 = ess.find((b) => b.bi === "BI:4.4.0");
  if (b440) assert.equal(b440.nur, "kinder");
  const hand = call({ codes: ["d440"] }).kategorien[0].bi_kriterien.find((b) => b.bi === "BI:4.1.B");
  assert.ok(hand);
  assert.equal(hand.pflegegrad_relevant, false);
  assert.match(hand.sonderregel, /Pflegegrad 5/);
});

test("Review: BI-Kriterien gruppiert, Eingaben gesammelt, Merkmale geprüft, „d“ abgelehnt", () => {
  const k = call({ codes: ["d510.1", "d510.3"] }).kategorien;
  assert.equal(k.length, 1);
  assert.deepEqual(k[0].eingaben, ["d510.1", "d510.3"]);
  const ids = k[0].bi_kriterien.map((b) => b.bi);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(Array.isArray(k[0].bi_kriterien[0].icf));
  assert.match(call({ codes: ["d510.xyz"] }).error, /d510\.xyz/);
  assert.match(call({ codes: ["d"] }).error, /"d"/);
  assert.equal(call({ codes: ["d5"] }).kategorien[0].lebensbereich, "Selbstversorgung");
});

test("Review: Hinweis auf besondere Wohnformen", () => {
  assert.match(call({ codes: ["d510"] }).hinweis, /besonderen Wohnformen.*§ 103 SGB IX/);
});
