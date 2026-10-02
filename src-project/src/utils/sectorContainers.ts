import { Node } from '@xyflow/react';
import { getNodeDimensions } from '../components/CustomNodes';

const SECTOR_CONTAINER_SIDE_PADDING = 48;
const SECTOR_CONTAINER_TOP_PADDING = 56; // espaço para o título da raia/quadro
const SECTOR_CONTAINER_BOTTOM_PADDING = 32;

/**
 * Base do zIndex de raias/quadros. Precisa ficar abaixo de TODA aresta
 * possível — o app usa -1 para arestas "atrás" (padrão) e 1000 para arestas
 * fixadas "na frente" (menu Organizar → linhas por cima) — por isso -100 e
 * não só -1: empatado em -1 com as arestas padrão, o empate era resolvido
 * pela ordem no DOM, e a raia/quadro acabava ganhando (por isso ainda
 * ficava por cima das linhas mesmo já corrigido para ficar atrás dos nós).
 * Com elevateNodesOnSelect (+1000 ao selecionar), a raia/quadro selecionada
 * sobe para 900 — acima de formas e arestas padrão, o suficiente para
 * editar — sem competir com arestas propositalmente fixadas na frente.
 */
export const CONTAINER_BASE_Z_INDEX = -100;

export interface SectorBox {
  dept: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Corrige raias/quadros salvos antes da correção do zIndex (que estava
 * gravado dentro de "style", onde o React Flow nunca lê para decidir a
 * ordem de empilhamento — por isso ficavam na frente das formas e das
 * linhas, atrapalhando a edição). Roda ao carregar qualquer diagrama
 * salvo, sem precisar o usuário recriar as raias/quadros que já tinha.
 */
export function normalizeContainerZIndex(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type !== 'swimlane' && n.type !== 'frame') return n;
    if (n.zIndex === CONTAINER_BASE_Z_INDEX && !(n.style as any)?.zIndex) return n;

    const nextStyle = { ...(n.style || {}) };
    delete (nextStyle as any).zIndex;

    return { ...n, zIndex: CONTAINER_BASE_Z_INDEX, style: nextStyle };
  });
}

const getSectorNodeBox = (node: Node): { x: number; y: number; width: number; height: number } => {
  const dim = getNodeDimensions(node.type);
  const width = (node.measured?.width as number) || (node.width as number) || (node.style?.width as number) || dim.width;
  const height = (node.measured?.height as number) || (node.height as number) || (node.style?.height as number) || dim.height;
  return { x: node.position.x, y: node.position.y, width, height };
};

/** Agrupa os nós de processo (exclui raias/quadros/junções) pelo campo "department". */
export function groupNodesByDepartment(nodes: Node[]): Map<string, Node[]> {
  const groups = new Map<string, Node[]>();
  nodes.forEach((n) => {
    if (n.type === 'swimlane' || n.type === 'frame' || n.type === 'junction') return;
    const dept = String((n.data as any)?.timing?.department || '').trim();
    if (!dept) return;
    if (!groups.has(dept)) groups.set(dept, []);
    groups.get(dept)!.push(n);
  });
  return groups;
}

/**
 * Decide se os setores formam faixas sequenciais (sem sobreposição no eixo
 * perpendicular ao fluxo — vira raia contínua) ou se se intercalam ao longo
 * do fluxo (cada um vira um quadro independente, ao redor só dos próprios nós).
 */
export function sectorsAreSequential(boxes: SectorBox[], direction: 'TB' | 'LR' = 'TB'): boolean {
  const isTB = direction !== 'LR';
  const sorted = [...boxes].sort((a, b) => (isTB ? a.minY - b.minY : a.minX - b.minX));
  for (let i = 0; i < sorted.length - 1; i++) {
    const overlaps = isTB
      ? sorted[i].maxY > sorted[i + 1].minY + 0.5
      : sorted[i].maxX > sorted[i + 1].minX + 0.5;
    if (overlaps) return false;
  }
  return true;
}

