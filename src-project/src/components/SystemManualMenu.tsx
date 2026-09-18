import React, { useState, useRef, useEffect } from 'react';
import { FileText, Download, ChevronDown, FileType, Check } from 'lucide-react';
import { downloadSystemManualFormat, ManualExportFormat } from '../utils/systemManual';

interface SystemManualMenuProps {
  variant?: 'light' | 'dark';
}

export const SystemManualMenu: React.FC<SystemManualMenuProps> = ({ variant = 'light' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: ManualExportFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadSystemManualFormat(format);
    setLastDownloaded(format);
    setIsOpen(false);
    setTimeout(() => setLastDownloaded(null), 3000);
  };

  const isDark = variant === 'dark';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border shadow-xs ${
          isDark
            ? 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-100 border-slate-700/80 hover:border-blue-500/50'
            : 'bg-blue-50/80 hover:bg-blue-100 text-blue-700 border-blue-200/80 hover:border-blue-300'
        }`}
        title="Exportar Manual Completo do Sistema (PDF, DOCX, TXT, MD)"
      >
        <FileText size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
        <span className="hidden xs:inline">Manual do Sistema</span>
        <span className="xs:hidden">Manual</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.15))' }}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">Exportar Manual</span>
            <span className="text-xs text-slate-600 font-medium">Selecione o Formato:</span>
          </div>

          <button
            onClick={(e) => handleExport('pdf', e)}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-red-50 hover:text-red-700 flex items-center justify-between font-semibold transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 font-extrabold text-[10px] flex items-center justify-center group-hover:scale-105 transition-transform">
                PDF
              </span>
              <div>
                <span className="block font-bold">Documento PDF</span>
                <span className="text-[10px] text-slate-400 font-normal">Para impressão e leitura</span>
              </div>
            </div>
            {lastDownloaded === 'pdf' ? <Check size={14} className="text-emerald-600" /> : <Download size={14} className="text-slate-400 group-hover:text-red-600" />}
          </button>

          <button
            onClick={(e) => handleExport('docx', e)}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between font-semibold transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 font-extrabold text-[10px] flex items-center justify-center group-hover:scale-105 transition-transform">
                DOC
              </span>
              <div>
                <span className="block font-bold">Word (.docx)</span>
                <span className="text-[10px] text-slate-400 font-normal">Formatado para Microsoft Word</span>
              </div>
            </div>
            {lastDownloaded === 'docx' ? <Check size={14} className="text-emerald-600" /> : <Download size={14} className="text-slate-400 group-hover:text-blue-600" />}
          </button>

          <button
            onClick={(e) => handleExport('txt', e)}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-between font-semibold transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-[10px] flex items-center justify-center group-hover:scale-105 transition-transform">
                TXT
              </span>
              <div>
                <span className="block font-bold">Texto Simples (.txt)</span>
                <span className="text-[10px] text-slate-400 font-normal">Sem formatação rica</span>
              </div>
            </div>
            {lastDownloaded === 'txt' ? <Check size={14} className="text-emerald-600" /> : <Download size={14} className="text-slate-400 group-hover:text-slate-700" />}
          </button>

          <button
            onClick={(e) => handleExport('md', e)}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between font-semibold transition-colors group border-t border-slate-100 mt-1 pt-2"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-[10px] flex items-center justify-center group-hover:scale-105 transition-transform">
                MD
              </span>
              <div>
                <span className="block font-bold">Markdown (.md)</span>
                <span className="text-[10px] text-slate-400 font-normal">Código fonte do manual</span>
              </div>
            </div>
            {lastDownloaded === 'md' ? <Check size={14} className="text-emerald-600" /> : <Download size={14} className="text-slate-400 group-hover:text-indigo-600" />}
          </button>
        </div>
      )}
    </div>
  );
};
