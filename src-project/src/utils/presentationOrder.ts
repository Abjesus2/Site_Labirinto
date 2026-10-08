/**
 * ORDEM DAS ETAPAS NO MODO APRESENTAÇÃO
 * -------------------------------------
 * A apresentação percorre as formas na ordem do fluxo (seguindo as setas a
 * partir do Início), e não na ordem em que foram criadas. Em cada forma, a
 * saída "principal" vem antes (as negativas — "Não", "Reprovado"... — depois),
 * e entre saídas iguais vale a posição na tela (de cima para baixo, da
 * esquerda para a direita). Voltas para etapas já vistas são ignoradas.
 * Formas soltas (sem ligação) entram no fim, pela posição.
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

  const visited = new Set<string>();
  const order: string[] = [];
  const walk = (root: string) => {
    if (visited.has(root)) return;
    const queue = [root];
    visited.add(root);
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      nextOf(id).forEach((t) => {
        if (visited.has(t)) return;
        visited.add(t);
        queue.push(t);
      });
    }
  };
  [...starts, ...sources, ...rest].forEach(walk);
  return order.filter((id) => isPresentationStep(byId.get(id)!));
}
