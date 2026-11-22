// Orientierung Eingliederungshilfe/Pflege je ICF-d-Kategorie, abgeleitet aus der kuratierten Zuordnung BI ↔ ICF.
// Keine Zuständigkeitsentscheidung: Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig
// (§ 13 Abs. 3 Satz 3 SGB XI), daher gibt es keine Kennzeichnung „nur Pflege“.

import * as icf from "./icf.mjs";
import { biForIcf } from "./bi.mjs";
import { LEBENSBEREICHE } from "./fall.mjs";
import { LookupError } from "./text.mjs";

const MAX_CODES = 100;

const HINWEIS =
  "Orientierung, keine Zuständigkeitsentscheidung. Leistungen der Eingliederungshilfe und der Pflegeversicherung stehen nebeneinander; die Eingliederungshilfe ist im Verhältnis zur Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI, § 91 Abs. 3 SGB IX). Ob eine Unterstützung Pflege oder Teilhabe ist, hängt von ihrem Zweck im Einzelfall ab. Bei Leistungen zur Teilhabe klärt der Träger, bei dem der Antrag eingeht, die Zuständigkeit (§ 14 SGB IX); Beratung bietet die EUTB (§ 32 SGB IX).";

const HERKUNFT =
  "Lebensbereiche: amtlich (§ 118 Abs. 1 Satz 3 SGB IX); Zuordnung zu BI-Kriterien und Erläuterungen: kuratiert, nicht amtlich (Arbeitshilfe dieses Projekts, siehe bi_icf_mapping).";

const UEBERSCHNEIDUNG =
  "Die Pflegeversicherung erfasst diesen Bereich im Begutachtungsinstrument; pflegerische Maßnahmen und Hilfen bei der Haushaltsführung können Leistungen der Pflege sein (§ 36 SGB XI). Unterstützung, die zu einer selbstbestimmten Lebensführung und Teilhabe befähigt oder begleitet, kann zugleich Eingliederungshilfe sein, etwa als Assistenz (§ 78 SGB IX).";
const OHNE_PFLEGEGRAD =
  " Die zugeordneten Kriterien (außerhäusliche Aktivitäten, Haushaltsführung) werden im Gutachten erfasst, gehen aber nicht in den Pflegegrad ein.";

const TEILHABE_D8 =
  "Das Begutachtungsinstrument erfasst diesen Bereich nicht. In Betracht kommen Leistungen zur Teilhabe an Bildung (§ 112 SGB IX) bzw. zur Beschäftigung (§ 111 SGB IX); vorrangig können andere Rehabilitationsträger zuständig sein (§ 6 SGB IX, § 91 Abs. 1 SGB IX), etwa die Bundesagentur für Arbeit oder die Rentenversicherung.";
const TEILHABE_SONST =
  "Das Begutachtungsinstrument erfasst diesen Bereich nicht. In Betracht kommen Leistungen zur Sozialen Teilhabe (§ 113 SGB IX), etwa Assistenz (§ 78 SGB IX).";

/** "D510.3" → "d510"; wirft LookupError mit Bezug auf die Eingabe. */
function dKode(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new LookupError(`Ungültiger Kode ${JSON.stringify(raw)}: erwartet wird eine ICF-Kategorie aus Aktivitäten und Teilhabe, z. B. "d510" oder "d510.3".`);
  const code = raw.trim().toLowerCase().split(/[.+]/)[0];
  if (!/^d\d*$/.test(code)) throw new LookupError(`"${raw.trim()}" ist keine d-Kategorie: Die Abgrenzung gilt für Aktivitäten und Teilhabe (d1–d9). Körperfunktionen, -strukturen und Umweltfaktoren gehören zur Beschreibung, nicht zur Zuordnung eines Bedarfs.`);
  try {
    icf.getCode({ code });
  } catch {
    throw new LookupError(`ICF-Kategorie "${raw.trim()}" nicht gefunden.`);
  }
  return code;
}

function kategorie(eingabe, code) {
  const { title } = icf.getCode({ code });
  const kapitel = Number(code.charAt(1));
  const bi = biForIcf(code)
    .filter((h) => h.beziehung === "entspricht" || h.beziehung === "teilweise")
    .map((h) => ({ bi: h.bi, titel: h.titel, icf: h.icf, beziehung: h.beziehung, ueber: h.ueber, pflegegrad_relevant: h.modul !== undefined, begruendung: h.begruendung }));
  const orientierung = bi.length ? "ueberschneidung" : "teilhabe";
  let erlaeuterung;
  if (bi.length) erlaeuterung = UEBERSCHNEIDUNG + (bi.every((b) => !b.pflegegrad_relevant) ? OHNE_PFLEGEGRAD : "");
  else erlaeuterung = kapitel === 8 ? TEILHABE_D8 : TEILHABE_SONST;
  return {
    eingabe,
    code,
    titel: title,
    ...(kapitel >= 1 && kapitel <= 9 ? { lebensbereich: LEBENSBEREICHE[kapitel - 1] } : {}),
    orientierung,
    bi_kriterien: bi,
    erlaeuterung,
  };
}

/** abgrenzung_egh_pflege */
export function abgrenzung({ codes } = {}) {
  if (!Array.isArray(codes) || codes.length === 0) throw new LookupError('codes muss eine nichtleere Liste von ICF-d-Kodes sein, z. B. ["d510", "d920.2"].');
  if (codes.length > MAX_CODES) throw new LookupError(`Höchstens ${MAX_CODES} Kodes je Aufruf.`);
  const gesehen = new Set();
  const kategorien = [];
  for (const raw of codes) {
    const code = dKode(raw);
    if (gesehen.has(code)) continue;
    gesehen.add(code);
    kategorien.push(kategorie(raw.trim(), code));
  }
  return { kategorien, hinweis: HINWEIS, herkunft: HERKUNFT };
}
