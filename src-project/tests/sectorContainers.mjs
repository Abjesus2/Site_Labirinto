import { buildSectorContainers, normalizeContainerZIndex, CONTAINER_BASE_Z_INDEX, rebuildAIContainers, fillMissingDepartments } from '../.tmp-sectorContainers.mjs';

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

  // Fluxo da esquerda para a direita: raias horizontais (uma linha por setor).
  const lr = buildSectorContainers([proc('a1', 0, 0, 'Recebimento'), proc('b1', 300, 0, 'Estoque'), proc('a2', 600, 0, 'Recebimento')], 'LR');
  const lrLanes = lr.filter((n) => n.type === 'swimlane');
  const lrById = Object.fromEntries(lr.map((n) => [n.id, n]));
  check('fluxo para a direita: raias horizontais empilhadas', lrLanes.length === 2 && lrLanes[1].position.y === lrLanes[0].position.y + lrLanes[0].style.height && lrLanes.every((l) => l.data.orientation === 'horizontal'));
  check('fluxo para a direita: etapas mantêm a posição no sentido do fluxo', lrById.a1.position.x === 0 && lrById.b1.position.x === 300 && lrById.a2.position.x === 600 && lrById.b1.position.y > lrById.a1.position.y);
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
  check('nós de processo continuam no lugar (rebuildAIContainers só mexe nas raias/quadros)', a1.position.x === 0 && a1.position.y === 0);
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
