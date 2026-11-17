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
