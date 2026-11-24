import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../src/protocol.mjs";

let nextId = 1;
const rpc = (method, params = {}) => handleMessage({ jsonrpc: "2.0", id: nextId++, method, params });
const text = (name, args) => rpc("prompts/get", { name, arguments: args }).result.messages[0].content.text;

test("initialize meldet Prompts", () => {
  assert.ok(rpc("initialize").result.capabilities.prompts);
});

test("prompts/list enthält die Pflege-Prompts mit Argumenten", () => {
  const { prompts } = rpc("prompts/list").result;
  const namen = prompts.map((p) => p.name);
  assert.ok(namen.includes("pflegegrad_interview") && namen.includes("pflegegutachten_verstehen"));
  const interview = prompts.find((p) => p.name === "pflegegrad_interview");
  assert.ok(interview.arguments.some((a) => a.name === "wer_antwortet"));
  assert.ok(interview.arguments.some((a) => a.name === "alter_monate" && !a.required));
});

test("pflegegrad_interview: Ablauf mit Werkzeugen, Kinder, keine Rechtsberatung", () => {
  const r = rpc("prompts/get", { name: "pflegegrad_interview", arguments: { wer_antwortet: "person", alter_monate: "30" } }).result;
  assert.equal(r.messages[0].role, "user");
  const t = r.messages[0].content.text;
  for (const w of ["bi_get_item", "bi_calculate", "fall_pruefen", "Kinder", "keine Rechtsberatung", "Pflegetagebuch"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht/i.test(t));
});

test("pflegegutachten_verstehen: Gegenüberstellung, Hinweise auf Frist und Beratung", () => {
  const t = text("pflegegutachten_verstehen", {});
  for (const w of ["bi_gegenueberstellen", "Rechtsbehelfsbelehrung", "EUTB", "keine Rechtsberatung"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht/i.test(t));
});

test("Fehler: unbekannter Prompt und ungültiges Alter", () => {
  assert.equal(rpc("prompts/get", { name: "gibt_es_nicht" }).error.code, -32602);
  assert.equal(rpc("prompts/get", { name: "pflegegrad_interview", arguments: { alter_monate: "abc" } }).error.code, -32602);
  assert.equal(rpc("prompts/get", { name: "pflegegrad_interview", arguments: { wer_antwortet: "nachbar" } }).error.code, -32602);
});

test("ICF_MCP_BI=0: keine Pflege-Prompts", async () => {
  const { spawnSync } = await import("node:child_process");
  const out = spawnSync(process.execPath, ["src/server.mjs"], {
    input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "prompts/list" }) + "\n",
    env: { ...process.env, ICF_MCP_BI: "0" },
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf-8",
  }).stdout;
  assert.ok(!JSON.parse(out).result.prompts.some((p) => p.name.startsWith("pflege")));
});

test("Instructions nennen bi_gegenueberstellen und die Prompts", () => {
  const ins = rpc("initialize").result.instructions;
  assert.match(ins, /bi_gegenueberstellen/);
  assert.match(ins, /pflegegrad_interview/);
});

test("Altersangaben im Prompt passen zur Systematik", () => {
  assert.ok(!/Kind/.test(text("pflegegutachten_verstehen", { alter_monate: "600" })));
  const jugend = text("pflegegrad_interview", { alter_monate: "180" });
  assert.ok(!/gleichaltrigen Kindern/.test(jugend));
  assert.match(jugend, /Punktesystematik für Erwachsene/);
  assert.match(text("pflegegrad_interview", { alter_monate: "12" }), /4\.4\.0/);
  assert.match(text("pflegegrad_interview", { alter_monate: "60" }), /gleichaltrigen Kindern/);
});

test("wer_antwortet akzeptiert keine eingebauten Namen; params null", () => {
  assert.equal(rpc("prompts/get", { name: "pflegegrad_interview", arguments: { wer_antwortet: "constructor" } }).error.code, -32602);
  assert.equal(handleMessage({ jsonrpc: "2.0", id: 500, method: "prompts/get", params: null }).error.code, -32602);
});

test("eigene_darstellung_vorbereiten: in der Liste mit Argumenten", () => {
  const p = rpc("prompts/list").result.prompts.find((x) => x.name === "eigene_darstellung_vorbereiten");
  assert.ok(p);
  assert.deepEqual(p.arguments.map((a) => a.name), ["wer_antwortet", "bereich"]);
  assert.ok(p.arguments.every((a) => !a.required));
});

