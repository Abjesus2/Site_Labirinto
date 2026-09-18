import { Node, Position } from '@xyflow/react';
import { RoutingObstacle, Point, getShapeGeometry, ShapeConnectionPoint } from './shapeGeometry';
import { getNodeRect, canUseDirectStraightPath, removeCollinearPoints } from './snapUtils';

export function getObstacles(
  nodes: Node[], 
  clearance = 16, 
  sourceNodeId?: string, 
  targetNodeId?: string, 
  ptsToCheck?: Point[]
): RoutingObstacle[] {
  return nodes.flatMap(n => {
    if (n.type === 'junction' || n.type === 'swimlane' || n.type === 'frame' || n.hidden) return [];
    
    const rect = getNodeRect(n);
    if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      return [];
    }

    const type = n.type || 'process';
    const geom = getShapeGeometry(type);
    
    let activeClearance = clearance;
    const isSourceObs = n.id === sourceNodeId;
    const isTargetObs = n.id === targetNodeId;

    if (!isSourceObs && !isTargetObs && ptsToCheck && ptsToCheck.length > 0) {
       const actual = geom.getExpandedObstacle(rect.x, rect.y, rect.width, rect.height, 0);
       const isInside = (pt: Point) => pt.x >= actual.left - 1 && pt.x <= actual.right + 1 && pt.y >= actual.top - 1 && pt.y <= actual.bottom + 1;
       
       if (ptsToCheck.some(isInside)) {
           return []; // Completely ignore this obstacle as the endpoints are inside it
       }

       const exp = geom.getExpandedObstacle(rect.x, rect.y, rect.width, rect.height, clearance);
       const isInsideExp = (pt: Point) => pt.x >= exp.left && pt.x <= exp.right && pt.y >= exp.top && pt.y <= exp.bottom;
       
       if (ptsToCheck.some(isInsideExp)) {
           activeClearance = 0; // Shrink to actual bounds
       }
    }

    const obs = geom.getExpandedObstacle(rect.x, rect.y, rect.width, rect.height, activeClearance);
    obs.nodeId = n.id;
    obs.actualLeft = rect.x;
    obs.actualTop = rect.y;
    obs.actualRight = rect.x + rect.width;
    obs.actualBottom = rect.y + rect.height;
    return [obs];
  });
}

function segmentsIntersect(a: Point, b: Point, obs: RoutingObstacle): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  const isHoriz = Math.abs(a.y - b.y) < 0.5;
  const isVert = Math.abs(a.x - b.x) < 0.5;

  if (isHoriz) {
    if (a.y <= obs.top || a.y >= obs.bottom) return false;
    if (maxX <= obs.left || minX >= obs.right) return false;
    return true;
  }
  if (isVert) {
    if (a.x <= obs.left || a.x >= obs.right) return false;
    if (maxY <= obs.top || minY >= obs.bottom) return false;
    return true;
  }
  
  if (maxX <= obs.left || minX >= obs.right) return false;
  if (maxY <= obs.top || minY >= obs.bottom) return false;
  return true; 
}

export function pointInsideObstacle(p: Point, obs: RoutingObstacle): boolean {
  return p.x > obs.left && p.x < obs.right && p.y > obs.top && p.y < obs.bottom;
}

export function isSegmentValid(a: Point, b: Point, obstacles: RoutingObstacle[]): boolean {
  for (const obs of obstacles) {
    if (segmentsIntersect(a, b, obs)) return false;
  }
  return true;
}

export function isPointValid(p: Point, obstacles: RoutingObstacle[]): boolean {
  for (const obs of obstacles) {
    if (pointInsideObstacle(p, obs)) return false;
  }
  return true;
}

export function validateRouteAgainstObstacles(points: Point[], obstacles: RoutingObstacle[], sourceNodeId?: string, targetNodeId?: string): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (const obs of obstacles) {
      if (i === 0 && obs.nodeId === sourceNodeId) continue;
      if (i === points.length - 2 && obs.nodeId === targetNodeId) continue;
      if (segmentsIntersect(a, b, obs)) return false;
    }
  }
  return true;
}

