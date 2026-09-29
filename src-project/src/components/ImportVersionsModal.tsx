import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Square, SquareCheck, SquareMinus, Upload, X } from 'lucide-react';
import { ImportFile, ImportMode, ImportSource } from '../lib/importVersions';

interface ImportVersionsModalProps {
  file: ImportFile | null;
  /** Quantas etapas cada versão deste diagrama já tem. */
  existingCounts: Record<string, number>;
  onClose: () => void;
  onConfirm: (choices: { source: ImportSource; mode: ImportMode }[]) => void;
}

const versionLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * Importar fluxograma: 1) escolher as versões do arquivo (uma, várias ou
 * todas); 2) para cada versão deste diagrama que já tem conteúdo, escolher
 * substituir ou acrescentar.
 */
export const ImportVersionsModal: React.FC<ImportVersionsModalProps> = ({ file, existingCounts, onClose, onConfirm }) => {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'versoes' | 'conflitos'>('versoes');
  const [modes, setModes] = useState<Record<string, ImportMode | undefined>>({});

  useEffect(() => {
    if (!file) return;
    // Começa com todas marcadas (o caso mais comum é trazer o arquivo inteiro).
    setChosen(new Set(file.sources.map((s) => s.name)));
    setStep('versoes');
    setModes({});
  }, [file]);

  const sources = file?.sources || [];
  const selected = useMemo(() => sources.filter((s) => chosen.has(s.name)), [sources, chosen]);
  const conflicts = selected.filter((s) => (existingCounts[s.target] || 0) > 0);
  const allChosen = sources.length > 0 && chosen.size === sources.length;

  if (!file) return null;

  const toggle = (name: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const finish = () => {
    onConfirm(selected.map((source) => ({ source, mode: modes[source.name] || 'acrescentar' })));
  };

  const next = () => {
    if (!selected.length) return;
    if (conflicts.length) setStep('conflitos');
    else finish();
  };

  const setAll = (mode: ImportMode) => setModes(Object.fromEntries(conflicts.map((c) => [c.name, mode])));
  const allAnswered = conflicts.every((c) => modes[c.name]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden border border-zinc-200"
        data-import-versions-dialog
      >
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-zinc-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Upload size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-zinc-900 truncate">Importar {file.title ? `"${file.title}"` : 'fluxograma'}</h3>
            <p className="text-xs text-zinc-500">
              {step === 'versoes'
                ? 'Escolha quais versões trazer. Cada uma vai para a versão de mesmo nome deste diagrama.'
                : 'Estas versões já têm conteúdo aqui. O que fazer com cada uma?'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-4 overflow-y-auto custom-scrollbar flex-1">
          {step === 'versoes' ? (
            <div className="space-y-2">
              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={() => setChosen(allChosen ? new Set() : new Set(sources.map((s) => s.name)))}
                  className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                  data-import-all
                >
                  {allChosen ? <SquareCheck size={18} className="text-blue-600" /> : chosen.size ? <SquareMinus size={18} className="text-blue-600" /> : <Square size={18} className="text-zinc-400" />}
                  Todas as versões ({sources.length})
                </button>
              )}
              {sources.map((s) => {
                const on = chosen.has(s.name);
                const already = existingCounts[s.target] || 0;
                return (
                  <button
                    key={s.name}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(s.name)}
                    className={`w-full px-3 py-3 rounded-2xl border flex items-start gap-2.5 text-left transition-colors ${on ? 'border-blue-300 bg-blue-50/60' : 'border-zinc-200 hover:bg-zinc-50'}`}
                    data-import-version={s.name}
                  >
                    {on ? <SquareCheck size={18} className="text-blue-600 shrink-0 mt-0.5" /> : <Square size={18} className="text-zinc-400 shrink-0 mt-0.5" />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-zinc-800 truncate">{versionLabel(s.name)}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {s.nodes.length} etapas · {s.edges.length} ligações
                        {s.target !== s.name && <> · vai para a versão <strong>{versionLabel(s.target)}</strong></>}
                      </span>
                    </span>
                    {already > 0 && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                        já tem {already}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span>Para todas:</span>
                  <button type="button" onClick={() => setAll('substituir')} className="px-2.5 py-1 rounded-lg border border-zinc-200 font-semibold text-zinc-700 hover:bg-zinc-50">Substituir</button>
                  <button type="button" onClick={() => setAll('acrescentar')} className="px-2.5 py-1 rounded-lg border border-zinc-200 font-semibold text-zinc-700 hover:bg-zinc-50">Acrescentar</button>
                </div>
              )}
              {conflicts.map((c) => (
                <div key={c.name} className="rounded-2xl border border-zinc-200 p-3" data-import-conflict={c.name}>
                  <div className="text-sm font-bold text-zinc-800">{versionLabel(c.target)}</div>
                  <div className="text-[11px] text-zinc-500 mb-2">
                    Já tem {existingCounts[c.target]} etapas. O arquivo traz {c.nodes.length}.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['substituir', 'acrescentar'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModes((prev) => ({ ...prev, [c.name]: m }))}
                        className={`px-2 py-2 rounded-xl border text-xs font-bold transition-colors ${
                          modes[c.name] === m
                            ? m === 'substituir' ? 'bg-red-600 border-red-600 text-white' : 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                        }`}
                        data-import-mode={m}
                      >
                        {m === 'substituir' ? 'Substituir o existente' : 'Acrescentar ao lado'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-zinc-100 flex items-center gap-3">
          {step === 'conflitos' && (
            <button onClick={() => setStep('versoes')} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 flex items-center gap-1">
              <ArrowLeft size={13} /> Voltar
            </button>
          )}
          <div className="ml-auto flex gap-3">
            <button onClick={onClose} className="px-4 py-2 font-semibold text-sm text-zinc-600 hover:bg-zinc-100 rounded-xl">
              Cancelar
            </button>
            <button
              onClick={step === 'versoes' ? next : finish}
              disabled={step === 'versoes' ? !selected.length : !allAnswered}
              className="px-4 py-2 font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
              data-import-confirm
            >
              {step === 'versoes' && conflicts.length ? 'Continuar' : `Importar${selected.length > 1 ? ` (${selected.length})` : ''}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
