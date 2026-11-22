// Orientierung Eingliederungshilfe/Pflege je ICF-d-Kategorie, abgeleitet aus der kuratierten Zuordnung BI ↔ ICF.
// Keine Zuständigkeitsentscheidung: Eingliederungshilfe ist gegenüber der Pflegeversicherung nicht nachrangig
// (§ 13 Abs. 3 Satz 3 SGB XI), daher gibt es keine Kennzeichnung „nur Pflege“.

import * as icf from "./icf.mjs";
import { biForIcf } from "./bi.mjs";
import { LEBENSBEREICHE } from "./fall.mjs";
import { LookupError } from "./text.mjs";

const MAX_CODES = 100;

const HINWEIS =
  "Orientierung, keine Zuständigkeitsentscheidung. Leistungen der Eingliederungshilfe und der Pflegeversicherung stehen nebeneinander; die Eingliederungshilfe ist im Verhältnis zur Pflegeversicherung nicht nachrangig (§ 13 Abs. 3 SGB XI, § 91 Abs. 3 SGB IX). Ob eine Unterstützung Pflege oder Teilhabe ist, hängt von ihrem Zweck im Einzelfall ab. In besonderen Wohnformen umfasst die Eingliederungshilfe auch die Pflegeleistungen (§ 13 Abs. 3 SGB XI, § 103 SGB IX, § 43a SGB XI); auch außerhalb kann sie häusliche Pflege umfassen (§ 103 Abs. 2 SGB IX). Bei Leistungen zur Teilhabe klärt der Träger, bei dem der Antrag eingeht, die Zuständigkeit (§ 14 SGB IX); Beratung bietet die EUTB (§ 32 SGB IX).";

const HERKUNFT =
  "Lebensbereiche: amtlich (§ 118 Abs. 1 Satz 3 SGB IX); Zuordnung zu BI-Kriterien und Erläuterungen: kuratiert, nicht amtlich (Arbeitshilfe dieses Projekts, siehe bi_icf_mapping).";

const UEBERSCHNEIDUNG =
  "Nach der kuratierten Zuordnung ist diesem Bereich (ganz oder teilweise) ein Kriterium des Begutachtungsinstruments zugeordnet. Pflegerische Maßnahmen, Betreuung und Hilfen bei der Haushaltsführung können Leistungen der Pflege sein (§ 36 SGB XI). Unterstützung, die zu einer selbstbestimmten Lebensführung und Teilhabe befähigt oder begleitet, kann zugleich Eingliederungshilfe sein, etwa als Assistenz (§ 78 SGB IX).";
const OHNE_PFLEGEGRAD = " Die zugeordneten Kriterien werden im Gutachten erfasst, gehen aber nicht in den Pflegegrad ein.";
const TEILHABE =
  "Nach der kuratierten Zuordnung ist diesem Bereich kein Kriterium des Begutachtungsinstruments zugeordnet. In Betracht kommen Leistungen zur Teilhabe.";

/** Zusatz zur Leistungsgruppe der Eingliederungshilfe nach Block der ICF (kuratiert). */
function leistungsgruppe(code) {
  const block = Number(code.slice(1, 3));
  if (code.charAt(1) === "8" && block >= 81 && block <= 83) return " Für Bildung kommen Leistungen zur Teilhabe an Bildung in Betracht (§ 112 SGB IX); Schulen und andere Träger bleiben verpflichtet (§ 91 Abs. 2 SGB IX).";
  if (code.charAt(1) === "8" && block >= 84 && block <= 85) return " Für Arbeit und Beschäftigung kommen Leistungen zur Beschäftigung (§ 111 SGB IX) in Betracht; vorrangig können andere Rehabilitationsträger zuständig sein (§ 6 SGB IX, § 91 Abs. 1 SGB IX), etwa die Bundesagentur für Arbeit oder die Rentenversicherung.";
  return " Bei der Eingliederungshilfe sind das vor allem Leistungen zur Sozialen Teilhabe (§ 113 SGB IX), etwa Assistenz (§ 78 SGB IX).";
}

