/**
 * GEOMETRIA DO EXPORT PARA O BIZAGI (.bpm)
 * ----------------------------------------
 * O Bizagi desenha BPMN com formas próprias: evento de início/fim é um
 * círculo pequeno com o texto EMBAIXO, a decisão (gateway) é um losango
 * pequeno com o texto AO LADO, e só a tarefa leva o texto dentro. Antes o
 * export copiava o tamanho das formas do site (início 160×48, decisão
 * 210×110) — no Bizagi viravam elipses/losangos gigantes com o texto
 * cortando a forma, e as setas, calculadas para aquele tamanho, saíam e
 * entravam por lados errados e atravessavam outras formas.
 *
 * Aqui cada forma mantém o CENTRO que tinha no site, ganha o tamanho nativo
 * do Bizagi, e todas as setas são recalculadas do zero para essa geometria:
 * - para baixo: sai pela base e entra pelo topo (reta ou em "Z");
 * - saídas de decisão abrem a partir do vértice de baixo, e o "Z" deixa o
 *   texto do Bizagi ("Sim"/"Não", que ele põe no centro da caixa que
 *   envolve a seta) em cima do braço horizontal da própria seta;
 * - voltas para cima, setas bloqueadas e setas longas: corredor ao lado de
 *   todas as formas daquele trecho (nunca por dentro de outra forma).
 * Fluxos na horizontal (esquerda→direita) usam a mesma lógica, girada.
 *
 * Módulo puro (sem React) para ser testado isolado.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BizagiKind = 'start' | 'end' | 'gateway' | 'task';

export interface BizagiInputNode {
  id: string;
  type: string;
  /** Caixa da forma no site (qualquer origem de coordenadas). */
  box: BBox;
}

export interface BizagiInputEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface BizagiNodeGeom {
  id: string;
  kind: BizagiKind;
  box: BBox;
  /** Área do texto (TextX/TextY/TextWidth/TextHeight no XPDL). */
  labelBox: BBox;
}

export interface BizagiEdgeGeom {
  id: string;
  source: string;
  target: string;
  /** Portas do Bizagi: 1 = cima, 2 = baixo, 3 = esquerda, 4 = direita. */
  fromPort: number;
  toPort: number;
  points: Pt[];
}

export interface BizagiGeometry {
  nodes: Map<string, BizagiNodeGeom>;
  edges: BizagiEdgeGeom[];
  /** Menor caixa que contém formas, textos e setas. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  direction: 'TB' | 'LR';
}

export const BIZAGI_EVENT_SIZE = 30;
export const BIZAGI_GATEWAY_SIZE = 40;
const TASK_MIN_WIDTH = 110;
const TASK_MAX_WIDTH = 240;
const TASK_MIN_HEIGHT = 60;
const OBSTACLE_PAD = 8;
const CHANNEL_GAP = 26;
const CHANNEL_STEP = 14;

export const bizagiKind = (type: string | undefined): BizagiKind => {
  if (type === 'start') return 'start';
  if (type === 'end') return 'end';
  if (type === 'decision') return 'gateway';
  return 'task';
};

const cx = (b: BBox) => b.x + b.width / 2;
const cy = (b: BBox) => b.y + b.height / 2;
const right = (b: BBox) => b.x + b.width;
const bottom = (b: BBox) => b.y + b.height;

const boxesOverlap = (a: BBox, b: BBox, pad = 0) =>
  a.x < right(b) + pad && right(a) + pad > b.x && a.y < bottom(b) + pad && bottom(a) + pad > b.y;

/** Segmento horizontal/vertical cruza a caixa (com folga)? */
const segmentHitsBox = (a: Pt, b: Pt, box: BBox, pad: number): boolean => {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < right(box) + pad && maxX > box.x - pad && minY < bottom(box) + pad && maxY > box.y - pad;
};

const transposeBox = (b: BBox): BBox => ({ x: b.y, y: b.x, width: b.height, height: b.width });
const transposePt = (p: Pt): Pt => ({ x: p.y, y: p.x });
/** Em fluxo horizontal a rota é feita "girada": cima↔esquerda, baixo↔direita. */
const transposePort = (port: number): number => ({ 1: 3, 2: 4, 3: 1, 4: 2 } as Record<number, number>)[port] || port;

const dedupePoints = (pts: Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    const last = out[out.length - 1];
    if (last && last.x === q.x && last.y === q.y) continue;
    // remove ponto do meio de três colineares
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      if ((a.x === b.x && b.x === q.x) || (a.y === b.y && b.y === q.y)) out.pop();
    }
    out.push(q);
  }
  return out;
};

/** Tamanho nativo do Bizagi mantendo o centro que a forma tinha no site. */
const nativeBox = (kind: BizagiKind, site: BBox): BBox => {
  const c = { x: cx(site), y: cy(site) };
  let w: number;
  let h: number;
  if (kind === 'start' || kind === 'end') {
    w = h = BIZAGI_EVENT_SIZE;
  } else if (kind === 'gateway') {
    w = h = BIZAGI_GATEWAY_SIZE;
  } else {
    w = Math.min(TASK_MAX_WIDTH, Math.max(TASK_MIN_WIDTH, site.width || TASK_MIN_WIDTH));
    h = Math.max(TASK_MIN_HEIGHT, site.height || TASK_MIN_HEIGHT);
  }
  return { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h };
};

