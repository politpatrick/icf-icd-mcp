import { test } from "node:test";
import assert from "node:assert/strict";
import { readData } from "../src/data.mjs";
import { handleMessage } from "../src/protocol.mjs";

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

// Regressionsfälle Pfad (Review Runde 1): pfad("VMG:B …", Textanfang, Wert) liefert den Pfad der GdS-Zeile.
const pfad = (id, text, gds) => {
  const z = data.nodes[id].zeilen.filter((r) => r.text.startsWith(text) && (gds === undefined || r.gds === gds));
  assert.equal(z.length, 1, `${id}: ${text} ${gds ?? ""} genau einmal`);
  return z[0].pfad ?? [];
};
const LUNGE = "Nach Entfernung eines malignen Lungentumors oder eines Bronchialtumors ist in den ersten fünf Jahren eine Heilungsbewährung abzuwarten.";
const PENIS = "Nach Entfernung eines malignen Penistumors ist in den ersten fünf Jahren eine Heilungsbewährung abzuwarten; GdS während dieser Zeit";
const LEISTUNG3 = data.nodes["VMG:B 9.1.1"].zeilen.find((z) => z.text.startsWith("3. Leistungsbeeinträchtigung")).text;

test("Pfad: Überschrift in voller Breite (B 10.2.2, B 12.1.3)", () => {
  assert.deepEqual(pfad("VMG:B 10.2.2", "mit schwerer Auswirkung", "50-60"), ["Colitis ulcerosa, Crohn-Krankheit (Enteritis regionalis)"]);
  assert.deepEqual(pfad("VMG:B 12.1.3", "leichten Grades", "40-50"), ["Verlust, Ausfall oder Fehlen einer Niere mit Funktionseinschränkung der anderen Niere"]);
});

test("Pfad: Zwischenstufen über Leerzeile (B 3.1.2)", () => {
  assert.deepEqual(pfad("VMG:B 3.1.2", "sehr selten", "40"), ["Epileptische Anfälle", "je nach Art, Schwere, Häufigkeit und tageszeitlicher Verteilung"]);
});

test("Pfad: Wertzeile als Elternteil tieferer Wertzeilen (B 13.1, B 18.14)", () => {
  assert.deepEqual(pfad("VMG:B 13.1", "Verlust der Eichel", "20"), ["Teilverlust des Penis"]);
  assert.deepEqual(pfad("VMG:B 13.1", "Sonst", "30-40"), ["Teilverlust des Penis"]);
  assert.deepEqual(pfad("VMG:B 18.14", "bei einseitig ungünstigen Stumpfverhältnissen", "90"), ["Verlust beider Beine im Unterschenkel"]);
  assert.deepEqual(pfad("VMG:B 18.14", "bei beidseitig ungünstigen Stumpfverhältnissen", "100"), ["Verlust beider Beine im Unterschenkel"]);
});

