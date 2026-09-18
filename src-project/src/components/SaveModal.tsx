import React, { useState } from 'react';
import { Cloud, Download, Folder, HardDrive, FileSpreadsheet, FileCode, Image, X, Check, Save } from 'lucide-react';

export const SaveModal = ({ isOpen, onClose, onSave, fileName, setFileName }: any) => {
  const [type, setType] = useState('xml');
  const [location, setLocation] = useState('download');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExecuteSave = () => {
    // Antes, só "download"/"device" chamavam onSave: os outros destinos
    // mostravam sucesso sem salvar nada. Agora todo destino é encaminhado.
    onSave(type, location);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, location === 'download' || location === 'device' ? 500 : 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md border border-zinc-200 text-zinc-800 animate-in fade-in zoom-in-95 duration-150" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Save size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Guardar como...</h2>
              <p className="text-xs text-zinc-500">Escolha o nome, formato e destino do arquivo.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Form Controls */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-1.5">
              Nome do Fluxograma:
            </label>
            <input 
              type="text" 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Nome do arquivo..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-sm text-zinc-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-1.5">
              Formato do Arquivo:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('xml')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  type === 'xml'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-xs'
                    : 'border-zinc-200 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <FileCode size={18} className={type === 'xml' ? 'text-blue-600' : 'text-zinc-400'} />
                <span>Draw.io (.xml)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('json')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  type === 'json'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-xs'
                    : 'border-zinc-200 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <FileCode size={18} className={type === 'json' ? 'text-blue-600' : 'text-zinc-400'} />
                <span>JSON (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('png')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  type === 'png'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-xs'
                    : 'border-zinc-200 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Image size={18} className={type === 'png' ? 'text-blue-600' : 'text-zinc-400'} />
                <span>Imagem (.png)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-1.5">
              Destino do Arquivo:
            </label>
            <select 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-sm text-zinc-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
            >
              <option value="download">📥 Descarregar no Computador / Aparelho</option>
              <option value="github">🐙 GitHub - Repositório / Pasta</option>
            </select>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-end gap-2.5">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleExecuteSave}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            {isSuccess ? (
              <>
                <Check size={14} />
                <span>Salvo!</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Confirmar e Guardar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

