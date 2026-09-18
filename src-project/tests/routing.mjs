import { adaptRouteToEndpoints } from '../.tmp-geom.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const isOrthogonal = (pts) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return false;
  }
  return true;
};

// Rota manual com 3 trechos (4 pontos), desenhada à mão pelo usuário:
// desce, vai para a direita, desce de novo — um "degrau".
const rotaOriginal = [
  { x: 100, y: 100 },
  { x: 100, y: 200 },
  { x: 300, y: 200 },
  { x: 300, y: 300 },
];

// 1. Nada mudou: a rota volta exatamente como estava (nao regenera à toa)
const semMudanca = adaptRouteToEndpoints({
  points: rotaOriginal,
  source: { x: 100, y: 100 },
  sourceSide: 'bottom',
  target: { x: 300, y: 300 },
  targetSide: 'top',
});
check(
  'sem mudanca nos nos, a rota manual fica intacta',
  semMudanca.length === 4 &&
    semMudanca[1].x === 100 && semMudanca[1].y === 200 &&
    semMudanca[2].x === 300 && semMudanca[2].y === 200,
  JSON.stringify(semMudanca),
);

// 2. Nó de origem se move (arrasta o quadro conectado): a forma da rota
// manual (o "degrau") precisa sobreviver, só ajeitando a ponta.
// Antes da correção, isso caía no fallback e virava uma rota genérica nova.
const rotaColuna = [
  { x: 100, y: 100 },
  { x: 100, y: 200 },
  { x: 100, y: 300 },
  { x: 300, y: 300 },
];
const origemMoveu = adaptRouteToEndpoints({
  points: rotaColuna,
  source: { x: 250, y: 100 }, // nó de origem arrastado para o lado
  sourceSide: 'bottom',
  target: { x: 300, y: 300 }, // destino nao mudou
  targetSide: 'left',
});
check('rota continua ortogonal depois que a origem se move', isOrthogonal(origemMoveu), JSON.stringify(origemMoveu));
check('rota nao foi descartada (mais de 2 pontos)', origemMoveu.length > 2, `pontos: ${origemMoveu.length}`);
check(
  'a forma original (trecho perto de x=100) ainda aparece na rota',
  origemMoveu.some((p) => Math.abs(p.x - 100) < 1),
  JSON.stringify(origemMoveu),
);

// 3. Nó de destino se move: mesma garantia, agora do outro lado.
const destinoMoveu = adaptRouteToEndpoints({
  points: rotaColuna,
  source: { x: 100, y: 100 },
  sourceSide: 'bottom',
  target: { x: 450, y: 260 }, // nó de destino arrastado
  targetSide: 'left',
});
check('rota continua ortogonal depois que o destino se move', isOrthogonal(destinoMoveu), JSON.stringify(destinoMoveu));
check('rota nao foi descartada (mais de 2 pontos)', destinoMoveu.length > 2, `pontos: ${destinoMoveu.length}`);

// 4. Caso de conflito real: rota de um único cotovelo (3 pontos) onde origem
// E destino saem/entram pelo MESMO eixo (ex.: os dois embaixo, laço de
// retorno). O remendo antigo escrevia no mesmo ponto duas vezes e descartava
// a rota inteira ao menor movimento.
const rotaUmCotovelo = [
  { x: 100, y: 100 },
  { x: 100, y: 300 },
  { x: 300, y: 300 },
];
const ambosMoveram = adaptRouteToEndpoints({
  points: rotaUmCotovelo,
  source: { x: 120, y: 100 },
  sourceSide: 'bottom',
  target: { x: 320, y: 300 },
  targetSide: 'bottom',
});
check('conflito de eixo (origem e destino no mesmo lado) continua ortogonal', isOrthogonal(ambosMoveram), JSON.stringify(ambosMoveram));
check('conflito de eixo nao descarta a rota (mais de 2 pontos)', ambosMoveram.length > 2, `pontos: ${ambosMoveram.length}`);

// 5. Reta manual de 2 pontos: se ainda estiver alinhada, fica como reta
// (nao pode "pular" para a rota automática cheia de curvas).
const retaAlinhada = adaptRouteToEndpoints({
  points: [{ x: 100, y: 100 }, { x: 100, y: 300 }],
  source: { x: 100, y: 100 },
  sourceSide: 'bottom',
  target: { x: 100, y: 300 },
  targetSide: 'top',
  preserveStraightLine: true,
});
check('reta de 2 pontos alinhada permanece reta', retaAlinhada.length === 2, JSON.stringify(retaAlinhada));

console.log(R.join('\n'));
