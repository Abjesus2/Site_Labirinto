/**
 * IMPORTAR FLUXOGRAMA ESCOLHENDO AS VERSÕES
 * ----------------------------------------
 * Um arquivo .json do app pode ter várias versões (simples, normal,
 * detalhado...). A pessoa escolhe quais trazer (uma, várias ou todas); cada
 * uma vai para a versão de MESMO NOME deste diagrama. Se essa versão já tem
 * conteúdo, a pessoa decide: substituir o que existe ou acrescentar ao lado.
 *
 * Contas puras (sem React), testáveis isoladas.
 */
import { buildClip, prepareForPaste } from './flowClipboard';

export interface ImportSource {
  /** Nome da versão no arquivo. */
  name: string;
  /** Versão deste diagrama que vai receber o conteúdo. */
  target: string;
  nodes: any[];
  edges: any[];
}

export interface ImportFile {
  title?: string;
  sources: ImportSource[];
}

export type ImportMode = 'substituir' | 'acrescentar';

type VersionMap = Record<string, { nodes: any[]; edges: any[]; viewport?: any }>;

/**
 * Lê o conteúdo de um .json do app. Arquivo com versões: uma opção por versão
 * com conteúdo (destino = mesma versão). Arquivo só com formas (recorte,
 * lista de nós): uma opção só, que vai para a versão aberta agora.
 */
export function readImportFile(parsed: any, activeVersion: string): ImportFile | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : undefined;
  if (parsed.versions && typeof parsed.versions === 'object' && !Array.isArray(parsed.versions)) {
    const sources = Object.entries(parsed.versions as Record<string, any>)
      .filter(([, v]) => v && Array.isArray(v.nodes) && v.nodes.length > 0)
      .map(([name, v]) => ({ name, target: name, nodes: v.nodes, edges: Array.isArray(v.edges) ? v.edges : [] }));
    return sources.length ? { title, sources } : null;
  }
  if (Array.isArray(parsed.nodes) && parsed.nodes.length) {
    return { title, sources: [{ name: 'conteúdo do arquivo', target: activeVersion, nodes: parsed.nodes, edges: Array.isArray(parsed.edges) ? parsed.edges : [] }] };
  }
  if (Array.isArray(parsed) && parsed.length) {
    return { title, sources: [{ name: 'conteúdo do arquivo', target: activeVersion, nodes: parsed, edges: [] }] };
  }
  return null;
}

/** Quantas etapas a versão já tem neste diagrama (0 = vazia, não precisa perguntar). */
export const existingCount = (versions: VersionMap, target: string): number => versions[target]?.nodes?.length || 0;

/**
 * Aplica as versões escolhidas. "substituir" troca o conteúdo da versão;
 * "acrescentar" junta ao lado do que já existe, com IDs novos (nada é
 * sobrescrito nem fica por cima). Versão vazia recebe o conteúdo como está.
 */
export function applyImport(
  current: VersionMap,
  choices: { source: ImportSource; mode: ImportMode }[],
): VersionMap {
  const out: VersionMap = { ...current };
  for (const { source, mode } of choices) {
    const existing = out[source.target];
    const hasContent = (existing?.nodes?.length || 0) > 0;
    const clean = (list: any[]) => list.map((n) => ({ ...n, selected: false }));
    if (!hasContent || mode === 'substituir') {
      out[source.target] = {
        nodes: clean(source.nodes.map(({ measured, dragging, resizing, ...rest }: any) => rest)),
        edges: source.edges.map((e: any) => ({ ...e, selected: false })),
      };
      continue;
    }
    const prepared = prepareForPaste(buildClip(source.nodes, source.edges), existing.nodes, 'ao-lado');
    out[source.target] = {
      ...existing,
      nodes: [...clean(existing.nodes), ...clean(prepared.nodes)],
      edges: [...existing.edges, ...prepared.edges],
    };
  }
  return out;
}
