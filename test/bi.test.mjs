import { test } from "node:test";
import assert from "node:assert/strict";

const { handleMessage } = await import("../src/protocol.mjs");
const bi = await import("../src/bi.mjs");
const { readData } = await import("../src/data.mjs");

let nextId = 1;
function call(name, args) {
  const reply = handleMessage({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } });
  return reply.result.isError ? { error: reply.result.content[0].text } : JSON.parse(reply.result.content[0].text);
}

test("BI-Tools sind standardmäßig aktiv", () => {
  const { tools } = handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }).result;
  const names = tools.map((t) => t.name).filter((n) => n.startsWith("bi_"));
  assert.deepEqual(names.sort(), [
    "bi_calculate", "bi_compare", "bi_get_item", "bi_icf_mapping", "bi_interpret_coding", "bi_list_structure", "bi_related", "bi_scoring_rules", "bi_search",
  ]);
  const init = handleMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: {} }).result;
  assert.match(init.instructions, /Begutachtungsinstrument nach § 15 SGB XI/);
});

test("Datenbestand: alle Kriterien der Module 1–6 mit verbindlicher Definition und Ausprägungstexten", () => {
  const data = readData("bi.json");
  const crit = Object.values(data.nodes).filter((n) => n.art === "kriterium" && n.modul);
  // 5 + 1.B, 11, 13, 13 + 4.4.0, 16 + 4.5.K, 6
  assert.equal(crit.length, 67);
  for (const n of crit) {
    if (n.modul === 3 || ["BI:4.4.0"].includes(n.id)) continue;
    const variants = n.nur === "kinder" ? ["kinder"] : ["erwachsene", "kinder"];
    for (const v of variants) assert.ok(n.texte?.[v]?.definition, `${n.id} ${v}: Definition fehlt`);
  }
  for (const n of crit.filter((n) => ["selbstaendigkeit", "faehigkeit", "sonde", "diaet"].includes(n.skala))) {
    for (const v of ["erwachsene", "kinder"]) {
      assert.equal(Object.keys(n.texte?.[v]?.auspraegungen ?? {}).length, 4, `${n.id} ${v}: Ausprägungstexte unvollständig`);
    }
  }
  // Alle Kanten zeigen auf vorhandene Knoten
  for (const e of data.edges.filter((e) => !e.to.startsWith("ICF:"))) {
    assert.ok(data.nodes[e.from], `Kante von unbekanntem Knoten ${e.from}`);
    assert.ok(data.nodes[e.to], `Kante zu unbekanntem Knoten ${e.to}`);
  }
  // Bindestriche aus dem Fettdruck sind ergänzt
  assert.match(data.nodes["BI:4.1.B"].texte.erwachsene.definition, /Greif-, Steh- und Gehfunktionen/);
});

test("bi_get_item liefert Definition, Ausprägungen mit Punkten und Abgrenzungen", () => {
  const umsetzen = call("bi_get_item", { code: "BI:4.1.3" });
  assert.equal(umsetzen.titel, "Umsetzen");
  assert.deepEqual(umsetzen.formular_ziffer, { erwachsene: "F 4.1.3", kinder: "KF 4.1.3" });
  assert.match(umsetzen.texte.erwachsene.definition, /übliche Sitzhöhe etwa 45 cm/);
  assert.equal(umsetzen.texte.erwachsene.definition_verbindlich, true);
  assert.equal(umsetzen.auspraegungen.length, 4);
  assert.match(umsetzen.auspraegungen[3].erlaeuterung, /gehoben oder getragen/);

  const essen = call("bi_get_item", { code: "4.4.8" });
  assert.deepEqual(essen.auspraegungen.map((a) => a.einzelpunkte), [0, 3, 6, 9]);

  const kind = call("bi_get_item", { code: "KF 4.4.1" });
  assert.ok(kind.texte.kinder && !kind.texte.erwachsene);
  assert.match(kind.texte.kinder.hinweis_alter[0], /unter zwei Jahren/);

  const bett = call("bi_get_item", { code: "4.1.1" });
  assert.ok(bett.beziehungen.ausgehend.some((b) => b.typ === "abgrenzung" && b.code === "BI:4.6.2"));

  assert.match(call("bi_get_item", { code: "4.9.9" }).error, /nicht gefunden/);
});

