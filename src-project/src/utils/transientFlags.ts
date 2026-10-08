/**
 * Tira as marcas de "arrastando"/"redimensionando" que só valem durante o
 * gesto. O histórico e o salvamento eram gravados no instante em que a forma
 * ainda estava "arrastando"; ao desfazer ou reabrir o fluxo ela voltava com
 * essa marca, e o React Flow trata uma forma "arrastando" como dentro de
 * QUALQUER seleção por caixa — ela (e suas linhas) entrava na seleção mesmo
 * longe da área escolhida.
 */
export function clearTransientFlags<T extends { dragging?: boolean; resizing?: boolean }>(items: T[]): T[] {
  if (!Array.isArray(items) || !items.some((n) => n && (n.dragging || n.resizing))) return items;
  return items.map((n) => {
    if (!n || !(n.dragging || n.resizing)) return n;
    const { dragging, resizing, ...rest } = n as any;
    return rest as T;
  });
}
