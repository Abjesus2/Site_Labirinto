/**
 * VERSÕES FIXAS DO DIAGRAMA
 * -------------------------
 * Todo diagrama tem exatamente três versões: simples, normal e detalhado.
 * Versões antigas criadas fora disso (ex.: "Detalhado (V2) - Simples", da
 * antiga opção "Criar nova versão" da IA) não aparecem mais como abas:
 * - se a versão fixa correspondente estiver vazia, o conteúdo passa para ela
 *   sozinho (nada se perde, nada a decidir);
 * - se ela já tiver conteúdo, a versão extra fica guardada e o app pergunta
 *   o que fazer (substituir, acrescentar ou excluir).
 */

export const FIXED_VERSIONS = ['simples', 'normal', 'detalhado'] as const;
export type FixedVersion = (typeof FIXED_VERSIONS)[number];

export const isFixedVersion = (name: string): name is FixedVersion =>
  (FIXED_VERSIONS as readonly string[]).includes(name);

type VersionMap = Record<string, { nodes: any[]; edges: any[]; viewport?: any }>;

/** A que versão fixa um nome extra se refere ("Detalhado (V2) - Simples" -> simples). */
export function guessTargetVersion(name: string): FixedVersion {
  const n = name.toLowerCase().trim();
  // Sufixo " - <versão>" (nova versão gerada para várias versões de uma vez).
  const suffix = /-\s*(simples|normal|detalhado)\s*$/.exec(n);
  if (suffix) return suffix[1] as FixedVersion;
  const prefix = /^(simples|normal|detalhado)\b/.exec(n);
  if (prefix) return prefix[1] as FixedVersion;
  const any = /(simples|normal|detalhado)/.exec(n);
  return (any?.[1] as FixedVersion) || 'normal';
}

const hasContent = (v?: { nodes?: any[]; edges?: any[] }) => (v?.nodes?.length || 0) + (v?.edges?.length || 0) > 0;

export interface NormalizedVersions {
  versions: VersionMap;
  /** Versões extras com conteúdo que precisam de decisão do usuário. */
  extras: string[];
  /** Movidas sozinhas para uma versão fixa vazia. */
  moved: { from: string; to: FixedVersion }[];
  /** Removidas por estarem vazias. */
  droppedEmpty: string[];
}

export function normalizeVersions(input: VersionMap): NormalizedVersions {
  const versions: VersionMap = { ...input };
  const moved: NormalizedVersions['moved'] = [];
  const droppedEmpty: string[] = [];
  const extras: string[] = [];
  Object.keys(input)
    .filter((k) => !isFixedVersion(k))
    .forEach((k) => {
      if (!hasContent(input[k])) {
        delete versions[k];
        droppedEmpty.push(k);
        return;
      }
      const target = guessTargetVersion(k);
      if (!hasContent(versions[target])) {
        versions[target] = { nodes: input[k].nodes || [], edges: input[k].edges || [] };
        delete versions[k];
        moved.push({ from: k, to: target });
        return;
      }
      extras.push(k);
    });
  return { versions, extras, moved, droppedEmpty };
}
