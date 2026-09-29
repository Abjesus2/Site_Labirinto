/**
 * MOVER FLUXOS E PASTAS
 * ---------------------
 * Contas puras (sem localStorage). Mover uma pasta leva junto TUDO o que está
 * dentro dela (subpastas e fluxos), porque o conteúdo continua apontando para
 * ela — só a pasta muda de lugar.
 */

interface FolderLike { id: string; parentId: string | null; name?: string }
interface DiagramLike { id: string; folderId?: string | null }

/** Todas as pastas dentro de "id" (filhas, netas...), sem incluir ela mesma. */
export function folderDescendants(folders: FolderLike[], id: string): Set<string> {
  const children = new Map<string, string[]>();
  folders.forEach((f) => {
    if (!f.parentId) return;
    const list = children.get(f.parentId) || [];
    list.push(f.id);
    children.set(f.parentId, list);
  });
  const out = new Set<string>();
  const stack = [...(children.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur) || cur === id) continue;
    out.add(cur);
    stack.push(...(children.get(cur) || []));
  }
  return out;
}

/** Destinos proibidos: as pastas movidas e tudo dentro delas (evita pasta dentro de si mesma). */
export function invalidMoveTargets(folders: FolderLike[], movingFolderIds: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const id of movingFolderIds) {
    out.add(id);
    folderDescendants(folders, id).forEach((d) => out.add(d));
  }
  return out;
}

export interface MovePlan {
  diagrams: { id: string; folderId: string | null }[];
  folders: { id: string; parentId: string | null }[];
}

/**
 * O que muda ao mover a seleção para "targetFolderId" (null = início).
 * Itens que já estão dentro de uma pasta selecionada vão junto com ela
 * (mantém a organização interna). Devolve null se o destino é inválido.
 */
export function planMove(
  diagrams: DiagramLike[],
  folders: FolderLike[],
  diagramIds: Iterable<string>,
  folderIds: Iterable<string>,
  targetFolderId: string | null,
): MovePlan | null {
  const movingFolders = new Set([...folderIds].filter((id) => folders.some((f) => f.id === id)));
  if (targetFolderId !== null && !folders.some((f) => f.id === targetFolderId)) return null;
  if (targetFolderId !== null && invalidMoveTargets(folders, movingFolders).has(targetFolderId)) return null;

  const insideMoving = new Set<string>();
  movingFolders.forEach((id) => folderDescendants(folders, id).forEach((d) => insideMoving.add(d)));

  const planFolders = folders
    .filter((f) => movingFolders.has(f.id) && !insideMoving.has(f.id) && (f.parentId ?? null) !== targetFolderId)
    .map((f) => ({ id: f.id, parentId: targetFolderId }));
  const wanted = new Set(diagramIds);
  const planDiagrams = diagrams
    .filter((d) => wanted.has(d.id))
    .filter((d) => !(d.folderId && (movingFolders.has(d.folderId) || insideMoving.has(d.folderId))))
    .filter((d) => (d.folderId ?? null) !== targetFolderId)
    .map((d) => ({ id: d.id, folderId: targetFolderId }));
  return { diagrams: planDiagrams, folders: planFolders };
}

/** Pastas em árvore (ordem alfabética, com a profundidade) para escolher o destino. */
export function folderTree<T extends FolderLike>(folders: T[]): { folder: T; depth: number }[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(folders.map((f) => f.id));
  folders.forEach((f) => {
    const key = f.parentId && ids.has(f.parentId) ? f.parentId : null;
    const list = byParent.get(key) || [];
    list.push(f);
    byParent.set(key, list);
  });
  const out: { folder: T; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    const list = (byParent.get(parent) || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    for (const f of list) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  // Pastas presas num ciclo (não deveria existir) aparecem no fim, no primeiro nível.
  folders.forEach((f) => { if (!seen.has(f.id)) { seen.add(f.id); out.push({ folder: f, depth: 0 }); } });
  return out;
}
