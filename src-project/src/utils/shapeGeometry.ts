import { Position, Node } from '@xyflow/react';
import { getNodeDimensions } from '../components/CustomNodes';

export type Point = { x: number; y: number };

export type ShapeConnectionPoint = {
  id: string;
  x: number; // 0 to 1 (relative to width)
  y: number; // 0 to 1 (relative to height)
  normalX: number;
  normalY: number;
  position: Position; // fallback for React Flow's native Handle
};

export type RoutingObstacle = {
  nodeId: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  actualLeft?: number;
  actualTop?: number;
  actualRight?: number;
  actualBottom?: number;
};

export interface ShapeGeometry {
  type: string;
  getConnectionPoints(): ShapeConnectionPoint[];
  getOutlinePoint(width: number, height: number, dx: number, dy: number): Point;
  getExpandedObstacle(x: number, y: number, width: number, height: number, clearance: number): RoutingObstacle;
  containsPoint(pt: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin?: number): boolean;
  segmentIntersects(a: Point, b: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin?: number): boolean;
  getEscapePoint(
    handleId: string,
    nodeRect: { x: number; y: number; width: number; height: number },
    clearance?: number
  ): { anchor: Point; escapePoint: Point; side: 'top' | 'right' | 'bottom' | 'left' };
}

// Common connection IDs
export const HANDLE_IDS = {
  TL: 'top-left-25', TC: 'top', TR: 'top-right-75',
  RT: 'right-top-25', RC: 'right', RB: 'right-bottom-75',
  BL: 'bottom-left-25', BC: 'bottom', BR: 'bottom-right-75',
  LT: 'left-top-25', LC: 'left', LB: 'left-bottom-75'
};