test("bi_search findet Kriterien über Erläuterungstexte", () => {
  const hits = call("bi_search", { query: "Kompressionsstrümpfe", nur_kriterien: true });
  assert.equal(hits[0].code, "BI:4.5.7");
  const insulin = call("bi_search", { query: "Insulin" });
  assert.ok(insulin.some((h) => h.code === "BI:4.5.2"));
});

test("bi_compare zeigt die wörtliche Abgrenzung der BRi", () => {
  const cmp = call("bi_compare", { code_a: "4.3.2", code_b: "4.6.2" });
  assert.equal(cmp.abgrenzung_vorhanden, true);
  assert.ok(cmp["BI:4.3.2 → BI:4.6.2"].some((e) => /nur unter F 4\.6\.2/.test(e.text)));
});

test("bi_interpret_coding prüft Stufen, Häufigkeiten und Optionen", () => {
  const { ergebnisse } = call("bi_interpret_coding", { coding: "BI:4.1.3=2; F 4.3.2=3; 4.5.1=3x/Tag; 5.4=unfall; 4.3.2=5; 4.1.B=ja" });
  assert.equal(ergebnisse[0].label, "überwiegend unselbständig");
  assert.equal(ergebnisse[1].label, "täglich");
  assert.equal(ergebnisse[1].einzelpunkte_erwachsene, 5);
  assert.equal(ergebnisse[2].kodierung, "BI:4.5.1=3/Tag");
  assert.equal(ergebnisse[3].label, "Unfall");
  assert.equal(ergebnisse[4].gueltig, false);
  assert.match(ergebnisse[4].fehler, /Stufe, nicht der Punktwert/);
  assert.equal(ergebnisse[5].kodierung, "BI:4.1.B=1");
});

test("Modul 5: Rechenbeispiele aus den BRi (S. 109–110)", () => {
  const r = bi.calculate({
    kodierung: "4.5.1=3/Tag; 4.5.2=3/Monat; 4.5.5=2/Woche; 4.5.10=1/Tag; 4.5.8=2/Woche; 4.5.11=2/Monat; 4.5.15=1/Monat; 4.5.13=1/Woche",
  });
  const [a, b, c] = r.module[4].gruppen;
  assert.equal(a.massnahmen_pro_tag, 3.3857); // „3,4 Maßnahmen pro Tag“
  assert.equal(a.einzelpunkte, 2);
  assert.equal(b.massnahmen_pro_tag, 1.3524); // „1,4 Maßnahmen pro Tag“
  assert.equal(b.einzelpunkte, 2);
  assert.equal(c.zwischensumme, 6.3);
  assert.equal(c.einzelpunkte, 1);
  assert.equal(r.module[4].summe_einzelpunkte, 5);
  assert.equal(r.module[4].gewichtete_punkte, 15);
  // Tägliche zeit- und technikintensive Maßnahme (z. B. invasive Beatmung): 60 Punkte → 6 Einzelpunkte
  const beatmung = bi.calculate({ kodierung: "4.5.12=1/Tag" });
  assert.equal(beatmung.module[4].gruppen[2].einzelpunkte, 6);
});

