import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";
import * as bi from "../src/bi.mjs";

let nextId = 1;
const call = (name, args) => {
  const r = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }).result;
  return r.isError ? { error: r.content[0].text } : JSON.parse(r.content[0].text);
};

/** Vollständiges Gutachten mit neutralen Werten, einzelne Kriterien überschrieben. */
function gutachten(werte = {}, alter_monate) {
  return bi
    .calculate(alter_monate ? { alter_monate } : {})
    .nicht_angegeben.map((id) => {
      const k = id.replace(/^BI:/, "");
      const wert = k in werte ? werte[k] : /^4\.5\./.test(k) ? "entfällt" : /\.(B|0)$/.test(k) ? "nein" : "0";
      return `${k}=${wert}`;
    })
    .join("; ");
}

test("Ein Unterschied mit Definition, Stufen, Wirkung und Hinweisen", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten({ "4.1.3": 1 }), eigene: "4.1.3=3" });
  assert.equal(r.gutachten.vollstaendig, true);
  assert.equal(r.unterschiede.length, 1);
  const u = r.unterschiede[0];
  assert.equal(u.code, "BI:4.1.3");
  assert.equal(u.gutachten.label, "überwiegend selbständig");
  assert.equal(u.eigene.label, "unselbständig");
  assert.ok(u.gutachten.erlaeuterung && u.eigene.erlaeuterung);
  assert.match(u.definition, /^Von einer üblich hohen Sitzgelegenheit/);
  assert.ok(u.wirkung.gewichtet_nachher > u.wirkung.gewichtet_vorher);
  assert.equal(u.wirkung.modul_zaehlt, true);
  assert.equal(typeof u.wirkung.aendert_grad_allein, "boolean");
  assert.equal(r.bestaetigt, 0);
  assert.equal(typeof r.mit_eigenen_werten.gesamtpunkte, "number");
});

test("Gleiche Werte gelten als bestätigt", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten({ "4.1.3": 1 }), eigene: "4.1.3=1; 4.1.4=2" });
  assert.equal(r.bestaetigt, 1);
  assert.equal(r.unterschiede.length, 1);
});

test("Modul 3 zählt nicht, wenn Modul 2 höher ist", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten({ "4.2.1": 3, "4.2.2": 3 }), eigene: "4.3.1=1" });
  assert.equal(r.unterschiede[0].wirkung.modul_zaehlt, false);
  assert.equal(r.unterschiede[0].wirkung.aendert_grad_allein, false);
});

test("Unvollständiges Gutachten: kein Grad, Unterschiede trotzdem erklärt", () => {
  const r = call("bi_gegenueberstellen", { gutachten: "4.1.3=1", eigene: "4.1.3=2" });
  assert.equal(r.gutachten.vollstaendig, false);
  assert.equal(r.gutachten.pflegegrad, undefined);
  assert.ok(r.gutachten.fehlende_kriterien.length > 0);
  assert.equal(r.mit_eigenen_werten.pflegegrad, undefined);
  assert.ok(r.unterschiede[0].eigene.erlaeuterung);
});

test("Kinder: Kinderfassung und Kinderregeln", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten({ "4.1.3": 1 }, 30), eigene: "4.1.3=2", alter_monate: 30 });
  assert.match(r.systematik, /Kinder/);
  assert.match(r.unterschiede[0].definition, /altersentsprechend/);
  assert.ok(r.unterschiede[0].hinweise.some((h) => /Kleinkinder/.test(h)));
});

test("Unterschiede nach Wirkung sortiert, Abstand zur Schwelle", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten(), eigene: "4.1.4=1; 4.4.1=3" });
  assert.equal(r.unterschiede.length, 2);
  const d = (u) => u.wirkung.gewichtet_nachher - u.wirkung.gewichtet_vorher;
  assert.ok(d(r.unterschiede[0]) >= d(r.unterschiede[1]));
  const s = r.mit_eigenen_werten.naechste_schwelle;
  assert.equal(s.abstand, Math.round((s.punkte - r.mit_eigenen_werten.gesamtpunkte) * 100) / 100);
});

test("Eingabe als Fallprofil", () => {
  const e = (id, kode, herkunft) => ({ id, art: "bi", kode: `BI:${kode}`, herkunft });
  const eintraege = gutachten({ "4.1.3": 1 }).split("; ").map((k, i) => e(`g${i}`, k, "gutachten"));
  eintraege.push(e("i1", "4.1.3=3", "interview"));
  const profil = { fallprofil: "1", meta: { pseudonym: "Fall A", stichtag: "2026-11-21", alter: { jahre: 60 } }, eintraege };
  const r = call("bi_gegenueberstellen", { profil });
  assert.equal(r.unterschiede[0].code, "BI:4.1.3");
  assert.equal(r.unterschiede[0].eigene.label, "unselbständig");
  assert.match(call("bi_gegenueberstellen", { profil, herkunft_eigene: "selbstauskunft" }).error, /selbstauskunft/);
});

test("Fehlende Eingaben ergeben einen verständlichen Fehler", () => {
  assert.ok(call("bi_gegenueberstellen", {}).error);
  assert.ok(call("bi_gegenueberstellen", { gutachten: "4.1.3=1" }).error);
  assert.ok(call("bi_gegenueberstellen", { gutachten: "4.1.3=1", eigene: "9.9=1" }).error);
});

// --- Abschluss-Review: Regressionen ---

test("Säuglinge: nächste Schwelle aus der Tabelle bis 18 Monate", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten({}, 12), eigene: "4.4.0=nein", alter_monate: 12 });
  const s = r.mit_eigenen_werten.naechste_schwelle;
  assert.equal(s.punkte, 12.5);
  assert.equal(s.pflegegrad, 2);
});

test("Besondere Bedarfskonstellation: keine widersprüchliche Schwelle, Grad-Änderung zuerst", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten(), eigene: "4.1.4=1; 4.1.B=ja" });
  assert.equal(r.mit_eigenen_werten.pflegegrad, 5);
  assert.equal(r.mit_eigenen_werten.naechste_schwelle, undefined);
  assert.equal(r.unterschiede[0].code, "BI:4.1.B");
  assert.equal(r.unterschiede[0].wirkung.aendert_grad_allein, true);
});

test("Modul 5: Gruppe statt Einzelpunkte 0, Label statt undefined", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten(), eigene: "4.5.1=9/Tag" });
  const u = r.unterschiede[0];
  assert.equal(u.gutachten.label, "entfällt");
  assert.ok(!/undefined/.test(JSON.stringify(u)));
  assert.equal(u.eigene.gruppe.gruppe, "A");
  assert.ok(u.eigene.gruppe.einzelpunkte > u.gutachten.gruppe.einzelpunkte);
});

test("Modul 2/3: Gesamtwirkung zählt, auch wenn das andere Modul übernimmt", () => {
  const r = call("bi_gegenueberstellen", { gutachten: gutachten({ "4.2.1": 3, "4.2.2": 3, "4.3.1": 1, "4.3.2": 1 }), eigene: "4.2.1=0; 4.2.2=0" });
  const summe = r.unterschiede.reduce((s, u) => s + u.wirkung.gesamtpunkte_differenz, 0);
  assert.ok(r.unterschiede.every((u) => typeof u.wirkung.gesamtpunkte_differenz === "number"));
  assert.ok(summe < 0);
});