test("eigene_darstellung_vorbereiten: Ablauf, Trennung der Angaben, Beratung, keine Rechtsberatung", () => {
  const t = text("eigene_darstellung_vorbereiten", {});
  for (const w of ["verfahren_info", "fall_pruefen", "O-Ton", "Tatsachen", "Beobachtungen", "Belege", "EUTB", "§ 7a SGB XI", "Pflegestützpunkt", "Sozialverb", "keine Rechtsberatung", "Rechtsbehelfsbelehrung"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht/i.test(t));
  assert.ok(!t.includes("bi_gegenueberstellen"));
  assert.match(text("eigene_darstellung_vorbereiten", { wer_antwortet: "unterstuetzende_person" }), /unterstützenden Person/);
});

test("eigene_darstellung_vorbereiten: Bereich", () => {
  assert.match(text("eigene_darstellung_vorbereiten", { bereich: "pflege" }), /bi_gegenueberstellen/);
  assert.match(text("eigene_darstellung_vorbereiten", { bereich: "gdb" }), /VersMedV|vmg_/);
  assert.match(text("eigene_darstellung_vorbereiten", { bereich: "teilhabe" }), /§ 14 SGB IX|zustaendigkeit/);
  assert.match(text("eigene_darstellung_vorbereiten", { bereich: "" }), /Frag zu Beginn, worum es geht/);
  for (const bereich of ["rente", "constructor"]) assert.equal(rpc("prompts/get", { name: "eigene_darstellung_vorbereiten", arguments: { bereich } }).error.code, -32602, bereich);
  assert.equal(rpc("prompts/get", { name: "eigene_darstellung_vorbereiten", arguments: { wer_antwortet: "nachbar" } }).error.code, -32602);
});

test("ICF_MCP_BI=0 und ICF_MCP_VMG=0: eigene_darstellung_vorbereiten bleibt, ohne abgeschaltete Werkzeuge", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = (env, msg) => JSON.parse(spawnSync(process.execPath, ["src/server.mjs"], {
    input: JSON.stringify(msg) + "\n",
    env: { ...process.env, ...env },
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf-8",
  }).stdout);
  const get = (bereich) => ({ jsonrpc: "2.0", id: 1, method: "prompts/get", params: { name: "eigene_darstellung_vorbereiten", arguments: { bereich } } });
  const pflege = run({ ICF_MCP_BI: "0" }, get("pflege")).result.messages[0].content.text;
  assert.ok(!pflege.includes("bi_"));
  const gdb = run({ ICF_MCP_VMG: "0" }, get("gdb")).result.messages[0].content.text;
  assert.ok(!gdb.includes("vmg_"));
});

// --- GdB-Prompts (1.10.0) ---

test("gdb-Prompts: in der Liste mit Argumenten", () => {
  const { prompts } = rpc("prompts/list").result;
  const antrag = prompts.find((p) => p.name === "gdb_antrag_vorbereiten");
  const bescheid = prompts.find((p) => p.name === "gdb_bescheid_verstehen");
  assert.deepEqual(antrag.arguments.map((a) => a.name), ["wer_antwortet", "alter_monate"]);
  assert.deepEqual(bescheid.arguments.map((a) => a.name), ["alter_monate"]);
  assert.ok([...antrag.arguments, ...bescheid.arguments].every((a) => !a.required));
});