interface RouteCtx {
  boxes: Map<string, BBox>;
  channels: { x: number; y1: number; y2: number }[];
}

const pathIsClear = (pts: Pt[], ctx: RouteCtx, ignore: string[]): boolean => {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const [id, box] of ctx.boxes) {
      if (ignore.includes(id)) continue;
      if (segmentHitsBox(pts[i], pts[i + 1], box, OBSTACLE_PAD)) return false;
    }
  }
  // O primeiro/último trecho não pode voltar por dentro da própria forma
  // de origem/destino (só tocar a borda).
  const [s, t] = ignore;
  const S = ctx.boxes.get(s);
  const T = ctx.boxes.get(t);
  for (let i = 1; i < pts.length - 1; i++) {
    if (S && segmentHitsBox(pts[i], pts[i + 1], S, -1)) return false;
    if (T && segmentHitsBox(pts[i - 1], pts[i], T, -1)) return false;
  }
  return true;
};

/** Corredor livre à direita (side=1) ou à esquerda (side=-1) do trecho y1..y2. */
const pickChannel = (ctx: RouteCtx, y1: number, y2: number, side: 1 | -1, fromX: number[]): number => {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  let edge = side === 1 ? Math.max(...fromX) : Math.min(...fromX);
  for (const box of ctx.boxes.values()) {
    if (box.y - OBSTACLE_PAD <= hi && bottom(box) + OBSTACLE_PAD >= lo) {
      edge = side === 1 ? Math.max(edge, right(box)) : Math.min(edge, box.x);
    }
  }
  let x = edge + side * CHANNEL_GAP;
  // Não sobrepõe outro corredor que já use o mesmo trecho vertical.
  let guard = 0;
  while (
    ctx.channels.some((c) => Math.abs(c.x - x) < CHANNEL_STEP - 1 && c.y1 <= hi + 6 && c.y2 >= lo - 6) &&
    guard++ < 60
  ) {
    x += side * CHANNEL_STEP;
  }
  return x;
};

/**
 * O Bizagi escreve o texto da seta ("Sim"/"Não") no centro da caixa que
 * envolve a seta. Numa volta em "C" esse centro fica no meio da área
 * contornada — pode cair em cima de uma tarefa. Para setas com texto,
 * escolhe o lado da volta em que esse ponto fica livre.
 */
const labelSpotIsFree = (pts: Pt[], ctx: RouteCtx): boolean => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const spot: BBox = { x: c.x - 14, y: c.y - 8, width: 28, height: 16 };
  for (const box of ctx.boxes.values()) if (boxesOverlap(spot, box, 2)) return false;
  return true;
};

