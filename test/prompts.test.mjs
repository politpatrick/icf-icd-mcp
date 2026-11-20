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
