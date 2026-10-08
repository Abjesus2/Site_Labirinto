import { createVersionChangeTracker, flowSignature } from '../.tmp-versionChangeTracker.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const no = (id, x, extra = {}) => ({ id, position: { x, y: 0 }, data: { label: id }, ...extra });
const guardado = { simples: { nodes: [no('a', 0)], edges: [] }, normal: { nodes: [no('b', 0)], edges: [] } };

let chamadas = 0;
const contar = (v) => { chamadas++; return flowSignature(v); };
const mudou = createVersionChangeTracker(contar);

const simples = JSON.parse(JSON.stringify(guardado.simples));
check('mesmo conteúdo do que estava guardado não conta como mudança', mudou(guardado, { simples, normal: { nodes: [no('b', 0)], edges: [] } }) === false);
check('só seleção/arraste/medida não conta', mudou(guardado, { simples, normal: { nodes: [no('b', 0, { selected: true, dragging: true, measured: { width: 9 } })], edges: [] } }) === false);
check('mover uma forma conta', mudou(guardado, { simples, normal: { nodes: [no('b', 50)], edges: [] } }) === true);
check('salvar de novo igual não conta', mudou(guardado, { simples, normal: { nodes: [no('b', 50)], edges: [] } }) === false);
chamadas = 0;
mudou(guardado, { simples, normal: { nodes: [no('b', 60)], edges: [] } });
check('versão que é o mesmo objeto não é reprocessada (só a aberta)', chamadas === 1, `${chamadas} assinatura(s)`);
check('versão nova conta', mudou(guardado, { simples, normal: { nodes: [no('b', 60)], edges: [] }, detalhado: { nodes: [no('c', 0)], edges: [] } }) === true);
check('versão removida conta', mudou(guardado, { simples, normal: { nodes: [no('b', 60)], edges: [] } }) === true);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