/** Rota de uma seta com o fluxo principal de cima para baixo. */
const routeTB = (
  S: BBox,
  T: BBox,
  sId: string,
  tId: string,
  ctx: RouteCtx,
  hasLabel = false,
): { from: number; to: number; pts: Pt[] } => {
  const ignore = [sId, tId];
  const sc = { x: cx(S), y: cy(S) };
  const tc = { x: cx(T), y: cy(T) };

  // 1) Destino abaixo: reta ou "Z" (sai pela base, entra pelo topo).
  if (T.y >= bottom(S) + 4) {
    const a = { x: sc.x, y: bottom(S) };
    const b = { x: tc.x, y: T.y };
    if (Math.abs(a.x - b.x) < 2) {
      const pts = [a, { x: a.x, y: b.y }];
      if (pathIsClear(pts, ctx, ignore)) return { from: 2, to: 1, pts };
    }
    // Deslocamento pequeno (alguns px) entre as colunas: em vez de um
    // "degrauzinho", a seta desce reta — entrando/saindo um pouco fora do
    // centro da forma mais larga (tarefa), sempre dentro da borda dela.
    if (Math.abs(a.x - b.x) < 30) {
      if (a.x > T.x + 12 && a.x < right(T) - 12) {
        const pts = [a, { x: a.x, y: T.y }];
        if (pathIsClear(pts, ctx, ignore)) return { from: 2, to: 1, pts };
      }
      if (b.x > S.x + 12 && b.x < right(S) - 12) {
        const pts = [{ x: b.x, y: bottom(S) }, b];
        if (pathIsClear(pts, ctx, ignore)) return { from: 2, to: 1, pts };
      }
    }
    const mids = [Math.round((a.y + b.y) / 2), a.y + 16, b.y - 16];
    for (const my of mids) {
      const pts = [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
      if (pathIsClear(pts, ctx, ignore)) return { from: 2, to: 1, pts };
    }
  }

  // 2) Mesma faixa (lado a lado): sai pela lateral, entra pela lateral oposta.
  const sameRow = Math.abs(sc.y - tc.y) < Math.max(S.height, T.height) / 2;
  if (sameRow && (T.x >= right(S) + 4 || right(T) <= S.x - 4)) {
    const toRight = T.x >= right(S);
    const a = { x: toRight ? right(S) : S.x, y: sc.y };
    const b = { x: toRight ? T.x : right(T), y: tc.y };
    const mx = (a.x + b.x) / 2;
    const pts = Math.abs(a.y - b.y) < 2 ? [a, { x: b.x, y: a.y }] : [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
    if (pathIsClear(pts, ctx, ignore)) return { from: toRight ? 4 : 3, to: toRight ? 3 : 4, pts };
  }

  // 3) Voltas para cima, setas longas ou bloqueadas: corredor lateral, por
  // fora de todas as formas daquele trecho. Tenta o lado mais próximo do
  // destino primeiro; se a saída/entrada lateral estiver bloqueada, o outro.
  const sides: (1 | -1)[] = tc.x < sc.x - 40 ? [-1, 1] : [1, -1];
  const options: { side: 1 | -1; chX: number; pts: Pt[] }[] = [];
  for (const side of sides) {
    const a = { x: side === 1 ? right(S) : S.x, y: sc.y };
    const b = { x: side === 1 ? right(T) : T.x, y: tc.y };
    const chX = pickChannel(ctx, a.y, b.y, side, [a.x, b.x]);
    const pts = [a, { x: chX, y: a.y }, { x: chX, y: b.y }, b];
    if (pathIsClear(pts, ctx, ignore)) options.push({ side, chX, pts });
  }
  if (options.length) {
    const best = (hasLabel && options.find((o) => labelSpotIsFree(o.pts, ctx))) || options[0];
    ctx.channels.push({ x: best.chX, y1: Math.min(best.pts[0].y, best.pts[3].y), y2: Math.max(best.pts[0].y, best.pts[3].y) });
    const port = best.side === 1 ? 4 : 3;
    return { from: port, to: port, pts: best.pts };
  }

  // 4) Último recurso: sai por baixo, contorna por fora e entra por cima.
  // Se o trecho horizontal de saída/entrada bater numa forma, ele desce/sobe
  // até passar livre (dos dois lados, direita primeiro).
  const a = { x: sc.x, y: bottom(S) };
  const b = { x: tc.x, y: T.y };
  const build = (side: 1 | -1, outY: number, inY: number) => {
    const chX = pickChannel(ctx, Math.min(outY, inY), Math.max(outY, inY), side, side === 1 ? [right(S), right(T)] : [S.x, T.x]);
    return { chX, outY, inY, pts: [a, { x: a.x, y: outY }, { x: chX, y: outY }, { x: chX, y: inY }, { x: b.x, y: inY }, b] };
  };
  let first: ReturnType<typeof build> | null = null;
  for (const side of [1, -1] as (1 | -1)[]) {
    let outY = a.y + 16;
    let inY = b.y - 16;
    for (let k = 0; k < 10; k++) {
      const r = build(side, outY, inY);
      if (!first) first = r;
      if (pathIsClear(r.pts, ctx, ignore)) {
        ctx.channels.push({ x: r.chX, y1: Math.min(r.outY, r.inY), y2: Math.max(r.outY, r.inY) });
        return { from: 2, to: 1, pts: r.pts };
      }
      let moved = false;
      for (const [id, box] of ctx.boxes) {
        if (ignore.includes(id)) continue;
        if (segmentHitsBox({ x: a.x, y: outY }, { x: r.chX, y: outY }, box, OBSTACLE_PAD) && bottom(box) + 16 > outY) { outY = bottom(box) + 16; moved = true; }
        if (segmentHitsBox({ x: r.chX, y: inY }, { x: b.x, y: inY }, box, OBSTACLE_PAD) && box.y - 16 < inY) { inY = box.y - 16; moved = true; }
      }
      if (!moved) break;
    }
  }
  const r = first!;
  ctx.channels.push({ x: r.chX, y1: Math.min(r.outY, r.inY), y2: Math.max(r.outY, r.inY) });
  return { from: 2, to: 1, pts: r.pts };
};

/** Área do texto: dentro na tarefa; embaixo no evento; ao lado na decisão. */
const placeLabel = (
  node: { id: string; kind: BizagiKind; box: BBox },
  allBoxes: Map<string, BBox>,
  segments: [Pt, Pt][],
): BBox => {
  const b = node.box;
  if (node.kind === 'task') return { ...b };

  const W = 130;
  const H = node.kind === 'gateway' ? 44 : 30;
  const candidates: BBox[] =
    node.kind === 'gateway'
      ? [
          { x: b.x - W - 6, y: cy(b) - H / 2, width: W, height: H }, // esquerda
          { x: right(b) + 6, y: cy(b) - H / 2, width: W, height: H }, // direita
          { x: cx(b) - W - 4, y: b.y - H - 2, width: W, height: H }, // em cima, à esquerda da seta de entrada
          { x: cx(b) + 4, y: b.y - H - 2, width: W, height: H }, // em cima, à direita
          { x: cx(b) - W / 2, y: bottom(b) + 4, width: W, height: H }, // embaixo
        ]
      : [
          { x: cx(b) - W / 2, y: bottom(b) + 4, width: W, height: H }, // embaixo (padrão BPMN)
          { x: right(b) + 6, y: cy(b) - H / 2, width: W, height: H },
          { x: b.x - W - 6, y: cy(b) - H / 2, width: W, height: H },
          { x: cx(b) - W / 2, y: b.y - H - 4, width: W, height: H },
        ];

  const free = (c: BBox) => {
    for (const [id, box] of allBoxes) {
      if (id !== node.id && boxesOverlap(c, box, 2)) return false;
    }
    return !segments.some(([p, q]) => segmentHitsBox(p, q, c, 1));
  };
  return candidates.find(free) || candidates[0];
};

export function computeBizagiGeometry(
  inputNodes: BizagiInputNode[],
  inputEdges: BizagiInputEdge[],
  /** Usa esta direção em vez de detectar (ex.: depois de reorganizar as formas). */
  forceDirection?: 'TB' | 'LR',
): BizagiGeometry {
  const kinds = new Map<string, BizagiKind>();
  const realBoxes = new Map<string, BBox>();
  inputNodes.forEach((n) => {
    const kind = bizagiKind(n.type);
    kinds.set(n.id, kind);
    realBoxes.set(n.id, nativeBox(kind, n.box));
  });

  const validEdges = inputEdges.filter((e) => realBoxes.has(e.source) && realBoxes.has(e.target) && e.source !== e.target);

  // Direção principal: o fluxo anda mais na vertical (TB) ou na horizontal
  // (LR)? Soma dos deslocamentos — contar setas errava com poucas setas
  // diagonais (ex.: ramos de decisão bem abertos num fluxo vertical).
  let down = 0;
  let side = 0;
  validEdges.forEach((e) => {
    const s = realBoxes.get(e.source)!;
    const t = realBoxes.get(e.target)!;
    side += Math.abs(cx(t) - cx(s));
    down += Math.abs(cy(t) - cy(s));
  });
  const direction: 'TB' | 'LR' = forceDirection || (side > down * 1.2 ? 'LR' : 'TB');
  const flip = direction === 'LR';

  // Roteia no espaço "de cima para baixo" (girando o fluxo horizontal).
  const routeBoxes = new Map<string, BBox>();
  realBoxes.forEach((b, id) => routeBoxes.set(id, flip ? transposeBox(b) : b));
  const ctx: RouteCtx = { boxes: routeBoxes, channels: [] };

  // Setas "para frente" primeiro (ficam com os caminhos mais diretos), depois
  // as voltas, que usam corredores.
  const ordered = [...validEdges].sort((a, b) => {
    const fa = cy(routeBoxes.get(a.target)!) > cy(routeBoxes.get(a.source)!) ? 0 : 1;
    const fb = cy(routeBoxes.get(b.target)!) > cy(routeBoxes.get(b.source)!) ? 0 : 1;
    return fa - fb;
  });

  const routed = new Map<string, BizagiEdgeGeom>();
  ordered.forEach((e) => {
    const r = routeTB(routeBoxes.get(e.source)!, routeBoxes.get(e.target)!, e.source, e.target, ctx, !!e.label);
    const pts = dedupePoints(flip ? r.pts.map(transposePt) : r.pts);
    routed.set(e.id, {
      id: e.id,
      source: e.source,
      target: e.target,
      fromPort: flip ? transposePort(r.from) : r.from,
      toPort: flip ? transposePort(r.to) : r.to,
      points: pts,
    });
  });
  const edges = validEdges.map((e) => routed.get(e.id)!);

  const segments: [Pt, Pt][] = [];
  edges.forEach((e) => {
    for (let i = 0; i < e.points.length - 1; i++) segments.push([e.points[i], e.points[i + 1]]);
  });

  const nodes = new Map<string, BizagiNodeGeom>();
  inputNodes.forEach((n) => {
    const kind = kinds.get(n.id)!;
    const box = realBoxes.get(n.id)!;
    nodes.set(n.id, { id: n.id, kind, box, labelBox: placeLabel({ id: n.id, kind, box }, realBoxes, segments) });
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  nodes.forEach((n) => {
    grow(n.box.x, n.box.y);
    grow(right(n.box), bottom(n.box));
    grow(n.labelBox.x, n.labelBox.y);
    grow(right(n.labelBox), bottom(n.labelBox));
  });
  edges.forEach((e) => e.points.forEach((p) => grow(p.x, p.y)));
  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = 700;
    maxY = 350;
  }

  return { nodes, edges, bounds: { minX, minY, maxX, maxY }, direction };
}

/* ------------------------------------------------------------------ */
/* Raias (lanes) do Bizagi                                              */
/* ------------------------------------------------------------------ */

export interface BizagiLane {
  name: string;
  /** Setores da faixa (mais de um = setores lado a lado juntados numa faixa só). */
  sectors: string[];
  /** Faixa vertical da raia (coordenadas da geometria, antes do deslocamento da pool). */
  y1: number;
  y2: number;
  nodeIds: string[];
}

/**
 * Separa o fluxo em raias horizontais (uma faixa por setor, na ordem em que
 * os setores aparecem de cima para baixo) — o jeito que o Bizagi mostra
 * responsabilidade por setor. O setor de cada forma vem do campo
 * "department" da etapa ou da raia/quadro do site em que ela está.
 *
 * Raias não podem se sobrepor: se dois setores dividem a mesma altura
 * (formas lado a lado de setores diferentes), a faixa leva os dois nomes
 * ("A / B"), como o site mostra. Quando isso vem de quadros/raias de setores
 * diferentes lado a lado, o export (generateBizagiBpm) reorganiza com
 * stackSectorsIntoLanes, uma raia por setor. O mesmo setor pode aparecer em
 * mais de uma faixa quando o fluxo volta a ele mais adiante.
 *
 * Com menos de 2 setores, ou sem 2 faixas separadas na altura, devolve [].
 */
export function computeBizagiLanes(geom: BizagiGeometry, deptById: Map<string, string>): BizagiLane[] {
  // Raias são faixas horizontais. De cima para baixo: setores em sequência.
  // Da esquerda para a direita (inclusive raias verticais do site, giradas
  // na exportação): setores em faixas de altura — se se misturarem na
  // altura, viram uma faixa só e, sobrando só uma, nenhuma raia.
  const distinct = new Set([...deptById.values()].map((d) => d.trim()).filter(Boolean));
  if (distinct.size < 2) return [];

  const items = [...geom.nodes.values()]
    .map((n) => {
      const top = Math.min(n.box.y, n.labelBox.y);
      const bot = Math.max(n.box.y + n.box.height, n.labelBox.y + n.labelBox.height);
      return { id: n.id, dept: (deptById.get(n.id) || '').trim(), cy: n.box.y + n.box.height / 2, top, bot };
    })
    .sort((a, b) => a.cy - b.cy);

  // Forma sem setor acompanha a faixa em que está (ou a primeira com setor).
  const firstDept = items.find((i) => i.dept)?.dept || '';
  type Band = { names: string[]; top: number; bot: number; ids: string[] };
  const bands: Band[] = [];
  for (const it of items) {
    const last = bands[bands.length - 1];
    const dept = it.dept || (last ? last.names[last.names.length - 1] : firstDept);
    if (last && last.names.includes(dept)) {
      last.top = Math.min(last.top, it.top);
      last.bot = Math.max(last.bot, it.bot);
      last.ids.push(it.id);
    } else {
      bands.push({ names: [dept], top: it.top, bot: it.bot, ids: [it.id] });
    }
  }

  // Faixas que se sobrepõem na altura viram uma só (nomes juntos).
  const GAP = 12;
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i];
      const b = bands[i + 1];
      if (a.bot + GAP > b.top) {
        b.names.forEach((n) => { if (!a.names.includes(n)) a.names.push(n); });
        a.top = Math.min(a.top, b.top);
        a.bot = Math.max(a.bot, b.bot);
        a.ids.push(...b.ids);
        bands.splice(i + 1, 1);
        merged = true;
        break;
      }
    }
    // Duas faixas seguidas com os mesmos nomes (após juntar) viram uma.
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i];
      const b = bands[i + 1];
      if (a.names.length === b.names.length && a.names.every((n) => b.names.includes(n))) {
        a.bot = Math.max(a.bot, b.bot);
        a.ids.push(...b.ids);
        bands.splice(i + 1, 1);
        merged = true;
        break;
      }
    }
  }
  if (bands.length < 2) return [];

  return bandsToLanes(geom, bands);
}

