import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import {
  Square,
  Circle,
  Diamond,
  Database,
  FileText,
  StickyNote,
  Cloud,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Trash2,
  ChevronRight,
  Star,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Sliders,
  Clock,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Layers,
  ArrowLeftRight,
  Hexagon,
  Wrench,
  Monitor,
  Hourglass,
  HardDrive,
  FileSpreadsheet,
  CornerDownRight,
  PlusCircle,
  MessageSquare,
  Boxes,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  StretchHorizontal,
  RotateCw,
  RotateCcw
} from 'lucide-react';
import { getNodeDimensions } from './CustomNodes';

export interface MiroNodeToolbarProps {
  node?: Node;
  selectedNodes?: Node[];
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateStyle: (id: string, styleUpdates: Record<string, any>) => void;
  onUpdateBulkStyle?: (styleUpdates: Record<string, any>) => void;
  onUpdateDimensions?: (width: number, height: number) => void;
  onUpdateType: (id: string, newType: string) => void;
  onUpdateBulkType?: (newType: string) => void;
  onUpdateTag: (id: string, tag: string | undefined) => void;
  onUpdateBulkTag?: (tag: string | undefined) => void;
  onDuplicate: (node: Node) => void;
  onDuplicateBulk?: (nodes: Node[]) => void;
  onDelete: (id: string) => void;
  onDeleteBulk?: (ids: string[]) => void;
  onOpenTimingModal: (id: string) => void;
  onCloseToolbar?: () => void;
  onHideSidebar?: () => void;
}

