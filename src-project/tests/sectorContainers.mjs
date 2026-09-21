import { buildSectorContainers, normalizeContainerZIndex, CONTAINER_BASE_Z_INDEX } from '../.tmp-sectorContainers.mjs';

const R = [];
const check = (n, ok, extra = '') => R.push(`${ok ? 'OK  ' : 'FALHA'} | ${n}${extra ? ' -> ' + extra : ''}`);

const proc = (id, x, y, dept) => ({
  id, type: 'process', position: { x, y },
  data: { label: id, timing: { department: dept } },
});

// 1. buildSectorContainers grava zIndex no lugar certo (topo do nó), não
//    dentro de "style" — é o que o React Flow realmente lê para decidir
//    quem fica na frente. Usa CONTAINER_BASE_Z_INDEX (-100), bem abaixo das
//    arestas padrão (-1..1000), não só -1 (que empatava com arestas padrão
//    e perdia a disputa de ordem no DOM).
{
  const nodes = [
    proc('a1', 0, 0, 'Vendas'),
    proc('a2', 0, 100, 'Vendas'),
    proc('b1', 0, 300, 'Financeiro'),
  ];
  const result = buildSectorContainers(nodes, 'TB');
  const container = result.find((n) => n.type === 'swimlane' || n.type === 'frame');
  check('CONTAINER_BASE_Z_INDEX é -100 (bem abaixo de arestas -1..1000)', CONTAINER_BASE_Z_INDEX === -100);
  check('container gerado tem zIndex de topo CONTAINER_BASE_Z_INDEX', container?.zIndex === CONTAINER_BASE_Z_INDEX, JSON.stringify(container?.zIndex));
  check('container gerado NÃO tem zIndex dentro de style', container?.style?.zIndex === undefined);
}

// 2. normalizeContainerZIndex corrige uma raia salva do jeito antigo
//    (zIndex preso dentro de style, sem a propriedade de topo, ou com o
//    valor -1 antigo insuficiente).
{
  const nodesAntigos = [
    { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 800, height: 200, zIndex: -1 }, data: { label: 'Atendimento' } },
    { id: 'lane2', type: 'swimlane', position: { x: 0, y: 0 }, zIndex: -1, style: { width: 800, height: 200 }, data: { label: 'Financeiro' } },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: { label: 'Processo' } },
  ];
  const corrigidos = normalizeContainerZIndex(nodesAntigos);
  const lane = corrigidos.find((n) => n.id === 'lane1');
  const lane2 = corrigidos.find((n) => n.id === 'lane2');
  check('raia antiga (zIndex só em style) ganha zIndex de topo CONTAINER_BASE_Z_INDEX', lane.zIndex === CONTAINER_BASE_Z_INDEX);
  check('raia antiga perde o zIndex de dentro de style', lane.style.zIndex === undefined);
  check('tamanho da raia (width/height) continua intacto', lane.style.width === 800 && lane.style.height === 200);
  check('raia com zIndex de topo -1 antigo é elevada para CONTAINER_BASE_Z_INDEX', lane2.zIndex === CONTAINER_BASE_Z_INDEX);
  check('nó que não é raia/quadro não é mexido', corrigidos.find((n) => n.id === 'n1').zIndex === undefined);
}

// 3. Idempotente: já normalizado, não recria o objeto (nem quebra)
{
  const jaOk = [{ id: 'f1', type: 'frame', position: { x: 0, y: 0 }, zIndex: CONTAINER_BASE_Z_INDEX, style: { width: 100, height: 100 }, data: {} }];
  const outra = normalizeContainerZIndex(jaOk);
  check('raia já correta passa direto (mesma referência)', outra[0] === jaOk[0]);
}

// 4. Setores sequenciais (viram raia) continuam com largura/posição cheias
//    do fluxo, idênticas entre si no eixo perpendicular — já eram assim.
{
  const nodes = [
    proc('a1', 0, 0, 'Vendas'),
    proc('a2', 200, 0, 'Vendas'),
    proc('b1', 0, 300, 'Financeiro'),
    proc('b2', 400, 300, 'Financeiro'),
  ];
  const result = buildSectorContainers(nodes, 'TB');
  const lanes = result.filter((n) => n.type === 'swimlane');
  check('setores sequenciais viram 2 raias', lanes.length === 2);
  check('raias sequenciais têm a mesma largura (largura cheia do fluxo)', lanes[0]?.style?.width === lanes[1]?.style?.width, `${lanes[0]?.style?.width} vs ${lanes[1]?.style?.width}`);
  check('raias sequenciais começam no mesmo X (alinhadas à esquerda)', lanes[0]?.position?.x === lanes[1]?.position?.x);
}

// 5. Setores intercalados (viram quadro) ganham a MESMA largura/altura no
//    eixo perpendicular ao fluxo (a do maior setor), centralizada sobre o
//    próprio conteúdo — para não ficar um quadro maior que outro só porque
//    um setor tem uma etapa a mais, sem colidir no eixo do fluxo.
{
  const nodes = [
    // Vendas: 2 nós, sobrepõe Financeiro no eixo Y (intercalado -> quadro)
    proc('a1', 0, 0, 'Vendas'),
    proc('a2', 0, 100, 'Vendas'),
    // Financeiro: 1 nó só, span menor no eixo X (cross axis para TB)
    proc('b1', 500, 50, 'Financeiro'),
  ];
  const result = buildSectorContainers(nodes, 'TB');
  const frames = result.filter((n) => n.type === 'frame');
  check('setores intercalados viram 2 quadros', frames.length === 2);
  check('quadros intercalados têm a mesma largura (maxCrossSpan uniforme)', frames[0]?.style?.width === frames[1]?.style?.width, `${frames[0]?.style?.width} vs ${frames[1]?.style?.width}`);
  const frameB = frames.find((f) => f.data?.label === 'Financeiro');
  const nodeBCenterX = 500 + 210 / 2; // 210 = largura padrão do tipo "process" (getNodeDimensions)
  const frameBCenterX = frameB.position.x + frameB.style.width / 2;
  check('quadro do setor menor fica centralizado sobre o próprio conteúdo', Math.abs(frameBCenterX - nodeBCenterX) < 1, `${frameBCenterX} vs ${nodeBCenterX}`);
}

console.log(R.join('\n'));