test("Pfad: kuratierte Zuordnungen", () => {
  // B 4.5
  assert.deepEqual(pfad("VMG:B 4.5", "auf 30° Abstand vom Zentrum", "30"), ["Gesichtsfeldeinengungen", "Allseitige Einengung binokular"]);
  assert.deepEqual(pfad("VMG:B 4.5", "bei Verlust des beidäugigen Sehens", "30"), ["Vollständige Halbseiten- und Quadrantenausfälle", "Binasale Hemianopsie"]);
  assert.deepEqual(pfad("VMG:B 4.5", "Homonymer Quadrant oben", "20"), ["Vollständige Halbseiten- und Quadrantenausfälle"]);
  // B 9.2.3, B 16.10, B 17.12
  assert.deepEqual(pfad("VMG:B 9.2.3", "bei Gebrauchsunfähigkeit der ganzen Gliedmaße", "80"), ["Lymphödem", "an einer Gliedmaße"]);
  assert.deepEqual(pfad("VMG:B 16.10", "mit häufigen (mehrfach jährlich) ausgeprägten Blutungen", "50-80"), ["mittelschwere Form - mit 1-5 % AHG"]);
  assert.deepEqual(pfad("VMG:B 17.12", "ausgedehnter", "20"), ["Pigmentstörungen (z. B. Vitiligo)", "an Händen und/oder Gesicht"]);
  assert.deepEqual(pfad("VMG:B 17.12", "sonst", "0"), ["Pigmentstörungen (z. B. Vitiligo)"]);
  // B 18.13
  assert.deepEqual(pfad("VMG:B 18.13", "Verlust der ganzen Hand", "50"), ["Extremitätenverlust"]);
  assert.deepEqual(pfad("VMG:B 18.13", "Versteifung des Schultergelenks in günstiger Stellung", "30"), []);
  assert.deepEqual(pfad("VMG:B 18.13", "N. axillaris", "30"), ["Nervenausfälle (vollständig)"]);
  assert.deepEqual(pfad("VMG:B 18.13", "Nn. radialis, ulnaris und medianus im Vorderarmbereich", "60"), ["Nervenausfälle (vollständig)"]);
  // B 9.1.1, B 8.4
  assert.deepEqual(pfad("VMG:B 9.1.1", "mit gelegentlich auftretenden", "80"), [LEISTUNG3]);
  assert.deepEqual(pfad("VMG:B 8.4", "mittleren bis schweren Grades", "90-100"), [LUNGE, "GdS während dieser Zeit", "bei Einschränkung der Lungenfunktion"]);
  // B 12.1.4 (verschmolzene Zelle geteilt)
  assert.deepEqual(pfad("VMG:B 12.1.4", "im Stadium I und II", "60"), ["GdS während einer Heilungsbewährung von fünf Jahren", "nach Entfernung eines Nephroblastoms"]);
  assert.deepEqual(pfad("VMG:B 12.1.4", "im Stadium (T1 [Grading ab G2], T2) N0 M0", "60"), ["GdS während einer Heilungsbewährung von fünf Jahren", "nach Entfernung eines Nierenzellkarzinoms (Hypernephrom)"]);
  // B 13.1 (verschmolzene Zelle geteilt)
  assert.deepEqual(pfad("VMG:B 13.1", "mit vollständiger Entfernung der Corpora cavernosa", "80"), [PENIS, "nach Entfernung im Frühstadium (T1 bis T2) N0 M0", "bei Verlust des Penis"]);
  assert.deepEqual(pfad("VMG:B 13.1", "nach Entfernung in höheren Stadien", "90-100"), [PENIS]);
});

// Regressionsfälle Pfad (Review Runde 2)
const PSYCHOSE = "Nach dem Abklingen lang dauernder psychotischer Episoden ist eine Heilungsbewährung von zwei Jahren abzuwarten.";
const HB2 = "GdS während einer Heilungsbewährung von zwei Jahren";
const HB5 = "GdS während einer Heilungsbewährung von fünf Jahren";
const SKOTOME = "Unregelmäßige Gesichtsfeldausfälle, Skotome im 50°-Gesichtsfeld unterhalb des horizontalen Meridians, binokular";
const KNORPEL = "Ausgeprägte Knorpelschäden der Kniegelenke (z. B. Chondromalacia patellae Stadium II - IV) mit anhaltenden Reizerscheinungen, einseitig";

test("Pfad Runde 2: Heilungsbewährung (B 3.6, B 14.2)", () => {
  assert.deepEqual(pfad("VMG:B 3.6", "GdS während dieser Zeit, wenn bereits mehrere", "50"), [PSYCHOSE]);
  assert.deepEqual(pfad("VMG:B 3.6", "sonst", "30"), [PSYCHOSE]);
  assert.deepEqual(pfad("VMG:B 14.2", "nach Entfernung eines Zervixtumors (Mikrokarzinom) im Stadium T1a N0 M0", "50"), [HB2]);
  assert.deepEqual(pfad("VMG:B 14.2", "nach Entfernung eines Korpustumors im Frühstadium", "50"), [HB2]);
  assert.deepEqual(pfad("VMG:B 14.2", "im Stadium T2b N0 M0", "60"), [HB5, "nach Entfernung eines Zervixtumors"]);
  assert.deepEqual(pfad("VMG:B 14.2", "im Stadium T2 N0 M0", "60"), [HB5, "nach Entfernung eines Korpustumors"]);
});

test("Pfad Runde 2: Geschwister- statt Elternüberschrift (B 18.14 Knorpelschäden)", () => {
  assert.deepEqual(pfad("VMG:B 18.14", "ohne Bewegungseinschränkung", "10-30"), [KNORPEL]);
  assert.deepEqual(pfad("VMG:B 18.14", "mit Bewegungseinschränkung", "20-40"), [KNORPEL]);
  // Sweep: Skotome stehen im Druck auf Ebene von „Gesichtsfeldeinengungen“, nicht darunter
  assert.deepEqual(pfad("VMG:B 4.5", "mindestens 2/3 ausgefallene Fläche", "50"), [SKOTOME]);
});

