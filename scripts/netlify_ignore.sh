#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# netlify_ignore.sh – ignore-Kommando für Netlify (siehe netlify.toml)
# Exit 0 = Build abbrechen, Exit 1 = bauen.
#
# Produktions-Deploys kosten im Free-Plan Credits (300 je Monat). Deshalb wird
# ein Merge auf main nicht automatisch veröffentlicht. Veröffentlicht wird
# einmal im Monat über den Build-Hook (.github/workflows/veroeffentlichen.yml);
# Builds über einen Build-Hook ignoriert Netlify dieses Kommando nicht.
# Deploy-Vorschauen für Pull Requests laufen weiter.
# ---------------------------------------------------------------------------

if [[ "${CONTEXT:-}" == "production" ]]; then
  echo "Produktions-Build aus Git übersprungen: Veröffentlichung einmal im Monat über den Build-Hook."
  exit 0
fi
exit 1
