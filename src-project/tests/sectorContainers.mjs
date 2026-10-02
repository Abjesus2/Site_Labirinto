import { buildSectorContainers, normalizeContainerZIndex, CONTAINER_BASE_Z_INDEX, rebuildAIContainers, fillMissingDepartments, verticalLanesFit, lanesFit, flowDirectionFor, aiLaneOrientation } from '../.tmp-sectorContainers.mjs';

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
  check('setores em sequência também viram raias VERTICAIS (2 colunas)', lanes.length === 2 && lanes.every((l) => l.data.orientation === 'vertical'));
  check('colunas lado a lado, encostadas, mesma altura e mesmo topo', Math.abs(lanes[1].position.x - (lanes[0].position.x + lanes[0].style.width)) < 0.01 && lanes[0].style.height === lanes[1].style.height && lanes[0].position.y === lanes[1].position.y);
  const byId = Object.fromEntries(result.map((n) => [n.id, n]));
  check('cada etapa dentro da coluna do seu setor', ['a1', 'a2', 'b1', 'b2'].every((id) => { const n = byId[id]; const l = lanes.find((x) => x.data.label === n.data.timing.department); return n.position.x >= l.position.x && n.position.x + 210 <= l.position.x + l.style.width; }));
}

// 5. Setores que se alternam ao longo do fluxo (A -> B -> A) viram RAIAS de
//    verdade (não quadros soltos): uma faixa por setor, lado a lado e
//    encostadas, atravessando o fluxo inteiro; cada etapa dentro da sua.
{
  const W = 210, H = 70; // tamanho padrão do tipo "process"
  const nodes = [
    proc('a1', 0, 0, 'Recebimento'),
    proc('b1', 0, 150, 'Estoque'),
    proc('a2', 0, 300, 'Recebimento'),
    proc('c1', 0, 450, 'Financeiro'),
    proc('b2', 260, 450, 'Estoque'), // mesmo nível de c1
  ];
  const result = buildSectorContainers(nodes, 'TB');
  const lanes = result.filter((n) => n.type === 'swimlane');
  check('setores alternados viram raias (não quadros)', lanes.length === 3 && !result.some((n) => n.type === 'frame'), lanes.map((l) => l.data.label).join(','));
  check('raias na ordem em que os setores aparecem', lanes.map((l) => l.data.label).join(',') === 'Recebimento,Estoque,Financeiro');
  check('raias lado a lado, encostadas, com a mesma altura', lanes.every((l, i) => i === 0 || Math.abs(l.position.x - (lanes[i - 1].position.x + lanes[i - 1].style.width)) < 0.01) && lanes.every((l) => l.style.height === lanes[0].style.height && l.position.y === lanes[0].position.y));
  check('raia vertical (título "Raia Vertical")', lanes.every((l) => l.data.orientation === 'vertical' && l.data.generatedByAI === true));
  const byId = Object.fromEntries(result.map((n) => [n.id, n]));
  const dentro = ['a1', 'b1', 'a2', 'c1', 'b2'].every((id) => {
    const n = byId[id];
    const lane = lanes.find((l) => l.data.label === n.data.timing.department);
    return n.position.x >= lane.position.x && n.position.x + W <= lane.position.x + lane.style.width
      && n.position.y >= lane.position.y && n.position.y + H <= lane.position.y + lane.style.height;
  });
  check('cada etapa fica inteira dentro da raia do seu setor', dentro);
  check('ordem no sentido do fluxo não muda (altura das etapas igual)', ['a1', 'b1', 'a2', 'c1', 'b2'].every((id) => byId[id].position.y === nodes.find((n) => n.id === id).position.y));
  check('etapas não se sobrepõem', (() => { const r = ['a1', 'b1', 'a2', 'c1', 'b2'].map((id) => byId[id].position); for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].x < r[j].x + W && r[j].x < r[i].x + W && r[i].y < r[j].y + H && r[j].y < r[i].y + H) return false; return true; })());

  // Fluxo da esquerda para a direita com setores alternados: raias verticais
  // não cabem — o app reorganiza de cima para baixo (verticalLanesFit).
  const alternadoLR = [proc('a1', 0, 0, 'Recebimento'), proc('b1', 300, 0, 'Estoque'), proc('a2', 600, 0, 'Recebimento')];
  check('para a direita com setores alternados: raias verticais não cabem', verticalLanesFit(alternadoLR, 'LR') === false && verticalLanesFit(alternadoLR, 'TB') === true);

  // Fluxo da esquerda para a direita com setores em sequência: faixas
  // VERTICAIS, uma por trecho, encostadas.
  const seqLR = buildSectorContainers([proc('a1', 0, 0, 'Recebimento'), proc('a2', 300, 0, 'Recebimento'), proc('b1', 600, 0, 'Estoque'), proc('b2', 900, 0, 'Estoque')], 'LR');
  const seqLanes = seqLR.filter((n) => n.type === 'swimlane');
  check('para a direita com setores em sequência: raias verticais encostadas', seqLanes.length === 2 && seqLanes.every((l) => l.data.orientation === 'vertical') && Math.abs(seqLanes[1].position.x - (seqLanes[0].position.x + seqLanes[0].style.width)) < 0.01 && seqLanes[0].style.height === seqLanes[1].style.height);
  check('para a direita: etapas não saem do lugar', seqLR.find((n) => n.id === 'b1').position.x === 600 && verticalLanesFit(seqLR, 'LR'));
}

