// Allgemeine Informationen zu Verfahrenswegen im Sozialrecht für antragsberechtigte Personen.
// Erklärungen sind kuratiert (nicht amtlich); Normauszüge wörtlich von gesetze-im-internet.de (geprüft 22.11.2026).
// Keine Rechtsberatung: keine Fristberechnung, keine Empfehlung eines Wegs im Einzelfall, keine Erfolgsaussichten.

import { fold, LookupError } from "./text.mjs";

const GII = "https://www.gesetze-im-internet.de";
const norm = (zitat, pfad, auszug) => ({ zitat, url: `${GII}/${pfad}.html`, auszug });

const N = {
  sgg84: norm("§ 84 SGG", "sgg/__84", "Der Widerspruch ist binnen eines Monats, nachdem der Verwaltungsakt dem Beschwerten bekanntgegeben worden ist, schriftlich, in elektronischer Form nach § 36a Absatz 2 des Ersten Buches Sozialgesetzbuch, schriftformersetzend nach § 36a Absatz 2a des Ersten Buches Sozialgesetzbuch und § 9a Absatz 5 des Onlinezugangsgesetzes oder zur Niederschrift bei der Stelle einzureichen, die den Verwaltungsakt erlassen hat."),
  sgg66: norm("§ 66 SGG", "sgg/__66", "Ist die Belehrung unterblieben oder unrichtig erteilt, so ist die Einlegung des Rechtsbehelfs nur innerhalb eines Jahres seit Zustellung, Eröffnung oder Verkündung zulässig, außer wenn die Einlegung vor Ablauf der Jahresfrist infolge höherer Gewalt unmöglich war oder eine schriftliche oder elektronische Belehrung dahin erfolgt ist, daß ein Rechtsbehelf nicht gegeben sei."),
  sgg78: norm("§ 78 SGG", "sgg/__78", "Vor Erhebung der Anfechtungsklage sind Rechtmäßigkeit und Zweckmäßigkeit des Verwaltungsakts in einem Vorverfahren nachzuprüfen."),
  vwgo70: norm("§ 70 VwGO", "vwgo/__70", "Der Widerspruch ist innerhalb eines Monats, nachdem der Verwaltungsakt dem Beschwerten bekanntgegeben worden ist, schriftlich, in elektronischer Form nach § 3a Absatz 2 des Verwaltungsverfahrensgesetzes, schriftformersetzend nach § 3a Absatz 3 des Verwaltungsverfahrensgesetzes und § 9a Absatz 5 des Onlinezugangsgesetzes oder zur Niederschrift bei der Behörde zu erheben, die den Verwaltungsakt erlassen hat."),
  sgb10_27: norm("§ 27 SGB X", "sgb_10/__27", "War jemand ohne Verschulden verhindert, eine gesetzliche Frist einzuhalten, ist ihm auf Antrag Wiedereinsetzung in den vorigen Stand zu gewähren."),
  sgb10_44: norm("§ 44 SGB X", "sgb_10/__44", "Soweit sich im Einzelfall ergibt, dass bei Erlass eines Verwaltungsaktes das Recht unrichtig angewandt oder von einem Sachverhalt ausgegangen worden ist, der sich als unrichtig erweist, und soweit deshalb Sozialleistungen zu Unrecht nicht erbracht oder Beiträge zu Unrecht erhoben worden sind, ist der Verwaltungsakt, auch nachdem er unanfechtbar geworden ist, mit Wirkung für die Vergangenheit zurückzunehmen."),
  sgb10_48: norm("§ 48 SGB X", "sgb_10/__48", "Soweit in den tatsächlichen oder rechtlichen Verhältnissen, die beim Erlass eines Verwaltungsaktes mit Dauerwirkung vorgelegen haben, eine wesentliche Änderung eintritt, ist der Verwaltungsakt mit Wirkung für die Zukunft aufzuheben."),
  sgb10_25: norm("§ 25 SGB X", "sgb_10/__25", "Die Behörde hat den Beteiligten Einsicht in die das Verfahren betreffenden Akten zu gestatten, soweit deren Kenntnis zur Geltendmachung oder Verteidigung ihrer rechtlichen Interessen erforderlich ist."),
  sgg88: norm("§ 88 SGG", "sgg/__88", "Ist ein Antrag auf Vornahme eines Verwaltungsakts ohne zureichenden Grund in angemessener Frist sachlich nicht beschieden worden, so ist die Klage nicht vor Ablauf von sechs Monaten seit dem Antrag auf Vornahme des Verwaltungsakts zulässig. […] Das gleiche gilt, wenn über einen Widerspruch nicht entschieden worden ist, mit der Maßgabe, daß als angemessene Frist eine solche von drei Monaten gilt."),
  vwgo75: norm("§ 75 VwGO", "vwgo/__75", "Die Klage kann nicht vor Ablauf von drei Monaten seit der Einlegung des Widerspruchs oder seit dem Antrag auf Vornahme des Verwaltungsakts erhoben werden, außer wenn wegen besonderer Umstände des Falles eine kürzere Frist geboten ist."),
  sgb9_14: norm("§ 14 SGB IX", "sgb_9_2018/__14", "Werden Leistungen zur Teilhabe beantragt, stellt der Rehabilitationsträger innerhalb von zwei Wochen nach Eingang des Antrages bei ihm fest, ob er nach dem für ihn geltenden Leistungsgesetz für die Leistung zuständig ist"),
  sgb1_16: norm("§ 16 SGB I", "sgb_1/__16", "Anträge, die bei einem unzuständigen Leistungsträger, bei einer für die Sozialleistung nicht zuständigen Gemeinde oder bei einer amtlichen Vertretung der Bundesrepublik Deutschland im Ausland gestellt werden, sind unverzüglich an den zuständigen Leistungsträger weiterzuleiten."),
  sgb10_37: norm("§ 37 SGB X", "sgb_10/__37", "Ein schriftlicher Verwaltungsakt, der im Inland durch die Post übermittelt wird, gilt am vierten Tag nach der Aufgabe zur Post als bekannt gegeben. […] Dies gilt nicht, wenn der Verwaltungsakt nicht oder zu einem späteren Zeitpunkt zugegangen ist; im Zweifel hat die Behörde den Zugang des Verwaltungsaktes und den Zeitpunkt des Zugangs nachzuweisen."),
};

