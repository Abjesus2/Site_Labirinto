import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Share2, Copy, Check, Download, Users, FileJson, X } from 'lucide-react';
import { copyText } from '../lib/embedCompat';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramTitle: string;
  jsonText: string;
  onDownloadJson: () => void;
}

/**
 * Compartilhamento sem nuvem.
 * A versao anterior dependia do Google Drive (conta Google + permissoes).
 * Como a conexao com o Google foi removida, o compartilhamento passa a ser
 * feito pelo proprio arquivo do fluxograma: baixar, copiar ou enviar o JSON,
 * que o colega abre em "Importar Fluxograma (.json)".
 */
export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  diagramTitle,
  jsonText,
  onDownloadJson,
}) => {
  const [copied, setCopied] = useState<'json' | 'link' | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, which: 'json' | 'link') => {
    await copyText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const appLink = typeof location !== 'undefined' ? location.href : '';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Share2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Compartilhar Fluxograma</h3>
                <p className="text-xs text-zinc-500 truncate max-w-[240px]">
                  {diagramTitle || 'Fluxograma Sem Título'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Users size={16} />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-zinc-900">Sem conta e sem nuvem</span>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    O fluxograma fica no seu navegador. Para compartilhar, envie o arquivo
                    <strong> .json</strong> — quem receber abre em <strong>Exportar → Importar Fluxograma</strong> e
                    continua a edição com todas as versões e tempos.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onDownloadJson}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Baixar arquivo do fluxograma (.json)
            </button>

            <button
              onClick={() => handleCopy(jsonText, 'json')}
              className="w-full py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {copied === 'json' ? <Check size={14} className="text-emerald-600" /> : <FileJson size={14} />}
              {copied === 'json' ? 'Conteúdo copiado!' : 'Copiar conteúdo do fluxograma'}
            </button>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Link do editor (para o colega abrir o app):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={appLink}
                  className="flex-1 px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 font-mono select-all outline-none"
                />
                <button
                  onClick={() => handleCopy(appLink, 'link')}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied === 'link' ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                O link abre o editor vazio: o conteúdo vai junto no arquivo .json.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
