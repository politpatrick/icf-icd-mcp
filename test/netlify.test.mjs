import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Netlify bricht einen Build ab, wenn das ignore-Kommando mit 0 endet, und baut bei 1 weiter.
// Builds über einen Build-Hook (monatliche Veröffentlichung) laufen unabhängig davon immer.
const ignore = (context) =>
  spawnSync("bash", ["./scripts/netlify_ignore.sh"], { env: { ...process.env, CONTEXT: context } }).status;

test("Netlify: Produktions-Builds aus Git werden übersprungen, Vorschauen nicht", () => {
  assert.equal(ignore("production"), 0);
  assert.equal(ignore("deploy-preview"), 1);
  assert.equal(ignore("branch-deploy"), 1);
  assert.equal(ignore(""), 1);
});

test("Netlify: netlify.toml nutzt das ignore-Skript", () => {
  assert.match(readFileSync("netlify.toml", "utf-8"), /ignore = "bash \.\/scripts\/netlify_ignore\.sh"/);
});

test("Monatliche Veröffentlichung: Workflow löst den Build-Hook aus", () => {
  const wf = readFileSync(".github/workflows/veroeffentlichen.yml", "utf-8");
  assert.match(wf, /cron: "0 10 2 \* \*"/);
  assert.match(wf, /workflow_dispatch/);
  assert.match(wf, /secrets\.NETLIFY_BUILD_HOOK/);
});