export function computeSectorBoxes(groups: Map<string, Node[]>): SectorBox[] {
  return Array.from(groups.entries())
    .filter(([, members]) => members.length > 0)
    .map(([dept, members]) => {
      const rects = members.map(getSectorNodeBox);
      return {
        dept,
        minX: Math.min(...rects.map((r) => r.x)),
        minY: Math.min(...rects.map((r) => r.y)),
        maxX: Math.max(...rects.map((r) => r.x + r.width)),
        maxY: Math.max(...rects.map((r) => r.y + r.height)),
      };
    });
}

const isContainerOrInfra = (n: Node) => n.type === 'swimlane' || n.type === 'frame' || n.type === 'junction';
const deptOf = (n: Node) => String((n.data as any)?.timing?.department || '').trim();

/**
 * Etapas que a IA deixou sem setor quando o fluxo TEM setores: herdam o setor
 * da etapa anterior (seguindo as ligações) ou, se não houver, da seguinte.
 * Assim nenhuma etapa fica fora das raias. Só age com 2+ setores.
 */
export function fillMissingDepartments(nodes: Node[], edges: { source: string; target: string }[] = []): Node[] {
  const shapes = nodes.filter((n) => !isContainerOrInfra(n));
  const depts = new Set(shapes.map(deptOf).filter(Boolean));
  if (depts.size < 2 || shapes.every((n) => deptOf(n))) return nodes;

  const dept = new Map(shapes.map((n) => [n.id, deptOf(n)]));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!preds.has(e.target)) preds.set(e.target, []);
    preds.get(e.target)!.push(e.source);
    if (!succs.has(e.source)) succs.set(e.source, []);
    succs.get(e.source)!.push(e.target);
  });
  // Propaga pelas ligações até estabilizar (cadeias de etapas sem setor).
  for (let pass = 0; pass < shapes.length; pass++) {
    let changed = false;
    shapes.forEach((n) => {
      if (dept.get(n.id)) return;
      const from = (preds.get(n.id) || []).map((id) => dept.get(id)).find(Boolean)
        || (succs.get(n.id) || []).map((id) => dept.get(id)).find(Boolean);
      if (from) { dept.set(n.id, from); changed = true; }
    });
    if (!changed) break;
  }
  // Sem ligação nenhuma: setor da etapa mais próxima no desenho.
  const center = (n: Node) => { const b = getSectorNodeBox(n); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  shapes.forEach((n) => {
    if (dept.get(n.id)) return;
    const c = center(n);
    let best = '';
    let bestD = Infinity;
    shapes.forEach((m) => {
      const d = dept.get(m.id);
      if (!d || m.id === n.id) return;
      const cm = center(m);
      const dist = Math.hypot(cm.x - c.x, cm.y - c.y);
      if (dist < bestD) { bestD = dist; best = d; }
    });
    if (best) dept.set(n.id, best);
  });

  return nodes.map((n) => {
    if (isContainerOrInfra(n) || deptOf(n) || !dept.get(n.id)) return n;
    const data: any = n.data || {};
    return { ...n, data: { ...data, timing: { ...(data.timing || {}), department: dept.get(n.id) } } };
  });
}

const LANE_ITEM_GAP = 40;

/**
 * Setores que se alternam ao longo do fluxo (A → B → A): em vez de quadros
 * soltos, raias de verdade — uma faixa por setor, lado a lado e encostadas,
 * atravessando o fluxo inteiro (colunas no fluxo de cima para baixo; linhas
 * no fluxo da esquerda para a direita). A ordem das etapas no sentido do
 * fluxo não muda; cada etapa só se desloca para dentro da faixa do seu setor.
 */