const JUGENDHILFE =
  "Bei Leistungen der Kinder- und Jugendhilfe (SGB VIII, z. B. Eingliederungshilfe nach § 35a SGB VIII) gelten für Widerspruch und Klage die VwGO und die Verwaltungsgerichte, nicht das SGG.";

/** Die Themen in fester Reihenfolge. */
export const THEMEN = [
  {
    id: "widerspruch",
    titel: "Widerspruch gegen einen Bescheid",
    kurz: "Mit dem Widerspruch lässt man einen Bescheid von der Behörde selbst noch einmal prüfen, bevor er bestandskräftig wird.",
    erklaerung:
      "Ein Bescheid ist eine Entscheidung der Behörde (Verwaltungsakt). Mit dem Widerspruch bittet man die Stelle, die den Bescheid erlassen hat, ihn noch einmal zu prüfen. Das Widerspruchsverfahren (Vorverfahren) ist im Sozialrecht in der Regel Voraussetzung für eine spätere Klage beim Sozialgericht. Der Widerspruch muss innerhalb der Frist eingehen; welche Frist gilt und wo er einzureichen ist, steht in der Rechtsbehelfsbelehrung am Ende des Bescheids. Eine Begründung kann auch später nachgereicht werden. Über den Widerspruch entscheidet die Behörde mit einem Widerspruchsbescheid.",
    normen: [N.sgg84, N.sgg78, N.sgg66, N.vwgo70, N.sgb10_27],
    was_man_braucht: [
      "den Bescheid mit Datum und Rechtsbehelfsbelehrung",
      "ein Schreiben, aus dem hervorgeht, gegen welchen Bescheid sich der Widerspruch richtet, mit Unterschrift",
      "ein Nachweis, wann der Widerspruch eingegangen ist (z. B. Eingangsstempel auf einer Kopie, Fax-Sendebericht)",
      "für die Begründung: die eigene Darstellung mit Tatsachen, Beobachtungen und Belegen",
    ],
    verwandt: ["bekanntgabe", "akteneinsicht", "ueberpruefungsantrag", "untaetigkeitsklage"],
    besonderheiten: [
      JUGENDHILFE,
      "Wer eine Frist ohne eigenes Verschulden versäumt hat, kann Wiedereinsetzung in den vorigen Stand beantragen (§ 27 SGB X); ob das im Einzelfall gilt, klärt eine Beratung.",
    ],
  },
  {
    id: "ueberpruefungsantrag",
    titel: "Überprüfungsantrag (§ 44 SGB X)",
    kurz: "Mit dem Überprüfungsantrag lässt sich auch ein bestandskräftiger Bescheid noch einmal prüfen lassen.",
    erklaerung:
      "Ist die Widerspruchsfrist vorbei, wird ein Bescheid bestandskräftig (unanfechtbar). Nach § 44 SGB X muss die Behörde einen solchen Bescheid trotzdem zurücknehmen, wenn sich ergibt, dass das Recht falsch angewandt oder von einem falschen Sachverhalt ausgegangen wurde und deshalb Leistungen nicht erbracht wurden. Der Antrag ist an keine Monatsfrist gebunden. Rückwirkend werden Leistungen nach § 44 Absatz 4 SGB X längstens für bis zu vier Jahre erbracht. Gegen die Entscheidung über den Überprüfungsantrag ist wiederum ein Widerspruch möglich.",
    normen: [N.sgb10_44],
    was_man_braucht: [
      "den Bescheid, der überprüft werden soll",
      "einen Antrag mit Hinweis auf § 44 SGB X",
      "möglichst die Angaben oder Belege, aus denen sich ergibt, warum der Sachverhalt anders war (z. B. Befunde, Pflegetagebuch)",
    ],
    verwandt: ["widerspruch", "neufeststellungsantrag", "akteneinsicht"],
    besonderheiten: [
      "Der Überprüfungsantrag betrifft die Lage zur Zeit des Bescheids; hat sich die Situation seitdem verändert, geht es um eine Neufeststellung (§ 48 SGB X).",
      "In der Sozialhilfe (§ 116a SGB XII) und im Bürgergeld bzw. der Grundsicherung für Arbeitsuchende (§ 40 SGB II) tritt an die Stelle der vier Jahre für rückwirkende Leistungen ein Jahr; außerdem ist der Antrag dort spätestens vier Jahre nach Ablauf des Jahres der Bekanntgabe zu stellen.",
    ],
  },
  {
    id: "neufeststellungsantrag",
    titel: "Neufeststellungs- bzw. Höherstufungsantrag (§ 48 SGB X)",
    kurz: "Hat sich die Situation seit dem Bescheid wesentlich verändert, kann man eine neue Feststellung beantragen.",
    erklaerung:
      "Viele Bescheide wirken auf Dauer, etwa die Feststellung eines GdB oder eines Pflegegrads. Ändern sich die Verhältnisse wesentlich – zum Beispiel weil eine Erkrankung hinzukommt oder sich die Selbstständigkeit verringert –, ist der Bescheid nach § 48 SGB X für die Zukunft anzupassen. Im Schwerbehindertenrecht heißt das Neufeststellungsantrag (beim Versorgungsamt bzw. der nach Landesrecht zuständigen Stelle), in der Pflegeversicherung Antrag auf Höherstufung (bei der Pflegekasse); dabei wird in der Regel erneut begutachtet. Eine Neufeststellung kann auch zu einem niedrigeren Ergebnis führen.",
    normen: [N.sgb10_48],
    was_man_braucht: [
      "den bisherigen Bescheid",
      "eine Beschreibung, was sich seitdem verändert hat und seit wann",
      "neue Befunde, Arztberichte oder ein Pflegetagebuch",
    ],
    verwandt: ["ueberpruefungsantrag", "widerspruch"],
    besonderheiten: [
      "Eine Veränderung lässt sich mit zwei Fassungen des Fallprofils darstellen (fall_vergleichen).",
    ],
  },
  {
    id: "akteneinsicht",
    titel: "Akteneinsicht (§ 25 SGB X)",
    kurz: "Beteiligte können die Akten ihres Verfahrens einsehen, etwa Gutachten und Stellungnahmen.",
    erklaerung:
      "Wer an einem Verwaltungsverfahren beteiligt ist, kann Einsicht in die Akten verlangen, soweit das zur Wahrnehmung der eigenen rechtlichen Interessen erforderlich ist – zum Beispiel, um zu sehen, auf welches Gutachten oder welche Befunde sich ein Bescheid stützt. Man kann Kopien anfertigen oder sich Ablichtungen geben lassen; die Behörde kann dafür angemessenen Ersatz ihrer Aufwendungen verlangen. Bei Angaben über die Gesundheit kann die Behörde den Inhalt auch durch eine Ärztin oder einen Arzt vermitteln lassen.",
    normen: [N.sgb10_25],
    was_man_braucht: [
      "ein kurzes Schreiben an die Stelle, die die Akte führt, mit Bezug auf das Verfahren",
      "die Angabe, ob Einsicht vor Ort oder Kopien gewünscht sind",
    ],
    verwandt: ["widerspruch", "ueberpruefungsantrag"],
    besonderheiten: [
      "Ein Pflegegutachten des Medizinischen Dienstes erhält man in der Regel ohnehin von der Pflegekasse; nach weiteren Unterlagen kann man fragen.",
    ],
  },
  {
    id: "untaetigkeitsklage",
    titel: "Untätigkeitsklage (§ 88 SGG)",
    kurz: "Entscheidet die Behörde lange nicht, ist nach bestimmten Zeiträumen eine Klage beim Sozialgericht möglich.",
    erklaerung:
      "Wird über einen Antrag ohne zureichenden Grund nicht entschieden, ist nach § 88 SGG eine Untätigkeitsklage beim Sozialgericht frühestens sechs Monate nach dem Antrag zulässig, bei einem Widerspruch frühestens drei Monate nach seiner Einlegung. Das Gericht prüft dann, ob es einen zureichenden Grund für die Verzögerung gibt. Die Klage richtet sich darauf, dass überhaupt entschieden wird, nicht auf ein bestimmtes Ergebnis. Oft hilft vorher eine schriftliche Nachfrage nach dem Stand.",
    normen: [N.sgg88, N.vwgo75],
    was_man_braucht: [
      "Datum und Nachweis des Antrags bzw. Widerspruchs",
      "Schriftwechsel mit der Behörde seitdem (Nachfragen, Eingangsbestätigungen)",
    ],
    verwandt: ["widerspruch", "zustaendigkeit"],
    besonderheiten: [
      `${JUGENDHILFE} Nach § 75 VwGO kann die Untätigkeitsklage dort in der Regel nach drei Monaten erhoben werden.`,
      "Für Leistungen zur Teilhabe gelten zusätzlich die Entscheidungsfristen nach § 14 SGB IX.",
    ],
  },
  {
    id: "zustaendigkeit",
    titel: "Zuständigkeitsklärung bei Leistungen zur Teilhabe (§ 14 SGB IX)",
    kurz: "Bei Teilhabeleistungen muss der Träger, bei dem der Antrag eingeht, schnell klären, ob er zuständig ist.",
    erklaerung:
      "Wer Leistungen zur Teilhabe beantragt, muss nicht selbst wissen, welcher Träger zuständig ist. Der Rehabilitationsträger, bei dem der Antrag eingeht, prüft innerhalb von zwei Wochen seine Zuständigkeit. Hält er sich insgesamt nicht für zuständig, leitet er den Antrag weiter und teilt das mit. Sonst ermittelt er den Bedarf und entscheidet als leistender Rehabilitationsträger, in der Regel innerhalb von drei Wochen nach Antragseingang, bei einem Gutachten innerhalb von zwei Wochen nach dessen Vorliegen. Allgemein gilt nach § 16 SGB I: Anträge bei einer unzuständigen Stelle werden an die zuständige weitergeleitet.",
    normen: [N.sgb9_14, N.sgb1_16],
    was_man_braucht: [
      "Datum und Nachweis, wann und wo der Antrag gestellt wurde",
      "Mitteilungen über eine Weiterleitung",
    ],
    verwandt: ["untaetigkeitsklage", "widerspruch"],
    besonderheiten: [
      "Welche Stelle für eine bestimmte Leistung zuständig ist, ist eine Frage des Einzelfalls; dabei hilft die EUTB.",
    ],
  },
  {
    id: "bekanntgabe",
    titel: "Bekanntgabe eines Bescheids (§ 37 SGB X)",
    kurz: "Ab der Bekanntgabe wirkt ein Bescheid; bei Post gilt eine gesetzliche Regel für den Tag der Bekanntgabe.",
    erklaerung:
      "Ein Bescheid wird mit der Bekanntgabe wirksam; ab dann laufen in der Regel die Fristen der Rechtsbehelfsbelehrung. Für einen Bescheid, der im Inland mit der Post kommt, regelt § 37 Absatz 2 SGB X, an welchem Tag er als bekannt gegeben gilt; für elektronische Bescheide gibt es eigene Regeln. Kommt ein Bescheid später oder gar nicht an, gilt die Regel nicht. Hilfreich ist es, das Eingangsdatum auf dem Bescheid oder dem Umschlag zu notieren und den Umschlag aufzubewahren.",
    normen: [N.sgb10_37],
    was_man_braucht: [
      "das Datum des Bescheids und das Datum, an dem er angekommen ist",
      "den Briefumschlag bzw. die elektronische Benachrichtigung",
    ],
    verwandt: ["widerspruch"],
    besonderheiten: [],
  },
];

