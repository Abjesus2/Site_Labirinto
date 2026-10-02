/**
 * FORMATO COMPACTO DA RESPOSTA DA IA
 * ----------------------------------
 * O formato JSONL repete os nomes dos campos em toda linha
 * ({"version": "...", "node": {"id": ..., "label": ..., "type": ...}}), e
 * em fluxos grandes a resposta passava do limite do provedor e chegava
 * cortada (sem as ligações). Na geração pela IA configurada o app pede este
 * formato curto — uma linha por etapa/ligação, campos separados por "|" — e
 * converte de volta para o JSONL de sempre, então o resultado é o mesmo.
 *
 *   V|normal                                   versão das linhas seguintes
 *   N|id|tipo|texto|duração|setor|setup|espera|pausa|outros|observações
 *                                              etapa (do setor em diante, opcionais)
 *   E|origem|destino|rótulo|?                   ligação ("?" no fim = a validar)
 *
 * O "Gerar manualmente" continua com o prompt completo em JSONL, sem limite.
 */

export const compactFormatInstructions = (compList: string): string => `CRITICAL OUTPUT FORMAT (COMPACT ENCODING): output ONLY plain text lines, one item per line, fields separated by "|". No markdown, no JSON, no explanations.
        IMPORTANT: only the ENCODING is compact. The flowchart itself must be COMPLETE and keep FULL detail — the same number of steps, decisions, branches, loops, sectors and times that the rules below require. NEVER reduce, merge or skip steps to make the answer shorter, and never shorten the labels.
        V|<version>                                      -> starts a version (one of: ${compList})
        N|<id>|<type>|<label>|<duration>|<department>|<setupTime>|<waitTime>|<pauseTime>|<otherExtraTime>|<notes>   -> a node (fields after duration may be empty or omitted at the end; notes is the last field)
        E|<source id>|<target id>|<label>|?              -> an edge (label may be empty; put "?" in the last field ONLY when the connection is uncertain — that is the "isDubious": true of the rules below)
        Never use "|" inside a label. Every rule below about nodes and edges still applies; "department" is the 6th field of N.
        ORDER (MANDATORY): right after each N line, write the E lines that LEAVE that node (its outgoing edges) — never leave all edges for the end. A "decision" node is ALWAYS followed by its 2 (or more) labeled E lines ("Sim"/"Não"...), each to a different node.
        The connections are known from the source: write them as normal edges. "?" is RARE — only for a link the source really does not explain.
        When the whole version is finished, write a last line: FIM
        Example:
        V|simples
        N|n1|start|Início do Processo|0|Atendimento
        E|n1|n2|
        N|n2|process|Triagem e Validação|15|Atendimento|2
        E|n2|n3|
        N|n3|decision|Documentação está completa?|0|Atendimento
        E|n3|n4|Sim
        E|n3|n2|Não
        N|n4|end|Fim do Processo|0|Atendimento
        FIM`;

/** Linha de controle que o conversor emite quando a IA escreve "FIM". */
export const COMPLETE_MARKER = '{"complete":true}';

export interface CompactState {
  version: string;
  edgeCount: number;
}

export const newCompactState = (): CompactState => ({ version: '', edgeCount: 0 });

