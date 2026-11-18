// Gemeinsame Text-Hilfen für ICF und ICD.

/** Für die Suche normalisieren: Kleinschreibung, ß/Umlaute/Akzente vereinheitlicht ("Gedächtnis" = "gedaechtnis"). */
export function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
}

/** Wie fold(), aber ohne Bindestriche ("Burnout" = "Burn-out"). */
export function compact(text) {
  return fold(text).replace(/-/g, "");
}

/** Fehler, die als Tool-Ergebnis mit isError an den Client gehen (statt als Protokollfehler). */
export class LookupError extends Error {}
