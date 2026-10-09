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
// "Não" que volta para trás: os caminhos se reencontram logo no "Sim" — mostra
// o desvio (ajuste) e depois segue pelo caminho principal.
check('desvio que volta (laço) aparece logo após a pergunta, e depois segue o principal', o.join(',') === 'ini,d,ajuste,b,fim', o.join(','));
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

// Bifurcação com encontro: um lado inteiro até o encontro, depois o outro,
// depois continua do encontro.
//        ini -> d1 --Sim--> s1 -> s2 --\
//                  \--Não--> n1 -> n2 -> n3 --> m -> fim
const g1 = [no('ini', 'start', 0, 0), no('d1', 'decision', 0, 100), no('s1', 'process', -200, 200), no('s2', 'process', -200, 300),
  no('n1', 'process', 200, 200), no('n2', 'process', 200, 300), no('n3', 'process', 200, 400), no('m', 'process', 0, 500), no('fim', 'end', 0, 600)];
const e1 = [ed('ini', 'd1'), ed('d1', 's1', 'Sim'), ed('d1', 'n1', 'Não'), ed('s1', 's2'), ed('s2', 'm'), ed('n1', 'n2'), ed('n2', 'n3'), ed('n3', 'm'), ed('m', 'fim')];
const o4 = presentationOrder(g1, e1);
check('segue um lado até o encontro, depois o outro, depois o encontro', o4.join(',') === 'ini,d1,s1,s2,n1,n2,n3,m,fim', o4.join(','));

// Pergunta dentro de pergunta: o lado de dentro termina no encontro de dentro.
//   d1 Sim -> d2 (Sim -> a ; Não -> b) -> j -> m ;  d1 Não -> c -> m
const g2 = [no('ini', 'start', 0, 0), no('d1', 'decision', 0, 100), no('d2', 'decision', -200, 200), no('a', 'process', -300, 300), no('b', 'process', -100, 300),
  no('j', 'process', -200, 400), no('c', 'process', 200, 250), no('m', 'process', 0, 500), no('fim', 'end', 0, 600)];
const e2 = [ed('ini', 'd1'), ed('d1', 'd2', 'Sim'), ed('d1', 'c', 'Não'), ed('d2', 'a', 'Sim'), ed('d2', 'b', 'Não'), ed('a', 'j'), ed('b', 'j'), ed('j', 'm'), ed('c', 'm'), ed('m', 'fim')];
const o5 = presentationOrder(g2, e2);
check('pergunta dentro de pergunta respeita os dois encontros', o5.join(',') === 'ini,d1,d2,a,b,j,c,m,fim', o5.join(','));

// Lados que nunca se reencontram: um lado inteiro (até o fim dele), depois o outro.
const g3 = [no('ini', 'start', 0, 0), no('d', 'decision', 0, 100), no('x1', 'process', -200, 200), no('fx', 'end', -200, 300), no('y1', 'process', 200, 200), no('y2', 'process', 200, 300), no('fy', 'end', 200, 400)];
const e3 = [ed('ini', 'd'), ed('d', 'x1', 'Sim'), ed('d', 'y1', 'Não'), ed('x1', 'fx'), ed('y1', 'y2'), ed('y2', 'fy')];
const o6 = presentationOrder(g3, e3);
check('sem encontro: um lado inteiro e depois o outro', o6.join(',') === 'ini,d,x1,fx,y1,y2,fy', o6.join(','));

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
