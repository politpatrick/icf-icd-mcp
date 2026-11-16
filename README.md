# ICF-ICD-MCP

MCP-Server für zwei amtliche Klassifikationen in deutscher Fassung des BfArM:

- **ICF**: Internationale Klassifikation der Funktionsfähigkeit, Behinderung und Gesundheit (WHO, Stand 2005)
- **ICD-10-GM 2026**: Internationale statistische Klassifikation der Krankheiten, German Modification

Damit können Claude und andere MCP-Clients Diagnosen und ICF-Kategorien suchen, nachschlagen und Kodierungen prüfen, etwa für Teilhabeplanung, Gesamtplanverfahren oder Berichte.

- Keine Abhängigkeiten, nur Node.js ≥ 18
- Läuft lokal, sendet keine Daten nach außen
- ICF: 1.495 Kategorien (b, s, d, e) mit Beschreibungen, Ein-/Ausschlüssen und Beurteilungsmerkmalen
- ICD-10-GM: 17.177 Klassen, darunter alle über Subklassifikationen gebildeten Kodes (z. B. E11.90, G82.30), mit Kodierregeln nach §295/§301

## Tools

### ICF

| Tool | Zweck |
| --- | --- |
| `icf_search` | Volltextsuche in Titeln, Beschreibungen und Einschlüssen; Umlaute egal, Code-Präfixe möglich, optional auf b/s/d/e eingeschränkt |
| `icf_get_code` | Titel, Beschreibung, Ein-/Ausschlüsse (mit aufgelösten Codes), Hierarchiepfad, Unterkategorien |
| `icf_list_chapters` | Komponenten b/s/d/e mit ihren Kapiteln |
| `icf_get_related` | Ober-/Unterkategorien, Geschwister, eigene und geerbte Ausschlüsse, Rückverweise (wer schließt diesen Code aus) |
| `icf_compare` | Grenzt zwei Kategorien ab: Hierarchie, Ausschlüsse in beiden Richtungen, Verbindungsweg, Beschreibungen |
| `icf_get_qualifiers` | Notation und Werteskala der Beurteilungsmerkmale für einen Code |
| `icf_interpret_coding` | Prüft und übersetzt Kodierungen wie `d450.23`, `b1440.2`, `s7500.213`, `e310+3` |

### ICD-10-GM

| Tool | Zweck |
| --- | --- |
| `icd_search` | Suche in Titeln und Einschlussbegriffen; Umlaute egal, Kode-Präfixe möglich, optional nach Kapitel oder nur endständige Kodes |
| `icd_get_code` | Titel, Hierarchiepfad, Ein-/Ausschlüsse mit Verweisen, Hinweise, Unterkodes, §295/§301, Kreuz/Stern/Ausrufezeichen, Alters- und Geschlechtsbezug |
| `icd_list_chapters` | Die 22 Kapitel mit Kodebereichen oder die Gruppen eines Kapitels |
| `icd_check_code` | Prüft Kodierbarkeit inkl. Zusatzkennzeichen für Diagnosesicherheit (G/V/Z/A) und Seite (R/L/B), z. B. `F32.1 G` |
| `icd_relations` | Alle amtlichen Beziehungen eines Kodes: geerbte Ausschlüsse, Rückverweise (auch über Bereiche wie J00-J22), Verweise, Kreuz-Stern-Partner |
| `icd_compare` | Grenzt zwei Kodes ab, z. B. F32.1 und F33.1: Hierarchie, Ausschlüsse und Verweise in beiden Richtungen, Verbindungsweg, Einschlüsse |

### Wissensnetz

Aus den amtlichen Daten wird beim Start ein Wissensnetz aufgebaut, ohne Sprachmodell und ohne erschlossene Beziehungen:

