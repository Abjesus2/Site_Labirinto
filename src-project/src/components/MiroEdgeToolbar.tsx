import React, { useState, useEffect } from 'react';
import { Edge, Node, MarkerType } from '@xyflow/react';
import {
  ArrowRight,
  ArrowLeftRight,
  Minus,
  Trash2,
  Workflow,
  Check,
  ChevronRight,
  X,
  Palette,
  Sliders,
  Share2,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
  Type
} from 'lucide-react';

interface MiroEdgeToolbarProps {
  edge?: Edge;
  selectedEdges?: Edge[];
  nodes?: Node[];
  onUpdateEdge: (id: string, updates: Partial<Edge>) => void;
  onUpdateBulkEdge?: (updates: Partial<Edge>) => void;
  onDeleteEdge: (id: string) => void;
  onDeleteBulkEdge?: (ids: string[]) => void;
  onStartReconnecting?: (endpoint: 'source' | 'target') => void;
  reconnectingEndpoint?: 'source' | 'target' | null;
  onCloseToolbar?: () => void;
  onHideSidebar?: () => void;
  onApplyZIndexAll?: (target: 'front' | 'back') => void;
}

const EDGE_COLORS = [
  { name: 'Preto', color: '#0f172a' },
  { name: 'Azul', color: '#2563eb' },
  { name: 'Verde', color: '#16a34a' },
  { name: 'Vermelho', color: '#dc2626' },
  { name: 'Roxo', color: '#9333ea' },
  { name: 'Laranja', color: '#ea580c' },
  { name: 'Cinza', color: '#64748b' },
  { name: 'Amarelo', color: '#ca8a04' },
];

const PRESET_LABELS = ['Sim', 'Não', 'Sucesso', 'Falha', 'Aprovado', 'Rejeitado', 'OK', 'Erro'];

