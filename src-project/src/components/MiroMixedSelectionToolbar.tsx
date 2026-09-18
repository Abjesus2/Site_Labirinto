import React from 'react';
import { Node, Edge } from '@xyflow/react';
import {
  Layers,
  Trash2,
  X,
  ChevronRight,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal
} from 'lucide-react';

interface MiroMixedSelectionToolbarProps {
  selectedNodes: Node[];
  selectedEdges: Edge[];
  onDeleteAll: () => void;
  onClearSelection: () => void;
  onHideSidebar?: () => void;
  onUpdateBulkStyle?: (style: Record<string, any>) => void;
}

const PALETTE_COLORS = [
  { name: 'Branco', bg: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
  { name: 'Azul Claro', bg: '#eff6ff', border: '#60a5fa', text: '#1e3a8a' },
  { name: 'Verde Claro', bg: '#dcfce7', border: '#4ade80', text: '#14532d' },
  { name: 'Amarelo Claro', bg: '#fef9c3', border: '#facc15', text: '#713f12' },
  { name: 'Vermelho Claro', bg: '#fee2e2', border: '#f87171', text: '#7f1d1d' },
  { name: 'Roxo Claro', bg: '#f3e8ff', border: '#c084fc', text: '#581c87' },
  { name: 'Ardósia Escuro', bg: '#1e293b', border: '#0f172a', text: '#ffffff' },
];

export const MiroMixedSelectionToolbar: React.FC<MiroMixedSelectionToolbarProps> = ({
  selectedNodes,
  selectedEdges,
  onDeleteAll,
  onClearSelection,
  onHideSidebar,
  onUpdateBulkStyle
}) => {
  const triggerAlign = (mode: string) => {
    window.dispatchEvent(new CustomEvent('flow-align-nodes', { detail: { mode } }));
  };

  const triggerDistribute = (mode: string) => {
    window.dispatchEvent(new CustomEvent('flow-distribute-nodes', { detail: { mode } }));
  };

  const totalCount = selectedNodes.length + selectedEdges.length;

  return (
    <div className="flex flex-col h-full bg-white select-none text-zinc-800">
      {/* SIDEBAR HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/80">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
            <Layers size={16} />
          </div>
          <div className="truncate min-w-0">
            <h3 className="text-xs font-bold text-zinc-900 truncate">
              {totalCount} Itens Selecionados
            </h3>
            <p className="text-[10px] text-zinc-500 font-medium">
              Seleção Mista (Formas e Conexões)
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
          <button
            onClick={onClearSelection}
            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Desmarcar Tudo"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* SUMMARY BANNER */}
      <div className="bg-purple-50/80 border-b border-purple-100 px-4 py-2.5 text-xs text-purple-900 space-y-1">
        <div className="flex justify-between items-center font-semibold">
          <span>{selectedNodes.length} Formas no Diagrama</span>
          <span>{selectedEdges.length} Linhas de Conexão</span>
        </div>
        <p className="text-[10.5px] text-purple-700 font-normal">
          Apenas configurações compatíveis com todos os itens selecionados são exibidas abaixo.
        </p>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* SHAPE ALIGNMENT */}
        {selectedNodes.length > 1 && (
          <div className="space-y-2 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                Alinhamento das Formas
              </span>
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
          </div>
        )}

        {/* BULK COLOR PALETTE */}
        {onUpdateBulkStyle && (
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Cor de Destaque Unificada
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c.bg}
                  onClick={() =>
                    onUpdateBulkStyle({
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
          </div>
        )}

        {/* DELETE ALL SELECTED */}
        <div className="pt-3 border-t border-zinc-100">
          <button
            onClick={onDeleteAll}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl font-bold transition-all cursor-pointer border border-red-200"
          >
            <Trash2 size={16} />
            <span>Excluir Todos os {totalCount} Itens Selecionados</span>
          </button>
        </div>
      </div>
    </div>
  );
};
