#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build_graphify.sh
# Baut aus dem amtlichen Wissensnetz (ICD-10-GM + ICF) einen graphify-Graphen in graphify-out/:
#   graph.json                 – für graphify query/path/explain und den graphify-MCP-Server
#   .graphify_analysis.json    – Themengruppen (Communities) und zentrale Knoten
# Voraussetzung: graphify ist installiert (uv tool install graphifyy).
# Ein Sprachmodell wird nicht verwendet; alle Kanten stammen aus den BfArM-Daten.
# ---------------------------------------------------------------------------

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GRAPHIFY_BIN="$(command -v graphify || true)"
if [[ -z "$GRAPHIFY_BIN" ]]; then
  echo "❌ graphify nicht gefunden – installieren mit: uv tool install graphifyy" >&2
  exit 1
fi
PYTHON="$(head -1 "$GRAPHIFY_BIN" | tr -d '#!')"

node scripts/export_graphify.mjs graphify-out/.graphify_extract.json

"$PYTHON" - <<'PY'
import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes
from graphify.export import to_json

extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
G = build_from_json(extraction, root=str(Path.cwd()), directed=True)
communities = cluster(G)
cohesion = score_all(G, communities)
to_json(G, communities, "graphify-out/graph.json", force=True)
analysis = {
    "communities": {str(k): v for k, v in communities.items()},
    "cohesion": {str(k): v for k, v in cohesion.items()},
    "gods": god_nodes(G),
}
Path("graphify-out/.graphify_analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"graphify: {G.number_of_nodes()} Knoten, {G.number_of_edges()} Kanten, {len(communities)} Themengruppen → graphify-out/graph.json")
PY