test("Pflegegrad-Schwellen, Modul 2/3 und besondere Bedarfskonstellation", () => {
  // M1: 15 → 10; M4: 4.4.1–4.4.7 je 3 = 21 → 30; M6: 4.6.1+4.6.2 = 4 → 7,5; zusammen 47,5 → PG 3
  const werte = { "4.1.1": 3, "4.1.2": 3, "4.1.3": 3, "4.1.4": 3, "4.1.5": 3, "4.6.1": 2, "4.6.2": 2, "4.1.B": "nein" };
  for (let i = 1; i <= 7; i++) werte[`4.4.${i}`] = 3;
  const r = bi.calculate({ werte });
  assert.equal(r.gesamtpunkte, 47.5);
  assert.equal(r.pflegegrad, 3);
  // Modul 2/3: nur der höhere gewichtete Wert zählt
  const m23 = bi.calculate({ werte: { "4.2.1": 3, "4.2.2": 3, "4.3.1": 3, "4.3.2": 3, "4.1.B": "nein" } });
  assert.equal(m23.module[1].gewichtete_punkte, 7.5); // 6 Punkte
  assert.equal(m23.module[2].gewichtete_punkte, 15); // 10 Punkte
  assert.equal(m23.gewichtete_punkte_modul_2_oder_3, 15);
  assert.equal(m23.gesamtpunkte, 15);
  assert.equal(m23.pflegegrad, 1);
  // Besondere Bedarfskonstellation → PG 5 unabhängig von Punkten
  const bbk = bi.calculate({ werte: { "4.1.B": "ja" } });
  assert.equal(bbk.pflegegrad, 5);
  assert.equal(bbk.pflegegrad_nach_punkten, 0);
});

test("4.4.11 zählt nur bei Inkontinenz oder künstlicher Ableitung", () => {
  const kontinent = bi.calculate({ werte: { "4.4.11": 3, "4.4.V2": "staendig_kontinent" } });
  assert.equal(kontinent.module[3].summe_einzelpunkte, 0);
  const dk = bi.calculate({ werte: { "4.4.11": 3, "4.4.V2": "dk_transurethral" } });
  assert.equal(dk.module[3].summe_einzelpunkte, 3);
});

test("Kinder: Altersvergleich nach den Beispielen der BRi (S. 149)", () => {
  // Essen unselbständig, altersentsprechend überwiegend selbständig (20 bis unter 30 Monate) → 2 × 3 = 6
  const essen = bi.calculate({ alter_monate: 24, werte: { "4.4.8": 3 } });
  assert.equal(essen.module[3].detail.find((d) => d.code === "BI:4.4.8").einzelpunkte, 6);
  // Toilette überwiegend unselbständig, altersentsprechend selbständig (ab 6 Jahren) → 2 × 2 = 4
  const toilette = bi.calculate({ alter_monate: 80, werte: { "4.4.10": 2 } });
  assert.equal(toilette.module[3].detail.find((d) => d.code === "BI:4.4.10").einzelpunkte, 4);
  // Gleiche Stufe wie altersentsprechend → 0
  const gleich = bi.calculate({ alter_monate: 29, werte: { "4.2.3": 3 } }); // unter 2 J. 6 M.: „nicht vorhanden“
  assert.equal(gleich.module[1].summe_einzelpunkte, 0);
  // Ab 11 Jahren gilt die Systematik für Erwachsene
  assert.match(bi.calculate({ alter_monate: 132 }).systematik, /Erwachsene/);
  // Alter aus Geburtsdatum
  assert.equal(bi.calculate({ geburtsdatum: "2024-03-15", begutachtungsdatum: "2026-03-15" }).alter_monate, 24);
});

test("Kinder bis 18 Monate: 4.4.0 mit 20 Punkten und Einstufung einen Grad höher", () => {
  const r = bi.calculate({ alter_monate: 10, werte: { "4.4.0": "ja", "4.1.B": "nein" } });
  assert.equal(r.systematik, "Kinder bis 18 Monate");
  assert.equal(r.module[3].summe_einzelpunkte, 20);
  assert.equal(r.module[3].gewichtete_punkte, 30);
  assert.equal(r.gesamtpunkte, 30);
  assert.equal(r.pflegegrad, 3); // ab 27 Punkten: PG 3 statt PG 2
  // Module 1, 2 und 6 werden nicht bewertet
  const ohne = bi.calculate({ alter_monate: 10, werte: { "4.1.1": 3, "4.2.1": 3, "4.6.5": 3 } });
  assert.equal(ohne.gesamtpunkte, 0);
});

