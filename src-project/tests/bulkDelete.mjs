import { planBulkDelete, describeSelection } from '../.tmp-bulkDelete.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

// Raiz > A > B > C ; Raiz > D
const pastas = [
  { id: 'A', parentId: null }, { id: 'B', parentId: 'A' }, { id: 'C', parentId: 'B' }, { id: 'D', parentId: null },
];
const fluxos = [
  { id: 'f1', folderId: null }, { id: 'f2', folderId: 'A' }, { id: 'f3', folderId: 'B' }, { id: 'f4', folderId: 'C' }, { id: 'f5', folderId: 'D' },
];

const p1 = planBulkDelete(fluxos, pastas, ['f1', 'f5'], []);
check('exclui só os fluxos selecionados', p1.diagramIds.join() === 'f1,f5' && !p1.folderIds.length && !p1.movedDiagrams.length && !p1.movedFolders.length);

const p2 = planBulkDelete(fluxos, pastas, [], ['B']);
check('pasta excluída: fluxo de dentro sobe para a pasta de cima', JSON.stringify(p2.movedDiagrams) === JSON.stringify([{ id: 'f3', folderId: 'A' }]));
check('pasta excluída: subpasta sobe para a pasta de cima', JSON.stringify(p2.movedFolders) === JSON.stringify([{ id: 'C', parentId: 'A' }]));

const p3 = planBulkDelete(fluxos, pastas, [], ['A', 'B']);
check('pastas encadeadas excluídas: conteúdo sobe até a primeira que sobra (início)', JSON.stringify(p3.movedDiagrams) === JSON.stringify([{ id: 'f2', folderId: null }, { id: 'f3', folderId: null }]) && JSON.stringify(p3.movedFolders) === JSON.stringify([{ id: 'C', parentId: null }]));

const p4 = planBulkDelete(fluxos, pastas, ['f3'], ['B']);
check('fluxo selecionado dentro da pasta excluída é apagado (não movido)', p4.diagramIds.join() === 'f3' && !p4.movedDiagrams.some((m) => m.id === 'f3'));

const p5 = planBulkDelete(fluxos, pastas, ['f1', 'f2', 'f3', 'f4', 'f5'], ['A', 'B', 'C', 'D']);
check('selecionar tudo: apaga tudo sem mover nada', p5.diagramIds.length === 5 && p5.folderIds.length === 4 && !p5.movedDiagrams.length && !p5.movedFolders.length);

const ciclo = [{ id: 'X', parentId: 'Y' }, { id: 'Y', parentId: 'X' }, { id: 'Z', parentId: 'X' }];
const p6 = planBulkDelete([{ id: 'g', folderId: 'X' }], ciclo, [], ['X', 'Y']);
check('pastas com ciclo não travam', p6.movedDiagrams[0].folderId === null && p6.movedFolders[0].parentId === null);

check('ids inexistentes são ignorados', planBulkDelete(fluxos, pastas, ['nao-existe'], ['nem-essa']).diagramIds.length === 0);
check('descrição da seleção', describeSelection(2, 1) === '2 fluxos e 1 pasta' && describeSelection(1, 0) === '1 fluxo' && describeSelection(0, 3) === '3 pastas');

console.log(R.join('\n'));
process.exit(R.some((l) => l.startsWith('FALHA')) ? 1 : 0);