test("gdb_antrag_vorbereiten: Ablauf, Werkzeuge, Grenzen", () => {
  const t = text("gdb_antrag_vorbereiten", {});
  for (const w of ["icd_search", "vmg_search", "vmg_get", "vmg_spanne_pruefen", "vmg_merkzeichen", "fall_pruefen", "O-Ton", "Befund", "Teil A Nr. 1.4", "kein Gesamt-GdB", "Nachteilsausgleiche", "EUTB", "keine Rechtsberatung"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht/i.test(t));
  assert.ok(!/Teil A Nr\. 5/.test(t));
  assert.match(text("gdb_antrag_vorbereiten", { alter_monate: "60" }), /Teil A Nr\. 5/);
  assert.match(text("gdb_antrag_vorbereiten", { wer_antwortet: "unterstuetzende_person" }), /unterstützenden Person/);
});

test("gdb_bescheid_verstehen: Zuordnung, Prüfhilfe, Verfahren", () => {
  const t = text("gdb_bescheid_verstehen", {});
  for (const w of ["vmg_spanne_pruefen", "vmg_gesamt_gdb", "verfahren_info", "Rechtsbehelfsbelehrung", "Teil A Nr. 3", "kein Gesamt-GdB", "EUTB", "keine Rechtsberatung"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht|rechtswidrig/i.test(t));
  assert.match(text("gdb_bescheid_verstehen", { alter_monate: "60" }), /Teil A Nr\. 5/);
});

test("gdb-Prompts: Fehler und ICF_MCP_VMG=0", async () => {
  assert.equal(rpc("prompts/get", { name: "gdb_antrag_vorbereiten", arguments: { alter_monate: "-1" } }).error.code, -32602);
  assert.equal(rpc("prompts/get", { name: "gdb_bescheid_verstehen", arguments: { alter_monate: "x" } }).error.code, -32602);
  assert.equal(rpc("prompts/get", { name: "gdb_antrag_vorbereiten", arguments: { wer_antwortet: "nachbar" } }).error.code, -32602);
  const { spawnSync } = await import("node:child_process");
  const out = spawnSync(process.execPath, ["src/server.mjs"], {
    input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "prompts/list" }) + "\n",
    env: { ...process.env, ICF_MCP_VMG: "0" },
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf-8",
  }).stdout;
  assert.ok(!JSON.parse(out).result.prompts.some((p) => p.name.startsWith("gdb_")));
});

test("Review: GdB-Prompts – Merkzeichen ohne Wortlaut, Herkunft eigener Werte, Zeilenzuordnung", () => {
  const a = text("gdb_antrag_vorbereiten", {});
  assert.match(a, /aG, RF und TBl nennt das Werkzeug nur die maßgebliche Norm/);
  assert.match(a, /herkunft "interview".*status "geschildert"/);
  assert.ok(!/herkunft "interview" bzw\. "befund"/.test(a));
  assert.match(a, /bei anderen Leistungsträgern oder der Gemeinde gestellt/);
  const b = text("gdb_bescheid_verstehen", {});
  assert.match(b, /aG, RF und TBl nennt das Werkzeug nur die maßgebliche Norm/);
  assert.match(b, /alle Zeilen des Abschnitts/);
  assert.match(b, /nicht die des Versorgungsamts/);
});

// --- Teilhabe-Prompts (1.11.0) ---

test("Teilhabe-Prompts: in der Liste mit Argumenten", () => {
  const { prompts } = rpc("prompts/list").result;
  assert.deepEqual(prompts.find((p) => p.name === "teilhabebedarf_erfassen").arguments.map((a) => a.name), ["wer_antwortet", "alter_monate"]);
  assert.deepEqual(prompts.find((p) => p.name === "bedarfsfeststellung_verstehen").arguments.map((a) => a.name), ["alter_monate"]);
});

