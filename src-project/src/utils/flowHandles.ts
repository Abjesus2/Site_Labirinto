/**
 * PONTOS DE SAÍDA/ENTRADA DAS LINHAS (fluxo de cima para baixo)
 * -------------------------------------------------------------
 * Depois de montar as raias, as etapas mudam de lugar e as linhas precisam
 * de novos pontos de saída/entrada. A regra antiga mandava a volta de uma
 * decisão ("Não" para uma etapa de cima) sair pelo TOPO da decisão e entrar
 * na BASE da etapa — exatamente o mesmo caminho da linha que chega nela: as
 * duas ficavam uma em cima da outra e a pergunta parecia ter uma saída só.
 *
 * Regra (mesma do layout automático):
 * - para baixo: sai pela base e entra pelo topo; numa decisão, a saída
 *   negativa ("Não") ou a que vai para o lado sai pela lateral;
 * - para cima ou no mesmo nível (volta/retrabalho): sai e entra pela
 *   lateral, contornando por fora;
 * - as saídas de uma mesma decisão nunca usam o mesmo ponto.
 * Linhas ajustadas à mão (manualRouting) não são tocadas.
 */

interface NodeLike { id: string; type?: string; position: { x: number; y: number } }
interface EdgeLike {
  id: string;
  source: string;
  target: string;
  label?: any;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: any;
}

export type SizeOf = (n: NodeLike) => { width: number; height: number };

const isNegative = (label: any) => /\b(n[ãa]o|false|neg|reprovad|divergen|incorret|errad)/i.test(String(label || ''));

export function assignFlowHandles<E extends EdgeLike>(nodes: NodeLike[], edges: E[], sizeOf: SizeOf): E[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const center = (n: NodeLike) => {
    const s = sizeOf(n);
    return { x: n.position.x + s.width / 2, y: n.position.y + s.height / 2 };
  };

  const out = edges.map((edge) => {
    if (edge.data?.manualRouting) return edge;
    const src = byId.get(edge.source);
    const tgt = byId.get(edge.target);
    if (!src || !tgt) return edge;
    const s = center(src);
    const t = center(tgt);
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    let sourceHandle: string;
    let targetHandle: string;
    if (dy > 20) {
      if (src.type === 'decision' && (isNegative(edge.label) || Math.abs(dx) > 40)) {
        sourceHandle = dx >= 0 ? 'right' : 'left';
        targetHandle = 'top';
      } else {
        sourceHandle = 'bottom';
        targetHandle = 'top';
      }
    } else if (dx >= -40) {
      sourceHandle = 'right';
      targetHandle = 'right';
    } else {
      sourceHandle = 'left';
      targetHandle = 'left';
    }
    const straight = sourceHandle === 'bottom' && targetHandle === 'top' && Math.abs(dx) <= 1;
    const data = { ...(edge.data || {}) };
    delete data.controlPoints;
    return { ...edge, sourceHandle, targetHandle, type: straight ? 'straight' : 'smoothstep', data } as E;
  });

  // Saídas de uma mesma decisão em pontos diferentes (nunca duas pela base,
  // nem duas pelo mesmo lado — senão as linhas se sobrepõem).
  nodes
    .filter((n) => n.type === 'decision')
    .forEach((dec) => {
      const outs = out
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.source === dec.id && !e.data?.manualRouting)
        // a saída "principal" (positiva, para baixo e alinhada) escolhe primeiro
        .sort((a, b) => Number(isNegative(a.e.label)) - Number(isNegative(b.e.label)));
      const used = new Set<string>();
      outs.forEach(({ e, i }) => {
        let h = e.sourceHandle || 'bottom';
        if (used.has(h)) {
          const tgt = byId.get(e.target);
          const goesRight = tgt ? center(tgt).x >= center(dec).x : true;
          const options = goesRight ? ['right', 'left', 'bottom'] : ['left', 'right', 'bottom'];
          h = options.find((o) => !used.has(o)) || h;
          const tgtNode = byId.get(e.target);
          const below = tgtNode ? center(tgtNode).y - center(dec).y > 20 : true;
          const targetHandle = below ? 'top' : h === 'bottom' ? 'top' : h;
          out[i] = { ...out[i], sourceHandle: h, targetHandle, type: 'smoothstep' } as E;
        }
        used.add(h);
      });
    });

  return out;
}
