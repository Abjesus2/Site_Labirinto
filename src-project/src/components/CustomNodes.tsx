import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { MultipleHandles } from './MultipleHandles';
import {
  Database,
  FileText,
  Cloud,
  StickyNote,
  Star,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Clock,
  Check,
  Timer
} from 'lucide-react';
import { NodeTiming } from '../types';
import { formatDuration } from '../utils/timingUtils';

// Quick Add connector button component - Disabled to prevent flashing unwanted dots
const QuickAddButtons = (_: { nodeId: string; isSelected?: boolean }) => {
  return null;
};

// Tag badge renderer (Miro status sticker)
const TagBadge = ({ tag }: { tag?: string }) => {
  if (!tag) return null;
  const icons: Record<string, any> = {
    star: <Star size={12} className="text-amber-500 fill-amber-400" />,
    alert: <AlertTriangle size={12} className="text-red-500 fill-red-400" />,
    check: <CheckCircle2 size={12} className="text-green-500 fill-green-400" />,
    idea: <Lightbulb size={12} className="text-yellow-500 fill-yellow-400" />,
  };
  return (
    <div className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm border border-zinc-200 z-20">
      {icons[tag] || <span className="text-xs">{tag}</span>}
    </div>
  );
};

// Interactive Node Timing Badge
export const TimingBadge = ({
  nodeId,
  data,
  isEnd,
  isStart
}: {
  nodeId: string;
  data: any;
  isEnd?: boolean;
  isStart?: boolean;
}) => {
  if (!data?.showTimingMode) return null;

  const calc = data?.calculatedTiming;

  const handleOpenTiming = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('flow-open-timing-modal', {
        detail: { nodeId }
      })
    );
  };

  const stepFormatted = calc?.formattedStep || formatDuration(calc?.stepTotal || 0);
  const cumFormatted = calc?.formattedCumulative || formatDuration(calc?.cumulativeTotal || 0);

  if (isEnd) {
    return (
      <div
        onClick={handleOpenTiming}
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform whitespace-nowrap z-20"
        title="Tempo Total do Processo (Lead Time). Clique para editar tempos."
      >
        <Timer size={11} className="animate-pulse" />
        <span>Total: {cumFormatted}</span>
      </div>
    );
  }

  if (isStart) {
    return (
      <div
        onClick={handleOpenTiming}
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-emerald-700/90 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform whitespace-nowrap z-20"
        title="Início do Fluxo. Clique para editar tempos."
      >
        <Clock size={10} />
        <span>Início {calc?.stepTotal > 0 ? `(${stepFormatted})` : ''}</span>
      </div>
    );
  }

  return (
    <div
      onClick={handleOpenTiming}
      className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-zinc-900/90 hover:bg-blue-700 text-white text-[9.5px] font-medium px-2 py-0.5 rounded-full shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-all whitespace-nowrap z-20 border border-white/20"
      title={`Etapa: ${stepFormatted} | Acumulado: ${cumFormatted}. Clique para editar tempos extras.`}
    >
      <Clock size={10} className="text-amber-400" />
      <span className="font-semibold text-amber-200">{stepFormatted}</span>
      <span className="text-zinc-400">|</span>
      <span className="text-blue-200">Acum: {cumFormatted}</span>
    </div>
  );
};

