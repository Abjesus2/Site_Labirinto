import { buildSectorContainers, normalizeContainerZIndex } from '../.tmp-sectorContainers.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const proc = (id, x, y, dept) => ({
  id, type: 'process', position: { x, y },
  data: { label: id, timing: { department: dept } },
});

// 1. buildSectorContainers grava zIndex no lugar certo (topo do nó), não
//    dentro de "style" — é o que o React Flow realmente lê para decidir
//    quem fica na frente.
{
  const nodes = [
    proc('a1', 0, 0, 'Vendas'),
    proc('a2', 0, 100, 'Vendas'),
    proc('b1', 0, 300, 'Financeiro'),
  ];
  const result = buildSectorContainers(nodes, 'TB');
  const container = result.find((n) => n.type === 'swimlane' || n.type === 'frame');
  check('container gerado tem zIndex de topo -1', container?.zIndex === -1, JSON.stringify(container?.zIndex));
  check('container gerado NÃO tem zIndex dentro de style', container?.style?.zIndex === undefined);
}

// 2. normalizeContainerZIndex corrige uma raia salva do jeito antigo
//    (zIndex preso dentro de style, sem a propriedade de topo).
{
  const nodesAntigos = [
    { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 800, height: 200, zIndex: -1 }, data: { label: 'Atendimento' } },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: { label: 'Processo' } },
  ];
  const corrigidos = normalizeContainerZIndex(nodesAntigos);
  const lane = corrigidos.find((n) => n.id === 'lane1');
  check('raia antiga ganha zIndex de topo -1', lane.zIndex === -1);
  check('raia antiga perde o zIndex de dentro de style', lane.style.zIndex === undefined);
  check('tamanho da raia (width/height) continua intacto', lane.style.width === 800 && lane.style.height === 200);
  check('nó que não é raia/quadro não é mexido', corrigidos.find((n) => n.id === 'n1').zIndex === undefined);
}

// 3. Idempotente: já normalizado, não recria o objeto (nem quebra)
{
  const jaOk = [{ id: 'f1', type: 'frame', position: { x: 0, y: 0 }, zIndex: -1, style: { width: 100, height: 100 }, data: {} }];
  const outra = normalizeContainerZIndex(jaOk);
  check('raia já correta passa direto (mesma referência)', outra[0] === jaOk[0]);
}

console.log(R.join('\n'));
