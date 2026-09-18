import { clampSegmentMovement, validateManualEdgeRoute } from '../.tmp-geom.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);
const no = (id, x, y, w = 200, h = 80) => ({ id, type: 'process', position: { x, y }, width: w, height: h, measured: { width: w, height: h }, data: {} });

// rota em Z: (100,0) -> (100,150) -> (300,150) -> (300,300)
const rota = [{ x: 100, y: 0 }, { x: 100, y: 150 }, { x: 300, y: 150 }, { x: 300, y: 300 }];
const origem = no('src', 0, -80);
const destino = no('dst', 200, 300);

// 1. caminho livre: o trecho do meio desce junto com o arraste
const livre = clampSegmentMovement({
  startPoints: rota, segIndex: 1, dir: 'horiz', delta: { x: 0, y: 40 },
  nodes: [origem, destino], sourceNodeId: 'src', targetNodeId: 'dst',
});
check('trecho do meio acompanha o arraste', Math.abs(livre[1].y - 190) < 1 && Math.abs(livre[2].y - 190) < 1, `y 150 -> ${livre[1].y}`);

// 2. obstaculo no caminho: o arraste e freado, mas nao zerado
const parede = no('parede', 150, 200, 100, 30);
const freado = clampSegmentMovement({
  startPoints: rota, segIndex: 1, dir: 'horiz', delta: { x: 0, y: 65 },
  nodes: [origem, destino, parede], sourceNodeId: 'src', targetNodeId: 'dst',
});
check('obstaculo freia o arraste antes de entrar na forma', freado[1].y > 150 && freado[1].y < 200, `y final ${Math.round(freado[1].y)}`);

// 3. rota que ja nascia por cima de uma forma (comum em diagrama gerado por IA)
const atravessada = no('atravessada', 60, 100);
const antes = validateManualEdgeRoute(rota, [origem, destino, atravessada], 'src', 'dst');
check('rota de partida realmente colidia', antes.valid === false, antes.reason);
const aindaMove = clampSegmentMovement({
  startPoints: rota, segIndex: 1, dir: 'horiz', delta: { x: 0, y: 90 },
  nodes: [origem, destino, atravessada], sourceNodeId: 'src', targetNodeId: 'dst',
});
check('arraste funciona mesmo com a rota ja colidindo', Math.abs(aindaMove[1].y - 240) < 1, `y 150 -> ${aindaMove[1].y}`);
check('antes da correcao isso voltava ao inicio', aindaMove[1].y !== 150);

// 4. rota resultante continua ortogonal (criterio que ainda desfaz o arraste)
const orto = validateManualEdgeRoute(aindaMove, [origem, destino], 'src', 'dst');
check('rota ajustada segue ortogonal', !/orthogonal/i.test(orto.reason || ''), orto.reason || 'valida');

console.log(R.join('\n'));