export function removeRedundantPoints(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const cleaned = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = points[i];
    if (Math.abs(curr.x - prev.x) > 0.5 || Math.abs(curr.y - prev.y) > 0.5) {
      cleaned.push(curr);
    }
  }
  
  if (cleaned.length < 2) return cleaned;

  const finalPts = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const a = finalPts[finalPts.length - 1];
    const b = cleaned[i];
    const c = cleaned[i + 1];
    
    const isHorizontal = Math.abs(a.y - b.y) <= 0.5 && Math.abs(b.y - c.y) <= 0.5;
    const isVertical = Math.abs(a.x - b.x) <= 0.5 && Math.abs(b.x - c.x) <= 0.5;
    const isBetweenX = (b.x >= Math.min(a.x, c.x)) && (b.x <= Math.max(a.x, c.x));
    const isBetweenY = (b.y >= Math.min(a.y, c.y)) && (b.y <= Math.max(a.y, c.y));
    
    if ((isHorizontal && isBetweenX) || (isVertical && isBetweenY)) {
      // Redundant
    } else {
      finalPts.push(b);
    }
  }
  finalPts.push(cleaned[cleaned.length - 1]);
  return finalPts;
}

type Direction = "up" | "down" | "left" | "right" | "none";

function routeAStar(
  sourcePortal: Point,
  targetPortal: Point,
  obstacles: RoutingObstacle[],
  sourceDir: Direction
): Point[] | null {
  const xs = new Set<number>();
  const ys = new Set<number>();

  xs.add(sourcePortal.x);
  ys.add(sourcePortal.y);
  xs.add(targetPortal.x);
  ys.add(targetPortal.y);

  for (const obs of obstacles) {
    xs.add(obs.left);
    xs.add(obs.right);
    ys.add(obs.top);
    ys.add(obs.bottom);
  }

  const xList = Array.from(xs).sort((a, b) => a - b);
  const yList = Array.from(ys).sort((a, b) => a - b);

  const xToIndex = new Map<number, number>();
  const yToIndex = new Map<number, number>();
  xList.forEach((x, i) => xToIndex.set(x, i));
  yList.forEach((y, i) => yToIndex.set(y, i));

  const startXIdx = xToIndex.get(sourcePortal.x)!;
  const startYIdx = yToIndex.get(sourcePortal.y)!;
  const endXIdx = xToIndex.get(targetPortal.x)!;
  const endYIdx = yToIndex.get(targetPortal.y)!;

  interface NodeState {
    x: number;
    y: number;
    g: number;
    f: number;
    parent: NodeState | null;
    dir: Direction;
  }

  const open: NodeState[] = [];
  const closed = new Set<string>();
  
  const startState: NodeState = {
    x: startXIdx,
    y: startYIdx,
    g: 0,
    f: Math.abs(xList[startXIdx] - xList[endXIdx]) + Math.abs(yList[startYIdx] - yList[endYIdx]),
    parent: null,
    dir: sourceDir
  };

  open.push(startState);

  const BEND_PENALTY = 25;

  let bestEndState: NodeState | null = null;
  const gCosts = new Map<string, number>();
  gCosts.set(`${startXIdx},${startYIdx},${sourceDir}`, 0);

  let attempts = 0;
  const maxAttempts = 10000;

  while (open.length > 0 && attempts++ < maxAttempts) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;

    if (current.x === endXIdx && current.y === endYIdx) {
      bestEndState = current;
      break;
    }

    const key = `${current.x},${current.y},${current.dir}`;
    if (closed.has(key)) continue;
    closed.add(key);

    const currentP = { x: xList[current.x], y: yList[current.y] };

    const dirs = [
      { dx: 1, dy: 0, dir: "right" as Direction, tie: 0.001 },
      { dx: -1, dy: 0, dir: "left" as Direction, tie: 0.002 },
      { dx: 0, dy: 1, dir: "down" as Direction, tie: 0.003 },
      { dx: 0, dy: -1, dir: "up" as Direction, tie: 0.004 }
    ];

    for (const d of dirs) {
      let nx = current.x + d.dx;
      let ny = current.y + d.dy;
      
      if (nx >= 0 && nx < xList.length && ny >= 0 && ny < yList.length) {
        const nextP = { x: xList[nx], y: yList[ny] };
        
        if (isSegmentValid(currentP, nextP, obstacles)) {
          const dist = Math.abs(nextP.x - currentP.x) + Math.abs(nextP.y - currentP.y);
          let penalty = 0;
          if (current.dir !== "none" && current.dir !== d.dir) {
             penalty = BEND_PENALTY;
          }
          
          const g = current.g + dist + penalty + d.tie;
          const h = Math.abs(xList[nx] - xList[endXIdx]) + Math.abs(yList[ny] - yList[endYIdx]);
          
          const nKey = `${nx},${ny},${d.dir}`;
          
          if (!gCosts.has(nKey) || g < gCosts.get(nKey)!) {
            gCosts.set(nKey, g);
            open.push({
              x: nx,
              y: ny,
              g,
              f: g + h,
              parent: current,
              dir: d.dir
            });
          }
        }
      }
    }
  }

  if (!bestEndState) return null;

  const path: Point[] = [];
  let curr: NodeState | null = bestEndState;
  while (curr) {
    path.push({ x: xList[curr.x], y: yList[curr.y] });
    curr = curr.parent;
  }
  return path.reverse();
}

