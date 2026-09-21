import React, { useState } from 'react';
import {
  MousePointer2,
  Hand,
  LayoutTemplate,
  Type,
  StickyNote,
  Square,
  Circle,
  Diamond,
  Database,
  FileText,
  Cloud,
  Columns,
  Sparkles,
  Smile,
  Spline,
  Layers,
  ChevronRight,
  Plus,
  ArrowLeftRight,
  Hexagon,
  Keyboard,
  Wrench,
  Monitor,
  Hourglass,
  HardDrive,
  FileSpreadsheet,
  CornerDownRight,
  PlusCircle,
  MessageSquare,
  Boxes,
  X,
  Eye
} from 'lucide-react';

interface MiroToolbarProps {
  toolMode: 'select' | 'pan';
  setToolMode: (mode: 'select' | 'pan') => void;
  onAddNode: (type: string, initialData?: Record<string, any>) => void;
  onAddFreeEdge?: () => void;
  isPlacingFreeEdge?: boolean;
  onOpenTemplates: () => void;
  onOpenAI: () => void;
  isNavigationMode: boolean;
  setIsNavigationMode: (value: boolean) => void;
}

const STICKY_COLORS = [
  { name: 'Amarelo Clássico', bg: '#fef08a', text: '#713f12' },
  { name: 'Verde Menta', bg: '#bbf7d0', text: '#14532d' },
  { name: 'Rosa Coral', bg: '#fbcfe8', text: '#831843' },
  { name: 'Azul Céu', bg: '#bae6fd', text: '#0c4a6e' },
  { name: 'Lavanda', bg: '#e9d5ff', text: '#581c87' },
  { name: 'Laranja Pêssego', bg: '#fed7aa', text: '#7c2d12' },
  { name: 'Cinza Neutro', bg: '#e2e8f0', text: '#1e293b' },
  { name: 'Turquesa', bg: '#99f6e4', text: '#134e4a' },
];

