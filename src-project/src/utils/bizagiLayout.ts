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
  const a = { x: sc.x, y: bottom(S) };
  const b = { x: tc.x, y: T.y };
  const outY = a.y + 16;
  const inY = b.y - 16;
  const chX = pickChannel(ctx, Math.min(outY, inY), Math.max(outY, inY), 1, [right(S), right(T)]);
  ctx.channels.push({ x: chX, y1: Math.min(outY, inY), y2: Math.max(outY, inY) });
  return { from: 2, to: 1, pts: [a, { x: a.x, y: outY }, { x: chX, y: outY }, { x: chX, y: inY }, { x: b.x, y: inY }, b] };
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

export function computeBizagiGeometry(inputNodes: BizagiInputNode[], inputEdges: BizagiInputEdge[]): BizagiGeometry {
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
  const direction: 'TB' | 'LR' = side > down * 1.2 ? 'LR' : 'TB';
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
