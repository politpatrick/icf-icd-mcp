// Gegenüberstellung von Pflegegutachten und eigener Einschätzung nach dem Begutachtungsinstrument (§ 15 SGB XI).
// Das Gutachten ist die Grundlage; eigene Werte werden eingesetzt. Je Unterschied: Definition, Bedeutung beider
// Stufen (wörtlich aus den BRi), Wirkung auf Punkte und Pflegegrad, Hinweise und Abgrenzungen.
// Keine Bewertung des Gutachtens und keine Rechtsberatung.

import * as bi from "./bi.mjs";
import { parseProfil } from "./fall.mjs";
import { LookupError } from "./text.mjs";

const PFLEGEGRADE = bi.getScoringRules().pflegegrade;

const HINWEIS =
  "Gegenüberstellung nach den Begutachtungs-Richtlinien. Sie zeigt, was die Stufen bedeuten und wie sich Unterschiede auswirken; sie bewertet das Gutachten nicht und ist keine Rechtsberatung.";

const rund = (x) => Math.round(x * 100) / 100;

/** Liest eine Kodierung und liefert Kennung → Ergebnis; ungültige Angaben werden als Fehler gemeldet. */
function lesen(text, wer) {
  if (!text || !String(text).trim()) throw new LookupError(`Keine Kodierung für ${wer} angegeben.`);
  const ergebnisse = bi.interpretCoding({ coding: String(text) }).ergebnisse;
  const falsch = ergebnisse.filter((e) => !e.gueltig);
  if (falsch.length) throw new LookupError(`${wer}: ${falsch.map((e) => e.fehler).join(" ")}`);
  return new Map(ergebnisse.map((e) => [e.code, e]));
}

/** Eingaben aus einem Fallprofil (Einträge der Art bi, nach Herkunft). */
function ausProfil(input, herkunftGutachten, herkunftEigene) {
  const { profil, fehler } = parseProfil(input);
  if (!profil || fehler.length) throw new LookupError(`Das Fallprofil ist nicht gültig: ${fehler.slice(0, 5).map((f) => `${f.pfad}: ${f.meldung}`).join("; ")}`);
  const eintraege = (profil.eintraege ?? []).filter((e) => e.art === "bi");
  const von = (h) => eintraege.filter((e) => e.herkunft === h).map((e) => e.kode);
  const eigeneHerkunft = herkunftEigene ?? (von("interview").length ? "interview" : "selbstauskunft");
  const gutachten = von(herkunftGutachten);
  const eigene = von(eigeneHerkunft);
  if (!gutachten.length) throw new LookupError(`Im Fallprofil gibt es keine BI-Einträge mit der Herkunft "${herkunftGutachten}".`);
  if (!eigene.length) throw new LookupError(`Im Fallprofil gibt es keine BI-Einträge mit der Herkunft "${eigeneHerkunft}".`);
  const alter = profil.meta?.alter;
  const alter_monate = alter?.monate ?? (alter?.jahre !== undefined ? alter.jahre * 12 : undefined);
  return { gutachten: gutachten.join("; "), eigene: eigene.join("; "), alter_monate };
}

const kodierung = (map) => [...map.values()].map((e) => e.kodierung).join("; ");

function rechnen(map, alter_monate) {
  return bi.calculate({ kodierung: kodierung(map), ...(alter_monate !== undefined ? { alter_monate } : {}) });
}

function einzelpunkte(calc, code) {
  for (const m of calc.module) for (const d of m.detail ?? []) if (d.code === code) return d.einzelpunkte;
  return 0;
}

/** Modul 5 wird je Gruppe (A, B, C, D) bewertet, nicht je Kriterium. */
function gruppe(calc, code) {
  const nummer = code.replace(/^BI:/, "");
  const g = calc.module.find((m) => m.modul === 5)?.gruppen?.find((x) => x.kriterien?.includes(nummer));
  if (!g) return undefined;
  return { gruppe: g.gruppe, einzelpunkte: g.einzelpunkte, ...(g.massnahmen_pro_tag !== undefined ? { massnahmen_pro_tag: g.massnahmen_pro_tag } : {}) };
}

function stufe(e, calc) {
  const g = e.modul === 5 ? gruppe(calc, e.code) : undefined;
  return {
    kodierung: e.kodierung,
    label: e.label ?? (e.anzahl !== undefined ? `${e.anzahl}× je ${e.je}` : e.wert !== undefined ? String(e.wert) : e.art),
    ...(e.erlaeuterung ? { erlaeuterung: e.erlaeuterung } : {}),
    ...(g ? { gruppe: g } : { einzelpunkte: einzelpunkte(calc, e.code) }),
  };
}

/** Definition, Hinweise und Abgrenzungen eines Kriteriums in der passenden Fassung. */
function texte(code, variante) {
  const item = bi.getItem({ code, variante });
  const t = item.texte?.[variante] ?? item.texte?.erwachsene ?? {};
  const kanten = bi.related({ code });
  const abgrenzungen = [...(kanten.ausgehend ?? []), ...(kanten.eingehend ?? [])]
    .filter((k) => k.typ === "abgrenzung" && (!k.variante || k.variante === variante))
    .map((k) => ({ code: k.code, titel: k.titel, text: k.text }));
  return { titel: item.titel, definition: t.definition ?? "", hinweise: t.hinweise ?? [], abgrenzungen };
}