test("ICF_MCP_BI=0 schaltet das BI-Modul ab", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = (env) =>
    JSON.parse(
      spawnSync(process.execPath, ["src/server.mjs"], {
        input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) + "\n",
        env: { ...process.env, ...env },
        cwd: new URL("..", import.meta.url).pathname,
        encoding: "utf-8",
      }).stdout
    ).result.tools.map((t) => t.name);
  assert.ok(run({}).includes("bi_calculate"));
  assert.ok(run({}).includes("bi_icf_mapping"));
  assert.ok(!run({ ICF_MCP_BI: "0" }).some((n) => n.startsWith("bi_")));
});

test("ICF-Zuordnung: jedes Kriterium zugeordnet, alle Ziele existieren in der ICF 2005", () => {
  const data = readData("bi.json");
  const icf = readData("icf_flat.json");
  const crit = Object.values(data.nodes).filter((n) => n.art === "kriterium");
  const mapped = new Set(data.edges.filter((e) => e.quelle === "kuratiert").map((e) => e.from));
  for (const n of crit) assert.ok(mapped.has(n.id), `${n.id} ohne ICF-Zuordnung`);
  for (const e of data.edges.filter((e) => e.quelle === "kuratiert")) {
    assert.ok(e.to.startsWith("ICF:") && icf[e.to.slice(4)], `${e.from} → ${e.to} existiert nicht`);
    assert.ok(e.text && e.text.length > 5, `${e.from} → ${e.to} ohne Begründung`);
    assert.match(e.type, /^icf_(entspricht|teilweise|funktion|umwelt)$/);
  }
});

test("bi_icf_mapping: BI → ICF mit Beziehung und Begründung", () => {
  const r = call("bi_icf_mapping", { code: "4.1.3" });
  assert.equal(r.richtung, "BI → ICF");
  const icf = r.zuordnungen[0].icf;
  assert.equal(icf[0].beziehung, "entspricht");
  assert.ok(icf.some((x) => x.icf === "d420" && x.titel === "Sich verlagern"));
  // Abweichender Zuschnitt wird begründet: Schneiden gehört in der ICF zu d550, im BI zu 4.4.7
  const zubereiten = call("bi_icf_mapping", { code: "4.4.7" }).zuordnungen[0].icf;
  assert.ok(zubereiten.find((x) => x.icf === "d550").begruendung.includes("4.4.7"));
  // Modul: alle Kriterien, optional nach Beziehung gefiltert
  const modul = call("bi_icf_mapping", { code: "BI:4.2", beziehung: "funktion" });
  assert.ok(modul.zuordnungen.every((z) => z.icf.every((x) => x.beziehung === "funktion")));
  assert.match(call("bi_icf_mapping", { code: "5.4" }).error, /keine ICF-Zuordnung/);
  // In bi_get_item enthalten
  assert.ok(call("bi_get_item", { code: "4.4.8" }).icf_zuordnung.some((x) => x.icf === "d550"));
});

test("bi_icf_mapping: ICF → BI auch über Ober- und Unterkategorien", () => {
  const r = call("bi_icf_mapping", { code: "d420" });
  assert.equal(r.richtung, "ICF → BI");
  assert.ok(r.bi_kriterien.some((k) => k.bi === "BI:4.1.3" && k.ueber === "direkt"));
  assert.ok(r.bi_kriterien.some((k) => k.bi === "BI:4.1.1" && k.ueber === "unterkategorie" && k.icf === "d4201"));
  const kurz = call("bi_icf_mapping", { code: "b1440" });
  assert.ok(kurz.bi_kriterien.some((k) => k.bi === "BI:4.2.4" && k.ueber === "oberkategorie" && k.icf === "b144"));
  assert.match(call("bi_icf_mapping", { code: "b9999" }).error, /nicht gefunden/);
});

test("icf_get_related nennt zugeordnete BI-Kriterien", () => {
  const r = call("icf_get_related", { code: "d550" });
  assert.equal(r.begutachtungsinstrument.quelle, "kuratiert");
  assert.ok(r.begutachtungsinstrument.kriterien.some((k) => k.bi === "BI:4.4.8"));
});
