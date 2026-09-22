/**
 * Leitura do JSONL que a IA gera para montar um fluxograma — usado tanto
 * pelo streaming normal (linha a linha, à medida que os bytes chegam) quanto
 * pelo modo "Gerar Manualmente" (o usuário cola de uma vez o texto que uma
 * IA de chat qualquer respondeu). Fica num módulo puro, sem depender de
 * React nem do editor, para os dois caminhos usarem exatamente a mesma
 * lógica de conversão — e para dar para testar sem montar a tela inteira.
 */
import { validateGeneratedNodeType } from '../config/shapeRegistry';

export type ShapeFallbackMap = (requestedType: string, allowed: string[]) => string;

export interface RawGeneratedBucket {
  nodes: any[];
  edges: any[];
}

/**
 * Processa uma linha do JSONL. Tolerante a linha vazia, prosa e cercas de
 * bloco de código (```json, ```) — qualquer coisa que não seja um JSON
 * válido simplesmente não vira nada, sem lançar erro. Isso já protegia o
 * streaming de fragmentos cortados na fronteira de um chunk de rede, e é
 * exatamente o que faz o texto colado de outro chat de IA (que quase sempre
 * embrulha a resposta em ``` e pode acrescentar frases antes/depois) também
 * funcionar sem nenhum tratamento especial.
 */
export function applyGeneratedJsonlLine(
  line: string,
  rawGenerated: Record<string, RawGeneratedBucket>,
  allowedShapeTypes: string[],
  shapeFallbackMap: ShapeFallbackMap,
): number | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let data: any;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }

  let progress: number | null = null;
  if (typeof data.progress === 'number') progress = data.progress;

  // IA mais fraca às vezes escreve "Detalhado", "detailed", "Normal " etc.
  // Antes a linha inteira era descartada em silêncio — e se isso acontecia
  // só nas arestas, o diagrama ficava sem nenhuma ligação.
  const versionKey = resolveVersionKey(data.version, rawGenerated);
  if (!versionKey) return progress;
  data.version = versionKey;

  if (data.node) {
    const requestedType = data.node.type;
    let safeType = validateGeneratedNodeType(requestedType);
    if (!safeType) {
      safeType = shapeFallbackMap(requestedType, allowedShapeTypes);
    }
    const nodeDuration =
      data.node.duration !== undefined
        ? Number(data.node.duration)
        : safeType === 'start' || safeType === 'end'
          ? 0
          : 10;

    rawGenerated[data.version].nodes.push({
      id: String(data.node.id ?? '').trim(),
      type: safeType,
      position: { x: 0, y: 0 },
      data: {
        label: data.node.label,
        timing: {
          duration: nodeDuration,
          setupTime: Number(data.node.setupTime) || 0,
          waitTime: Number(data.node.waitTime) || 0,
          pauseTime: Number(data.node.pauseTime) || 0,
          otherExtraTime: Number(data.node.otherExtraTime) || 0,
          department: data.node.department || '',
          status: 'pending',
          notes: data.node.notes || '',
        },
        styleOverride:
          safeType === 'start' ? { backgroundColor: '#dcfce7', borderColor: '#22c55e' } :
          safeType === 'end' ? { backgroundColor: '#fee2e2', borderColor: '#ef4444' } :
          safeType === 'decision' ? { backgroundColor: '#fef9c3', borderColor: '#eab308' } :
          safeType === 'document' ? { backgroundColor: '#fdf4ff', borderColor: '#c084fc' } :
          safeType === 'database' ? { backgroundColor: '#ecfdf5', borderColor: '#10b981' } :
          safeType === 'inputoutput' ? { backgroundColor: '#f0fdfa', borderColor: '#14b8a6' } :
          { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
      },
    });
  }

  if (data.edge) {
    const isDubious = data.edge.isDubious === true || data.edge.isDubious === 'true';
    // Aceita os nomes alternativos que modelos costumam trocar sozinhos.
    const source = String(data.edge.source ?? data.edge.from ?? data.edge.sourceId ?? data.edge.origem ?? '').trim();
    const target = String(data.edge.target ?? data.edge.to ?? data.edge.targetId ?? data.edge.destino ?? '').trim();
    if (!source || !target) return progress;
    rawGenerated[data.version].edges.push({
      id: data.edge.id || `e_${source}_${target}_${Math.random().toString(36).substring(2, 7)}`,
      source,
      target,
      label: data.edge.label || (isDubious ? 'Analise Conexão' : ''),
      type: 'smoothstep',
      // Valor cru do enum MarkerType.ArrowClosed do @xyflow/react — evita
      // importar a lib inteira só por causa desse enum neste módulo puro.
      markerEnd: { type: 'arrowclosed', color: isDubious ? '#ef4444' : '#0f172a' },
      style: { stroke: isDubious ? '#ef4444' : '#0f172a', strokeWidth: isDubious ? 3 : 2 },
      data: { isDubious },
    });
  }

  return progress;
}

const VERSION_ALIASES: Record<string, string> = {
  simple: 'simples',
  simplificado: 'simples',
  macro: 'simples',
  standard: 'normal',
  padrao: 'normal',
  'padrão': 'normal',
  medio: 'normal',
  'médio': 'normal',
  detailed: 'detalhado',
  detalhada: 'detalhado',
  completo: 'detalhado',
};

function resolveVersionKey(version: unknown, rawGenerated: Record<string, RawGeneratedBucket>): string | null {
  if (typeof version !== 'string' || !version.trim()) return null;
  if (rawGenerated[version]) return version;
  const norm = version.trim().toLowerCase();
  const byCase = Object.keys(rawGenerated).find((k) => k.toLowerCase() === norm);
  if (byCase) return byCase;
  const alias = VERSION_ALIASES[norm];
  return alias && rawGenerated[alias] ? alias : null;
}