test("teilhabebedarf_erfassen: Lebensbereiche, ICF, Wünsche, Abgrenzung, Grenzen", () => {
  const t = text("teilhabebedarf_erfassen", {});
  for (const w of ["§ 118 SGB IX", "icf_search", "icf_get_code", "icd_search", "O-Ton", "Ich-Form", "Umweltfaktoren", "Ziele", "abgrenzung_egh_pflege", "verfahren_info", "§ 117 Abs. 2 SGB IX", "§ 104 Abs. 2 SGB IX", "fall_pruefen", "EUTB", "keine Rechtsberatung"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht|nur Pflege/i.test(t));
  assert.ok(!t.includes("§ 35a SGB VIII"));
  assert.match(text("teilhabebedarf_erfassen", { alter_monate: "120" }), /§ 35a SGB VIII.*VwGO/s);
});

test("bedarfsfeststellung_verstehen: Abgleich ohne Bewertung", () => {
  const t = text("bedarfsfeststellung_verstehen", {});
  for (const w of ["§ 121 SGB IX", "Wünsche", "Ziele", "Belege", "fall_vergleichen", "abgrenzung_egh_pflege", "verfahren_info", "Rechtsbehelfsbelehrung", "EUTB", "keine Rechtsberatung"]) assert.ok(t.includes(w), w);
  assert.ok(!/Erfolgsaussicht|rechtswidrig/i.test(t));
  assert.equal(rpc("prompts/get", { name: "bedarfsfeststellung_verstehen", arguments: { alter_monate: "x" } }).error.code, -32602);
  assert.equal(rpc("prompts/get", { name: "teilhabebedarf_erfassen", arguments: { wer_antwortet: "nachbar" } }).error.code, -32602);
});

test("ICF_MCP_BI=0: Teilhabe-Prompts bleiben, ohne abgrenzung_egh_pflege; Tool fehlt", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = (msgs) => spawnSync(process.execPath, ["src/server.mjs"], {
    input: msgs.map((m) => JSON.stringify(m)).join("\n") + "\n",
    env: { ...process.env, ICF_MCP_BI: "0" },
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf-8",
  }).stdout.trim().split("\n").map((l) => JSON.parse(l));
  const [tools, p1, p2] = run([
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    { jsonrpc: "2.0", id: 2, method: "prompts/get", params: { name: "teilhabebedarf_erfassen", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "prompts/get", params: { name: "bedarfsfeststellung_verstehen", arguments: {} } },
  ]);
  assert.ok(!tools.result.tools.some((t) => t.name === "abgrenzung_egh_pflege"));
  for (const p of [p1, p2]) assert.ok(!p.result.messages[0].content.text.includes("abgrenzung_egh_pflege"));
});

test("Review: Teilhabe-Prompts – Wünsche nach § 117, Kinder § 10 Abs. 4 SGB VIII, Herkunft, Instructions ohne BI", async () => {
  const b = text("bedarfsfeststellung_verstehen", {});
  assert.ok(!b.includes("§ 121 Abs. 4"));
  assert.match(b, /§ 117 Abs\. 1 Nr\. 2 SGB IX/);
  const k = text("teilhabebedarf_erfassen", { alter_monate: "120" });
  assert.match(k, /§ 10 Abs\. 4 SGB VIII/);
  assert.match(k, /§ 41 SGB VIII/);
  assert.match(k, /Rechtsbehelfsbelehrung/);
  assert.ok(!/beurteilen Fachleute/.test(k));
  assert.match(text("teilhabebedarf_erfassen", {}), /§ 118 SGB IX.*amtlich.*kuratiert/s);
  const { spawnSync } = await import("node:child_process");
  const out = spawnSync(process.execPath, ["src/server.mjs"], {
    input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n",
    env: { ...process.env, ICF_MCP_BI: "0" },
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf-8",
  }).stdout;
  const ins = JSON.parse(out).result.instructions;
  assert.match(ins, /teilhabebedarf_erfassen/);
  assert.ok(!ins.includes("abgrenzung_egh_pflege"));
});

test("leistungen_finden: in der Liste, Ablauf, Grenzen, Fehler", () => {
  const p = rpc("prompts/list").result.prompts.find((x) => x.name === "leistungen_finden");
  assert.ok(p);
  assert.ok(p.arguments.some((a) => a.name === "wer_antwortet" && !a.required));
  const t = text("leistungen_finden", {});
  for (const w of ["leistungshinweise", "fall_pruefen", "Bescheid", "Landesrecht", "EUTB", "§ 7a SGB XI", "keine Rechtsberatung", "keine Beträge", "was wäre, wenn"]) assert.ok(t.includes(w), w);
  assert.match(t, /nächsten? Schritt/);
  assert.ok(!/Erfolgsaussicht/i.test(t));
  assert.ok(!/Euro|€|\d\s*%/.test(t));
  assert.ok(t.includes("verfahren") && t.includes("ergebnis"));
  assert.match(t, /alter_hinweis immer|`alter_hinweis` immer/);
  assert.match(text("leistungen_finden", { wer_antwortet: "unterstuetzende_person" }), /unterstützenden Person/);
  assert.equal(rpc("prompts/get", { name: "leistungen_finden", arguments: { wer_antwortet: "nachbar" } }).error.code, -32602);
  assert.equal(rpc("prompts/get", { name: "leistungen_finden", arguments: { wer_antwortet: "constructor" } }).error.code, -32602);
});
