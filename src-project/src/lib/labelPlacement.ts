/**
 * POSICIONAMENTO DA ETIQUETA DA LINHA
 * -----------------------------------
 * O texto da seta nasce no meio do caminho. Nessa posição ele pode cair em
 * cima do selo de tempo (que fica logo abaixo de cada forma) ou da própria
 * forma, escondendo informação.
 *
 * A regra aqui é simples: a etiqueta continua presa à sua linha. Quando o meio
 * está ocupado, ela desliza ao longo do próprio caminho até achar um trecho
 * livre; se o caminho inteiro estiver ocupado (linhas muito curtas entre
 * formas coladas), ela se afasta perpendicularmente à linha, para o lado que
 * estiver livre.
 *
 * Módulo puro (sem React) de propósito: o comportamento é testado isolado.
 */

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export const BADGE_HEIGHT = 22;
export const BADGE_GAP = 2;
export const BADGE_WIDTH = 150;
export const NODE_MARGIN = 4;

type Dims = { width: number; height: number };

/** Formas e selos de tempo que a etiqueta precisa evitar. */
export const collectLabelObstacles = (
  nodes: any[],
  getDims: (type?: string) => Dims,
): Rect[] => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const byId = new Map<string, any>();
  for (const n of nodes) byId.set(n.id, n);

  const obstacles: Rect[] = [];
  for (const node of nodes) {
    if (!node || !node.position) continue;
    // Raias e quadros são fundos: a etiqueta pode ficar sobre eles
    if (node.type === 'swimlane' || node.type === 'frame') continue;

    const dims = getDims(node.type);
    const w = Number(node.measured?.width || node.width || node.style?.width || dims.width);
    const h = Number(node.measured?.height || node.height || node.style?.height || dims.height);

    // Forma dentro de raia/quadro: a posição é relativa ao pai
    let x = node.position.x || 0;
    let y = node.position.y || 0;
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) {
      x += parent.position?.x || 0;
      y += parent.position?.y || 0;
    }

    // Corpo da forma
    obstacles.push({
      left: x - NODE_MARGIN,
      right: x + w + NODE_MARGIN,
      top: y - NODE_MARGIN,
      bottom: y + h + NODE_MARGIN,
    });

    // Selo de tempo, logo abaixo da forma
    if (node.data?.showTimingMode) {
      const cx = x + w / 2;
      const top = y + h + BADGE_GAP;
      obstacles.push({
        left: cx - BADGE_WIDTH / 2,
        right: cx + BADGE_WIDTH / 2,
        top,
        bottom: top + BADGE_HEIGHT,
      });
    }
  }
  return obstacles;
};

const boxAt = (x: number, y: number, width: number, height: number): Rect => ({
  left: x - width / 2,
  right: x + width / 2,
  top: y - height / 2,
  bottom: y + height / 2,
});

const intersects = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const overlapArea = (a: Rect, b: Rect): number => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

const totalOverlap = (box: Rect, obstacles: Rect[]): number =>
  obstacles.reduce((sum, o) => sum + overlapArea(box, o), 0);

const isFree = (x: number, y: number, w: number, h: number, obstacles: Rect[]): boolean => {
  const box = boxAt(x, y, w, h);
  return !obstacles.some((o) => intersects(box, o));
};

/** Ponto a uma fração do comprimento total da polilinha. */
export const pointAtFraction = (polyline: Point[], t: number): Point | null => {
  const pts = (polyline || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) return null;
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };

  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segs.push(len);
    total += len;
  }
  if (total === 0) return { x: pts[0].x, y: pts[0].y };

  const target = Math.min(Math.max(t, 0), 1) * total;
  let walked = 0;
  for (let i = 0; i < segs.length; i++) {
    if (walked + segs[i] >= target || i === segs.length - 1) {
      const local = segs[i] === 0 ? 0 : (target - walked) / segs[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * local,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * local,
      };
    }
    walked += segs[i];
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
};

/** Direção perpendicular ao trecho onde a etiqueta está. */
const perpendicularAt = (polyline: Point[], t: number): Point => {
  const a = pointAtFraction(polyline, Math.max(0, t - 0.05));
  const b = pointAtFraction(polyline, Math.min(1, t + 0.05));
  if (!a || !b) return { x: 0, y: -1 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
};

export interface PlaceOptions {
  polyline: Point[];
  x: number;
  y: number;
  width: number;
  height: number;
  obstacles: Rect[];
}

/**
 * Devolve onde desenhar a etiqueta: o meio da linha quando está livre, senão
 * o ponto livre mais próximo ao longo do caminho, senão um afastamento lateral.
 */
export const placeEdgeLabel = ({
  polyline,
  x,
  y,
  width,
  height,
  obstacles,
}: PlaceOptions): { x: number; y: number } => {
  if (!obstacles || obstacles.length === 0) return { x, y };
  if (isFree(x, y, width, height, obstacles)) return { x, y };

  const pts = (polyline || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  let best = { x, y, score: totalOverlap(boxAt(x, y, width, height), obstacles) };

  // 1. Desliza ao longo da própria linha, saindo do meio para os dois lados
  if (pts.length >= 2) {
    for (let step = 1; step <= 9; step++) {
      const delta = step * 0.05;
      for (const t of [0.5 - delta, 0.5 + delta]) {
        if (t < 0.06 || t > 0.94) continue;
        const p = pointAtFraction(pts, t);
        if (!p) continue;
        if (isFree(p.x, p.y, width, height, obstacles)) return { x: p.x, y: p.y };
        const score = totalOverlap(boxAt(p.x, p.y, width, height), obstacles);
        if (score < best.score) best = { x: p.x, y: p.y, score };
      }
    }
  }

  // 2. Linha curta ou caminho todo ocupado: afasta perpendicular à linha
  const normal = pts.length >= 2 ? perpendicularAt(pts, 0.5) : { x: 0, y: -1 };
  // Distâncias crescentes: começa encostada na linha e só se afasta mais quando
  // as formas ao redor não deixam espaço (linhas curtas entre formas coladas).
  for (const distance of [height + 6, height + 20, height + 34, height + 50, 90, 130, 170, 220]) {
    for (const side of [1, -1]) {
      const px = x + normal.x * distance * side;
      const py = y + normal.y * distance * side;
      if (isFree(px, py, width, height, obstacles)) return { x: px, y: py };
      const score = totalOverlap(boxAt(px, py, width, height), obstacles);
      if (score < best.score) best = { x: px, y: py, score };
    }
  }

  // 3. Nada totalmente livre: fica onde sobrepõe menos
  return { x: best.x, y: best.y };
};

/** Inverso de pointAtFraction: projeta um ponto na linha e devolve a fração (0..1). */
export const fractionOfPoint = (polyline: Point[], p: Point): number => {
  if (!Array.isArray(polyline) || polyline.length < 2) return 0.5;
  let total = 0;
  const lens: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const l = Math.hypot(polyline[i + 1].x - polyline[i].x, polyline[i + 1].y - polyline[i].y);
    lens.push(l);
    total += l;
  }
  if (total === 0) return 0.5;
  let best = { dist: Infinity, along: 0 };
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const l = lens[i];
    let f = 0;
    if (l > 0) {
      f = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l);
      f = Math.min(1, Math.max(0, f));
    }
    const qx = a.x + (b.x - a.x) * f;
    const qy = a.y + (b.y - a.y) * f;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < best.dist) best = { dist: d, along: acc + f * l };
    acc += l;
  }
  return best.along / total;
};
