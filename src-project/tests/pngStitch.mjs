import zlib from 'zlib';
import { createPngStitcher, canStitchPng, stitchedScale, STITCH_MAX_PIXELS } from '../.tmp-pngStitch.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// Decodificador PNG mínimo (RGB 8 bits, filtros 0-4) só para conferir o resultado.
function decodePng(buf) {
  const sig = buf.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error('assinatura inválida');
  let off = 8, w = 0, h = 0, type = -1; const idat = []; let crcOk = true;
  const table = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const t = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (crc(buf.subarray(off + 4, off + 8 + len)) !== buf.readUInt32BE(off + 8 + len)) crcOk = false;
    if (t === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; }
    if (t === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 3; const out = Buffer.alloc(stride * h); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? cur[i - 3] : 0, b = prev[i], c = i >= 3 ? prev[i - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      cur[i] = (line[i] + pred) & 255;
    }
    prev = cur;
  }
  return { w, h, type, rgb: out, crcOk };
}

check('navegador/Node com compressão em fluxo', canStitchPng());

// Imagem 301x517 com faixas brancas, linhas e degradê, gravada em 3 partes desiguais.
const W = 301, H = 517;
const pixel = (x, y) => (y % 50 < 20 ? [255, 255, 255] : x === 150 ? [0, 0, 0] : [(x * 7) & 255, (y * 3) & 255, (x + y) & 255]);
const png = createPngStitcher(W, H);
const alturas = [200, 117, 200];
let y0 = 0;
for (const h of alturas) {
  const rgba = new Uint8ClampedArray(W * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) { const [r, g, b] = pixel(x, y0 + y); rgba.set([r, g, b, 255], (y * W + x) * 4); }
  await png.writeRows(rgba, h);
  y0 += h;
}
const blob = await png.finish();
const buf = Buffer.from(await blob.arrayBuffer());
const img = decodePng(buf);
check('PNG válido com o tamanho certo (RGB)', img.w === W && img.h === H && img.type === 2, `${img.w}x${img.h} tipo ${img.type}`);
check('blocos com CRC correto', img.crcOk);
let diffs = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = pixel(x, y); const i = (y * W + x) * 3; if (img.rgb[i] !== r || img.rgb[i + 1] !== g || img.rgb[i + 2] !== b) diffs++; }
check('partes costuradas sem diferença de pixel (sem emenda)', diffs === 0, `${diffs} pixels diferentes`);
check('arquivo é comprimido', buf.length < W * H * 3, `${buf.length} bytes`);

// Imagem grande em branco (22.000 linhas): comprime em fluxo sem estourar memória.
const big = createPngStitcher(2200, 22000);
const faixa = new Uint8ClampedArray(2200 * 2000 * 4).fill(255);
for (let i = 0; i < 11; i++) await big.writeRows(faixa, 2000);
const bigBuf = Buffer.from(await (await big.finish()).arrayBuffer());
const bigImg = decodePng(bigBuf);
check('imagem de 2.200 x 22.000 px (maior que o limite do canvas)', bigImg.w === 2200 && bigImg.h === 22000 && bigImg.rgb.every((v) => v === 255), `${(bigBuf.length / 1024).toFixed(0)} KB`);

// Escala: nítida (2) quando cabe no limite de pixels; senão reduz só o necessário.
check('escala 2 num fluxo comprido comum', stitchedScale(1100, 21000) === 2);
const s = stitchedScale(10000, 20000);
check('fluxo enorme: respeita o total de pixels', 10000 * 20000 * s * s <= STITCH_MAX_PIXELS * 1.0001 && s < 2, s.toFixed(3));

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