const PALETTE_COLORS = [
  { name: 'Branco', bg: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
  { name: 'Azul Claro', bg: '#eff6ff', border: '#60a5fa', text: '#1e3a8a' },
  { name: 'Verde Claro', bg: '#dcfce7', border: '#4ade80', text: '#14532d' },
  { name: 'Amarelo Claro', bg: '#fef9c3', border: '#facc15', text: '#713f12' },
  { name: 'Vermelho Claro', bg: '#fee2e2', border: '#f87171', text: '#7f1d1d' },
  { name: 'Roxo Claro', bg: '#f3e8ff', border: '#c084fc', text: '#581c87' },
  { name: 'Laranja Claro', bg: '#ffedd5', border: '#fb923c', text: '#7c2d12' },
  { name: 'Turquesa', bg: '#ccfbf1', border: '#2dd4bf', text: '#134e4a' },
  { name: 'Cinza Suave', bg: '#f1f5f9', border: '#94a3b8', text: '#334155' },
  { name: 'Amarelo Destaque', bg: '#fef08a', border: '#eab308', text: '#1c1917' },
  { name: 'Azul Intenso', bg: '#3b82f6', border: '#1d4ed8', text: '#ffffff' },
  { name: 'Ardósia Escuro', bg: '#1e293b', border: '#0f172a', text: '#ffffff' },
];

export const ALL_SHAPE_CATEGORIES = [
  {
    category: 'Essenciais',
    shapes: [
      { type: 'process', label: 'Processo', icon: <Square size={13} className="text-blue-600" /> },
      { type: 'start', label: 'Início', icon: <Circle size={13} className="text-emerald-600" /> },
      { type: 'end', label: 'Fim', icon: <Circle size={13} className="text-red-500" /> },
      { type: 'decision', label: 'Decisão', icon: <Diamond size={13} className="text-amber-500" /> },
      { type: 'inputoutput', label: 'Entrada / Saída', icon: <ArrowLeftRight size={13} className="text-teal-600" /> },
    ]
  },
  {
    category: 'Documentos & Dados',
    shapes: [
      { type: 'document', label: 'Documento', icon: <FileText size={13} className="text-purple-600" /> },
      { type: 'database', label: 'Banco de Dados', icon: <Database size={13} className="text-emerald-600" /> },
      { type: 'storeddata', label: 'Dados Armazenados', icon: <FileSpreadsheet size={13} className="text-blue-600" /> },
      { type: 'internalstorage', label: 'Armazenamento Interno', icon: <HardDrive size={13} className="text-slate-600" /> },
    ]
  },
  {
    category: 'Engenharia & Operações',
    shapes: [
      { type: 'subprocess', label: 'Subprocesso', icon: <Boxes size={13} className="text-purple-600" /> },
      { type: 'preparation', label: 'Preparação / Setup', icon: <Hexagon size={13} className="text-indigo-600" /> },
      { type: 'manualinput', label: 'Entrada Manual', icon: <Boxes size={13} className="text-sky-600" /> },
      { type: 'manualoperation', label: 'Operação Manual', icon: <Wrench size={13} className="text-amber-600" /> },
      { type: 'display', label: 'Exibição / Display', icon: <Monitor size={13} className="text-blue-500" /> },
      { type: 'delay', label: 'Atraso / Espera', icon: <Hourglass size={13} className="text-rose-500" /> },
    ]
  },
  {
    category: 'Contêineres & Anotações',
    shapes: [
      { type: 'swimlane', label: 'Raia / Swimlane', icon: <StretchHorizontal size={13} className="text-blue-600" /> },
      { type: 'frame', label: 'Quadro / Frame', icon: <Layers size={13} className="text-indigo-600" /> },
      { type: 'offpage', label: 'Fora de Página', icon: <CornerDownRight size={13} className="text-purple-600" /> },
      { type: 'junction', label: 'Conector / Junção', icon: <PlusCircle size={13} className="text-zinc-600" /> },
      { type: 'circle', label: 'Círculo / Evento', icon: <Circle size={13} className="text-slate-600" /> },
      { type: 'cloud', label: 'Nuvem / API', icon: <Cloud size={13} className="text-sky-500" /> },
      { type: 'sticky', label: 'Nota Adesiva', icon: <StickyNote size={13} className="text-yellow-600" /> },
      { type: 'annotation', label: 'Anotação / Callout', icon: <MessageSquare size={13} className="text-amber-600" /> },
    ]
  }
];

export const ALL_SHAPES = ALL_SHAPE_CATEGORIES.flatMap(c => c.shapes);

const SIZE_PRESETS = [
  { label: 'Compacto', width: 140, height: 44 },
  { label: 'Padrão', width: 200, height: 56 },
  { label: 'Médio', width: 260, height: 72 },
  { label: 'Grande', width: 320, height: 90 },
];

export const MiroNodeToolbar: React.FC<MiroNodeToolbarProps> = ({
  node,
  selectedNodes = [],
  onUpdateLabel,
  onUpdateStyle,
  onUpdateBulkStyle,
  onUpdateDimensions,
  onUpdateType,
  onUpdateBulkType,
  onUpdateTag,
  onUpdateBulkTag,
  onDuplicate,
  onDuplicateBulk,
  onDelete,
  onDeleteBulk,
  onOpenTimingModal,
  onCloseToolbar,
  onHideSidebar
}) => {
  const isMultiple = selectedNodes.length > 1;
  const activeNode = node || selectedNodes[0];

  const [tempLabel, setTempLabel] = useState(activeNode?.data?.label ? String(activeNode.data.label) : '');

  useEffect(() => {
    if (activeNode) {
      setTempLabel(activeNode.data?.label ? String(activeNode.data.label) : '');
    }
  }, [activeNode?.data?.label, activeNode?.id]);

  if (!activeNode) return null;

  const currentType = activeNode.type || 'process';
  const currentStyle = (activeNode.data?.styleOverride as Record<string, any>) || {};
  const currentTag = activeNode.data?.tag as string | undefined;

  const initialDims = getNodeDimensions(activeNode.type);
  const currentWidth =
    (activeNode.data?.width as number) ||
    (activeNode.width as number) ||
    (activeNode.style?.width as number) ||
    (activeNode.data?.styleOverride?.width as number) ||
    initialDims.width;
  const currentHeight =
    (activeNode.data?.height as number) ||
    (activeNode.height as number) ||
    (activeNode.style?.height as number) ||
    (activeNode.data?.styleOverride?.height as number) ||
    initialDims.height;

  // Multi-node or single-node style apply
  const applyStyle = (styleUpdates: Record<string, any>) => {
    if (isMultiple && onUpdateBulkStyle) {
      onUpdateBulkStyle(styleUpdates);
    } else if (isMultiple) {
      selectedNodes.forEach(n => onUpdateStyle(n.id, styleUpdates));
    } else {
      onUpdateStyle(activeNode.id, styleUpdates);
    }
  };

  const applyType = (newType: string) => {
    if (isMultiple && onUpdateBulkType) {
      onUpdateBulkType(newType);
    } else if (isMultiple) {
      selectedNodes.forEach(n => onUpdateType(n.id, newType));
    } else {
      onUpdateType(activeNode.id, newType);
    }
  };

  const applyTag = (tag: string | undefined) => {
    if (isMultiple && onUpdateBulkTag) {
      onUpdateBulkTag(tag);
    } else if (isMultiple) {
      selectedNodes.forEach(n => onUpdateTag(n.id, tag));
    } else {
      onUpdateTag(activeNode.id, tag);
    }
  };

  const handleDelete = () => {
    if (isMultiple && onDeleteBulk) {
      onDeleteBulk(selectedNodes.map(n => n.id));
    } else if (isMultiple) {
      selectedNodes.forEach(n => onDelete(n.id));
    } else {
      onDelete(activeNode.id);
    }
  };

  const handleDuplicate = () => {
    if (isMultiple && onDuplicateBulk) {
      onDuplicateBulk(selectedNodes);
    } else if (isMultiple) {
      selectedNodes.forEach(n => onDuplicate(n));
    } else {
      onDuplicate(activeNode);
    }
  };

  const toggleBold = () => {
    const isBold = currentStyle.fontWeight === 'bold' || currentStyle.fontWeight === '700';
    applyStyle({ fontWeight: isBold ? 'normal' : 'bold' });
  };

  const toggleItalic = () => {
    const isItalic = currentStyle.fontStyle === 'italic';
    applyStyle({ fontStyle: isItalic ? 'normal' : 'italic' });
  };

  const changeFontSize = (delta: number) => {
    const currentSize = parseInt(currentStyle.fontSize || '14', 10);
    const newSize = Math.max(10, Math.min(32, currentSize + delta));
    applyStyle({ fontSize: `${newSize}px` });
  };

  const setAlign = (textAlign: 'left' | 'center' | 'right') => {
    applyStyle({ textAlign });
  };

  const handleSaveLabel = () => {
    if (!isMultiple) {
      onUpdateLabel(activeNode.id, tempLabel);
    }
  };

  const handleApplyDimensions = (w: number, h: number) => {
    if (onUpdateDimensions) {
      onUpdateDimensions(w, h);
    } else {
      applyStyle({ width: w, height: h });
    }
  };

  const handleScaleDimensions = (factor: number) => {
    const newW = Math.round(Math.max(80, currentWidth * factor));
    const newH = Math.round(Math.max(36, currentHeight * factor));
    handleApplyDimensions(newW, newH);
  };

  const triggerAlign = (mode: string) => {
    window.dispatchEvent(new CustomEvent('flow-align-nodes', { detail: { mode } }));
  };

  const triggerDistribute = (mode: string) => {
    window.dispatchEvent(new CustomEvent('flow-distribute-nodes', { detail: { mode } }));
  };

  return (
    <div className="flex flex-col h-full bg-white select-none text-zinc-800">
      {/* SIDEBAR HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/80">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
            {isMultiple ? <Boxes size={16} /> : (ALL_SHAPES.find(s => s.type === currentType)?.icon || <Square size={16} />)}
          </div>
          <div className="truncate min-w-0">
            <h3 className="text-xs font-bold text-zinc-900 truncate">
              {isMultiple ? `${selectedNodes.length} Formas Selecionadas` : (activeNode.data?.label ? String(activeNode.data.label) : 'Propriedades da Etapa')}
            </h3>
            <p className="text-[10px] text-zinc-500 font-medium">
              {isMultiple ? 'Edição em Massa de Elementos' : 'Painel Lateral de Edição'}
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
              title="Fechar Seleção"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* MULTI-SELECTION BANNER */}
      {isMultiple && (
        <div className="bg-blue-50/80 border-b border-blue-100 px-4 py-2 text-[11px] text-blue-800 flex items-center justify-between">
          <span className="font-medium">
            Aplicando alterações para <b>{selectedNodes.length}</b> formas
          </span>
          <span className="text-[10px] bg-blue-200/70 text-blue-900 px-1.5 py-0.5 rounded font-bold">
            Em lote
          </span>
        </div>
      )}

      {/* SIDEBAR BODY (SCROLLABLE SECTIONS) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* SECTION 1: TEXT & LABEL (ONLY WHEN 1 NODE IS SELECTED) */}
        {!isMultiple ? (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Rótulo da Etapa
            </label>
            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-300 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="text"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveLabel();
                }}
                onBlur={handleSaveLabel}
                placeholder="Digite o nome da etapa..."
                className="w-full bg-transparent text-xs font-semibold text-zinc-800 outline-none px-1"
              />
              <button
                onClick={handleSaveLabel}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                title="Salvar Texto"
              >
                <Check size={14} />
              </button>
            </div>

            {/* Typography Toolbar */}
            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl p-1 mt-2">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={toggleBold}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    currentStyle.fontWeight === 'bold' || currentStyle.fontWeight === '700'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                  title="Negrito"
                >
                  <Bold size={14} />
                </button>
                <button
                  onClick={toggleItalic}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    currentStyle.fontStyle === 'italic'
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-600 hover:bg-zinc-200/70'
                  }`}
                  title="Itálico"
                >
                  <Italic size={14} />
                </button>
              </div>

              {/* Font Size */}
              <div className="flex items-center bg-white border border-zinc-200 rounded-lg p-0.5">
                <button
                  onClick={() => changeFontSize(-2)}
                  className="px-1.5 py-0.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded cursor-pointer"
                  title="Diminuir Fonte"
                >
                  -
                </button>
                <span className="text-[11px] font-mono font-semibold text-zinc-700 px-1.5">
                  {parseInt(currentStyle.fontSize || '14', 10)}px
                </span>
                <button
                  onClick={() => changeFontSize(2)}
                  className="px-1.5 py-0.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded cursor-pointer"
                  title="Aumentar Fonte"
                >
                  +
                </button>
              </div>

              {/* Alignment */}
              <div className="flex items-center gap-0.5">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAlign(a)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      (currentStyle.textAlign || 'center') === a
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-600 hover:bg-zinc-200/70'
                    }`}
                    title={`Alinhar à ${a === 'left' ? 'Esquerda' : a === 'right' ? 'Direita' : 'Centro'}`}
                  >
                    {a === 'left' ? <AlignLeft size={14} /> : a === 'right' ? <AlignRight size={14} /> : <AlignCenter size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Multi-selection typography note & alignment controls */
          <div className="space-y-2 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                Alinhamento da Seleção
              </span>
              <span className="text-[10px] text-zinc-400">Distribuição</span>
            </div>
            
            <div className="grid grid-cols-6 gap-1 pt-1">
              <button
                onClick={() => triggerAlign('left')}
                className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Alinhar à Esquerda"
              >
                <AlignStartVertical size={14} />
              </button>
              <button
                onClick={() => triggerAlign('center')}
                className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Alinhar ao Centro Vertical"
              >
                <AlignVerticalJustifyCenter size={14} />
              </button>
              <button
                onClick={() => triggerAlign('right')}
                className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Alinhar à Direita"
              >
                <AlignEndVertical size={14} />
              </button>
              <button
                onClick={() => triggerAlign('top')}
                className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Alinhar ao Topo"
              >
                <AlignStartHorizontal size={14} />
              </button>
              <button
                onClick={() => triggerAlign('middle')}
                className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Alinhar ao Meio Horizontal"
              >
                <AlignHorizontalJustifyCenter size={14} />
              </button>
              <button
                onClick={() => triggerAlign('bottom')}
                className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"
                title="Alinhar à Base"
              >
                <AlignEndHorizontal size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={() => triggerDistribute('horizontal')}
                className="py-1.5 px-2 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg text-[11px] font-medium text-zinc-700 cursor-pointer text-center"
              >
                Distribuir Horiz.
              </button>
              <button
                onClick={() => triggerDistribute('vertical')}
                className="py-1.5 px-2 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg text-[11px] font-medium text-zinc-700 cursor-pointer text-center"
              >
                Distribuir Vert.
              </button>
            </div>
            
            <p className="text-[10px] text-zinc-400 italic pt-1">
              * O texto de cada etapa é preservado individualmente durante a edição em lote.
            </p>
          </div>
        )}

        {/* SECTION 2: SHAPE / MORPH TYPE (BULK OR SINGLE) */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              {isMultiple ? 'Alterar Formato de Todas' : 'Formato da Etapa (Troca Rápida)'}
            </label>
            {!isMultiple && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {ALL_SHAPE_CATEGORIES.flatMap(c => c.shapes).find(s => s.type === currentType)?.label || currentType}
              </span>
            )}
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {ALL_SHAPE_CATEGORIES.map((categoryGroup) => (
              <div key={categoryGroup.category}>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 px-1">
                  {categoryGroup.category}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {categoryGroup.shapes.map((s) => {
                    const isSelected = !isMultiple && currentType === s.type;
                    return (
                      <button
                        key={s.type}
                        onClick={() => applyType(s.type)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-medium transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-xs'
                            : 'bg-white border-zinc-200/90 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300'
                        }`}
                        title={isMultiple ? `Mudar todas as ${selectedNodes.length} formas para ${s.label}` : `Mudar formato para ${s.label}`}
                      >
                        <span className="shrink-0">{s.icon}</span>
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: DIMENSIONS & SIZE */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              {isMultiple ? 'Dimensões em Lote' : 'Tamanho do Elemento'}
            </label>
            {!isMultiple && (
              <span className="text-[10px] text-zinc-400 font-mono">{currentWidth} x {currentHeight} px</span>
            )}
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-2 gap-1.5">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handleApplyDimensions(p.width, p.height)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-zinc-700 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>{p.label}</span>
                <span className="text-[10px] text-zinc-400 font-mono">{p.width}x{p.height}</span>
              </button>
            ))}
          </div>

          {/* Scale Buttons */}
          <div className="flex items-center justify-between bg-zinc-50 p-2 rounded-xl border border-zinc-200">
            <span className="text-xs text-zinc-600 font-medium">Escalar:</span>
            <div className="flex gap-1">
              <button
                onClick={() => handleScaleDimensions(0.85)}
                className="px-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
              >
                <ZoomOut size={12} /> -15%
              </button>
              <button
                onClick={() => handleScaleDimensions(1.15)}
                className="px-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
              >
                <ZoomIn size={12} /> +15%
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: COLORS & BORDER */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Cor de Fundo & Preenchimento
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c.bg}
                onClick={() =>
                  applyStyle({
                    backgroundColor: c.bg,
                    borderColor: c.border,
                    color: c.text
                  })
                }
                className="w-8 h-8 rounded-xl border border-zinc-200 flex items-center justify-center hover:scale-110 transition-transform shadow-2xs cursor-pointer"
                style={{ backgroundColor: c.bg }}
                title={c.name}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-600 font-medium">Cor Personalizada:</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400">Fundo:</span>
              <input
                type="color"
                value={currentStyle.backgroundColor || '#ffffff'}
                onChange={(e) => applyStyle({ backgroundColor: e.target.value })}
                className="w-6 h-6 rounded-md border border-zinc-200 cursor-pointer p-0"
              />
              <span className="text-[10px] text-zinc-400 ml-1">Texto:</span>
              <input
                type="color"
                value={currentStyle.color || '#0f172a'}
                onChange={(e) => applyStyle({ color: e.target.value })}
                className="w-6 h-6 rounded-md border border-zinc-200 cursor-pointer p-0"
              />
            </div>
          </div>

          {/* Border Thickness, Radius & Style */}
          <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 space-y-2.5 mt-2">
            {/* Border Thickness */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600">Espessura da Borda:</span>
              <div className="flex gap-1">
                {['1px', '2px', '3px', '4px', '6px'].map((w) => (
                  <button
                    key={w}
                    onClick={() => applyStyle({ borderWidth: w })}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                      (currentStyle.borderWidth || '2px') === w
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius (Afinar / Arredondar Cantos) */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-200/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600">Cantos / Bordas:</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {currentStyle.borderRadius !== undefined ? `${parseInt(String(currentStyle.borderRadius), 10)}px` : 'Padrão'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'Reto', value: '0px' },
                  { label: 'Suave', value: '8px' },
                  { label: 'Redondo', value: '16px' },
                  { label: 'Pílula', value: '9999px' }
                ].map((rad) => (
                  <button
                    key={rad.label}
                    onClick={() => applyStyle({ borderRadius: rad.value })}
                    className={`px-1.5 py-1 text-[10.5px] font-medium rounded-lg transition-colors cursor-pointer text-center ${
                      currentStyle.borderRadius === rad.value
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {rad.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] text-zinc-400">0px</span>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={parseInt(String(currentStyle.borderRadius || '12'), 10) || 0}
                  onChange={(e) => applyStyle({ borderRadius: `${e.target.value}px` })}
                  className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-[10px] text-zinc-400">40px</span>
              </div>
            </div>

            {/* Border Style */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60">
              <span className="text-xs font-medium text-zinc-600">Estilo do Traço:</span>
              <div className="flex gap-1">
                {(['solid', 'dashed', 'dotted'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => applyStyle({ borderStyle: st })}
                    className={`px-2 py-0.5 text-[10px] font-bold capitalize rounded-md transition-colors cursor-pointer ${
                      (currentStyle.borderStyle || 'solid') === st
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {st === 'solid' ? 'Sólida' : st === 'dashed' ? 'Tracejada' : 'Pontilhada'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4.5: SHAPE ROTATION */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Girar / Rotação da Forma
            </label>
            <span className="text-[10px] text-zinc-400 font-mono">
              {(currentStyle.rotation || activeNode.data?.rotation || 0)}°
            </span>
          </div>

          <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <button
                onClick={() => {
                  const cur = Number(currentStyle.rotation || activeNode.data?.rotation || 0);
                  const nextRot = (cur - 90 + 360) % 360;
                  applyStyle({ rotation: nextRot });
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-semibold text-zinc-700 transition-colors cursor-pointer"
                title="Girar 90° Anti-horário"
              >
                <RotateCcw size={13} /> -90°
              </button>
              <button
                onClick={() => {
                  const cur = Number(currentStyle.rotation || activeNode.data?.rotation || 0);
                  const nextRot = (cur + 90) % 360;
                  applyStyle({ rotation: nextRot });
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-white border border-zinc-200 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-semibold text-zinc-700 transition-colors cursor-pointer"
                title="Girar 90° Horário"
              >
                <RotateCw size={13} /> +90°
              </button>
              <button
                onClick={() => applyStyle({ rotation: 0 })}
                className="py-1.5 px-2.5 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg text-[11px] font-bold text-zinc-600 transition-colors cursor-pointer"
                title="Restaurar Rotação Padrão (0°)"
              >
                0°
              </button>
            </div>

            {/* Quick Angle Presets */}
            <div className="grid grid-cols-5 gap-1">
              {[0, 45, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  onClick={() => applyStyle({ rotation: deg })}
                  className={`py-1 text-[10px] font-semibold rounded-md border text-center transition-colors cursor-pointer ${
                    (Number(currentStyle.rotation || 0) === deg)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>

            {/* Free Rotation Slider */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-zinc-400">0°</span>
              <input
                type="range"
                min="0"
                max="360"
                value={Number(currentStyle.rotation || activeNode.data?.rotation || 0)}
                onChange={(e) => applyStyle({ rotation: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-[10px] text-zinc-400">360°</span>
            </div>
          </div>
        </div>

        {/* SECTION 5: PROCESS TIMING (SINGLE NODE ONLY) */}
        {!isMultiple && (
          <div className="pt-2 border-t border-zinc-100">
            <button
              onClick={() => onOpenTimingModal(activeNode.id)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer"
            >
              <Clock size={16} />
              <span>Configurar Tempos da Etapa</span>
            </button>
          </div>
        )}

        {/* SECTION 6: TAGS & STATUS */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            {isMultiple ? 'Marcador para Todas' : 'Marcador / Tag'}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => applyTag('star')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                currentTag === 'star' ? 'bg-amber-100 border-amber-400 text-amber-800 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Star size={14} className="fill-amber-400 text-amber-500" /> Prioridade
            </button>
            <button
              onClick={() => applyTag('alert')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                currentTag === 'alert' ? 'bg-red-100 border-red-400 text-red-800 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <AlertTriangle size={14} className="fill-red-400 text-red-500" /> Risco
            </button>
            <button
              onClick={() => applyTag('check')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                currentTag === 'check' ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <CheckCircle2 size={14} className="fill-emerald-400 text-emerald-600" /> Pronto
            </button>
            <button
              onClick={() => applyTag('idea')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                currentTag === 'idea' ? 'bg-yellow-100 border-yellow-400 text-yellow-800 font-bold' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Lightbulb size={14} className="fill-yellow-400 text-yellow-600" /> Ideia
            </button>
          </div>
          {currentTag && (
            <button
              onClick={() => applyTag(undefined)}
              className="w-full text-center text-[11px] text-zinc-400 hover:text-red-600 py-1 cursor-pointer"
            >
              Remover Marcador
            </button>
          )}
        </div>

        {/* SECTION 7: STYLE COPY / LOCK / QUICK ACTIONS */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Ferramentas & Ações
          </label>
          {!isMultiple ? (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flow-copy-style', { detail: { style: currentStyle } }));
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium cursor-pointer"
              >
                <Copy size={13} />
                <span>Copiar Estilo</span>
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flow-paste-style', { detail: { nodeId: activeNode.id } }));
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium cursor-pointer"
              >
                <Sliders size={13} />
                <span>Colar Estilo</span>
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {!isMultiple && (
              <button
                onClick={() => {
                  const isLocked = !!activeNode.data?.isLocked;
                  window.dispatchEvent(new CustomEvent('flow-lock-node', { detail: { nodeId: activeNode.id, isLocked: !isLocked } }));
                }}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium cursor-pointer ${
                  activeNode.data?.isLocked ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                {activeNode.data?.isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                <span>{activeNode.data?.isLocked ? 'Bloqueado' : 'Bloquear'}</span>
              </button>
            )}

            <button
              onClick={handleDuplicate}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium cursor-pointer ${
                isMultiple ? 'col-span-2' : ''
              }`}
            >
              <Layers size={13} />
              <span>{isMultiple ? `Duplicar ${selectedNodes.length} Formas` : 'Duplicar (Ctrl+D)'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 8: DELETE BUTTON */}
        <div className="pt-3 border-t border-zinc-100">
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl font-bold transition-all cursor-pointer border border-red-200"
          >
            <Trash2 size={16} />
            <span>{isMultiple ? `Excluir ${selectedNodes.length} Formas Selecionadas` : 'Excluir Elemento'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