function safeGlobalRoute(sourcePortal: Point, targetPortal: Point, obstacles: RoutingObstacle[], sourceDir: Direction): Point[] {
  if (obstacles.length === 0) {
    return [sourcePortal, { x: sourcePortal.x, y: targetPortal.y }, targetPortal];
  }

  const margin = 40;
  const left = Math.min(...obstacles.map(o => o.left)) - margin;
  const right = Math.max(...obstacles.map(o => o.right)) + margin;
  const top = Math.min(...obstacles.map(o => o.top)) - margin;
  const bottom = Math.max(...obstacles.map(o => o.bottom)) + margin;

  let pt1 = { ...sourcePortal };
  if (sourceDir === "right") pt1.x = right;
  else if (sourceDir === "left") pt1.x = left;
  else if (sourceDir === "down") pt1.y = bottom;
  else if (sourceDir === "up") pt1.y = top;
  else pt1.y = top; 

  let pt2 = { ...targetPortal };
  return [sourcePortal, pt1, { x: pt1.x, y: top }, { x: pt2.x, y: top }, pt2, targetPortal];
}

export function getManhattanNormal(normalX?: number, normalY?: number, fallbackPos?: Position): { x: number; y: number } {
  if (normalX !== undefined && normalY !== undefined && (normalX !== 0 || normalY !== 0)) {
    if (Math.abs(normalX) > Math.abs(normalY)) {
      return { x: Math.sign(normalX), y: 0 };
    } else {
      return { x: 0, y: Math.sign(normalY) };
    }
  }
  if (fallbackPos === Position.Left) return { x: -1, y: 0 };
  if (fallbackPos === Position.Right) return { x: 1, y: 0 };
  if (fallbackPos === Position.Top) return { x: 0, y: -1 };
  if (fallbackPos === Position.Bottom) return { x: 0, y: 1 };
  return { x: 0, y: 1 };
}

