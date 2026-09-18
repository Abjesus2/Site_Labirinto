import { Node, Edge } from '@xyflow/react';
import { NodeTiming } from '../types';

export type TimeFormatStyle = 'hhmmss' | 'decimal';
export type TimePrecision = 0 | 1 | 2 | 3;

export interface TimeSettings {
  style: TimeFormatStyle;
  precision: TimePrecision;
}

export const defaultTimeSettings: TimeSettings = {
  style: 'hhmmss',
  precision: 1
};

export interface CalculatedNodeTiming {
  stepDuration: number;
  setupTime: number;
  waitTime: number;
  pauseTime: number;
  extraTime: number;
  stepTotal: number;
  cumulativeTotal: number;
  formattedStep: string;
  formattedCumulative: string;
  isEnd: boolean;
  isStart: boolean;
  order: number;
}

export interface TimingSummary {
  totalSteps: number;
  totalDuration: number;
  totalSetup: number;
  totalWait: number;
  totalPause: number;
  totalExtra: number;
  grandTotalLeadTime: number;
  efficiencyPercentage: number;
  formattedGrandTotal: string;
  formattedTotalDuration: string;
  formattedTotalNonValueAdded: string;
}

export function formatDuration(minutes: number, settings: TimeSettings = defaultTimeSettings): string {
  if (minutes === undefined || minutes === null || isNaN(minutes)) {
    return settings.style === 'decimal' ? '0' : '0 min';
  }

  const seconds = minutes * 60;

  if (settings.style === 'decimal') {
    return seconds.toFixed(settings.precision) + ' s';
  }

  // HH:MM:SS format
  if (settings.precision === 0) {
    const totalSecs = Math.round(seconds);
    if (totalSecs < 60) return `${totalSecs} s`;
    const min = Math.floor(totalSecs / 60);
    const sec = totalSecs % 60;
    if (min < 60) return `${min}m ${sec}s`;
    const hr = Math.floor(min / 60);
    const remainMin = min % 60;
    return `${hr}h ${remainMin}m ${sec}s`;
  } else {
    const mult = Math.pow(10, settings.precision);
    const totalSecs = Math.round(seconds * mult) / mult;
    if (totalSecs < 60) return `${totalSecs.toFixed(settings.precision)} s`;
    const wholeSecs = Math.floor(totalSecs);
    const frac = totalSecs - wholeSecs;
    const min = Math.floor(wholeSecs / 60);
    const sec = wholeSecs % 60;
    const secStr = (sec + frac).toFixed(settings.precision);
    
    if (min < 60) return `${min}m ${secStr}s`;
    const hr = Math.floor(min / 60);
    const remainMin = min % 60;
    return `${hr}h ${remainMin}m ${secStr}s`;
  }
}

export function getStepTotalTime(timing?: NodeTiming): number {
  if (!timing) return 0;
  const d = Number(timing.duration) || 0;
  const s = Number(timing.setupTime) || 0;
  const w = Number(timing.waitTime) || 0;
  const p = Number(timing.pauseTime) || 0;
  const o = Number(timing.otherExtraTime) || 0;
  return d + s + w + p + o;
}

/**
 * Traverses the flowchart graph to calculate cumulative lead time for each step.
 * Uses topological/breadth-first traversal from Start/Roots to End.
 */
