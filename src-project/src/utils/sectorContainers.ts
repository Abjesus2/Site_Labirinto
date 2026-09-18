import { Node } from '@xyflow/react';
import { getNodeDimensions } from '../components/CustomNodes';

const SECTOR_CONTAINER_SIDE_PADDING = 48;
const SECTOR_CONTAINER_TOP_PADDING = 56; // espaço para o título da raia/quadro
const SECTOR_CONTAINER_BOTTOM_PADDING = 32;

export interface SectorBox {
  dept: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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

/**
 * Depois do layout automático, agrupa os nós pelo campo "department" (setor
 * preenchido pela IA) e desenha uma raia ou um quadro ao redor de cada grupo,
 * para separar visualmente quem executa cada etapa. Raia (faixa cheia) quando
 * os setores aparecem em sequência, sem se misturar; quadro (moldura só ao
 * redor dos próprios nós) quando os setores se intercalam ao longo do fluxo.
 * Só entra em ação com 2+ setores distintos — um único setor não precisa de moldura.
 */
export function buildSectorContainers(nodes: Node[], direction: 'TB' | 'LR' = 'TB'): Node[] {
  const groups = groupNodesByDepartment(nodes);
  const boxes = computeSectorBoxes(groups);
  if (boxes.length < 2) return nodes;

  const isTB = direction !== 'LR';
  const sequential = sectorsAreSequential(boxes, direction);

  const sorted = [...boxes].sort((a, b) => (isTB ? a.minY - b.minY : a.minX - b.minX));

  const globalMinX = Math.min(...boxes.map((b) => b.minX));
  const globalMaxX = Math.max(...boxes.map((b) => b.maxX));
  const globalMinY = Math.min(...boxes.map((b) => b.minY));
  const globalMaxY = Math.max(...boxes.map((b) => b.maxY));

  const containers: Node[] = sorted.map((b, idx) => {
    const x = sequential
      ? (isTB ? globalMinX : b.minX) - SECTOR_CONTAINER_SIDE_PADDING
      : b.minX - SECTOR_CONTAINER_SIDE_PADDING;
    const y = sequential
      ? (isTB ? b.minY : globalMinY) - SECTOR_CONTAINER_TOP_PADDING
      : b.minY - SECTOR_CONTAINER_TOP_PADDING;
    const width = sequential
      ? (isTB ? globalMaxX - globalMinX : b.maxX - b.minX) + SECTOR_CONTAINER_SIDE_PADDING * 2
      : b.maxX - b.minX + SECTOR_CONTAINER_SIDE_PADDING * 2;
    const height = sequential
      ? (isTB ? b.maxY - b.minY : globalMaxY - globalMinY) + SECTOR_CONTAINER_TOP_PADDING + SECTOR_CONTAINER_BOTTOM_PADDING
      : b.maxY - b.minY + SECTOR_CONTAINER_TOP_PADDING + SECTOR_CONTAINER_BOTTOM_PADDING;

    const node: Node = {
      id: `sector_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: sequential ? 'swimlane' : 'frame',
      position: { x, y },
      style: { width, height, zIndex: -1 },
      data: {
        label: b.dept,
        styleOverride: {},
        timing: { duration: 0, setupTime: 0, waitTime: 0, pauseTime: 0, otherExtraTime: 0, status: 'pending' },
        generatedByAI: true,
      },
    };
    return node;
  });

  // Raias/quadros ficam atrás (renderizados primeiro) dos nós do processo.
  return [...containers, ...nodes];
}
