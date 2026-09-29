/**
 * EXCLUSÃO DE VÁRIOS DIAGRAMAS E PASTAS DE UMA VEZ
 * ------------------------------------------------
 * Conta pura (sem localStorage) do que acontece ao excluir uma seleção:
 * - diagramas selecionados são apagados;
 * - pastas selecionadas são apagadas, mas o que está dentro delas (e não foi
 *   selecionado) NÃO se perde: sobe para a pasta de cima mais próxima que
 *   continua existindo (ou para o início, se nenhuma sobrar).
 */

interface FolderLike { id: string; parentId: string | null }
interface DiagramLike { id: string; folderId?: string | null }

export interface BulkDeletePlan {
  diagramIds: string[];
  folderIds: string[];
  /** Diagramas que ficam, mas mudam de pasta (a pasta deles foi excluída). */
  movedDiagrams: { id: string; folderId: string | null }[];
  /** Pastas que ficam, mas mudam de pasta-mãe. */
  movedFolders: { id: string; parentId: string | null }[];
}

export function planBulkDelete(
  diagrams: DiagramLike[],
  folders: FolderLike[],
  selectedDiagramIds: Iterable<string>,
  selectedFolderIds: Iterable<string>,
): BulkDeletePlan {
  const delDiagrams = new Set(selectedDiagramIds);
  const delFolders = new Set(selectedFolderIds);
  const parentOf = new Map(folders.map((f) => [f.id, f.parentId]));

  // Pasta existente mais próxima subindo a partir de "id" (protege contra ciclo).
  const survivingAncestor = (id: string | null | undefined): string | null => {
    const seen = new Set<string>();
    let cur = id ?? null;
    while (cur && delFolders.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return cur && !delFolders.has(cur) && parentOf.has(cur) ? cur : null;
  };

  const movedDiagrams = diagrams
    .filter((d) => !delDiagrams.has(d.id) && d.folderId && delFolders.has(d.folderId))
    .map((d) => ({ id: d.id, folderId: survivingAncestor(d.folderId) }));
  const movedFolders = folders
    .filter((f) => !delFolders.has(f.id) && f.parentId && delFolders.has(f.parentId))
    .map((f) => ({ id: f.id, parentId: survivingAncestor(f.parentId) }));

  return {
    diagramIds: diagrams.filter((d) => delDiagrams.has(d.id)).map((d) => d.id),
    folderIds: folders.filter((f) => delFolders.has(f.id)).map((f) => f.id),
    movedDiagrams,
    movedFolders,
  };
}

/** "2 fluxos e 1 pasta" */
export function describeSelection(diagrams: number, folders: number): string {
  const parts: string[] = [];
  if (diagrams) parts.push(`${diagrams} ${diagrams === 1 ? 'fluxo' : 'fluxos'}`);
  if (folders) parts.push(`${folders} ${folders === 1 ? 'pasta' : 'pastas'}`);
  return parts.join(' e ') || 'nada';
}
