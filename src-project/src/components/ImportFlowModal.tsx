import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ClipboardPaste, FileJson, FolderOpen, Layers, Upload, X } from 'lucide-react';
import { getLocalDiagrams } from '../lib/storage';
import { buildClip, FlowClip, parseFlowClip } from '../lib/flowClipboard';
import { showToast } from '../lib/embedCompat';

interface SourceDoc {
  title: string;
  versions: Record<string, { nodes: any[]; edges: any[] }>;
}

interface ImportFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiagramId: string;
  onApply: (clip: FlowClip, mode: 'adicionar' | 'substituir') => void;
}

/**
 * "Trazer fluxo de outro arquivo": copia etapas de um diagrama salvo, de um
 * arquivo .json ou de um texto colado, e junta ao fluxo atual (ou o substitui).
 * Complementa o Ctrl+C / Ctrl+V, que serve para recortes de seleção.
 */
export const ImportFlowModal: React.FC<ImportFlowModalProps> = ({
  isOpen,
  onClose,
  currentDiagramId,
  onApply,
}) => {
  const [tab, setTab] = useState<'salvos' | 'arquivo' | 'texto'>('salvos');
  const [source, setSource] = useState<SourceDoc | null>(null);
  const [mode, setMode] = useState<'adicionar' | 'substituir'>('adicionar');
  const [pasted, setPasted] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSource(null);
      setPasted('');
      setMode('adicionar');
      setTab('salvos');
    }
  }, [isOpen]);

  const saved = useMemo(() => {
    if (!isOpen) return [];
    return getLocalDiagrams()
      .filter((d) => d.id !== currentDiagramId)
      .map((d) => {
        const versions =
          d.versions && Object.keys(d.versions).length
            ? d.versions
            : { normal: { nodes: d.nodes || [], edges: d.edges || [] } };
        const total = Object.values(versions).reduce((sum, v: any) => sum + (v?.nodes?.length || 0), 0);
        return { id: d.id, title: d.title || 'Sem título', updatedAt: d.updatedAt, versions, total };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [isOpen, currentDiagramId]);

  if (!isOpen) return null;

  const loadFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    const clip = parseFlowClip(text);
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (parsed?.versions && Object.keys(parsed.versions).length) {
      setSource({ title: parsed.title || file.name, versions: parsed.versions });
      return;
    }
    if (clip) {
      setSource({ title: clip.source?.title || file.name, versions: { 'conteúdo do arquivo': { nodes: clip.nodes, edges: clip.edges } } });
      return;
    }
    showToast({ message: 'Arquivo não reconhecido. Use um .json exportado por este app.', tone: 'error' });
  };

  const loadPasted = () => {
    const clip = parseFlowClip(pasted.trim());
    let parsed: any = null;
    try {
      parsed = JSON.parse(pasted.trim());
    } catch {
      /* ignore */
    }
    if (parsed?.versions && Object.keys(parsed.versions).length) {
      setSource({ title: parsed.title || 'Texto colado', versions: parsed.versions });
      return;
    }
    if (clip) {
      setSource({ title: clip.source?.title || 'Texto colado', versions: { 'conteúdo colado': { nodes: clip.nodes, edges: clip.edges } } });
      return;
    }
    showToast({ message: 'Não encontrei um fluxo válido no texto colado.', tone: 'error' });
  };

  const apply = (versionName: string) => {
    const v = source?.versions?.[versionName];
    if (!v || !Array.isArray(v.nodes) || v.nodes.length === 0) {
      showToast({ message: 'Essa versão está vazia.', tone: 'warn' });
      return;
    }
    onApply(buildClip(v.nodes, v.edges || [], { title: source?.title, version: versionName }), mode);
    onClose();
  };

  const tabBtn = (id: 'salvos' | 'arquivo' | 'texto', label: string, Icon: any) => (
    <button
      onClick={() => { setTab(id); setSource(null); }}
      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
        tab === id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
      }`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-zinc-200"
      >
        <div className="px-6 pt-5 pb-3 border-b border-zinc-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-zinc-900">Trazer fluxo de outro arquivo</h3>
            <p className="text-xs text-zinc-500">
              Copie as etapas de outro fluxograma e junte a este, sem perder o que já está aqui.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 flex gap-2">
          {tabBtn('salvos', 'Diagramas salvos', FolderOpen)}
          {tabBtn('arquivo', 'Arquivo .json', FileJson)}
          {tabBtn('texto', 'Colar texto', ClipboardPaste)}
        </div>

        <div className="px-6 pb-2">
          <div className="flex items-center gap-2 p-1 bg-zinc-100 rounded-xl">
            {(['adicionar', 'substituir'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {m === 'adicionar' ? 'Adicionar ao fluxo atual' : 'Substituir o fluxo atual'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-5 overflow-y-auto flex-1">
          {source ? (
            <div>
              <button
                onClick={() => setSource(null)}
                className="mb-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5"
              >
                <ArrowLeft size={13} /> Voltar
              </button>
              <div className="text-xs font-bold text-zinc-700 mb-2 truncate">
                {source.title} — escolha a versão:
              </div>
              <div className="space-y-2">
                {Object.entries(source.versions).map(([name, v]: any) => (
                  <button
                    key={name}
                    onClick={() => apply(name)}
                    disabled={!v?.nodes?.length}
                    className="w-full px-4 py-3 text-left rounded-2xl border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/60 disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:bg-white transition-all flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-bold text-zinc-800 capitalize truncate">{name}</span>
                    <span className="text-[11px] text-zinc-500 shrink-0">
                      {(v?.nodes?.length || 0)} etapas · {(v?.edges?.length || 0)} ligações
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : tab === 'salvos' ? (
            saved.length ? (
              <div className="space-y-2">
                {saved.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSource({ title: d.title, versions: d.versions as any })}
                    className="w-full px-4 py-3 text-left rounded-2xl border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/60 transition-all flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-bold text-zinc-800 truncate">{d.title}</span>
                    <span className="text-[11px] text-zinc-500 shrink-0">{d.total} etapas</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">
                Nenhum outro fluxograma com conteúdo salvo neste navegador. Use a aba
                <strong> Arquivo .json</strong> para trazer de outro computador.
              </p>
            )
          ) : tab === 'arquivo' ? (
            <label className="block border-2 border-dashed border-zinc-200 rounded-2xl px-4 py-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-all">
              <Upload size={22} className="mx-auto text-zinc-400 mb-2" />
              <span className="text-xs font-semibold text-zinc-700 block">Escolher arquivo .json</span>
              <span className="text-[11px] text-zinc-500">Backup exportado por este app, de qualquer computador.</span>
              <input
                type="file"
                accept=".json,.labirinto,.flowsync"
                className="hidden"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
            </label>
          ) : (
            <div>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Cole aqui o conteúdo copiado com Ctrl+C no outro fluxograma, ou o conteúdo de um arquivo .json."
                className="w-full h-32 px-3 py-2 text-[11px] font-mono border border-zinc-200 rounded-xl outline-none focus:border-blue-400 resize-none"
              />
              <button
                onClick={loadPasted}
                disabled={!pasted.trim()}
                className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all"
              >
                Ler fluxo do texto
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
