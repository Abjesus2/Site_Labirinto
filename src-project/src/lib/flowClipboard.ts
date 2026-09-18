/**
 * ÁREA DE TRANSFERÊNCIA DE FLUXOS
 * -------------------------------
 * Permite copiar etapas (ou uma versão inteira) de um fluxograma e colar em
 * outro. Funciona em três níveis, do mais amplo para o mais garantido:
 *
 *  1. Área de transferência do sistema (texto JSON) — atravessa abas, janelas,
 *     navegadores e até máquinas diferentes, via Ctrl+C / Ctrl+V.
 *  2. localStorage compartilhado — funciona entre diagramas e abas do mesmo
 *     navegador mesmo quando o navegador nega acesso ao clipboard.
 *  3. Memória do processo — último recurso quando o armazenamento está
 *     bloqueado (iframe com cookies de terceiros barrados).
 */

import { copyText } from './embedCompat';

const STORAGE_KEY = 'labirinto_flow_clip_v1';

export const CLIP_TYPE = 'labirinto-flow-clip';

export interface FlowClip {
  app: string;
  type: string;
  version: number;
  copiedAt: string;
  source?: { diagramId?: string; title?: string; version?: string };
  nodes: any[];
  edges: any[];
}

let memoryClip: FlowClip | null = null;

const stripRuntimeFlags = (node: any) => {
  const { selected, dragging, resizing, positionAbsolute, measured, ...rest } = node || {};
  return rest;
};

/** Seleção atual: nós marcados e as ligações cujas duas pontas estão na seleção. */
export const collectSelection = (
  nodes: any[],
  edges: any[],
): { nodes: any[]; edges: any[] } => {
  const selected = (nodes || []).filter((n) => n?.selected);
  const ids = new Set(selected.map((n) => n.id));
  const inner = (edges || []).filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes: selected.map(stripRuntimeFlags), edges: inner };
};

export const buildClip = (
  nodes: any[],
  edges: any[],
  source?: FlowClip['source'],
): FlowClip => ({
  app: 'Labirinto Fluxogramas',
  type: CLIP_TYPE,
  version: 1,
  copiedAt: new Date().toISOString(),
  source,
  nodes: (nodes || []).map(stripRuntimeFlags),
  edges: edges || [],
});

/** Grava o recorte nos três níveis, sem falhar se algum deles estiver bloqueado. */
export const writeFlowClip = async (clip: FlowClip): Promise<void> => {
  memoryClip = clip;
  const text = JSON.stringify(clip);
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* armazenamento bloqueado: segue nos outros níveis */
  }
  try {
    await copyText(text);
  } catch {
    /* clipboard do sistema negado: o localStorage já cobre a colagem */
  }
};

export const parseFlowClip = (text: string): FlowClip | null => {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;

    // Recorte nativo
    if (parsed.type === CLIP_TYPE && Array.isArray(parsed.nodes)) {
      return parsed as FlowClip;
    }
    // Backup completo (.json do app): usa a versão ativa ou a primeira
    if (parsed.versions && typeof parsed.versions === 'object') {
      const key =
        parsed.activeVersion && parsed.versions[parsed.activeVersion]
          ? parsed.activeVersion
          : Object.keys(parsed.versions)[0];
      const v = key ? parsed.versions[key] : null;
      if (v && Array.isArray(v.nodes)) {
        return buildClip(v.nodes, v.edges || [], { title: parsed.title, version: key });
      }
    }
    // Par solto de nós e ligações
    if (Array.isArray(parsed.nodes)) {
      return buildClip(parsed.nodes, Array.isArray(parsed.edges) ? parsed.edges : []);
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Lê o recorte guardado pelo app (localStorage e memória).
 *
 * De propósito NÃO usa navigator.clipboard.readText: ler a área de
 * transferência exige permissão e o navegador mostra o aviso "Ver texto e
 * imagens copiados". O conteúdo do clipboard do sistema chega pelo evento
 * nativo de colar (readFlowClipFromEvent), que não pede nada ao usuário.
 */
export const readFlowClip = async (): Promise<FlowClip | null> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const clip = stored ? parseFlowClip(stored) : null;
    if (clip) return clip;
  } catch {
    /* ignore */
  }
  return memoryClip;
};

/** Recorte vindo do evento nativo de colar (Ctrl+V) — sem pedir permissão. */
export const readFlowClipFromEvent = (event: ClipboardEvent): FlowClip | null => {
  try {
    const text = event.clipboardData?.getData('text/plain') || '';
    return parseFlowClip(text);
  } catch {
    return null;
  }
};

export const hasFlowClip = (): boolean => {
  if (memoryClip) return true;
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
};

const bounds = (nodes: any[]) => {
  const list = (nodes || []).filter((n) => n?.position);
  if (!list.length) return null;
  const xs = list.map((n) => n.position.x);
  const ys = list.map((n) => n.position.y);
  const ws = list.map((n) => n.width || n.style?.width || 200);
  const hs = list.map((n) => n.height || n.style?.height || 80);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs.map((x, i) => x + (Number(ws[i]) || 200))),
    maxY: Math.max(...ys.map((y, i) => y + (Number(hs[i]) || 80))),
  };
};

/**
 * Gera IDs novos e reposiciona o recorte, para nunca sobrescrever nem se
 * sobrepor ao que já existe no diagrama de destino.
 */
export const prepareForPaste = (
  clip: FlowClip,
  existingNodes: any[],
  mode: 'ao-lado' | 'deslocado' = 'ao-lado',
): { nodes: any[]; edges: any[] } => {
  const stamp = Math.random().toString(36).slice(2, 8);
  const prefix = `c${stamp}_`;
  const map = new Map<string, string>();

  const clipBox = bounds(clip.nodes);
  const targetBox = bounds(existingNodes);

  let dx = 40;
  let dy = 40;
  if (clipBox) {
    if (mode === 'ao-lado' && targetBox) {
      dx = targetBox.maxX + 120 - clipBox.minX;
      dy = targetBox.minY - clipBox.minY;
    } else if (mode === 'ao-lado' && !targetBox) {
      dx = -clipBox.minX + 80;
      dy = -clipBox.minY + 80;
    }
  }

  const nodes = (clip.nodes || []).map((n) => {
    const id = `${prefix}${n.id}`;
    map.set(n.id, id);
    return {
      ...stripRuntimeFlags(n),
      id,
      position: { x: (n.position?.x || 0) + dx, y: (n.position?.y || 0) + dy },
      selected: true,
    };
  });

  const ids = new Set(nodes.map((n) => n.id));
  const edges = (clip.edges || [])
    .map((e) => ({
      ...e,
      id: `${prefix}${e.id || `${e.source}-${e.target}`}`,
      source: map.get(e.source) || e.source,
      target: map.get(e.target) || e.target,
      selected: false,
    }))
    .filter((e) => ids.has(e.source) && ids.has(e.target));

  return { nodes, edges };
};

export const describeClip = (clip: FlowClip): string => {
  const n = clip.nodes?.length || 0;
  const e = clip.edges?.length || 0;
  const origem = clip.source?.title
    ? ` de "${clip.source.title}"${clip.source.version ? ` (${clip.source.version})` : ''}`
    : '';
  return `${n} etapa${n === 1 ? '' : 's'} e ${e} ligação${e === 1 ? '' : 'ões'}${origem}`;
};