/**
 * Divisas no espaço livre entre uma faixa e a próxima — de preferência no
 * meio, mas nunca em cima de um trecho horizontal de seta (a divisa e a
 * seta se confundiriam). A primeira e a última vão até as bordas.
 */
type LaneBand = { names: string[]; top: number; bot: number; ids: string[] };

function bandsToLanes(geom: BizagiGeometry, bands: LaneBand[]): BizagiLane[] {
  const horizontalYs: number[] = [];
  geom.edges.forEach((e) => {
    for (let i = 0; i < e.points.length - 1; i++) {
      if (e.points[i].y === e.points[i + 1].y) horizontalYs.push(e.points[i].y);
    }
  });
  const clear = (y: number) => horizontalYs.every((hy) => Math.abs(hy - y) > 14);
  const divider = (upper: LaneBand, lower: LaneBand): number => {
    const lo = upper.bot;
    const hi = lower.top;
    const mid = (lo + hi) / 2;
    const candidates = [mid];
    for (let k = 4; k < (hi - lo) / 2; k += 4) candidates.push(mid - k, mid + k);
    // Entre as posições livres, a mais perto do meio que fique a 30px das
    // setas (ou a mais afastada delas, se nenhuma chegar a 30px) — longe da
    // seta a divisa não se confunde com ela, e as raias não ficam desiguais.
    const near = (y: number) =>
      Math.min(30, horizontalYs.filter((hy) => hy >= lo - 20 && hy <= hi + 20).reduce((m, hy) => Math.min(m, Math.abs(hy - y)), Infinity));
    let best: number | undefined;
    for (const c of candidates) if (clear(c) && (best === undefined || near(c) > near(best) + 0.5)) best = c;
    return Math.round(best ?? mid);
  };
  const dividers = bands.slice(0, -1).map((b, i) => divider(b, bands[i + 1]));
  const PAD = 30;
  return bands.map((b, i) => ({
    name: b.names.filter(Boolean).join(' / ') || 'Processo',
    sectors: b.names.filter(Boolean),
    y1: i === 0 ? geom.bounds.minY - PAD : dividers[i - 1],
    y2: i === bands.length - 1 ? geom.bounds.maxY + PAD : dividers[i],
    nodeIds: b.ids,
  }));
}