// Universal Inline Text Editor for ANY node
export const EditableNodeLabel = ({
  nodeId,
  label,
  placeholder = 'Digite o texto...',
  className = '',
  style = {},
  isEditingManual,
  onFinishEditing
}: {
  nodeId: string;
  label: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  isEditingManual?: boolean;
  onFinishEditing?: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(label || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(label || '');
  }, [label]);

  useEffect(() => {
    if (isEditingManual) {
      setIsEditing(true);
    }
  }, [isEditingManual]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveText = () => {
    setIsEditing(false);
    onFinishEditing?.();
    const newText = text.trim() === '' ? (label || 'Elemento') : text;
    window.dispatchEvent(
      new CustomEvent('flow-update-node-label', {
        detail: { nodeId, label: newText }
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveText();
    } else if (e.key === 'Escape') {
      setText(label || '');
      setIsEditing(false);
      onFinishEditing?.();
    }
  };

  const textLength = (label || '').length;
  const autoFontSize = textLength > 45 ? '11px' : textLength > 25 ? '12px' : '13px';
  const autoLineHeight = textLength > 25 ? '1.25' : '1.35';

  const mergedStyle: React.CSSProperties = {
    fontSize: style.fontSize || autoFontSize,
    lineHeight: style.lineHeight || autoLineHeight,
    ...style
  };

  if (isEditing) {
    return (
      <div className="w-full relative z-30 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={saveText}
          onKeyDown={handleKeyDown}
          rows={Math.max(1, (text.match(/\n/g) || []).length + 1)}
          className="w-full p-1 bg-white/95 text-zinc-900 border-2 border-blue-500 rounded-md text-center text-xs font-semibold outline-none shadow-lg resize-none min-h-[30px]"
          style={mergedStyle}
          autoFocus
        />
        <button
          onClick={saveText}
          className="absolute -bottom-5 right-0 bg-blue-600 text-white rounded-full p-1 shadow-md hover:bg-blue-700"
          title="Salvar (Enter)"
        >
          <Check size={10} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`select-none cursor-text break-words w-full ${className}`}
      style={mergedStyle}
      title="Clique duas vezes para editar o texto"
    >
      {text || <span className="opacity-40 italic">{placeholder}</span>}
    </div>
  );
};

export const getNodeDimensions = (type?: string): { width: number; height: number } => {
  switch (type) {
    case 'start':
    case 'end':
      return { width: 160, height: 48 };
    case 'decision':
      return { width: 210, height: 110 };
    case 'circle':
    case 'offpage':
      return { width: 80, height: 80 };
    case 'sticky':
      return { width: 180, height: 160 };
    case 'database':
      return { width: 200, height: 72 };
    case 'document':
      return { width: 200, height: 72 };
    case 'subprocess':
      return { width: 210, height: 60 };
    case 'inputoutput':
      return { width: 210, height: 60 };
    case 'manualinput':
      return { width: 210, height: 64 };
    case 'manualoperation':
      return { width: 210, height: 64 };
    case 'preparation':
      return { width: 210, height: 64 };
    case 'display':
      return { width: 200, height: 64 };
    case 'delay':
      return { width: 200, height: 64 };
    case 'storeddata':
      return { width: 200, height: 64 };
    case 'internalstorage':
      return { width: 200, height: 64 };
    case 'cloud':
      return { width: 190, height: 60 };
    case 'swimlane':
      return { width: 800, height: 180 };
    case 'frame':
      return { width: 600, height: 400 };
    case 'junction':
      return { width: 1, height: 1 };
    case 'process':
    default:
      return { width: 210, height: 60 };
  }
};


/**
 * styleOverride guarda tudo o que o usuário ajusta na forma: cor de fundo,
 * borda, fonte e (antigamente) largura/altura. Espalhar esse objeto inteiro
 * dentro do texto fazia o rótulo virar um bloco com o tamanho e a cor da
 * forma — era o "quadrado no meio" que aparecia depois de redimensionar.
 * Por isso cada destino recebe só o que lhe diz respeito.
 */
const TEXT_STYLE_KEYS = [
  'color', 'fontSize', 'fontWeight', 'fontStyle', 'fontFamily', 'textAlign',
  'textDecoration', 'letterSpacing', 'lineHeight', 'textTransform', 'whiteSpace',
];

export const pickTextStyle = (so: any = {}): Record<string, any> => {
  const out: Record<string, any> = {};
  if (!so) return out;
  for (const key of TEXT_STYLE_KEYS) {
    if (so[key] !== undefined) out[key] = so[key];
  }
  return out;
};

/** Estilo da caixa: tudo menos o que pertence ao nó (tamanho, posição, giro). */
const BOX_EXCLUDED_KEYS = [
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'rotation', 'position', 'inset', 'top', 'left', 'right', 'bottom', 'transform', 'zIndex',
];

export const pickBoxStyle = (so: any = {}): Record<string, any> => {
  const out: Record<string, any> = {};
  if (!so) return out;
  for (const key of Object.keys(so)) {
    if (!BOX_EXCLUDED_KEYS.includes(key)) out[key] = so[key];
  }
  return out;
};

const notifyResizeEnd = (id: string, params: { width: number; height: number }) => {
  window.dispatchEvent(
    new CustomEvent('flow-node-resize-end', {
      detail: { id, width: Math.round(params.width), height: Math.round(params.height) }
    })
  );
};

export const ProcessNode = ({ id, data, type, selected }: any) => {
  const isDashed = data.styleOverride?.borderStyle === 'dashed';
  const isDotted = data.styleOverride?.borderStyle === 'dotted';
  const rotation = data.styleOverride?.rotation || 0;
  const radius = data.styleOverride?.borderRadius !== undefined ? `${data.styleOverride.borderRadius}px` : '12px';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-blue-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-4 py-3 shadow-sm border-2 flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-blue-400/50 shadow-md border-blue-500' : 'border-blue-300 hover:border-blue-400'
        } ${isDashed ? 'border-dashed' : isDotted ? 'border-dotted' : ''}`}
        style={{
          borderRadius: radius,
          backgroundColor: data.styleOverride?.backgroundColor || '#eff6ff',
          borderColor: data.styleOverride?.borderColor || (selected ? '#3b82f6' : '#93c5fd'),
          borderWidth: data.styleOverride?.borderWidth ? `${data.styleOverride.borderWidth}px` : '2px',
          color: data.styleOverride?.color || '#1e293b',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          fontStyle: data.styleOverride?.fontStyle || 'normal',
          textAlign: (data.styleOverride?.textAlign as any) || 'center',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <MultipleHandles type={type} />
        <EditableNodeLabel nodeId={id} label={data.label} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

export const StartNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[36px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={36}
        lineClassName="border-green-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-green-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-5 py-2.5 shadow-sm rounded-full border-2 flex items-center justify-center text-center font-semibold transition-all ${
          selected ? 'ring-3 ring-green-400/50 shadow-md border-green-600' : 'border-green-400 hover:border-green-500'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#dcfce7',
          borderColor: data.styleOverride?.borderColor || '#22c55e',
          borderWidth: data.styleOverride?.borderWidth ? `${data.styleOverride.borderWidth}px` : '2px',
          color: data.styleOverride?.color || '#14532d',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '600',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <MultipleHandles type={type} />
        <EditableNodeLabel nodeId={id} label={data.label} />
      </div>

      <TimingBadge nodeId={id} data={data} isStart />
    </div>
  );
};

export const EndNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[36px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={36}
        lineClassName="border-red-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-red-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-5 py-2.5 shadow-sm rounded-full border-2 flex items-center justify-center text-center font-semibold transition-all ${
          selected ? 'ring-3 ring-red-400/50 shadow-md border-red-600' : 'border-red-400 hover:border-red-500'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#fee2e2',
          borderColor: data.styleOverride?.borderColor || '#ef4444',
          borderWidth: data.styleOverride?.borderWidth ? `${data.styleOverride.borderWidth}px` : '2px',
          color: data.styleOverride?.color || '#7f1d1d',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '600',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <MultipleHandles type={type} />
        <EditableNodeLabel nodeId={id} label={data.label} />
      </div>

      <TimingBadge nodeId={id} data={data} isEnd />
    </div>
  );
};

export const DecisionNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;
  const strokeColor = data.styleOverride?.borderColor || '#eab308';
  const fillColor = data.styleOverride?.backgroundColor || '#fef9c3';
  const textColor = data.styleOverride?.color || '#713f12';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[50px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={50}
        lineClassName="border-amber-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-amber-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />

      <svg
        className={`absolute inset-0 w-full h-full overflow-visible transition-all ${
          selected ? 'filter drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]' : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points="50,0 100,50 50,100 0,50"
          fill={fillColor}
          stroke={selected ? '#ca8a04' : strokeColor}
          strokeWidth={selected ? 3 : (data.styleOverride?.borderWidth || 2)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <TagBadge tag={data.tag} />
      
      <div className="relative z-10 px-5 text-center max-w-[75%] flex items-center justify-center">
        <EditableNodeLabel
          nodeId={id}
          label={data.label}
          style={{
            color: textColor,
            fontWeight: data.styleOverride?.fontWeight || '600',
            ...pickTextStyle(data.styleOverride)
          }}
        />
      </div>

      <MultipleHandles type={type} />
      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

export const DatabaseNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[45px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={45}
        lineClassName="border-purple-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-purple-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full relative flex flex-col items-center justify-center px-4 py-3 rounded-lg border-2 shadow-sm transition-all ${
          selected ? 'ring-3 ring-purple-400/50 shadow-md border-purple-600' : 'border-purple-300 hover:border-purple-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#f3e8ff',
          borderColor: data.styleOverride?.borderColor || '#a855f7',
          color: data.styleOverride?.color || '#581c87',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <div
          className="absolute -top-2 left-0 right-0 h-4 border-2 rounded-[50%]"
          style={{
            backgroundColor: data.styleOverride?.backgroundColor || '#f3e8ff',
            borderColor: data.styleOverride?.borderColor || '#a855f7'
          }}
        />
        <TagBadge tag={data.tag} />
        <div className="relative z-10 text-center mt-1 flex items-center gap-1.5 leading-tight w-full justify-center">
          <Database size={14} className="opacity-70 flex-shrink-0" />
          <EditableNodeLabel nodeId={id} label={data.label} />
        </div>
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

export const DocumentNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;
  const strokeColor = data.styleOverride?.borderColor || '#f97316';
  const fillColor = data.styleOverride?.backgroundColor || '#ffedd5';
  const textColor = data.styleOverride?.color || '#7c2d12';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[45px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={45}
        lineClassName="border-orange-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-orange-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />

      <svg
        className={`absolute inset-0 w-full h-full overflow-visible transition-all ${
          selected ? 'filter drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]' : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 0 L 100 0 L 100 85 Q 75 100 50 85 T 0 85 L 0 0 Z"
          fill={fillColor}
          stroke={selected ? '#ea580c' : strokeColor}
          strokeWidth={selected ? 3 : (data.styleOverride?.borderWidth || 2)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <TagBadge tag={data.tag} />

      <div className="relative z-10 px-5 pt-2 pb-4 text-center w-full flex items-center justify-center gap-1.5">
        <FileText size={14} className="opacity-70 flex-shrink-0" />
        <EditableNodeLabel
          nodeId={id}
          label={data.label}
          style={{
            color: textColor,
            fontWeight: data.styleOverride?.fontWeight || '500',
            ...pickTextStyle(data.styleOverride)
          }}
        />
      </div>

      <MultipleHandles type={type} />
      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Sticky Note (Post-It) Node
export const StickyNoteNode = ({ id, data, type, selected }: any) => {
  const bg = data.styleOverride?.backgroundColor || '#fef08a';
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[100px] min-h-[100px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={100}
        lineClassName="border-amber-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-amber-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] rounded-sm flex flex-col justify-between transition-transform ${
          selected ? 'ring-2 ring-blue-500 shadow-xl' : ''
        }`}
        style={{
          backgroundColor: bg,
          color: data.styleOverride?.color || '#1f2937',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <div
          className="absolute top-0 right-0 w-5 h-5 opacity-40 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.15) 50%)',
          }}
        />
        <TagBadge tag={data.tag} />
        <div className="font-normal leading-relaxed flex-1">
          <EditableNodeLabel nodeId={id} label={data.label} placeholder="Escreva sua anotação..." />
        </div>
        <div className="text-[10px] text-zinc-500/70 text-right mt-2 flex items-center justify-end gap-1">
          <StickyNote size={10} /> Nota
        </div>

        <MultipleHandles type={type} />
      </div>
    </div>
  );
};

// Subprocess Node
export const SubprocessNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-indigo-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-indigo-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full relative px-6 py-3 shadow-sm rounded-lg border-2 flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-indigo-400/50 shadow-md border-indigo-600' : 'border-indigo-300 hover:border-indigo-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#e0e7ff',
          borderColor: data.styleOverride?.borderColor || '#6366f1',
          color: data.styleOverride?.color || '#312e81',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5" style={{ backgroundColor: data.styleOverride?.borderColor || '#6366f1' }} />
        <div className="absolute right-2.5 top-0 bottom-0 w-0.5" style={{ backgroundColor: data.styleOverride?.borderColor || '#6366f1' }} />
        <TagBadge tag={data.tag} />
        <EditableNodeLabel nodeId={id} label={data.label} />
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Parallelogram Node (Data Input / Output)
export const InputOutputNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-teal-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-teal-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-6 py-3 shadow-sm border-2 flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-teal-400/50 shadow-md border-teal-600' : 'border-teal-300 hover:border-teal-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#ccfbf1',
          borderColor: data.styleOverride?.borderColor || '#14b8a6',
          transform: 'skew(-15deg)',
          color: data.styleOverride?.color || '#134e4a',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <div style={{ transform: 'skew(15deg)' }} className="w-full text-center">
          <EditableNodeLabel nodeId={id} label={data.label} />
        </div>
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Cloud Service / API Node
export const CloudNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[90px] min-h-[45px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={90}
        minHeight={45}
        lineClassName="border-purple-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-purple-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-6 py-4 shadow-sm rounded-3xl border-2 flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-purple-400/50 shadow-md border-purple-500' : 'border-purple-300 hover:border-purple-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#ede9fe',
          borderColor: data.styleOverride?.borderColor || '#8b5cf6',
          color: data.styleOverride?.color || '#4c1d95',
          fontSize: data.styleOverride?.fontSize || '14px',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <div className="flex items-center gap-1.5 leading-tight w-full justify-center">
          <Cloud size={16} className="opacity-70 flex-shrink-0" />
          <EditableNodeLabel nodeId={id} label={data.label} />
        </div>
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Circle Node (Connector / State / Event)
export const CircleNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[40px] min-h-[40px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={40}
        lineClassName="border-blue-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full shadow-sm rounded-full border-2 flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-blue-400/50 shadow-md border-blue-600' : 'border-blue-300 hover:border-blue-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#eff6ff',
          borderColor: data.styleOverride?.borderColor || '#3b82f6',
          color: data.styleOverride?.color || '#1e293b',
          fontSize: data.styleOverride?.fontSize || '12px',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <div className="px-2 leading-tight w-full text-center">
          <EditableNodeLabel nodeId={id} label={data.label} />
        </div>
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Text Node (Floating Miro Text)
export const TextNode = ({ id, data, type, selected }: any) => {
  return (
    <div
      className={`p-2 rounded font-sans transition-all w-full h-full ${
        selected ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'hover:bg-zinc-100/50'
      }`}
      style={{
        color: data.styleOverride?.color || '#18181b',
        fontSize: data.styleOverride?.fontSize || '16px',
        fontWeight: data.styleOverride?.fontWeight || '600',
        fontStyle: data.styleOverride?.fontStyle || 'normal',
        textAlign: (data.styleOverride?.textAlign as any) || 'left',
        ...pickBoxStyle(data.styleOverride)
      }}
    >
      <div className="min-w-[60px] w-full h-full">
        <EditableNodeLabel nodeId={id} label={data.label} placeholder="Clique duas vezes para editar texto" />
      </div>
    </div>
  );
};

// Swimlane Node
export const SwimlaneNode = ({ id, data, type, selected }: any) => {
  const isVertical = data.orientation === 'vertical' || data.styleOverride?.orientation === 'vertical';

  return (
    <div
      className={`w-full h-full min-w-[160px] min-h-[60px] border-2 border-dashed rounded-xl shadow-xs transition-all relative flex flex-col ${
        selected ? 'border-blue-500 ring-3 ring-blue-300/40 shadow-md' : 'border-zinc-300 hover:border-zinc-400'
      }`}
      style={{
        backgroundColor: data.styleOverride?.backgroundColor || 'rgba(248, 250, 252, 0.65)',
        borderColor: data.styleOverride?.borderColor || (selected ? '#3b82f6' : '#cbd5e1'),
        borderStyle: data.styleOverride?.borderStyle || 'dashed',
        ...pickBoxStyle(data.styleOverride)
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={60}
        lineClassName="border-blue-500 border-dashed"
        handleClassName="w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-sm shadow-md z-50 hover:scale-125 transition-transform cursor-pointer"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div 
        className="bg-zinc-100/90 border-b border-zinc-200/90 px-3.5 py-2 rounded-t-lg font-semibold text-xs text-zinc-700 flex items-center justify-between select-none shrink-0"
        style={{
          backgroundColor: data.styleOverride?.headerBg || undefined,
          color: data.styleOverride?.headerColor || undefined
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 max-w-[80%]">
          <EditableNodeLabel nodeId={id} label={data.label} placeholder="Nome da Raia / Responsável" />
        </div>
        <span className="text-[9.5px] text-zinc-400 uppercase tracking-wider font-semibold shrink-0">
          {isVertical ? 'Raia Vertical' : 'Raia de Processo'}
        </span>
      </div>
      
      <div className="flex-1 w-full h-full p-2" />
    </div>
  );
};

// Frame Node
export const FrameNode = ({ id, data, type, selected }: any) => {
  return (
    <div
      className={`w-full h-full min-w-[200px] min-h-[120px] border-2 border-dashed rounded-2xl transition-all relative ${
        selected ? 'border-blue-500 ring-3 ring-blue-300/40 shadow-lg' : 'border-zinc-400/60 hover:border-zinc-400'
      }`}
      style={{
        backgroundColor: data.styleOverride?.backgroundColor || 'rgba(255, 255, 255, 0.45)',
        borderColor: data.styleOverride?.borderColor || (selected ? '#3b82f6' : '#94a3b8'),
        ...pickBoxStyle(data.styleOverride)
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="border-blue-500 border-dashed"
        handleClassName="w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-sm shadow-md z-50 hover:scale-125 transition-transform cursor-pointer"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div 
        className="absolute -top-7 left-0 px-3 py-1 bg-zinc-800 text-white rounded-md text-xs font-semibold shadow-md flex items-center gap-1.5 select-none z-10"
        style={{
          backgroundColor: data.styleOverride?.headerBg || undefined,
          color: data.styleOverride?.headerColor || undefined
        }}
      >
        <EditableNodeLabel nodeId={id} label={data.label} placeholder="Quadro / Frame de Apresentação" />
      </div>
      
      <div className="w-full h-full p-3" />
    </div>
  );
};

// Preparation Node
export const PreparationNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;
  const strokeColor = data.styleOverride?.borderColor || '#0284c7';
  const fillColor = data.styleOverride?.backgroundColor || '#e0f2fe';
  const textColor = data.styleOverride?.color || '#0369a1';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-blue-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />

      <svg
        className={`absolute inset-0 w-full h-full overflow-visible transition-all ${
          selected ? 'filter drop-shadow-[0_0_6px_rgba(2,132,199,0.6)]' : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points="18,0 82,0 100,50 82,100 18,100 0,50"
          fill={fillColor}
          stroke={selected ? '#0369a1' : strokeColor}
          strokeWidth={selected ? 3 : (data.styleOverride?.borderWidth || 2)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <TagBadge tag={data.tag} />

      <div className="relative z-10 px-7 py-2 text-center w-full max-w-[82%] flex items-center justify-center">
        <EditableNodeLabel
          nodeId={id}
          label={data.label}
          style={{
            color: textColor,
            fontWeight: data.styleOverride?.fontWeight || '500',
            ...pickTextStyle(data.styleOverride)
          }}
        />
      </div>

      <MultipleHandles type={type} />
      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Manual Input Node
export const ManualInputNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;
  const strokeColor = data.styleOverride?.borderColor || '#64748b';
  const fillColor = data.styleOverride?.backgroundColor || '#f1f5f9';
  const textColor = data.styleOverride?.color || '#334155';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-slate-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-slate-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />

      <svg
        className={`absolute inset-0 w-full h-full overflow-visible transition-all ${
          selected ? 'filter drop-shadow-[0_0_6px_rgba(100,116,139,0.6)]' : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,22 100,0 100,100 0,100"
          fill={fillColor}
          stroke={selected ? '#334155' : strokeColor}
          strokeWidth={selected ? 3 : (data.styleOverride?.borderWidth || 2)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <TagBadge tag={data.tag} />

      <div className="relative z-10 px-5 pt-4 pb-2 text-center w-full flex items-center justify-center">
        <EditableNodeLabel
          nodeId={id}
          label={data.label}
          style={{
            color: textColor,
            fontWeight: data.styleOverride?.fontWeight || '500',
            ...pickTextStyle(data.styleOverride)
          }}
        />
      </div>

      <MultipleHandles type={type} />
      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Manual Operation Node
export const ManualOpNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;
  const strokeColor = data.styleOverride?.borderColor || '#d97706';
  const fillColor = data.styleOverride?.backgroundColor || '#fef3c7';
  const textColor = data.styleOverride?.color || '#92400e';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-amber-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-amber-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />

      <svg
        className={`absolute inset-0 w-full h-full overflow-visible transition-all ${
          selected ? 'filter drop-shadow-[0_0_6px_rgba(217,119,6,0.6)]' : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,0 100,0 82,100 18,100"
          fill={fillColor}
          stroke={selected ? '#b45309' : strokeColor}
          strokeWidth={selected ? 3 : (data.styleOverride?.borderWidth || 2)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <TagBadge tag={data.tag} />

      <div className="relative z-10 px-7 py-2 text-center w-full max-w-[85%] flex items-center justify-center">
        <EditableNodeLabel
          nodeId={id}
          label={data.label}
          style={{
            color: textColor,
            fontWeight: data.styleOverride?.fontWeight || '500',
            ...pickTextStyle(data.styleOverride)
          }}
        />
      </div>

      <MultipleHandles type={type} />
      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Display Node
export const DisplayNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;
  const strokeColor = data.styleOverride?.borderColor || '#0891b2';
  const fillColor = data.styleOverride?.backgroundColor || '#cffafe';
  const textColor = data.styleOverride?.color || '#155e75';

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-cyan-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-cyan-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />

      <svg
        className={`absolute inset-0 w-full h-full overflow-visible transition-all ${
          selected ? 'filter drop-shadow-[0_0_6px_rgba(8,145,178,0.6)]' : ''
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d="M 15 0 L 80 0 Q 100 50 80 100 L 15 100 Q 0 50 15 0 Z"
          fill={fillColor}
          stroke={selected ? '#0891b2' : strokeColor}
          strokeWidth={selected ? 3 : (data.styleOverride?.borderWidth || 2)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <TagBadge tag={data.tag} />

      <div className="relative z-10 px-6 py-2 text-center w-full max-w-[82%] flex items-center justify-center">
        <EditableNodeLabel
          nodeId={id}
          label={data.label}
          style={{
            color: textColor,
            fontWeight: data.styleOverride?.fontWeight || '500',
            ...pickTextStyle(data.styleOverride)
          }}
        />
      </div>

      <MultipleHandles type={type} />
      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Delay / Wait Node
export const DelayNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-rose-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-rose-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-5 py-3 border-2 shadow-sm rounded-r-full flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-rose-400/50 shadow-md border-rose-600' : 'border-rose-300 hover:border-rose-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#ffe4e6',
          borderColor: data.styleOverride?.borderColor || '#f43f5e',
          color: data.styleOverride?.color || '#881337',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <EditableNodeLabel nodeId={id} label={data.label} />
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Internal Storage Node
export const InternalStorageNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-emerald-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-emerald-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full relative px-5 py-3 border-2 shadow-sm rounded-md flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-emerald-400/50 shadow-md border-emerald-600' : 'border-emerald-300 hover:border-emerald-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#ecfdf5',
          borderColor: data.styleOverride?.borderColor || '#10b981',
          color: data.styleOverride?.color || '#065f46',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <div className="absolute top-2 left-0 right-0 h-px bg-emerald-400/80" />
        <div className="absolute top-0 bottom-0 left-3 w-px bg-emerald-400/80" />
        <TagBadge tag={data.tag} />
        <EditableNodeLabel nodeId={id} label={data.label} />
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Stored Data Node
export const StoredDataNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[80px] min-h-[38px]"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={38}
        lineClassName="border-violet-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-violet-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-5 py-3 border-2 shadow-sm rounded-r-2xl border-l-8 flex items-center justify-center text-center font-medium transition-all ${
          selected ? 'ring-3 ring-violet-400/50 shadow-md border-violet-600' : 'border-violet-300 hover:border-violet-400'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#f5f3ff',
          borderColor: data.styleOverride?.borderColor || '#7c3aed',
          color: data.styleOverride?.color || '#4c1d95',
          fontSize: data.styleOverride?.fontSize || '14px',
          fontWeight: data.styleOverride?.fontWeight || '500',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <EditableNodeLabel nodeId={id} label={data.label} />
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Off-Page Connector Node
export const OffPageNode = ({ id, data, type, selected }: any) => {
  const rotation = data.styleOverride?.rotation || 0;

  return (
    <div
      className="relative group w-full h-full min-w-[50px] min-h-[50px] flex items-center justify-center"
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={50}
        minHeight={50}
        lineClassName="border-blue-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-blue-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full px-3 py-2 border-2 shadow-sm flex items-center justify-center text-center font-semibold transition-all ${
          selected ? 'ring-3 ring-blue-400/50 shadow-md border-blue-600' : 'border-blue-400 hover:border-blue-500'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#eff6ff',
          borderColor: data.styleOverride?.borderColor || '#3b82f6',
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)',
          color: data.styleOverride?.color || '#1e3a8a',
          fontSize: data.styleOverride?.fontSize || '12px',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <div className="pb-2 text-center">
          <EditableNodeLabel nodeId={id} label={data.label || 'A1'} />
        </div>
        <MultipleHandles type={type} />
      </div>

      <TimingBadge nodeId={id} data={data} />
    </div>
  );
};

// Junction Node (Internal infrastructure node - 100% invisible)
export const JunctionNode = () => {
  return (
    <div
      style={{
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Handle
        id="center"
        type="source"
        position={Position.Top}
        style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
      />
      <Handle
        id="center"
        type="target"
        position={Position.Top}
        style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
      />
    </div>
  );
};

// Annotation / Callout Node
export const AnnotationNode = ({ id, data, type, selected }: any) => {
  return (
    <div className="relative group w-full h-full min-w-[80px] min-h-[30px]">
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={30}
        lineClassName="border-amber-500"
        handleClassName="h-2.5 w-2.5 bg-white border-2 border-amber-600 rounded-sm shadow"
        onResizeEnd={(_, params) => notifyResizeEnd(id, params)}
      />
      <div
        className={`w-full h-full pl-3 pr-2 py-2 border-l-4 border-dashed rounded-r-lg shadow-2xs flex items-center text-left font-sans italic text-xs transition-all ${
          selected ? 'ring-2 ring-amber-400 bg-amber-50/60' : 'hover:bg-amber-50/30'
        }`}
        style={{
          backgroundColor: data.styleOverride?.backgroundColor || '#fffbeb',
          borderColor: data.styleOverride?.borderColor || '#f59e0b',
          color: data.styleOverride?.color || '#78350f',
          ...pickBoxStyle(data.styleOverride),
          width: '100%',
          height: '100%'
        }}
      >
        <TagBadge tag={data.tag} />
        <EditableNodeLabel nodeId={id} label={data.label || 'Nota explicativa...'} />
        <MultipleHandles type={type} />
      </div>
    </div>
  );
};

export const customNodeTypes = {
  process: ProcessNode,
  start: StartNode,
  end: EndNode,
  decision: DecisionNode,
  database: DatabaseNode,
  document: DocumentNode,
  sticky: StickyNoteNode,
  subprocess: SubprocessNode,
  inputoutput: InputOutputNode,
  cloud: CloudNode,
  circle: CircleNode,
  text: TextNode,
  swimlane: SwimlaneNode,
  frame: FrameNode,
  preparation: PreparationNode,
  manualinput: ManualInputNode,
  manualoperation: ManualOpNode,
  display: DisplayNode,
  delay: DelayNode,
  internalstorage: InternalStorageNode,
  storeddata: StoredDataNode,
  offpage: OffPageNode,
  junction: JunctionNode,
  annotation: AnnotationNode,
};
