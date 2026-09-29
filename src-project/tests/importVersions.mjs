import { readImportFile, applyImport, existingCount } from '../.tmp-importVersions.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const no = (id, x = 0, y = 0) => ({ id, type: 'process', position: { x, y }, data: { label: id } });
const arquivo = {
  title: 'Recebimento',
  versions: {
    simples: { nodes: [no('s1'), no('s2', 0, 100)], edges: [{ id: 'es', source: 's1', target: 's2' }] },
    normal: { nodes: [no('n1'), no('n2', 0, 100), no('n3', 0, 200)], edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }] },
    detalhado: { nodes: [], edges: [] },
  },
};

const lido = readImportFile(arquivo, 'normal');
check('lê as versões do arquivo (ignora as vazias)', lido.sources.map((s) => s.name).join() === 'simples,normal' && lido.title === 'Recebimento');
check('cada versão vai para a versão de mesmo nome', lido.sources.every((s) => s.target === s.name));
const recorte = readImportFile({ nodes: [no('a')], edges: [] }, 'detalhado');
check('arquivo só com formas vai para a versão aberta', recorte.sources.length === 1 && recorte.sources[0].target === 'detalhado');
check('arquivo sem formas é recusado', readImportFile({ versions: { normal: { nodes: [], edges: [] } } }, 'normal') === null && readImportFile({ foo: 1 }, 'normal') === null);

// Diagrama atual: "normal" já tem 2 etapas; "simples" vazia.
const atual = { normal: { nodes: [no('x1', 0, 0), no('x2', 0, 150)], edges: [{ id: 'ex', source: 'x1', target: 'x2' }] }, simples: { nodes: [], edges: [] } };
check('conta o que já existe em cada versão', existingCount(atual, 'normal') === 2 && existingCount(atual, 'simples') === 0 && existingCount(atual, 'detalhado') === 0);

const [srcSimples, srcNormal] = lido.sources;
const sub = applyImport(atual, [{ source: srcNormal, mode: 'substituir' }]);
check('substituir troca o conteúdo da versão', sub.normal.nodes.map((n) => n.id).join() === 'n1,n2,n3' && sub.normal.edges.length === 2);
check('outras versões ficam intactas', sub.simples === atual.simples);

const acr = applyImport(atual, [{ source: srcNormal, mode: 'acrescentar' }]);
const ids = acr.normal.nodes.map((n) => n.id);
check('acrescentar mantém o que existia e junta o novo', acr.normal.nodes.length === 5 && ids.includes('x1') && ids.includes('x2') && acr.normal.edges.length === 3);
check('acrescentar gera IDs novos (nada sobrescrito)', new Set(ids).size === 5 && !ids.includes('n1'));
const novos = acr.normal.nodes.filter((n) => !n.id.startsWith('x'));
const idsNovos = new Set(novos.map((n) => n.id));
check('ligações novas apontam para as formas novas', acr.normal.edges.filter((e) => e.id !== 'ex').every((e) => idsNovos.has(e.source) && idsNovos.has(e.target)));
check('o acrescentado fica ao lado (sem ficar por cima)', novos.every((n) => n.position.x > 100));
check('nada fica selecionado depois de importar', acr.normal.nodes.every((n) => !n.selected));

const varias = applyImport(atual, [{ source: srcSimples, mode: 'acrescentar' }, { source: srcNormal, mode: 'substituir' }]);
check('várias versões de uma vez (vazia recebe como está)', varias.simples.nodes.map((n) => n.id).join() === 's1,s2' && varias.normal.nodes.map((n) => n.id).join() === 'n1,n2,n3');
const nova = applyImport({}, [{ source: srcSimples, mode: 'acrescentar' }]);
check('versão que não existia é criada', nova.simples.nodes.length === 2);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
