// Wissensnetz aus den amtlichen Beziehungen einer Klassifikation: Hierarchie, Ausschlüsse
// und Verweise. Alle Kanten stammen aus den BfArM-Daten, keine wird erschlossen.

/** Kantentypen mit deutscher Bezeichnung für Ausgaben und den graphify-Export. */
export const EDGE_TYPES = {
  ausschluss: "schließt aus (Exklusivum)",
  verweis: "verweist auf",
  kreuz_stern: "Kreuz-Stern-Kombination",
  hinweis: "nennt im Kodierhinweis, in einer Anmerkung oder Definition",
};

function parseRange(target) {
  const m = target.match(/^(.+?)-(.+)$/);
  return m && /\d/.test(m[1]) && /\d/.test(m[2]) ? [m[1], m[2]] : null;
}

export class RelationGraph {
  /**
   * @param {object} opts
   * @param {(code: string) => string | undefined} opts.parentOf
   * @param {(code: string) => string[]} opts.childrenOf
   * @param {(code: string) => boolean} opts.has
   * @param {string[]} opts.roots oberste Knoten (ICD-Kapitel bzw. ICF-Komponenten)
   */
  constructor({ parentOf, childrenOf, has, roots }) {
    this.parentOf = parentOf;
    this.childrenOf = childrenOf;
    this.has = has;
    this.roots = roots;
    this.edges = [];
    this.outgoing = new Map();
  }

  addEdge(from, to, type, text) {
    if (from === to) return;
    const edge = { from, to, type, text };
    this.edges.push(edge);
    if (!this.outgoing.has(from)) this.outgoing.set(from, []);
    this.outgoing.get(from).push(edge);
  }

  ancestors(code) {
    const chain = [];
    for (let c = this.parentOf(code); c; c = this.parentOf(c)) chain.push(c);
    return chain;
  }

  /**
   * Erfasst ein Verweisziel den Kode? Gibt an wie: direkt, über eine Oberklasse oder über einen Bereich.
   * Bereiche wie "J00-J22", die nicht als Gruppe existieren, werden über die Kode-Reihenfolge geprüft.
   */
  covers(target, code) {
    if (target === code) return { via: "direkt" };
    const viaAncestor = this.ancestors(code).find((a) => a === target);
    if (viaAncestor) return { via: "oberklasse", ueber: viaAncestor };
    const range = !this.has(target) && parseRange(target);
    // Nur echte Kodes (Buchstabe + Ziffer) vergleichen, keine römischen Kapitelnummern wie "XVIII"
    if (range && /^[A-Za-z]\d/.test(code) && this.#inRange(range, code)) return { via: "bereich", ueber: target };
    return null;
  }

  // Ein Kode liegt im Bereich, wenn er in der Kode-Reihenfolge dazwischen liegt. Jede Grenze wird in ihrer
  // eigenen Genauigkeit verglichen ("C41.02-C41.1": C41.02 … C41.1 einschließlich aller C41.1x).
  // Ist der Bereich genauer als der Kode (z. B. "T80-T88.6" für "T88"), müssen alle Unterkodes darin liegen.
  #inRange([start, end], code) {
    const children = this.childrenOf(code);
    if (code.length < Math.max(start.length, end.length) && children.length) {
      return children.every((child) => this.#inRange([start, end], child));
    }
    const lowOk = code.length >= start.length ? code.slice(0, start.length) >= start : code >= start.slice(0, code.length);
    const highOk = code.length >= end.length ? code.slice(0, end.length) <= end : code <= end.slice(0, code.length);
    return lowOk && highOk;
  }

  /** Eigene ausgehende Kanten eines Kodes, optional nach Typ gefiltert. */
  out(code, type) {
    return (this.outgoing.get(code) ?? []).filter((e) => !type || e.type === type);
  }

  /** Ausgehende Kanten der Oberklassen – Ausschlüsse gelten für alle untergeordneten Kodes. */
  inherited(code, type) {
    return this.ancestors(code).flatMap((a) => this.out(a, type).map((e) => ({ ...e, geerbt_von: a })));
  }

  /** Kanten, deren Ziel den Kode erfasst (direkt, über Oberklasse oder Bereich). */
  incoming(code, type) {
    const result = [];
    for (const edge of this.edges) {
      if (type && edge.type !== type) continue;
      const hit = this.covers(edge.to, code);
      if (hit) result.push({ ...edge, ...hit });
    }
    return result;
  }

  /** Niedrigste gemeinsame Oberklasse zweier Kodes (oder null bei verschiedenen Kapiteln/Komponenten). */
  commonAncestor(a, b) {
    const ancestorsA = new Set([a, ...this.ancestors(a)]);
    return [b, ...this.ancestors(b)].find((c) => ancestorsA.has(c)) ?? null;
  }

  /** Kanten von a (und seinen Oberklassen), deren Ziel b erfasst. */
  edgesBetween(a, b, type) {
    return [...this.out(a, type), ...this.inherited(a, type)]
      .map((edge) => ({ edge, hit: this.covers(edge.to, b) }))
      .filter(({ hit }) => hit)
      .map(({ edge, hit }) => ({ ...edge, ...hit }));
  }

  /** Auflösen eines Verweisziels auf einen vorhandenen Knoten (Bereiche → erster Kode des Bereichs). */
  resolve(target) {
    if (this.has(target)) return target;
    const range = parseRange(target);
    return range && this.has(range[0]) ? range[0] : null;
  }

  /**
   * Kürzester Weg zwischen zwei Kodes über Hierarchie und Verweise (ungerichtet, Breitensuche).
   * Gibt die Schritte mit Kantentyp zurück, oder null, wenn innerhalb von maxSteps kein Weg existiert.
   */
  path(a, b, maxSteps = 8) {
    if (a === b) return [];
    const adjacency = this.#adjacency();
    const previous = new Map([[a, null]]);
    let frontier = [a];
    for (let depth = 0; depth < maxSteps && frontier.length; depth++) {
      const next = [];
      for (const node of frontier) {
        for (const step of adjacency.get(node) ?? []) {
          if (previous.has(step.to)) continue;
          previous.set(step.to, { from: node, type: step.type, text: step.text, richtung: step.richtung });
          if (step.to === b) return this.#trace(previous, b);
          next.push(step.to);
        }
      }
      frontier = next;
    }
    return null;
  }

  #trace(previous, end) {
    const steps = [];
    for (let node = end; previous.get(node); node = previous.get(node).from) {
      const { from, type, text, richtung } = previous.get(node);
      steps.unshift({ von: from, nach: node, typ: type, richtung, ...(text ? { text } : {}) });
    }
    return steps;
  }

  #adjacencyCache = null;

  #adjacency() {
    if (this.#adjacencyCache) return this.#adjacencyCache;
    const adjacency = new Map();
    const link = (from, to, step) => {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ to, ...step });
    };
    const visit = (code) => {
      for (const child of this.childrenOf(code)) {
        link(code, child, { type: "unterklasse", richtung: "abwärts" });
        link(child, code, { type: "oberklasse", richtung: "aufwärts" });
        visit(child);
      }
    };
    for (const root of this.roots) visit(root);
    for (const edge of this.edges) {
      const to = this.resolve(edge.to);
      if (!to) continue;
      link(edge.from, to, { type: edge.type, text: edge.text, richtung: "vorwärts" });
      link(to, edge.from, { type: edge.type, text: edge.text, richtung: "rückwärts" });
    }
    this.#adjacencyCache = adjacency;
    return adjacency;
  }
}
