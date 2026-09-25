import React, { useRef, useState } from 'react';
import { AlarmClock, ChevronDown, Download, HardDriveDownload } from 'lucide-react';
import {
  BACKUP_REMINDER_PRESETS,
  MAX_CUSTOM_MINUTES,
  describeInterval,
  formatRemaining,
} from '../lib/backupReminder';

interface SaveStatusMenuProps {
  isSaving: boolean;
  saveError: boolean;
  reminder: {
    intervalMin: number;
    due: boolean;
    remainingMs: number | null;
    /** Ligado, mas sem alteração nova desde o último backup (não está contando). */
    waitingForChange?: boolean;
    setIntervalMinutes: (minutes: number) => void;
    acknowledge: () => void;
  };
  /** Baixa o .json deste fluxograma (todas as versões). */
  onDownloadFlow: () => void;
  /** Baixa o backup completo (todos os diagramas e pastas deste navegador). */
  onDownloadFull: () => void;
  /** Avisado quando o menu abre/fecha (o alerta flutuante da barra oculta
   * precisa continuar na tela enquanto o menu estiver aberto). */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Botão "Salvo" da barra superior + menu com o backup no PC e o lembrete.
 * Quando o lembrete vence, o botão fica âmbar e pisca; o clique para o
 * pisca-pisca (e recomeça a contagem) e abre o menu com o botão de backup.
 */
export const SaveStatusMenu: React.FC<SaveStatusMenuProps> = ({
  isSaving,
  saveError,
  reminder,
  onDownloadFlow,
  onDownloadFull,
  onOpenChange,
}) => {
  const [open, setOpenState] = useState(false);
  // Avisa quem está fora no MESMO clique (não num efeito depois): o alerta
  // flutuante da barra oculta some quando deixa de estar "vencido", e o
  // clique que abre o menu é o mesmo que para o pisca-pisca — avisando só
  // depois, o botão sumia antes de o menu chegar a abrir.
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Posição do menu calculada na hora de abrir: no celular a barra quebra em
  // linhas e o botão pode ficar perto da borda esquerda — alinhar o menu pela
  // direita do botão o jogava para fora da tela. Assim ele sempre cabe.
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const [custom, setCustom] = useState('');
  const isPreset = BACKUP_REMINDER_PRESETS.some((p) => p.minutes === reminder.intervalMin);

  const handleButton = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      const width = Math.min(288, window.innerWidth - 16);
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      const top = r.bottom + 8;
      setMenuPos({ left, top, width, maxHeight: Math.max(160, window.innerHeight - top - 8) });
    }
    setOpen(!open);
    if (reminder.due) reminder.acknowledge();
  };

  const download = (fn: () => void) => {
    fn();
    reminder.acknowledge();
    setOpen(false);
  };

  const applyCustom = () => {
    const n = Number(custom);
    if (!Number.isFinite(n) || n <= 0) return;
    reminder.setIntervalMinutes(n);
    setCustom('');
  };

  const stateClass = reminder.due
    ? 'backup-due-blink border-amber-500 text-white'
    : isSaving
      ? 'bg-zinc-50/90 border-zinc-200/90 text-zinc-500 hover:bg-zinc-100'
      : saveError
        ? 'bg-red-50/90 border-red-200/95 text-red-800 hover:bg-red-100'
        : 'bg-emerald-50/90 border-emerald-200/90 text-emerald-800 hover:bg-emerald-100';

  const title = reminder.due
    ? 'Hora de salvar um backup no seu computador — clique para parar o alerta e baixar'
    : isSaving
      ? 'Salvando neste navegador...'
      : saveError
        ? 'Erro ao salvar neste navegador'
        : 'Salvo automaticamente neste navegador — clique para baixar um backup ou configurar o lembrete';

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={handleButton}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${stateClass}`}
        title={title}
        data-backup-due={reminder.due ? 'true' : 'false'}
      >
        {reminder.due ? (
          <AlarmClock size={14} className="shrink-0" />
        ) : (
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isSaving ? 'bg-zinc-400 animate-pulse' : saveError ? 'bg-red-600' : 'bg-emerald-500 animate-pulse'
            }`}
          />
        )}
        {/* No celular só o indicador (e "Backup!" quando vence), para caber na barra */}
        <span className="font-bold hidden sm:inline">
          {reminder.due ? 'Fazer Backup!' : isSaving ? 'Salvando...' : saveError ? 'Erro ao Salvar' : 'Salvo'}
        </span>
        {reminder.due && <span className="font-bold sm:hidden">Backup!</span>}
        {reminder.intervalMin > 0 && !reminder.due && <AlarmClock size={12} className="opacity-60" />}
        <ChevronDown size={12} className="opacity-70" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-y-auto custom-scrollbar py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
            style={menuPos ? { left: menuPos.left, top: menuPos.top, width: menuPos.width, maxHeight: menuPos.maxHeight } : undefined}
          >
            <div className="px-4 pt-1.5 pb-2 text-[11px] text-zinc-500 leading-snug">
              {saveError
                ? 'Não foi possível salvar neste navegador. Baixe um backup agora.'
                : 'Tudo fica salvo automaticamente neste navegador. Para não perder nada, guarde também uma cópia no seu computador.'}
            </div>

            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Backup no computador</div>
            <button
              onClick={() => download(onDownloadFlow)}
              className="w-full px-4 py-2 text-left font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center justify-between cursor-pointer"
              title="Baixa este fluxograma com todas as versões, posições e tempos (.json)"
            >
              <span>Baixar backup deste fluxo (.json)</span>
              <Download size={14} />
            </button>
            <button
              onClick={() => download(onDownloadFull)}
              className="w-full px-4 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-between cursor-pointer"
              title="Baixa todos os diagramas e pastas salvos neste navegador em um único arquivo"
            >
              <span>Backup completo (todos os diagramas)</span>
              <HardDriveDownload size={14} className="text-zinc-500" />
            </button>

            <div className="my-1 h-px bg-zinc-100" />
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <AlarmClock size={11} /> Lembrete de backup
            </div>
            <div className="px-3 pb-1.5 grid grid-cols-3 gap-1.5">
              {BACKUP_REMINDER_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  onClick={() => reminder.setIntervalMinutes(p.minutes)}
                  className={`py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
                    reminder.intervalMin === p.minutes
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="px-3 pb-2 flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={MAX_CUSTOM_MINUTES}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
                placeholder={!isPreset && reminder.intervalMin ? `${reminder.intervalMin}` : 'Outro tempo'}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-800 outline-none focus:border-blue-500"
                aria-label="Tempo do lembrete em minutos"
              />
              <span className="text-[11px] text-zinc-500">min</span>
              <button
                onClick={applyCustom}
                disabled={!custom}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-semibold cursor-pointer"
              >
                Definir
              </button>
            </div>
            <div className="px-4 pb-1.5 text-[11px] text-zinc-500">
              {reminder.intervalMin === 0
                ? 'Lembrete desligado.'
                : reminder.due
                  ? `A cada ${describeInterval(reminder.intervalMin)} — hora de fazer backup!`
                  : reminder.waitingForChange || reminder.remainingMs === null
                    ? `A cada ${describeInterval(reminder.intervalMin)} · começa a contar na próxima alteração`
                    : `A cada ${describeInterval(reminder.intervalMin)} depois da alteração · faltam ${formatRemaining(reminder.remainingMs)}`}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