test("Abschnitt mit Wert in der nummerierten Zeile hat keinen Titel (B 12.1.1)", () => {
  const n = data.nodes["VMG:B 12.1.1"];
  assert.equal(n.titel, null);
  assert.deepEqual(n.zeilen[0], { text: "Verlust, Ausfall oder Fehlen einer Niere bei Gesundheit der anderen Niere", gds: "25" });
  assert.equal(data.nodes["VMG:B 4.1"].titel, null);
  assert.equal(data.nodes["VMG:B 2.1"].titel, null);
  assert.equal(data.nodes["VMG:B 3.7"].titel, "Neurosen, Persönlichkeitsstörungen, Folgen psychischer Traumen");
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

let nextId = 1;
function call(name, args) {
  const reply = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } });
  return reply.result.isError ? { error: reply.result.content[0].text } : JSON.parse(reply.result.content[0].text);
}

test("vmg_get versteht Schreibweisen und zeigt Wert mit Pfad", () => {
  for (const k of ["VMG:B 3.7", "B 3.7", "b3.7"]) assert.equal(call("vmg_get", { kennung: k }).id, "VMG:B 3.7");
  const b37 = call("vmg_get", { kennung: "B 3.7" });
  assert.equal(b37.fundstelle, "Anlage zu § 2 VersMedV, Teil B Nr. 3.7");
  assert.ok(b37.zeilen.some((z) => z.gds === "30-40" && z.pfad.length === 2));
  assert.ok(b37.zeilen.every((z) => Array.isArray(z.pfad)));
  assert.match(b37.hinweis, /Teil A Nr\. 1\.4/);
  assert.equal(call("vmg_get", { kennung: "A 5 d jj" }).id, "VMG:A 5d jj");
  assert.equal(call("vmg_get", { kennung: "D 3" }).status, "aufgehoben");
  assert.match(call("vmg_get", { kennung: "B 99" }).error, /nicht gefunden/);
});

test("vmg_get: Abschnitte ohne amtliche Überschrift bekommen eine gekennzeichnete Bezeichnung", () => {
  const b = call("vmg_get", { kennung: "B 12.1.1" });
  assert.equal(b.titel, null);
  assert.equal(b.titel_abgeleitet, true);
  assert.match(b.bezeichnung, /^Verlust, Ausfall oder Fehlen einer Niere/);
  const amtlich = call("vmg_get", { kennung: "B 3.7" });
  assert.equal(amtlich.titel_abgeleitet, undefined);
  assert.equal(amtlich.bezeichnung, amtlich.titel);
  // Einleitungssatz ohne Titel bleibt vollständig dabei
  const b1713 = call("vmg_get", { kennung: "B 17.13" });
  assert.match(b1713.absaetze[0], /GdS während dieser Zeit$/);
});

test("vmg_list_structure liefert Gliederung und Teilbaum", () => {
  const all = call("vmg_list_structure", {});
  assert.deepEqual(all.knoten.map((k) => k.id), ["VMG:A", "VMG:B", "VMG:C", "VMG:D"]);
  const b3 = call("vmg_list_structure", { kennung: "B 3" });
  assert.equal(b3.knoten[0].id, "VMG:B 3");
  assert.ok(b3.knoten[0].children.some((c) => c.id === "VMG:B 3.7"));
  assert.equal(call("vmg_list_structure", { kennung: "D 3" }).knoten[0].status, "aufgehoben");
});

test("vmg_search findet über Wortlaut und Stichwörter", () => {
  assert.ok(call("vmg_search", { query: "Persönlichkeitsstörungen" }).results.some((r) => r.id === "VMG:B 3.7"));
  const drog = call("vmg_search", { query: "Drogenabhängigkeit" }).results;
  assert.ok(drog.some((r) => r.id === "VMG:B 3.8"));
  assert.ok(call("vmg_search", { query: "Hilflosigkeit", teil: "A" }).results.every((r) => r.id.startsWith("VMG:A")));
  assert.match(call("vmg_search", {}).error, /query oder icd/);
});

