import { getShapeGeometry, ShapeConnectionPoint, getShapeConnectionPoint } from './shapeGeometry';
import { Node, Edge, Position, getSmoothStepPath } from '@xyflow/react';
import { getNodeDimensions } from '../components/CustomNodes';

export type Side = 'top' | 'right' | 'bottom' | 'left';

export const REAL_HANDLE_IDS = [
  'top-left-25',
  'top',
  'top-right-75',
  'right-top-25',
  'right',
  'right-bottom-75',
  'bottom-left-25',
  'bottom',
  'bottom-right-75',
  'left-top-25',
  'left',
  'left-bottom-75',
] as const;

export type RealHandleId = typeof REAL_HANDLE_IDS[number];

export function isValidNodeHandleId(handleId: string | null | undefined): boolean {
  if (!handleId) return false;
  return (REAL_HANDLE_IDS as readonly string[]).includes(handleId);
}

export function getPositionFromHandleId(handleId: string): Position {
  if (handleId.startsWith('top')) return Position.Top;
  if (handleId.startsWith('right')) return Position.Right;
  if (handleId.startsWith('bottom')) return Position.Bottom;
  if (handleId.startsWith('left')) return Position.Left;
  return Position.Top;
}

export type ReconnectCandidate =
  | {
      kind: 'node-border';
      nodeId: string;
      handleId: string;
      side: Side;
      ratio: number;
      x: number;
      y: number;
    }
  | {
      kind: 'free';
      x: number;
      y: number;
    };

export type SnapResult = {
  nodeId: string;
  handleId: string;
  x: number;
  y: number;
  position: Position;
  distance: number;
  side?: Side;
  ratio?: number;
};

/**
 * Returns absolute flow position for a node, taking parent offsets into account if available.
 */
export function getNodeFlowPosition(node: Node): { x: number; y: number } {
  const absPos = (node as any).internals?.positionAbsolute;
  if (absPos && typeof absPos.x === 'number' && typeof absPos.y === 'number') {
    return { x: absPos.x, y: absPos.y };
  }
  return { x: node.position.x, y: node.position.y };
}

/**
 * Returns full bounding rectangle for a node using actual measured/styled dimensions first.
 */
export function getNodeRect(node: Node): { x: number; y: number; width: number; height: number } {
  const dim = getNodeDimensions(node.type) || { width: 140, height: 60 };
  const w =
    (node.measured?.width as number) ||
    (node.width as number) ||
    (node.data?.width as number) ||
    (node.style?.width as number) ||
    dim.width;
  const h =
    (node.measured?.height as number) ||
    (node.height as number) ||
    (node.data?.height as number) ||
    (node.style?.height as number) ||
    dim.height;
  const pos = getNodeFlowPosition(node);
  return { x: pos.x, y: pos.y, width: w, height: h };
}

/**
 * SINGLE GEOMETRIC CONTRACT FOR JUNCTION:
 * Junction position is the exact flow coordinate of the edge endpoint.
 */
export function getJunctionEndpoint(node: Node): { x: number; y: number } {
  const pos = getNodeFlowPosition(node);
  const anchorX = typeof node.data?.anchorX === 'number' ? node.data.anchorX : pos.x;
  const anchorY = typeof node.data?.anchorY === 'number' ? node.data.anchorY : pos.y;
  return { x: anchorX, y: anchorY };
}

/**
 * Returns exact handle coordinates for a shape node from one of the 12 real handles.
 */
export function getNodeHandlePosition(
  node: Node,
  handleId?: string | null
): { x: number; y: number } {
  if (node.type === 'junction') {
    return getJunctionEndpoint(node);
  }

  const rect = getNodeRect(node);

  if (!handleId || handleId === 'center') {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  const connectionPoint = getShapeConnectionPoint(node.type || 'process', handleId);

  if (!connectionPoint) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `Unknown handle "${handleId}" for node "${node.id}" of type "${node.type}"`
      );
    }
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  return {
    x: rect.x + connectionPoint.x * rect.width,
    y: rect.y + connectionPoint.y * rect.height,
  };
}

/**
 * Helper to get all 12 real handle definitions with exact coordinates for a given node.
 */
export function getAllNodeHandles(node: Node): Array<{
  id: string;
  side: Side;
  ratio: number;
  x: number;
  y: number;
  normalX: number;
  normalY: number;
}> {
  const rect = getNodeRect(node);
  const type = node.type || 'process';
  const geom = getShapeGeometry(type);
  const pts = geom.getConnectionPoints();
  
  return pts.map(pt => {
    // Map position to side string for backwards compatibility
    let side: Side = 'top';
    if (pt.position === Position.Right) side = 'right';
    if (pt.position === Position.Bottom) side = 'bottom';
    if (pt.position === Position.Left) side = 'left';
    
    // We can infer ratio roughly from coordinates if needed, but it's not strictly necessary. 
    // We'll pass 0.5 to satisfy the type.
    
    return {
      id: pt.id,
      side,
      ratio: 0.5,
      x: rect.x + pt.x * rect.width,
      y: rect.y + pt.y * rect.height,
      normalX: pt.normalX,
      normalY: pt.normalY
    };
  });
}

