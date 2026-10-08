import React from 'react';
import { ChevronLeft, ChevronRight, X, SkipBack } from 'lucide-react';

export interface PresentationStep {
  id: string;
  label: string;
}

interface MiroPresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Etapas na ordem do fluxo. */
  steps: PresentationStep[];
  /** Etapa mostrada agora (índice em `steps`). */
  currentIndex: number;
  /** Ir para uma etapa (setas, lista ou clique numa forma do quadro). */
  onGoTo: (index: number) => void;
}

/**
 * Barra do modo apresentação. A etapa atual é controlada pelo editor: além
 * das setas, dá para escolher qualquer etapa na lista ou clicar numa forma do
 * quadro para continuar a apresentação a partir dela.
 */
export const MiroPresentationMode: React.FC<MiroPresentationModeProps> = ({
  isOpen,
  onClose,
  title,
  steps,
  currentIndex,
  onGoTo,
}) => {
  if (!isOpen) return null;

  const total = steps.length;
  const index = Math.min(Math.max(0, currentIndex), Math.max(0, total - 1));

  return (
    <div
      data-presentation-bar
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-16px)] flex items-center gap-2 sm:gap-3 bg-zinc-950/90 backdrop-blur-md text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-200 select-none"
    >
      <div className="hidden md:flex items-center gap-2 pr-3 border-r border-white/15 shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-bold tracking-wide uppercase text-zinc-300">Modo Apresentação</span>
      </div>
      <div className="md:hidden w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Modo Apresentação" />

      <div className="min-w-0 flex items-center gap-2 text-xs font-medium text-zinc-300">
        <span className="hidden lg:inline font-bold text-white text-sm truncate max-w-[180px]">{title}</span>
        {total > 0 ? (
          <select
            data-presentation-steps
            value={index}
            onChange={(e) => onGoTo(Number(e.target.value))}
            className="min-w-0 w-full sm:w-auto max-w-[240px] px-2 py-1 rounded-full bg-blue-600/80 text-white text-[11px] font-semibold truncate cursor-pointer border-0 outline-none"
            title="Ir para uma etapa (ou clique numa forma do quadro)"
          >
            {steps.map((s, i) => (
              <option key={s.id} value={i} className="text-zinc-900 bg-white">
                {i + 1}. {s.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[11px]">Nenhuma etapa para apresentar</span>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center gap-0.5 bg-white/10 rounded-xl p-0.5 shrink-0">
        <button
          onClick={() => onGoTo(0)}
          disabled={index === 0}
          className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          title="Voltar ao início do fluxo"
          aria-label="Voltar ao início do fluxo"
        >
          <SkipBack size={14} />
        </button>
        <button
          onClick={() => onGoTo(index - 1)}
          disabled={index === 0}
          className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          title="Etapa Anterior"
          aria-label="Etapa Anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span data-presentation-counter className="text-xs font-bold px-1.5 text-zinc-200 whitespace-nowrap">
          {total ? index + 1 : 0} / {total}
        </span>

        <button
          onClick={() => onGoTo(index + 1)}
          disabled={index >= total - 1}
          className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          title="Próxima Etapa"
          aria-label="Próxima Etapa"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <button
        onClick={onClose}
        className="p-1.5 rounded-xl hover:bg-white/15 text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
        title="Sair da Apresentação (Esc)"
        aria-label="Sair da Apresentação"
      >
        <X size={16} />
      </button>
    </div>
  );
};