export function lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (A: Point, B: Point, C: Point) => {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

export class RectangleGeometry implements ShapeGeometry {
  constructor(public type: string) {}

  getConnectionPoints(): ShapeConnectionPoint[] {
    return [
      { id: HANDLE_IDS.TL, x: 0.25, y: 0, normalX: 0, normalY: -1, position: Position.Top },
      { id: HANDLE_IDS.TC, x: 0.50, y: 0, normalX: 0, normalY: -1, position: Position.Top },
      { id: HANDLE_IDS.TR, x: 0.75, y: 0, normalX: 0, normalY: -1, position: Position.Top },
      
      { id: HANDLE_IDS.RT, x: 1, y: 0.25, normalX: 1, normalY: 0, position: Position.Right },
      { id: HANDLE_IDS.RC, x: 1, y: 0.50, normalX: 1, normalY: 0, position: Position.Right },
      { id: HANDLE_IDS.RB, x: 1, y: 0.75, normalX: 1, normalY: 0, position: Position.Right },

      { id: HANDLE_IDS.BL, x: 0.25, y: 1, normalX: 0, normalY: 1, position: Position.Bottom },
      { id: HANDLE_IDS.BC, x: 0.50, y: 1, normalX: 0, normalY: 1, position: Position.Bottom },
      { id: HANDLE_IDS.BR, x: 0.75, y: 1, normalX: 0, normalY: 1, position: Position.Bottom },

      { id: HANDLE_IDS.LT, x: 0, y: 0.25, normalX: -1, normalY: 0, position: Position.Left },
      { id: HANDLE_IDS.LC, x: 0.50, y: 0.50, normalX: -1, normalY: 0, position: Position.Left }, // Wait LC x is 0
      { id: HANDLE_IDS.LB, x: 0, y: 0.75, normalX: -1, normalY: 0, position: Position.Left },
    ].map(p => p.id === HANDLE_IDS.LC ? { ...p, x: 0, y: 0.50 } : p);
  }

  getOutlinePoint(width: number, height: number, dx: number, dy: number): Point {
    const hw = width / 2;
    const hh = height / 2;
    if (dx === 0 && dy === 0) return { x: hw, y: hh };
    
    const scaleX = hw / Math.abs(dx);
    const scaleY = hh / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);
    
    return {
      x: hw + dx * scale,
      y: hh + dy * scale
    };
  }

  getExpandedObstacle(x: number, y: number, width: number, height: number, clearance: number): RoutingObstacle {
    return {
      nodeId: '',
      left: x - clearance,
      top: y - clearance,
      right: x + width + clearance,
      bottom: y + height + clearance
    };
  }

  containsPoint(pt: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    return (
      pt.x >= nodeRect.x - margin &&
      pt.x <= nodeRect.x + nodeRect.width + margin &&
      pt.y >= nodeRect.y - margin &&
      pt.y <= nodeRect.y + nodeRect.height + margin
    );
  }

  segmentIntersects(a: Point, b: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    const rLeft = nodeRect.x - margin;
    const rRight = nodeRect.x + nodeRect.width + margin;
    const rTop = nodeRect.y - margin;
    const rBottom = nodeRect.y + nodeRect.height + margin;

    // Fast bounding box rejection
    if (maxX < rLeft || minX > rRight || maxY < rTop || minY > rBottom) {
      return false;
    }

    // For horizontal segment
    if (Math.abs(a.y - b.y) <= 1e-3) {
      const y = a.y;
      if (y >= rTop && y <= rBottom) {
        if (maxX > rLeft && minX < rRight) {
          return true;
        }
      }
      return false;
    }

    // For vertical segment
    if (Math.abs(a.x - b.x) <= 1e-3) {
      const x = a.x;
      if (x >= rLeft && x <= rRight) {
        if (maxY > rTop && minY < rBottom) {
          return true;
        }
      }
      return false;
    }

    if (this.containsPoint(a, nodeRect, margin) || this.containsPoint(b, nodeRect, margin)) return true;

    return (
      lineSegmentsIntersect(a, b, { x: rLeft, y: rTop }, { x: rRight, y: rTop }) ||
      lineSegmentsIntersect(a, b, { x: rRight, y: rTop }, { x: rRight, y: rBottom }) ||
      lineSegmentsIntersect(a, b, { x: rRight, y: rBottom }, { x: rLeft, y: rBottom }) ||
      lineSegmentsIntersect(a, b, { x: rLeft, y: rBottom }, { x: rLeft, y: rTop })
    );
  }

  getEscapePoint(
    handleId: string,
    nodeRect: { x: number; y: number; width: number; height: number },
    clearance = 12
  ): { anchor: Point; escapePoint: Point; side: 'top' | 'right' | 'bottom' | 'left' } {
    const conn = this.getConnectionPoints().find(p => p.id === handleId) || {
      id: handleId,
      x: 0.5,
      y: 0,
      normalX: 0,
      normalY: -1,
      position: Position.Top
    };
    const anchor = {
      x: nodeRect.x + conn.x * nodeRect.width,
      y: nodeRect.y + conn.y * nodeRect.height,
    };
    let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
    let escapePoint = { ...anchor };

    if (conn.position === Position.Bottom || conn.normalY > 0.5) {
      side = 'bottom';
      escapePoint = { x: anchor.x, y: nodeRect.y + nodeRect.height + clearance };
    } else if (conn.position === Position.Left || conn.normalX < -0.5) {
      side = 'left';
      escapePoint = { x: nodeRect.x - clearance, y: anchor.y };
    } else if (conn.position === Position.Right || conn.normalX > 0.5) {
      side = 'right';
      escapePoint = { x: nodeRect.x + nodeRect.width + clearance, y: anchor.y };
    } else {
      side = 'top';
      escapePoint = { x: anchor.x, y: nodeRect.y - clearance };
    }
    return { anchor, escapePoint, side };
  }
}

export class DiamondGeometry implements ShapeGeometry {
  constructor(public type: string) {}