test("vmg_search: Zeilen immer mit Pfad und Fundstelle, höchstens 5, Kontext bei Knoten ohne Titel", () => {
  const r = call("vmg_search", { query: "Niere" }).results;
  assert.ok(r.length > 0);
  for (const x of r) {
    assert.match(x.fundstelle, /^Anlage zu § 2 VersMedV, Teil /);
    assert.ok(x.bezeichnung);
    if (x.zeilen) {
      assert.ok(x.zeilen.length <= 5);
      assert.ok(x.zeilen.every((z) => Array.isArray(z.pfad)));
    }
  }
  const haut = call("vmg_search", { query: "Melanom" }).results.find((x) => x.id === "VMG:B 17.13");
  assert.ok(haut, "B 17.13 gefunden");
  assert.match(haut.auszug, /GdS während dieser Zeit$/);
  assert.ok(haut.zeilen.some((z) => z.gds === "50"));
});

test("vmg_search leitet über einen ICD-Kode ab", () => {
  const r = call("vmg_search", { icd: "E11.90" });
  assert.ok(r.abgeleitet_icd.stichwoerter.some((s) => s.wort === "Diabetes mellitus" && s.ids.includes("VMG:B 15.1")));
  assert.match(r.abgeleitet_icd.hinweis, /nicht amtlich/);
  assert.ok(r.abgeleitet_icd.stichwoerter.length <= 10);
  assert.deepEqual(r.results, []);
  assert.match(call("vmg_search", { icd: "X99.99" }).error, /nicht gefunden/);
  assert.deepEqual(call("vmg_search", { icd: "Z00.0" }).abgeleitet_icd.stichwoerter, []);
});

test("normalizeVmgId", async () => {
  const { normalizeVmgId } = await import("../src/vmg.mjs");
  assert.equal(normalizeVmgId("vmg:b 3.7"), "VMG:B 3.7");
  assert.equal(normalizeVmgId(" a 4b "), "VMG:A 4b");
  assert.equal(normalizeVmgId("D"), "VMG:D");
});

test("ICF_MCP_VMG=0 schaltet das VersMedV-Modul ab", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = (env) =>
    (
      spawnSync(process.execPath, ["src/server.mjs"], {
        input:
          JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) + "\n" +
          JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize", params: {} }) + "\n",
        env: { ...process.env, ...env },
        cwd: new URL("..", import.meta.url).pathname,
        encoding: "utf-8",
      }).stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l)).reduce((acc, m) => ({ ...acc, [m.id]: m.result }), {})
    );
  const on = run({});
  assert.ok(on[1].tools.some((t) => t.name === "vmg_get"));
  assert.match(on[2].instructions, /Versorgungsmedizin/);
  const off = run({ ICF_MCP_VMG: "0" });
  assert.ok(!off[1].tools.some((t) => t.name.startsWith("vmg_")));
  assert.ok(!/Versorgungsmedizin/.test(off[2].instructions));
});

test("vmg_gesamt_gdb ist eine Prüfhilfe ohne Gesamtwert", () => {
  const r = call("vmg_gesamt_gdb", { einzel: [
    { bezeichnung: "Depression", gdb: 50, kennung: "B 3.7" },
    { bezeichnung: "Wirbelsäule", gdb: 30, kennung: "B 18.9" },
    { bezeichnung: "Hautekzem", gdb: 10, kennung: "B 17.1" },
  ] });
  assert.equal(r.ausgangswert, 50);
  assert.ok(r.eintraege[2].markierungen.some((m) => m.regel === "VMG:A 3.5"));
  assert.ok(!/gesamt_?gdb|voraussichtlich/i.test(Object.keys(r).join(" ")));
  assert.match(r.hinweis, /kein Gesamt-GdB berechnet/);
  assert.ok(r.regeln.some((g) => g.id === "VMG:A 3.3.4"));
});

test("vmg_gesamt_gdb erkennt Funktionssysteme", () => {
  const pair = (a, b) => call("vmg_gesamt_gdb", { einzel: [{ bezeichnung: "a", gdb: 30, kennung: a }, { bezeichnung: "b", gdb: 20, kennung: b }] }).paare;
  assert.deepEqual(pair("B 18.9", "B 18.14"), []);
  assert.equal(pair("B 18.9", "B 18.9")[0].beziehung, "gleich");
  assert.equal(pair("B 18.12", "B 18.14")[0].beziehung, "moeglicherweise_gleich");
  const own = call("vmg_gesamt_gdb", { einzel: [{ bezeichnung: "a", gdb: 30, kennung: "B 18.9", funktionssystem: "Beine" }, { bezeichnung: "b", gdb: 20, kennung: "B 18.14" }] });
  assert.equal(own.eintraege[0].funktionssystem_quelle, "angabe");
  assert.equal(own.paare[0].beziehung, "gleich");
});

