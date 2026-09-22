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

  if (!data.version || !rawGenerated[data.version]) return progress;

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
      id: data.node.id,
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
    const isDubious = !!data.edge.isDubious;
    rawGenerated[data.version].edges.push({
      id: data.edge.id || `e_${data.edge.source}_${data.edge.target}_${Math.random().toString(36).substring(2, 7)}`,
      source: data.edge.source,
      target: data.edge.target,
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