/* ------------------------------------------------------------------ */
/* Setores lado a lado: uma raia por setor                              */
/* ------------------------------------------------------------------ */

export interface SectorStackNode {
  id: string;
  /** Tipo da forma no site ('start', 'process'…), para achar os inícios. */
  type?: string;
  /** Caixa da forma no site. */
  box: BBox;
  /** Setor da forma ('' = sem setor). */
  sector: string;
  /**
   * Raia/quadro do site que é o bloco da forma: o MAIOR contêiner com o
   * mesmo nome do setor que contém a forma (quadro "A" dentro da raia "A"
   * vira um bloco só). Ausente = forma fora de quadro do seu setor.
   */
  holderId?: string;
}

export interface SectorStackContainer {
  id: string;
  label: string;
  box: BBox;
}

export interface SectorStack {
  /** Nova caixa de cada forma (mesmo sistema de coordenadas do site). */
  boxes: Map<string, BBox>;
  /** Raias na ordem, de cima para baixo: um setor por raia. */
  groups: { name: string; nodeIds: string[] }[];
  /** Direção do fluxo usada (a das setas dentro dos blocos), para as setas. */
  direction: 'TB' | 'LR';
}

/** Nome de setor comparável: sem diferença de maiúsculas e espaços. */
export const sectorKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const STACK_LANE_GAP = 110; // espaço entre o conteúdo de uma raia e o da próxima
const STACK_BLOCK_GAP = 70; // espaço entre dois blocos lado a lado
const BLOCK_PAD = 40; // folga em volta do conteúdo de cada bloco
const ATTACH_DIST = 260; // forma solta até esta distância de um bloco do setor entra nele