test("vmg_gesamt_gdb prüft Eingaben", () => {
  for (const einzel of [[], [{ bezeichnung: "x", gdb: 35 }], [{ bezeichnung: "x", gdb: 110 }], [{ bezeichnung: "x", gdb: -10 }]])
    assert.ok(call("vmg_gesamt_gdb", { einzel }).error);
});

test("vmg_merkzeichen", () => {
  assert.equal(call("vmg_merkzeichen", { merkzeichen: "G" }).merkzeichen[0].fundstellen[0].id, "VMG:D 1");
  assert.match(call("vmg_merkzeichen", { merkzeichen: "aG" }).merkzeichen[0].norm, /SGB IX/);
  assert.equal(call("vmg_merkzeichen", {}).merkzeichen.length, 8);
  assert.ok(call("vmg_merkzeichen", { merkzeichen: "XY" }).error);
});

test("vmg_merkzeichen liefert den Wortlaut der Unterabschnitte", () => {
  const flat = (r) => JSON.stringify(r);
  const g = call("vmg_merkzeichen", { merkzeichen: "G" }).merkzeichen[0].fundstellen[0];
  assert.ok(g.unterabschnitte.length > 0 && g.unterabschnitte.every((u) => u.id && u.fundstelle));
  const d1a = data.nodes["VMG:D 1a"];
  assert.ok(flat(g.unterabschnitte).includes((d1a.absaetze ?? d1a.zeilen.map((z) => z.text))[0].slice(0, 40)));
  const h = flat(call("vmg_merkzeichen", { merkzeichen: "H" }));
  assert.ok(h.includes("VMG:A 5d jj"));
  const jj = data.nodes["VMG:A 5d jj"];
  assert.ok(h.includes((jj.absaetze ?? jj.zeilen.map((z) => z.text))[0].slice(0, 40)));
});

test("vmg_gesamt_gdb ordnet über Index, nicht über Bezeichnung", () => {
  const r = call("vmg_gesamt_gdb", { einzel: [
    { bezeichnung: "Knie", gdb: 30, kennung: "B 18.14" },
    { bezeichnung: "Knie", gdb: 40, kennung: "B 3.7" },
    { bezeichnung: "Bein", gdb: 20, kennung: "B 18.14" },
  ] });
  assert.deepEqual(r.eintraege.map((e) => e.index), [0, 1, 2]);
  assert.equal(r.paare.length, 1);
  assert.deepEqual([r.paare[0].a_index, r.paare[0].b_index], [0, 2]);
  const has = (i) => r.eintraege[i].markierungen.some((m) => m.regel === "VMG:A 3.1");
  assert.deepEqual([has(0), has(1), has(2)], [true, false, true]);
});

test("vmg_gesamt_gdb: GdB 20, Kennung außerhalb Teil B, weggefallenes Kapitel", () => {
  const r = call("vmg_gesamt_gdb", { einzel: [
    { bezeichnung: "a", gdb: 20, kennung: "B 17.1" },
    { bezeichnung: "b", gdb: 30, kennung: "A 3.5" },
    { bezeichnung: "c", gdb: 30, kennung: "B 1" },
  ] });
  assert.ok(r.eintraege[0].markierungen.some((m) => m.regel === "VMG:A 3.5"));
  for (const i of [1, 2]) {
    assert.equal(r.eintraege[i].funktionssystem, null);
    assert.match(r.eintraege[i].hinweis, /nicht bestimmbar/);
  }
});

// ---------------------------------------------------------------------------
// Abschluss-Review
// ---------------------------------------------------------------------------

test("Instructions benennen Teil C/D richtig und nennen die Prüfhilfen", () => {
  const ins = handleMessage({ jsonrpc: "2.0", id: 9001, method: "initialize", params: {} }).result.instructions;
  assert.match(ins, /Teil D[^.]*Merkzeichen/);
  assert.ok(!/Teil C \(Merkzeichen\)/.test(ins));
  assert.match(ins, /Sozialen Entschädigungsrecht/);
  assert.match(ins, /vmg_gesamt_gdb/);
  assert.match(ins, /vmg_merkzeichen/);
  assert.match(ins, /gutachterliche Entscheidung/);
});

