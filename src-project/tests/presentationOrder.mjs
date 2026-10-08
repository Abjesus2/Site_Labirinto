import { presentationOrder } from '../.tmp-presentationOrder.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);
const no = (id, type, x, y, parentId) => ({ id, type, position: { x, y }, ...(parentId ? { parentId } : {}) });
const ed = (source, target, label = '') => ({ source, target, label });

// Criadas fora de ordem: a apresentação segue as setas a partir do Início.
const nodes = [no('fim', 'end', 0, 600), no('b', 'process', 0, 300), no('ini', 'start', 0, 0), no('d', 'decision', 0, 150), no('ajuste', 'process', 300, 300)];
const edges = [ed('ini', 'd'), ed('d', 'ajuste', 'Não'), ed('d', 'b', 'Sim'), ed('b', 'fim'), ed('ajuste', 'd')];
const o = presentationOrder(nodes, edges);
check('segue as setas a partir do Início', o[0] === 'ini' && o[1] === 'd', o.join(','));
check('na decisão, a saída principal ("Sim") antes da negativa', o.indexOf('b') < o.indexOf('ajuste'), o.join(','));
check('toda forma aparece uma vez (volta para a decisão não repete)', o.length === 5 && new Set(o).size === 5);

// Raias e junções não são etapas; formas dentro de raia usam posição absoluta.
const n2 = [
  no('raiaA', 'swimlane', 0, 0), no('raiaB', 'swimlane', 0, 500),
  no('x', 'process', 50, 50, 'raiaB'), no('y', 'process', 50, 50, 'raiaA'),
  no('j', 'junction', 0, 0),
  no('nota', 'sticky', 900, 0),
];
const o2 = presentationOrder(n2, []);
check('raias e junções ficam de fora', !o2.includes('raiaA') && !o2.includes('raiaB') && !o2.includes('j'), o2.join(','));
check('sem ligações: ordem pela posição real (dentro das raias)', o2.indexOf('y') < o2.indexOf('x'), o2.join(','));

// Junção no meio do caminho é atravessada (não interrompe a ordem).
const n3 = [no('s', 'start', 0, 0), no('j', 'junction', 0, 100), no('p', 'process', 0, 200), no('q', 'process', 300, 50)];
const o3 = presentationOrder(n3, [ed('s', 'j'), ed('j', 'p')]);
check('atravessa a junção e deixa a forma solta para o fim', o3.join(',') === 's,p,q', o3.join(','));

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
