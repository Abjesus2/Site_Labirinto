/**
 * PAGINAÇÃO E ESCALA DA EXPORTAÇÃO (PNG/PDF)
 * ------------------------------------------
 * Antes o fluxo inteiro virava UMA imagem limitada a 8192 px no maior lado:
 * num fluxo comprido (ex.: 1.100 × 21.000) sobravam ~360 px de largura e o
 * texto ficava ilegível; no PDF essa mesma imagem era esticada e cortada em
 * fatias fixas de página, passando por cima de formas e textos.
 *
 * Aqui ficam as contas puras (sem DOM), testáveis isoladas:
 * - escala da imagem única (PNG) respeitando os limites de canvas do navegador;
 * - pontos de corte ao longo do fluxo que caem SEMPRE em espaço vazio (entre
 *   formas/textos), nunca em cima de uma informação.
 */

/** Intervalo ocupado ao longo do eixo de corte (ex.: topo..base de uma forma). */
export type Span = [number, number];

/**
 * Onde cortar um fluxo de "start" a "end" em pedaços de no máximo
 * "capacity" unidades, sem cortar nenhum intervalo ocupado.
 * Cada corte fica o mais longe possível (aproveita a página), mas não antes
 * de "minFill" da capacidade, sempre num ponto livre (com folga "margin"
 * das formas). Se nenhum ponto livre existir (forma maior que a página),
 * corta no limite da capacidade.
 * Devolve os limites [start, c1, c2, ..., end].
 */
export function computePageCuts(
  start: number,
  end: number,
  capacity: number,
  occupied: Span[],
  opts: { minFill?: number; margin?: number } = {},
): number[] {
  const minFill = opts.minFill ?? 0.5;
  const margin = opts.margin ?? 8;
  const spans = occupied
    .map(([a, b]) => [Math.min(a, b) - margin, Math.max(a, b) + margin] as Span)
    .sort((p, q) => p[0] - q[0]);

  // Junta intervalos sobrepostos -> lista de áreas ocupadas.
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const isFree = (y: number) => !merged.some(([a, b]) => y > a && y < b);

  const cuts = [start];
  let cur = start;
  let guard = 0;
  while (end - cur > capacity && guard++ < 10000) {
    const limit = cur + capacity;
    const floor = cur + capacity * minFill;
    let best: number | null = null;
    // Vãos livres entre as áreas ocupadas.
    const gaps: Span[] = [];
    let prevEnd = -Infinity;
    for (const [a, b] of merged) {
      if (a > prevEnd) gaps.push([prevEnd, a]);
      prevEnd = Math.max(prevEnd, b);
    }
    gaps.push([prevEnd, Infinity]);
    for (const [ga, gb] of gaps) {
      const lo = Math.max(ga, floor);
      const hi = Math.min(gb, limit);
      if (lo > hi) continue;
      // Ponto livre mais distante permitido (aproveita a página ao máximo;
      // a folga "margin" já afasta o corte da forma mais próxima).
      const candidate = hi;
      if (isFree(candidate) && (best === null || candidate > best)) best = candidate;
    }
    const cut = best ?? limit;
    cuts.push(cut);
    cur = cut;
  }
  cuts.push(end);
  return cuts;
}

/**
 * Limites de canvas: a biblioteca de captura (html-to-image) reduz sozinha
 * qualquer imagem acima de 16.384 px por lado — passar disso só perdia
 * nitidez sem aviso. Área também limitada (Safari é o mais restrito).
 */
export const CANVAS_MAX_SIDE = 16384;
export const CANVAS_MAX_AREA = 150_000_000;

/**
 * Escala para exportar o fluxo inteiro numa imagem só: a desejada (nítida)
 * se couber; senão a maior que respeita os limites do canvas.
 */
export function singleImageScale(width: number, height: number, desired = 2): number {
  const bySide = CANVAS_MAX_SIDE / Math.max(width, height, 1);
  const byArea = Math.sqrt(CANVAS_MAX_AREA / Math.max(1, width * height));
  return Math.min(desired, bySide, byArea);
}

/** Abaixo desta escala o texto (≈11 px no fluxo) deixa de ser confortável numa imagem única. */
export const MIN_READABLE_SCALE = 1.25;

export interface PdfLayout {
  orientation: 'p' | 'l';
  /** mm por unidade do fluxo. */
  mmPerUnit: number;
  /** Área útil da página (mm) no sentido transversal ao corte (a "largura" do fluxo). */
  usableCross: number;
  /** Área útil da página (mm) no sentido do corte (o "comprimento" do fluxo). */
  usableLong: number;
  pages: number;
}

export const PDF_MARGINS = { side: 10, top: 12, bottom: 14 };

/**
 * Orientação/escala do PDF: o fluxo ocupa a largura útil da página (a
 * altura, se ele corre na horizontal) e segue por várias páginas no sentido
 * do comprimento. Escolhe a orientação que deixa o texto num tamanho de
 * leitura (≥ ~6 pt) com menos páginas; se nenhuma chega nisso, a que deixa
 * o texto maior.
 */
export function choosePdfLayout(crossSize: number, longSize: number, axis: 'x' | 'y' = 'y'): PdfLayout {
  const A4 = { w: 210, h: 297 };
  const M = PDF_MARGINS;
  const options = (['p', 'l'] as const).map((orientation) => {
    const pw = orientation === 'p' ? A4.w : A4.h;
    const ph = orientation === 'p' ? A4.h : A4.w;
    const usableW = pw - M.side * 2;
    const usableH = ph - M.top - M.bottom;
    const usableCross = axis === 'y' ? usableW : usableH;
    const usableLong = axis === 'y' ? usableH : usableW;
    // Nunca amplia mais que 0,35 mm por unidade (texto de 11 px ≈ 11 pt).
    const mmPerUnit = Math.min(0.35, usableCross / Math.max(1, crossSize));
    const pages = Math.max(1, Math.ceil((longSize * mmPerUnit) / usableLong));
    return { orientation, mmPerUnit, usableCross, usableLong, pages };
  });
  // Texto do fluxo ≈ 11 unidades; 6 pt ≈ 2,12 mm.
  const readable = options.filter((o) => o.mmPerUnit * 11 >= 2.1);
  const pick = readable.length
    ? [...readable].sort((a, b) => a.pages - b.pages || b.mmPerUnit - a.mmPerUnit)[0]
    : [...options].sort((a, b) => b.mmPerUnit - a.mmPerUnit)[0];
  return pick;
}
