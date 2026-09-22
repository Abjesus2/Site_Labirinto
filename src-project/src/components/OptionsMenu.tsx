import React, { useState, useRef, useEffect } from 'react';
import { Settings, ChevronDown, Moon, Sun, SearchCode, Save, FileText, Download, Check, ChevronRight } from 'lucide-react';
import { openAISettings } from '../lib/aiSettingsUI';
import { downloadSystemManualFormat, ManualExportFormat } from '../utils/systemManual';
import { useTheme } from '../lib/useTheme';
import { setThemeMode, setThemePalette, PALETTES } from '../lib/theme';

interface OptionsMenuProps {
  onOpenBackup: () => void;
}

/**
 * Botão único "Opções" na barra superior da tela inicial, reunindo tudo que
 * antes eram botões separados (Configurar IA, Backup Completo, Manual do
 * Sistema) + as opções novas de aparência (modo claro/escuro e paleta de
 * cor de destaque). O tema aplicado aqui vale pro site inteiro (inclusive
 * o editor de fluxograma), já que fica salvo e é aplicado direto em <html>.
 */
export const OptionsMenu: React.FC<OptionsMenuProps> = ({ onOpenBackup }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { mode, palette } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setManualOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: ManualExportFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadSystemManualFormat(format);
    setLastDownloaded(format);
    setTimeout(() => setLastDownloaded(null), 3000);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 text-zinc-700 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all shadow-sm"
        title="Opções: aparência, IA, backup e manual"
      >
        <Settings size={16} />
        <span className="hidden sm:inline">Opções</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-2xl border border-zinc-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[80vh] overflow-y-auto"
          style={{ filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.15))' }}
        >
          {/* Aparência */}
          <div className="px-3.5 py-1.5">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block mb-2">Aparência</span>

            <button
              onClick={() => setThemeMode(mode === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-zinc-100 transition-colors mb-2"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                {mode === 'dark' ? <Moon size={15} className="text-indigo-500" /> : <Sun size={15} className="text-amber-500" />}
                Modo {mode === 'dark' ? 'Escuro' : 'Claro'}
              </span>
              <span
                className={`relative w-9 h-5 rounded-full transition-colors ${mode === 'dark' ? 'bg-[var(--accent-600)]' : 'bg-zinc-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${mode === 'dark' ? 'translate-x-4' : ''}`}
                />
              </span>
            </button>

            <span className="text-[10px] font-semibold text-zinc-400 uppercase block mb-1.5 px-2.5">Paleta de cor</span>
            <div className="flex items-center gap-2 px-2.5 pb-1">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setThemePalette(p.id)}
                  title={p.label}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                    palette === p.id ? 'ring-2 ring-offset-2 ring-zinc-400' : ''
                  }`}
                  style={{ backgroundColor: p.swatch }}
                >
                  {palette === p.id && <Check size={13} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-100 my-1.5" />

          {/* Ferramentas */}
          <div className="px-1.5">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block mb-1 px-2">Ferramentas</span>

            <button
              onClick={() => { openAISettings(); setIsOpen(false); }}
              className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
            >
              <SearchCode size={15} className="text-blue-600" />
              Configurar IA
            </button>

            <button
              onClick={() => { onOpenBackup(); setIsOpen(false); }}
              className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
            >
              <Save size={15} className="text-blue-600" />
              Backup Completo
            </button>

            <button
              onClick={() => setManualOpen((v) => !v)}
              className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between gap-2.5 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <FileText size={15} className="text-blue-600" />
                Manual do Sistema
              </span>
              <ChevronRight size={13} className={`transition-transform ${manualOpen ? 'rotate-90' : ''}`} />
            </button>

            {manualOpen && (
              <div className="pl-3 pr-1 pb-1">
                {([
                  ['pdf', 'PDF', 'bg-red-100 text-red-600', 'Documento PDF'],
                  ['docx', 'DOC', 'bg-blue-100 text-blue-600', 'Word (.docx)'],
                  ['txt', 'TXT', 'bg-zinc-100 text-zinc-700', 'Texto Simples (.txt)'],
                  ['md', 'MD', 'bg-indigo-100 text-indigo-700', 'Markdown (.md)'],
                ] as [ManualExportFormat, string, string, string][]).map(([format, tag, tagClass, label]) => (
                  <button
                    key={format}
                    onClick={(e) => handleExport(format, e)}
                    className="w-full text-left px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 flex items-center justify-between font-medium transition-colors rounded-lg"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-md font-extrabold text-[9px] flex items-center justify-center ${tagClass}`}>
                        {tag}
                      </span>
                      {label}
                    </span>
                    {lastDownloaded === format ? <Check size={12} className="text-emerald-600" /> : <Download size={12} className="text-zinc-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
