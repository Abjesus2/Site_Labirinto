import React, { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import {
  Table,
  Clock,
  Timer,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  X,
  Search,
  Focus,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PackageCheck,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Sparkles,
  Printer
} from 'lucide-react';
import { NodeTiming } from '../types';
import { calculateCumulativeTimes, exportTableToCSV, formatDuration, getStepTotalTime, TimeSettings } from '../utils/timingUtils';

interface FlowDataTableProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  timeSettings: TimeSettings;
  onUpdateNodeLabel: (id: string, label: string) => void;
  onUpdateNodeTiming: (id: string, timing: NodeTiming) => void;
  onAddStep: (type?: string, label?: string) => void;
  onDeleteNode: (id: string) => void;
  onFocusNode: (id: string) => void;
  onOpenTimingModal: (id: string) => void;
  showTimingMode: boolean;
  onToggleTimingMode: () => void;
}

export const FlowDataTable: React.FC<FlowDataTableProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  timeSettings,
  onUpdateNodeLabel,
  onUpdateNodeTiming,
  onAddStep,
  onDeleteNode,
  onFocusNode,
  onOpenTimingModal,
  showTimingMode,
  onToggleTimingMode,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (!isOpen) return null;

  const { orderedNodes, nodeTimings, summary } = calculateCumulativeTimes(nodes, edges, timeSettings);

  const filteredNodes = orderedNodes.filter((n) => {
    const label = String(n.data?.label || '').toLowerCase();
    const timing: NodeTiming = (n.data?.timing as NodeTiming) || {};
    const dept = String(timing.department || '').toLowerCase();
    const matchesSearch = label.includes(searchTerm.toLowerCase()) || dept.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (timing.status || 'pending') === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleTimingFieldChange = (
    nodeId: string,
    field: keyof NodeTiming,
    value: any
  ) => {
    const node = nodes.find(n => n.id === nodeId);
    const prevTiming: NodeTiming = node?.data?.timing || {};
    const updated: NodeTiming = {
      ...prevTiming,
      [field]: value
    };
    onUpdateNodeTiming(nodeId, updated);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 bg-white border-t border-zinc-200 shadow-2xl z-40 transition-all duration-200 flex flex-col ${
        isExpanded ? 'h-[85vh]' : 'h-[360px]'
      }`}
    >
      {/* Header Bar */}
      <div className="px-3 sm:px-5 py-2 sm:py-2.5 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs sm:text-sm text-white">Planilha do Fluxo & Tempos</h3>
              <span className="text-[9px] sm:text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 sm:px-2 py-0.5 rounded-full hidden xs:inline">
                Sincronizado
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 hidden md:block">
              Edite qualquer texto ou tempo diretamente na tabela para atualizar o fluxograma instantaneamente.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Timing Mode Toggle */}
          <button
            onClick={onToggleTimingMode}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showTimingMode
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            title="Ativar/Desativar exibição de tempos acumulados no fluxograma"
          >
            <Clock size={12} />
            <span className="hidden md:inline">Tempos no Canvas:</span>
            <span>{showTimingMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Add Step Button */}
          <button
            onClick={() => onAddStep('process', 'Nova Etapa')}
            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-colors shadow-xs"
          >
            <Plus size={13} />
            <span className="hidden xs:inline">Nova Etapa</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={() => exportTableToCSV(nodes, edges, timeSettings)}
            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-colors shadow-xs"
            title="Exportar Planilha para Excel / CSV"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>

          {/* Print Report */}
          <button
            onClick={handlePrint}
            className="p-1 sm:p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Imprimir Relatório do Processo"
          >
            <Printer size={14} />
          </button>

          {/* Expand / Collapse Height */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 sm:p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title={isExpanded ? 'Recolher Painel' : 'Expandir Painel'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close Panel */}
          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Fechar Planilha"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* KPI & Summary Metrics Bar */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 sm:px-5 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium text-[11px] sm:text-xs">Etapas:</span>
            <span className="font-bold text-zinc-800 bg-white border border-zinc-200 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs">
              {summary.totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium text-[11px] sm:text-xs">Execução (Valor):</span>
            <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs">
              {summary.formattedTotalDuration}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium text-[11px] sm:text-xs">Paradas / Esperas:</span>
            <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs">
              {summary.formattedTotalNonValueAdded}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium text-[11px] sm:text-xs">Lead Time Total:</span>
            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs">
              {summary.formattedGrandTotal}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium text-[11px] sm:text-xs">Eficiência:</span>
            <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs">
              {summary.efficiencyPercentage}%
            </span>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar etapa ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-2.5 py-1 text-xs bg-white border border-zinc-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none w-32 sm:w-44 text-zinc-800"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1 text-xs bg-white border border-zinc-200 rounded-lg outline-none text-zinc-700 font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">⏳ Pendente</option>
            <option value="in_progress">🔄 Em Andamento</option>
            <option value="completed">✅ Concluído</option>
            <option value="blocked">🚫 Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
          <thead className="bg-zinc-100/90 sticky top-0 z-10 border-b border-zinc-200 text-zinc-700 select-none">
            <tr>
              <th className="py-2.5 px-3 font-bold w-12 text-center">#</th>
              <th className="py-2.5 px-3 font-bold w-28">Tipo</th>
              <th className="py-2.5 px-3 font-bold min-w-[220px]">Etapa / Descrição do Processo</th>
              <th className="py-2.5 px-2 font-bold w-24 text-center bg-blue-50/50">Duração (m)</th>
              <th className="py-2.5 px-2 font-bold w-24 text-center">Setup (m)</th>
              <th className="py-2.5 px-2 font-bold w-24 text-center">Espera (m)</th>
              <th className="py-2.5 px-2 font-bold w-24 text-center">Pausas (m)</th>
              <th className="py-2.5 px-2 font-bold w-24 text-center">Extras (m)</th>
              <th className="py-2.5 px-3 font-bold w-28 text-center bg-amber-50/70">Tempo Etapa</th>
              <th className="py-2.5 px-3 font-bold w-32 text-center bg-blue-100/70">Tempo Acumulado</th>
              <th className="py-2.5 px-3 font-bold w-36">Responsável</th>
              <th className="py-2.5 px-3 font-bold w-32">Status</th>
              <th className="py-2.5 px-3 font-bold w-24 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredNodes.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-zinc-400 text-xs">
                  Nenhuma etapa encontrada. Clique em "+ Adicionar Etapa" ou crie formas no fluxograma.
                </td>
              </tr>
            ) : (
              filteredNodes.map((n, idx) => {
                const calc = nodeTimings[n.id] || {
                  stepDuration: 0,
                  setupTime: 0,
                  waitTime: 0,
                  pauseTime: 0,
                  extraTime: 0,
                  stepTotal: 0,
                  cumulativeTotal: 0,
                  formattedStep: '0 min',
                  formattedCumulative: '0 min',
                  isEnd: n.type === 'end',
                  isStart: n.type === 'start',
                  order: idx + 1,
                };
                const timing: NodeTiming = n.data?.timing || {};

                return (
                  <tr
                    key={n.id}
                    className="hover:bg-blue-50/40 transition-colors group/row"
                  >
                    {/* Order Number */}
                    <td className="py-2 px-3 text-center font-bold text-zinc-500">
                      {calc.order}
                    </td>

                    {/* Shape Type Badge */}
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                        n.type === 'start' ? 'bg-green-100 text-green-800' :
                        n.type === 'end' ? 'bg-red-100 text-red-800' :
                        n.type === 'decision' ? 'bg-yellow-100 text-yellow-800' :
                        n.type === 'database' ? 'bg-purple-100 text-purple-800' :
                        n.type === 'document' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {n.type || 'processo'}
                      </span>
                    </td>

                    {/* Step Description Input (Direct Edit) */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={n.data?.label || ''}
                        onChange={(e) => onUpdateNodeLabel(n.id, e.target.value)}
                        placeholder="Nome da etapa..."
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-zinc-300 focus:border-blue-500 rounded font-medium text-zinc-900 outline-none transition-colors"
                      />
                    </td>

                    {/* Main Duration */}
                    <td className="py-2 px-2 text-center bg-blue-50/30">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={timing.duration ?? (n.type === 'start' || n.type === 'end' ? 0 : 10)}
                        onChange={(e) => handleTimingFieldChange(n.id, 'duration', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)))}
                        className="w-16 px-1.5 py-1 text-center font-semibold bg-white border border-zinc-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </td>

                    {/* Setup / Insumos */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={timing.setupTime ?? 0}
                        onChange={(e) => handleTimingFieldChange(n.id, 'setupTime', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)))}
                        className="w-16 px-1.5 py-1 text-center text-zinc-700 bg-white border border-zinc-200 rounded focus:border-blue-500 outline-none"
                      />
                    </td>

                    {/* Wait / Paradas */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={timing.waitTime ?? 0}
                        onChange={(e) => handleTimingFieldChange(n.id, 'waitTime', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)))}
                        className="w-16 px-1.5 py-1 text-center text-zinc-700 bg-white border border-zinc-200 rounded focus:border-blue-500 outline-none"
                      />
                    </td>

                    {/* Pauses */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={timing.pauseTime ?? 0}
                        onChange={(e) => handleTimingFieldChange(n.id, 'pauseTime', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)))}
                        className="w-16 px-1.5 py-1 text-center text-zinc-700 bg-white border border-zinc-200 rounded focus:border-blue-500 outline-none"
                      />
                    </td>

                    {/* Extras */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={timing.otherExtraTime ?? 0}
                        onChange={(e) => handleTimingFieldChange(n.id, 'otherExtraTime', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)))}
                        className="w-16 px-1.5 py-1 text-center text-zinc-700 bg-white border border-zinc-200 rounded focus:border-blue-500 outline-none"
                      />
                    </td>

                    {/* Step Total (Calculated) */}
                    <td className="py-2 px-3 text-center bg-amber-50/50">
                      <button
                        onClick={() => onOpenTimingModal(n.id)}
                        className="px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] transition-colors"
                        title="Clique para abrir detalhes completos de tempo desta etapa"
                      >
                        {calc.formattedStep}
                      </button>
                    </td>

                    {/* Cumulative Lead Time (Calculated) */}
                    <td className="py-2 px-3 text-center bg-blue-100/50">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                        calc.isEnd
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-blue-600 text-white shadow-xs'
                      }`}>
                        {calc.formattedCumulative}
                      </span>
                    </td>

                    {/* Department / Setor */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={timing.department || ''}
                        onChange={(e) => handleTimingFieldChange(n.id, 'department', e.target.value)}
                        placeholder="Setor..."
                        className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-zinc-300 focus:border-blue-500 rounded text-zinc-700 outline-none transition-colors"
                      />
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-2 px-3">
                      <select
                        value={timing.status || 'pending'}
                        onChange={(e) => handleTimingFieldChange(n.id, 'status', e.target.value)}
                        className="px-2 py-1 bg-white border border-zinc-200 rounded text-[11px] font-semibold text-zinc-700 outline-none"
                      >
                        <option value="pending">⏳ Pendente</option>
                        <option value="in_progress">🔄 Andamento</option>
                        <option value="completed">✅ Concluído</option>
                        <option value="blocked">🚫 Bloqueado</option>
                      </select>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onFocusNode(n.id)}
                          className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Focar no Fluxograma"
                        >
                          <Focus size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteNode(n.id)}
                          className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir Etapa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
