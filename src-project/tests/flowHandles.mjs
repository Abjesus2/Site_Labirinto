import { assignFlowHandles } from '../.tmp-flowHandles.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);
const size = (n) => (n.type === 'decision' ? { width: 120, height: 120 } : { width: 210, height: 70 });
const no = (id, type, x, y) => ({ id, type, position: { x, y } });
const ed = (id, source, target, label = '') => ({ id, source, target, label, sourceHandle: 'bottom', targetHandle: 'top', data: {} });

// Etapa -> decisão; "Sim" segue para baixo; "Não" volta para a etapa de cima.
const nodes = [no('a', 'process', 0, 0), no('d', 'decision', 45, 150), no('b', 'process', 0, 350)];
const edges = [ed('e1', 'a', 'd'), ed('e2', 'd', 'b', 'Sim'), ed('e3', 'd', 'a', 'Não')];
const r = Object.fromEntries(assignFlowHandles(nodes, edges, size).map((e) => [e.id, e]));
check('linha que chega na decisão: base -> topo', r.e1.sourceHandle === 'bottom' && r.e1.targetHandle === 'top');
check('"Sim" para baixo sai pela base', r.e2.sourceHandle === 'bottom' && r.e2.targetHandle === 'top');
check('"Não" que volta para cima sai e entra pela LATERAL (não por cima da linha que chega)', ['right', 'left'].includes(r.e3.sourceHandle) && r.e3.targetHandle === r.e3.sourceHandle, `${r.e3.sourceHandle}->${r.e3.targetHandle}`);
check('as duas saídas da decisão em pontos diferentes', r.e2.sourceHandle !== r.e3.sourceHandle);

// Duas saídas para baixo, ambas alinhadas: não podem sair as duas pela base.
const n2 = [no('d', 'decision', 45, 0), no('x', 'process', 0, 200), no('y', 'process', 0, 400)];
const r2 = assignFlowHandles(n2, [ed('s', 'd', 'x', 'Sim'), ed('n', 'd', 'y', 'Talvez')], size);
check('duas saídas para baixo alinhadas: uma pela base, outra pela lateral', new Set(r2.map((e) => e.sourceHandle)).size === 2 && r2.some((e) => e.sourceHandle === 'bottom'), r2.map((e) => e.sourceHandle).join(','));

// Três saídas: base, direita e esquerda.
const n3 = [no('d', 'decision', 245, 0), no('x', 'process', 200, 200), no('y', 'process', 500, 200), no('z', 'process', -100, 200)];
const r3 = assignFlowHandles(n3, [ed('1', 'd', 'x', 'Sim'), ed('2', 'd', 'y', 'Não'), ed('3', 'd', 'z', 'Parcial')], size);
check('três saídas em três pontos diferentes', new Set(r3.map((e) => e.sourceHandle)).size === 3, r3.map((e) => e.sourceHandle).join(','));

// Linha ajustada à mão não é tocada.
const manual = { ...ed('m', 'a', 'b'), sourceHandle: 'left', targetHandle: 'left', data: { manualRouting: true } };
check('linha ajustada à mão fica como está', assignFlowHandles(nodes, [manual], size)[0].sourceHandle === 'left');

// Tipo automático é sempre Suave (sai reto quando alinhado); "Reta" só se a
// pessoa escolheu no painel (data.userEdgeType).
const alinh = [no('p', 'process', 0, 0), no('q', 'process', 0, 200)];
const auto = assignFlowHandles(alinh, [{ ...ed('r1', 'p', 'q'), type: 'straight' }], size)[0];
check('linha alinhada automática fica Suave (não Reta)', auto.type === 'smoothstep', auto.type);
const escolhida = assignFlowHandles(alinh, [{ ...ed('r2', 'p', 'q'), type: 'straight', data: { userEdgeType: true } }], size)[0];
check('Reta escolhida pela pessoa é mantida', escolhida.type === 'straight', escolhida.type);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