  getConnectionPoints(): ShapeConnectionPoint[] {
    const invSqrt2 = 1 / Math.sqrt(2);
    
    return [
      { id: HANDLE_IDS.TC, x: 0.5, y: 0, normalX: 0, normalY: -1, position: Position.Top },
      { id: HANDLE_IDS.RC, x: 1, y: 0.5, normalX: 1, normalY: 0, position: Position.Right },
      { id: HANDLE_IDS.BC, x: 0.5, y: 1, normalX: 0, normalY: 1, position: Position.Bottom },
      { id: HANDLE_IDS.LC, x: 0, y: 0.5, normalX: -1, normalY: 0, position: Position.Left },
      
      { id: HANDLE_IDS.TL, x: 0.25, y: 0.25, normalX: -invSqrt2, normalY: -invSqrt2, position: Position.Top },
      { id: HANDLE_IDS.TR, x: 0.75, y: 0.25, normalX: invSqrt2, normalY: -invSqrt2, position: Position.Top },
      { id: HANDLE_IDS.RT, x: 0.75, y: 0.25, normalX: invSqrt2, normalY: -invSqrt2, position: Position.Right },
      { id: HANDLE_IDS.RB, x: 0.75, y: 0.75, normalX: invSqrt2, normalY: invSqrt2, position: Position.Right },
      { id: HANDLE_IDS.BR, x: 0.75, y: 0.75, normalX: invSqrt2, normalY: invSqrt2, position: Position.Bottom },
      { id: HANDLE_IDS.BL, x: 0.25, y: 0.75, normalX: -invSqrt2, normalY: invSqrt2, position: Position.Bottom },
      { id: HANDLE_IDS.LB, x: 0.25, y: 0.75, normalX: -invSqrt2, normalY: invSqrt2, position: Position.Left },
      { id: HANDLE_IDS.LT, x: 0.25, y: 0.25, normalX: -invSqrt2, normalY: -invSqrt2, position: Position.Left },
    ];
  }

  getOutlinePoint(width: number, height: number, dx: number, dy: number): Point {
    const hw = width / 2;
    const hh = height / 2;
    
    if (dx === 0 && dy === 0) return { x: hw, y: hh };
    
    const scale = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    
    return {
      x: hw + dx * scale,
      y: hh + dy * scale
    };
  }

  getExpandedObstacle(x: number, y: number, width: number, height: number, clearance: number): RoutingObstacle {
    return {
      nodeId: '',
      left: x - clearance,
      top: y - clearance,
      right: x + width + clearance,
      bottom: y + height + clearance
    };
  }

  containsPoint(pt: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const cx = nodeRect.x + nodeRect.width / 2;
    const cy = nodeRect.y + nodeRect.height / 2;
    const hw = nodeRect.width / 2 + margin;
    const hh = nodeRect.height / 2 + margin;
    if (hw <= 0 || hh <= 0) return false;
    return (Math.abs(pt.x - cx) / hw + Math.abs(pt.y - cy) / hh) <= 1.0001;
  }

  segmentIntersects(a: Point, b: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const cx = nodeRect.x + nodeRect.width / 2;
    const cy = nodeRect.y + nodeRect.height / 2;
    const hw = nodeRect.width / 2 + margin;
    const hh = nodeRect.height / 2 + margin;

    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    if (maxX < cx - hw || minX > cx + hw || maxY < cy - hh || minY > cy + hh) {
      return false;
    }

    if (this.containsPoint(a, nodeRect, margin) || this.containsPoint(b, nodeRect, margin)) {
      return true;
    }

    // Horizontal segment at y
    if (Math.abs(a.y - b.y) <= 1e-3) {
      const y = a.y;
      const dy = Math.abs(y - cy);
      if (dy <= hh) {
        const dx = hw * (1 - dy / hh);
        const diamondLeft = cx - dx;
        const diamondRight = cx + dx;
        if (maxX > diamondLeft && minX < diamondRight) {
          return true;
        }
      }
      return false;
    }

    // Vertical segment at x
    if (Math.abs(a.x - b.x) <= 1e-3) {
      const x = a.x;
      const dx = Math.abs(x - cx);
      if (dx <= hw) {
        const dy = hh * (1 - dx / hw);
        const diamondTop = cy - dy;
        const diamondBottom = cy + dy;
        if (maxY > diamondTop && minY < diamondBottom) {
          return true;
        }
      }
      return false;
    }

    const pTop = { x: cx, y: cy - hh };
    const pRight = { x: cx + hw, y: cy };
    const pBottom = { x: cx, y: cy + hh };
    const pLeft = { x: cx - hw, y: cy };

    return (
      lineSegmentsIntersect(a, b, pTop, pRight) ||
      lineSegmentsIntersect(a, b, pRight, pBottom) ||
      lineSegmentsIntersect(a, b, pBottom, pLeft) ||
      lineSegmentsIntersect(a, b, pLeft, pTop)
    );
  }