| Beziehung | ICD-10-GM | ICF |
| --- | --- | --- |
| Ober-/Unterklasse | 17.177 Klassen | 1.495 Kategorien |
| Ausschluss (Exklusivum) | 5.005 | 146 |
| Verweis in Einschlüssen und Titeln | 688 | – |
| Kreuz-Stern-Kombination (†/*) | 312 | – |

Ausschlüsse einer Oberklasse gelten für alle untergeordneten Kodes. Deshalb zeigen `icd_relations` und `icd_compare` auch geerbte Ausschlüsse; F32.1 grenzt sich etwa über F32 von F33 ab. Verweisziele wie `J00-J22` werden als Bereich ausgewertet, und eine Kategorie zählt nur dann dazu, wenn alle ihre Unterkodes darin liegen.

Eine amtliche Zuordnung zwischen ICD und ICF gibt es nicht. Das Netz verbindet daher nur Kodes innerhalb einer Klassifikation.

## Online-Konnektor (ohne Installation)

Der Server läuft öffentlich auf Netlify:

```
https://icf-icd-mcp.netlify.app/mcp
```

- **claude.ai und Claude Desktop:** *Einstellungen → Konnektoren → Benutzerdefinierten Konnektor hinzufügen*, Name z. B. „ICF & ICD-10-GM“, die URL oben eintragen, ohne OAuth. Der Konnektor steht dann auch in der Claude-App auf dem Handy zur Verfügung.
- **Claude Code:** `claude mcp add --transport http icf-icd https://icf-icd-mcp.netlify.app/mcp`

Der Endpunkt ist ohne Anmeldung erreichbar, nur lesend und auf 120 Anfragen pro Minute begrenzt. Abfragen werden nicht gespeichert; protokolliert wird nur, welches Tool aufgerufen wurde.

## Lokale Installation

Repository klonen:

```bash
git clone https://github.com/politpatrick/icf-icd-mcp.git ~/GitHub/icf-icd-mcp
```

### Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json` (oder über *Einstellungen → Entwickler → Konfiguration bearbeiten*):

```json
{
  "mcpServers": {
    "icf": {
      "command": "node",
      "args": ["/Users/<name>/GitHub/icf-icd-mcp/src/server.mjs"]
    }
  }
}
```

Danach Claude Desktop komplett beenden und neu starten. Falls `node` nicht gefunden wird, den vollen Pfad angeben (`which node`, z. B. `/opt/homebrew/bin/node`).

### Claude Code

```bash
claude mcp add --scope user icf -- node ~/GitHub/icf-icd-mcp/src/server.mjs
```

### Ohne Klon (direkt von GitHub)

```bash
claude mcp add --scope user icf -- npx -y github:politpatrick/icf-icd-mcp
```

## Projektstruktur

```
src/                 MCP-Server
  server.mjs         Einstieg (stdio)
  http.mjs           Einstieg über HTTP (Streamable HTTP, zustandslos)
  protocol.mjs       JSON-RPC/MCP-Protokoll und Tool-Definitionen
  icf.mjs            ICF: Datenzugriff und Abfragelogik
  icd.mjs            ICD-10-GM: Datenzugriff und Abfragelogik
  data.mjs           Lädt die JSON-Daten (lokal und in Netlify Functions)
  graph.mjs          Wissensnetz: Kanten, Rückverweise, Bereiche, kürzeste Wege
  text.mjs           Gemeinsame Hilfen (Suche, Fehler)
netlify/functions/   Netlify Function für den Online-Endpunkt /mcp
public/              Startseite des Online-Endpunkts
data/                Generierte Daten (icf_flat.json, qualifiers.json, icd10gm.json)
source/              ClaML-Quelldateien von ICF und ICD-10-GM
scripts/             Konvertierung ClaML → JSON (icf_to_json.py, icd_to_json.py, build_data.sh)
                     und graphify-Export (export_graphify.mjs, build_graphify.sh)
test/                Tests
```

## Entwicklung

```bash
npm test             # Tests (node:test)
npm start            # Server auf stdio starten
npm run build:data   # data/ aus source/ neu erzeugen (Python 3.9+)
```

### Neue ICD-10-GM-Jahresversion

1. Beim BfArM das Paket *ICD-10-GM … Systematik ClaML* herunterladen.
2. Die XML aus `Klassifikationsdateien/` nach `source/` kopieren und die alte Version löschen.
3. `npm run build:data` und `npm test` ausführen. `build_data.sh` nimmt automatisch die neueste `icd10gm*syst_claml_*.xml`.
4. Die Versionsangaben in `QUELLEN.md` anpassen.

### Wissensnetz in graphify

```bash
scripts/build_graphify.sh
```

Das Skript exportiert das Wissensnetz im Extraktionsformat von [graphify](https://github.com/Graphify-Labs/graphify) und baut damit `graphify-out/graph.json`, inklusive Themengruppen. Dafür wird kein Sprachmodell aufgerufen. Alle Kanten sind `EXTRACTED` mit Konfidenz 1,0 und tragen den Ausschlusstext als Quelle. Danach funktionieren die graphify-Befehle und der graphify-MCP-Server:

```bash
graphify path "F32.1 Mittelgradige depressive Episode" "F33.1 Rezidivierende depressive Störung, gegenwärtig mittelgradige Episode" --undirected
graphify explain "F33 Rezidivierende depressive Störung"
```

Beziehungen: `ist_teil_von`, `schliesst_aus`, `verweist_auf`, `kreuz_stern` und `umfasst` (Bereichsknoten wie „Bereich J00-J22“ → enthaltene Gruppen und Kategorien). `graphify-out/` wird nicht versioniert.

### Online-Endpunkt aktualisieren

Das Netlify-Projekt `icf-icd-mcp` hat keinen Build-Schritt. `netlify.toml` liefert `public/` aus, die Function unter `netlify/functions/` und die Daten aus `data/` (per `included_files`). Ist das Projekt in Netlify mit diesem GitHub-Repo verknüpft, wird jeder Push auf `main` automatisch veröffentlicht; sonst mit `netlify deploy --prod`.

Manuell testen lässt sich der Server, indem man JSON-RPC-Zeilen auf stdin schickt:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"icf_interpret_coding","arguments":{"coding":"d450.23"}}}' | node src/server.mjs
```

## Hinweis zu den Daten

ICF und ICD-10-GM sind Klassifikationen der Weltgesundheitsorganisation (WHO) in der deutschen Fassung des Bundesinstituts für Arzneimittel und Medizinprodukte (BfArM). Sie werden unverändert und mit den vorgeschriebenen Quellenangaben weitergegeben, siehe [QUELLEN.md](QUELLEN.md). Verbindlich ist jeweils das PDF des Systematischen Verzeichnisses beim BfArM.

Die Tools liefern Klassifikationsinhalte, keine fachliche Bewertung im Einzelfall.