export function routeOrthogonalAuto(
  source: Point,
  sourceNormal: Point,
  target: Point,
  targetNormal: Point,
  nodes: Node[],
  sourceNodeId: string,
  targetNodeId: string,
  clearance = 12
): Point[] | null {
  // PRIORITY 1: Direct straight line if aligned and unblocked
  if (canUseDirectStraightPath({
    source,
    target,
    sourceSide: sourceNormal,
    targetSide: targetNormal,
    nodes,
    sourceNodeId,
    targetNodeId,
    epsilon: 2
  })) {
    return [{ ...source }, { ...target }];
  }
  
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  const targetNode = nodes.find(n => n.id === targetNodeId);

  const getSingleObs = (n: Node) => {
    const rect = getNodeRect(n);
    const geom = getShapeGeometry(n.type || 'process');
    const obs = geom.getExpandedObstacle(rect.x, rect.y, rect.width, rect.height, clearance);
    obs.nodeId = n.id;
    return obs;
  };

  const sourceNodeObs = sourceNode ? getSingleObs(sourceNode) : null;
  const targetNodeObs = targetNode ? getSingleObs(targetNode) : null;

  let portalDistSrc = clearance + 2;
  let sourcePortal = { x: source.x + sourceNormal.x * portalDistSrc, y: source.y + sourceNormal.y * portalDistSrc };
  while (sourceNodeObs && pointInsideObstacle(sourcePortal, sourceNodeObs) && portalDistSrc < 500) {
     portalDistSrc += 2;
     sourcePortal = { x: source.x + sourceNormal.x * portalDistSrc, y: source.y + sourceNormal.y * portalDistSrc };
  }

  let portalDistTgt = clearance + 2;
  let targetPortal = { x: target.x + targetNormal.x * portalDistTgt, y: target.y + targetNormal.y * portalDistTgt };
  while (targetNodeObs && pointInsideObstacle(targetPortal, targetNodeObs) && portalDistTgt < 500) {
     portalDistTgt += 2;
     targetPortal = { x: target.x + targetNormal.x * portalDistTgt, y: target.y + targetNormal.y * portalDistTgt };
  }

  const obstacles = getObstacles(nodes, clearance, sourceNodeId, targetNodeId, [source, sourcePortal, target, targetPortal]);
  
  let sourceDir: Direction = "none";
  if (sourceNormal.x > 0.5) sourceDir = "right";
  else if (sourceNormal.x < -0.5) sourceDir = "left";
  else if (sourceNormal.y > 0.5) sourceDir = "down";
  else if (sourceNormal.y < -0.5) sourceDir = "up";

  let path = routeAStar(sourcePortal, targetPortal, obstacles, sourceDir);
  
  if (!path) {
    path = safeGlobalRoute(sourcePortal, targetPortal, obstacles, sourceDir);
  }

  const fullPath = [source, ...path, target];
  return removeRedundantPoints(fullPath);
}

export function findCollisions(points: Point[], obstacles: RoutingObstacle[], ignoreNodeIds: string[] = []): { segIndex: number, obstacle: RoutingObstacle }[] {
  const collisions: { segIndex: number, obstacle: RoutingObstacle }[] = [];
  
  const sourceNodeId = ignoreNodeIds[0];
  const targetNodeId = ignoreNodeIds[1];
  
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    
    for (const obs of obstacles) {
      if (i === 0 && obs.nodeId === sourceNodeId) continue;
      if (i === points.length - 2 && obs.nodeId === targetNodeId) continue;

      if (segmentsIntersect(a, b, obs)) {
        collisions.push({ segIndex: i, obstacle: obs });
      }
    }
  }
  return collisions;
}

export function localReroute(points: Point[], obstacles: RoutingObstacle[], ignoreNodeIds: string[] = []): Point[] | null {
  let currentPts = [...points];
  let maxIterations = 10;
  
  while (maxIterations-- > 0) {
    const cols = findCollisions(currentPts, obstacles, ignoreNodeIds);
    if (cols.length === 0) return currentPts;
    
    const col = cols[0];
    const i = col.segIndex;
    const a = currentPts[i];
    const b = currentPts[i + 1];
    const obs = col.obstacle;
    
    const isHoriz = Math.abs(a.y - b.y) < 0.5;
    
    if (isHoriz) {
      const dyTop = Math.abs(a.y - obs.top);
      const dyBot = Math.abs(obs.bottom - a.y);
      const pushY = dyTop < dyBot ? obs.top : obs.bottom;
      
      currentPts.splice(i + 1, 0, { x: a.x, y: pushY }, { x: b.x, y: pushY });
    } else {
      const dxLeft = Math.abs(a.x - obs.left);
      const dxRight = Math.abs(obs.right - a.x);
      const pushX = dxLeft < dxRight ? obs.left : obs.right;
      
      currentPts.splice(i + 1, 0, { x: pushX, y: a.y }, { x: pushX, y: b.y });
    }
    
    currentPts = removeRedundantPoints(currentPts);
  }
  
  if (findCollisions(currentPts, obstacles, ignoreNodeIds).length === 0) {
     return currentPts;
  }
  
  return null;
}