  getEscapePoint(
    handleId: string,
    nodeRect: { x: number; y: number; width: number; height: number },
    clearance = 12
  ): { anchor: Point; escapePoint: Point; side: 'top' | 'right' | 'bottom' | 'left' } {
    const conn = this.getConnectionPoints().find(p => p.id === handleId) || {
      id: handleId,
      x: 0.5,
      y: 0,
      normalX: 0,
      normalY: -1,
      position: Position.Top
    };
    const anchor = {
      x: nodeRect.x + conn.x * nodeRect.width,
      y: nodeRect.y + conn.y * nodeRect.height,
    };
    let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
    let escapePoint = { ...anchor };

    if (conn.position === Position.Bottom || (conn.normalY > 0.3 && Math.abs(conn.normalY) >= Math.abs(conn.normalX))) {
      side = 'bottom';
      escapePoint = { x: anchor.x, y: nodeRect.y + nodeRect.height + clearance };
    } else if (conn.position === Position.Left || (conn.normalX < -0.3 && Math.abs(conn.normalX) >= Math.abs(conn.normalY))) {
      side = 'left';
      escapePoint = { x: nodeRect.x - clearance, y: anchor.y };
    } else if (conn.position === Position.Right || (conn.normalX > 0.3 && Math.abs(conn.normalX) >= Math.abs(conn.normalY))) {
      side = 'right';
      escapePoint = { x: nodeRect.x + nodeRect.width + clearance, y: anchor.y };
    } else {
      side = 'top';
      escapePoint = { x: anchor.x, y: nodeRect.y - clearance };
    }
    return { anchor, escapePoint, side };
  }
}

export class EllipseGeometry implements ShapeGeometry {
  constructor(public type: string) {}

  getConnectionPoints(): ShapeConnectionPoint[] {
    const pts: ShapeConnectionPoint[] = [];
    const handlesDef = [
      { id: HANDLE_IDS.TC, angle: -Math.PI / 2, pos: Position.Top },
      { id: HANDLE_IDS.TR, angle: -Math.PI / 3, pos: Position.Top },
      { id: HANDLE_IDS.RT, angle: -Math.PI / 6, pos: Position.Right },
      { id: HANDLE_IDS.RC, angle: 0, pos: Position.Right },
      { id: HANDLE_IDS.RB, angle: Math.PI / 6, pos: Position.Right },
      { id: HANDLE_IDS.BR, angle: Math.PI / 3, pos: Position.Bottom },
      { id: HANDLE_IDS.BC, angle: Math.PI / 2, pos: Position.Bottom },
      { id: HANDLE_IDS.BL, angle: 2 * Math.PI / 3, pos: Position.Bottom },
      { id: HANDLE_IDS.LB, angle: 5 * Math.PI / 6, pos: Position.Left },
      { id: HANDLE_IDS.LC, angle: Math.PI, pos: Position.Left },
      { id: HANDLE_IDS.LT, angle: -5 * Math.PI / 6, pos: Position.Left },
      { id: HANDLE_IDS.TL, angle: -2 * Math.PI / 3, pos: Position.Top }
    ];

    for (const h of handlesDef) {
      const cosA = Math.cos(h.angle);
      const sinA = Math.sin(h.angle);
      pts.push({
        id: h.id,
        x: 0.5 + 0.5 * cosA,
        y: 0.5 + 0.5 * sinA,
        normalX: cosA,
        normalY: sinA,
        position: h.pos
      });
    }
    return pts;
  }

  getOutlinePoint(width: number, height: number, dx: number, dy: number): Point {
    const hw = width / 2;
    const hh = height / 2;
    if (dx === 0 && dy === 0) return { x: hw, y: hh };
    
    const scale = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
    
    return {
      x: hw + dx * scale,
      y: hh + dy * scale
    };
  }

  getExpandedObstacle(x: number, y: number, width: number, height: number, clearance: number): RoutingObstacle {
    return {
      nodeId: '',
      left: x - clearance,
      top: y - clearance,
      right: x + width + clearance,
      bottom: y + height + clearance
    };
  }

  containsPoint(pt: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const cx = nodeRect.x + nodeRect.width / 2;
    const cy = nodeRect.y + nodeRect.height / 2;
    const hw = nodeRect.width / 2 + margin;
    const hh = nodeRect.height / 2 + margin;
    if (hw <= 0 || hh <= 0) return false;
    const dx = (pt.x - cx) / hw;
    const dy = (pt.y - cy) / hh;
    return (dx * dx + dy * dy) <= 1.0001;
  }