const DUBIOUS_LABEL = 'Analise Conexão';

function makeGeneratedEdge(source: string, target: string, label: string, isDubious: boolean): any {
  return {
    id: `e_fix_${source}_${target}_${Math.random().toString(36).substring(2, 7)}`,
    source,
    target,
    label,
    type: 'smoothstep',
    markerEnd: { type: 'arrowclosed', color: isDubious ? '#ef4444' : '#0f172a' },
    style: { stroke: isDubious ? '#ef4444' : '#0f172a', strokeWidth: isDubious ? 3 : 2 },
    data: { isDubious },
  };
}

export interface RepairReport {
  /** A IA mandou etapas mas nenhuma ligação válida (resposta cortada, quase sempre). */
  missingEdges: boolean;
  /** Ligações que vieram marcadas como duvidosas em massa e foram desmarcadas. */
  clearedDubious: number;
  /** Ligações descartadas por apontarem para etapas que não existem. */
  droppedEdges: number;
}

/**
 * Limpa o que a IA mandou ANTES de o app completar a conectividade:
 * - casa IDs que só diferem em maiúsculas/espaços e descarta ligação para
 *   etapa inexistente (senão o React Flow a ignora e o nó vira "órfão");
 * - remove ligação repetida (mesma origem e destino);
 * - se a IA marcou "isDubious" em quase todas as ligações, é cópia mecânica
 *   do exemplo do prompt, não dúvida real — nesse caso as marcações são
 *   removidas (antes, um fluxo bem descrito aparecia inteiro em vermelho).
 */
export function repairGeneratedVersion(bucket: RawGeneratedBucket): RawGeneratedBucket & { report: RepairReport } {
  const nodes = (bucket.nodes || []).filter((n) => n && n.id);
  const idByLower = new Map<string, string>();
  nodes.forEach((n) => idByLower.set(String(n.id).trim().toLowerCase(), n.id));
  const resolveId = (id: string) => idByLower.get(String(id).trim().toLowerCase());

  const seen = new Set<string>();
  const edges: any[] = [];
  let droppedEdges = 0;
  for (const e of bucket.edges || []) {
    const source = resolveId(e.source);
    const target = resolveId(e.target);
    if (!source || !target || source === target) {
      droppedEdges++;
      continue;
    }
    const key = `${source}->${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ ...e, source, target });
  }

  let clearedDubious = 0;
  const dubious = edges.filter((e) => e.data?.isDubious);
  if (edges.length >= 4 && dubious.length / edges.length > 0.4) {
    dubious.forEach((e) => {
      e.data = { ...(e.data || {}), isDubious: false };
      e.style = { ...(e.style || {}), stroke: '#0f172a', strokeWidth: 2 };
      e.markerEnd = { ...(e.markerEnd || { type: 'arrowclosed' }), color: '#0f172a' };
      if (e.label === DUBIOUS_LABEL) e.label = '';
      clearedDubious++;
    });
  }

  return {
    nodes,
    edges,
    report: { missingEdges: nodes.length > 1 && edges.length === 0, clearedDubious, droppedEdges },
  };
}

/**
 * Losango de pergunta com uma saída só não é decisão. Depois que o app já
 * completou a conectividade, cada 'decision' que ficou com uma única saída:
 * - ganha o rótulo "Sim" nessa saída (se estava sem rótulo);
 * - ganha uma segunda saída "Não", voltando para a etapa anterior (o
 *   retrabalho mais comum), marcada em vermelho para o usuário validar.
 */
export function fixDecisionExits(nodes: any[], edges: any[]): any[] {
  const result = [...edges];
  nodes
    .filter((n) => n.type === 'decision')
    .forEach((dec) => {
      const outs = result.filter((e) => e.source === dec.id);
      if (outs.length !== 1) return;
      const only = outs[0];
      if (!only.label || only.label === DUBIOUS_LABEL) {
        const idx = result.indexOf(only);
        result[idx] = { ...only, label: 'Sim' };
      }
      const incoming = result.find((e) => e.target === dec.id && e.source !== dec.id && e.source !== only.target);
      const fallbackEnd = nodes.find((n) => n.type === 'end' && n.id !== only.target);
      const noTarget = incoming?.source || fallbackEnd?.id;
      if (!noTarget) return;
      result.push(makeGeneratedEdge(dec.id, noTarget, 'Não', true));
    });
  return result;
}

/** Processa um bloco de texto inteiro de uma vez (colado, não em streaming). */
export function parseGeneratedBlock(
  text: string,
  complexities: string[],
  allowedShapeTypes: string[],
  shapeFallbackMap: ShapeFallbackMap,
): { rawGenerated: Record<string, RawGeneratedBucket>; nodeCount: number; edgeCount: number } {
  const rawGenerated: Record<string, RawGeneratedBucket> = {};
  complexities.forEach((c) => {
    rawGenerated[c] = { nodes: [], edges: [] };
  });

  const lines = (text || '').split('\n');
  for (const line of lines) {
    applyGeneratedJsonlLine(line, rawGenerated, allowedShapeTypes, shapeFallbackMap);
  }

  let nodeCount = 0;
  let edgeCount = 0;
  Object.values(rawGenerated).forEach((bucket) => {
    nodeCount += bucket.nodes.length;
    edgeCount += bucket.edges.length;
  });

  return { rawGenerated, nodeCount, edgeCount };
}