// 5b. Etapa sem setor num fluxo com setores herda o do vizinho.
{
  const nodes = [
    { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Início', timing: {} } },
    proc('a1', 0, 100, 'Recebimento'),
    proc('x', 0, 200, ''),
    proc('b1', 0, 300, 'Estoque'),
    { id: 'e', type: 'end', position: { x: 0, y: 400 }, data: { label: 'Fim', timing: {} } },
  ];
  const edges = [{ source: 's', target: 'a1' }, { source: 'a1', target: 'x' }, { source: 'x', target: 'b1' }, { source: 'b1', target: 'e' }];
  const filled = Object.fromEntries(fillMissingDepartments(nodes, edges).map((n) => [n.id, n.data.timing.department]));
  check('etapa sem setor herda o da anterior', filled.x === 'Recebimento' && filled.e === 'Estoque', JSON.stringify(filled));
  check('início sem setor herda o da etapa seguinte', filled.s === 'Recebimento');
  const umSetor = [proc('a', 0, 0, 'Vendas'), proc('b', 0, 100, '')];
  check('um setor só: nada é preenchido (sem raia)', fillMissingDepartments(umSetor, [{ source: 'a', target: 'b' }]) === umSetor);
}

// 5c. Escolha do usuário: raias HORIZONTAIS.
{
  check('sentido do fluxo combina com a orientação', flowDirectionFor('vertical') === 'TB' && flowDirectionFor('horizontal') === 'LR');
  const alternado = [proc('a1', 0, 0, 'Recebimento'), proc('b1', 300, 0, 'Estoque'), proc('a2', 600, 0, 'Recebimento')];
  const h = buildSectorContainers(alternado, 'LR', 'horizontal');
  const hl = h.filter((n) => n.type === 'swimlane');
  check('horizontais + fluxo para a direita: uma faixa por setor, empilhadas', hl.length === 2 && hl.every((l) => l.data.orientation === 'horizontal') && hl[1].position.y === hl[0].position.y + hl[0].style.height && aiLaneOrientation(h) === 'horizontal');
  const seqTB = buildSectorContainers([proc('a1', 0, 0, 'Vendas'), proc('a2', 0, 150, 'Vendas'), proc('b1', 0, 300, 'Financeiro'), proc('b2', 0, 450, 'Financeiro')], 'TB', 'horizontal');
  const sl = seqTB.filter((n) => n.type === 'swimlane');
  check('horizontais + fluxo para baixo com setores em sequência: faixas horizontais encostadas, etapas no lugar', sl.length === 2 && sl.every((l) => l.data.orientation === 'horizontal') && Math.abs(sl[1].position.y - (sl[0].position.y + sl[0].style.height)) < 0.01 && seqTB.find((n) => n.id === 'b1').position.x === 0);
  const altTB = [proc('a1', 0, 0, 'Vendas'), proc('b1', 0, 150, 'Financeiro'), proc('a2', 0, 300, 'Vendas')];
  check('horizontais não cabem no fluxo para baixo com setores alternados (reorganiza para a direita)', lanesFit(altTB, 'TB', 'horizontal') === false && lanesFit(altTB, 'LR', 'horizontal') === true);
  check('orientação das raias existentes é reconhecida', aiLaneOrientation(buildSectorContainers(altTB, 'TB', 'vertical')) === 'vertical' && aiLaneOrientation([proc('x', 0, 0, 'A')]) === null);
}

// 6. rebuildAIContainers: depois de um "Organizar" (dagre) que reposiciona
//    os nós de processo, a raia gerada pela IA (data.generatedByAI) tem que
//    acompanhar — reconstruída do zero ao redor da posição NOVA dos nós do
//    mesmo departamento, nunca deixada pra trás na posição antiga.
{
  const nodes = [
    { id: 'sector_old_a', type: 'swimlane', position: { x: -999, y: -999 }, style: { width: 50, height: 50 }, zIndex: CONTAINER_BASE_Z_INDEX, data: { label: 'Vendas', generatedByAI: true } },
    { id: 'sector_old_b', type: 'swimlane', position: { x: -999, y: -500 }, style: { width: 50, height: 50 }, zIndex: CONTAINER_BASE_Z_INDEX, data: { label: 'Financeiro', generatedByAI: true } },
    proc('a1', 0, 0, 'Vendas'),
    proc('a2', 200, 0, 'Vendas'),
    proc('b1', 0, 300, 'Financeiro'),
    proc('b2', 400, 300, 'Financeiro'),
  ];
  const result = rebuildAIContainers(nodes, 'TB');
  const lanes = result.filter((n) => n.type === 'swimlane');
  check('as raias antigas (posição/tamanho velhos) são descartadas, não acumulam duplicadas', lanes.length === 2, 'raias encontradas: ' + lanes.length);
  check('a raia reconstruída envolve a posição ATUAL dos nós, não a antiga', lanes.every((l) => l.position.x > -999 && l.position.y > -999), JSON.stringify(lanes.map((l) => l.position)));
  const a1 = result.find((n) => n.id === 'a1');
  const b1 = result.find((n) => n.id === 'b1');
  check('raias reconstruídas continuam verticais', lanes.every((l) => l.data.orientation === 'vertical'));
  check('etapas mantêm a ordem no sentido do fluxo (só vão para a coluna do setor)', a1.position.y === 0 && b1.position.y === 300);
}

// 7. Raia/quadro criada manualmente pelo usuário (sem generatedByAI) nunca é
//    tocada por rebuildAIContainers — controle 100% manual preservado.
{
  const nodes = [
    { id: 'lane_manual', type: 'swimlane', position: { x: 5, y: 5 }, style: { width: 123, height: 45 }, data: { label: 'Minha raia' } },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: {} },
  ];
  const result = rebuildAIContainers(nodes, 'TB');
  check('sem nenhuma raia/quadro gerada pela IA no diagrama, nada muda (mesma referência)', result === nodes);
}

// 8. Sem raia/quadro nenhuma no diagrama, rebuildAIContainers não mexe em nada.
{
  const semContainers = [proc('n1', 10, 10, 'Vendas')];
  check('sem raia/quadro nenhuma, retorna a mesma referência', rebuildAIContainers(semContainers) === semContainers);
}

console.log(R.join('\n'));