  segmentIntersects(a: Point, b: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const cx = nodeRect.x + nodeRect.width / 2;
    const cy = nodeRect.y + nodeRect.height / 2;
    const hw = nodeRect.width / 2 + margin;
    const hh = nodeRect.height / 2 + margin;

    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    if (maxX < cx - hw || minX > cx + hw || maxY < cy - hh || minY > cy + hh) {
      return false;
    }

    if (this.containsPoint(a, nodeRect, margin) || this.containsPoint(b, nodeRect, margin)) {
      return true;
    }

    // Horizontal segment at y
    if (Math.abs(a.y - b.y) <= 1e-3) {
      const y = a.y;
      const dy = Math.abs(y - cy);
      if (dy <= hh) {
        const span = hw * Math.sqrt(Math.max(0, 1 - (dy * dy) / (hh * hh)));
        const eLeft = cx - span;
        const eRight = cx + span;
        if (maxX > eLeft && minX < eRight) {
          return true;
        }
      }
      return false;
    }

    // Vertical segment at x
    if (Math.abs(a.x - b.x) <= 1e-3) {
      const x = a.x;
      const dx = Math.abs(x - cx);
      if (dx <= hw) {
        const span = hh * Math.sqrt(Math.max(0, 1 - (dx * dx) / (hw * hw)));
        const eTop = cy - span;
        const eBottom = cy + span;
        if (maxY > eTop && minY < eBottom) {
          return true;
        }
      }
      return false;
    }

    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return this.containsPoint(mid, nodeRect, margin);
  }

  getEscapePoint(
    handleId: string,
    nodeRect: { x: number; y: number; width: number; height: number },
    clearance = 12
  ): { anchor: Point; escapePoint: Point; side: 'top' | 'right' | 'bottom' | 'left' } {
    const conn = this.getConnectionPoints().find(p => p.id === handleId) || {
      id: handleId,
      x: 0.5,
      y: 0,
      normalX: 0,
      normalY: -1,
      position: Position.Top
    };
    const anchor = {
      x: nodeRect.x + conn.x * nodeRect.width,
      y: nodeRect.y + conn.y * nodeRect.height,
    };
    let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
    let escapePoint = { ...anchor };

    if (conn.position === Position.Bottom || (conn.normalY > 0.3 && Math.abs(conn.normalY) >= Math.abs(conn.normalX))) {
      side = 'bottom';
      escapePoint = { x: anchor.x, y: nodeRect.y + nodeRect.height + clearance };
    } else if (conn.position === Position.Left || (conn.normalX < -0.3 && Math.abs(conn.normalX) >= Math.abs(conn.normalY))) {
      side = 'left';
      escapePoint = { x: nodeRect.x - clearance, y: anchor.y };
    } else if (conn.position === Position.Right || (conn.normalX > 0.3 && Math.abs(conn.normalX) >= Math.abs(conn.normalY))) {
      side = 'right';
      escapePoint = { x: nodeRect.x + nodeRect.width + clearance, y: anchor.y };
    } else {
      side = 'top';
      escapePoint = { x: anchor.x, y: nodeRect.y - clearance };
    }
    return { anchor, escapePoint, side };
  }
}

export class PolygonGeometry implements ShapeGeometry {
  private parsedPolygon: Point[];
  constructor(public type: string, polygonStr: string) {
    this.parsedPolygon = this.parsePolygonString(polygonStr);
  }

  private parsePolygonString(str: string): Point[] {
    const match = str.match(/polygon\((.*?)\)/);
    if (!match) return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const pts = match[1].split(',').map(pair => {
      const parts = pair.trim().split(/\s+/);
      const x = parseFloat(parts[0]) / 100;
      const y = parseFloat(parts[1]) / 100;
      return { x, y };
    });
    return pts;
  }

  getConnectionPoints(): ShapeConnectionPoint[] {
    const rect = new RectangleGeometry(this.type);
    const pts = rect.getConnectionPoints();
    
    return pts.map(p => {
      const dx = (p.x - 0.5);
      const dy = (p.y - 0.5);
      
      const inter = this.getOutlinePoint(1, 1, dx, dy);
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      
      return {
        ...p,
        x: inter.x,
        y: inter.y,
        normalX: dx / mag,
        normalY: dy / mag
      };
    });
  }