/**
 * Resolves reconnect candidate during dragging.
 * Snaps ONLY to the nearest of the 12 real handles registered on candidate nodes.
 * Returns either node-border (with exact handle ID and x,y) or free.
 */
export function resolveReconnectCandidate(
  pointerFlow: { x: number; y: number },
  nodes: Node[],
  options?: { excludeNodeId?: string; maxDistance?: number }
): ReconnectCandidate {
  const excludeNodeId = options?.excludeNodeId;
  const maxDistance = options?.maxDistance ?? 40;

  let bestCandidate: {
    nodeId: string;
    handleId: string;
    side: Side;
    ratio: number;
    x: number;
    y: number;
    dist: number;
  } | null = null;

  for (const n of nodes) {
    if (excludeNodeId && n.id === excludeNodeId) continue;
    if (n.type === 'junction') continue;

    const handles = getAllNodeHandles(n);
    for (const h of handles) {
      const dist = Math.hypot(pointerFlow.x - h.x, pointerFlow.y - h.y);
      if (dist <= maxDistance && (!bestCandidate || dist < bestCandidate.dist)) {
        bestCandidate = {
          nodeId: n.id,
          handleId: h.id,
          side: h.side,
          ratio: h.ratio,
          x: h.x,
          y: h.y,
          dist,
        };
      }
    }
  }

  if (bestCandidate) {
    return {
      kind: 'node-border',
      nodeId: bestCandidate.nodeId,
      handleId: bestCandidate.handleId,
      side: bestCandidate.side,
      ratio: bestCandidate.ratio,
      x: bestCandidate.x,
      y: bestCandidate.y,
    };
  }

  return {
    kind: 'free',
    x: pointerFlow.x,
    y: pointerFlow.y,
  };
}

/**
 * Backward compatibility wrapper returning SnapResult when near a node handle.
 */
export function resolveConnectionSnap(
  pointerFlow: { x: number; y: number },
  nodes: Node[],
  options?: { excludeNodeId?: string; maxDistance?: number }
): SnapResult | null {
  const candidate = resolveReconnectCandidate(pointerFlow, nodes, options);
  if (candidate.kind === 'free') {
    return null;
  }

  const position = getPositionFromHandleId(candidate.handleId);

  return {
    nodeId: candidate.nodeId,
    handleId: candidate.handleId,
    x: candidate.x,
    y: candidate.y,
    position,
    distance: 0,
    side: candidate.side,
    ratio: candidate.ratio,
  };
}

/**
 * SINGLE FUNCTION TO GET THE EXACT CURRENT ENDPOINT OF AN EDGE.
 * Uses the true sourceHandle and targetHandle properties of the Edge.
 */
