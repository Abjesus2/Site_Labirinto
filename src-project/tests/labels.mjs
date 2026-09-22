import { collectLabelObstacles, placeEdgeLabel, pointAtFraction, fractionOfPoint } from '../.tmp-labelPlacement.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);
const dims = () => ({ width: 200, height: 80 });
const box = (x, y, w = 70, h = 20) => ({ left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 });
const bate = (p, obs, w = 70, h = 20) => {
  const b = box(p.x, p.y, w, h);
  return obs.some(o => b.left < o.right && b.right > o.left && b.top < o.bottom && b.bottom > o.top);
};

// duas formas lado a lado (200x80), com tempo ligado
const nodes = [
  { id: 'n1', type: 'decision', position: { x: 0, y: 100 }, data: { showTimingMode: true } },
  { id: 'n2', type: 'process', position: { x: 400, y: 100 }, data: { showTimingMode: true } },
  { id: 'raia', type: 'swimlane', position: { x: -50, y: 50 }, data: {} },
];
const obs = collectLabelObstacles(nodes, dims);
check('forma e selo viram obstaculos', obs.length === 4, obs.length + ' areas');
check('raia nao vira obstaculo', !obs.some(o => o.left === -54));
check('corpo da forma entra na conta', obs.some(o => o.top <= 100 && o.bottom >= 180));
check('selo fica logo abaixo da forma', obs.some(o => o.top === 182 && o.bottom === 204));

// linha horizontal entre as duas formas: meio livre, nao mexe
const reta = [{ x: 200, y: 140 }, { x: 400, y: 140 }];
const meioLivre = placeEdgeLabel({ polyline: reta, x: 300, y: 140, width: 70, height: 20, obstacles: obs });
check('etiqueta em trecho livre nao se mexe', meioLivre.x === 300 && meioLivre.y === 140);

// meio caindo em cima do corpo da forma de destino
const dentroDaForma = placeEdgeLabel({ polyline: [{ x: 200, y: 140 }, { x: 600, y: 140 }], x: 450, y: 140, width: 70, height: 20, obstacles: obs });
check('etiqueta sai de cima da forma', !bate(dentroDaForma, obs), `x ${450} -> ${Math.round(dentroDaForma.x)}, y ${Math.round(dentroDaForma.y)}`);

// meio caindo em cima do selo de tempo
const noSelo = placeEdgeLabel({ polyline: [{ x: 100, y: 193 }, { x: 500, y: 193 }], x: 300, y: 193, width: 70, height: 20, obstacles: obs });
check('etiqueta sai de cima do selo', !bate(noSelo, obs), `y ${193} -> ${Math.round(noSelo.y)}`);

// caminho ortogonal: a etiqueta continua sobre algum ponto da linha
const rota = [{ x: 200, y: 140 }, { x: 300, y: 140 }, { x: 300, y: 400 }, { x: 400, y: 400 }];
const ortogonal = placeEdgeLabel({ polyline: rota, x: 300, y: 140, width: 70, height: 20, obstacles: obs });
const sobreRota = rota.some((p, i) => {
  const q = rota[i + 1];
  if (!q) return false;
  const naFaixaX = ortogonal.x >= Math.min(p.x, q.x) - 2 && ortogonal.x <= Math.max(p.x, q.x) + 2;
  const naFaixaY = ortogonal.y >= Math.min(p.y, q.y) - 2 && ortogonal.y <= Math.max(p.y, q.y) + 2;
  return naFaixaX && naFaixaY;
});
check('etiqueta continua presa a linha', sobreRota, `(${Math.round(ortogonal.x)}, ${Math.round(ortogonal.y)})`);
check('etiqueta desviada nao bate em nada', !bate(ortogonal, obs));

// linha curtissima entre formas coladas: nao ha trecho livre, afasta de lado
const coladas = collectLabelObstacles([
  { id: 'a', type: 'process', position: { x: 0, y: 0 }, data: {} },
  { id: 'b', type: 'process', position: { x: 0, y: 90 }, data: {} },
], dims);
const curta = placeEdgeLabel({ polyline: [{ x: 100, y: 80 }, { x: 100, y: 90 }], x: 100, y: 85, width: 70, height: 20, obstacles: coladas });
check('linha curta: etiqueta se afasta para o lado', !bate(curta, coladas), `(${Math.round(curta.x)}, ${Math.round(curta.y)})`);

// utilitarios
check('ponto no meio da polilinha', (() => { const p = pointAtFraction([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0.5); return p.x === 50 && p.y === 0; })());
check('sem obstaculos nada muda', (() => { const p = placeEdgeLabel({ polyline: reta, x: 7, y: 9, width: 70, height: 20, obstacles: [] }); return p.x === 7 && p.y === 9; })());

// Posição do texto escolhida arrastando: projeta o ponto na linha
{
  const emL = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]; // linha em L, 200 de comprimento
  check('meio de uma linha em L é o canto (50%), não o meio do 1º trecho', (() => { const p = pointAtFraction(emL, 0.5); return p.x === 100 && p.y === 0; })());
  check('ponto sobre a linha vira a fração certa', Math.abs(fractionOfPoint(emL, { x: 100, y: 50 }) - 0.75) < 1e-9);
  check('ponto fora da linha é projetado no trecho mais próximo', Math.abs(fractionOfPoint(emL, { x: 40, y: 30 }) - 0.2) < 1e-9);
  check('ida e volta: fração -> ponto -> fração', Math.abs(fractionOfPoint(emL, pointAtFraction(emL, 0.37)) - 0.37) < 1e-9);
  check('antes do início fica em 0, depois do fim fica em 1', fractionOfPoint(emL, { x: -50, y: 0 }) === 0 && fractionOfPoint(emL, { x: 100, y: 180 }) === 1);
}

console.log(R.join('\n'));