  getOutlinePoint(width: number, height: number, dx: number, dy: number): Point {
    const hw = width / 2;
    const hh = height / 2;
    const cx = hw;
    const cy = hh;
    
    const rayP1 = { x: cx, y: cy };
    const rayP2 = { x: cx + dx * 1000, y: cy + dy * 1000 };
    
    let closestDist = Infinity;
    let closestPoint = { x: cx, y: cy };
    
    for (let i = 0; i < this.parsedPolygon.length; i++) {
      const p1 = { x: this.parsedPolygon[i].x * width, y: this.parsedPolygon[i].y * height };
      const p2 = { x: this.parsedPolygon[(i + 1) % this.parsedPolygon.length].x * width, y: this.parsedPolygon[(i + 1) % this.parsedPolygon.length].y * height };
      
      const inter = this.lineIntersection(rayP1, rayP2, p1, p2);
      if (inter) {
        const dist = Math.hypot(inter.x - cx, inter.y - cy);
        const dot = (inter.x - cx) * dx + (inter.y - cy) * dy;
        if (dot > 0 && dist < closestDist) {
          closestDist = dist;
          closestPoint = inter;
        }
      }
    }
    
    return closestPoint;
  }

  private lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;
    
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return null;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    
    if (t > 0 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }
    return null;
  }

  getExpandedObstacle(x: number, y: number, width: number, height: number, clearance: number): RoutingObstacle {
    return {
      nodeId: '',
      left: x - clearance,
      top: y - clearance,
      right: x + width + clearance,
      bottom: y + height + clearance
    };
  }

  containsPoint(pt: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const minX = nodeRect.x - margin;
    const maxX = nodeRect.x + nodeRect.width + margin;
    const minY = nodeRect.y - margin;
    const maxY = nodeRect.y + nodeRect.height + margin;
    if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) return false;

    const polyPts = this.parsedPolygon.map(p => ({
      x: nodeRect.x + p.x * nodeRect.width,
      y: nodeRect.y + p.y * nodeRect.height,
    }));

    let inside = false;
    for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
      const xi = polyPts[i].x, yi = polyPts[i].y;
      const xj = polyPts[j].x, yj = polyPts[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-10) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  segmentIntersects(a: Point, b: Point, nodeRect: { x: number; y: number; width: number; height: number }, margin = 0): boolean {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    const rLeft = nodeRect.x - margin;
    const rRight = nodeRect.x + nodeRect.width + margin;
    const rTop = nodeRect.y - margin;
    const rBottom = nodeRect.y + nodeRect.height + margin;

    if (maxX < rLeft || minX > rRight || maxY < rTop || minY > rBottom) {
      return false;
    }

    if (this.containsPoint(a, nodeRect, margin) || this.containsPoint(b, nodeRect, margin)) {
      return true;
    }

    const polyPts = this.parsedPolygon.map(p => ({
      x: nodeRect.x + p.x * nodeRect.width,
      y: nodeRect.y + p.y * nodeRect.height,
    }));

    for (let i = 0; i < polyPts.length; i++) {
      const p1 = polyPts[i];
      const p2 = polyPts[(i + 1) % polyPts.length];
      if (lineSegmentsIntersect(a, b, p1, p2)) {
        return true;
      }
    }

    for (let t = 0.2; t <= 0.8; t += 0.2) {
      const sample = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      if (this.containsPoint(sample, nodeRect, margin)) {
        return true;
      }
    }

    return false;
  }

  getEscapePoint(
    handleId: string,
    nodeRect: { x: number; y: number; width: number; height: number },
    clearance = 12
  ): { anchor: Point; escapePoint: Point; side: 'top' | 'right' | 'bottom' | 'left' } {
    const conn = this.getConnectionPoints().find(p => p.id === handleId) || {
      id: handleId,
      x: 0.5,
      y: 0,
      normalX: 0,
      normalY: -1,
      position: Position.Top
    };
    const anchor = {
      x: nodeRect.x + conn.x * nodeRect.width,
      y: nodeRect.y + conn.y * nodeRect.height,
    };
    let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
    let escapePoint = { ...anchor };

    if (conn.position === Position.Bottom || (conn.normalY > 0.3 && Math.abs(conn.normalY) >= Math.abs(conn.normalX))) {
      side = 'bottom';
      escapePoint = { x: anchor.x, y: nodeRect.y + nodeRect.height + clearance };
    } else if (conn.position === Position.Left || (conn.normalX < -0.3 && Math.abs(conn.normalX) >= Math.abs(conn.normalY))) {
      side = 'left';
      escapePoint = { x: nodeRect.x - clearance, y: anchor.y };
    } else if (conn.position === Position.Right || (conn.normalX > 0.3 && Math.abs(conn.normalX) >= Math.abs(conn.normalY))) {
      side = 'right';
      escapePoint = { x: nodeRect.x + nodeRect.width + clearance, y: anchor.y };
    } else {
      side = 'top';
      escapePoint = { x: anchor.x, y: nodeRect.y - clearance };
    }
    return { anchor, escapePoint, side };
  }
}

