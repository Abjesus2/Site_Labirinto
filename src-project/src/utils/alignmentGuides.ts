/**
 * Linhas-guia de alinhamento durante o arraste (como no Miro/Figma/PowerPoint):
 * enquanto uma ou mais formas são arrastadas, compara as bordas e o centro do
 * conjunto arrastado com as bordas e o centro de cada outra forma. Quando
 * algum deles fica perto o bastante (dentro do "threshold"), devolve o
 * pequeno deslocamento que encaixa o alinhamento exato e a linha a desenhar.
 * Módulo puro (sem React) para poder ser testado isolado.
 */

export interface GuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideLine {
  /** Coordenada fixa da linha (x para vertical, y para horizontal). */
  pos: number;
  /** Início e fim da linha no outro eixo (cobre as formas alinhadas). */
  from: number;
  to: number;
}

export interface AlignmentSnap {
  dx: number;
  dy: number;
  vertical: GuideLine | null;
  horizontal: GuideLine | null;
}

const boundsOf = (rects: GuideRect[]) => {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};

export function computeAlignmentSnap(dragged: GuideRect[], others: GuideRect[], threshold: number): AlignmentSnap {
  const none: AlignmentSnap = { dx: 0, dy: 0, vertical: null, horizontal: null };
  if (dragged.length === 0 || others.length === 0) return none;

  const b = boundsOf(dragged);
  const dragXs = [b.minX, b.cx, b.maxX];
  const dragYs = [b.minY, b.cy, b.maxY];

  let bestX: { diff: number; pos: number; other: GuideRect } | null = null;
  let bestY: { diff: number; pos: number; other: GuideRect } | null = null;

  for (const o of others) {
    const oXs = [o.x, o.x + o.width / 2, o.x + o.width];
    const oYs = [o.y, o.y + o.height / 2, o.y + o.height];
    for (const dxv of dragXs) {
      for (const ox of oXs) {
        const diff = ox - dxv;
        if (Math.abs(diff) <= threshold && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) {
          bestX = { diff, pos: ox, other: o };
        }
      }
    }
    for (const dyv of dragYs) {
      for (const oy of oYs) {
        const diff = oy - dyv;
        if (Math.abs(diff) <= threshold && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) {
          bestY = { diff, pos: oy, other: o };
        }
      }
    }
  }

  const dx = bestX ? bestX.diff : 0;
  const dy = bestY ? bestY.diff : 0;
  const PAD = 16;

  // As linhas cobrem do conjunto arrastado (já na posição encaixada) até a
  // forma com a qual ele alinhou, com uma pequena folga nas pontas.
  const vertical = bestX
    ? {
        pos: bestX.pos,
        from: Math.min(b.minY + dy, bestX.other.y) - PAD,
        to: Math.max(b.maxY + dy, bestX.other.y + bestX.other.height) + PAD,
      }
    : null;
  const horizontal = bestY
    ? {
        pos: bestY.pos,
        from: Math.min(b.minX + dx, bestY.other.x) - PAD,
        to: Math.max(b.maxX + dx, bestY.other.x + bestY.other.width) + PAD,
      }
    : null;

  return { dx, dy, vertical, horizontal };
}
