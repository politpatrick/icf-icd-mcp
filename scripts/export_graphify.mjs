#!/usr/bin/env node
// Exportiert das amtliche Wissensnetz von ICD-10-GM und ICF im Extraktionsformat von graphify
// (https://github.com/Graphify-Labs/graphify). Alle Kanten stammen aus den BfArM-Daten und werden
// als EXTRACTED mit confidence_score 1.0 markiert; graphify ergänzt nichts.
//
// Aufruf: node scripts/export_graphify.mjs [ZIELDATEI]   (Standard: graphify-out/.graphify_extract.json)

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as icd from "../src/icd.mjs";
import * as icf from "../src/icf.mjs";

const out = process.argv[2] ?? "graphify-out/.graphify_extract.json";

const RELATION = {
  oberklasse: "ist_teil_von",
  ausschluss: "schliesst_aus",
  verweis: "verweist_auf",
  kreuz_stern: "kreuz_stern",
  bereich: "umfasst",
};

const nodes = [];
const edges = [];
const ids = new Set();

const nodeId = (system, code) => `${system}_${code.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_")}`;

function addNode(system, code, label, sourceFile, extra = {}) {
  const id = nodeId(system, code);
  if (ids.has(id)) return id;
  ids.add(id);
  nodes.push({ id, label, file_type: "concept", source_file: sourceFile, source_location: code, ...extra });
  return id;
}

function addEdge(source, target, relation, sourceFile, text) {
  edges.push({
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    confidence_score: 1.0,
    source_file: sourceFile,
    source_location: text ?? null,
    weight: 1.0,
  });
}

function exportSystem(system, graph, entries, sourceFile, labelOf) {
  for (const code of entries) addNode(system, code, labelOf(code), sourceFile, { klassifikation: system.toUpperCase() });
  for (const code of entries) {
    const parent = graph.parentOf(code);
    if (parent) addEdge(nodeId(system, code), nodeId(system, parent), RELATION.oberklasse, sourceFile);
  }
  for (const edge of graph.edges) {
    let target = edge.to;
    if (!graph.has(target)) {
      // Bereich wie "J00-J22", der nicht als Gruppe existiert: eigener Knoten, der seine Kategorien umfasst
      target = addNode(system, edge.to, `Bereich ${edge.to}`, sourceFile, { klassifikation: system.toUpperCase() });
      if (!edges.some((e) => e.source === target)) {
        for (const code of entries) {
          const hit = graph.covers(edge.to, code);
          if (hit?.via === "bereich" && !graph.covers(edge.to, graph.parentOf(code) ?? "")) {
            addEdge(target, nodeId(system, code), RELATION.bereich, sourceFile);
          }
        }
      }
    } else {
      target = nodeId(system, target);
    }
    addEdge(nodeId(system, edge.from), target, RELATION[edge.type], sourceFile, edge.text);
  }
}

const icdCodes = Object.keys(icd.graph.roots.reduce((acc, root) => {
  const walk = (c) => { acc[c] = true; for (const child of icd.graph.childrenOf(c)) walk(child); };
  walk(root);
  return acc;
}, {}));
exportSystem("icd", icd.graph, icdCodes, "data/icd10gm.json", (code) => {
  const { code: display, title } = icd.getCode({ code });
  return `${display} ${title}`;
});

const icfCodes = Object.keys(icf.graph.roots.reduce((acc, root) => {
  const walk = (c) => { acc[c] = true; for (const child of icf.graph.childrenOf(c)) walk(child); };
  walk(root);
  return acc;
}, {}));
exportSystem("icf", icf.graph, icfCodes, "data/icf_flat.json", (code) => `${code} ${icf.getCode({ code }).title}`);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ nodes, edges, hyperedges: [], input_tokens: 0, output_tokens: 0 }));
const count = (rel) => edges.filter((e) => e.relation === rel).length;
console.log(
  `${nodes.length} Knoten, ${edges.length} Kanten ` +
    `(${Object.values(RELATION).map((r) => `${r}: ${count(r)}`).join(", ")}) nach ${out}`
);