export const MiroEdgeToolbar: React.FC<MiroEdgeToolbarProps> = ({
  edge,
  selectedEdges = [],
  nodes = [],
  onUpdateEdge,
  onUpdateBulkEdge,
  onDeleteEdge,
  onDeleteBulkEdge,
  onStartReconnecting,
  reconnectingEndpoint,
  onCloseToolbar,
  onHideSidebar,
  onApplyZIndexAll
}) => {
  const isMultiple = selectedEdges.length > 1;
  const activeEdge = edge || selectedEdges[0];

  const [tempLabel, setTempLabel] = useState(activeEdge?.label ? String(activeEdge.label) : '');

  useEffect(() => {
    if (activeEdge) {
      setTempLabel(activeEdge.label ? String(activeEdge.label) : '');
    }
  }, [activeEdge?.label, activeEdge?.id]);

  if (!activeEdge) return null;

  const currentType = activeEdge.type || 'smoothstep';
  const isAnimated = !!activeEdge.animated;
  const isDashed = activeEdge.style?.strokeDasharray === '5,5';
  const isDotted = activeEdge.style?.strokeDasharray === '2,2';
  const strokeColor = (activeEdge.style?.stroke as string) || '#0f172a';
  const strokeWidth = parseInt((activeEdge.style?.strokeWidth as string) || '2', 10);
  const isUnderEvaluation = !!activeEdge.data?.needsEvaluation || !!activeEdge.data?.isDubious;

  const applyEdgeUpdate = (updates: Partial<Edge>) => {
    if (isMultiple && onUpdateBulkEdge) {
      onUpdateBulkEdge(updates);
    } else if (isMultiple) {
      selectedEdges.forEach(e => onUpdateEdge(e.id, updates));
    } else {
      onUpdateEdge(activeEdge.id, updates);
    }
  };

  const handleDelete = () => {
    if (isMultiple && onDeleteBulkEdge) {
      onDeleteBulkEdge(selectedEdges.map(e => e.id));
    } else if (isMultiple) {
      selectedEdges.forEach(e => onDeleteEdge(e.id));
    } else {
      onDeleteEdge(activeEdge.id);
    }
  };

  const setLineType = (type: 'smoothstep' | 'straight' | 'default' | 'step' | 'adjustable') => {
    applyEdgeUpdate({ type });
  };

  const toggleAnimated = () => {
    applyEdgeUpdate({ animated: !isAnimated });
  };

  const setLinePattern = (pattern: 'solid' | 'dashed' | 'dotted') => {
    const currentStyle = activeEdge.style || {};
    let strokeDasharray = undefined;
    if (pattern === 'dashed') strokeDasharray = '5,5';
    if (pattern === 'dotted') strokeDasharray = '2,2';
    
    applyEdgeUpdate({
      style: {
        ...currentStyle,
        strokeDasharray
      }
    });
  };

  const isFront = activeEdge.data?.isFront ?? false;

  const setZIndexMode = (target: 'front' | 'back') => {
    const shouldBeFront = target === 'front';
    applyEdgeUpdate({
      zIndex: shouldBeFront ? 1000 : -1,
      data: {
        ...(activeEdge.data || {}),
        isFront: shouldBeFront,
        isCustomZIndex: true
      }
    });
  };

  const setArrowType = (mode: 'end' | 'both' | 'none' | 'open') => {
    if (mode === 'none') {
      applyEdgeUpdate({ markerEnd: undefined, markerStart: undefined });
    } else if (mode === 'end') {
      applyEdgeUpdate({
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        markerStart: undefined
      });
    } else if (mode === 'open') {
      applyEdgeUpdate({
        markerEnd: { type: MarkerType.Arrow, color: strokeColor },
        markerStart: undefined
      });
    } else if (mode === 'both') {
      applyEdgeUpdate({
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        markerStart: { type: MarkerType.ArrowClosed, color: strokeColor, orient: 'auto-start-reverse' }
      });
    }
  };

  const setStrokeColor = (color: string) => {
    const currentStyle = activeEdge.style || {};
    applyEdgeUpdate({
      style: { ...currentStyle, stroke: color },
      markerEnd: activeEdge.markerEnd ? { ...activeEdge.markerEnd, color } : undefined,
      markerStart: activeEdge.markerStart ? { ...activeEdge.markerStart, color } : undefined
    });
  };

  const setStrokeWidth = (w: number) => {
    const currentStyle = activeEdge.style || {};
    applyEdgeUpdate({
      style: { ...currentStyle, strokeWidth: `${w}px` }
    });
  };

  const handleSaveLabel = () => {
    if (!isMultiple) {
      onUpdateEdge(activeEdge.id, { label: tempLabel.trim() === '' ? undefined : tempLabel });
    }
  };

  const handleSetPresetLabel = (txt: string) => {
    setTempLabel(txt);
    onUpdateEdge(activeEdge.id, { label: txt });
  };

  const handleSwapDirection = () => {
    if (!isMultiple) {
      onUpdateEdge(activeEdge.id, {
        source: activeEdge.target,
        target: activeEdge.source,
        sourceHandle: activeEdge.targetHandle || 'bottom',
        targetHandle: activeEdge.sourceHandle || 'top'
      });
    }
  };

  // Trocar a forma ou o lado/ponto de conexão por aqui é a mesma ideia de
  // arrastar a bolinha da linha até outro lugar — fixa a rota como manual
  // (ver comentário equivalente em handleReconnectEdgeEvent no FlowEditor),
  // senão mover a forma ligada desfazia essa escolha sozinho.
  const handleChangeNode = (endpoint: 'source' | 'target', nodeId: string) => {
    if (!isMultiple) {
      onUpdateEdge(activeEdge.id, {
        [endpoint]: nodeId,
        data: { ...(activeEdge.data || {}), controlPoints: undefined, manualRouting: true }
      });
    }
  };

  const handleChangeHandle = (endpoint: 'source' | 'target', handleId: string) => {
    if (!isMultiple) {
      onUpdateEdge(activeEdge.id, {
        [endpoint === 'source' ? 'sourceHandle' : 'targetHandle']: handleId,
        data: { ...(activeEdge.data || {}), controlPoints: undefined, manualRouting: true }
      });
    }
  };

  // Posição do texto na linha (ver AdjustableEdge): automático segue a linha
  // num ponto 0..1 (labelT); manual fica fixo em labelPos.
  const labelMode: 'auto' | 'manual' = (activeEdge.data as any)?.labelMode === 'manual' ? 'manual' : 'auto';
  const rawLabelT = (activeEdge.data as any)?.labelT;
  const labelPercent = Math.round((typeof rawLabelT === 'number' ? rawLabelT : 0.5) * 100);
  const setLabelMode = (mode: 'auto' | 'manual') => {
    if (mode === labelMode) return;
    const nextData: any = { ...(activeEdge.data || {}), labelMode: mode };
    // Nos dois sentidos a posição fixa antiga é descartada: indo para o
    // manual, a própria linha (AdjustableEdge) congela o texto onde ele está
    // agora; voltando ao automático, ele volta a seguir a linha.
    delete nextData.labelPos;
    applyEdgeUpdate({ data: nextData });
  };
  const setLabelT = (t: number) => {
    applyEdgeUpdate({ data: { ...(activeEdge.data || {}), labelMode: 'auto', labelT: Math.min(1, Math.max(0, t)) } });
  };
  const resetLabelPosition = () => {
    const nextData: any = { ...(activeEdge.data || {}), labelMode: 'auto' };
    delete nextData.labelPos;
    delete nextData.labelT;
    applyEdgeUpdate({ data: nextData });
  };

  const isAutoRouting = !(activeEdge.data?.manualRouting ?? false);
  const toggleAutoRouting = () => {
    applyEdgeUpdate({
      data: { ...(activeEdge.data || {}), manualRouting: isAutoRouting }
    });
  };

  const toggleEvaluationStatus = () => {
    const currentData = activeEdge.data || {};
    const newStatus = !isUnderEvaluation;
    applyEdgeUpdate({
      data: {
        ...currentData,
        needsEvaluation: newStatus,
        isDubious: newStatus
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-white select-none text-zinc-800">
      {/* SIDEBAR HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/80">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
            <Workflow size={16} />
          </div>
          <div className="truncate min-w-0">
            <h3 className="text-xs font-bold text-zinc-900 truncate">
              {isMultiple ? `${selectedEdges.length} Conexões Selecionadas` : (activeEdge.label ? `Linha: ${activeEdge.label}` : 'Linha de Conexão')}
            </h3>
            <p className="text-[10px] text-zinc-500 font-medium">
              {isMultiple ? 'Edição em Massa de Conexões' : 'Configurações de Fluxo'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onHideSidebar && (
            <button
              onClick={onHideSidebar}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-lg transition-colors cursor-pointer"
              title="Ocultar Painel Lateral"
            >
              <ChevronRight size={18} />
            </button>
          )}
          {onCloseToolbar && (
            <button
              onClick={onCloseToolbar}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      {/* SIDEBAR BODY (SCROLLABLE SECTIONS) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* AUDIT & EVALUATION STATUS SECTION (SEPARATE FROM COLOR) */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-900">
              <AlertCircle size={14} className={isUnderEvaluation ? 'text-amber-600 animate-pulse' : 'text-zinc-400'} />
              <span className="text-xs font-bold">Avaliação do Fluxo</span>
            </div>
            {isUnderEvaluation && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-900 rounded-md">
                Em Avaliação
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-zinc-600 leading-tight">
            Marque esta conexão se ela precisa ser validada pela equipe, independente da cor visual escolhida.
          </p>
          <button
            type="button"
            onClick={toggleEvaluationStatus}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isUnderEvaluation
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {isUnderEvaluation ? (
              <>
                <CheckCircle2 size={13} />
                <span>Marcada para Avaliação (Clique p/ Concluir)</span>
              </>
            ) : (
              <>
                <AlertCircle size={13} className="text-amber-600" />
                <span>Marcar Linha para ser Avaliada</span>
              </>
            )}
          </button>
        </div>

        {/* SECTION 1: EDGE LABEL (SINGLE ONLY) */}
        {!isMultiple && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Texto da Seta
            </label>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                onBlur={handleSaveLabel}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
                placeholder="Ex: Aprovado, Sim, Não..."
                className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-zinc-800"
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_LABELS.map(lbl => (
                  <button
                    key={lbl}
                    onClick={() => handleSetPresetLabel(lbl)}
                    className="px-2 py-1 bg-white border border-zinc-200 hover:border-blue-300 hover:bg-blue-50 text-zinc-600 hover:text-blue-700 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: LINE STYLE (CURVE / STRAIGHT / ORTHOGONAL) */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Estilo do Traçado
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setLineType('default')}
              className={`py-2 px-1 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                currentType === 'default' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Curva
            </button>
            <button
              onClick={() => setLineType('straight')}
              className={`py-2 px-1 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                currentType === 'straight' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Reta
            </button>
            <button
              onClick={() => setLineType('smoothstep')}
              className={`py-2 px-1 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                currentType === 'smoothstep' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Suave
            </button>
            <button
              onClick={() => setLineType('step')}
              className={`py-2 px-1 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                currentType === 'step' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              Angular
            </button>
          </div>
          
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setLinePattern('solid')}
                className={`py-1.5 px-2 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                  !isDashed && !isDotted ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Sólida
              </button>
              <button
                onClick={() => setLinePattern('dashed')}
                className={`py-1.5 px-2 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                  isDashed ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Tracejada
              </button>
              <button
                onClick={() => setLinePattern('dotted')}
                className={`py-1.5 px-2 text-center rounded-xl border text-[10px] font-medium cursor-pointer ${
                  isDotted ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Pontilhado
              </button>
            </div>
            
            <button
              onClick={toggleAnimated}
              className={`w-full py-1.5 px-2 text-center flex items-center justify-center gap-1 rounded-xl border text-xs font-medium cursor-pointer ${
                isAnimated ? 'bg-purple-50 border-purple-400 text-purple-700 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {isAnimated ? '⚡ Fluxo Animado Ativo' : 'Fluxo Estático'}
            </button>
          </div>
        </div>

        {/* SECTION: CAMADA / PROFUNDIDADE DA LINHA (Z-INDEX) */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-zinc-600" />
              Camada da Linha
            </label>
            <span className="text-[10px] text-zinc-400 font-medium">
              {isFront ? 'Por Cima das Formas' : 'Por Trás das Formas'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setZIndexMode('back')}
              className={`py-2 px-2.5 text-center flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                !isFront
                  ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-2xs font-bold'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
              title="A linha passa por trás dos nós/formas (comportamento padrão)"
            >
              <ArrowDownToLine size={14} className={!isFront ? 'text-blue-600' : 'text-zinc-400'} />
              Por Trás
            </button>

            <button
              onClick={() => setZIndexMode('front')}
              className={`py-2 px-2.5 text-center flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                isFront
                  ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-2xs font-bold'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
              title="A linha passa por cima dos nós/formas"
            >
              <ArrowUpToLine size={14} className={isFront ? 'text-amber-600' : 'text-zinc-400'} />
              Por Cima
            </button>
          </div>

          {onApplyZIndexAll && (
            <button
              onClick={() => onApplyZIndexAll(isFront ? 'front' : 'back')}
              className="w-full py-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer font-medium"
              title="Aplicar esta mesma configuração a todas as linhas do diagrama"
            >
              <Layers size={12} />
              Aplicar para todas as linhas
            </button>
          )}
        </div>

        {/* SECTION: AJUSTE AUTOMÁTICO DO PONTO DE CONEXÃO */}
        {!isMultiple && (
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                {isAutoRouting ? <Unlock size={13} className="text-zinc-600" /> : <Lock size={13} className="text-zinc-600" />}
                Ponto de Conexão
              </label>
              <span className="text-[10px] text-zinc-400 font-medium">
                {isAutoRouting ? 'Automático' : 'Fixo (manual)'}
              </span>
            </div>

            <button
              onClick={toggleAutoRouting}
              className={`w-full py-2 px-2.5 text-center flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                isAutoRouting
                  ? 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  : 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs font-bold'
              }`}
              title={
                isAutoRouting
                  ? 'O ponto de conexão está livre: se você arrastar a bolinha da linha pra outro lado da forma, ele fica fixo automaticamente'
                  : 'Voltar a recalcular o lado/ponto de conexão sozinho sempre que a forma ligada for movida'
              }
            >
              {isAutoRouting ? <Unlock size={14} className="text-zinc-400" /> : <Lock size={14} className="text-emerald-600" />}
              {isAutoRouting ? 'Ligar Ajuste Automático' : 'Ajuste Automático Desligado'}
            </button>
            <p className="text-[10px] text-zinc-400 leading-snug px-0.5">
              {isAutoRouting
                ? 'Ao arrastar a bolinha da linha para outro lado da forma, o ponto escolhido fica fixo — não muda mais sozinho quando a forma se move.'
                : 'O ponto de conexão desta linha foi ajustado manualmente e não muda mais quando a forma ligada é movida. Clique acima para voltar ao ajuste automático.'}
            </p>
          </div>
        )}

        {/* SECTION: POSIÇÃO DO TEXTO NA LINHA */}
        {!isMultiple && activeEdge.label ? (
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Type size={13} className="text-zinc-600" />
                Posição do Texto
              </label>
              <span className="text-[10px] text-zinc-400 font-medium">
                {labelMode === 'manual' ? 'Manual (fixo)' : 'Automático'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setLabelMode('auto')}
                className={`py-1.5 px-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  labelMode === 'auto' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
                title="O texto acompanha a linha quando as formas se movem"
              >
                Automático
              </button>
              <button
                onClick={() => setLabelMode('manual')}
                className={`py-1.5 px-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  labelMode === 'manual' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
                title="O texto fica onde você posicionar, mesmo movendo as formas"
              >
                Manual
              </button>
            </div>
            {labelMode === 'auto' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 w-9">Início</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={labelPercent}
                    onChange={(e) => setLabelT(Number(e.target.value) / 100)}
                    className="flex-1 accent-blue-600 cursor-pointer"
                    aria-label="Posição do texto ao longo da linha"
                  />
                  <span className="text-[10px] text-zinc-400 w-6 text-right">Fim</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Início', t: 0.15 },
                    { label: 'Meio', t: 0.5 },
                    { label: 'Fim', t: 0.85 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setLabelT(opt.t)}
                      className={`py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-all ${
                        Math.abs(labelPercent / 100 - opt.t) < 0.01
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                onClick={resetLabelPosition}
                className="w-full py-1.5 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-all"
              >
                Voltar ao meio (automático)
              </button>
            )}
            <p className="text-[10px] text-zinc-400 leading-snug px-0.5">
              {labelMode === 'manual'
                ? 'O texto fica onde você soltar e não muda ao mover as formas. Arraste o texto na linha selecionada para reposicionar.'
                : 'O texto nasce no meio e acompanha a linha quando as formas se movem. Arraste o texto na linha selecionada (ou use a barra) para escolher o ponto.'}
            </p>
          </div>
        ) : null}

        {/* SECTION 3: COLOR & STROKE WIDTH */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Cor da Linha
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {EDGE_COLORS.map((c) => (
              <button
                key={c.color}
                onClick={() => setStrokeColor(c.color)}
                className="w-8 h-8 rounded-xl border border-zinc-200 flex items-center justify-center hover:scale-110 transition-transform shadow-2xs cursor-pointer"
                style={{ backgroundColor: c.color }}
                title={c.name}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-600 font-medium">Cor Personalizada:</span>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-6 h-6 rounded-md border border-zinc-200 cursor-pointer p-0"
            />
          </div>

          {/* Stroke Width */}
          <div className="flex items-center justify-between bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 mt-2">
            <span className="text-xs font-medium text-zinc-600">Espessura da Linha:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    strokeWidth === w
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: ARROWS / MARKERS */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Extremidades & Setas
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setArrowType('end')}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-blue-50 hover:text-blue-700 text-zinc-700 font-medium cursor-pointer"
            >
              <ArrowRight size={14} />
              <span>Preenchida</span>
            </button>
            <button
              onClick={() => setArrowType('open')}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-blue-50 hover:text-blue-700 text-zinc-700 font-medium cursor-pointer"
            >
              <ArrowRight size={14} className="opacity-70" />
              <span>Aberta</span>
            </button>
            <button
              onClick={() => setArrowType('both')}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-blue-50 hover:text-blue-700 text-zinc-700 font-medium cursor-pointer"
            >
              <ArrowLeftRight size={14} />
              <span>Seta Dupla</span>
            </button>
            <button
              onClick={() => setArrowType('none')}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-blue-50 hover:text-blue-700 text-zinc-700 font-medium cursor-pointer"
            >
              <Minus size={14} />
              <span>Sem Setas</span>
            </button>
          </div>
        </div>

        {/* SECTION 5: ENDPOINTS & RECONNECTION (SINGLE ONLY) */}
        {!isMultiple && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Pontos de Conexão
              </label>
              <button
                type="button"
                onClick={handleSwapDirection}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                title="Inverter Origem e Destino"
              >
                <ArrowLeftRight size={12} />
                <span>Inverter (↔)</span>
              </button>
            </div>

            {/* Source Config */}
            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> Origem (Início):
                </span>
                {onStartReconnecting && (
                  <button
                    type="button"
                    onClick={() => onStartReconnecting('source')}
                    className="text-[10px] font-semibold text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    Mudar no Canvas
                  </button>
                )}
              </div>
              <select
                value={activeEdge.source}
                onChange={(e) => handleChangeNode('source', e.target.value)}
                className="w-full text-xs p-1.5 bg-white border border-zinc-200 rounded-lg outline-none font-medium text-zinc-800 cursor-pointer"
              >
                {nodes.filter(n => n.type !== 'swimlane' && n.type !== 'frame').map(n => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label ? String(n.data.label) : `${n.type || 'Nó'} (${n.id.slice(0, 6)})`}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-500 font-medium">Saída:</span>
                <div className="flex gap-1">
                  {(['top', 'bottom', 'left', 'right'] as const).map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleChangeHandle('source', h)}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors cursor-pointer ${
                        (activeEdge.sourceHandle || 'bottom') === h
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {h === 'top' ? 'Topo' : h === 'bottom' ? 'Base' : h === 'left' ? 'Esq.' : 'Dir.'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Config */}
            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Destino (Fim):
                </span>
                {onStartReconnecting && (
                  <button
                    type="button"
                    onClick={() => onStartReconnecting('target')}
                    className="text-[10px] font-semibold text-emerald-600 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    Mudar no Canvas
                  </button>
                )}
              </div>
              <select
                value={activeEdge.target}
                onChange={(e) => handleChangeNode('target', e.target.value)}
                className="w-full text-xs p-1.5 bg-white border border-zinc-200 rounded-lg outline-none font-medium text-zinc-800 cursor-pointer"
              >
                {nodes.filter(n => n.type !== 'swimlane' && n.type !== 'frame').map(n => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label ? String(n.data.label) : `${n.type || 'Nó'} (${n.id.slice(0, 6)})`}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-500 font-medium">Entrada:</span>
                <div className="flex gap-1">
                  {(['top', 'bottom', 'left', 'right'] as const).map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleChangeHandle('target', h)}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors cursor-pointer ${
                        (activeEdge.targetHandle || 'top') === h
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {h === 'top' ? 'Topo' : h === 'bottom' ? 'Base' : h === 'left' ? 'Esq.' : 'Dir.'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 6: DELETE BUTTON */}
        <div className="pt-3 border-t border-zinc-100">
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl font-bold transition-all cursor-pointer border border-red-200"
          >
            <Trash2 size={16} />
            <span>{isMultiple ? `Excluir ${selectedEdges.length} Conexões Selecionadas` : 'Excluir Conexão'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