const boxGap = (a: BBox, b: BBox) =>
  Math.hypot(Math.max(0, a.x - right(b), b.x - right(a)), Math.max(0, a.y - bottom(b), b.y - bottom(a)));

/**
 * Quando os setores ficam LADO A LADO no site (quadros/raias em colunas ou em
 * grade), faixas horizontais por altura juntariam setores diferentes numa
 * raia só ("A / B / C") e as formas cairiam na raia de outro setor. O Bizagi
 * só tem raias horizontais, então aqui cada setor ganha a SUA raia.
 *
 * - Bloco = conteúdo de um quadro do site (sem a área vazia em volta), movido
 *   inteiro: a disposição das formas dentro dele não muda.
 * - Forma do setor fora de quadro entra no bloco do setor mais próximo (até
 *   ATTACH_DIST); senão forma um bloco próprio. Forma sem setor e sem
 *   ligação (título, nota) acompanha o bloco mais próximo de qualquer setor;
 *   sem setor mas ligada, vai para o setor da forma ligada mais próxima.
 * - Ordem das raias: a camada mais cedo em que o fluxo chega ao setor, pelo
 *   caminho mais longo a partir dos inícios (uma seta de atalho não puxa um
 *   setor do fim para o começo).
 * - Direção: a das setas DENTRO dos blocos (que o empilhamento não muda);
 *   as setas entre quadros lado a lado puxariam para "esquerda para a
 *   direita" um fluxo que, em cada quadro, desce. Sem setas dentro de
 *   blocos, vale `fallbackDirection` (a do desenho original).
 * - De cima para baixo: raias empilhadas, blocos do setor lado a lado na
 *   ordem do fluxo. Da esquerda para a direita: cada bloco começa depois do
 *   anterior no fluxo (em escada), para as setas seguirem para a frente.
 *
 * Só reposiciona; as setas são recalculadas depois por computeBizagiGeometry.
 */