test("Stichwortverzeichnis wird als redaktionelle Beigabe gekennzeichnet", () => {
  const g = call("vmg_get", { kennung: "B 15.1" });
  assert.ok(g.stichwoerter.length > 0);
  assert.match(g.stichwoerter_hinweis, /K710/);
  assert.equal(call("vmg_get", { kennung: "A 3.5" }).stichwoerter_hinweis, undefined);
  const s = call("vmg_search", { query: "Drogenabhängigkeit" });
  assert.ok(s.results.some((r) => r.stichwort));
  assert.match(s.stichwoerter_hinweis, /K710/);
  const ohneStichwort = call("vmg_search", { query: "Hilflosigkeit", teil: "A" });
  assert.equal(ohneStichwort.stichwoerter_hinweis !== undefined, ohneStichwort.results.some((r) => r.stichwort));
  const nur = call("vmg_search", { query: "Persönlichkeitsstörungen" });
  assert.equal(nur.stichwoerter_hinweis !== undefined, nur.results.some((r) => r.stichwort));
});

test("aG und TBl: Paraphrase wird nicht als Wortlaut ausgegeben", () => {
  for (const z of ["aG", "TBl"]) {
    const h = call("vmg_merkzeichen", { merkzeichen: z }).merkzeichen[0].hinweis;
    assert.ok(!/Wortlaut:/.test(h), z);
    assert.match(h, /sinngemäß/);
    assert.match(h, /maßgeblich ist der Gesetzeswortlaut/);
  }
});

test("vmg_list_structure: Tiefe begrenzt die Ausgabe", () => {
  const all = JSON.stringify(call("vmg_list_structure", {}));
  assert.ok(all.length < 10000, `Größe ${all.length}`);
  assert.ok(all.includes("VMG:B 18"));
  const b18 = JSON.stringify(call("vmg_list_structure", { kennung: "B 18" }));
  assert.ok(b18.includes("VMG:B 18.13") && b18.includes("VMG:B 18.14"));
  assert.ok(b18.length < 10000, `Größe ${b18.length}`);
  const full = JSON.stringify(call("vmg_list_structure", { tiefe: 0 }));
  assert.ok(full.includes("VMG:B 3.7") && full.length > all.length);
  const n = call("vmg_list_structure", { kennung: "B 3" }).knoten[0];
  assert.equal(n.bezeichnung, undefined);
  assert.ok(n.children.every((c) => c.children === undefined || c.children.length > 0));
});

test("Leere Ergebnisse tragen einen Hinweis", () => {
  assert.match(call("vmg_search", { icd: "F32.1" }).hinweis_leer, /Keine Treffer/);
  assert.match(call("vmg_search", { query: "qqqxyzqq" }).hinweis_leer, /Keine Treffer/);
  assert.equal(call("vmg_search", { query: "Niere" }).hinweis_leer, undefined);
});

test("ICD-Ableitung ignoriert verneinte Teile (ohne ...)", () => {
  const w = (icd) => call("vmg_search", { icd }).abgeleitet_icd.stichwoerter.map((s) => s.wort);
  assert.ok(!w("I12.9").includes("Niereninsuffizienz"));
  assert.ok(!w("K80.20").includes("Zystitis"));
  // Schutz: legitime Ableitungen bleiben (auch über „mit/bei“)
  assert.ok(w("E11.50").includes("Kreislauf"));
  assert.ok(w("E11.90").includes("Diabetes mellitus"));
});

test("hinweis_leer: Treffer aus query unterdrücken den Top-Level-Hinweis, ICD-Hinweis steht im Block", () => {
  const r = call("vmg_search", { query: "Persönlichkeitsstörungen", icd: "F32.1" });
  assert.ok(r.results.length > 0);
  assert.equal(r.hinweis_leer, undefined);
  assert.match(r.abgeleitet_icd.hinweis_leer, /Keine Stichwörter/);
  const nur = call("vmg_search", { icd: "F32.1" });
  assert.match(nur.hinweis_leer, /Keine Treffer/);
});

test("normalizeVmgId akzeptiert das eigene Fundstellen-Format", () => {
  for (const k of ["Teil B Nr. 3.7", "Anlage zu § 2 VersMedV, Teil B Nr. 3.7"]) assert.equal(call("vmg_get", { kennung: k }).id, "VMG:B 3.7");
  assert.equal(call("vmg_get", { kennung: "Anlage zu § 2 VersMedV, Teil A" }).id, "VMG:A");
});

test("gdb 25 wird mit Begründung abgelehnt", () => {
  const e = call("vmg_gesamt_gdb", { einzel: [{ bezeichnung: "x", gdb: 25 }] }).error;
  assert.match(e, /Nr\. 1\.1/);
  assert.match(e, /Zehnergrad/);
});
