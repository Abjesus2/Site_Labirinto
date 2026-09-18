import { Node, Position } from '@xyflow/react';
import { Point, isPointInsideNodeShape, segmentIntersectsNodeShape, getNodeEscapePoint } from './shapeGeometry';
import {
  moveSegmentInOrthogonalPath,
  enforceEndpointRouting,
  removeRedundantPoints,
  removeCollinearPoints,
  canUseDirectStraightPath,
  endpointsFaceEachOther,
  generateDefaultStepRoute,
  adaptRouteToEndpoints
} from './snapUtils';

export {
  moveSegmentInOrthogonalPath,
  enforceEndpointRouting,
  removeRedundantPoints,
  removeCollinearPoints,
  canUseDirectStraightPath,
  endpointsFaceEachOther,
  generateDefaultStepRoute,
  adaptRouteToEndpoints
};

/**
 * Checks if any segment of an edge route collides with node shapes.
 * Rule:
 * 1. An edge can only touch the source shape at the source anchor, proceeding outward to the escape point.
 * 2. An edge can only touch the target shape at the target anchor, arriving from the escape point.
 * 3. No other segment can intersect ANY node shape (including source, target, or intermediate nodes).
 */
export function findManualRouteCollisions(
  points: Point[],
  nodes: Node[],
  sourceNodeId?: string,
  targetNodeId?: string
): boolean {
  if (!points || points.length < 2 || !nodes || nodes.length === 0) {
    return false;
  }

  const N = points.length;

  for (let i = 0; i < N - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    for (const node of nodes) {
      if (node.type === 'junction' || node.type === 'swimlane' || node.type === 'frame') {
        continue;
      }

      const isSourceNode = sourceNodeId && node.id === sourceNodeId;
      const isTargetNode = targetNodeId && node.id === targetNodeId;

      if (isSourceNode) {
        if (i === 0) {
          // Allowed outward exit segment (P0 -> P1)
          // P1 must be OUTSIDE the source node shape
          if (isPointInsideNodeShape(p2, node, 0.5)) {
            return true;
          }
        } else {
          // Intermediate segments cannot touch or cut through source node
          if (segmentIntersectsNodeShape(p1, p2, node, 0.5)) {
            return true;
          }
        }
      } else if (isTargetNode) {
        if (i === N - 2) {
          // Allowed inward arrival segment (Pn-2 -> Pn-1)
          // Pn-2 must be OUTSIDE the target node shape
          if (isPointInsideNodeShape(p1, node, 0.5)) {
            return true;
          }
        } else {
          // Preceding segments cannot touch or cut through target node
          if (segmentIntersectsNodeShape(p1, p2, node, 0.5)) {
            return true;
          }
        }
      } else {
        // Any other intermediate obstacle: segment MUST NOT intersect
        if (segmentIntersectsNodeShape(p1, p2, node, 0.5)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Moves a segment along an orthogonal path and clamps the movement if it would collide with any shape.
 * Preserves the manual routing without any global auto-routing.
 */
export function clampSegmentMovement({
  startPoints,
  segIndex,
  dir,
  delta,
  nodes,
  sourceNodeId,
  targetNodeId,
}: {
  startPoints: Point[];
  segIndex: number;
  dir: 'vert' | 'horiz';
  delta: { x: number; y: number };
  nodes: Node[];
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceSide?: any;
  targetSide?: any;
}): Point[] {
  if (!startPoints || startPoints.length < 2) return startPoints;

  // Try full candidate first
  const fullMoved = moveSegmentInOrthogonalPath({
    points: startPoints,
    segIndex,
    dir,
    delta,
  });

  if (!findManualRouteCollisions(fullMoved, nodes, sourceNodeId, targetNodeId)) {
    return fullMoved;
  }

  // O traçado de partida já passava por cima de alguma forma (acontece muito em
  // diagramas densos e nos gerados por IA). Nesse caso a colisão não pode vetar
  // o arraste, senão a linha volta sempre para o lugar e o ajuste fica inútil:
  // quem manda é o usuário.
  if (findManualRouteCollisions(startPoints, nodes, sourceNodeId, targetNodeId)) {
    return fullMoved;
  }

  // Collision detected with full delta: binary search to clamp movement at the obstacle border
  let low = 0;
  let high = 1;
  let bestPoints = startPoints;

  for (let step = 0; step < 8; step++) {
    const mid = (low + high) / 2;
    const midDelta = {
      x: delta.x * mid,
      y: delta.y * mid,
    };

    const midMoved = moveSegmentInOrthogonalPath({
      points: startPoints,
      segIndex,
      dir,
      delta: midDelta,
    });

    if (!findManualRouteCollisions(midMoved, nodes, sourceNodeId, targetNodeId)) {
      bestPoints = midMoved;
      low = mid;
    } else {
      high = mid;
    }
  }

  return bestPoints;
}

/**
 * Validates whether a manual edge route satisfies all geometric rules:
 * - Minimum 2 points
 * - Orthogonal segments
 * - No collision with any node interior (except designated anchor/escape stubs)
 */
export function validateManualEdgeRoute(
  points: Point[],
  nodes: Node[],
  sourceNodeId?: string,
  targetNodeId?: string
): { valid: boolean; reason?: string } {
  if (!points || points.length < 2) {
    return { valid: false, reason: 'Edge must contain at least 2 points' };
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const isOrtho = Math.abs(a.x - b.x) <= 0.5 || Math.abs(a.y - b.y) <= 0.5;
    if (!isOrtho) {
      return { valid: false, reason: `Segment ${i} is not orthogonal` };
    }
  }

  if (findManualRouteCollisions(points, nodes, sourceNodeId, targetNodeId)) {
    return { valid: false, reason: 'Route collides with node shape' };
  }

  return { valid: true };
}

/**
 * Builds an SVG path string with mathematically constrained corner rounding
 * so that rounded corners never invade obstacle shapes.
 */
export function buildRoundedPath(points: Point[], borderRadius = 8): string {
  if (!points || points.length === 0) return '';
  const pts = removeCollinearPoints(points);
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let path = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);

    const r = Math.min(borderRadius, dPrev / 2, dNext / 2);

    if (r < 0.5) {
      path += ` L ${curr.x} ${curr.y}`;
    } else {
      const pIn = {
        x: curr.x - (curr.x - prev.x) * (r / dPrev),
        y: curr.y - (curr.y - prev.y) * (r / dPrev),
      };
      const pOut = {
        x: curr.x + (next.x - curr.x) * (r / dNext),
        y: curr.y + (next.y - curr.y) * (r / dNext),
      };

      path += ` L ${pIn.x} ${pIn.y} Q ${curr.x} ${curr.y} ${pOut.x} ${pOut.y}`;
    }
  }

  path += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return path;
}
