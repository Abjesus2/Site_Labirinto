import { splitIndependentProcesses, placeSideBySide } from '../.tmp-processSplit.mjs';
import { ensureConnectedGraph } from '../.tmp-graphSanitizer.mjs';
import { normalizeVersions, guessTargetVersion, FIXED_VERSIONS } from '../.tmp-fixedVersions.mjs';
import { readImportFile } from '../.tmp-importVersions.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const no = (id, type, process = '') => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, process } });
const ed = (source, target) => ({ id: `${source}-${target}`, source, target });

// Dois processos com certeza: todas as etapas marcadas, início e fim próprios, sem ligação entre eles.
const certo = [no('r1', 'start', 'Recebimento'), no('r2', 'process', 'Recebimento'), no('r3', 'end', 'Recebimento'),
  no('x1', 'start', 'Expedição'), no('x2', 'process', 'Expedição'), no('x3', 'end', 'Expedição')];
const ligCerto = [ed('r1', 'r2'), ed('r2', 'r3'), ed('x1', 'x2'), ed('x2', 'x3')];
const s1 = splitIndependentProcesses(certo, ligCerto);
check('processos diferentes com certeza: separa', s1.certain && s1.groups.length === 2 && s1.groups.map((g) => g.name).join() === 'Recebimento,Expedição');
check('cada processo leva só as suas ligações', s1.groups[0].edges.length === 2 && s1.groups[1].edges.length === 2);

// Dúvida 1: uma etapa sem marca.
const semMarca = certo.map((n) => (n.id === 'x2' ? no('x2', 'process', '') : n));
check('etapa sem processo marcado: não separa', !splitIndependentProcesses(semMarca, ligCerto).certain);
// Dúvida 2: ligação de um processo para o outro.
check('ligação entre os processos: não separa', !splitIndependentProcesses(certo, [...ligCerto, ed('r3', 'x1')]).certain);
// Dúvida 3: processo sem fim próprio.
const semFim = certo.filter((n) => n.id !== 'x3');
check('processo sem fim próprio: não separa', !splitIndependentProcesses(semFim, [ed('r1', 'r2'), ed('r2', 'r3'), ed('x1', 'x2')]).certain);
// Um processo só (sem marcas).
check('sem marcas: um processo só', !splitIndependentProcesses(certo.map((n) => no(n.id, n.type)), ligCerto).certain);
check('mesmo nome com maiúsculas/espaços diferentes: um processo só', !splitIndependentProcesses(
  [no('a', 'start', 'Recebimento'), no('b', 'end', ' recebimento ')], [ed('a', 'b')]).certain);

// Na dúvida, os blocos soltos são ligados com a linha vermelha de validação.
const duvida = ensureConnectedGraph(semMarca, ligCerto);
const vermelhas = duvida.edges.filter((e) => e.data?.isDubious);
check('na dúvida: liga os blocos com linha vermelha para validar', vermelhas.length >= 1 && vermelhas.some((e) => e.target === 'x1'), vermelhas.map((e) => `${e.source}->${e.target}`).join(' '));
check('fim nunca ganha saída vermelha para outro fim', !duvida.edges.some((e) => e.source === 'x3' && e.target === 'r3'));

// Lado a lado: blocos não se sobrepõem e ficam alinhados pelo topo.
const blocoA = [{ id: 'a', position: { x: 50, y: 30 } }, { id: 'b', position: { x: 50, y: 200 } }];
const blocoB = [{ id: 'c', position: { x: 10, y: 90 } }, { id: 'd', position: { x: 300, y: 90 } }];
const lado = placeSideBySide([blocoA, blocoB], () => ({ w: 200, h: 80 }), 200);
const pos = Object.fromEntries(lado.map((n) => [n.id, n.position]));
check('lado a lado: primeiro bloco começa no 0,0', pos.a.x === 0 && pos.a.y === 0 && pos.b.y === 170);
check('lado a lado: segundo bloco à direita, com espaço, alinhado no topo', pos.c.x === 400 && pos.c.y === 0 && pos.d.x === 690, JSON.stringify(pos));

// Versões fixas.
check('só três versões fixas', FIXED_VERSIONS.join() === 'simples,normal,detalhado');
check('nome antigo aponta para a versão fixa certa', guessTargetVersion('Detalhado (V2) - Simples') === 'simples' && guessTargetVersion('Detalhado (V2) - Detalhado') === 'detalhado' && guessTargetVersion('normal (v2)') === 'normal' && guessTargetVersion('Revisão IA') === 'normal');
const cheio = { nodes: [no('a', 'start')], edges: [] };
const vazio = { nodes: [], edges: [] };
const nv = normalizeVersions({ simples: vazio, normal: cheio, detalhado: cheio, 'Detalhado (V2) - Simples': cheio, 'Detalhado (V2) - Detalhado': cheio, 'Detalhado (V2) - Normal': vazio });
check('extra com a versão fixa vazia: vai sozinha para ela', nv.moved.length === 1 && nv.moved[0].to === 'simples' && nv.versions.simples.nodes.length === 1 && !('Detalhado (V2) - Simples' in nv.versions));
check('extra vazia é removida', nv.droppedEmpty.join() === 'Detalhado (V2) - Normal' && !('Detalhado (V2) - Normal' in nv.versions));
check('extra com a versão fixa ocupada: fica para o usuário decidir', nv.extras.join() === 'Detalhado (V2) - Detalhado' && 'Detalhado (V2) - Detalhado' in nv.versions);
check('versões fixas não mudam', nv.versions.normal === cheio && nv.versions.detalhado === cheio);

// Importar arquivo com versões antigas: vão para as fixas.
const arq = readImportFile({ versions: { 'normal (v2)': cheio, simples: cheio } }, 'normal');
check('importar: versão antiga vai para a versão fixa correspondente', arq.sources.find((s) => s.name === 'normal (v2)').target === 'normal' && arq.sources.find((s) => s.name === 'simples').target === 'simples');

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
