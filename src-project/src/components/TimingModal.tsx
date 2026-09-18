import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import {
  Clock,
  Timer,
  AlertCircle,
  PauseCircle,
  PackageCheck,
  Plus,
  Trash2,
  X,
  Check,
  Sparkles,
  Layers,
  Building,
  CheckCircle2
} from 'lucide-react';
import { NodeTiming } from '../types';
import { formatDuration, getStepTotalTime, TimeSettings, defaultTimeSettings } from '../utils/timingUtils';

interface TimingModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: Node | null;
  onSaveTiming: (nodeId: string, timing: NodeTiming) => void;
  timeSettings?: TimeSettings;
}

export const TimingModal: React.FC<TimingModalProps> = ({
  isOpen,
  onClose,
  node,
  onSaveTiming,
  timeSettings = defaultTimeSettings
}) => {
  if (!isOpen || !node) return null;

  const currentTiming: NodeTiming = node.data?.timing || {};

  const [duration, setDuration] = useState<number | ''>(currentTiming.duration ?? 10);
  const [setupTime, setSetupTime] = useState<number | ''>(currentTiming.setupTime ?? 0);
  const [waitTime, setWaitTime] = useState<number | ''>(currentTiming.waitTime ?? 0);
  const [pauseTime, setPauseTime] = useState<number | ''>(currentTiming.pauseTime ?? 0);
  const [otherExtraTime, setOtherExtraTime] = useState<number | ''>(currentTiming.otherExtraTime ?? 0);
  const [department, setDepartment] = useState(currentTiming.department || '');
  const [status, setStatus] = useState(currentTiming.status || 'pending');
  const [notes, setNotes] = useState(currentTiming.notes || '');

  useEffect(() => {
    const t: NodeTiming = node.data?.timing || {};
    setDuration(t.duration ?? (node.type === 'start' || node.type === 'end' ? 0 : 10));
    setSetupTime(t.setupTime ?? 0);
    setWaitTime(t.waitTime ?? 0);
    setPauseTime(t.pauseTime ?? 0);
    setOtherExtraTime(t.otherExtraTime ?? 0);
    setDepartment(t.department || '');
    setStatus(t.status || 'pending');
    setNotes(t.notes || '');
  }, [node]);

  const stepTotal = (Number(duration) || 0) +
    (Number(setupTime) || 0) +
    (Number(waitTime) || 0) +
    (Number(pauseTime) || 0) +
    (Number(otherExtraTime) || 0);

  const handleSave = () => {
    const timingData: NodeTiming = {
      duration: duration === '' ? 0 : Number(duration),
      setupTime: setupTime === '' ? 0 : Number(setupTime),
      waitTime: waitTime === '' ? 0 : Number(waitTime),
      pauseTime: pauseTime === '' ? 0 : Number(pauseTime),
      otherExtraTime: otherExtraTime === '' ? 0 : Number(otherExtraTime),
      unit: 'min',
      department: department.trim(),
      status: status as any,
      notes: notes.trim(),
    };
    onSaveTiming(node.id, timingData);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-zinc-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Timer size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white flex items-center gap-2">
                Tempos do Processo
                <span className="text-[11px] font-normal text-zinc-300 bg-white/10 px-2 py-0.5 rounded-md">
                  {node.data?.label || 'Etapa'}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">Configure os tempos de execução, trocas e paradas desta etapa.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Main Duration Input */}
          <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-200/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock size={14} className="text-blue-600" />
                Tempo de Execução Principal (minutos)
              </label>
              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {formatDuration(Number(duration) || 0, timeSettings)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="0.5"
                value={duration}
                onChange={(e) => setDuration(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-semibold bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex items-center gap-1">
                {[5, 10, 15, 30, 60].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setDuration(quick)}
                    className="px-2 py-1 text-[11px] font-semibold bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors"
                  >
                    {quick}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Extra Times Section */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
              <span>Tempos Extras & Paradas (Opcionais)</span>
              <span className="text-[11px] font-normal text-zinc-400">minutos</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Setup / Insumos */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 mb-1.5">
                  <PackageCheck size={13} className="text-amber-600" />
                  Setup / Troca de Insumos
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={setupTime}
                  onChange={(e) => setSetupTime(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Paradas / Espera */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={13} className="text-red-500" />
                  Espera / Paradas / Fila
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={waitTime}
                  onChange={(e) => setWaitTime(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Pausas / Intervalos */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 mb-1.5">
                  <PauseCircle size={13} className="text-indigo-500" />
                  Pausas / Intervalos
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={pauseTime}
                  onChange={(e) => setPauseTime(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Outros Tempos */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 mb-1.5">
                  <Plus size={13} className="text-teal-600" />
                  Outros Tempos Extras
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={otherExtraTime}
                  onChange={(e) => setOtherExtraTime(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Department & Status */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 mb-1">
                <Building size={13} className="text-zinc-500" />
                Responsável / Departamento
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex: Operações, Financeiro, Logística"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={13} className="text-zinc-500" />
                Status da Etapa
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="pending">⏳ Pendente</option>
                <option value="in_progress">🔄 Em Andamento</option>
                <option value="completed">✅ Concluído</option>
                <option value="blocked">🚫 Bloqueado</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1">
              Observações / Instruções do Processo
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções adicionais ou critérios para esta etapa..."
              rows={2}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Total Calculated for this Step */}
          <div className="bg-zinc-900 text-white rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-400 font-medium">Tempo Total desta Etapa (Lead Time do Passo)</div>
              <div className="text-xs text-zinc-300">
                Principal: {Number(duration) || 0}m + Extras: {(Number(setupTime) || 0) + (Number(waitTime) || 0) + (Number(pauseTime) || 0) + (Number(otherExtraTime) || 0)}m
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-amber-400">
                {formatDuration(stepTotal, timeSettings)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Check size={14} />
            Salvar Tempos
          </button>
        </div>
      </div>
    </div>
  );
};