/** Nächste Schwelle über dem erreichten Grad; Tabelle für Säuglinge bis 18 Monate gesondert. */
function naechsteSchwelle(calc, alter_monate) {
  if (calc.besondere_bedarfskonstellation) return undefined;
  const saeugling = alter_monate !== undefined && alter_monate < bi.INFANT_BELOW_MONTHS;
  const tabelle = saeugling ? PFLEGEGRADE.kinder_bis_18_monate.stufen : PFLEGEGRADE.stufen;
  const s = tabelle.find((x) => x.ab > calc.gesamtpunkte && x.grad > calc.pflegegrad);
  return s ? { punkte: s.ab, pflegegrad: s.grad, abstand: rund(s.ab - calc.gesamtpunkte) } : undefined;
}

/**
 * Stellt ein Pflegegutachten und die eigene Einschätzung gegenüber.
 * Eingabe: gutachten + eigene (Kodierungen) oder profil (Fallprofil mit Herkünften); optional alter_monate.
 */
export function gegenueberstellen({ gutachten, eigene, profil, herkunft_gutachten = "gutachten", herkunft_eigene, alter_monate } = {}) {
  if (profil !== undefined) {
    const p = ausProfil(profil, herkunft_gutachten, herkunft_eigene);
    gutachten = p.gutachten;
    eigene = p.eigene;
    if (alter_monate === undefined) alter_monate = p.alter_monate;
  }
  if (alter_monate !== undefined && !(Number.isFinite(alter_monate) && alter_monate >= 0)) throw new LookupError("alter_monate muss eine Zahl ab 0 sein.");
  const basis = lesen(gutachten, "Gutachten");
  const eigeneWerte = lesen(eigene, "eigene Einschätzung");
  const variante = alter_monate !== undefined && alter_monate < 18 * 12 ? "kinder" : "erwachsene";

  const calcBasis = rechnen(basis, alter_monate);
  const vollstaendig = (calcBasis.nicht_angegeben ?? []).length === 0;
  const alle = new Map([...basis, ...eigeneWerte]);
  const calcAlle = rechnen(alle, alter_monate);

  let bestaetigt = 0;
  const unterschiede = [];
  for (const [code, e] of eigeneWerte) {
    const g = basis.get(code);
    if (g && g.kodierung === e.kodierung) {
      bestaetigt++;
      continue;
    }
    const einzeln = new Map(basis).set(code, e);
    const calcEinzeln = rechnen(einzeln, alter_monate);
    const m = e.modul;
    const vorher = calcBasis.module.find((x) => x.modul === m);
    const nachher = calcEinzeln.module.find((x) => x.modul === m);
    const t = texte(code, variante);
    unterschiede.push({
      code,
      titel: t.titel,
      modul: m,
      definition: t.definition,
      gutachten: g ? stufe(g, calcBasis) : { kodierung: null, label: "im Gutachten nicht angegeben" },
      eigene: stufe(e, calcEinzeln),
      wirkung: {
        modul_vorher: vorher?.summe_einzelpunkte ?? 0,
        modul_nachher: nachher?.summe_einzelpunkte ?? 0,
        gewichtet_vorher: vorher?.gewichtete_punkte ?? 0,
        gewichtet_nachher: nachher?.gewichtete_punkte ?? 0,
        modul_zaehlt: m === 2 || m === 3 ? nachher?.geht_ein !== false : true,
        gesamtpunkte_differenz: rund(calcEinzeln.gesamtpunkte - calcBasis.gesamtpunkte),
        ...(vollstaendig ? { pflegegrad_allein: calcEinzeln.pflegegrad, aendert_grad_allein: calcEinzeln.pflegegrad !== calcBasis.pflegegrad } : {}),
      },
      hinweise: t.hinweise,
      abgrenzungen: t.abgrenzungen,
    });
  }
  // Zuerst Unterschiede, die allein den Grad ändern, dann nach Wirkung auf die Gesamtpunkte.
  unterschiede.sort((a, b) => Number(Boolean(b.wirkung.aendert_grad_allein)) - Number(Boolean(a.wirkung.aendert_grad_allein)) || b.wirkung.gesamtpunkte_differenz - a.wirkung.gesamtpunkte_differenz);

  return {
    richtlinie: calcBasis.richtlinie,
    systematik: calcBasis.systematik,
    gutachten: vollstaendig
      ? { vollstaendig: true, gesamtpunkte: calcBasis.gesamtpunkte, pflegegrad: calcBasis.pflegegrad }
      : { vollstaendig: false, fehlende_kriterien: calcBasis.nicht_angegeben },
    mit_eigenen_werten: vollstaendig
      ? { gesamtpunkte: calcAlle.gesamtpunkte, pflegegrad: calcAlle.pflegegrad, ...(naechsteSchwelle(calcAlle, alter_monate) ? { naechste_schwelle: naechsteSchwelle(calcAlle, alter_monate) } : {}) }
      : {},
    bestaetigt,
    unterschiede,
    hinweis: HINWEIS,
  };
}
