import { buildSectorContainers, normalizeContainerZIndex, CONTAINER_BASE_Z_INDEX, alignContainerSiblings, alignAllContainers } from '../.tmp-sectorContainers.mjs';

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

// 6. alignContainerSiblings: mover/redimensionar uma raia mantém as outras
//    raias (nunca os quadros) com a mesma borda esquerda e largura —
//    layout de referência (raias empilhadas, mesmo X e largura).
{
  const nodes = [
    { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 800, height: 200 }, data: { label: 'Picking' } },
    { id: 'lane2', type: 'swimlane', position: { x: 40, y: 220 }, style: { width: 700, height: 180 }, data: { label: 'Coleta' } },
    { id: 'lane3', type: 'swimlane', position: { x: -20, y: 420 }, style: { width: 900, height: 160 }, data: { label: 'Embalagem' } },
    { id: 'frame1', type: 'frame', position: { x: 200, y: 0 }, style: { width: 300, height: 100 }, data: {} },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: { label: 'Processo' } },
  ];
  const result = alignContainerSiblings(nodes, 'lane1');
  const lane2 = result.find((n) => n.id === 'lane2');
  const lane3 = result.find((n) => n.id === 'lane3');
  const frame1 = result.find((n) => n.id === 'frame1');
  const n1 = result.find((n) => n.id === 'n1');
  check('raia movida/redimensionada não muda a própria posição/tamanho', result.find((n) => n.id === 'lane1').position.x === 0 && result.find((n) => n.id === 'lane1').style.width === 800);
  check('outras raias acompanham o X da raia ajustada', lane2.position.x === 0 && lane3.position.x === 0, `${lane2.position.x}, ${lane3.position.x}`);
  check('outras raias acompanham a largura da raia ajustada', lane2.style.width === 800 && lane3.style.width === 800, `${lane2.style.width}, ${lane3.style.width}`);
  check('outras raias mantêm o próprio Y/altura (não empilha automaticamente)', lane2.position.y === 220 && lane3.position.y === 420);
  check('quadro (tipo diferente) não é mexido ao alinhar raias', frame1.position.x === 200 && frame1.style.width === 300);
  check('nó de processo não é mexido', n1.position.x === 10);
}

// 7. Sem outras raias/quadros do mesmo tipo, não mexe em nada.
{
  const nodes = [
    { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 800, height: 200 }, data: {} },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: {} },
  ];
  const result = alignContainerSiblings(nodes, 'lane1');
  check('raia sozinha (sem irmãs) não gera nova referência do array', result === nodes);
}

// 8. alignAllContainers: corrige de uma vez, ao carregar/importar, raias
//    (e quadros, separadamente) que já estavam salvas com borda/largura
//    diferentes entre si — sem precisar o usuário mexer em nenhuma delas.
{
  const nodes = [
    { id: 'lane1', type: 'swimlane', position: { x: 0, y: 0 }, style: { width: 800, height: 200 }, data: { label: 'Embalagem/Faturamento' } },
    { id: 'lane2', type: 'swimlane', position: { x: 40, y: 220 }, style: { width: 650, height: 180 }, data: { label: 'Expedição' } },
    { id: 'lane3', type: 'swimlane', position: { x: -30, y: 420 }, style: { width: 900, height: 260 }, data: { label: 'Reserva' } },
    { id: 'frame1', type: 'frame', position: { x: 200, y: 0 }, style: { width: 300, height: 100 }, data: {} },
    { id: 'frame2', type: 'frame', position: { x: 250, y: 120 }, style: { width: 400, height: 100 }, data: {} },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: { label: 'Processo' } },
  ];
  const result = alignAllContainers(nodes);
  const lanes = result.filter((n) => n.type === 'swimlane');
  const frames = result.filter((n) => n.type === 'frame');
  const n1 = result.find((n) => n.id === 'n1');
  check('todas as raias ficam com o X da primeira', lanes.every((l) => l.position.x === 0), JSON.stringify(lanes.map((l) => l.position.x)));
  check('todas as raias ficam com a largura da primeira', lanes.every((l) => l.style.width === 800), JSON.stringify(lanes.map((l) => l.style.width)));
  check('raias mantêm o próprio Y/altura', lanes[1].position.y === 220 && lanes[2].position.y === 420);
  check('todos os quadros ficam com o X/largura do primeiro quadro (grupo separado das raias)', frames.every((f) => f.position.x === 200 && f.style.width === 300));
  check('nó de processo não é mexido', n1.position.x === 10);
}

// 9. alignAllContainers sem raias/quadros (ou só 1 de cada) não mexe em nada.
{
  const nodes = [
    { id: 'lane1', type: 'swimlane', position: { x: 5, y: 0 }, style: { width: 800, height: 200 }, data: {} },
    { id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: {} },
  ];
  const result = alignAllContainers(nodes);
  check('raia sozinha (já é a própria referência) não gera nova referência do array', result === nodes);

  const semContainers = [{ id: 'n1', type: 'process', position: { x: 10, y: 10 }, data: {} }];
  check('sem raia/quadro nenhum, retorna a mesma referência', alignAllContainers(semContainers) === semContainers);
}

console.log(R.join('\n'));
