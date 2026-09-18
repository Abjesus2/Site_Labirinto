import React, { useState } from 'react';
import { MIRO_FLOWCHART_TEMPLATES, FlowTemplate } from '../templates';
import { X, Sparkles, LayoutTemplate, ArrowRight, Lock, ShoppingCart, GitBranch, Columns, Check } from 'lucide-react';

interface MiroTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: FlowTemplate) => void;
}

const iconMap: Record<string, any> = {
  Lock: <Lock size={20} className="text-blue-600" />,
  ShoppingCart: <ShoppingCart size={20} className="text-emerald-600" />,
  GitBranch: <GitBranch size={20} className="text-purple-600" />,
  Columns: <Columns size={20} className="text-amber-600" />,
};

export const MiroTemplatesModal: React.FC<MiroTemplatesModalProps> = ({ isOpen, onClose, onApplyTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate>(MIRO_FLOWCHART_TEMPLATES[0]);

  if (!isOpen) return null;

  const categories = ['Todos', 'Engenharia & Produto', 'Negócios & Vendas', 'DevOps & Nuvem', 'Processos & Negócios'];
  
  const filteredTemplates = selectedCategory === 'Todos'
    ? MIRO_FLOWCHART_TEMPLATES
    : MIRO_FLOWCHART_TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <LayoutTemplate size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Modelos de Fluxograma Profissionais</h2>
              <p className="text-xs text-zinc-500">Escolha um modelo profissional pronto para acelerar sua criação.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="px-6 py-3 border-b border-zinc-100 flex items-center gap-2 overflow-x-auto bg-white">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map(template => {
            const isSelected = selectedTemplate?.id === template.id;
            return (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-100' 
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-zinc-100">
                      {iconMap[template.icon] || <Sparkles size={20} className="text-zinc-600" />}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 bg-zinc-100 rounded-full text-zinc-600">
                      {template.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-zinc-900 mb-1">{template.name}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{template.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <div className="text-[11px] font-medium text-zinc-400">
                    {template.nodes.length} nós • {template.edges.length} conexões
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                      <Check size={14} /> Selecionado
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="text-xs text-zinc-500">
            Você poderá personalizar todas as formas, textos e conexões livremente no quadro.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (selectedTemplate) {
                  onApplyTemplate(selectedTemplate);
                  onClose();
                }
              }}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              Aplicar ao Quadro <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
