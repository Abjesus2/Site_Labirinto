/**
 * PNG ÚNICO A PARTIR DE PARTES (sem limite de canvas)
 * ---------------------------------------------------
 * O navegador não desenha um canvas com mais de 16.384 px por lado, então um
 * fluxo comprido nítido (escala 2) não cabe numa captura só. Aqui cada parte
 * é capturada separadamente em alta qualidade e as linhas de pixels são
 * gravadas, em sequência, direto num arquivo PNG — sem nunca montar a imagem
 * inteira num canvas. A compressão é feita em fluxo (CompressionStream), então
 * a memória usada é só a da parte da vez + o arquivo final comprimido.
 *
 * Sem DOM: funciona no navegador e no Node (testes).
 */

/** Máximo de pixels da imagem final (visualizadores comuns abrem bem até aqui). */
export const STITCH_MAX_PIXELS = 250_000_000;

/** O navegador sabe comprimir em fluxo (necessário para costurar o PNG)? */
export const canStitchPng = (): boolean => typeof (globalThis as any).CompressionStream === 'function';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (parts: Uint8Array[]): number => {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

const chunk = (type: string, data: Uint8Array): Uint8Array[] => {
  const t = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
  return [u32(data.length), t, data, u32(crc32([t, data]))];
};

export interface PngStitcher {
  /** Grava as próximas linhas (RGBA, largura = da imagem). Respeita a ordem. */
  writeRows(rgba: Uint8Array | Uint8ClampedArray, rows: number): Promise<void>;
  /** Linhas já gravadas. */
  readonly rowsWritten: number;
  /** Fecha o arquivo e devolve o PNG. */
  finish(): Promise<Blob>;
  /** Desiste (libera o compressor). */
  abort(): void;
}

/**
 * Cria o gravador de PNG (RGB 8 bits, fundo opaco). Cada linha usa o filtro
 * PNG que deixa menos "diferença" (nenhum, esquerda ou acima) — em
 * fluxogramas, com muito branco e linhas retas, isso comprime muito.
 */
export function createPngStitcher(width: number, height: number): PngStitcher {
  if (!canStitchPng()) throw new Error('Navegador sem CompressionStream');
  const cs = new (globalThis as any).CompressionStream('deflate') as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };
  const writer = cs.writable.getWriter();
  const compressed: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  const drained = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) compressed.push(value);
    }
  })();

  const stride = width * 3;
  let prev = new Uint8Array(stride);
  let rowsWritten = 0;
  let aborted = false;

  const writeRows = async (rgba: Uint8Array | Uint8ClampedArray, rows: number) => {
    if (aborted) return;
    const n = Math.min(rows, height - rowsWritten);
    if (n <= 0) return;
    const out = new Uint8Array(n * (stride + 1));
    const cur = new Uint8Array(stride);
    const cand = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
    for (let r = 0; r < n; r++) {
      // RGBA -> RGB (a imagem é gerada com fundo branco opaco).
      const base = r * width * 4;
      for (let x = 0, j = 0, i = base; x < width; x++, i += 4) {
        cur[j++] = rgba[i];
        cur[j++] = rgba[i + 1];
        cur[j++] = rgba[i + 2];
      }
      // Filtros 0 (nenhum), 1 (esquerda), 2 (acima): escolhe o de menor soma.
      let bestF = 0;
      let bestSum = Infinity;
      for (let f = 0; f < 3; f++) {
        const c = cand[f];
        let sum = 0;
        for (let i = 0; i < stride; i++) {
          const v = f === 0 ? cur[i] : f === 1 ? (cur[i] - (i >= 3 ? cur[i - 3] : 0)) & 255 : (cur[i] - prev[i]) & 255;
          c[i] = v;
          sum += v < 128 ? v : 256 - v;
          if (sum >= bestSum) break;
        }
        if (sum < bestSum) { bestSum = sum; bestF = f; }
      }
      // Refaz o vencedor inteiro (o laço acima pode ter parado no meio).
      const w = cand[bestF];
      for (let i = 0; i < stride; i++) {
        w[i] = bestF === 0 ? cur[i] : bestF === 1 ? (cur[i] - (i >= 3 ? cur[i - 3] : 0)) & 255 : (cur[i] - prev[i]) & 255;
      }
      const o = r * (stride + 1);
      out[o] = bestF;
      out.set(w, o + 1);
      prev.set(cur);
    }
    rowsWritten += n;
    await writer.ready;
    await writer.write(out);
  };

  const finish = async (): Promise<Blob> => {
    if (rowsWritten < height) {
      // Completa com branco se alguma parte veio menor (não deve acontecer).
      const missing = height - rowsWritten;
      const white = new Uint8Array(width * 4 * Math.min(missing, 256)).fill(255);
      while (rowsWritten < height) await writeRows(white, Math.min(256, height - rowsWritten));
    }
    await writer.close();
    await drained;
    // Junta o comprimido e divide em blocos IDAT de até 1 MB.
    const total = compressed.reduce((s, p) => s + p.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const p of compressed) { all.set(p, off); off += p.length; }
    compressed.length = 0;

    const ihdr = new Uint8Array(13);
    ihdr.set(u32(width), 0);
    ihdr.set(u32(height), 4);
    ihdr[8] = 8; // bits por canal
    ihdr[9] = 2; // RGB
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const parts: Uint8Array[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunk('IHDR', ihdr)];
    const IDAT_MAX = 1 << 20;
    for (let i = 0; i < all.length; i += IDAT_MAX) parts.push(...chunk('IDAT', all.subarray(i, Math.min(all.length, i + IDAT_MAX))));
    parts.push(...chunk('IEND', new Uint8Array(0)));
    return new Blob(parts as BlobPart[], { type: 'image/png' });
  };

  const abort = () => {
    aborted = true;
    try { writer.abort(); } catch { /* já fechado */ }
    prev = new Uint8Array(0);
  };

  return {
    writeRows,
    get rowsWritten() { return rowsWritten; },
    finish,
    abort,
  };
}

/**
 * Escala do PNG costurado: a nítida (2) se couber; senão reduz só o
 * necessário para o total de pixels (a largura não limita: faixas muito
 * largas são capturadas em colunas).
 */
export function stitchedScale(width: number, height: number, desired = 2, maxPixels = STITCH_MAX_PIXELS): number {
  return Math.min(desired, Math.sqrt(maxPixels / Math.max(1, width * height)));
}