const num = (v: string | undefined) => {
  const n = Number(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Converte UMA linha do formato compacto para a linha JSONL equivalente
 * (ou null, se for linha de versão/vazia/irreconhecível). Linhas que já
 * vierem em JSON (a IA ignorou o pedido) passam direto.
 */
export function compactLineToJsonl(raw: string, state: CompactState): string | null {
  const line = raw.trim().replace(/^[-*]\s+/, '');
  if (!line) return null;
  if (line.startsWith('{')) return line;
  const parts = line.split('|').map((p) => p.trim());
  const kind = parts[0].toUpperCase();
  if (/^(X\|)?(FIM|END)\.?$/i.test(line)) return COMPLETE_MARKER;
  if (kind === 'V' && parts[1]) {
    state.version = parts[1].toLowerCase();
    return null;
  }
  if (kind === 'P' && num(parts[1]) !== undefined) {
    return JSON.stringify({ progress: num(parts[1]) });
  }
  if (!state.version) return null;
  if (kind === 'N' && parts[1]) {
    const node: Record<string, any> = { id: parts[1], type: parts[2] || 'process', label: parts[3] || parts[1] };
    const duration = num(parts[4]);
    if (duration !== undefined) node.duration = duration;
    if (parts[5]) node.department = parts[5];
    const setup = num(parts[6]);
    if (setup) node.setupTime = setup;
    const wait = num(parts[7]);
    if (wait) node.waitTime = wait;
    const pause = num(parts[8]);
    if (pause) node.pauseTime = pause;
    const other = num(parts[9]);
    if (other) node.otherExtraTime = other;
    const notes = parts.slice(10).join(' | ').trim();
    if (notes) node.notes = notes;
    return JSON.stringify({ version: state.version, node });
  }
  if (kind === 'E' && parts[1] && parts[2]) {
    state.edgeCount += 1;
    const edge: Record<string, any> = { id: `ce${state.edgeCount}`, source: parts[1], target: parts[2] };
    if (parts[3] && parts[3] !== '?') edge.label = parts[3];
    if (parts.slice(3).some((p) => p === '?')) edge.isDubious = true;
    return JSON.stringify({ version: state.version, edge });
  }
  return null;
}

/**
 * Última linha sem quebra de linha no fim: numa resposta cortada no limite
 * de tamanho ela pode estar pela METADE (ex.: etapa com o texto cortado).
 * Só vale se for o "FIM"; senão é descartada — a continuação a reescreve
 * inteira (ela não está no que foi recebido).
 */
const lastLineIfSafe = (line: string, state: CompactState): string | null => {
  const out = compactLineToJsonl(line, state);
  return out === COMPLETE_MARKER || (out && out.startsWith('{"progress"')) ? out : null;
};

/** Converte um texto inteiro (várias linhas) do formato compacto para JSONL. */
export function compactTextToJsonl(text: string, state: CompactState = newCompactState()): string {
  const lines = text.split('\n');
  const last = lines.pop() ?? '';
  const out = lines.map((l) => compactLineToJsonl(l, state));
  out.push(lastLineIfSafe(last, state));
  return out.filter((l): l is string => !!l).join('\n');
}

/** Stream de texto compacto -> stream de JSONL (linha a linha). */
export function compactStreamToJsonl(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  const state = newCompactState();
  let buffer = '';
  const reader = input.getReader();
  return new ReadableStream<Uint8Array>({
    // Lê até ter alguma linha pronta para entregar (um pedaço que não fecha
    // nenhuma linha não pode encerrar o "pull" sem entregar nada — o stream
    // ficava parado esperando para sempre).
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          const last = lastLineIfSafe(buffer, state);
          if (last) controller.enqueue(encoder.encode(last + '\n'));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        const out = lines.map((l) => compactLineToJsonl(l, state)).filter(Boolean).join('\n');
        if (out) {
          controller.enqueue(encoder.encode(out + '\n'));
          return;
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/**
 * Versões já geradas, no mesmo formato compacto, para servirem de
 * referência às próximas (mesmo processo, setores e tempo total) sem
 * mandar o JSON inteiro de volta para a IA.
 */
/** Junta uma parte nova (continuação) ao que já foi recebido, sem repetir. */
export function mergeGeneratedPart(
  into: { nodes: any[]; edges: any[] },
  part: { nodes: any[]; edges: any[] },
  partIndex: number,
): { addedNodes: number; addedEdges: number } {
  const nodeIds = new Set(into.nodes.map((n) => String(n.id).toLowerCase()));
  const edgeKeys = new Set(into.edges.map((e) => `${e.source}->${e.target}`.toLowerCase()));
  const edgeIds = new Set(into.edges.map((e) => e.id));
  let addedNodes = 0;
  let addedEdges = 0;
  part.nodes.forEach((n) => {
    const k = String(n.id).toLowerCase();
    if (!k || nodeIds.has(k)) return;
    nodeIds.add(k);
    into.nodes.push(n);
    addedNodes++;
  });
  part.edges.forEach((e) => {
    const k = `${e.source}->${e.target}`.toLowerCase();
    if (edgeKeys.has(k)) return;
    edgeKeys.add(k);
    // Cada parte numera as ligações do zero ("ce1"...): renomeia se repetir.
    const id = edgeIds.has(e.id) ? `${e.id}_p${partIndex}` : e.id;
    edgeIds.add(id);
    into.edges.push({ ...e, id });
    addedEdges++;
  });
  return { addedNodes, addedEdges };
}

export function toCompactReference(versions: Record<string, { nodes: any[]; edges: any[] }>): string {
  return Object.entries(versions)
    .filter(([, v]) => v?.nodes?.length)
    .map(([name, v]) => {
      const nodes = v.nodes
        .filter((n) => n.type !== 'swimlane' && n.type !== 'frame' && n.type !== 'junction')
        .map((n) => {
          const t = n.data?.timing || {};
          return ['N', n.id, n.type, String(n.data?.label ?? '').replace(/\|/g, '/'), t.duration ?? 0, t.department || '', t.setupTime || '', t.waitTime || '', t.pauseTime || '', t.otherExtraTime || '', String(t.notes || '').replace(/[|\n]/g, ' ')]
            .join('|')
            .replace(/\|+$/, '');
        });
      const edges = (v.edges || []).map((e) => ['E', e.source, e.target, String(e.label ?? '').replace(/\|/g, '/')].join('|'));
      return [`V|${name}`, ...nodes, ...edges].join('\n');
    })
    .join('\n');
}