const HERKUNFT = { erklaerung: "kuratiert (nicht amtlich)", normen: "amtlich: wörtliche Auszüge von gesetze-im-internet.de (Stand der Prüfung 22.11.2026)" };

const FRIST =
  "Welche Frist gilt und wo ein Rechtsbehelf einzureichen ist, steht in der Rechtsbehelfsbelehrung des Bescheids. Dieses Werkzeug nimmt keine Berechnung einer persönlichen Frist vor. Fehlt die Rechtsbehelfsbelehrung oder ist sie unrichtig, gilt nach § 66 SGG allgemein eine längere Frist; ob das im Einzelfall zutrifft, klärt eine Beratung.";

const BERATUNG = [
  "Ergänzende unabhängige Teilhabeberatung (EUTB, § 32 SGB IX) – kostenlos, unabhängig von Leistungsträgern",
  "Pflegeberatung nach § 7a SGB XI über die Pflegekasse",
  "Pflegestützpunkt (§ 7c SGB XI), soweit im Land eingerichtet",
  "Sozialverbände (z. B. VdK, SoVD) und Behindertenverbände; dort auch rechtliche Beratung und Vertretung für Mitglieder",
];

const HINWEIS =
  "Allgemeine Information, keine Rechtsberatung: Welcher Weg im Einzelfall passt, ob er Erfolg haben kann und welche Frist gilt, beurteilt eine Beratungsstelle oder eine Rechtsanwältin bzw. ein Rechtsanwalt.";

/** verfahren_info: Übersicht oder ein Thema. */
export function info({ thema } = {}) {
  if (thema === undefined || thema === null || thema === "") {
    return { herkunft: HERKUNFT, themen: THEMEN.map(({ id, titel, kurz }) => ({ id, titel, kurz })), frist: FRIST, beratung: BERATUNG, hinweis: HINWEIS };
  }
  const gesucht = typeof thema === "string" ? fold(thema.trim()) : null;
  const t = gesucht && THEMEN.find((x) => fold(x.id) === gesucht);
  if (!t) throw new LookupError(`Unbekanntes Thema ${JSON.stringify(thema)}. Verfügbar: ${THEMEN.map((x) => x.id).join(", ")}.`);
  return { ...t, herkunft: HERKUNFT, frist: FRIST, beratung: BERATUNG, hinweis: HINWEIS };
}