export const SHAPE_POLYGONS: Record<string, string> = {
  document: 'polygon(0% 0%, 100% 0%, 100% 85%, 75% 100%, 25% 85%, 0% 100%)',
  preparation: 'polygon(18% 0%, 82% 0%, 100% 50%, 82% 100%, 18% 100%, 0% 50%)',
  manualinput: 'polygon(0% 25%, 100% 0%, 100% 100%, 0% 100%)',
  manualoperation: 'polygon(0% 0%, 100% 0%, 82% 100%, 18% 100%)',
  display: 'polygon(15% 0%, 82% 0%, 100% 50%, 82% 100%, 15% 100%, 0% 50%)',
  offpage: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)',
  inputoutput: 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)',
};

const GEOMETRY_CACHE: Record<string, ShapeGeometry> = {};

export function getShapeGeometry(type: string): ShapeGeometry {
  if (GEOMETRY_CACHE[type]) return GEOMETRY_CACHE[type];
  
  let geom: ShapeGeometry;
  if (type === 'decision') {
    geom = new DiamondGeometry(type);
  } else if (type === 'circle' || type === 'start' || type === 'end') {
    geom = new EllipseGeometry(type);
  } else if (SHAPE_POLYGONS[type]) {
    geom = new PolygonGeometry(type, SHAPE_POLYGONS[type]);
  } else {
    geom = new RectangleGeometry(type);
  }
  
  GEOMETRY_CACHE[type] = geom;
  return geom;
}

export function getShapeConnectionPoint(
  nodeType: string,
  handleId: string
): ShapeConnectionPoint | null {
  const geom = getShapeGeometry(nodeType);
  return geom.getConnectionPoints().find(p => p.id === handleId) || null;
}

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
  const absPos = (node as any).internals?.positionAbsolute;
  const posX = absPos && typeof absPos.x === 'number' ? absPos.x : node.position.x;
  const posY = absPos && typeof absPos.y === 'number' ? absPos.y : node.position.y;
  return { x: posX, y: posY, width: w, height: h };
}

export function isPointInsideNodeShape(point: Point, node: Node, margin = 0): boolean {
  if (!node || node.type === 'junction' || node.type === 'swimlane' || node.type === 'frame') {
    return false;
  }
  const geom = getShapeGeometry(node.type || 'process');
  const rect = getNodeRect(node);
  return geom.containsPoint(point, rect, margin);
}

export function segmentIntersectsNodeShape(a: Point, b: Point, node: Node, margin = 0): boolean {
  if (!node || node.type === 'junction' || node.type === 'swimlane' || node.type === 'frame') {
    return false;
  }
  const geom = getShapeGeometry(node.type || 'process');
  const rect = getNodeRect(node);
  return geom.segmentIntersects(a, b, rect, margin);
}

export function getNodeEscapePoint(
  node: Node,
  handleId?: string,
  clearance = 12
): { anchor: Point; escapePoint: Point; side: 'top' | 'right' | 'bottom' | 'left' } {
  if (!node) {
    return {
      anchor: { x: 0, y: 0 },
      escapePoint: { x: 0, y: 0 },
      side: 'top',
    };
  }
  if (node.type === 'junction') {
    const pos = { x: node.position.x, y: node.position.y };
    return {
      anchor: pos,
      escapePoint: pos,
      side: 'top',
    };
  }
  const geom = getShapeGeometry(node.type || 'process');
  const rect = getNodeRect(node);
  return geom.getEscapePoint(handleId || 'top', rect, clearance);
}