/** "D510.3" → "d510"; wirft LookupError mit Bezug auf die Eingabe. */
function dKode(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new LookupError(`Ungültiger Kode ${JSON.stringify(raw)}: erwartet wird eine ICF-Kategorie aus Aktivitäten und Teilhabe, z. B. "d510" oder "d510.3".`);
  const code = raw.trim().toLowerCase().split(/[.+]/)[0];
  if (!/^d\d+$/.test(code)) throw new LookupError(`"${raw.trim()}" ist keine d-Kategorie: Die Abgrenzung gilt für Aktivitäten und Teilhabe (d1–d9). Körperfunktionen, -strukturen und Umweltfaktoren gehören zur Beschreibung, nicht zur Zuordnung eines Bedarfs.`);
  try {
    icf.getCode({ code });
  } catch {
    throw new LookupError(`ICF-Kategorie "${raw.trim()}" nicht gefunden.`);
  }
  if (/[.+]/.test(raw)) icf.interpretCoding({ coding: raw.trim() }); // prüft das Beurteilungsmerkmal, wirft LookupError
  return code;
}

/** BI-Treffer einer d-Kategorie, nach Kriterium gruppiert. Über die Oberkategorie nur bei „entspricht“. */
function biKriterien(code) {
  const gruppen = new Map();
  for (const h of biForIcf(code)) {
    if (h.beziehung !== "entspricht" && h.beziehung !== "teilweise") continue;
    if (h.ueber === "oberkategorie" && h.beziehung !== "entspricht") continue;
    if (!gruppen.has(h.bi)) {
      gruppen.set(h.bi, {
        bi: h.bi,
        titel: h.titel,
        ueber: h.ueber,
        pflegegrad_relevant: h.modul !== undefined && h.punktrelevant !== false,
        ...(h.nur ? { nur: h.nur } : {}),
        ...(h.sonderregel ? { sonderregel: h.sonderregel } : {}),
        icf: [],
      });
    }
    gruppen.get(h.bi).icf.push({ code: h.icf, beziehung: h.beziehung, begruendung: h.begruendung });
  }
  return [...gruppen.values()];
}

function kategorie(eingaben, code) {
  const { title } = icf.getCode({ code });
  const kapitel = Number(code.charAt(1));
  const bi = biKriterien(code);
  const orientierung = bi.length ? "ueberschneidung" : "teilhabe";
  const basis = bi.length ? UEBERSCHNEIDUNG + (bi.every((b) => !b.pflegegrad_relevant) ? OHNE_PFLEGEGRAD : "") : TEILHABE;
  return {
    eingaben,
    code,
    titel: title,
    ...(kapitel >= 1 && kapitel <= 9 ? { lebensbereich: LEBENSBEREICHE[kapitel - 1] } : {}),
    orientierung,
    bi_kriterien: bi,
    erlaeuterung: basis + leistungsgruppe(code),
  };
}

/** abgrenzung_egh_pflege */
export function abgrenzung({ codes } = {}) {
  if (!Array.isArray(codes) || codes.length === 0) throw new LookupError('codes muss eine nichtleere Liste von ICF-d-Kodes sein, z. B. ["d510", "d920.2"].');
  if (codes.length > MAX_CODES) throw new LookupError(`Höchstens ${MAX_CODES} Kodes je Aufruf.`);
  const eingabenJe = new Map();
  for (const raw of codes) {
    const code = dKode(raw);
    if (!eingabenJe.has(code)) eingabenJe.set(code, []);
    eingabenJe.get(code).push(raw.trim());
  }
  const kategorien = [...eingabenJe].map(([code, eingaben]) => kategorie(eingaben, code));
  return { kategorien, hinweis: HINWEIS, herkunft: HERKUNFT };
}