export const MiroToolbar: React.FC<MiroToolbarProps> = ({
  toolMode,
  setToolMode,
  onAddNode,
  onAddFreeEdge,
  isPlacingFreeEdge,
  onOpenTemplates,
  onOpenAI,
  isNavigationMode,
  setIsNavigationMode
}) => {
  const [activeFlyout, setActiveFlyout] = useState<'shapes' | 'sticky' | 'frames' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleFlyout = (name: 'shapes' | 'sticky' | 'frames') => {
    setActiveFlyout(activeFlyout === name ? null : name);
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, extraData?: Record<string, any>) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    if (extraData) {
      event.dataTransfer.setData('application/reactflow/data', JSON.stringify(extraData));
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="bg-white/95 backdrop-blur-md border border-zinc-200 shadow-xl rounded-2xl p-2.5 text-zinc-700 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1 font-bold text-xs cursor-pointer"
        title="Exibir Barra de Ferramentas Lateral"
      >
        <ChevronRight size={18} />
        <span className="hidden sm:inline">Ferramentas</span>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Miro Left Floating Toolstrip */}
      <aside className="bg-white/95 backdrop-blur-md border border-zinc-200/90 shadow-xl rounded-2xl p-1.5 flex flex-col gap-1 z-30 select-none max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
        {/* Toggle Collapse */}
        <button
          onClick={() => { setIsCollapsed(true); setActiveFlyout(null); }}
          className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors text-center flex justify-center cursor-pointer"
          title="Ocultar Barra Lateral"
        >
          <ChevronRight size={16} className="rotate-180" />
        </button>

        {/* Select / Move */}
        <button
          onClick={() => { setToolMode('select'); setActiveFlyout(null); }}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            toolMode === 'select'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
          title="Ferramenta de Seleção (V)"
        >
          <MousePointer2 size={18} />
        </button>

        {/* Hand / Pan */}
        <button
          onClick={() => { setToolMode('pan'); setActiveFlyout(null); }}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            toolMode === 'pan'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
          title="Ferramenta de Navegação / Mão (H)"
        >
          <Hand size={18} />
        </button>

        {/* Modo Navegação: trava toda edição/seleção — só sobra pan/zoom
            para avaliar o conteúdo sem risco de mexer em nada. */}
        <button
          onClick={() => { setIsNavigationMode(!isNavigationMode); setActiveFlyout(null); }}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            isNavigationMode
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700'
          }`}
          title={isNavigationMode ? 'Sair do Modo Navegação' : 'Modo Navegação (somente visualizar, sem editar)'}
        >
          <Eye size={18} />
        </button>

        {!isNavigationMode && (
          <>
            <div className="w-full h-px bg-zinc-200 my-1" />

            {/* Templates */}
            <button
              onClick={() => { onOpenTemplates(); setActiveFlyout(null); }}
              className="p-2.5 rounded-xl text-zinc-600 hover:bg-amber-50 hover:text-amber-700 transition-all group cursor-pointer"
              title="Modelos de Fluxograma"
            >
              <LayoutTemplate size={18} className="group-hover:scale-110 transition-transform" />
            </button>

            {/* Text Tool */}
            <button
              onClick={() => {
                onAddNode('text', { label: 'Novo Texto' });
                setActiveFlyout(null);
              }}
              className="p-2.5 rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-all cursor-pointer"
              title="Inserir Texto (T)"
            >
              <Type size={18} />
            </button>

            {/* Free Connector / Arrow Line */}
            {onAddFreeEdge && (
              <button
                onClick={() => {
                  onAddFreeEdge();
                  setActiveFlyout(null);
                }}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  isPlacingFreeEdge
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
                title={isPlacingFreeEdge ? 'Clique no canvas para posicionar a linha (Esc cancela)' : 'Adicionar Seta / Linha Independente'}
              >
                <Spline size={18} />
              </button>
            )}

            {/* Sticky Notes Flyout */}
            <div className="relative">
              <button
                onClick={() => toggleFlyout('sticky')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  activeFlyout === 'sticky' ? 'bg-yellow-100 text-yellow-800' : 'text-zinc-600 hover:bg-yellow-50 hover:text-yellow-700'
                }`}
                title="Notas Adesivas (Sticky Notes)"
              >
                <StickyNote size={18} />
              </button>
            </div>

            {/* Shapes Library Flyout */}
            <div className="relative">
              <button
                onClick={() => toggleFlyout('shapes')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  activeFlyout === 'shapes' ? 'bg-blue-100 text-blue-800' : 'text-zinc-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
                title="Biblioteca de Formas de Fluxograma"
              >
                <Square size={18} />
              </button>
            </div>

            {/* Swimlanes & Frames Flyout */}
            <div className="relative">
              <button
                onClick={() => toggleFlyout('frames')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  activeFlyout === 'frames' ? 'bg-purple-100 text-purple-800' : 'text-zinc-600 hover:bg-purple-50 hover:text-purple-700'
                }`}
                title="Raias (Swimlanes) e Quadros"
              >
                <Columns size={18} />
              </button>
            </div>

            <div className="w-full h-px bg-zinc-200 my-1" />

            {/* AI Generator Button */}
            <button
              onClick={() => { onOpenAI(); setActiveFlyout(null); }}
              className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all group cursor-pointer"
              title="Assistente IA - Geração de Fluxos"
            >
              <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
            </button>
          </>
        )}
      </aside>

      {/* Backdrop for closing active flyout on mobile and desktop */}
      {activeFlyout && (
        <div 
          className="fixed inset-0 z-45 bg-transparent"
          onClick={() => setActiveFlyout(null)}
        />
      )}

      {/* FLYOUT DRAWER FOR SHAPES */}
      {activeFlyout === 'shapes' && (
        <div className="absolute left-full top-0 ml-3 w-72 sm:w-84 max-w-[calc(100vw-85px)] bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200/90 p-3.5 sm:p-4 z-50 animate-in fade-in slide-in-from-left-2 duration-150 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-100">
            <div>
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Símbolos de Fluxograma</div>
              <div className="text-[10px] text-zinc-500">Clique para adicionar ou arraste para o canvas</div>
            </div>
            <button
              onClick={() => setActiveFlyout(null)}
              className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Básicos */}
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Essenciais</div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => { onAddNode('start'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'start')}
                  draggable
                  className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-center text-xs font-medium text-emerald-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Circle size={13} className="text-emerald-600 fill-emerald-200" /> Início
                </div>
                <div
                  onClick={() => { onAddNode('end'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'end')}
                  draggable
                  className="p-2 rounded-xl bg-red-50 border border-red-300 hover:bg-red-100 text-center text-xs font-medium text-red-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Circle size={13} className="text-red-600 fill-red-200" /> Fim
                </div>
                <div
                  onClick={() => { onAddNode('process'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'process')}
                  draggable
                  className="col-span-2 p-2.5 rounded-xl bg-blue-50 border border-blue-300 hover:bg-blue-100 text-center text-xs font-medium text-blue-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Square size={14} className="text-blue-600 fill-blue-100" /> Processo / Ação
                </div>
                <div
                  onClick={() => { onAddNode('decision'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'decision')}
                  draggable
                  className="col-span-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-center text-xs font-medium text-amber-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Diamond size={14} className="text-amber-600 fill-amber-100" /> Decisão (Gateway)
                </div>
                <div
                  onClick={() => { onAddNode('inputoutput'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'inputoutput')}
                  draggable
                  className="col-span-2 p-2 rounded-xl bg-teal-50 border border-teal-300 hover:bg-teal-100 text-center text-xs font-medium text-teal-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <ArrowLeftRight size={13} className="text-teal-600" /> Entrada / Saída de Dados
                </div>
              </div>
            </div>

            {/* Dados & Documentos */}
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Dados & Documentos</div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => { onAddNode('database'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'database')}
                  draggable
                  className="p-2 rounded-xl bg-purple-50 border border-purple-300 hover:bg-purple-100 text-center text-xs font-medium text-purple-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Database size={13} /> Banco de Dados
                </div>
                <div
                  onClick={() => { onAddNode('document'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'document')}
                  draggable
                  className="p-2 rounded-xl bg-orange-50 border border-orange-300 hover:bg-orange-100 text-center text-xs font-medium text-orange-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <FileText size={13} /> Documento
                </div>
                <div
                  onClick={() => { onAddNode('storeddata'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'storeddata')}
                  draggable
                  className="p-2 rounded-xl bg-violet-50 border border-violet-300 hover:bg-violet-100 text-center text-xs font-medium text-violet-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <FileSpreadsheet size={13} /> Dados Armaz.
                </div>
                <div
                  onClick={() => { onAddNode('internalstorage'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'internalstorage')}
                  draggable
                  className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-center text-xs font-medium text-emerald-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <HardDrive size={13} /> Armazenamento
                </div>
              </div>
            </div>

            {/* Engenharia & Operações */}
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Engenharia & Operações</div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => { onAddNode('subprocess'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'subprocess')}
                  draggable
                  className="p-2 rounded-xl bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 text-center text-xs font-medium text-indigo-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Boxes size={13} /> Subprocesso
                </div>
                <div
                  onClick={() => { onAddNode('preparation'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'preparation')}
                  draggable
                  className="p-2 rounded-xl bg-sky-50 border border-sky-300 hover:bg-sky-100 text-center text-xs font-medium text-sky-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Hexagon size={13} /> Preparação
                </div>
                <div
                  onClick={() => { onAddNode('manualinput'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'manualinput')}
                  draggable
                  className="p-2 rounded-xl bg-slate-50 border border-slate-300 hover:bg-slate-100 text-center text-xs font-medium text-slate-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Keyboard size={13} /> Entrada Manual
                </div>
                <div
                  onClick={() => { onAddNode('manualoperation'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'manualoperation')}
                  draggable
                  className="p-2 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-center text-xs font-medium text-amber-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Wrench size={13} /> Operação Manual
                </div>
                <div
                  onClick={() => { onAddNode('display'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'display')}
                  draggable
                  className="p-2 rounded-xl bg-cyan-50 border border-cyan-300 hover:bg-cyan-100 text-center text-xs font-medium text-cyan-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Monitor size={13} /> Display / Visor
                </div>
                <div
                  onClick={() => { onAddNode('delay'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'delay')}
                  draggable
                  className="p-2 rounded-xl bg-rose-50 border border-rose-300 hover:bg-rose-100 text-center text-xs font-medium text-rose-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Hourglass size={13} /> Espera / Delay
                </div>
              </div>
            </div>

            {/* Conectores & Anotações */}
            <div>
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Conectores & Outros</div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => { onAddNode('cloud'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'cloud')}
                  draggable
                  className="p-2 rounded-xl bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 text-center text-xs font-medium text-indigo-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Cloud size={13} /> Nuvem / API
                </div>
                <div
                  onClick={() => { onAddNode('offpage'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'offpage')}
                  draggable
                  className="p-2 rounded-xl bg-blue-50 border border-blue-300 hover:bg-blue-100 text-center text-xs font-medium text-blue-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <CornerDownRight size={13} /> Fora de Página
                </div>
                <div
                  onClick={() => { onAddNode('junction'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'junction')}
                  draggable
                  className="p-2 rounded-xl bg-zinc-100 border border-zinc-300 hover:bg-zinc-200 text-center text-xs font-medium text-zinc-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <PlusCircle size={13} /> + Junção
                </div>
                <div
                  onClick={() => { onAddNode('circle'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'circle')}
                  draggable
                  className="p-2 rounded-xl bg-slate-100 border border-slate-300 hover:bg-slate-200 text-center text-xs font-medium text-slate-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <Circle size={13} /> Evento / Círculo
                </div>
                <div
                  onClick={() => { onAddNode('annotation'); setActiveFlyout(null); }}
                  onDragStart={(e) => onDragStart(e, 'annotation')}
                  draggable
                  className="col-span-2 p-2 rounded-xl bg-yellow-50 border border-yellow-300 hover:bg-yellow-100 text-center text-xs font-medium text-yellow-900 cursor-grab active:cursor-grabbing transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <MessageSquare size={13} /> Anotação Explicativa
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLYOUT DRAWER FOR STICKY NOTES */}
      {activeFlyout === 'sticky' && (
        <div className="absolute left-full top-12 ml-3 w-64 sm:w-72 max-w-[calc(100vw-85px)] bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200/90 p-3.5 sm:p-4 z-50 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100">
            <div>
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Notas Adesivas</div>
              <div className="text-[10px] text-zinc-500">Clique ou arraste a nota com sua cor preferida</div>
            </div>
            <button
              onClick={() => setActiveFlyout(null)}
              className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {STICKY_COLORS.map(s => (
              <div
                key={s.name}
                onClick={() => {
                  onAddNode('sticky', {
                    label: 'Nova anotação...',
                    styleOverride: { backgroundColor: s.bg, color: s.text }
                  });
                  setActiveFlyout(null);
                }}
                onDragStart={(e) => onDragStart(e, 'sticky', {
                  label: 'Nova anotação...',
                  styleOverride: { backgroundColor: s.bg, color: s.text }
                })}
                draggable
                className="w-11 h-11 sm:w-13 sm:h-13 rounded-md shadow-md hover:scale-110 cursor-grab active:cursor-grabbing transition-transform flex items-center justify-center border border-black/10"
                style={{ backgroundColor: s.bg }}
                title={s.name}
              >
                <Plus size={14} className="opacity-50" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLYOUT DRAWER FOR SWIMLANES & FRAMES */}
      {activeFlyout === 'frames' && (
        <div className="absolute left-full top-24 ml-3 w-64 sm:w-72 max-w-[calc(100vw-85px)] bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200/90 p-3.5 sm:p-4 z-50 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100">
            <div>
              <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Raias & Quadros</div>
              <div className="text-[10px] text-zinc-500">Agrupe por departamento ou seção</div>
            </div>
            <button
              onClick={() => setActiveFlyout(null)}
              className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
          <div className="space-y-2 mt-2">
            <button
              onClick={() => {
                onAddNode('swimlane', { label: '👤 Raia do Setor / Papel', width: 900, height: 200 });
                setActiveFlyout(null);
              }}
              className="w-full p-2.5 rounded-xl border border-zinc-200 hover:border-blue-400 hover:bg-blue-50/40 text-left text-xs font-medium text-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Columns size={16} className="text-blue-600 shrink-0" />
              <div>
                <div className="font-bold text-xs text-zinc-800">Raia (Swimlane)</div>
                <div className="text-[10px] text-zinc-500">Horizontal por departamento / área</div>
              </div>
            </button>

            <button
              onClick={() => {
                onAddNode('frame', { label: 'Quadro / Seção', width: 700, height: 450 });
                setActiveFlyout(null);
              }}
              className="w-full p-2.5 rounded-xl border border-zinc-200 hover:border-purple-400 hover:bg-purple-50/40 text-left text-xs font-medium text-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Layers size={16} className="text-purple-600 shrink-0" />
              <div>
                <div className="font-bold text-xs text-zinc-800">Quadro / Frame</div>
                <div className="text-[10px] text-zinc-500">Agrupador visual de etapas</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

