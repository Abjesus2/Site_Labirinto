import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BaseEdge,
  EdgeProps,
  Edge,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  EdgeLabelRenderer,
  Position,
  useReactFlow,
  useViewport,
  useNodes,
  Node,
} from '@xyflow/react';
import {
  Check
} from 'lucide-react';
import { getNodeDimensions } from './CustomNodes';
import { collectLabelObstacles, placeEdgeLabel } from '../lib/labelPlacement';
import { showToast } from '../lib/embedCompat';
import {
  resolveReconnectCandidate,
  isValidNodeHandleId,
  generateDefaultStepRoute,
  adaptRouteToEndpoints,
  enforceEndpointRouting,
  removeRedundantPoints,
  isOrthogonalSegment,
  assertOrthogonalPath,
  ORTHO_EPSILON,
  getPositionFromHandleId,
  ReconnectCandidate,
} from '../utils/snapUtils';
import {
  clampSegmentMovement,
  validateManualEdgeRoute,
  buildRoundedPath,
  canUseDirectStraightPath,
  removeCollinearPoints,
} from '../utils/manualEdgeGeometry';

export interface EdgePoint {
  x: number;
  y: number;
}

export interface AdjustableEdgeData {
  controlPoints?: EdgePoint[];
  manualRouting?: boolean;
  offset?: number;
  borderRadius?: number;
  label?: string;
  needsEvaluation?: boolean;
  isDubious?: boolean;
  [key: string]: any;
}

/** Helper to parse SVG path commands (M x,y L x,y ...) into array of flow points */
function parseSvgPathToPoints(svgPath: string): EdgePoint[] {
  const points: EdgePoint[] = [];
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

/** Todos os trechos precisam ser horizontais ou verticais. */
const isOrthogonalRoute = (pts: { x: number; y: number }[]): boolean => {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return false;
  }
  return true;
};