export function getActualEdgeEndpoint(
  edge: Edge,
  endpoint: 'source' | 'target',
  nodes: Node[]
): { x: number; y: number } {
  const nodeId = endpoint === 'source' ? edge.source : edge.target;
  const handleId = endpoint === 'source' ? edge.sourceHandle : edge.targetHandle;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    const edgeAny = edge as any;
    return {
      x: (endpoint === 'source' ? edgeAny.sourceX : edgeAny.targetX) ?? 0,
      y: (endpoint === 'source' ? edgeAny.sourceY : edgeAny.targetY) ?? 0,
    };
  }

  if (node.type === 'junction') {
    return getJunctionEndpoint(node);
  }

  if (handleId && isValidNodeHandleId(handleId)) {
    return getNodeHandlePosition(node, handleId);
  }

  if (handleId && handleId !== 'center') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Unknown handleId "${handleId}" on edge ${edge.id} for node ${node.id}`);
    }
  }

  return getNodeHandlePosition(node, handleId || 'center');
}

/**
 * Helper to parse SVG path commands (M x,y L x,y ...) into array of flow points
 */
export function parseSvgPathToPoints(svgPath: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const commands = svgPath.match(/[ML]\s*[-+]?\d*\.?\d+[\s,]+[-+]?\d*\.?\d+/gi) || [];
  for (const cmd of commands) {
    const clean = cmd.replace(/[ML]/i, '').trim();
    const parts = clean.split(/[\s,]+/).map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      points.push({ x: parts[0], y: parts[1] });
    }
  }
  return points;
}

/**
 * Freezes the current visual geometry of an automatically routed edge into controlPoints
 * before disconnecting a node, preventing ReactFlow from recalculating the route shape.
 */
export function freezeEdgeGeometry(edge: Edge, nodes: Node[]): Edge {
  if (edge.data?.manualRouting && Array.isArray(edge.data.controlPoints) && edge.data.controlPoints.length > 0) {
    return edge;
  }

  const actualSource = getActualEdgeEndpoint(edge, 'source', nodes);
  const actualTarget = getActualEdgeEndpoint(edge, 'target', nodes);

  let sourcePos = Position.Bottom;
  let targetPos = Position.Top;

  if (edge.sourceHandle && isValidNodeHandleId(edge.sourceHandle)) {
    sourcePos = getPositionFromHandleId(edge.sourceHandle);
  }
  if (edge.targetHandle && isValidNodeHandleId(edge.targetHandle)) {
    targetPos = getPositionFromHandleId(edge.targetHandle);
  }

  const [rawPath] = getSmoothStepPath({
    sourceX: actualSource.x,
    sourceY: actualSource.y,
    sourcePosition: sourcePos,
    targetX: actualTarget.x,
    targetY: actualTarget.y,
    targetPosition: targetPos,
    borderRadius: 0,
    offset: typeof edge.data?.offset === 'number' ? edge.data.offset : undefined,
  });

  let autoPoints = parseSvgPathToPoints(rawPath);
  if (autoPoints.length < 2) {
    autoPoints = [actualSource, actualTarget];
  } else {
    autoPoints[0] = actualSource;
    autoPoints[autoPoints.length - 1] = actualTarget;
  }

  const controlPoints = autoPoints.slice(1, -1);

  return {
    ...edge,
    data: {
      ...(edge.data || {}),
      manualRouting: true,
      controlPoints,
    },
  };
}

/**
 * Deletes nodes/edges safely preserving non-deleted edge endpoints and current line geometry.
 * Freezes automatic edge geometry first and creates junction nodes at exact endpoint coordinates.
 */
export function deleteSelectionSafely({
  nodeIds,
  edgeIds,
  currentNodes,
  currentEdges,
}: {
  nodeIds: string[];
  edgeIds: string[];
  currentNodes: Node[];
  currentEdges: Edge[];
}): { nextNodes: Node[]; nextEdges: Edge[] } {
  const explicitNodeIds = new Set(nodeIds);
  const explicitEdgeIds = new Set(edgeIds);

  const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));
  const createdJunctionsMap = new Map<string, Node>();

  let nextEdges = currentEdges.map((e) => {
    if (explicitEdgeIds.has(e.id)) {
      return e;
    }

    let updatedEdge = { ...e };

    const isSourceDeleted = explicitNodeIds.has(e.source);
    const isTargetDeleted = explicitNodeIds.has(e.target);

    if (isSourceDeleted || isTargetDeleted) {
      // FREEZE EDGE GEOMETRY BEFORE DISCONNECTING NODE(S) SO ROUTE DOES NOT SHIFT
      updatedEdge = freezeEdgeGeometry(updatedEdge, currentNodes);

      if (isSourceDeleted) {
        const sourceNode = nodeMap.get(e.source);
        if (sourceNode) {
          const pos = getActualEdgeEndpoint(e, 'source', currentNodes);
          const jId = `junction-${e.id}-source`;

          if (!createdJunctionsMap.has(jId)) {
            const existingJunction = currentNodes.find((n) => n.id === jId);
            const jNode: Node = existingJunction || {
              id: jId,
              type: 'junction',
              position: { x: pos.x, y: pos.y },
              data: { anchorX: pos.x, anchorY: pos.y, label: '' },
              selected: false,
              selectable: false,
              draggable: false,
              deletable: false,
              focusable: false,
            };
            createdJunctionsMap.set(jId, jNode);
          }
          updatedEdge.source = jId;
          updatedEdge.sourceHandle = 'center';
          if (updatedEdge.data && updatedEdge.data.sourceAnchor) {
            const nextData = { ...updatedEdge.data };
            delete nextData.sourceAnchor;
            updatedEdge.data = nextData;
          }
        }
      }

      if (isTargetDeleted) {
        const targetNode = nodeMap.get(e.target);
        if (targetNode) {
          const pos = getActualEdgeEndpoint(e, 'target', currentNodes);
          const jId = `junction-${e.id}-target`;

          if (!createdJunctionsMap.has(jId)) {
            const existingJunction = currentNodes.find((n) => n.id === jId);
            const jNode: Node = existingJunction || {
              id: jId,
              type: 'junction',
              position: { x: pos.x, y: pos.y },
              data: { anchorX: pos.x, anchorY: pos.y, label: '' },
              selected: false,
              selectable: false,
              draggable: false,
              deletable: false,
              focusable: false,
            };
            createdJunctionsMap.set(jId, jNode);
          }
          updatedEdge.target = jId;
          updatedEdge.targetHandle = 'center';
          if (updatedEdge.data && updatedEdge.data.targetAnchor) {
            const nextData = { ...updatedEdge.data };
            delete nextData.targetAnchor;
            updatedEdge.data = nextData;
          }
        }
      }
    }

    return updatedEdge;
  });

  nextEdges = nextEdges.filter((e) => !explicitEdgeIds.has(e.id));

  const newJunctions = Array.from(createdJunctionsMap.values());
  let nextNodes = currentNodes
    .filter((n) => !explicitNodeIds.has(n.id))
    .concat(newJunctions.filter((j) => !currentNodes.some((cn) => cn.id === j.id)));

  const activeEdgeNodes = new Set<string>();
  nextEdges.forEach((e) => {
    activeEdgeNodes.add(e.source);
    activeEdgeNodes.add(e.target);
  });

  nextNodes = nextNodes.filter((n) => {
    if (n.type === 'junction') {
      return activeEdgeNodes.has(n.id);
    }
    return true;
  });

  return { nextNodes, nextEdges };
}

export const ORTHO_EPSILON = 0.5;

export function isOrthogonalSegment(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (
    Math.abs(a.x - b.x) <= ORTHO_EPSILON ||
    Math.abs(a.y - b.y) <= ORTHO_EPSILON
  );
}

export function assertOrthogonalPath(points: { x: number; y: number }[]) {
  for (let i = 0; i < points.length - 1; i++) {
    if (!isOrthogonalSegment(points[i], points[i + 1])) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid diagonal edge segment', i, points[i], points[i + 1]);
      }
    }
  }
}

export type RouteKind =
  | 'straight'
  | 'single-bend'
  | 'orthogonal'
  | 'obstacle-detour'
  | 'u-turn';

export function removeCollinearPoints(points: { x: number; y: number }[], epsilon = 0.5): { x: number; y: number }[] {
  if (!points || points.length < 3) return points ? points.map(p => ({ ...p })) : [];
  
  const cleaned: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = points[i];
    if (Math.abs(curr.x - prev.x) > epsilon || Math.abs(curr.y - prev.y) > epsilon) {
      cleaned.push(curr);
    }
  }

  if (cleaned.length < 3) return cleaned;

  const result: { x: number; y: number }[] = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const a = result[result.length - 1];
    const b = cleaned[i];
    const c = cleaned[i + 1];

    const isCollinearX = Math.abs(a.x - b.x) <= epsilon && Math.abs(b.x - c.x) <= epsilon;
    const isCollinearY = Math.abs(a.y - b.y) <= epsilon && Math.abs(b.y - c.y) <= epsilon;

    if (isCollinearX || isCollinearY) {
      continue;
    }
    result.push(b);
  }
  result.push(cleaned[cleaned.length - 1]);
  return result;
}

export function removeRedundantPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  return removeCollinearPoints(points, ORTHO_EPSILON);
}

export function getSideNormal(side: any): { x: number; y: number } {
  if (side && typeof side === 'object' && typeof side.normalX === 'number' && typeof side.normalY === 'number') {
    return { x: side.normalX, y: side.normalY };
  }
  if (side === 'top' || side === Position.Top) return { x: 0, y: -1 };
  if (side === 'bottom' || side === Position.Bottom) return { x: 0, y: 1 };
  if (side === 'left' || side === Position.Left) return { x: -1, y: 0 };
  if (side === 'right' || side === Position.Right) return { x: 1, y: 0 };
  return { x: 0, y: 0 };
}

export function endpointsFaceEachOther(
  source: { x: number; y: number },
  target: { x: number; y: number },
  sourceSide?: any,
  targetSide?: any
): boolean {
  const sNorm = getSideNormal(sourceSide);
  const tNorm = getSideNormal(targetSide);

  // Bottom -> Top (descending): target must be below source
  if (sNorm.y > 0 && tNorm.y < 0 && target.y >= source.y - 1) {
    return true;
  }
  // Top -> Bottom (ascending): target must be above source
  if (sNorm.y < 0 && tNorm.y > 0 && target.y <= source.y + 1) {
    return true;
  }
  // Right -> Left (moving right): target must be to the right of source
  if (sNorm.x > 0 && tNorm.x < 0 && target.x >= source.x - 1) {
    return true;
  }
  // Left -> Right (moving left): target must be to the left of source
  if (sNorm.x < 0 && tNorm.x > 0 && target.x <= source.x + 1) {
    return true;
  }
  return false;
}

export function canUseDirectStraightPath({
  source,
  target,
  sourceSide,
  targetSide,
  nodes = [],
  sourceNodeId,
  targetNodeId,
  epsilon = 2,
}: {
  source: { x: number; y: number };
  target: { x: number; y: number };
  sourceSide?: any;
  targetSide?: any;
  nodes?: Node[];
  sourceNodeId?: string;
  targetNodeId?: string;
  epsilon?: number;
}): boolean {
  if (!endpointsFaceEachOther(source, target, sourceSide, targetSide)) {
    return false;
  }

  const sNorm = getSideNormal(sourceSide);
  const isVertical = sNorm.y !== 0;
  const isHorizontal = sNorm.x !== 0;

  if (isVertical) {
    if (Math.abs(source.x - target.x) > epsilon) {
      return false;
    }
  } else if (isHorizontal) {
    if (Math.abs(source.y - target.y) > epsilon) {
      return false;
    }
  } else {
    return false;
  }

  // Segment from source to target must not intersect any other node shape
  if (nodes && nodes.length > 0) {
    for (const node of nodes) {
      if (node.type === 'junction' || node.type === 'swimlane' || node.type === 'frame' || (node as any).hidden) {
        continue;
      }
      if (node.id === sourceNodeId || node.id === targetNodeId) {
        continue;
      }
      const rect = getNodeRect(node);
      const geom = getShapeGeometry(node.type || 'process');
      if (geom.segmentIntersects(source, target, rect, 0.5)) {
        return false;
      }
    }
  }

  return true;
}

export function generateDefaultStepRoute(
  source: { x: number; y: number },
  sourceSide?: any,
  target?: { x: number; y: number },
  targetSide?: any,
  stub = 24
): { x: number; y: number }[] {
  if (!target) return [{ ...source }, { ...source }];
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  let sDir = getSideNormal(sourceSide);
  let tDir = getSideNormal(targetSide);

  // If directions are unspecified, infer them based on delta
  if (sDir.x === 0 && sDir.y === 0) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      sDir = { x: dx >= 0 ? 1 : -1, y: 0 };
    } else {
      sDir = { x: 0, y: dy >= 0 ? 1 : -1 };
    }
  }
  if (tDir.x === 0 && tDir.y === 0) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      tDir = { x: dx >= 0 ? -1 : 1, y: 0 };
    } else {
      tDir = { x: 0, y: dy >= 0 ? -1 : 1 };
    }
  }

  const sIsHoriz = sDir.x !== 0;
  const sIsVert = sDir.y !== 0;
  const tIsHoriz = tDir.x !== 0;
  const tIsVert = tDir.y !== 0;

  // PRIORITY 1: STRAIGHT LINE
  // If endpoints face each other and are aligned, MUST be a single straight segment [source, target]
  if (endpointsFaceEachOther(source, target, sourceSide, targetSide)) {
    if (sIsVert && Math.abs(dx) <= 2) {
      return [{ ...source }, { ...target }];
    }
    if (sIsHoriz && Math.abs(dy) <= 2) {
      return [{ ...source }, { ...target }];
    }
  }

  let route: { x: number; y: number }[] = [];

  // Case 1: Both Horizontal handles
  if (sIsHoriz && tIsHoriz) {
    if (sDir.x > 0 && tDir.x > 0) {
      // Both face RIGHT -> loop around right side
      const xClear = Math.max(source.x, target.x) + stub;
      route = [
        { ...source },
        { x: xClear, y: source.y },
        { x: xClear, y: target.y },
        { ...target }
      ];
    } else if (sDir.x < 0 && tDir.x < 0) {
      // Both face LEFT -> loop around left side
      const xClear = Math.min(source.x, target.x) - stub;
      route = [
        { ...source },
        { x: xClear, y: source.y },
        { x: xClear, y: target.y },
        { ...target }
      ];
    } else if (sDir.x > 0 && tDir.x < 0) {
      // Source Right -> Target Left (forward)
      if (target.x >= source.x) {
        const midX = (source.x + target.x) / 2;
        route = [
          { ...source },
          { x: midX, y: source.y },
          { x: midX, y: target.y },
          { ...target }
        ];
      } else {
        const x1 = source.x + stub;
        const x2 = target.x - stub;
        const midY = Math.abs(target.y - source.y) > stub * 2
          ? (source.y + target.y) / 2
          : Math.min(source.y, target.y) - 40;
        route = [
          { ...source },
          { x: x1, y: source.y },
          { x: x1, y: midY },
          { x: x2, y: midY },
          { x: x2, y: target.y },
          { ...target }
        ];
      }
    } else {
      // Source Left -> Target Right (forward moving left)
      if (target.x <= source.x) {
        const midX = (source.x + target.x) / 2;
        route = [
          { ...source },
          { x: midX, y: source.y },
          { x: midX, y: target.y },
          { ...target }
        ];
      } else {
        const x1 = source.x - stub;
        const x2 = target.x + stub;
        const midY = Math.abs(target.y - source.y) > stub * 2
          ? (source.y + target.y) / 2
          : Math.min(source.y, target.y) - 40;
        route = [
          { ...source },
          { x: x1, y: source.y },
          { x: x1, y: midY },
          { x: x2, y: midY },
          { x: x2, y: target.y },
          { ...target }
        ];
      }
    }
  }
  // Case 2: Both Vertical handles
  else if (sIsVert && tIsVert) {
    if (sDir.y > 0 && tDir.y > 0) {
      // Both face DOWN -> loop around bottom
      const yClear = Math.max(source.y, target.y) + stub;
      route = [
        { ...source },
        { x: source.x, y: yClear },
        { x: target.x, y: yClear },
        { ...target }
      ];
    } else if (sDir.y < 0 && tDir.y < 0) {
      // Both face UP -> loop around top
      const yClear = Math.min(source.y, target.y) - stub;
      route = [
        { ...source },
        { x: source.x, y: yClear },
        { x: target.x, y: yClear },
        { ...target }
      ];
    } else if (sDir.y > 0 && tDir.y < 0) {
      // Source Down -> Target Up (descending forward flow)
      if (target.y >= source.y) {
        const midY = (source.y + target.y) / 2;
        route = [
          { ...source },
          { x: source.x, y: midY },
          { x: target.x, y: midY },
          { ...target }
        ];
      } else {
        const y1 = source.y + stub;
        const y2 = target.y - stub;
        const midX = Math.abs(target.x - source.x) > stub * 2
          ? (source.x + target.x) / 2
          : Math.max(source.x, target.x) + 40;
        route = [
          { ...source },
          { x: source.x, y: y1 },
          { x: midX, y: y1 },
          { x: midX, y: y2 },
          { x: target.x, y: y2 },
          { ...target }
        ];
      }
    } else {
      // Source Up -> Target Down (ascending forward flow)
      if (target.y <= source.y) {
        const midY = (source.y + target.y) / 2;
        route = [
          { ...source },
          { x: source.x, y: midY },
          { x: target.x, y: midY },
          { ...target }
        ];
      } else {
        const y1 = source.y - stub;
        const y2 = target.y + stub;
        const midX = Math.abs(target.x - source.x) > stub * 2
          ? (source.x + target.x) / 2
          : Math.max(source.x, target.x) + 40;
        route = [
          { ...source },
          { x: source.x, y: y1 },
          { x: midX, y: y1 },
          { x: midX, y: y2 },
          { x: target.x, y: y2 },
          { ...target }
        ];
      }
    }
  }
  // Case 3: Source Horizontal, Target Vertical
  else if (sIsHoriz && tIsVert) {
    const isDirectClean = 
      (sDir.x > 0 && tDir.y < 0 && target.x >= source.x + stub && target.y >= source.y + stub) ||
      (sDir.x > 0 && tDir.y > 0 && target.x >= source.x + stub && target.y <= source.y - stub) ||
      (sDir.x < 0 && tDir.y < 0 && target.x <= source.x - stub && target.y >= source.y + stub) ||
      (sDir.x < 0 && tDir.y > 0 && target.x <= source.x - stub && target.y <= source.y - stub);

    if (isDirectClean) {
      // Clean single bend (L)
      route = [
        { ...source },
        { x: target.x, y: source.y },
        { ...target }
      ];
    } else {
      const pExitX = sDir.x > 0 ? Math.max(source.x + stub, target.x) : Math.min(source.x - stub, target.x);
      const pEntryY = target.y + tDir.y * stub;
      route = [
        { ...source },
        { x: pExitX, y: source.y },
        { x: pExitX, y: pEntryY },
        { x: target.x, y: pEntryY },
        { ...target }
      ];
    }
  }
  // Case 4: Source Vertical, Target Horizontal
  else if (sIsVert && tIsHoriz) {
    const isDirectClean = 
      (sDir.y > 0 && tDir.x < 0 && target.y >= source.y + stub && target.x >= source.x + stub) ||
      (sDir.y > 0 && tDir.x > 0 && target.y >= source.y + stub && target.x <= source.x - stub && source.x >= target.x + stub) ||
      (sDir.y < 0 && tDir.x < 0 && target.y <= source.y - stub && target.x >= source.x + stub) ||
      (sDir.y < 0 && tDir.x > 0 && target.y <= source.y - stub && target.x <= source.x - stub && source.x >= target.x + stub);

    if (isDirectClean) {
      // Clean single bend (L)
      route = [
        { ...source },
        { x: source.x, y: target.y },
        { ...target }
      ];
    } else {
      const yMid = sDir.y > 0 ? source.y + stub : source.y - stub;
      const xEntry = target.x + tDir.x * stub;
      route = [
        { ...source },
        { x: source.x, y: yMid },
        { x: xEntry, y: yMid },
        { x: xEntry, y: target.y },
        { ...target }
      ];
    }
  }
  // Fallback
  else {
    const midX = (source.x + target.x) / 2;
    route = [
      { ...source },
      { x: midX, y: source.y },
      { x: midX, y: target.y },
      { ...target }
    ];
  }

  return removeRedundantPoints(route);
}

export function adaptRouteToEndpoints({
  points,
  source,
  sourceSide,
  target,
  targetSide,
}: {
  points?: { x: number; y: number }[];
  source: { x: number; y: number };
  sourceSide?: any;
  target: { x: number; y: number };
  targetSide?: any;
}): { x: number; y: number }[] {
  if (!points || points.length < 2) {
    return generateDefaultStepRoute(source, sourceSide, target, targetSide);
  }

  const pts = points.map((p) => ({ ...p }));
  const N = pts.length;
  pts[0] = { ...source };
  pts[N - 1] = { ...target };

  if (N === 2) {
    return generateDefaultStepRoute(source, sourceSide, target, targetSide);
  }

  // If source moved, adjust pts[1] to maintain orthogonality with pts[0]
  const sDir = getSideNormal(sourceSide);
  if (sDir.x !== 0) {
    pts[1].y = pts[0].y;
  } else if (sDir.y !== 0) {
    pts[1].x = pts[0].x;
  } else {
    if (Math.abs(pts[1].x - pts[0].x) <= Math.abs(pts[1].y - pts[0].y)) {
      pts[1].x = pts[0].x;
    } else {
      pts[1].y = pts[0].y;
    }
  }

  // If target moved, adjust pts[N-2] to maintain orthogonality with pts[N-1]
  const tDir = getSideNormal(targetSide);
  if (tDir.x !== 0) {
    pts[N - 2].y = pts[N - 1].y;
  } else if (tDir.y !== 0) {
    pts[N - 2].x = pts[N - 1].x;
  } else {
    if (Math.abs(pts[N - 2].x - pts[N - 1].x) <= Math.abs(pts[N - 2].y - pts[N - 1].y)) {
      pts[N - 2].x = pts[N - 1].x;
    } else {
      pts[N - 2].y = pts[N - 1].y;
    }
  }

  // Verify that all segments remain orthogonal. If any is non-orthogonal, regenerate cleanly.
  for (let i = 0; i < pts.length - 1; i++) {
    const pA = pts[i];
    const pB = pts[i + 1];
    if (Math.abs(pA.x - pB.x) > 0.5 && Math.abs(pA.y - pB.y) > 0.5) {
      return generateDefaultStepRoute(source, sourceSide, target, targetSide);
    }
  }

  return removeRedundantPoints(pts);
}

export function enforceEndpointRouting({
  points,
  source,
  sourceSide,
  target,
  targetSide,
  stub = 20,
}: {
  points: { x: number; y: number }[];
  source: { x: number; y: number };
  sourceSide: any;
  target: { x: number; y: number };
  targetSide: any;
  stub?: number;
}): { x: number; y: number }[] {
  if (!points || points.length < 2) return points || [];

  let pts = points.map((p) => ({ ...p }));
  pts[0] = { ...source };
  pts[pts.length - 1] = { ...target };

  const sDir = getSideNormal(sourceSide);

  // Check if first segment exits in the direction of sDir
  if (sDir.x !== 0 || sDir.y !== 0) {
    const p0 = pts[0];
    const p1 = pts[1];

    let wrongDirection = false;
    if (sDir.x !== 0) {
      const dx = p1.x - p0.x;
      if (dx * sDir.x <= 0 || Math.abs(p1.y - p0.y) > 0.5) {
        wrongDirection = true;
      }
    } else if (sDir.y !== 0) {
      const dy = p1.y - p0.y;
      if (dy * sDir.y <= 0 || Math.abs(p1.x - p0.x) > 0.5) {
        wrongDirection = true;
      }
    }

    if (wrongDirection) {
      const stubPt = {
        x: p0.x + sDir.x * stub,
        y: p0.y + sDir.y * stub,
      };

      if (sDir.y !== 0) {
        const sideOffset = (p1.x !== p0.x) ? (p1.x - p0.x) : 40;
        const corner1 = { x: p0.x, y: stubPt.y };
        const corner2 = { x: p0.x + sideOffset, y: stubPt.y };
        const corner3 = { x: p0.x + sideOffset, y: p1.y };

        pts = [
          p0,
          corner1,
          corner2,
          corner3,
          ...(pts.length > 2 ? pts.slice(2) : [{ ...target }]),
        ];
      } else {
        const sideOffset = (p1.y !== p0.y) ? (p1.y - p0.y) : 40;
        const corner1 = { x: stubPt.x, y: p0.y };
        const corner2 = { x: stubPt.x, y: p0.y + sideOffset };
        const corner3 = { x: p1.x, y: p0.y + sideOffset };

        pts = [
          p0,
          corner1,
          corner2,
          corner3,
          ...(pts.length > 2 ? pts.slice(2) : [{ ...target }]),
        ];
      }
    }
  }

  // Ensure overall orthogonality for any non-orthogonal segments
  const cleaned: { x: number; y: number }[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = cleaned[cleaned.length - 1];
    const b = pts[i + 1];
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) {
      cleaned.push({ x: b.x, y: a.y });
    }
    cleaned.push(b);
  }

  return removeCollinearPoints(cleaned);
}

/**
 * Moves an orthogonal edge segment parallel to itself by delta (dx, dy).
 * Preserves endpoints (source and target) and all other corners/segments intact.
 */
export function moveSegmentInOrthogonalPath({
  points,
  segIndex,
  dir,
  delta,
}: {
  points: { x: number; y: number }[];
  segIndex: number;
  dir: 'vert' | 'horiz';
  delta: { x: number; y: number };
}): { x: number; y: number }[] {
  if (!points || points.length < 2) return points || [];
  const N = points.length;
  if (segIndex < 0 || segIndex >= N - 1) return points.map((p) => ({ ...p }));

  const pts = points.map((p) => ({ ...p }));
  const dx = delta.x;
  const dy = delta.y;

  if (dir === 'vert') {
    // Vertical segment moving horizontally by dx
    if (N === 2) {
      const newX = pts[0].x + dx;
      return removeRedundantPoints([
        { ...pts[0] },
        { x: newX, y: pts[0].y },
        { x: newX, y: pts[1].y },
        { ...pts[1] },
      ]);
    }

    if (segIndex === 0) {
      // First segment: P0 -> P1. P0 is source anchor, cannot move.
      const newX = pts[0].x + dx;
      const res = [
        { ...pts[0] },
        { x: newX, y: pts[0].y },
        { x: newX, y: pts[1].y },
        ...pts.slice(2),
      ];
      return removeRedundantPoints(res);
    } else if (segIndex === N - 2) {
      // Last segment: Pn-2 -> Pn-1. Pn-1 is target anchor, cannot move.
      const newX = pts[N - 1].x + dx;
      const res = [
        ...pts.slice(0, N - 2),
        { x: newX, y: pts[N - 2].y },
        { x: newX, y: pts[N - 1].y },
        { ...pts[N - 1] },
      ];
      return removeRedundantPoints(res);
    } else {
      // Intermediate vertical segment: between pts[segIndex] and pts[segIndex + 1]
      const newX = pts[segIndex].x + dx;
      pts[segIndex].x = newX;
      pts[segIndex + 1].x = newX;
      return removeRedundantPoints(pts);
    }
  } else {
    // Horizontal segment moving vertically by dy
    if (N === 2) {
      const newY = pts[0].y + dy;
      return removeRedundantPoints([
        { ...pts[0] },
        { x: pts[0].x, y: newY },
        { x: pts[1].x, y: newY },
        { ...pts[1] },
      ]);
    }

    if (segIndex === 0) {
      // First segment: P0 -> P1. P0 is source anchor, cannot move.
      const newY = pts[0].y + dy;
      const res = [
        { ...pts[0] },
        { x: pts[0].x, y: newY },
        { x: pts[1].x, y: newY },
        ...pts.slice(2),
      ];
      return removeRedundantPoints(res);
    } else if (segIndex === N - 2) {
      // Last segment: Pn-2 -> Pn-1. Pn-1 is target anchor, cannot move.
      const newY = pts[N - 1].y + dy;
      const res = [
        ...pts.slice(0, N - 2),
        { x: pts[N - 2].x, y: newY },
        { x: pts[N - 1].x, y: newY },
        { ...pts[N - 1] },
      ];
      return removeRedundantPoints(res);
    } else {
      // Intermediate horizontal segment
      const newY = pts[segIndex].y + dy;
      pts[segIndex].y = newY;
      pts[segIndex + 1].y = newY;
      return removeRedundantPoints(pts);
    }
  }
}
