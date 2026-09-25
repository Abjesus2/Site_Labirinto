import { computePageCuts, singleImageScale, choosePdfLayout, CANVAS_MAX_SIDE, MIN_READABLE_SCALE } from '../.tmp-exportPaging.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// Cortes sempre em espaço livre (com folga) e nunca maiores que a página.
const ocupado = [[250, 320], [560, 640], [880, 900]];
const cortes = computePageCuts(0, 1000, 300, ocupado);
check('cortes em vãos livres', JSON.stringify(cortes) === JSON.stringify([0, 242, 542, 842, 1000]), JSON.stringify(cortes));
const livre = (y, spans, m) => spans.every(([a, b]) => y <= a - m || y >= b + m);
check('nenhum corte cai em cima de forma', cortes.slice(1, -1).every((c) => livre(c, ocupado, 8)));
check('nenhuma página passa da capacidade', cortes.slice(1).every((c, i) => c - cortes[i] <= 300));

// Fluxo que cabe numa página: sem cortes.
check('fluxo pequeno: uma página só', JSON.stringify(computePageCuts(10, 200, 300, [[50, 100]])) === '[10,200]');

// Forma maior que a página: corta no limite (não trava).
const gigante = computePageCuts(0, 1000, 300, [[0, 1000]]);
check('forma maior que a página: corta no limite', JSON.stringify(gigante) === '[0,300,600,900,1000]', JSON.stringify(gigante));

// Fluxo comprido e denso (151 formas empilhadas): sempre progride e respeita as formas.
const muitas = Array.from({ length: 151 }, (_, i) => [i * 120 + 20, i * 120 + 90]);
const c2 = computePageCuts(0, 151 * 120, 1000, muitas, { minFill: 0.55, margin: 10 });
check('fluxo comprido: cortes crescentes e livres', c2.every((c, i) => i === 0 || c > c2[i - 1]) && c2.slice(1, -1).every((c) => livre(c, muitas, 10)));
check('fluxo comprido: páginas bem aproveitadas (≥ 55%)', c2.slice(1, -1).every((c, i) => c - c2[i] >= 550));

// PNG: escala nítida quando cabe; reduz só o necessário quando não cabe.
check('PNG pequeno: escala 2x', singleImageScale(1200, 800) === 2);
const s = singleImageScale(1100, 21000);
check('PNG comprido: respeita o limite do canvas', 21000 * s <= CANVAS_MAX_SIDE + 0.01 && s < MIN_READABLE_SCALE, s.toFixed(3));

// PDF: fluxo vertical estreito -> retrato (texto legível, menos páginas).
const retrato = choosePdfLayout(600, 21000, 'y');
check('PDF vertical estreito: retrato, texto legível', retrato.orientation === 'p' && retrato.mmPerUnit * 11 >= 2.1, `${retrato.orientation} ${retrato.mmPerUnit.toFixed(3)} ${retrato.pages}p`);
// Mais largo: em retrato o texto ficaria pequeno demais -> paisagem.
const medio = choosePdfLayout(1100, 21000, 'y');
check('PDF vertical largo: paisagem para o texto ficar legível', medio.orientation === 'l' && medio.mmPerUnit * 11 >= 2.1, `${medio.orientation} ${medio.mmPerUnit.toFixed(3)} ${medio.pages}p`);
// Largo demais para qualquer uma: a que deixa o texto maior.
const largo = choosePdfLayout(1500, 3000, 'y');
check('PDF muito largo: orientação com o maior texto', largo.orientation === 'l' && largo.mmPerUnit > 190 / 1500, `${largo.orientation} ${largo.mmPerUnit.toFixed(3)}`);
// Fluxo horizontal: corta ao longo de x.
const horiz = choosePdfLayout(500, 8000, 'x');
check('PDF horizontal: paisagem, corte na largura', horiz.orientation === 'l' && horiz.usableLong === 277, `${horiz.orientation} ${horiz.usableLong}`);
// Fluxo pequeno: não amplia demais.
check('PDF pequeno: não amplia além de 0,35 mm/unidade', choosePdfLayout(200, 300).mmPerUnit === 0.35 && choosePdfLayout(200, 300).pages === 1);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
