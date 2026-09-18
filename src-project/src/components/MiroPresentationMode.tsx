import React, { useState } from 'react';
import { Node } from '@xyflow/react';
import { Play, ChevronLeft, ChevronRight, X, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

interface MiroPresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  nodes: Node[];
  onFocusNode?: (nodeId: string) => void;
}

export const MiroPresentationMode: React.FC<MiroPresentationModeProps> = ({
  isOpen,
  onClose,
  title,
  nodes,
  onFocusNode
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const validNodes = nodes.filter(n => n.type !== 'swimlane' && n.type !== 'frame');
  const currentNode = validNodes[currentStep];

  const handleNext = () => {
    if (currentStep < validNodes.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      if (onFocusNode && validNodes[nextIdx]) {
        onFocusNode(validNodes[nextIdx].id);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      setCurrentStep(prevIdx);
      if (onFocusNode && validNodes[prevIdx]) {
        onFocusNode(validNodes[prevIdx].id);
      }
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-950/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-200 select-none">
      <div className="flex items-center gap-2 pr-3 border-r border-white/15">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-bold tracking-wide uppercase text-zinc-300">Modo Apresentação</span>
      </div>

      <div className="text-xs font-medium text-zinc-300 px-2 flex items-center gap-2">
        <span className="font-bold text-white text-sm">{title}</span>
        {currentNode && (
          <span className="px-2 py-0.5 rounded-full bg-blue-600/80 text-white text-[11px] font-semibold truncate max-w-[200px]">
            Etapa {currentStep + 1}: {currentNode.data?.label || currentNode.id}
          </span>
        )}
      </div>

      {/* Step Navigator */}
      <div className="flex items-center gap-1 bg-white/10 rounded-xl p-0.5">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Etapa Anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-xs font-bold px-2 text-zinc-200">
          {currentStep + 1} / {Math.max(1, validNodes.length)}
        </span>

        <button
          onClick={handleNext}
          disabled={currentStep >= validNodes.length - 1}
          className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Próxima Etapa"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="w-px h-5 bg-white/15 mx-1" />

      {/* Exit Button */}
      <button
        onClick={onClose}
        className="p-1.5 rounded-xl hover:bg-white/15 text-zinc-400 hover:text-white transition-colors"
        title="Sair da Apresentação (Esc)"
      >
        <X size={16} />
      </button>
    </div>
  );
};
