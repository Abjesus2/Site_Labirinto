import { clearTransientFlags } from '../.tmp-transientFlags.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const a = { id: 'a', position: { x: 0, y: 0 } };
const b = { id: 'b', position: { x: 0, y: 0 }, dragging: true, selected: true };
const c = { id: 'c', position: { x: 0, y: 0 }, resizing: true };
const d = { id: 'd', position: { x: 0, y: 0 }, dragging: false };

const limpo = clearTransientFlags([a, b, c, d]);
check('forma que ficou "arrastando" (histórico/salvo) volta sem a marca', !('dragging' in limpo[1]) && limpo[1].selected === true);
check('marca de "redimensionando" também sai', !('resizing' in limpo[2]));
check('formas sem marca continuam o mesmo objeto', limpo[0] === a && limpo[3] === d);
const semNada = [a, d];
check('lista sem marcas volta a mesma lista (nada recriado)', clearTransientFlags(semNada) === semNada);
check('lista vazia', clearTransientFlags([]).length === 0);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
