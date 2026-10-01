import { normalizeVersions, guessTargetVersion, FIXED_VERSIONS } from '../.tmp-fixedVersions.mjs';
import { readImportFile } from '../.tmp-importVersions.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const no = (id, type) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } });

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