export function stackSectorsIntoLanes(
  nodes: SectorStackNode[],
  containers: SectorStackContainer[],
  edges: { source: string; target: string }[],
  fallbackDirection: 'TB' | 'LR' = 'TB',
): SectorStack {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const valid = edges.filter((e) => byId.has(e.source) && byId.has(e.target) && e.source !== e.target);
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  valid.forEach((e) => {
    (out.get(e.source) || out.set(e.source, []).get(e.source)!).push(e.target);
    (inc.get(e.target) || inc.set(e.target, []).get(e.target)!).push(e.source);
  });
  const linked = (id: string) => (out.get(id) || []).length + (inc.get(id) || []).length > 0;

  // Nomes: chave comparável → nome exibido (o primeiro que aparece).
  const display = new Map<string, string>();
  const keyOf = (name: string) => { const k = sectorKey(name); if (k && !display.has(k)) display.set(k, name.trim().replace(/\s+/g, ' ')); return k; };

  // 1) Setor de cada forma. Sem setor e ligada → setor da forma ligada mais
  // próxima (busca em largura, quem vem antes no fluxo primeiro). Sem setor e
  // sem ligação → decidida no passo 2, pela posição.
  const sectorOf = new Map<string, string>();
  nodes.forEach((n) => { const k = keyOf(n.sector || ''); if (k) sectorOf.set(n.id, k); });
  const floating: SectorStackNode[] = [];
  nodes.forEach((n) => {
    if (sectorOf.has(n.id)) return;
    if (!linked(n.id)) { floating.push(n); return; }
    const seen = new Set([n.id]);
    let frontier = [n.id];
    let found = '';
    while (frontier.length && !found) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const nb of [...(inc.get(id) || []), ...(out.get(id) || [])]) {
          if (seen.has(nb)) continue;
          seen.add(nb);
          const k = sectorOf.get(nb) || keyOf(byId.get(nb)!.sector || '');
          if (k) { found = k; break; }
          next.push(nb);
        }
        if (found) break;
      }
      frontier = next;
    }
    if (found) sectorOf.set(n.id, found);
    else floating.push(n);
  });

  // 2) Blocos: o conteúdo de cada quadro do seu setor; formas soltas entram
  // no bloco do setor mais próximo ou abrem um bloco próprio.
  const containerById = new Map(containers.map((c) => [c.id, c]));
  type Block = { sector: string; box: BBox; ids: string[] };
  const blocks: Block[] = [];
  const blockOfContainer = new Map<string, Block>();
  const union = (a: BBox, b: BBox): BBox => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, width: Math.max(right(a), right(b)) - x, height: Math.max(bottom(a), bottom(b)) - y };
  };
  const add = (bl: Block, n: SectorStackNode) => { bl.ids.push(n.id); bl.box = bl.ids.length === 1 ? { ...n.box } : union(bl.box, n.box); };
  const loose: SectorStackNode[] = [];
  nodes.forEach((n) => {
    const sector = sectorOf.get(n.id);
    if (!sector) return;
    const holder = n.holderId ? containerById.get(n.holderId) : undefined;
    if (holder && sectorKey(holder.label) === sector) {
      let bl = blockOfContainer.get(holder.id);
      if (!bl) { bl = { sector, box: { ...n.box }, ids: [] }; blockOfContainer.set(holder.id, bl); blocks.push(bl); }
      add(bl, n);
    } else loose.push(n);
  });
  loose.forEach((n) => {
    const sector = sectorOf.get(n.id)!;
    const nbs = new Set([...(out.get(n.id) || []), ...(inc.get(n.id) || [])]);
    let best: Block | undefined;
    let bestD = Infinity;
    blocks.forEach((bl) => {
      if (bl.sector !== sector) return;
      // Ligada a uma forma do bloco: entra nele mesmo um pouco mais longe
      // (o fim logo abaixo do quadro continua embaixo, não vai para o lado).
      const limit = bl.ids.some((id) => nbs.has(id)) ? 3 * ATTACH_DIST : ATTACH_DIST;
      const d = boxGap(bl.box, n.box);
      if (d <= limit && d < bestD) { bestD = d; best = bl; }
    });
    if (!best) { best = { sector, box: { ...n.box }, ids: [] }; blocks.push(best); }
    add(best, n);
  });
  floating.forEach((n) => {
    let best: Block | undefined;
    let bestD = Infinity;
    blocks.forEach((bl) => { const d = boxGap(bl.box, n.box); if (d < bestD) { bestD = d; best = bl; } });
    if (!best) {
      const k = keyOf('Processo');
      best = { sector: k, box: { ...n.box }, ids: [] };
      blocks.push(best);
    }
    sectorOf.set(n.id, best.sector);
    add(best, n);
  });
  blocks.forEach((bl) => { bl.box = { x: bl.box.x - BLOCK_PAD, y: bl.box.y - BLOCK_PAD, width: bl.box.width + 2 * BLOCK_PAD, height: bl.box.height + 2 * BLOCK_PAD }; });

  // 3) Camadas pelo caminho mais longo a partir dos inícios (setas de volta,
  // achadas numa busca em profundidade, não contam).
  const startIds = nodes.filter((n) => n.type === 'start' && linked(n.id)).map((n) => n.id);
  const roots = startIds.length ? startIds : nodes.filter((n) => !(inc.get(n.id) || []).length && (out.get(n.id) || []).length).map((n) => n.id);
  const state = new Map<string, number>(); // 1 = na pilha, 2 = visto
  const back = new Set<string>();
  const order: string[] = [];
  const dfs = (root: string) => {
    const stack: [string, number][] = [[root, 0]];
    state.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const nexts = out.get(top[0]) || [];
      if (top[1] < nexts.length) {
        const t = nexts[top[1]++];
        const st = state.get(t);
        if (st === 1) back.add(`${top[0]}>${t}`);
        else if (!st) { state.set(t, 1); stack.push([t, 0]); }
      } else {
        state.set(top[0], 2);
        order.push(top[0]);
        stack.pop();
      }
    }
  };
  roots.forEach((r) => { if (!state.has(r)) dfs(r); });
  const reached = new Set(state.keys());
  nodes.forEach((n) => { if (!state.has(n.id) && linked(n.id)) dfs(n.id); });
  const layer = new Map<string, number>();
  order.reverse().forEach((id) => {
    if (!layer.has(id)) layer.set(id, 0);
    const l = layer.get(id)!;
    (out.get(id) || []).forEach((t) => { if (!back.has(`${id}>${t}`)) layer.set(t, Math.max(layer.get(t) ?? 0, l + 1)); });
  });
  // Formas que o fluxo não alcança a partir dos inícios (anotação com seta,
  // por exemplo) não decidem a ordem, a não ser que o bloco só tenha delas.
  const blockRank = (bl: Block) => {
    const ids = bl.ids.filter((id) => reached.has(id));
    return Math.min(...(ids.length ? ids : bl.ids).map((id) => layer.get(id) ?? Infinity));
  };

  const sectorInfo = new Map<string, { rank: number; x: number; y: number }>();
  blocks.forEach((bl) => {
    const r = blockRank(bl);
    const cur = sectorInfo.get(bl.sector);
    if (!cur) sectorInfo.set(bl.sector, { rank: r, x: bl.box.x, y: bl.box.y });
    else sectorInfo.set(bl.sector, { rank: Math.min(cur.rank, r), x: Math.min(cur.x, bl.box.x), y: Math.min(cur.y, bl.box.y) });
  });
  const sectors = [...sectorInfo.entries()]
    .sort((a, b) => a[1].rank - b[1].rank || a[1].x - b[1].x || a[1].y - b[1].y)
    .map(([k]) => k);
  const byFlow = (a: Block, b: Block) => blockRank(a) - blockRank(b) || a.box.x - b.box.x || a.box.y - b.box.y;

  // Direção: mesma regra de computeBizagiGeometry, só com as setas dentro
  // de um bloco.
  const blockOf = new Map<string, Block>();
  blocks.forEach((bl) => bl.ids.forEach((id) => blockOf.set(id, bl)));
  let down = 0;
  let side = 0;
  valid.forEach((e) => {
    if (blockOf.get(e.source) !== blockOf.get(e.target)) return;
    const a = byId.get(e.source)!.box;
    const b = byId.get(e.target)!.box;
    side += Math.abs(b.x + b.width / 2 - (a.x + a.width / 2));
    down += Math.abs(b.y + b.height / 2 - (a.y + a.height / 2));
  });
  const direction: 'TB' | 'LR' = side + down === 0 ? fallbackDirection : side > down * 1.2 ? 'LR' : 'TB';

  // 4) Posiciona.
  const slot = new Map<Block, { x: number; y: number }>();
  const laneTop = new Map<string, number>();
  let top = 0;
  sectors.forEach((sector) => {
    laneTop.set(sector, top);
    top += Math.max(...blocks.filter((b) => b.sector === sector).map((b) => b.box.height)) + STACK_LANE_GAP;
  });
  if (direction === 'LR') {
    let x = 0;
    [...blocks].sort(byFlow).forEach((bl) => { slot.set(bl, { x, y: laneTop.get(bl.sector)! }); x += bl.box.width + STACK_BLOCK_GAP; });
  } else {
    sectors.forEach((sector) => {
      let x = 0;
      blocks.filter((b) => b.sector === sector).sort(byFlow).forEach((bl) => { slot.set(bl, { x, y: laneTop.get(sector)! }); x += bl.box.width + STACK_BLOCK_GAP; });
    });
  }
  const boxes = new Map<string, BBox>();
  blocks.forEach((bl) => {
    const s0 = slot.get(bl)!;
    bl.ids.forEach((id) => {
      const nb = byId.get(id)!.box;
      boxes.set(id, { x: s0.x + nb.x - bl.box.x, y: s0.y + nb.y - bl.box.y, width: nb.width, height: nb.height });
    });
  });
  const groups = sectors.map((sector) => ({
    name: display.get(sector) || sector,
    nodeIds: blocks.filter((b) => b.sector === sector).sort(byFlow).flatMap((b) => b.ids),
  }));
  return { boxes, groups, direction };
}

/** Raias a partir de grupos já definidos (um setor por grupo, na ordem). */
export function computeLanesFromGroups(geom: BizagiGeometry, groups: { name: string; nodeIds: string[] }[]): BizagiLane[] {
  const bands = groups
    .map((g) => {
      let top = Infinity;
      let bot = -Infinity;
      g.nodeIds.forEach((id) => {
        const n = geom.nodes.get(id);
        if (!n) return;
        top = Math.min(top, n.box.y, n.labelBox.y);
        bot = Math.max(bot, n.box.y + n.box.height, n.labelBox.y + n.labelBox.height);
      });
      return { names: [g.name], top, bot, ids: g.nodeIds.filter((id) => geom.nodes.has(id)) };
    })
    .filter((b) => b.ids.length);
  return bands.length ? bandsToLanes(geom, bands) : [];
}