export function calculateCumulativeTimes(
  nodes: Node[],
  edges: Edge[],
  settings: TimeSettings = defaultTimeSettings
): {
  nodeTimings: Record<string, CalculatedNodeTiming>;
  summary: TimingSummary;
  orderedNodes: Node[];
} {
  const nodeTimings: Record<string, CalculatedNodeTiming> = {};
  
  if (!nodes || nodes.length === 0) {
    return {
      nodeTimings,
      summary: {
        totalSteps: 0,
        totalDuration: 0,
        totalSetup: 0,
        totalWait: 0,
        totalPause: 0,
        totalExtra: 0,
        grandTotalLeadTime: 0,
        efficiencyPercentage: 100,
        formattedGrandTotal: '0 min',
        formattedTotalDuration: '0 min',
        formattedTotalNonValueAdded: '0 min',
      },
      orderedNodes: [],
    };
  }

  // Filter out non-process structural containers like frames/swimlanes if needed
  const flowNodes = nodes.filter(n => n.type !== 'swimlane' && n.type !== 'frame');

  // Adjacency map and in-degree map
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  
  flowNodes.forEach(n => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach(e => {
    if (adj[e.source] && inDegree[e.target] !== undefined) {
      adj[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    }
  });

  // Find root nodes (inDegree === 0 or type === 'start')
  const queue: string[] = [];
  const visited = new Set<string>();

  // Prioritize start nodes first
  flowNodes
    .filter(n => n.type === 'start' || inDegree[n.id] === 0)
    .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
    .forEach(n => {
      queue.push(n.id);
      visited.add(n.id);
    });

  // If no start node or 0 in-degree (e.g. disconnected or loop), add first node
  if (queue.length === 0 && flowNodes.length > 0) {
    queue.push(flowNodes[0].id);
    visited.add(flowNodes[0].id);
  }

  const orderedNodeIds: string[] = [];
  const cumulativeMap: Record<string, number> = {};

  // Topological / BFS order
  while (queue.length > 0) {
    const currId = queue.shift()!;
    orderedNodeIds.push(currId);

    const currNode = flowNodes.find(n => n.id === currId);
    const timing: NodeTiming = currNode?.data?.timing || {};
    const stepTime = getStepTotalTime(timing);
    const prevCumulative = cumulativeMap[currId] || 0;
    const currentTotalCumulative = prevCumulative + stepTime;

    const neighbors = adj[currId] || [];
    neighbors.forEach(nextId => {
      // For branching / merging paths, accumulate along path
      const currentNext = cumulativeMap[nextId] || 0;
      if (currentTotalCumulative > currentNext) {
        cumulativeMap[nextId] = currentTotalCumulative;
      }

      inDegree[nextId]--;
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push(nextId);
      }
    });
  }

  // Include any remaining unconnected flow nodes
  flowNodes.forEach(n => {
    if (!visited.has(n.id)) {
      orderedNodeIds.push(n.id);
    }
  });

  // Build the calculated timings dictionary
  let grandTotalLeadTime = 0;
  let totalDuration = 0;
  let totalSetup = 0;
  let totalWait = 0;
  let totalPause = 0;
  let totalExtra = 0;

  orderedNodeIds.forEach((id, index) => {
    const node = flowNodes.find(n => n.id === id);
    if (!node) return;

    const timing: NodeTiming = node.data?.timing || {};
    const dur = Number(timing.duration) || 0;
    const setup = Number(timing.setupTime) || 0;
    const wait = Number(timing.waitTime) || 0;
    const pause = Number(timing.pauseTime) || 0;
    const extra = Number(timing.otherExtraTime) || 0;
    const stepTotal = dur + setup + wait + pause + extra;

    totalDuration += dur;
    totalSetup += setup;
    totalWait += wait;
    totalPause += pause;
    totalExtra += extra;

    // Use graph cumulative purely based on connections
    const cumulative = (cumulativeMap[id] || 0) + stepTotal;

    if (cumulative > grandTotalLeadTime) {
      grandTotalLeadTime = cumulative;
    }

    const isEnd = node.type === 'end';
    const isStart = node.type === 'start';

    nodeTimings[id] = {
      stepDuration: dur,
      setupTime: setup,
      waitTime: wait,
      pauseTime: pause,
      extraTime: extra,
      stepTotal,
      cumulativeTotal: cumulative,
      formattedStep: formatDuration(stepTotal, settings),
      formattedCumulative: formatDuration(cumulative, settings),
      isEnd,
      isStart,
      order: index + 1,
    };
  });

  const totalNonValue = totalSetup + totalWait + totalPause + totalExtra;
  const efficiency = grandTotalLeadTime > 0 ? Math.round((totalDuration / grandTotalLeadTime) * 100) : 100;

  const orderedNodes = orderedNodeIds
    .map(id => flowNodes.find(n => n.id === id)!)
    .filter(Boolean);

  return {
    nodeTimings,
    summary: {
      totalSteps: flowNodes.length,
      totalDuration,
      totalSetup,
      totalWait,
      totalPause,
      totalExtra,
      grandTotalLeadTime,
      efficiencyPercentage: efficiency,
      formattedGrandTotal: formatDuration(grandTotalLeadTime, settings),
      formattedTotalDuration: formatDuration(totalDuration, settings),
      formattedTotalNonValueAdded: formatDuration(totalNonValue, settings),
    },
    orderedNodes,
  };
}

/**
 * Export table data to CSV format
 */
export function exportTableToCSV(
  nodes: Node[], 
  edges: Edge[], 
  settings: TimeSettings = defaultTimeSettings,
  filename = 'fluxograma-tabela-processo.csv'
) {
  const { orderedNodes, nodeTimings } = calculateCumulativeTimes(nodes, edges, settings);

  const headers = [
    'Ordem',
    'Tipo',
    'Etapa / Descricao',
    'Duracao Principal (min)',
    'Setup / Troca Insumos (min)',
    'Espera / Paradas (min)',
    'Pausas (min)',
    'Outros Extras (min)',
    'Tempo Total da Etapa (min)',
    'Tempo Acumulado (min)',
    'Responsavel / Setor',
    'Status',
    'Notas / Observacoes'
  ];

  const rows = orderedNodes.map((n, idx) => {
    const calc = nodeTimings[n.id] || {
      stepDuration: 0,
      setupTime: 0,
      waitTime: 0,
      pauseTime: 0,
      extraTime: 0,
      stepTotal: 0,
      cumulativeTotal: 0
    };
    const timing: NodeTiming = n.data?.timing || {};
    const label = (n.data?.label || '').toString().replace(/"/g, '""');
    const dept = (timing.department || '').replace(/"/g, '""');
    const notes = (timing.notes || '').replace(/"/g, '""');
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      blocked: 'Bloqueado'
    };

    return [
      idx + 1,
      `"${n.type || 'process'}"`,
      `"${label}"`,
      calc.stepDuration || 0,
      calc.setupTime || 0,
      calc.waitTime || 0,
      calc.pauseTime || 0,
      calc.extraTime || 0,
      calc.stepTotal || 0,
      calc.cumulativeTotal || 0,
      `"${dept}"`,
      `"${statusMap[timing.status || 'pending'] || 'Pendente'}"`,
      `"${notes}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