export const AdjustableEdge: React.FC<EdgeProps> = ({
  sourceHandleId,
  targetHandleId,
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  style = {},
  markerEnd,
  markerStart,
  data,
  selected,
  label,
  type = 'smoothstep',
}) => {
  const { screenToFlowPosition, flowToScreenPosition, getEdges, getNodes } = useReactFlow();
  const { zoom } = useViewport();
  // Lista reativa: muda a cada movimento de forma, para recalcular os desvios
  const liveNodes = useNodes();
  const edgeData = (data as AdjustableEdgeData) || {};
  const borderRadius = type === 'step' ? 0 : edgeData.borderRadius !== undefined ? edgeData.borderRadius : 16;

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelText, setLabelText] = useState((label as string) || edgeData.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Dragging states for handles
  const [draggingHandle, setDraggingHandle] = useState<'source' | 'target' | 'vert' | 'horiz' | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [dragFlowPos, setDragFlowPos] = useState<EdgePoint | null>(null);
  const [livePoints, setLivePoints] = useState<EdgePoint[] | null>(null);
  const latestLivePointsRef = useRef<EdgePoint[] | null>(null);

  // Single source of truth for reconnection snap during handle drag
  const reconnectCandidateRef = useRef<ReconnectCandidate | null>(null);
  const dragFlowPosRef = useRef<EdgePoint | null>(null);
  const [hoveredCandidate, setHoveredCandidate] = useState<ReconnectCandidate | null>(null);

  useEffect(() => {
    setLabelText((label as string) || edgeData.label || '');
  }, [label, edgeData.label]);

  useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  // Determine current active coordinates for path calculation
  const currentSourceX = draggingHandle === 'source'
    ? (hoveredCandidate ? hoveredCandidate.x : (dragFlowPos ? dragFlowPos.x : sourceX))
    : sourceX;
  const currentSourceY = draggingHandle === 'source'
    ? (hoveredCandidate ? hoveredCandidate.y : (dragFlowPos ? dragFlowPos.y : sourceY))
    : sourceY;
  const currentTargetX = draggingHandle === 'target'
    ? (hoveredCandidate ? hoveredCandidate.x : (dragFlowPos ? dragFlowPos.x : targetX))
    : targetX;
  const currentTargetY = draggingHandle === 'target'
    ? (hoveredCandidate ? hoveredCandidate.y : (dragFlowPos ? dragFlowPos.y : targetY))
    : targetY;

  // Compute current effective points for orthogonal path
  let points: EdgePoint[] = [];

  if (draggingHandle && (draggingHandle === 'vert' || draggingHandle === 'horiz') && livePoints) {
    // Active manual segment drag preview
    points = livePoints;
  } else if (edgeData.manualRouting && Array.isArray(edgeData.controlPoints)) {
    // Frozen / User-defined controlPoints: adapt ONLY endpoints locally without rerouting.
    // Inclui o caso de controlPoints vazio (o usuário arrastou até a linha virar
    // uma reta de 2 pontos) — antes isso caía no ramo de baixo e recalculava a
    // rota automática, fazendo a linha "pular" de volta sozinha.
    const rawPoints = [
      { x: currentSourceX, y: currentSourceY },
      ...edgeData.controlPoints.map((p) => ({ ...p })),
      { x: currentTargetX, y: currentTargetY },
    ];
    points = adaptRouteToEndpoints({
      points: rawPoints,
      source: { x: currentSourceX, y: currentSourceY },
      sourceSide: sourcePosition,
      target: { x: currentTargetX, y: currentTargetY },
      targetSide: targetPosition,
      preserveStraightLine: true,
    });
    points = removeCollinearPoints(points);
  } else {
    // Check if direct straight line can be used
    const allNodes = getNodes();
    if (canUseDirectStraightPath({
      source: { x: currentSourceX, y: currentSourceY },
      target: { x: currentTargetX, y: currentTargetY },
      sourceSide: sourcePosition,
      targetSide: targetPosition,
      nodes: allNodes,
      sourceNodeId: source,
      targetNodeId: target,
      epsilon: 2,
    })) {
      points = [
        { x: currentSourceX, y: currentSourceY },
        { x: currentTargetX, y: currentTargetY },
      ];
    } else {
      // Default orthogonal step route
      points = generateDefaultStepRoute(
        { x: currentSourceX, y: currentSourceY },
        sourcePosition,
        { x: currentTargetX, y: currentTargetY },
        targetPosition
      );
    }
  }


  let path = '';
  let labelX = (currentSourceX + currentTargetX) / 2;
  let labelY = (currentSourceY + currentTargetY) / 2;

  const draggingRoute = Boolean(
    (draggingHandle === 'vert' || draggingHandle === 'horiz') && livePoints,
  );

  if (draggingRoute) {
    // Curva e Reta não têm trechos para arrastar; durante o ajuste a linha é
    // mostrada já no formato ortogonal em que ela vai ficar.
    path = buildRoundedPath(points, borderRadius);
    const midIdx = Math.floor((points.length - 1) / 2);
    if (points.length >= 2) {
      const pA = points[midIdx];
      const pB = points[midIdx + 1] || pA;
      labelX = (pA.x + pB.x) / 2;
      labelY = (pA.y + pB.y) / 2;
    }
  } else if (type === 'straight') {
    const [straightPath, lx, ly] = getStraightPath({
      sourceX: currentSourceX,
      sourceY: currentSourceY,
      targetX: currentTargetX,
      targetY: currentTargetY
    });
    path = straightPath;
    labelX = lx;
    labelY = ly;
  } else if (type === 'default') {
    const [bezierPath, lx, ly] = getBezierPath({
      sourceX: currentSourceX,
      sourceY: currentSourceY,
      sourcePosition,
      targetX: currentTargetX,
      targetY: currentTargetY,
      targetPosition
    });
    path = bezierPath;
    labelX = lx;
    labelY = ly;
  } else {
    // Orthogonal smoothstep / step
    path = buildRoundedPath(points, borderRadius);

    const midIdx = Math.floor((points.length - 1) / 2);
    if (points.length >= 2) {
      const pA = points[midIdx];
      const pB = points[midIdx + 1] || pA;
      labelX = (pA.x + pB.x) / 2;
      labelY = (pA.y + pB.y) / 2;
    }
  }

  // A etiqueta desliza pela própria linha até um trecho livre, para não cobrir
  // nem as formas nem os selos de tempo.
  const labelTextValue = String(labelText || '');
  const estimatedLabelWidth = Math.max(28, labelTextValue.length * 6.2 + 16);
  const labelObstacles = React.useMemo(
    () => collectLabelObstacles(liveNodes as any[], getNodeDimensions),
    [liveNodes],
  );
  if (labelTextValue && !isEditingLabel) {
    const routeForLabel =
      points && points.length >= 2
        ? points
        : [
            { x: currentSourceX, y: currentSourceY },
            { x: labelX, y: labelY },
            { x: currentTargetX, y: currentTargetY },
          ];
    const placed = placeEdgeLabel({
      polyline: routeForLabel as any,
      x: labelX,
      y: labelY,
      width: estimatedLabelWidth,
      height: 20,
      obstacles: labelObstacles,
    });
    labelX = placed.x;
    labelY = placed.y;
  }

  // Calculate segment controls for all orthogonal step paths
  const segmentControls: Array<{
    index: number;
    dir: 'vert' | 'horiz';
    midX: number;
    midY: number;
    length: number;
  }> = [];

  // Em Curva e Reta não existem trechos ortogonais; para que o ajuste continue
  // disponível, as alças são calculadas sobre a rota ortogonal equivalente e o
  // primeiro arraste converte a linha para o traçado Suave (ajustável).
  const convertsOnDrag = (type === 'straight' || type === 'default') && !draggingRoute;
  const handleRoute: EdgePoint[] = convertsOnDrag
    ? generateDefaultStepRoute(
        { x: currentSourceX, y: currentSourceY },
        sourcePosition,
        { x: currentTargetX, y: currentTargetY },
        targetPosition,
      )
    : points;

  if (handleRoute.length >= 2) {
    for (let i = 0; i < handleRoute.length - 1; i++) {
      const p1 = handleRoute[i];
      const p2 = handleRoute[i + 1];
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      // Trechos muito curtos não ganham alça. O limite já caiu de 15px para 8px
      // antes, mas cotos criados logo após um ajuste anterior (perto de um
      // canto) ainda ficavam abaixo disso e sumiam sem alça nenhuma. Baixado
      // para 2px: só um segmento praticamente inexistente fica sem controle.
      const MIN_HANDLE_SEGMENT_LENGTH = 2;
      if (len < MIN_HANDLE_SEGMENT_LENGTH) continue;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Allow controls for orthogonal segments (vertical or horizontal) using float tolerance
      const isVert = dx < 2.5 && dy >= MIN_HANDLE_SEGMENT_LENGTH;
      const isHoriz = dy < 2.5 && dx >= MIN_HANDLE_SEGMENT_LENGTH;

      if (isVert) {
        segmentControls.push({ index: i, dir: 'vert', midX, midY, length: len });
      } else if (isHoriz) {
        segmentControls.push({ index: i, dir: 'horiz', midX, midY, length: len });
      }
    }
  }

  const currentStroke = (style as any)?.stroke || '#0f172a';
  const currentStrokeWidth = selected ? 2.5 : ((style as any)?.strokeWidth || 2);

  // Start dragging individual square endpoint handle
  const handleStartDrag = (endpoint: 'source' | 'target', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setDraggingHandle(endpoint);
    document.body.classList.add('is-dragging-edge-handle');

    const initialFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    dragFlowPosRef.current = initialFlowPos;
    setDragFlowPos(initialFlowPos);

    const excludeNodeId = endpoint === 'source' ? target : source;
    const initialCandidate = resolveReconnectCandidate(initialFlowPos, getNodes(), { excludeNodeId });
    reconnectCandidateRef.current = initialCandidate;
    setHoveredCandidate(initialCandidate);

    const onPointerMove = (moveEv: PointerEvent) => {
      const currentPos = screenToFlowPosition({ x: moveEv.clientX, y: moveEv.clientY });
      dragFlowPosRef.current = currentPos;
      setDragFlowPos(currentPos);

      const candidate = resolveReconnectCandidate(currentPos, getNodes(), { excludeNodeId });
      reconnectCandidateRef.current = candidate;
      setHoveredCandidate(candidate);
    };

    let isFinished = false;
    const onPointerUp = () => {
      if (isFinished) return;
      isFinished = true;

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('is-dragging-edge-handle');

      // CRITICAL: Single candidate source of truth (no recalculations on pointerup)
      const finalCandidate = reconnectCandidateRef.current;
      const finalPos = dragFlowPosRef.current || initialFlowPos;

      if (endpoint === 'source') {
        if (finalCandidate && finalCandidate.kind === 'node-border' && isValidNodeHandleId(finalCandidate.handleId)) {
          window.dispatchEvent(
            new CustomEvent('flow-reconnect-edge', {
              detail: {
                id,
                source: finalCandidate.nodeId,
                sourceHandle: finalCandidate.handleId,
                sourceAnchor: null,
              }
            })
          );
        } else {
          const junctionId = `junction_src_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const newJunction: Node = {
            id: junctionId,
            type: 'junction',
            position: { x: finalPos.x, y: finalPos.y },
            data: { anchorX: finalPos.x, anchorY: finalPos.y, label: '' },
            selected: false,
            selectable: false,
            draggable: false,
            deletable: false,
            focusable: false,
          };
          window.dispatchEvent(
            new CustomEvent('flow-reconnect-edge', {
              detail: {
                id,
                source: junctionId,
                sourceHandle: 'center',
                sourceAnchor: null,
                newNodes: [newJunction],
              }
            })
          );
        }
      } else if (endpoint === 'target') {
        if (finalCandidate && finalCandidate.kind === 'node-border' && isValidNodeHandleId(finalCandidate.handleId)) {
          window.dispatchEvent(
            new CustomEvent('flow-reconnect-edge', {
              detail: {
                id,
                target: finalCandidate.nodeId,
                targetHandle: finalCandidate.handleId,
                targetAnchor: null,
              }
            })
          );
        } else {
          const junctionId = `junction_tgt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const newJunction: Node = {
            id: junctionId,
            type: 'junction',
            position: { x: finalPos.x, y: finalPos.y },
            data: { anchorX: finalPos.x, anchorY: finalPos.y, label: '' },
            selected: false,
            selectable: false,
            draggable: false,
            deletable: false,
            focusable: false,
          };
          window.dispatchEvent(
            new CustomEvent('flow-reconnect-edge', {
              detail: {
                id,
                target: junctionId,
                targetHandle: 'center',
                targetAnchor: null,
                newNodes: [newJunction],
              }
            })
          );
        }
      }

      reconnectCandidateRef.current = null;
      dragFlowPosRef.current = null;
      setDraggingHandle(null);
      setDragFlowPos(null);
      setHoveredCandidate(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleStartSegmentDrag = (dir: 'vert' | 'horiz', segIndex: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.currentTarget && 'setPointerCapture' in e.currentTarget) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback if setPointerCapture throws
      }
    }

    setDraggingHandle(dir);
    setActiveSegmentIndex(segIndex);
    document.body.classList.add('is-dragging-edge-handle');

    const startPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const startPoints = handleRoute.map((p) => ({ ...p }));
    setLivePoints(startPoints);
    latestLivePointsRef.current = startPoints;

    const onPointerMove = (moveEv: PointerEvent) => {
      const currentPos = screenToFlowPosition({ x: moveEv.clientX, y: moveEv.clientY });
      const delta = {
        x: currentPos.x - startPos.x,
        y: currentPos.y - startPos.y,
      };

      const pts = clampSegmentMovement({
        startPoints,
        segIndex,
        dir,
        delta,
        nodes: getNodes(),
        sourceNodeId: source,
        targetNodeId: target,
        sourceSide: sourcePosition,
        targetSide: targetPosition,
      });

      if (process.env.NODE_ENV !== 'production') {
        assertOrthogonalPath(pts);
      }

      latestLivePointsRef.current = pts;
      setLivePoints(pts);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('is-dragging-edge-handle');

      const finalRawPoints = latestLivePointsRef.current || startPoints;

      // Só desfaz o arraste quando o traçado ficou estruturalmente quebrado
      // (menos de dois pontos ou segmento fora do eixo). Passar perto de uma
      // forma não desfaz mais o ajuste: antes qualquer encostão devolvia a
      // linha à posição inicial e dava a impressão de que o ajuste não pegava.
      const structurallyValid =
        Array.isArray(finalRawPoints) &&
        finalRawPoints.length >= 2 &&
        isOrthogonalRoute(finalRawPoints);
      const pointsToSave = structurallyValid ? finalRawPoints : startPoints;
      const newControlPoints = pointsToSave.slice(1, pointsToSave.length - 1);

      window.dispatchEvent(
        new CustomEvent('flow-update-edge-data', {
          detail: {
            id,
            data: {
              controlPoints: newControlPoints,
              manualRouting: true,
            },
          },
        })
      );

      if (convertsOnDrag) {
        window.dispatchEvent(
          new CustomEvent('flow-update-edge-type', { detail: { id, type: 'smoothstep' } }),
        );
        showToast({
          message: 'Traçado alterado para "Suave" — é o formato que permite ajustar os trechos da linha.',
          timeout: 9000,
        });
      }

      setDraggingHandle(null);
      setActiveSegmentIndex(null);
      setLivePoints(null);
      latestLivePointsRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const saveLabel = () => {
    setIsEditingLabel(false);
    window.dispatchEvent(
      new CustomEvent('flow-update-edge-label', {
        detail: { id, label: labelText.trim() }
      })
    );
  };

  return (
    <>
      {/* 1. Main Connection Path */}
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={32}
        style={{
          ...style,
          strokeWidth: currentStrokeWidth,
          stroke: selected || draggingHandle ? '#0066ff' : currentStroke,
          strokeDasharray: draggingHandle ? '5,4' : (style as any)?.strokeDasharray
        }}
      />

      {/* 2. Draw.io Style Selected Path Highlight */}
      {selected && !draggingHandle && (
        <path
          d={path}
          fill="none"
          stroke="#0066ff"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          className="pointer-events-none opacity-80"
        />
      )}

      {/* Snap Target Indicator during Dragging */}
      {hoveredCandidate && (
        <g className="pointer-events-none">
          <circle
            cx={hoveredCandidate.x}
            cy={hoveredCandidate.y}
            r={10}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2.5}
            strokeDasharray="3,3"
          />
          <circle
            cx={hoveredCandidate.x}
            cy={hoveredCandidate.y}
            r={4}
            fill="#2563eb"
          />
        </g>
      )}

      {/* 3. Interactive Handles (Endpoints + Segment Drag Handles) */}
      {(selected || draggingHandle) && (
        <g className="drawio-edge-interactive-handles">
          {/* Segment Drag Handles - Hidden during active drag to prevent jump/recalculation */}
          {!draggingHandle && segmentControls.map((ctrl) => (
            <g
              key={`seg-ctrl-${ctrl.index}`}
              className={`group ${ctrl.dir === 'vert' ? 'cursor-ew-resize' : 'cursor-ns-resize'}`}
              onPointerDown={(e) => handleStartSegmentDrag(ctrl.dir, ctrl.index, e)}
              style={{ pointerEvents: 'all' }}
            >
              {/* Stable transparent hit area (no transforms/scale) */}
              <rect
                x={ctrl.midX - 10}
                y={ctrl.midY - 10}
                width={20}
                height={20}
                fill="transparent"
              />
              {/* Visual box - fixed position/size, smooth color transition on group hover */}
              <rect
                x={ctrl.midX - 7}
                y={ctrl.midY - 7}
                width={14}
                height={14}
                rx={3}
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth={1.5}
                className="pointer-events-none shadow-sm transition-colors duration-150 group-hover:fill-sky-50 group-hover:stroke-sky-700"
              />
              {/* Visual text icon - fixed position, smooth color transition on group hover */}
              <text
                x={ctrl.midX}
                y={ctrl.midY + 3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="#0284c7"
                className="pointer-events-none select-none transition-colors duration-150 group-hover:fill-sky-700"
              >
                {ctrl.dir === 'vert' ? '↔' : '↕'}
              </text>
            </g>
          ))}

          {/* Source Endpoint Blue Circle Handle */}
          <g
            className="group cursor-crosshair"
            onPointerDown={(e) => handleStartDrag('source', e)}
            style={{ pointerEvents: 'all' }}
          >
            {/* Stable transparent hit area (r=14) */}
            <circle cx={currentSourceX} cy={currentSourceY} r={14} fill="transparent" className="cursor-crosshair" />
            {/* Visual circle - fixed position & radius, smooth color transition on group hover */}
            <circle
              cx={currentSourceX}
              cy={currentSourceY}
              r={5.5}
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth={1.5}
              className="pointer-events-none drop-shadow-sm transition-colors duration-150 group-hover:fill-sky-700 group-hover:stroke-sky-100"
            />
          </g>

          {/* Target Endpoint Blue Circle Handle */}
          <g
            className="group cursor-crosshair"
            onPointerDown={(e) => handleStartDrag('target', e)}
            style={{ pointerEvents: 'all' }}
          >
            {/* Stable transparent hit area (r=14) */}
            <circle cx={currentTargetX} cy={currentTargetY} r={14} fill="transparent" className="cursor-crosshair" />
            {/* Visual circle - fixed position & radius, smooth color transition on group hover */}
            <circle
              cx={currentTargetX}
              cy={currentTargetY}
              r={5.5}
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth={1.5}
              className="pointer-events-none drop-shadow-sm transition-colors duration-150 group-hover:fill-sky-700 group-hover:stroke-sky-100"
            />
          </g>
        </g>
      )}

      {/* 4. On-Path Commands & Inline Text Editor */}
      <EdgeLabelRenderer>
        {isEditingLabel ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all'
            }}
            className="nodrag nopan z-50 flex items-center bg-white shadow-md rounded-lg border border-blue-500 p-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveLabel();
                if (e.key === 'Escape') {
                  setIsEditingLabel(false);
                  setLabelText((label as string) || '');
                }
              }}
              onBlur={saveLabel}
              placeholder="Rótulo da linha..."
              className="px-2 py-0.5 text-xs text-zinc-900 outline-none w-36 font-medium bg-transparent"
            />
            <button
              onClick={saveLabel}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
              title="Salvar (Enter)"
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <>
            {labelText ? (
              <div
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                  pointerEvents: 'all'
                }}
                className={`nodrag nopan z-30 select-none px-2 py-0.5 rounded text-[11px] font-medium text-zinc-800 bg-white/95 border border-zinc-200/90 shadow-2xs cursor-text transition-all ${
                  selected ? 'ring-1 ring-blue-400 bg-blue-50/50' : 'hover:bg-white'
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingLabel(true);
                }}
                title="Clique duplo para editar o texto diretamente na linha"
              >
                {labelText}
              </div>
            ) : null}
          </>
        )}
      </EdgeLabelRenderer>
    </>
  );
};
