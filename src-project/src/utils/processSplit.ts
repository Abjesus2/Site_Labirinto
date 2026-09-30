/**
 * PROCESSOS DIFERENTES NA MESMA GERAÇÃO DA IA
 * -------------------------------------------
 * Quando a fonte descreve mais de um processo, a IA marca cada etapa com o
 * nome do processo ("process"). O app só desenha os processos SEPARADOS,
 * um ao lado do outro, quando isso é certo:
 *  - há 2 ou mais processos marcados e TODAS as etapas estão marcadas;
 *  - cada processo tem o seu próprio início e o seu próprio fim;
 *  - nenhuma ligação vai de um processo para outro.
 * Qualquer dúvida (etapa sem marca, processo sem início/fim, ligação entre
 * eles) = é tratado como UM processo só, e os blocos soltos são ligados com
 * a linha vermelha de validação (graphSanitizer).
 *
 * Sem DOM nem React: testável isolado.
 */

export interface ProcessGroup<N = any, E = any> {
  name: string;
  nodes: N[];
  edges: E[];
}

export interface ProcessSplit<N = any, E = any> {
  /** true = processos independentes com certeza (desenhar lado a lado). */
  certain: boolean;
  groups: ProcessGroup<N, E>[];
  /** Por que não separou (para diagnóstico/testes). */
  reason?: string;
}

const processOf = (n: any): string => String(n?.data?.process ?? '').trim();
const isInfra = (n: any) => n?.type === 'junction';

export function splitIndependentProcesses<N extends { id: string; type?: string }, E extends { source: string; target: string }>(
  nodes: N[],
  edges: E[],
): ProcessSplit<N, E> {
  const whole: ProcessSplit<N, E> = { certain: false, groups: [{ name: '', nodes, edges }] };
  const real = nodes.filter((n) => !isInfra(n));
  const names = [...new Set(real.map(processOf).filter(Boolean))];
  if (names.length < 2) return { ...whole, reason: 'um processo só' };
  if (real.some((n) => !processOf(n))) return { ...whole, reason: 'etapa sem processo marcado' };

  // Normaliza o nome (maiúsculas/espaços) para não separar "Recebimento" de "recebimento ".
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  const groupOf = new Map<string, string>();
  real.forEach((n) => groupOf.set(n.id, key(processOf(n))));
  const keys = [...new Set(real.map((n) => key(processOf(n))))];
  if (keys.length < 2) return { ...whole, reason: 'um processo só' };

  for (const e of edges) {
    const a = groupOf.get(e.source);
    const b = groupOf.get(e.target);
    if (a && b && a !== b) return { ...whole, reason: 'ligação entre processos' };
  }

  const groups: ProcessGroup<N, E>[] = keys.map((k) => {
    const members = real.filter((n) => groupOf.get(n.id) === k);
    const ids = new Set(members.map((n) => n.id));
    return {
      name: processOf(members[0]),
      nodes: members,
      edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
  });
  const incomplete = groups.find((g) => !g.nodes.some((n) => n.type === 'start') || !g.nodes.some((n) => n.type === 'end'));
  if (incomplete) return { ...whole, reason: `processo "${incomplete.name}" sem início ou fim próprio` };

  return { certain: true, groups };
}

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Coloca os blocos (cada um já com o seu layout) lado a lado, da esquerda
 * para a direita, alinhados pelo topo, com "gap" de espaço entre eles.
 */
export function placeSideBySide<N extends { position: { x: number; y: number } }>(
  blocks: N[][],
  sizeOf: (n: N) => { w: number; h: number },
  gap = 200,
): N[] {
  const out: N[] = [];
  let cursorX = 0;
  blocks.forEach((block) => {
    if (!block.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity;
    block.forEach((n) => {
      const s = sizeOf(n);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + s.w);
    });
    const dx = cursorX - minX;
    const dy = -minY;
    block.forEach((n) => out.push({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
    cursorX += maxX - minX + gap;
  });
  return out;
}
