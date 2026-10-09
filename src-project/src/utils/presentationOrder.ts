/**
 * ORDEM DAS ETAPAS NO MODO APRESENTAÇÃO
 * -------------------------------------
 * A apresentação percorre as formas na ordem do fluxo (seguindo as setas a
 * partir do Início), e não na ordem em que foram criadas.
 *
 * Bifurcações (uma forma com 2+ saídas, ex.: "Sim"/"Não"): segue UM lado de
 * cada vez até o PONTO DE ENCONTRO — a primeira etapa por onde todos os
 * caminhos voltam a passar (pós-dominador imediato) —, depois volta para o
 * início do próximo lado e o segue até o mesmo ponto; só então continua a
 * partir do encontro. Funciona com bifurcações dentro de bifurcações. Lados
 * que nunca se reencontram (cada um termina num Fim) são mostrados um
 * inteiro e depois o outro.
 *
 * Ordem dos lados: a saída "principal" antes (as negativas — "Não",
 * "Reprovado"... — depois); entre saídas iguais, a posição na tela (de cima
 * para baixo, da esquerda para a direita). Voltas para etapas já vistas são
 * ignoradas. Formas soltas (sem ligação) entram no fim, pela posição.
 * Raias, molduras e pontos de junção não são etapas.
 */

interface NodeLike {
  id: string;
  type?: string;
  position: { x: number; y: number };
  parentId?: string;
}
interface EdgeLike {
  source: string;
  target: string;
  label?: any;
}

const NOT_A_STEP = new Set(['swimlane', 'frame', 'junction']);
const isNegative = (label: any) => /\b(n[ãa]o|false|neg|reprovad|divergen|incorret|errad)/i.test(String(label || ''));

export const isPresentationStep = (n: { type?: string }) => !NOT_A_STEP.has(String(n.type));

/** Posição absoluta (formas dentro de raias guardam a posição relativa à raia). */
export function absolutePosition(node: NodeLike, byId: Map<string, NodeLike>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  const seen = new Set<string>();
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

export function presentationOrder(nodes: NodeLike[], edges: EdgeLike[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const flowNodes = nodes.filter((n) => n.type !== 'swimlane' && n.type !== 'frame');
  const pos = new Map(flowNodes.map((n) => [n.id, absolutePosition(n, byId)]));
  const byPosition = (a: string, b: string) => {
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    return Math.abs(pa.y - pb.y) > 12 ? pa.y - pb.y : pa.x - pb.x;
  };

  const outgoing = new Map<string, EdgeLike[]>();
  const incoming = new Map<string, number>();
  edges.forEach((e) => {
    if (!pos.has(e.source) || !pos.has(e.target) || e.source === e.target) return;
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
  });
  const nextOf = (id: string) =>
    (outgoing.get(id) || [])
      .slice()
      .sort((a, b) => Number(isNegative(a.label)) - Number(isNegative(b.label)) || byPosition(a.target, b.target))
      .map((e) => e.target);

  const ids = flowNodes.map((n) => n.id);
  const starts = ids.filter((id) => byId.get(id)!.type === 'start').sort(byPosition);
  // Notas e textos soltos não puxam a apresentação (ficam para o fim).
  const sources = ids
    .filter((id) => !incoming.get(id) && outgoing.has(id) && byId.get(id)!.type !== 'start')
    .sort(byPosition);
  const rest = ids.slice().sort(byPosition);

  const mergeOf = immediatePostDominators(ids, nextOf);

  const visited = new Set<string>();
  const order: string[] = [];
  // Percorre a partir de `start` sem passar por nenhum ponto de encontro de
  // bifurcações de fora (`stops`): esses são mostrados por quem os abriu.
  const visit = (start: string, stops: Set<string>) => {
    let id: string | null = start;
    while (id && !visited.has(id) && !stops.has(id)) {
      visited.add(id);
      order.push(id);
      const next = nextOf(id).filter((t) => !visited.has(t));
      if (next.length === 0) return;
      if (nextOf(id).length < 2) {
        id = next[0];
        continue;
      }
      // Bifurcação: um lado por vez até o ponto de encontro, depois segue dele.
      const merge = mergeOf.get(id) ?? null;
      const inner = new Set(stops);
      if (merge) inner.add(merge);
      next.forEach((side) => {
        if (side !== merge) visit(side, inner);
      });
      id = merge;
    }
  };
  [...starts, ...sources, ...rest].forEach((root) => visit(root, new Set()));
  return order.filter((id) => isPresentationStep(byId.get(id)!));
}

/**
 * Ponto de encontro de cada forma: o pós-dominador imediato (a primeira etapa
 * pela qual TODO caminho que sai dela passa). Calculado com uma saída
 * virtual ligada a todas as formas sem saída; laços (voltas) não atrapalham.
 * Sem encontro (os caminhos só se juntam no fim virtual) = sem entrada no mapa.
 */
export function immediatePostDominators(ids: string[], nextOf: (id: string) => string[]): Map<string, string> {
  // Conjuntos em bits (rápido mesmo com centenas de formas).
  const n = ids.length;
  const EXIT = n;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const words = Math.ceil((n + 1) / 32);
  const succ: number[][] = ids.map((id) => {
    const list = nextOf(id).map((t) => idx.get(t)).filter((x): x is number => x !== undefined);
    return list.length ? list : [EXIT];
  });
  const full = () => { const b = new Uint32Array(words); b.fill(0xffffffff); return b; };
  const pdom: Uint32Array[] = ids.map(() => full());
  const exitSet = new Uint32Array(words);
  exitSet[EXIT >>> 5] |= 1 << (EXIT & 31);
  pdom.push(exitSet);
  const tmp = new Uint32Array(words);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (let i = n - 1; i >= 0; i--) {
      tmp.fill(0xffffffff);
      for (const s of succ[i]) {
        const ps = pdom[s];
        for (let w = 0; w < words; w++) tmp[w] &= ps[w];
      }
      tmp[i >>> 5] |= 1 << (i & 31);
      const cur = pdom[i];
      for (let w = 0; w < words; w++) {
        if (cur[w] !== tmp[w]) { cur.set(tmp); changed = true; break; }
      }
    }
  }
  const popcount = (b: Uint32Array) => {
    let c = 0;
    for (let w = 0; w < b.length; w++) { let v = b[w]; v = v - ((v >>> 1) & 0x55555555); v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); c += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
    return c;
  };
  const sizes = pdom.map(popcount);
  const result = new Map<string, string>();
  for (let i = 0; i < n; i++) {
    let best = -1;
    let bestSize = -1;
    const set = pdom[i];
    for (let d = 0; d <= n; d++) {
      if (d === i || !(set[d >>> 5] & (1 << (d & 31)))) continue;
      if (sizes[d] > bestSize) { bestSize = sizes[d]; best = d; }
    }
    if (best >= 0 && best !== EXIT) result.set(ids[i], ids[best]);
  }
  return result;
}
