import React, { useState, useRef, useEffect } from 'react';
import { MarkerType, useReactFlow } from '@xyflow/react';

interface DrawioFloatingEdgeToolbarProps {
  edgeId: string;
  type?: string;
  markerEnd?: any;
  markerStart?: any;
  style?: Record<string, any>;
  animated?: boolean;
  position: { x: number; y: number };
}

export const DrawioFloatingEdgeToolbar: React.FC<DrawioFloatingEdgeToolbarProps> = ({
  edgeId,
  type = 'smoothstep',
  markerEnd,
  markerStart,
  style = {},
  animated = false,
  position
}) => {
  const { setEdges } = useReactFlow();
  const [activeMenu, setActiveMenu] = useState<'start' | 'end' | 'route' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const edgeStyle = (style || {}) as Record<string, any>;
  const currentStrokeColor = (edgeStyle.stroke as string) || '#0f172a';
  const isDashed = edgeStyle.strokeDasharray === '5,5';
  const isDotted = edgeStyle.strokeDasharray === '2,2';

  // Determine current glyphs
  const getStartGlyph = () => {
    if (!markerStart) return '—';
    if (markerStart.type === MarkerType.ArrowClosed) return '←';
    if (markerStart.type === MarkerType.Arrow) return '≺';
    return '●';
  };

  const getEndGlyph = () => {
    if (!markerEnd && !markerStart) return '—';
    if (markerStart && markerEnd) return '↔';
    if (markerEnd?.type === MarkerType.ArrowClosed) return '→';
    if (markerEnd?.type === MarkerType.Arrow) return '>';
    return '—';
  };

  const getRouteGlyph = () => {
    if (type === 'step') return '⌐';
    if (type === 'straight') return '/';
    if (type === 'default') return '~';
    return '╭'; // smoothstep (curva nos cantos)
  };

  const updateEdge = (updater: (prevEdge: any) => any) => {
    setEdges((edges) =>
      edges.map((e) => {
        if (e.id === edgeId) {
          return updater(e);
        }
        return e;
      })
    );
    // Dispatch history checkpoint
    window.dispatchEvent(
      new CustomEvent('flow-history-checkpoint', {
        detail: { action: 'Alterou estilo da linha (Draw.io)' }
      })
    );
  };

  // 1. Set Start Marker
  const handleSetStartMarker = (mode: 'none' | 'arrowClosed' | 'arrowOpen' | 'circle') => {
    updateEdge((e) => {
      let nextMarkerStart = undefined;
      if (mode === 'arrowClosed') {
        nextMarkerStart = { type: MarkerType.ArrowClosed, color: currentStrokeColor, orient: 'auto-start-reverse' };
      } else if (mode === 'arrowOpen') {
        nextMarkerStart = { type: MarkerType.Arrow, color: currentStrokeColor, orient: 'auto-start-reverse' };
      }
      return {
        ...e,
        markerStart: nextMarkerStart
      };
    });
    setActiveMenu(null);
  };

  // 2. Set End Marker
  const handleSetEndMarker = (mode: 'none' | 'arrowClosed' | 'arrowOpen' | 'both') => {
    updateEdge((e) => {
      let nextMarkerEnd = undefined;
      let nextMarkerStart = e.markerStart;

      if (mode === 'none') {
        nextMarkerEnd = undefined;
        nextMarkerStart = undefined;
      } else if (mode === 'arrowClosed') {
        nextMarkerEnd = { type: MarkerType.ArrowClosed, color: currentStrokeColor };
      } else if (mode === 'arrowOpen') {
        nextMarkerEnd = { type: MarkerType.Arrow, color: currentStrokeColor };
      } else if (mode === 'both') {
        nextMarkerEnd = { type: MarkerType.ArrowClosed, color: currentStrokeColor };
        nextMarkerStart = { type: MarkerType.ArrowClosed, color: currentStrokeColor, orient: 'auto-start-reverse' };
      }

      return {
        ...e,
        markerEnd: nextMarkerEnd,
        markerStart: nextMarkerStart
      };
    });
    setActiveMenu(null);
  };

  // 3. Set Routing Type
  const handleSetRouteType = (newType: 'step' | 'smoothstep' | 'straight' | 'default') => {
    updateEdge((e) => ({
      ...e,
      type: newType
    }));
    setActiveMenu(null);
  };

  // 4. Set Line Pattern
  const handleSetPattern = (pattern: 'solid' | 'dashed' | 'dotted') => {
    let strokeDasharray = undefined;
    if (pattern === 'dashed') strokeDasharray = '5,5';
    if (pattern === 'dotted') strokeDasharray = '2,2';

    updateEdge((e) => ({
      ...e,
      style: {
        ...(e.style || {}),
        strokeDasharray
      }
    }));
    setActiveMenu(null);
  };

  // 5. Toggle Animation
  const handleToggleAnimated = () => {
    updateEdge((e) => ({
      ...e,
      animated: !e.animated
    }));
  };

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -100%) translate(${position.x}px, ${position.y - 12}px)`,
        pointerEvents: 'all'
      }}
      className="nodrag nopan z-50 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DRAW.IO PILL FLOATING CONTAINER */}
      <div className="bg-[#1e1e1e]/95 text-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-700/80 px-2.5 py-1.5 flex items-center gap-2 transition-all">
        
        {/* BUTTON 1: Start Point / Line Style */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'start' ? null : 'start')}
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-sm font-semibold transition-colors cursor-pointer ${
              activeMenu === 'start' ? 'bg-blue-600 text-white' : 'text-zinc-200'
            }`}
            title="Extremidade Inicial da Linha"
          >
            {getStartGlyph()}
          </button>

          {/* Start Point Popover */}
          {activeMenu === 'start' && (
            <div className="absolute bottom-9 left-0 bg-[#252528] text-white rounded-xl shadow-2xl border border-zinc-700 p-1.5 min-w-[130px] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="text-[10px] font-semibold text-zinc-400 px-2 py-0.5 uppercase tracking-wider">Início</div>
              <button
                onClick={() => handleSetStartMarker('none')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">—</span>
                <span>Sem Ponta</span>
              </button>
              <button
                onClick={() => handleSetStartMarker('arrowClosed')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">←</span>
                <span>Seta Fechada</span>
              </button>
              <button
                onClick={() => handleSetStartMarker('arrowOpen')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">≺</span>
                <span>Seta Aberta</span>
              </button>
            </div>
          )}
        </div>

        {/* BUTTON 2: End Point / Direction */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'end' ? null : 'end')}
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-sm font-semibold transition-colors cursor-pointer ${
              activeMenu === 'end' ? 'bg-blue-600 text-white' : 'text-zinc-200'
            }`}
            title="Extremidade Final / Ponta da Seta"
          >
            {getEndGlyph()}
          </button>

          {/* End Point Popover */}
          {activeMenu === 'end' && (
            <div className="absolute bottom-9 left-1/2 -translate-x-1/2 bg-[#252528] text-white rounded-xl shadow-2xl border border-zinc-700 p-1.5 min-w-[130px] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="text-[10px] font-semibold text-zinc-400 px-2 py-0.5 uppercase tracking-wider">Ponta da Seta</div>
              <button
                onClick={() => handleSetEndMarker('arrowClosed')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">→</span>
                <span>Seta Fechada</span>
              </button>
              <button
                onClick={() => handleSetEndMarker('arrowOpen')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">&gt;</span>
                <span>Seta Aberta</span>
              </button>
              <button
                onClick={() => handleSetEndMarker('both')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">↔</span>
                <span>Seta Dupla</span>
              </button>
              <button
                onClick={() => handleSetEndMarker('none')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 text-xs text-left"
              >
                <span className="font-bold text-sm w-4 text-center">—</span>
                <span>Sem Seta (Linha)</span>
              </button>
            </div>
          )}
        </div>

        {/* BUTTON 3: Line Type / Routing (Orthogonal ⌐, Smoothstep ╭, Straight /, Bezier ~) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'route' ? null : 'route')}
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-sm font-semibold transition-colors cursor-pointer ${
              activeMenu === 'route' ? 'bg-blue-600 text-white' : 'text-zinc-200'
            }`}
            title="Formato da Linha (Ortogonal, Reta, Curva)"
          >
            {getRouteGlyph()}
          </button>

          {/* Route & Line Style Popover */}
          {activeMenu === 'route' && (
            <div className="absolute bottom-9 right-0 bg-[#252528] text-white rounded-xl shadow-2xl border border-zinc-700 p-2 min-w-[170px] flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100 z-50">
              <div>
                <div className="text-[10px] font-semibold text-zinc-400 px-1 py-0.5 uppercase tracking-wider">Formato da Linha</div>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <button
                    onClick={() => handleSetRouteType('step')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      type === 'step' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                    title="Ângulos retos 90° precisos"
                  >
                    <span className="font-bold text-sm">⌐</span>
                    <span>Ortogonal</span>
                  </button>

                  <button
                    onClick={() => handleSetRouteType('smoothstep')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      type === 'smoothstep' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                    title="Ortogonal com cantos arredondados"
                  >
                    <span className="font-bold text-sm">╭</span>
                    <span>Suave</span>
                  </button>

                  <button
                    onClick={() => handleSetRouteType('straight')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      type === 'straight' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                    title="Linha Reta Direta"
                  >
                    <span className="font-bold text-sm">/</span>
                    <span>Reta</span>
                  </button>

                  <button
                    onClick={() => handleSetRouteType('default')}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      type === 'default' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                    title="Curva Bézier Orgânica"
                  >
                    <span className="font-bold text-sm">~</span>
                    <span>Curva</span>
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-700" />

              <div>
                <div className="text-[10px] font-semibold text-zinc-400 px-1 py-0.5 uppercase tracking-wider">Padrão do Traço</div>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <button
                    onClick={() => handleSetPattern('solid')}
                    className={`px-2 py-1 rounded text-xs text-center font-medium ${
                      !isDashed && !isDotted ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    Sólida
                  </button>
                  <button
                    onClick={() => handleSetPattern('dashed')}
                    className={`px-2 py-1 rounded text-xs text-center font-medium ${
                      isDashed ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    Tracejada
                  </button>
                  <button
                    onClick={() => handleSetPattern('dotted')}
                    className={`px-2 py-1 rounded text-xs text-center font-medium ${
                      isDotted ? 'bg-blue-600 text-white' : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    Pontilhada
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-700" />

              <button
                onClick={handleToggleAnimated}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  animated ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                <span>⚡ Fluxo Animado</span>
                <span className="text-[10px]">{animated ? 'Ativo' : 'Desligado'}</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
