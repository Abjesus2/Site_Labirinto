import { planMove, invalidMoveTargets, folderDescendants, folderTree } from '../.tmp-moveItems.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// Início > A > B > C ; Início > D
const pastas = [
  { id: 'A', name: 'Armazém', parentId: null }, { id: 'B', name: 'Box', parentId: 'A' },
  { id: 'C', name: 'Caixa', parentId: 'B' }, { id: 'D', name: 'Doca', parentId: null },
];
const fluxos = [
  { id: 'f1', folderId: null }, { id: 'f2', folderId: 'A' }, { id: 'f3', folderId: 'B' }, { id: 'f4', folderId: 'C' },
];

check('subpastas de A (todas as gerações)', [...folderDescendants(pastas, 'A')].sort().join() === 'B,C');
check('não pode mover A para dentro dela mesma nem das subpastas', [...invalidMoveTargets(pastas, ['A'])].sort().join() === 'A,B,C');
check('mover A para dentro de C é recusado', planMove(fluxos, pastas, [], ['A'], 'C') === null);
check('mover A para ela mesma é recusado', planMove(fluxos, pastas, [], ['A'], 'A') === null);
check('destino inexistente é recusado', planMove(fluxos, pastas, ['f1'], [], 'zzz') === null);

const p1 = planMove(fluxos, pastas, [], ['B'], 'D');
check('mover pasta B para D: só a pasta muda (o conteúdo vai junto)', JSON.stringify(p1) === JSON.stringify({ diagrams: [], folders: [{ id: 'B', parentId: 'D' }] }));
// Depois de aplicar, o conteúdo de B continua dentro de B (e C também).
const aplicado = pastas.map((f) => (f.id === 'B' ? { ...f, parentId: 'D' } : f));
check('conteúdo da pasta movida continua dentro dela', [...folderDescendants(aplicado, 'D')].sort().join() === 'B,C' && fluxos.find((f) => f.id === 'f3').folderId === 'B');

const p2 = planMove(fluxos, pastas, ['f1'], [], 'A');
check('mover fluxo do início para a pasta A', JSON.stringify(p2.diagrams) === JSON.stringify([{ id: 'f1', folderId: 'A' }]));
const p3 = planMove(fluxos, pastas, ['f4'], [], null);
check('mover fluxo para o início', JSON.stringify(p3.diagrams) === JSON.stringify([{ id: 'f4', folderId: null }]));

const p4 = planMove(fluxos, pastas, ['f3', 'f1'], ['A', 'B'], 'D');
check('itens dentro de pasta selecionada vão junto (não se soltam dela)', JSON.stringify(p4) === JSON.stringify({ diagrams: [{ id: 'f1', folderId: 'D' }], folders: [{ id: 'A', parentId: 'D' }] }), JSON.stringify(p4));
const p5 = planMove(fluxos, pastas, ['f2'], [], 'A');
check('mover para onde já está não muda nada', p5.diagrams.length === 0 && p5.folders.length === 0);

const arvore = folderTree(pastas).map(({ folder, depth }) => `${'-'.repeat(depth)}${folder.id}`).join(' ');
check('árvore de pastas para escolher o destino', arvore === 'A -B --C D', arvore);
const ciclo = folderTree([{ id: 'X', name: 'x', parentId: 'Y' }, { id: 'Y', name: 'y', parentId: 'X' }]);
check('pastas em ciclo não travam a árvore', ciclo.length === 2);

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