export function arrangeLaneColumns(nodes: Node[], direction: 'TB' | 'LR' = 'TB'): Node[] {
  const isTB = direction !== 'LR';
  // Trabalha sempre "de cima para baixo": no LR troca x<->y e volta no fim.
  const box = (n: Node) => {
    const b = getSectorNodeBox(n);
    return isTB ? b : { x: b.y, y: b.x, width: b.height, height: b.width };
  };
  const shapes = nodes.filter((n) => n.type !== 'swimlane' && n.type !== 'frame');
  const real = shapes.filter((n) => n.type !== 'junction');
  const depts = [...new Set(real.map(deptOf).filter(Boolean))];
  if (depts.length < 2) return nodes;

  // Setor de cada forma (junções e formas sem setor: o da forma mais próxima).
  const keyOf = new Map<string, string>();
  const centerOf = (n: Node) => { const b = box(n); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  shapes.forEach((n) => {
    const own = n.type === 'junction' ? '' : deptOf(n);
    if (own) { keyOf.set(n.id, own); return; }
    const c = centerOf(n);
    let best = depts[0];
    let bestD = Infinity;
    real.forEach((m) => {
      const d = deptOf(m);
      if (!d) return;
      const cm = centerOf(m);
      const dist = Math.hypot(cm.x - c.x, cm.y - c.y);
      if (dist < bestD) { bestD = dist; best = d; }
    });
    keyOf.set(n.id, best);
  });

  // Níveis do fluxo (mesma altura do centro = mesmo nível do layout).
  const sorted = [...shapes].sort((a, b) => centerOf(a).y - centerOf(b).y);
  const rankOf = new Map<string, number>();
  let rank = -1;
  let rankY = -Infinity;
  sorted.forEach((n) => {
    const cy = centerOf(n).y;
    if (cy - rankY > 12) { rank++; rankY = cy; }
    rankOf.set(n.id, rank);
  });

  // Ordem das faixas: pela primeira aparição do setor no fluxo (e depois pela posição).
  const order = [...new Set(shapes.map((n) => keyOf.get(n.id)!))].sort((a, b) => {
    const first = (d: string) => shapes.filter((n) => keyOf.get(n.id) === d);
    const ra = Math.min(...first(a).map((n) => rankOf.get(n.id)!));
    const rb = Math.min(...first(b).map((n) => rankOf.get(n.id)!));
    if (ra !== rb) return ra - rb;
    return Math.min(...first(a).map((n) => centerOf(n).x)) - Math.min(...first(b).map((n) => centerOf(n).x));
  });

  // Largura interna de cada faixa: o maior grupo do setor num mesmo nível.
  const groupsByRankDept = new Map<string, Node[]>();
  shapes.forEach((n) => {
    const k = `${rankOf.get(n.id)}|${keyOf.get(n.id)}`;
    if (!groupsByRankDept.has(k)) groupsByRankDept.set(k, []);
    groupsByRankDept.get(k)!.push(n);
  });
  const groupWidth = (g: Node[]) => g.reduce((sum, n) => sum + box(n).width, 0) + LANE_ITEM_GAP * (g.length - 1);
  const inner = new Map<string, number>();
  groupsByRankDept.forEach((g, k) => {
    const d = k.split('|').slice(1).join('|');
    inner.set(d, Math.max(inner.get(d) || 0, groupWidth(g)));
  });

  const minX = Math.min(...shapes.map((n) => box(n).x));
  const minY = Math.min(...shapes.map((n) => box(n).y));
  const maxY = Math.max(...shapes.map((n) => box(n).y + box(n).height));
  const lanes: { dept: string; x: number; width: number }[] = [];
  let cursor = minX - SECTOR_CONTAINER_SIDE_PADDING;
  order.forEach((d) => {
    const width = (inner.get(d) || 0) + SECTOR_CONTAINER_SIDE_PADDING * 2;
    lanes.push({ dept: d, x: cursor, width });
    cursor += width;
  });
  const laneOf = new Map(lanes.map((l) => [l.dept, l]));

  // Nova posição (no espaço "de cima para baixo") de cada forma.
  const newX = new Map<string, number>();
  groupsByRankDept.forEach((g, k) => {
    const d = k.split('|').slice(1).join('|');
    const lane = laneOf.get(d)!;
    const ordered = [...g].sort((a, b) => centerOf(a).x - centerOf(b).x);
    let x = lane.x + lane.width / 2 - groupWidth(ordered) / 2;
    ordered.forEach((n) => { newX.set(n.id, x); x += box(n).width + LANE_ITEM_GAP; });
  });

  const moved = nodes.map((n) => {
    if (!newX.has(n.id)) return n;
    const b = box(n);
    const tbX = newX.get(n.id)!;
    const tbY = b.y;
    return { ...n, position: isTB ? { x: tbX, y: tbY } : { x: tbY, y: tbX } };
  });

  const span = maxY - minY + SECTOR_CONTAINER_TOP_PADDING + SECTOR_CONTAINER_BOTTOM_PADDING;
  const containers: Node[] = lanes.map((l, idx) => {
    const tb = { x: l.x, y: minY - SECTOR_CONTAINER_TOP_PADDING, width: l.width, height: span };
    return {
      id: `sector_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'swimlane',
      position: isTB ? { x: tb.x, y: tb.y } : { x: tb.y, y: tb.x },
      zIndex: CONTAINER_BASE_Z_INDEX,
      style: isTB ? { width: tb.width, height: tb.height } : { width: tb.height, height: tb.width },
      data: {
        label: l.dept,
        orientation: isTB ? 'vertical' : 'horizontal',
        styleOverride: {},
        timing: { duration: 0, setupTime: 0, waitTime: 0, pauseTime: 0, otherExtraTime: 0, status: 'pending' },
        generatedByAI: true,
      },
    } as Node;
  });

  return [...containers, ...moved];
}

/** Orientação das raias escolhida para o diagrama (vale para todas as versões). */
export type LaneOrientation = 'vertical' | 'horizontal';

/**
 * Sentido do fluxo que combina com a orientação das raias: raias verticais
 * (colunas) com fluxo de cima para baixo; raias horizontais (faixas) com
 * fluxo da esquerda para a direita — assim cabem mesmo quando os setores se
 * alternam ao longo do fluxo.
 */
export const flowDirectionFor = (orientation: LaneOrientation): 'TB' | 'LR' => (orientation === 'horizontal' ? 'LR' : 'TB');

/**
 * As raias na orientação escolhida cabem neste sentido de fluxo? Sempre no
 * sentido que combina (flowDirectionFor). No outro, só quando os setores
 * aparecem em sequência ao longo do fluxo (cada um ocupa um trecho).
 */
export function lanesFit(nodes: Node[], direction: 'TB' | 'LR' = 'TB', orientation: LaneOrientation = 'vertical'): boolean {
  if (flowDirectionFor(orientation) === direction) return true;
  const boxes = computeSectorBoxes(groupNodesByDepartment(nodes));
  return boxes.length < 2 || sectorsAreSequential(boxes, direction);
}

/** Compatibilidade: raias verticais cabem neste sentido? */
export const verticalLanesFit = (nodes: Node[], direction: 'TB' | 'LR' = 'TB') => lanesFit(nodes, direction, 'vertical');

/**
 * Setores em sequência ao longo do fluxo: uma faixa por trecho, encostadas,
 * atravessando o fluxo inteiro (horizontais no fluxo de cima para baixo;
 * verticais no da esquerda para a direita). As etapas não saem do lugar.
 */
function sequentialStripes(nodes: Node[], boxes: SectorBox[], direction: 'TB' | 'LR'): Node[] {
  const isTB = direction !== 'LR';
  // Trabalha "da esquerda para a direita": no TB troca x<->y.
  const t = (b: SectorBox) => (isTB ? { minA: b.minY, maxA: b.maxY, minC: b.minX, maxC: b.maxX } : { minA: b.minX, maxA: b.maxX, minC: b.minY, maxC: b.maxY });
  const sorted = [...boxes].sort((a, b) => t(a).minA - t(b).minA);
  const cMin = Math.min(...boxes.map((b) => t(b).minC));
  const cMax = Math.max(...boxes.map((b) => t(b).maxC));
  const cuts = sorted.slice(0, -1).map((b, i) => (t(b).maxA + t(sorted[i + 1]).minA) / 2);
  const before = isTB ? SECTOR_CONTAINER_TOP_PADDING : SECTOR_CONTAINER_SIDE_PADDING;
  const after = isTB ? SECTOR_CONTAINER_BOTTOM_PADDING : SECTOR_CONTAINER_SIDE_PADDING;
  const crossBefore = isTB ? SECTOR_CONTAINER_SIDE_PADDING : SECTOR_CONTAINER_TOP_PADDING;
  const crossAfter = isTB ? SECTOR_CONTAINER_SIDE_PADDING : SECTOR_CONTAINER_BOTTOM_PADDING;
  const containers: Node[] = sorted.map((b, idx) => {
    const a1 = idx === 0 ? t(b).minA - before : cuts[idx - 1];
    const a2 = idx === sorted.length - 1 ? t(b).maxA + after : cuts[idx];
    const c1 = cMin - crossBefore;
    const c2 = cMax + crossAfter;
    return {
      id: `sector_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'swimlane',
      position: isTB ? { x: c1, y: a1 } : { x: a1, y: c1 },
      // zIndex tem de ser propriedade de topo do nó (não de "style") para o
      // React Flow respeitar a ordem de empilhamento.
      zIndex: CONTAINER_BASE_Z_INDEX,
      style: isTB ? { width: c2 - c1, height: a2 - a1 } : { width: a2 - a1, height: c2 - c1 },
      data: {
        label: b.dept,
        orientation: isTB ? 'horizontal' : 'vertical',
        styleOverride: {},
        timing: { duration: 0, setupTime: 0, waitTime: 0, pauseTime: 0, otherExtraTime: 0, status: 'pending' },
        generatedByAI: true,
      },
    } as Node;
  });
  // Raias ficam atrás (renderizadas primeiro) dos nós do processo.
  return [...containers, ...nodes];
}

/**
 * Depois do layout automático, agrupa os nós pelo campo "department" (setor
 * preenchido pela IA) e desenha uma RAIA por setor, na orientação escolhida
 * para o diagrama (vertical por padrão; a mesma em todas as versões):
 * - fluxo no sentido que combina com a orientação (flowDirectionFor): uma
 *   faixa por setor atravessando o fluxo inteiro, cada etapa levada para a
 *   faixa do seu setor (ver arrangeLaneColumns);
 * - fluxo no outro sentido com setores em sequência: cada setor ocupa o seu
 *   trecho, em faixas encostadas (ver sequentialStripes).
 * Fluxo no outro sentido com setores alternados não comporta a orientação
 * escolhida — quem chama reorganiza no sentido certo (ver lanesFit).
 * Só entra em ação com 2+ setores distintos — um único setor não precisa de raia.
 */
export function buildSectorContainers(
  nodes: Node[],
  direction: 'TB' | 'LR' = 'TB',
  orientation: LaneOrientation = 'vertical',
): Node[] {
  const groups = groupNodesByDepartment(nodes);
  const boxes = computeSectorBoxes(groups);
  if (boxes.length < 2) return nodes;

  if (flowDirectionFor(orientation) === direction) return arrangeLaneColumns(nodes, direction);
  if (sectorsAreSequential(boxes, direction)) return sequentialStripes(nodes, boxes, direction);
  // Não comporta a orientação escolhida neste sentido: alternativa de segurança.
  return arrangeLaneColumns(nodes, direction);
}

/**
 * Reconstrói as raias/quadros GERADOS PELA IA (data.generatedByAI) para
 * acompanharem a posição atual dos nós — usado depois de qualquer
 * reorganização automática (dagre: "Organizar ↓/→", "Alinhar tudo (reto)")
 * que reposiciona os nós de processo sem saber que existem raias/quadros ao
 * redor deles. Sem isso, a raia ficava "para trás", ainda na posição de
 * quando foi gerada, enquanto os nós já tinham ido para outro lugar —
 * exatamente o "atividade fora da própria raia" visto em fluxos grandes.
 * Raias/quadros criados manualmente pelo usuário (sem essa flag) nunca são
 * tocados aqui — controle deles continua 100% manual.
 */
export function rebuildAIContainers(
  nodes: Node[],
  direction: 'TB' | 'LR' = 'TB',
  orientation: LaneOrientation = 'vertical',
): Node[] {
  const hasAIContainer = nodes.some(
    (n) => (n.type === 'swimlane' || n.type === 'frame') && (n.data as any)?.generatedByAI === true
  );
  if (!hasAIContainer) return nodes;

  const withoutOldAIContainers = nodes.filter(
    (n) => !((n.type === 'swimlane' || n.type === 'frame') && (n.data as any)?.generatedByAI === true)
  );
  return buildSectorContainers(withoutOldAIContainers, direction, orientation);
}

/** Orientação das raias geradas pela IA que já existem nestes nós (null = nenhuma). */
export function aiLaneOrientation(nodes: Node[]): LaneOrientation | null {
  const lane = nodes.find((n) => n.type === 'swimlane' && (n.data as any)?.generatedByAI === true);
  if (!lane) return null;
  return (lane.data as any)?.orientation === 'vertical' ? 'vertical' : 'horizontal';
}
